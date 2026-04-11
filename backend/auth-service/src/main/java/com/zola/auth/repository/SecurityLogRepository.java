package com.zola.auth.repository;

import com.zola.auth.entity.SecurityLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SecurityLogRepository extends JpaRepository<SecurityLogEntity, UUID> {
}
