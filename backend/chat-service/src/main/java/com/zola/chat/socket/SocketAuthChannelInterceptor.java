package com.zola.chat.socket;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;

/**
 * SECURITY: Validates JWT on every STOMP CONNECT frame.
 *
 * Without this, any WebSocket client can subscribe and receive messages
 * without being authenticated. The extracted userId is set as the STOMP
 * Principal so that /user/queue/... routing works correctly.
 */
@Component
public class SocketAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(SocketAuthChannelInterceptor.class);

    private final SocketJwtService socketJwtService;

    public SocketAuthChannelInterceptor(SocketJwtService socketJwtService) {
        this.socketJwtService = socketJwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Only validate on CONNECT; all other frames are already authenticated via the Principal
            return message;
        }

        // Extract token from Authorization or authorization header (mobile sends both cases)
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null) {
            authHeader = accessor.getFirstNativeHeader("authorization");
        }

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new MessageDeliveryException("WebSocket CONNECT rejected: missing Authorization header");
        }

        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            throw new MessageDeliveryException("WebSocket CONNECT rejected: empty token");
        }

        final String userId;
        try {
            Claims claims = socketJwtService.parse(token);
            userId = claims.get("userId", String.class);
        } catch (Exception ex) {
            throw new MessageDeliveryException("WebSocket CONNECT rejected: invalid token – " + ex.getMessage());
        }

        if (userId == null || userId.isBlank()) {
            throw new MessageDeliveryException("WebSocket CONNECT rejected: token has no userId claim");
        }

        log.debug("WebSocket CONNECT authenticated for userId={}", userId);

        // Set the authenticated principal so Spring's user-destination routing works
        accessor.setUser(new Principal() {
            @Override
            public String getName() {
                return userId;
            }
        });

        return message;
    }
}