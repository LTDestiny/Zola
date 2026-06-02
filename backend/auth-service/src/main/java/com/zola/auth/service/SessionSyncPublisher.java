package com.zola.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.UUID;

@Component
public class SessionSyncPublisher {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionSyncPublisher.class);

    private final RestClient restClient;
    private final String chatServiceUrl;
    private final String gatewaySecret;

    public SessionSyncPublisher(
        @Value("${services.chat-url:http://chat-service:8083}") String chatServiceUrl,
        @Value("${app.internal.gateway-secret:internal-dev-secret}") String gatewaySecret
    ) {
        this.restClient = RestClient.builder().build();
        this.chatServiceUrl = chatServiceUrl;
        this.gatewaySecret = gatewaySecret;
    }

    public void publish(UUID userId, String eventType, String payload) {
        try {
            restClient.post()
                .uri(chatServiceUrl + "/api/v1/sync/users/{userId}/emit", Map.of("userId", userId.toString()))
                .header("X-Internal-Gateway-Secret", gatewaySecret)
                .body(Map.of(
                    "userId", userId.toString(),
                    "sourceClient", "auth-service",
                    "eventType", eventType,
                    "payload", payload
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (Exception ex) {
            LOGGER.debug("Unable to publish session sync event: {}", ex.getMessage());
        }
    }
}
