package com.zola.file.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "file_audit_logs")
public class FileAuditLogEntity {

    @Id
    private UUID id;

    private UUID uploaderId;

    @Column(nullable = false)
    private String fileKey;

    @Column(nullable = false)
    private String action;
}