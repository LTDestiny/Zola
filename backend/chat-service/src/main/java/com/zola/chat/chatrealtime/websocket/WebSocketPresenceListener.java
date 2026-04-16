package com.zola.chat.chatrealtime.websocket;

import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;

@Component
public class WebSocketPresenceListener {

    private final RedisOnlineUserChecker onlineUserChecker;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketPresenceListener(
        RedisOnlineUserChecker onlineUserChecker,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.onlineUserChecker = onlineUserChecker;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        String userId = resolveUserId(event.getUser(), event.getMessage());
        if (userId != null) {
            Instant changedAt = onlineUserChecker.markOnline(userId);
            publishPresence(userId, true, changedAt);
        }
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        String userId = resolveUserId(event.getUser(), event.getMessage());
        if (userId != null) {
            Instant changedAt = onlineUserChecker.markOffline(userId);
            publishPresence(userId, false, changedAt);
        }
    }

    private String resolveUserId(Principal eventUser, Message<?> message) {
        if (eventUser != null && eventUser.getName() != null && !eventUser.getName().isBlank()) {
            return eventUser.getName();
        }

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        Principal headerUser = accessor.getUser();
        if (headerUser != null && headerUser.getName() != null && !headerUser.getName().isBlank()) {
            return headerUser.getName();
        }

        return null;
    }

    private void publishPresence(String userId, boolean online, Instant changedAt) {
        messagingTemplate.convertAndSend("/topic/presence", Map.of(
            "userId", userId,
            "online", online,
            "lastChangedAt", changedAt.toString()
        ));
    }
}
