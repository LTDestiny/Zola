package com.zola.auth.repository;

import com.zola.auth.entity.UserSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserSessionRepository extends JpaRepository<UserSessionEntity, UUID> {
    Optional<UserSessionEntity> findByRefreshTokenAndIsActiveTrue(String refreshToken);

    List<UserSessionEntity> findByUserIdAndIsActiveTrue(UUID userId);

    List<UserSessionEntity> findByUserIdAndDeviceTypeIgnoreCaseAndIsActiveTrue(UUID userId, String deviceType);

    Optional<UserSessionEntity> findByIdAndUserIdAndIsActiveTrue(UUID id, UUID userId);
}
