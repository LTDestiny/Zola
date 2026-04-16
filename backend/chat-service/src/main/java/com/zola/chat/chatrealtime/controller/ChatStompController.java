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

    @MessageMapping("/chat.send")
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
}
