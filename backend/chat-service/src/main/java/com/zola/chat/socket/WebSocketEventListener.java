package com.zola.chat.socket;

import com.zola.chat.presence.PresenceManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * WebSocket lifecycle listener for presence management.
 * 
 * Handles:
 * - SessionConnectedEvent → mark user online
 * - SessionDisconnectEvent → mark user offline (with grace period)
 * 
 * Multi-device support:
 * - Each device/tab gets a unique sessionId
 * - User stays online as long as at least one session is active
 * - 15-second grace period before going offline (handles reconnects)
 */
@Component
public class WebSocketEventListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final PresenceManager presenceManager;

    public WebSocketEventListener(PresenceManager presenceManager) {
        this.presenceManager = presenceManager;
    }

    /**
     * Handle WebSocket session connected.
     * Mark user as online and increment device count.
     */
    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String userId = resolveUserId(accessor);

        if (userId == null) {
            LOGGER.debug("[ws-presence] SessionConnected without user context, sessionId={}", sessionId);
            return;
        }

        LOGGER.info("[ws-presence] Session CONNECTED: userId={}, sessionId={}", userId, sessionId);

        try {
            PresenceManager.PresenceState state = presenceManager.connect(userId, sessionId);
            if (state != null) {
                LOGGER.info("[ws-presence] User {} marked online, sessions={}", userId, state.sessionCount());
            }
        } catch (Exception e) {
            LOGGER.error("[ws-presence] Failed to mark user {} online: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * Handle WebSocket session disconnected.
     * Decrement device count and schedule offline if no more sessions.
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String userId = resolveUserId(accessor);

        if (userId == null) {
            LOGGER.debug("[ws-presence] SessionDisconnect without user context, sessionId={}", sessionId);
            return;
        }

        LOGGER.info("[ws-presence] Session DISCONNECTED: userId={}, sessionId={}", userId, sessionId);

        try {
            presenceManager.disconnect(userId, sessionId);
            LOGGER.info("[ws-presence] Disconnect processed for user {} (15s grace period)", userId);
        } catch (Exception e) {
            LOGGER.error("[ws-presence] Failed to process disconnect for user {}: {}", userId, e.getMessage(), e);
        }
    }

    private String resolveUserId(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user != null && user.getName() != null && !user.getName().isBlank()) {
            return user.getName();
        }

        Object sessionUserId = accessor.getSessionAttributes() == null
            ? null
            : accessor.getSessionAttributes().get("ws_user_id");
        if (sessionUserId instanceof String userId && !userId.isBlank()) {
            return userId;
        }

        return null;
    }
}
