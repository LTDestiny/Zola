package com.zola.chat.presence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Publishes presence events to WebSocket subscribers.
 * 
 * Channels:
 * - /topic/presence                    - Global presence updates (broadcast)
 * - /topic/presence/{userId}           - Specific user presence updates
 * - /user/{userId}/queue/presence      - Private presence updates for user
 */
@Component
public class PresenceEventPublisher {

    private static final Logger LOGGER = LoggerFactory.getLogger(PresenceEventPublisher.class);

    // Topic destinations
    private static final String TOPIC_PRESENCE_GLOBAL = "/topic/presence";
    private static final String TOPIC_PRESENCE_USER = "/topic/presence/%s";
    private static final String QUEUE_PRESENCE_USER = "/user/%s/queue/presence";

    private final SimpMessagingTemplate messagingTemplate;

    // Track which users are subscribed to which user's presence
    // Key: userId being watched, Value: Set of watcher userIds
    private final Map<String, Set<String>> presenceWatchers = new ConcurrentHashMap<>();

    public PresenceEventPublisher(@Lazy SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Publish presence change to all subscribers.
     */
    public void publishPresenceChange(PresenceManager.PresenceState state) {
        if (state == null || state.userId() == null) {
            return;
        }

        Map<String, Object> payload = buildPayload(state);

        // 1. Broadcast to global presence topic
        try {
            messagingTemplate.convertAndSend(TOPIC_PRESENCE_GLOBAL, payload);
            LOGGER.debug("[Presence] Published to {} for user {}", TOPIC_PRESENCE_GLOBAL, state.userId());
        } catch (Exception e) {
            LOGGER.warn("[Presence] Failed to publish to global topic: {}", e.getMessage());
        }

        // 2. Publish to user-specific topic (for those watching this specific user)
        String userTopic = String.format(TOPIC_PRESENCE_USER, state.userId());
        try {
            messagingTemplate.convertAndSend(userTopic, payload);
            LOGGER.debug("[Presence] Published to {}", userTopic);
        } catch (Exception e) {
            LOGGER.warn("[Presence] Failed to publish to user topic: {}", e.getMessage());
        }

        // 3. Notify watchers through their private queues
        Set<String> watchers = presenceWatchers.get(state.userId());
        if (watchers != null && !watchers.isEmpty()) {
            for (String watcherId : watchers) {
                try {
                    String watcherQueue = String.format(QUEUE_PRESENCE_USER, watcherId);
                    messagingTemplate.convertAndSend(watcherQueue, payload);
                } catch (Exception e) {
                    LOGGER.warn("[Presence] Failed to notify watcher {}: {}", watcherId, e.getMessage());
                }
            }
        }
    }

    /**
     * Publish last seen update (for activity tracking).
     */
    public void publishLastSeenUpdate(String userId, Instant lastSeenAt) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", "USER_LAST_SEEN_UPDATE");
        payload.put("userId", userId);
        payload.put("lastSeenAt", lastSeenAt != null ? lastSeenAt.toString() : null);

        // Publish to user-specific topic
        String userTopic = String.format(TOPIC_PRESENCE_USER, userId);
        try {
            messagingTemplate.convertAndSend(userTopic, payload);
        } catch (Exception e) {
            LOGGER.warn("[Presence] Failed to publish last seen update: {}", e.getMessage());
        }
    }

    /**
     * Register a user to watch another user's presence.
     */
    public void addWatcher(String targetUserId, String watcherUserId) {
        if (targetUserId == null || watcherUserId == null) {
            return;
        }
        presenceWatchers
            .computeIfAbsent(targetUserId, k -> ConcurrentHashMap.newKeySet())
            .add(watcherUserId);
        LOGGER.debug("[Presence] User {} now watching {}", watcherUserId, targetUserId);
    }

    /**
     * Remove a watcher.
     */
    public void removeWatcher(String targetUserId, String watcherUserId) {
        if (targetUserId == null || watcherUserId == null) {
            return;
        }
        Set<String> watchers = presenceWatchers.get(targetUserId);
        if (watchers != null) {
            watchers.remove(watcherUserId);
            if (watchers.isEmpty()) {
                presenceWatchers.remove(targetUserId);
            }
        }
        LOGGER.debug("[Presence] User {} stopped watching {}", watcherUserId, targetUserId);
    }

    /**
     * Clear all watchers for a user (on disconnect).
     */
    public void clearWatcher(String watcherUserId) {
        if (watcherUserId == null) {
            return;
        }
        presenceWatchers.values().forEach(watchers -> watchers.remove(watcherUserId));
        LOGGER.debug("[Presence] Cleared all watches for user {}", watcherUserId);
    }

    private Map<String, Object> buildPayload(PresenceManager.PresenceState state) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", state.online() ? "USER_ONLINE" : "USER_OFFLINE");
        payload.put("userId", state.userId());
        payload.put("online", state.online());
        payload.put("sessionCount", state.sessionCount());
        payload.put("lastSeenAt", state.lastSeenAt() != null ? state.lastSeenAt().toString() : null);
        return payload;
    }
}
