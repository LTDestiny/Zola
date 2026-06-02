package com.zola.user.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Publishes friendship events to WebSocket clients via the chat-service sync relay endpoint.
 */
@Service
public class FriendEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(FriendEventPublisher.class);

    private final RestTemplate restTemplate;
    private final String chatServiceBaseUrl;

    private final String gatewaySecret;

    public FriendEventPublisher(
        RestTemplate restTemplate,
        @Value("${app.chat-service.base-url}") String chatServiceBaseUrl,
        @Value("${app.internal.gateway-secret:internal-dev-secret}") String gatewaySecret
    ) {
        this.restTemplate = restTemplate;
        this.chatServiceBaseUrl = chatServiceBaseUrl;
        this.gatewaySecret = gatewaySecret;
    }

    public void publishFriendRequestReceived(UUID addresseeId, UUID friendshipId, UUID requesterId) {
        String payload = "{\"event\":\"FRIENDSHIP_REQUEST_RECEIVED\",\"friendshipId\":\"" + friendshipId + "\",\"requesterId\":\"" + requesterId + "\"}";
        emit(addresseeId, "FRIENDSHIP_REQUEST_RECEIVED", payload);
    }

    public void publishFriendRequestAccepted(UUID requesterId, UUID addresseeId, UUID friendshipId) {
        String payload = "{\"event\":\"FRIENDSHIP_REQUEST_ACCEPTED\",\"friendshipId\":\"" + friendshipId + "\",\"requesterId\":\"" + requesterId + "\",\"addresseeId\":\"" + addresseeId + "\"}";
        emit(requesterId, "FRIENDSHIP_REQUEST_ACCEPTED", payload);
        emit(addresseeId, "FRIENDSHIP_REQUEST_ACCEPTED", payload);
    }

    public void publishFriendRequestDeclined(UUID requesterId, UUID friendshipId) {
        String payload = "{\"event\":\"FRIENDSHIP_REQUEST_DECLINED\",\"friendshipId\":\"" + friendshipId + "\"}";
        emit(requesterId, "FRIENDSHIP_REQUEST_DECLINED", payload);
    }

    public void publishFriendRequestCancelled(UUID requesterId, UUID addresseeId, UUID friendshipId) {
        String payload = "{\"event\":\"FRIENDSHIP_REQUEST_CANCELLED\",\"friendshipId\":\"" + friendshipId + "\",\"requesterId\":\"" + requesterId + "\",\"addresseeId\":\"" + addresseeId + "\"}";
        emitBetween(requesterId, addresseeId, "FRIENDSHIP_REQUEST_CANCELLED", payload);
    }

    public void publishFriendshipBlocked(UUID blockerId, UUID blockedUserId) {
        String payload = "{\"event\":\"FRIENDSHIP_BLOCKED\",\"blockerId\":\"" + blockerId + "\",\"blockedUserId\":\"" + blockedUserId + "\"}";
        emitBetween(blockerId, blockedUserId, "FRIENDSHIP_BLOCKED", payload);
    }

    public void publishFriendshipUnblocked(UUID blockerId, UUID blockedUserId) {
        String payload = "{\"event\":\"FRIENDSHIP_UNBLOCKED\",\"blockerId\":\"" + blockerId + "\",\"blockedUserId\":\"" + blockedUserId + "\"}";
        emitBetween(blockerId, blockedUserId, "FRIENDSHIP_UNBLOCKED", payload);
    }

    public void publishFriendshipRemoved(UUID requesterId, UUID addresseeId, UUID friendshipId) {
        String payload = "{\"event\":\"FRIENDSHIP_REMOVED\",\"friendshipId\":\"" + friendshipId + "\",\"requesterId\":\"" + requesterId + "\",\"addresseeId\":\"" + addresseeId + "\"}";
        emitBetween(requesterId, addresseeId, "FRIENDSHIP_REMOVED", payload);
    }

    private void emitBetween(UUID userA, UUID userB, String eventType, String payload) {
        emit(userA, eventType, payload);
        if (!userA.equals(userB)) {
            emit(userB, eventType, payload);
        }
    }

    private void emit(UUID userId, String eventType, String payload) {
        try {
            String url = chatServiceBaseUrl + "/api/v1/sync/users/" + userId + "/emit";
            Map<String, Object> body = Map.of(
                "userId", userId.toString(),
                "sourceClient", "user-service",
                "eventType", eventType,
                "payload", payload,
                "timestamp", Instant.now().toString()
            );
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Internal-Gateway-Secret", gatewaySecret);
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            org.springframework.http.HttpEntity<Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(body, headers);
            restTemplate.postForObject(url, entity, Map.class);
            log.info("[FriendEvent] Successfully emitted {} to user {}", eventType, userId);
        } catch (Exception ex) {
            log.warn("[FriendEvent] Failed to emit {} to user {}: {}", eventType, userId, ex.getMessage());
        }
    }
}
