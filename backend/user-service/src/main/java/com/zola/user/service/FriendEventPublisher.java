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

    public FriendEventPublisher(
        RestTemplate restTemplate,
        @Value("${app.chat-service.base-url}") String chatServiceBaseUrl
    ) {
        this.restTemplate = restTemplate;
        this.chatServiceBaseUrl = chatServiceBaseUrl;
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
        emit(requesterId, "FRIENDSHIP_REQUEST_CANCELLED", payload);
        emit(addresseeId, "FRIENDSHIP_REQUEST_CANCELLED", payload);
    }

    public void publishFriendshipRemoved(UUID userA, UUID userB, UUID friendshipId) {
        String payload = "{\"event\":\"FRIENDSHIP_REMOVED\",\"friendshipId\":\"" + friendshipId + "\",\"userA\":\"" + userA + "\",\"userB\":\"" + userB + "\"}";
        emit(userA, "FRIENDSHIP_REMOVED", payload);
        emit(userB, "FRIENDSHIP_REMOVED", payload);
    }

    public void publishFriendshipBlocked(UUID blockerId, UUID blockedUserId) {
        String payload = "{\"event\":\"FRIENDSHIP_BLOCKED\",\"blockerId\":\"" + blockerId + "\",\"blockedUserId\":\"" + blockedUserId + "\"}";
        emit(blockerId, "FRIENDSHIP_BLOCKED", payload);
        emit(blockedUserId, "FRIENDSHIP_BLOCKED", payload);
    }

    public void publishFriendshipUnblocked(UUID blockerId, UUID blockedUserId) {
        String payload = "{\"event\":\"FRIENDSHIP_UNBLOCKED\",\"blockerId\":\"" + blockerId + "\",\"blockedUserId\":\"" + blockedUserId + "\"}";
        emit(blockerId, "FRIENDSHIP_UNBLOCKED", payload);
        emit(blockedUserId, "FRIENDSHIP_UNBLOCKED", payload);
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
            restTemplate.postForObject(url, body, Map.class);
        } catch (Exception ex) {
            log.warn("[FriendEvent] Failed to emit {} to user {}: {}", eventType, userId, ex.getMessage());
        }
    }
}
