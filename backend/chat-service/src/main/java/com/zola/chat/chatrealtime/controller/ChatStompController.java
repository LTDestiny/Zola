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
import com.zola.chat.chatrealtime.service.ChatRealtimeService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Controller
public class ChatStompController {

    private final ChatRealtimeService chatRealtimeService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatStompController(ChatRealtimeService chatRealtimeService, SimpMessagingTemplate messagingTemplate) {
        this.chatRealtimeService = chatRealtimeService;
        this.messagingTemplate = messagingTemplate;
    }

    // Support both legacy dot notation and slash notation for client compatibility.
    @MessageMapping({ "/chat.send"})
    public void send(@Payload ChatSendRequest request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }
        ChatEventResponse event = chatRealtimeService.sendMessage(principal.getName(), request);
        broadcast(event.conversationId(), event);
        String receiverId = event.message() == null ? null : event.message().receiverId();
        emitUnreadSyncEvents(UUID.fromString(event.conversationId()), event.message(), principal.getName(), receiverId);
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
        String peerId = event.message() == null ? null : event.message().senderId();
        emitUnreadSyncEvents(request.conversationId(), event.message(), principal.getName(), peerId);
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
        // PRODUCTION FIX: Use ONLY slash format /topic/chat/{id}
        // Dot format removed to prevent duplicate events when clients subscribe to both
        // All clients must subscribe to /topic/chat/{conversationId}
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
    }

    /**
     * PRODUCTION FIX: Emit ONLY CONVERSATION_UPDATED to /user/queue/chat
     * 
     * Previous issues:
     * 1. Emitting NEW_MESSAGE here caused duplicates (MESSAGE_SENT already sent via topic)
     * 2. Emitting UNREAD_COUNT_UPDATED + TOTAL_UNREAD_UPDATED caused frontend to increment multiple times
     * 
     * Solution:
     * - Single CONVERSATION_UPDATED event contains all metadata (unreadCount, totalUnreadCount, lastMessage)
     * - MESSAGE_SENT goes to /topic/chat/{id} for message content
     * - CONVERSATION_UPDATED goes to /user/queue/chat for sidebar/unread sync
     * 
     * Channel separation:
     * - /topic/chat/{id}: MESSAGE_SENT, MESSAGE_UPDATED, MESSAGE_RECALLED, READ_RECEIPT, TYPING
     * - /user/queue/chat: CONVERSATION_UPDATED only (metadata sync)
     */
    private void emitUnreadSyncEvents(UUID conversationId, com.zola.chat.chatrealtime.dto.MessagePayload messagePayload, String... userIds) {
        Set<String> uniqueUserIds = new LinkedHashSet<>();
        for (String userId : userIds) {
            if (userId == null || userId.isBlank()) {
                continue;
            }
            uniqueUserIds.add(userId);
        }

        for (String userId : uniqueUserIds) {
            // ✅ FIX Bug #2: Don't send message payload in CONVERSATION_UPDATED
            // Message already sent via /topic/chat/{id} as MESSAGE_SENT
            // This event is for metadata only (unreadCount, totalUnreadCount, lastMessage)
            ChatEventResponse event = chatRealtimeService.buildConversationUpdatedEvent(
                userId,
                conversationId,
                "CONVERSATION_UPDATED",
                null  // ✅ FIXED: Removed duplicate message payload
            );
            messagingTemplate.convertAndSendToUser(userId, "/queue/chat", event);
        }
    }
}
