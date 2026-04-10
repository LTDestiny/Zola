package com.zola.file.repository;

import com.zola.file.entity.FileAuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FileAuditLogRepository extends JpaRepository<FileAuditLogEntity, UUID> {
}