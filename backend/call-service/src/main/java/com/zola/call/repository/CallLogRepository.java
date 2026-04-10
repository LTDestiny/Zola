package com.zola.call.repository;

import com.zola.call.entity.CallLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CallLogRepository extends JpaRepository<CallLogEntity, UUID> {
}