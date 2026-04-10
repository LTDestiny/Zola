package com.zola.call.entity;

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
@Table(name = "call_logs")
public class CallLogEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID callerId;

    private UUID calleeId;

    @Column(nullable = false)
    private String status;
}