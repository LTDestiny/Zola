package com.zola.admin.entity;

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
@Table(name = "reports")
public class ReportEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID reporterId;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String status;
}