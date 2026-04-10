package com.zola.ai.repository;

import com.zola.ai.entity.AiUsageLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiUsageLogRepository extends JpaRepository<AiUsageLogEntity, UUID> {
}