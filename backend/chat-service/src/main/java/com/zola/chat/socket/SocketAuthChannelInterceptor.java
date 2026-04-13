package com.zola.chat.socket;

import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SocketAuthChannelInterceptor implements ChannelInterceptor {

    private final SocketJwtService socketJwtService;

    public SocketAuthChannelInterceptor(SocketJwtService socketJwtService) {
        this.socketJwtService = socketJwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authorization = accessor.getFirstNativeHeader("Authorization");
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing bearer token");
            }
            Claims claims = socketJwtService.parse(authorization.substring(7));
            String userId = claims.get("userId", String.class);
            if (userId == null || userId.isBlank()) {
                throw new IllegalArgumentException("Invalid token payload");
            }
            accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
        }
        return message;
    }
}
