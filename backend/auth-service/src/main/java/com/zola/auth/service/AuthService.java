package com.zola.auth.service;

import com.zola.auth.dto.AuthDtos;
import com.zola.auth.entity.UserEntity;
import com.zola.auth.entity.UserSessionEntity;
import com.zola.auth.repository.UserRepository;
import com.zola.auth.repository.UserSessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final SessionRedisService sessionRedisService;
    private final SecurityLogService securityLogService;
    private final SessionSyncPublisher sessionSyncPublisher;
    private final long refreshTtlSeconds;
    private final String samePlatformPolicy;

    public AuthService(
        UserRepository userRepository,
        UserSessionRepository userSessionRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        OtpService otpService,
        SessionRedisService sessionRedisService,
        SecurityLogService securityLogService,
        SessionSyncPublisher sessionSyncPublisher,
        @Value("${jwt.refresh-token-expiry-seconds}") long refreshTtlSeconds,
        @Value("${app.session.same-platform-policy:REVOKE}") String samePlatformPolicy
    ) {
        this.userRepository = userRepository;
        this.userSessionRepository = userSessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.sessionRedisService = sessionRedisService;
        this.securityLogService = securityLogService;
        this.sessionSyncPublisher = sessionSyncPublisher;
        this.refreshTtlSeconds = refreshTtlSeconds;
        this.samePlatformPolicy = samePlatformPolicy;
    }

    @Transactional
    public AuthDtos.RegisterInitResponse register(AuthDtos.RegisterRequest request, String ip, String userAgent) {
        String email = normalize(request.email());
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        if (!request.password().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password confirmation does not match");
        }
        if (!request.acceptedPolicy()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Policy must be accepted");
        }

        UserEntity user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user != null && Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        Instant now = Instant.now();
        if (user == null) {
            user = UserEntity.builder()
                .id(UUID.randomUUID())
                .email(email)
                .phone(null)
                .identityType("EMAIL")
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .hideBirthdate(false)
                .hideEmail(false)
                .hidePhone(false)
                .allowStrangerMessages(true)
                .isActive(true)
                .isDeleted(false)
                .emailVerified(false)
                .phoneVerified(false)
                .twoFaEnabled(false)
                .tosAcceptedAt(now)
                .tosVersion(policyVersion(request.policyVersion()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        } else {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            user.setFullName(request.fullName());
            user.setIsActive(true);
            user.setIsDeleted(false);
            user.setTosAcceptedAt(now);
            user.setTosVersion(policyVersion(request.policyVersion()));
            user.setUpdatedAt(now);
        }
        userRepository.save(user);

        otpService.issueRegisterEmailOtp(user.getId(), user.getEmail(), ip, userAgent);
        securityLogService.write(user.getId(), "REGISTER_OTP_REQUESTED", ip, userAgent, "{}");
        return new AuthDtos.RegisterInitResponse(user.getEmail(), true);
    }

    @Transactional
    public AuthDtos.AuthTokenResponse verifyRegisterOtp(AuthDtos.RegisterOtpVerifyRequest request, String ip, String userAgent) {
        UserEntity user = userRepository.findByEmailIgnoreCase(normalize(request.email()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email is not registered"));

        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive");
        }

        AuthDtos.OtpVerifyResponse otpResult = otpService.verifyRegisterEmailOtp(user.getId(), user.getEmail(), request.code(), ip, userAgent);
        if (!otpResult.valid()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, otpResult.message());
        }

        user.setEmailVerified(true);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        AuthDtos.AuthTokenResponse response = createSessionAndTokens(user, requestDeviceName(request.deviceName()), requestDeviceType(request.deviceType()), ip, userAgent);
        securityLogService.write(user.getId(), "REGISTER_VERIFIED", ip, userAgent, "{}");
        return response;
    }

    @Transactional
    public AuthDtos.AuthTokenResponse login(AuthDtos.LoginRequest request, String ip, String userAgent) {
        UserEntity user = userRepository.findByEmailIgnoreCase(normalize(request.email()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive");
        }
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email is not verified");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        AuthDtos.AuthTokenResponse response = createSessionAndTokens(user, requestDeviceName(request.deviceName()), requestDeviceType(request.deviceType()), ip, userAgent);
        securityLogService.write(user.getId(), "LOGIN", ip, userAgent, "{}");
        return response;
    }

    @Transactional
    public void requestLoginOtp(AuthDtos.RequestLoginOtpRequest request, String ip, String userAgent) {
        UserEntity user = userRepository.findByEmailIgnoreCase(normalize(request.email()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email is not registered"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive");
        }

        otpService.issueLoginEmailOtp(user.getId(), user.getEmail(), ip, userAgent);
        securityLogService.write(user.getId(), "LOGIN_OTP_REQUESTED", ip, userAgent, "{}");
    }

    @Transactional
    public AuthDtos.AuthTokenResponse verifyLoginOtp(AuthDtos.VerifyLoginOtpRequest request, String ip, String userAgent) {
        UserEntity user = userRepository.findByEmailIgnoreCase(normalize(request.email()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email is not registered"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive");
        }

        AuthDtos.OtpVerifyResponse otpResult = otpService.verifyLoginEmailOtp(user.getId(), user.getEmail(), request.code(), ip, userAgent);
        if (!otpResult.valid()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, otpResult.message());
        }

        AuthDtos.AuthTokenResponse response = createSessionAndTokens(user, requestDeviceName(request.deviceName()), requestDeviceType(request.deviceType()), ip, userAgent);
        securityLogService.write(user.getId(), "LOGIN", ip, userAgent, "{}");
        return response;
    }

    @Transactional
    public AuthDtos.AuthTokenResponse refresh(AuthDtos.RefreshRequest request, String ip, String userAgent) {
        UserSessionEntity session = userSessionRepository.findByRefreshTokenAndIsActiveTrue(request.refreshToken())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));
        if (session.getExpiresAt().isBefore(Instant.now())) {
            session.setIsActive(false);
            userSessionRepository.save(session);
            sessionRedisService.revokeSession(session.getUserId(), session.getId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        UserEntity user = userRepository.findById(session.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        session.setLastUsedAt(Instant.now());
        userSessionRepository.save(session);
        sessionRedisService.activateSession(user.getId(), session.getId(), Duration.ofSeconds(refreshTtlSeconds));

        String subject = user.getEmail() != null ? user.getEmail() : user.getPhone();
        String accessToken = jwtService.generateAccessToken(user.getId(), session.getId(), subject);
        securityLogService.write(user.getId(), "TOKEN_REFRESH", ip, userAgent, "{}");
        return new AuthDtos.AuthTokenResponse(
            user.getId(),
            session.getId(),
            accessToken,
            jwtService.getAccessTtlSeconds(),
            session.getRefreshToken(),
            refreshTtlSeconds
        );
    }

    @Transactional
    public void logout(UUID userId, UUID sessionId, String ip, String userAgent) {
        UserSessionEntity session = userSessionRepository.findByIdAndUserIdAndIsActiveTrue(sessionId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        session.setIsActive(false);
        userSessionRepository.save(session);
        sessionRedisService.revokeSession(userId, sessionId);
        refreshUserOnlineStatus(userId);
        securityLogService.write(userId, "LOGOUT", ip, userAgent, "{\"sessionId\":\"" + sessionId + "\"}");
    }

    @Transactional
    public void logoutAll(UUID userId, String ip, String userAgent) {
        List<UserSessionEntity> sessions = userSessionRepository.findByUserIdAndIsActiveTrue(userId);
        for (UserSessionEntity session : sessions) {
            session.setIsActive(false);
            sessionRedisService.revokeSession(userId, session.getId());
        }
        userSessionRepository.saveAll(sessions);
        refreshUserOnlineStatus(userId);
        securityLogService.write(userId, "LOGOUT_ALL", ip, userAgent, "{}");
    }

    @Transactional(readOnly = true)
    public List<AuthDtos.SessionResponse> getSessions(UUID userId) {
        return userSessionRepository.findByUserIdAndIsActiveTrue(userId)
            .stream()
            .map(s -> new AuthDtos.SessionResponse(
                s.getId(),
                s.getDeviceName(),
                s.getDeviceType(),
                s.getIpAddress(),
                s.getUserAgent(),
                s.getExpiresAt(),
                s.getLastUsedAt(),
                s.getCreatedAt()
            ))
            .toList();
    }

    @Transactional
    public void revokeSession(UUID userId, UUID targetSessionId, String ip, String userAgent) {
        logout(userId, targetSessionId, ip, userAgent);
    }

    @Transactional(readOnly = true)
    public UserEntity getUserById(UUID userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    @Transactional(readOnly = true)
    public UserEntity getUserByIdentifier(String identifier) {
        return findByIdentifier(identifier)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    @Transactional
    public UserEntity updateProfile(UUID userId, AuthDtos.UpdateProfileRequest request, String ip, String userAgent) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive");
        }

        String normalizedPhone = normalizeOptional(request.phone());
        if (normalizedPhone != null) {
            userRepository.findByPhone(normalizedPhone)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone already in use");
                });
        }

        user.setFullName(request.fullName().trim());
        user.setPhone(normalizedPhone);
        user.setAvatarUrl(normalizeOptional(request.avatarUrl()));
        user.setGender(normalizeGender(request.gender()));
        user.setBirthdate(parseBirthdate(request.birthdate()));
        user.setHideBirthdate(Boolean.TRUE.equals(request.hideBirthdate()));
        user.setHideEmail(Boolean.TRUE.equals(request.hideEmail()));
        user.setHidePhone(Boolean.TRUE.equals(request.hidePhone()));
        user.setAllowStrangerMessages(request.allowStrangerMessages() == null || request.allowStrangerMessages());
        user.setUpdatedAt(Instant.now());

        UserEntity saved = userRepository.save(user);
        securityLogService.write(userId, "PROFILE_UPDATED", ip, userAgent, "{}");
        return saved;
    }

    @Transactional
    public void resetPassword(UUID userId, AuthDtos.ResetPasswordRequest request, String ip, String userAgent) {
        AuthDtos.VerifyOtpRequest verifyRequest = new AuthDtos.VerifyOtpRequest(
            request.identifier(),
            request.otpType(),
            request.code()
        );
        AuthDtos.OtpVerifyResponse result = otpService.verifyOtp(userId, verifyRequest, ip, userAgent);
        if (!result.valid()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, result.message());
        }

        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        securityLogService.write(userId, "PASSWORD_RESET", ip, userAgent, "{}");
    }

    @Transactional
    public void deleteAccount(UUID userId, String ip, String userAgent) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (Boolean.TRUE.equals(user.getIsDeleted())) {
            return;
        }

        Instant now = Instant.now();
        user.setIsDeleted(true);
        user.setIsActive(false);
        user.setIsOnline(false);
        user.setDeletedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        List<UserSessionEntity> sessions = userSessionRepository.findByUserIdAndIsActiveTrue(userId);
        for (UserSessionEntity session : sessions) {
            session.setIsActive(false);
            sessionRedisService.revokeSession(userId, session.getId());
        }
        userSessionRepository.saveAll(sessions);
        securityLogService.write(userId, "ACCOUNT_DELETED", ip, userAgent, "{}");
    }

    private java.util.Optional<UserEntity> findByIdentifier(String identifier) {
        String normalized = identifier.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains("@")) {
            return userRepository.findByEmailIgnoreCase(normalized);
        }
        return userRepository.findByPhone(normalized);
    }

    private AuthDtos.AuthTokenResponse createSessionAndTokens(UserEntity user, String deviceName, String deviceType, String ip, String userAgent) {
        enforceSingleActiveSessionPerDeviceType(user.getId(), deviceType);

        UUID sessionId = UUID.randomUUID();
        String refreshToken = UUID.randomUUID().toString();
        Instant now = Instant.now();
        UserSessionEntity session = UserSessionEntity.builder()
            .id(sessionId)
            .userId(user.getId())
            .refreshToken(refreshToken)
            .deviceName(deviceName)
            .deviceType(deviceType)
            .ipAddress(ip)
            .userAgent(userAgent)
            .isActive(true)
            .expiresAt(now.plusSeconds(refreshTtlSeconds))
            .lastUsedAt(now)
            .createdAt(now)
            .build();
        userSessionRepository.save(session);
        sessionRedisService.activateSession(user.getId(), sessionId, Duration.ofSeconds(refreshTtlSeconds));
        markUserOnline(user);

        String subject = user.getEmail() != null ? user.getEmail() : user.getPhone();
        String accessToken = jwtService.generateAccessToken(user.getId(), sessionId, subject);
        return new AuthDtos.AuthTokenResponse(
            user.getId(),
            sessionId,
            accessToken,
            jwtService.getAccessTtlSeconds(),
            refreshToken,
            refreshTtlSeconds
        );
    }

    private void markUserOnline(UserEntity user) {
        Instant now = Instant.now();
        user.setIsOnline(true);
        user.setLastSeenAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    private void refreshUserOnlineStatus(UUID userId) {
        boolean hasActiveSession = !userSessionRepository.findByUserIdAndIsActiveTrue(userId).isEmpty();
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Instant now = Instant.now();
        if (hasActiveSession) {
            if (!Boolean.TRUE.equals(user.getIsOnline())) {
                user.setIsOnline(true);
                user.setUpdatedAt(now);
                userRepository.save(user);
            }
            return;
        }

        user.setIsOnline(false);
        user.setLastSeenAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    private String requestDeviceName(String deviceName) {
        return deviceName == null || deviceName.isBlank() ? "Unknown Device" : deviceName;
    }

    private String requestDeviceType(String deviceType) {
        if (deviceType == null || deviceType.isBlank()) {
            return "WEB";
        }

        String normalized = deviceType.trim().toUpperCase(Locale.ROOT);
        if ("MOBILE".equals(normalized) || "ANDROID".equals(normalized) || "IOS".equals(normalized)) {
            return "MOBILE";
        }
        return "WEB";
    }

    private void enforceSingleActiveSessionPerDeviceType(UUID userId, String deviceType) {
        List<UserSessionEntity> sameDeviceSessions = userSessionRepository.findByUserIdAndDeviceTypeIgnoreCaseAndIsActiveTrue(userId, deviceType);
        if (sameDeviceSessions.isEmpty()) {
            return;
        }

        String policy = samePlatformPolicy == null ? "REVOKE" : samePlatformPolicy.trim().toUpperCase(Locale.ROOT);
        if ("REJECT".equals(policy)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "An active " + deviceType + " session already exists"
            );
        }

        for (UserSessionEntity session : sameDeviceSessions) {
            session.setIsActive(false);
            sessionRedisService.revokeSession(userId, session.getId());
            String payload = "{\"sessionId\":\"" + session.getId() + "\",\"deviceType\":\"" + deviceType + "\",\"reason\":\"NEW_LOGIN\"}";
            sessionSyncPublisher.publish(userId, "SESSION_REVOKED", payload);
        }
        userSessionRepository.saveAll(sameDeviceSessions);
    }

    private String policyVersion(String value) {
        if (value == null || value.isBlank()) {
            return "v1";
        }
        return value.trim();
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private LocalDate parseBirthdate(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid birthdate format. Use yyyy-MM-dd");
        }
    }

    private String normalizeGender(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            return null;
        }

        String key = normalized.toLowerCase(Locale.ROOT);
        return switch (key) {
            case "nam", "male" -> "MALE";
            case "nu", "nữ", "female" -> "FEMALE";
            case "khac", "khác", "other" -> "OTHER";
            default -> throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Gender must be one of: nam, nu, khac"
            );
        };
    }
}
