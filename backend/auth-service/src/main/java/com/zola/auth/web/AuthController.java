package com.zola.auth.web;

import com.zola.auth.dto.AuthDtos;
import com.zola.auth.entity.UserEntity;
import com.zola.auth.service.AuthService;
import com.zola.auth.service.JwtService;
import com.zola.auth.service.OtpService;
import com.zola.common.response.ApiResponse;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final OtpService otpService;

    public AuthController(AuthService authService, JwtService jwtService, OtpService otpService) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.otpService = otpService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthDtos.RegisterInitResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Register success", authService.register(request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @PostMapping("/register/verify-otp")
    public ApiResponse<AuthDtos.AuthTokenResponse> verifyRegisterOtp(@Valid @RequestBody AuthDtos.RegisterOtpVerifyRequest request, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Register verified", authService.verifyRegisterOtp(request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @PostMapping("/login")
    public ApiResponse<AuthDtos.AuthTokenResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Login success", authService.login(request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @PostMapping("/login/request-otp")
    public ApiResponse<Map<String, Object>> requestLoginOtp(@Valid @RequestBody AuthDtos.RequestLoginOtpRequest request, HttpServletRequest httpRequest) {
        authService.requestLoginOtp(request, clientIp(httpRequest), userAgent(httpRequest));
        return ApiResponse.ok("OTP sent", Map.of("email", request.email()));
    }

    @PostMapping("/login/verify-otp")
    public ApiResponse<AuthDtos.AuthTokenResponse> verifyLoginOtp(@Valid @RequestBody AuthDtos.VerifyLoginOtpRequest request, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Login success", authService.verifyLoginOtp(request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthDtos.AuthTokenResponse> refresh(@Valid @RequestBody AuthDtos.RefreshRequest request, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Refresh success", authService.refresh(request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @PostMapping("/logout")
    public ApiResponse<Map<String, Object>> logout(@RequestHeader("Authorization") String authorization, HttpServletRequest httpRequest) {
        Claims claims = parseBearer(authorization);
        authService.logout(UUID.fromString(claims.get("userId", String.class)), UUID.fromString(claims.get("sessionId", String.class)), clientIp(httpRequest), userAgent(httpRequest));
        return ApiResponse.ok("Logout success", Map.of("ok", true));
    }

    @PostMapping("/logout-all")
    public ApiResponse<Map<String, Object>> logoutAll(@RequestHeader("Authorization") String authorization, HttpServletRequest httpRequest) {
        Claims claims = parseBearer(authorization);
        authService.logoutAll(UUID.fromString(claims.get("userId", String.class)), clientIp(httpRequest), userAgent(httpRequest));
        return ApiResponse.ok("Logout all success", Map.of("ok", true));
    }

    @GetMapping("/sessions")
    public ApiResponse<List<AuthDtos.SessionResponse>> sessions(@RequestHeader("Authorization") String authorization) {
        Claims claims = parseBearer(authorization);
        UUID userId = UUID.fromString(claims.get("userId", String.class));
        return ApiResponse.ok("Active sessions", authService.getSessions(userId));
    }

    @DeleteMapping("/sessions/{id}")
    public ApiResponse<Map<String, Object>> revokeSession(
        @RequestHeader("Authorization") String authorization,
        @PathVariable("id") UUID sessionId,
        HttpServletRequest httpRequest
    ) {
        Claims claims = parseBearer(authorization);
        UUID userId = UUID.fromString(claims.get("userId", String.class));
        authService.revokeSession(userId, sessionId, clientIp(httpRequest), userAgent(httpRequest));
        return ApiResponse.ok("Session revoked", Map.of("sessionId", sessionId));
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Map<String, Object>> forgotPassword(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        UUID userId = resolveUserIdFromIdentifier(request.identifier());
        otpService.issueOtp(userId, request, clientIp(httpRequest), userAgent(httpRequest));
        return ApiResponse.ok("OTP issued", Map.of("identifier", request.identifier()));
    }

    @PostMapping("/verify-otp")
    public ApiResponse<AuthDtos.OtpVerifyResponse> verifyOtp(@Valid @RequestBody AuthDtos.VerifyOtpRequest request, HttpServletRequest httpRequest) {
        UUID userId = resolveUserIdFromIdentifier(request.identifier());
        return ApiResponse.ok("OTP verify result", otpService.verifyOtp(userId, request, clientIp(httpRequest), userAgent(httpRequest)));
    }

    @GetMapping("/profile")
    public ApiResponse<AuthDtos.UserProfileResponse> profile(@RequestHeader("Authorization") String authorization) {
        Claims claims = parseBearer(authorization);
        UUID userId = UUID.fromString(claims.get("userId", String.class));
        UserEntity user = authService.getUserById(userId);
        return ApiResponse.ok("Profile fetched", toProfile(user));
    }

    @GetMapping("/users/search-by-email")
    public ApiResponse<AuthDtos.UserProfileResponse> searchByEmail(@RequestHeader("Authorization") String authorization, @org.springframework.web.bind.annotation.RequestParam("email") String email) {
        parseBearer(authorization);
        UserEntity user = authService.getUserByIdentifier(email);
        return ApiResponse.ok("User found", toProfile(user));
    }

    @GetMapping("/users/{id}/summary")
    public ApiResponse<AuthDtos.UserProfileResponse> userSummary(@RequestHeader("Authorization") String authorization, @PathVariable("id") UUID userId) {
        parseBearer(authorization);
        UserEntity user = authService.getUserById(userId);
        return ApiResponse.ok("User summary fetched", toProfile(user));
    }

    private UUID resolveUserIdFromIdentifier(String identifier) {
        UserEntity user = authService.getUserByIdentifier(identifier);
        return user.getId();
    }

    private Claims parseBearer(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing bearer token");
        }
        return jwtService.parse(authorization.substring(7));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        return userAgent == null ? "unknown" : userAgent;
    }

    private AuthDtos.UserProfileResponse toProfile(UserEntity user) {
        String birthdate = user.getBirthdate() == null ? null : user.getBirthdate().toString();
        return new AuthDtos.UserProfileResponse(
            user.getId(),
            user.getFullName(),
            user.getEmail(),
            user.getAvatarUrl(),
            user.getGender(),
            birthdate
        );
    }
}
