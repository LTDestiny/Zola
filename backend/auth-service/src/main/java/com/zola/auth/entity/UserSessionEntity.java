package com.zola.auth.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_sessions")
public class UserSessionEntity {

    @Id
    private UUID id;

    private UUID userId;

    private String refreshToken;

    private String deviceName;

    private String deviceType;

    private String ipAddress;

    private String userAgent;

    private Boolean isActive;

    private Instant expiresAt;

    private Instant lastUsedAt;

    private Instant createdAt;
}
