package com.zola.auth.service;

import com.zola.auth.dto.AuthDtos;
import com.zola.auth.entity.OtpLogEntity;
import com.zola.auth.repository.OtpLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class OtpService {

    private final StringRedisTemplate redisTemplate;
    private final OtpLogRepository otpLogRepository;
    private final SecurityLogService securityLogService;
    private final EmailSenderService emailSenderService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final int maxAttemptsPerHour;
    private final int resendDelaySeconds;
    private final int maxFailAttempts;
    private final int lockDurationMinutes;
    private final int otpTtlSeconds;
    private final String otpHashSalt;

    public OtpService(
        StringRedisTemplate redisTemplate,
        OtpLogRepository otpLogRepository,
        SecurityLogService securityLogService,
        EmailSenderService emailSenderService,
        @Value("${security.otp.max-attempts-per-hour}") int maxAttemptsPerHour,
        @Value("${security.otp.resend-delay-seconds}") int resendDelaySeconds,
        @Value("${security.otp.max-fail-attempts}") int maxFailAttempts,
        @Value("${security.otp.lock-duration-minutes}") int lockDurationMinutes,
        @Value("${security.otp.ttl-seconds}") int otpTtlSeconds,
        @Value("${security.otp.hash-salt:change-this-otp-salt}") String otpHashSalt
    ) {
        this.redisTemplate = redisTemplate;
        this.otpLogRepository = otpLogRepository;
        this.securityLogService = securityLogService;
        this.emailSenderService = emailSenderService;
        this.maxAttemptsPerHour = maxAttemptsPerHour;
        this.resendDelaySeconds = resendDelaySeconds;
        this.maxFailAttempts = maxFailAttempts;
        this.lockDurationMinutes = lockDurationMinutes;
        this.otpTtlSeconds = otpTtlSeconds;
        this.otpHashSalt = otpHashSalt;
    }

    public void issueOtp(UUID userId, AuthDtos.ForgotPasswordRequest request, String ip, String userAgent) {
        if (!"EMAIL".equalsIgnoreCase(request.otpType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only EMAIL OTP is supported");
        }

        String identifier = request.identifier().trim().toLowerCase();
        issueOtpInternal(userId, identifier, "PASSWORD_RESET_EMAIL", ip, userAgent);
    }

    public void issueLoginEmailOtp(UUID userId, String email, String ip, String userAgent) {
        issueOtpInternal(userId, email.trim().toLowerCase(), "LOGIN_EMAIL", ip, userAgent);
    }

    public AuthDtos.OtpVerifyResponse verifyLoginEmailOtp(UUID userId, String email, String code, String ip, String userAgent) {
        return verifyOtpInternal(userId, email.trim().toLowerCase(), "LOGIN_EMAIL", code, ip, userAgent);
    }

    public void issueRegisterEmailOtp(UUID userId, String email, String ip, String userAgent) {
        issueOtpInternal(userId, email.trim().toLowerCase(), "REGISTER_EMAIL", ip, userAgent);
    }

    public AuthDtos.OtpVerifyResponse verifyRegisterEmailOtp(UUID userId, String email, String code, String ip, String userAgent) {
        return verifyOtpInternal(userId, email.trim().toLowerCase(), "REGISTER_EMAIL", code, ip, userAgent);
    }

    private void issueOtpInternal(UUID userId, String identifier, String otpType, String ip, String userAgent) {
        String lockKey = "otp:lock:" + identifier;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(lockKey))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "OTP is temporarily locked");
        }

        String rateKey = "rate:otp:" + identifier;
        Long rate = redisTemplate.opsForValue().increment(rateKey);
        if (rate != null && rate == 1L) {
            redisTemplate.expire(rateKey, Duration.ofHours(1));
        }
        if (rate != null && rate > maxAttemptsPerHour) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "OTP rate limit exceeded");
        }

        String resendKey = "otp:last-send:" + identifier;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(resendKey))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before requesting another OTP");
        }
        redisTemplate.opsForValue().set(resendKey, "1", Duration.ofSeconds(resendDelaySeconds));

        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));
        String otpKey = otpKey(otpType, identifier);
        redisTemplate.opsForHash().put(otpKey, "codeHash", hashOtp(identifier, otpType, otp));
        redisTemplate.opsForHash().put(otpKey, "attempts", "0");
        redisTemplate.expire(otpKey, Duration.ofSeconds(otpTtlSeconds));

        try {
            emailSenderService.sendOtpEmail(identifier, otp, otpType, otpTtlSeconds);
        } catch (MailAuthenticationException ex) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "SMTP authentication failed. Please verify SMTP_USER and SMTP_PASSWORD (use Gmail App Password)."
            );
        } catch (MailSendException ex) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Cannot send OTP email. Please verify SMTP_HOST/SMTP_PORT and network connectivity."
            );
        }

        otpLogRepository.save(OtpLogEntity.builder()
            .id(UUID.randomUUID())
            .userId(userId)
            .identifier(identifier)
            .otpType(otpType)
            .attempts(0)
            .sentAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(otpTtlSeconds))
            .build());

        securityLogService.write(userId, "OTP_ISSUED", ip, userAgent, "{\"identifier\":\"" + identifier + "\",\"otpType\":\"" + otpType + "\"}");
    }

    public AuthDtos.OtpVerifyResponse verifyOtp(UUID userId, AuthDtos.VerifyOtpRequest request, String ip, String userAgent) {
        if (!"EMAIL".equalsIgnoreCase(request.otpType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only EMAIL OTP is supported");
        }

        String identifier = request.identifier().trim().toLowerCase();
        return verifyOtpInternal(userId, identifier, "PASSWORD_RESET_EMAIL", request.code(), ip, userAgent);
    }

    private AuthDtos.OtpVerifyResponse verifyOtpInternal(
        UUID userId,
        String identifier,
        String otpType,
        String code,
        String ip,
        String userAgent
    ) {
        String otpKey = otpKey(otpType, identifier);
        Object codeHashObj = redisTemplate.opsForHash().get(otpKey, "codeHash");
        Object legacyCodeObj = redisTemplate.opsForHash().get(otpKey, "code");
        Object attemptsObj = redisTemplate.opsForHash().get(otpKey, "attempts");
        if (codeHashObj == null && legacyCodeObj == null) {
            return new AuthDtos.OtpVerifyResponse(false, "OTP expired or not found");
        }

        int attempts = attemptsObj == null ? 0 : Integer.parseInt(attemptsObj.toString());
        boolean valid;
        if (codeHashObj != null) {
            valid = codeHashObj.toString().equals(hashOtp(identifier, otpType, code));
        } else {
            valid = legacyCodeObj.toString().equals(code);
        }

        if (!valid) {
            attempts += 1;
            redisTemplate.opsForHash().put(otpKey, "attempts", String.valueOf(attempts));
            if (attempts >= maxFailAttempts) {
                redisTemplate.delete(otpKey);
                redisTemplate.opsForValue().set("otp:lock:" + identifier, "1", Duration.ofMinutes(lockDurationMinutes));
            }
            securityLogService.write(userId, "OTP_VERIFY_FAILED", ip, userAgent, "{\"identifier\":\"" + identifier + "\",\"attempts\":" + attempts + "}");
            return new AuthDtos.OtpVerifyResponse(false, "Invalid OTP");
        }

        redisTemplate.delete(otpKey);
        securityLogService.write(userId, "OTP_VERIFY_SUCCESS", ip, userAgent, "{\"identifier\":\"" + identifier + "\"}");
        return new AuthDtos.OtpVerifyResponse(true, "OTP verified");
    }

    private String otpKey(String type, String identifier) {
        return "otp:" + type + ":" + identifier;
    }

    private String hashOtp(String identifier, String otpType, String otp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String value = otpHashSalt + "|" + identifier + "|" + otpType + "|" + otp;
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot hash OTP", ex);
        }
    }
}
