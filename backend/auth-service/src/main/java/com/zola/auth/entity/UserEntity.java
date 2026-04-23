package com.zola.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String fullName;

    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String phone;

    @Column(nullable = false)
    private String identityType;

    @Column(nullable = false)
    private String passwordHash;

    private String avatarUrl;

    private String gender;

    private LocalDate birthdate;

    private Boolean hideBirthdate;

    private Boolean hideEmail;

    private Boolean hidePhone;

    private Boolean allowStrangerMessages;

    private Boolean isOnline;

    private Instant lastSeenAt;

    private Boolean isActive;

    private Boolean isDeleted;

    private Instant deletedAt;

    private Boolean emailVerified;

    private Boolean phoneVerified;

    private Boolean twoFaEnabled;

    private String twoFaSecret;

    private Instant tosAcceptedAt;

    private String tosVersion;

    private Instant createdAt;

    private Instant updatedAt;
}
