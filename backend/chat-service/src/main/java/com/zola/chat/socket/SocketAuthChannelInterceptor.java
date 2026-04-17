package com.zola.chat.socket;

import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@Component
public class SocketAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger LOGGER = LoggerFactory.getLogger(SocketAuthChannelInterceptor.class);

    private final SocketJwtService socketJwtService;

    public SocketAuthChannelInterceptor(SocketJwtService socketJwtService) {
        this.socketJwtService = socketJwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();
        
        LOGGER.info("[ws-auth] Received STOMP command: {}", command);
        
        if (StompCommand.CONNECT.equals(command)) {
            String authorization = accessor.getFirstNativeHeader("Authorization");
            if (authorization == null || authorization.isBlank()) {
                authorization = accessor.getFirstNativeHeader("authorization");
            }
            
            LOGGER.info("[ws-auth] CONNECT frame received, hasAuth={}", authorization != null);

            if (authorization == null || !authorization.startsWith("Bearer ")) {
                LOGGER.warn("[ws-auth] Reject websocket CONNECT without bearer token");
                return null;
            }

            try {
                Claims claims = socketJwtService.parse(authorization.substring(7));
                String userId = claims.get("userId", String.class);
                if (userId == null || userId.isBlank()) {
                    LOGGER.warn("[ws-auth] Reject websocket CONNECT with invalid token payload (no userId)");
                    return null;
                }
                accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
                LOGGER.info("[ws-auth] CONNECT authenticated successfully, userId={}", userId);
            } catch (Exception ex) {
                LOGGER.warn("[ws-auth] Reject websocket CONNECT due to token parse failure: {}", ex.getMessage());
                return null;
            }
        }
        return message;
    }
}
