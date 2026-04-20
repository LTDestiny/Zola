package com.zola.chat.chatrealtime.controller;

import com.zola.chat.chatrealtime.dto.ChatDeleteForMeRequest;
import com.zola.chat.chatrealtime.dto.ChatEditRequest;
import com.zola.chat.chatrealtime.dto.ChatEventResponse;
import com.zola.chat.chatrealtime.dto.ChatForwardRequest;
import com.zola.chat.chatrealtime.dto.ChatReadReceiptRequest;
import com.zola.chat.chatrealtime.dto.ChatReactionRequest;
import com.zola.chat.chatrealtime.dto.ChatRecallRequest;
import com.zola.chat.chatrealtime.dto.ChatSendRequest;
import com.zola.chat.chatrealtime.dto.ChatTypingRequest;
import com.zola.chat.chatrealtime.dto.CallSignalEvent;
import com.zola.chat.chatrealtime.service.ChatRealtimeService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.security.Principal;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Controller
public class ChatStompController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatStompController.class);

    private final ChatRealtimeService chatRealtimeService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatStompController(ChatRealtimeService chatRealtimeService, SimpMessagingTemplate messagingTemplate) {
        this.chatRealtimeService = chatRealtimeService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.send")
    public void send(@Payload ChatSendRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.sendMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
        emitUnreadSyncEvents(UUID.fromString(event.conversationId()), event.message());
    }

    @MessageMapping({"/call.signal", "/signal/call"})
    public void callSignal(
        @Payload CallSignalPayload payload,
        Principal principal,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        if (payload == null) {
            LOGGER.warn("[call-signal] drop reason=empty_payload");
            return;
        }

        String actorId = principal == null ? null : principal.getName();
        if ((actorId == null || actorId.isBlank()) && headerAccessor != null) {
            var sessionAttributes = headerAccessor.getSessionAttributes();
            Object sessionUserId = sessionAttributes == null ? null : sessionAttributes.get("ws_user_id");
            if (sessionUserId instanceof String userId && !userId.isBlank()) {
                actorId = userId;
            }
        }

        if (actorId == null || actorId.isBlank()) {
            LOGGER.warn(
                "[call-signal] drop reason=missing_actor sessionId={}",
                headerAccessor == null ? "n/a" : headerAccessor.getSessionId()
            );
            return;
        }
        final String resolvedActorId = actorId;

        String rawConversationId = payload.conversationId() == null
            ? null
            : payload.conversationId().trim();
        if (rawConversationId == null || rawConversationId.isBlank()) {
            LOGGER.warn("[call-signal] drop reason=missing_conversation actor={}", resolvedActorId);
            return;
        }

        UUID conversationId;
        try {
            conversationId = UUID.fromString(rawConversationId);
        } catch (IllegalArgumentException ex) {
            LOGGER.warn(
                "[call-signal] drop reason=invalid_conversation_id actor={} conversation={}",
                resolvedActorId,
                rawConversationId
            );
            return;
        }

        if (
            payload.callId() == null ||
            payload.callId().isBlank() ||
            payload.signalType() == null ||
            payload.signalType().isBlank()
        ) {
            LOGGER.warn(
                "[call-signal] drop reason=missing_fields actor={} conversation={} signal={} callId={}",
                resolvedActorId,
                conversationId,
                payload.signalType(),
                payload.callId()
            );
            return;
        }

        Set<String> supportedSignals = Set.of(
            "CALL_INVITE",
            "CALL_ACCEPT",
            "CALL_REJECT",
            "CALL_JOINED",
            "CALL_LEAVE",
            "WEBRTC_OFFER",
            "WEBRTC_ANSWER",
            "WEBRTC_ICE",
            "CALL_END"
        );
        String signalType = payload.signalType().trim().toUpperCase();
        if (!supportedSignals.contains(signalType)) {
            LOGGER.warn(
                "[call-signal] drop reason=unsupported_signal actor={} conversation={} signal={}",
                resolvedActorId,
                conversationId,
                signalType
            );
            return;
        }

        LOGGER.info(
            "[call-signal-in] actor={} conversation={} signal={} target={} mode={} sessionId={}",
            resolvedActorId,
            conversationId,
            signalType,
            payload.targetUserId(),
            payload.mode(),
            headerAccessor == null ? "n/a" : headerAccessor.getSessionId()
        );

        Set<String> members = new LinkedHashSet<>(chatRealtimeService.listConversationMembers(conversationId));
        if (!members.contains(resolvedActorId)) {
            LOGGER.warn(
                "[call-signal] drop reason=actor_not_member actor={} conversation={} members={}",
                resolvedActorId,
                conversationId,
                members.size()
            );
            return;
        }

        String normalizedTargetUserId = payload.targetUserId() == null ? null : payload.targetUserId().trim();
        boolean hasDirectTarget = normalizedTargetUserId != null && !normalizedTargetUserId.isBlank();
        boolean isOneToOneConversation = members.size() == 2;

        if (isOneToOneConversation) {
            // For 1-1 chats, always resolve target as the other member for maximum reliability.
            normalizedTargetUserId = members.stream()
                .filter(memberId -> !resolvedActorId.equals(memberId))
                .findFirst()
                .orElse(null);
            hasDirectTarget = normalizedTargetUserId != null && !normalizedTargetUserId.isBlank();
        }

        if (hasDirectTarget) {
            if (resolvedActorId.equals(normalizedTargetUserId) || !members.contains(normalizedTargetUserId)) {
                // Fallback for 1-1 conversations when client resolves peer id incorrectly.
                if (members.size() == 2) {
                    normalizedTargetUserId = members.stream()
                        .filter(memberId -> !resolvedActorId.equals(memberId))
                        .findFirst()
                        .orElse(null);
                    hasDirectTarget = normalizedTargetUserId != null && !normalizedTargetUserId.isBlank();
                }
            }
        }

        CallSignalEvent event = new CallSignalEvent(
            resolvedActorId,
            conversationId.toString(),
            hasDirectTarget ? normalizedTargetUserId : null,
            payload.callId(),
            payload.mode() == null || payload.mode().isBlank() ? "voice" : payload.mode(),
            signalType,
            payload.payload(),
            Instant.now().toString()
        );

        LOGGER.info(
            "[call-signal] actor={} conversation={} signal={} target={} members={}",
            resolvedActorId,
            conversationId,
            signalType,
            hasDirectTarget ? normalizedTargetUserId : "broadcast",
            members.size()
        );

        if (hasDirectTarget && normalizedTargetUserId != null) {
            // Direct signaling between two peers.
            messagingTemplate.convertAndSendToUser(normalizedTargetUserId, "/queue/call", event);
        } else {
            // Group signaling fan-out to all members except sender.
            for (String memberId : members) {
                if (memberId.equals(resolvedActorId)) {
                    continue;
                }
                messagingTemplate.convertAndSendToUser(memberId, "/queue/call", event);
            }
        }

        // Echo back to caller so all active tabs stay in sync.
        messagingTemplate.convertAndSendToUser(resolvedActorId, "/queue/call", event);

        // Fallback channel: deliver call signals to conversation topic so peers still receive
        // events when user-queue routing is impacted by broker/user destination issues.
        messagingTemplate.convertAndSend("/topic/call/" + conversationId, event);
        // Global fallback for clients that are not yet subscribed to per-conversation call topics.
        messagingTemplate.convertAndSend("/topic/call", event);
    }

    @MessageMapping("/create_group")
    public void createGroup(@Payload GroupCreatePayload payload, Principal principal) {
        if (principal == null || principal.getName() == null || payload == null) {
            return;
        }

        var conversation = chatRealtimeService.createGroupConversation(
            principal.getName(),
            payload.name(),
            payload.memberIds(),
            payload.avatar()
        );

        ChatEventResponse event = new ChatEventResponse(
            "group_created",
            principal.getName(),
            conversation.id().toString(),
            false,
            false,
            null,
            null,
            0,
            chatRealtimeService.totalUnreadCount(principal.getName()),
            conversation.lastMessage(),
            conversation.lastMessageAt() == null ? null : conversation.lastMessageAt().toString()
        );

        broadcast(conversation.id().toString(), event);
        for (String memberId : conversation.participants()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/chat", event);
        }
        emitUnreadSyncEvents(
            conversation.id(),
            null,
            conversation.participants().toArray(String[]::new)
        );
    }

    @MessageMapping("/join_group")
    public void joinGroup(@Payload GroupJoinPayload payload, Principal principal) {
        if (principal == null || principal.getName() == null || payload == null || payload.conversationId() == null) {
            return;
        }

        if (!chatRealtimeService.listConversationMembers(payload.conversationId()).contains(principal.getName())) {
            return;
        }

        ChatEventResponse event = new ChatEventResponse(
            "group_created",
            principal.getName(),
            payload.conversationId().toString(),
            false,
            false,
            null,
            null,
            0,
            chatRealtimeService.totalUnreadCount(principal.getName()),
            null,
            null
        );
        messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/chat", event);
        emitUnreadSyncEvents(
            payload.conversationId(),
            null,
            principal.getName()
        );
    }

    @MessageMapping("/send_group_message")
    public void sendGroupMessage(@Payload GroupMessagePayload payload, Principal principal) {
        if (principal == null || principal.getName() == null || payload == null) {
            return;
        }
        if (payload.content() == null || payload.content().isBlank() || payload.conversationId() == null) {
            return;
        }

        ChatEventResponse base = chatRealtimeService.sendMessage(
            principal.getName(),
            new ChatSendRequest(
                payload.conversationId(),
                payload.type() == null ? "TEXT" : payload.type(),
                payload.content(),
                payload.fileUrl(),
                payload.fileName(),
                payload.parentMessageId()
            )
        );

        ChatEventResponse event = new ChatEventResponse(
            "NEW_MESSAGE",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), event);

        // Keep legacy event type for older clients while preserving canonical NEW_MESSAGE.
        ChatEventResponse legacyEvent = new ChatEventResponse(
            "new_group_message",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), legacyEvent);
        emitUnreadSyncEvents(payload.conversationId(), base.message());
    }

    @MessageMapping("/typing_group")
    public void typingGroup(@Payload ChatTypingRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }

        ChatEventResponse base = chatRealtimeService.typing(principal.getName(), request);
        ChatEventResponse event = new ChatEventResponse(
            "user_typing_group",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), event);
    }

    @MessageMapping("/react_message")
    public void reactMessage(@Payload ChatReactionRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse base = chatRealtimeService.reactMessage(principal.getName(), request);
        ChatEventResponse event = new ChatEventResponse(
            "message_reacted",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), event);
    }

    @MessageMapping("/reply_message")
    public void replyMessage(@Payload GroupMessagePayload payload, Principal principal) {
        if (principal == null || principal.getName() == null || payload == null || payload.parentMessageId() == null) {
            return;
        }
        if (payload.content() == null || payload.content().isBlank() || payload.conversationId() == null) {
            return;
        }

        ChatEventResponse base = chatRealtimeService.sendMessage(
            principal.getName(),
            new ChatSendRequest(
                payload.conversationId(),
                payload.type() == null ? "TEXT" : payload.type(),
                payload.content(),
                payload.fileUrl(),
                payload.fileName(),
                payload.parentMessageId()
            )
        );

        ChatEventResponse event = new ChatEventResponse(
            "NEW_MESSAGE",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), event);

        // Keep legacy event type for clients that still branch on reply-specific names.
        ChatEventResponse legacyEvent = new ChatEventResponse(
            "message_replied",
            base.actorId(),
            base.conversationId(),
            base.typing(),
            base.online(),
            base.targetUserId(),
            base.message(),
            base.unreadCount(),
            base.totalUnreadCount(),
            base.lastMessage(),
            base.lastMessageAt()
        );
        broadcast(base.conversationId(), legacyEvent);
        emitUnreadSyncEvents(payload.conversationId(), base.message());
    }

    @MessageMapping("/chat.recall")
    public void recall(@Payload ChatRecallRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.recallMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
    }

    @MessageMapping("/chat.edit")
    public void edit(@Payload ChatEditRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.editMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
    }

    @MessageMapping("/chat.typing")
    public void typing(@Payload ChatTypingRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.typing(principal.getName(), request);
        broadcast(event.conversationId(), event);
    }

    @MessageMapping("/chat.delete-for-me")
    public void deleteForMe(@Payload ChatDeleteForMeRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.deleteForMe(principal.getName(), request);
        // Delete-for-me is user scoped, only notify current user.
        messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/chat", event);
    }

    @MessageMapping("/chat.forward")
    public void forward(@Payload ChatForwardRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.forwardMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
    }

    @MessageMapping("/chat.read")
    public void read(@Payload ChatReadReceiptRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.readReceipt(principal.getName(), request);
        broadcast(event.conversationId(), event);
        emitUnreadSyncEvents(request.conversationId(), event.message());
    }

    @MessageMapping("/chat.react")
    public void react(@Payload ChatReactionRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.reactMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
    }

    private void broadcast(String conversationId, ChatEventResponse event) {
        // CRITICAL FIX: Publish to BOTH topic formats for compatibility
        // Some clients subscribe to /topic/chat.{id} (dot), others to /topic/chat/{id} (slash)
        messagingTemplate.convertAndSend("/topic/chat." + conversationId, event);
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
    }

    private void emitUnreadSyncEvents(UUID conversationId, com.zola.chat.chatrealtime.dto.MessagePayload messagePayload, String... userIds) {
        Set<String> uniqueUserIds = new LinkedHashSet<>();
        for (String userId : userIds) {
            if (userId == null || userId.isBlank()) {
                continue;
            }
            uniqueUserIds.add(userId);
        }

        if (uniqueUserIds.isEmpty()) {
            uniqueUserIds.addAll(chatRealtimeService.listConversationMembers(conversationId));
        }

        for (String userId : uniqueUserIds) {
            ChatEventResponse base = chatRealtimeService.buildConversationUpdatedEvent(
                userId,
                conversationId,
                "CONVERSATION_UPDATED",
                messagePayload
            );

            messagingTemplate.convertAndSendToUser(userId, "/queue/chat", base);

            messagingTemplate.convertAndSendToUser(
                userId,
                "/queue/chat",
                new ChatEventResponse(
                    "UNREAD_COUNT_UPDATED",
                    base.actorId(),
                    base.conversationId(),
                    false,
                    false,
                    null,
                    null,
                    base.unreadCount(),
                    base.totalUnreadCount(),
                    base.lastMessage(),
                    base.lastMessageAt()
                )
            );

            messagingTemplate.convertAndSendToUser(
                userId,
                "/queue/chat",
                new ChatEventResponse(
                    "TOTAL_UNREAD_UPDATED",
                    base.actorId(),
                    base.conversationId(),
                    false,
                    false,
                    null,
                    null,
                    base.unreadCount(),
                    base.totalUnreadCount(),
                    base.lastMessage(),
                    base.lastMessageAt()
                )
            );

            if (messagePayload != null) {
                messagingTemplate.convertAndSendToUser(
                    userId,
                    "/queue/chat",
                    new ChatEventResponse(
                        "NEW_MESSAGE",
                        messagePayload.senderId(),
                        messagePayload.conversationId(),
                        false,
                        false,
                        null,
                        messagePayload,
                        base.unreadCount(),
                        base.totalUnreadCount(),
                        base.lastMessage(),
                        base.lastMessageAt()
                    )
                );
            }
        }
    }

    public record GroupCreatePayload(
        String name,
        List<String> memberIds,
        String avatar
    ) {
    }

    public record GroupJoinPayload(
        UUID conversationId
    ) {
    }

    public record GroupMessagePayload(
        UUID conversationId,
        String type,
        String content,
        String fileUrl,
        String fileName,
        String parentMessageId
    ) {
    }

    public record CallSignalPayload(
        String conversationId,
        String targetUserId,
        String callId,
        String mode,
        String signalType,
        String payload
    ) {
    }
}
