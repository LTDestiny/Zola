package com.zola.auth.service;

import com.zola.auth.entity.SecurityLogEntity;
import com.zola.auth.repository.SecurityLogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class SecurityLogService {

    private final SecurityLogRepository securityLogRepository;
    private final ObjectMapper objectMapper;

    public SecurityLogService(SecurityLogRepository securityLogRepository, ObjectMapper objectMapper) {
        this.securityLogRepository = securityLogRepository;
        this.objectMapper = objectMapper;
    }

    public void write(UUID userId, String eventType, String ipAddress, String deviceInfo, String metadataJson) {
        securityLogRepository.save(SecurityLogEntity.builder()
            .id(UUID.randomUUID())
            .userId(userId)
            .eventType(eventType)
            .ipAddress(ipAddress)
            .deviceInfo(deviceInfo)
            .metadata(parseMetadata(metadataJson))
            .createdAt(Instant.now())
            .build());
    }

    private Map<String, Object> parseMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(metadataJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            return Map.of("raw", metadataJson);
        }
    }
}
