package com.zola.chat.socket;

import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@Component
public class SocketAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger LOGGER = LoggerFactory.getLogger(SocketAuthChannelInterceptor.class);
    private static final String SESSION_USER_ID_KEY = "ws_user_id";

    private final SocketJwtService socketJwtService;

    public SocketAuthChannelInterceptor(SocketJwtService socketJwtService) {
        this.socketJwtService = socketJwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();

        if (command == null) {
            return message;
        }
        
        if (StompCommand.CONNECT.equals(command)) {
            String authorization = accessor.getFirstNativeHeader("Authorization");
            if (authorization == null || authorization.isBlank()) {
                authorization = accessor.getFirstNativeHeader("authorization");
            }

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
                UsernamePasswordAuthenticationToken authenticationToken =
                    new UsernamePasswordAuthenticationToken(userId, null, List.of());
                accessor.setUser(authenticationToken);
                Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                if (sessionAttributes != null) {
                    sessionAttributes.put(SESSION_USER_ID_KEY, userId);
                }
                LOGGER.info("[ws-auth] CONNECT authenticated successfully, userId={}", userId);
            } catch (Exception ex) {
                LOGGER.warn("[ws-auth] Reject websocket CONNECT due to token parse failure: {}", ex.getMessage());
                return null;
            }

            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }

        if (
            StompCommand.SEND.equals(command) ||
            StompCommand.SUBSCRIBE.equals(command) ||
            StompCommand.UNSUBSCRIBE.equals(command) ||
            StompCommand.DISCONNECT.equals(command)
        ) {
            String restoredUserId = null;
            if (accessor.getUser() == null) {
                Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                Object sessionUserId = sessionAttributes == null
                    ? null
                    : sessionAttributes.get(SESSION_USER_ID_KEY);
                if (sessionUserId instanceof String userId && !userId.isBlank()) {
                    accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
                    restoredUserId = userId;
                }
            }

            String destination = accessor.getDestination();
            if (isCallDestination(destination)) {
                Principal principal = accessor.getUser();
                String principalName = principal == null ? "unknown" : principal.getName();
                LOGGER.info(
                    "[call-frame] command={} destination={} sessionId={} user={} restoredUser={}",
                    command,
                    destination,
                    accessor.getSessionId(),
                    principalName,
                    restoredUserId != null
                );
            }

            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }

        return message;
    }

    private boolean isCallDestination(String destination) {
        if (destination == null || destination.isBlank()) {
            return false;
        }
        return destination.contains("/call") || destination.contains("/signal/call");
    }
}
