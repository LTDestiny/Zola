package com.zola.auth.repository;

import com.zola.auth.entity.OtpLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OtpLogRepository extends JpaRepository<OtpLogEntity, UUID> {
}
