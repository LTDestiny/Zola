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
@Table(name = "otp_logs")
public class OtpLogEntity {

    @Id
    private UUID id;

    private UUID userId;

    private String identifier;

    private String otpType;

    private Integer attempts;

    private Instant sentAt;

    private Instant expiresAt;

    private Instant usedAt;
}
