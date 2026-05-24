package com.zola.chat.integration;

import com.zola.chat.exception.RelationshipValidationException;
import com.zola.common.response.ApiResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
public class UserRelationshipClient {

    private static final ParameterizedTypeReference<ApiResponse<Map<String, Object>>> BLOCK_STATUS_RESPONSE =
        new ParameterizedTypeReference<>() {
        };

    private final RestClient restClient;
    private final String userServiceUrl;

    public UserRelationshipClient(
        @Value("${app.services.user-url}") String userServiceUrl,
        @Value("${app.internal.gateway-secret:internal-dev-secret}") String gatewaySecret
    ) {
        this.restClient = RestClient.builder()
            .defaultHeader("X-Internal-Gateway-Secret", gatewaySecret)
            .build();
        this.userServiceUrl = userServiceUrl;
    }

    public boolean isMessagingBlocked(String userA, String userB) {
        BlockStatus status = fetchBlockStatus(userA, userB);
        return status.blocked();
    }

    /**
     * Check if two users are accepted friends.
     * Calls user-service's /internal/accepted endpoint.
     */
    public boolean areFriends(String userA, String userB) {
        try {
            ApiResponse<Map<String, Object>> response = restClient.get()
                .uri(
                    userServiceUrl + "/api/v1/users/friendships/internal/accepted?userA={userA}&userB={userB}",
                    Map.of("userA", userA, "userB", userB)
                )
                .retrieve()
                .body(BLOCK_STATUS_RESPONSE);

            Map<String, Object> data = response == null || response.data() == null
                ? Map.of()
                : response.data();

            return toBoolean(data.get("accepted"));
        } catch (RestClientResponseException ex) {
            // If user-service is down, fail open (allow messaging) to avoid blocking users
            return true;
        } catch (Exception ex) {
            // Fail open on unexpected errors
            return true;
        }
    }

    public BlockStatus fetchBlockStatus(String userA, String userB) {
        try {
            ApiResponse<Map<String, Object>> response = restClient.get()
                .uri(
                    userServiceUrl + "/api/v1/users/friendships/internal/blocked?userA={userA}&userB={userB}",
                    Map.of("userA", userA, "userB", userB)
                )
                .retrieve()
                .body(BLOCK_STATUS_RESPONSE);

            Map<String, Object> data = response == null || response.data() == null
                ? Map.of()
                : response.data();

            return new BlockStatus(
                toBoolean(data.get("blocked")),
                toBoolean(data.get("blockedByUserA")),
                toBoolean(data.get("blockedByUserB"))
            );
        } catch (RestClientResponseException ex) {
            throw new RelationshipValidationException("Unable to validate messaging permissions", ex);
        } catch (Exception ex) {
            throw new RelationshipValidationException("Unable to validate messaging permissions", ex);
        }
    }

    private boolean toBoolean(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value == null) {
            return false;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    public record BlockStatus(
        boolean blocked,
        boolean blockedByUserA,
        boolean blockedByUserB
    ) {
    }
}
