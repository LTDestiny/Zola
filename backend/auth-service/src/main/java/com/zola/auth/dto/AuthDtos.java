package com.zola.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank String fullName,
        @NotBlank String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @NotBlank @Size(min = 8, max = 100) String confirmPassword,
        boolean acceptedPolicy,
        String policyVersion
    ) {
    }

    public record RegisterOtpVerifyRequest(
        @NotBlank String email,
        @NotBlank String code,
        String deviceName,
        String deviceType
    ) {
    }

    public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password,
        String deviceName,
        String deviceType
    ) {
    }

    public record RegisterInitResponse(
        String email,
        boolean otpRequired
    ) {
    }

    public record RequestLoginOtpRequest(
        @NotBlank String email
    ) {
    }

    public record VerifyLoginOtpRequest(
        @NotBlank String email,
        @NotBlank String code,
        String deviceName,
        String deviceType
    ) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record ForgotPasswordRequest(@NotBlank String identifier, @NotBlank String otpType) {
    }

    public record VerifyOtpRequest(@NotBlank String identifier, @NotBlank String otpType, @NotBlank String code) {
    }

    public record ResetPasswordRequest(
        @NotBlank String identifier,
        @NotBlank String otpType,
        @NotBlank String code,
        @NotBlank @Size(min = 8, max = 100) String newPassword
    ) {
    }

    public record AuthTokenResponse(
        UUID userId,
        UUID sessionId,
        String accessToken,
        long accessExpiresInSeconds,
        String refreshToken,
        long refreshExpiresInSeconds
    ) {
    }

    public record SessionResponse(
        UUID id,
        String deviceName,
        String deviceType,
        String ipAddress,
        String userAgent,
        Instant expiresAt,
        Instant lastUsedAt,
        Instant createdAt
    ) {
    }

    public record OtpVerifyResponse(boolean valid, String message) {
    }

    public record UserProfileResponse(
        UUID id,
        String fullName,
        String email,
        String phone,
        String avatarUrl,
        String gender,
        String birthdate,
        Boolean hideBirthdate,
        Boolean hideEmail,
        Boolean hidePhone,
        Boolean allowStrangerMessages,
        Boolean isOnline,
        String lastSeenAt
    ) {
    }

    public record MessageSettingsResponse(
        UUID id,
        Boolean allowStrangerMessages
    ) {
    }

    public record UpdateProfileRequest(
        @NotBlank @Size(max = 100) String fullName,
        @Size(max = 20) String phone,
        @Size(max = 1000) String avatarUrl,
        @Size(max = 10) String gender,
        String birthdate,
        Boolean hideBirthdate,
        Boolean hideEmail,
        Boolean hidePhone,
        Boolean allowStrangerMessages
    ) {
    }
}
