package com.zola.chat.chatrealtime.websocket;

import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
public class WebSocketPresenceListener {

    private final RedisOnlineUserChecker onlineUserChecker;

    public WebSocketPresenceListener(RedisOnlineUserChecker onlineUserChecker) {
        this.onlineUserChecker = onlineUserChecker;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        if (user != null && user.getName() != null) {
            onlineUserChecker.markOnline(user.getName());
        }
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        if (user != null && user.getName() != null) {
            onlineUserChecker.markOffline(user.getName());
        }
    }
}
