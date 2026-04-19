package com.zola.chat.chatrealtime.controller;

import com.zola.chat.chatrealtime.dto.ConversationResponse;
import com.zola.chat.chatrealtime.dto.CreateDirectConversationRequest;
import com.zola.chat.chatrealtime.dto.CreateGroupConversationRequest;
import com.zola.chat.chatrealtime.dto.ConversationListItemResponse;
import com.zola.chat.chatrealtime.dto.ChatEventResponse;
import com.zola.chat.chatrealtime.dto.ChatEditRequest;
import com.zola.chat.chatrealtime.dto.GroupAdminRequest;
import com.zola.chat.chatrealtime.dto.GroupMemberRequest;
import com.zola.chat.chatrealtime.dto.MessagePayload;
import com.zola.chat.chatrealtime.dto.MessageItemResponse;
import com.zola.chat.chatrealtime.dto.MessagesPageResponse;
import com.zola.chat.chatrealtime.dto.UserPresenceResponse;
import com.zola.chat.chatrealtime.service.ChatRealtimeService;
import com.zola.common.response.ApiResponse;
import com.zola.chat.chatrealtime.dto.ChatDeleteForMeRequest;
import com.zola.chat.chatrealtime.dto.ChatForwardRequest;
import com.zola.chat.chatrealtime.dto.ChatReadReceiptRequest;
import com.zola.chat.chatrealtime.dto.ChatReactionRequest;
import com.zola.chat.chatrealtime.dto.ChatRecallRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatConversationController {

    private final ChatRealtimeService chatRealtimeService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatConversationController(ChatRealtimeService chatRealtimeService, SimpMessagingTemplate messagingTemplate) {
        this.chatRealtimeService = chatRealtimeService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/conversations/direct")
    public ApiResponse<ConversationResponse> createDirectConversation(
        @RequestHeader("X-User-Id") String requesterId,
        @Valid @RequestBody CreateDirectConversationRequest request
    ) {
        ConversationResponse response = chatRealtimeService.createDirectConversation(requesterId, request.targetUserId());
        return ApiResponse.ok("Conversation created", response);
    }

    @PostMapping("/conversations/group")
    public ApiResponse<ConversationResponse> createGroupConversation(
        @RequestHeader("X-User-Id") String requesterId,
        @Valid @RequestBody CreateGroupConversationRequest request
    ) {
        ConversationResponse response = chatRealtimeService.createGroupConversation(
            requesterId,
            request.name(),
            request.memberIds(),
            request.avatar()
        );

        ChatEventResponse event = new ChatEventResponse(
            "group_created",
            requesterId,
            response.id().toString(),
            false,
            false,
            null,
            null,
            0,
            chatRealtimeService.totalUnreadCount(requesterId),
            response.lastMessage(),
            response.lastMessageAt() == null ? null : response.lastMessageAt().toString()
        );
        messagingTemplate.convertAndSend("/topic/chat/" + response.id(), event);
        for (String memberId : response.participants()) {
            messagingTemplate.convertAndSendToUser(memberId, "/queue/chat", event);
        }
        return ApiResponse.ok("Group created", response);
    }

    @PostMapping("/conversations/{conversationId}/add-member")
    public ApiResponse<ConversationListItemResponse> addMember(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @Valid @RequestBody GroupMemberRequest request
    ) {
        ConversationListItemResponse response = chatRealtimeService.addGroupMember(userId, conversationId, request.userId());
        return ApiResponse.ok("Member added", response);
    }

    @PostMapping("/conversations/{conversationId}/remove-member")
    public ApiResponse<ConversationListItemResponse> removeMember(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @Valid @RequestBody GroupMemberRequest request
    ) {
        ConversationListItemResponse response = chatRealtimeService.removeGroupMember(userId, conversationId, request.userId());
        return ApiResponse.ok("Member removed", response);
    }

    @PostMapping("/conversations/{conversationId}/leave")
    public ApiResponse<ConversationListItemResponse> leaveGroup(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId
    ) {
        ConversationListItemResponse response = chatRealtimeService.leaveGroupConversation(userId, conversationId);
        return ApiResponse.ok("Left group", response);
    }

    @PostMapping("/conversations/{conversationId}/set-admin")
    public ApiResponse<ConversationListItemResponse> setAdmin(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @Valid @RequestBody GroupAdminRequest request
    ) {
        ConversationListItemResponse response = chatRealtimeService.setGroupAdmin(userId, conversationId, request.userId(), request.admin());
        return ApiResponse.ok("Group admin updated", response);
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ApiResponse<Map<String, Object>> deleteGroup(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId
    ) {
        chatRealtimeService.deleteGroupConversation(userId, conversationId);
        return ApiResponse.ok("Group deleted", Map.of("conversationId", conversationId.toString()));
    }

    @GetMapping("/conversations")
    public ApiResponse<List<ConversationListItemResponse>> listConversations(
        @RequestHeader("X-User-Id") String userId
    ) {
        return ApiResponse.ok("Conversations fetched", chatRealtimeService.listConversations(userId));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ApiResponse<MessagesPageResponse> getMessages(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @RequestParam(name = "cursor", required = false) String cursor,
        @RequestParam(name = "limit", defaultValue = "50") int limit
    ) {
        return ApiResponse.ok("Messages fetched", chatRealtimeService.getMessagesHttp(userId, conversationId, cursor, limit));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ApiResponse<MessageItemResponse> sendMessage(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        MessageItemResponse response = chatRealtimeService.sendMessageHttp(
            userId,
            conversationId,
            request.type(),
            request.content(),
            request.fileUrl(),
            request.fileName(),
            request.parentMessageId()
        );

        // Keep realtime behavior even for HTTP fallback path.
        ChatEventResponse event = new ChatEventResponse(
            "MESSAGE_SENT",
            userId,
            conversationId.toString(),
            false,
            false,
            null,
            new MessagePayload(
                response.id(),
                response.conversationId(),
                response.senderId(),
                response.receiverId(),
                response.type(),
                response.content(),
                response.parentMessageId(),
                response.fileUrl(),
                response.fileName(),
                response.reactions(),
                response.reactionEntries(),
                response.deletedForUsers(),
                response.deliveredTo(),
                response.seenBy(),
                response.createdAt(),
                response.updatedAt(),
                response.recalled(),
                response.edited()
            ),
            null,
            null,
            null,
            null
        );
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        emitUnreadSyncEvents(conversationId, event.message());

        return ApiResponse.ok("Message sent", response);
    }

    @PatchMapping("/conversations/{conversationId}/messages/{messageId}/edit")
    public ApiResponse<Map<String, Object>> editMessage(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody EditMessageRequest request
    ) {
        ChatEventResponse event = chatRealtimeService.editMessage(userId, new ChatEditRequest(conversationId, messageId, request.content()));
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        return ApiResponse.ok("Message updated", Map.of("messageId", messageId));
    }

    @GetMapping("/users/{userId}/online")
    public ApiResponse<Map<String, Object>> onlineStatus(@PathVariable("userId") String userId) {
        UserPresenceResponse presence = chatRealtimeService.getUserPresence(userId);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", userId);
        payload.put("online", presence.online());
        payload.put("lastChangedAt", presence.lastChangedAt());
        return ApiResponse.ok("Online status", payload);
    }

    @GetMapping("/users/presence")
    public ApiResponse<List<UserPresenceResponse>> userPresence(
        @RequestParam("ids") List<String> userIds
    ) {
        return ApiResponse.ok("Presence fetched", chatRealtimeService.getUsersPresence(userIds));
    }

    public record SendMessageRequest(
        String type,
        @NotBlank String content,
        String fileUrl,
        String fileName,
        String parentMessageId
    ) {
    }

    public record EditMessageRequest(@NotBlank String content) {
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/recall")
    public ApiResponse<Map<String, Object>> recallMessage(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId
    ) {
        ChatEventResponse event = chatRealtimeService.recallMessage(userId, new ChatRecallRequest(conversationId, messageId));
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        return ApiResponse.ok("Message recalled", Map.of("messageId", messageId));
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/delete-for-me")
    public ApiResponse<Map<String, Object>> deleteForMe(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId
    ) {
        ChatEventResponse event = chatRealtimeService.deleteForMe(userId, new ChatDeleteForMeRequest(conversationId, messageId));
        messagingTemplate.convertAndSendToUser(userId, "/queue/chat", event);
        return ApiResponse.ok("Message deleted for current user", Map.of("messageId", messageId));
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/forward")
    public ApiResponse<Map<String, Object>> forwardMessage(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody ForwardRequest request
    ) {
        ChatEventResponse event = chatRealtimeService.forwardMessage(
            userId,
            new ChatForwardRequest(conversationId, messageId, request.targetConversationId())
        );
        messagingTemplate.convertAndSend("/topic/chat/" + request.targetConversationId(), event);
        String forwardedMessageId = event.message() == null ? messageId : event.message().messageId();
        return ApiResponse.ok("Message forwarded", Map.of("messageId", forwardedMessageId));
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/read")
    public ApiResponse<Map<String, Object>> readReceipt(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId
    ) {
        ChatEventResponse event = chatRealtimeService.readReceipt(userId, new ChatReadReceiptRequest(conversationId, messageId));
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        emitUnreadSyncEvents(conversationId, event.message());
        return ApiResponse.ok("Read receipt updated", Map.of("messageId", messageId));
    }

    @PatchMapping("/conversations/{conversationId}/read")
    public ApiResponse<Map<String, Object>> markConversationRead(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @RequestParam(name = "messageId", required = false) String messageId
    ) {
        ChatEventResponse event = chatRealtimeService.markConversationAsRead(userId, conversationId, messageId);
        String readMessageId = messageId == null ? "" : messageId;
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        messagingTemplate.convertAndSendToUser(userId, "/queue/chat", event);
        emitUnreadSyncEvents(conversationId, null);
        return ApiResponse.ok("Conversation marked as read", Map.of("conversationId", conversationId, "messageId", readMessageId));
    }

    @PostMapping("/conversations/{conversationId}/messages/{messageId}/reactions")
    public ApiResponse<Map<String, Object>> addReaction(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody ReactionRequest request
    ) {
        ChatEventResponse event = chatRealtimeService.reactMessage(
            userId,
            new ChatReactionRequest(conversationId, messageId, request.emoji(), false)
        );
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        return ApiResponse.ok("Reaction updated", Map.of("messageId", messageId, "emoji", request.emoji()));
    }

    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}/reactions")
    public ApiResponse<Map<String, Object>> removeReaction(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") UUID conversationId,
        @PathVariable("messageId") String messageId,
        @RequestParam("emoji") String emoji
    ) {
        ChatEventResponse event = chatRealtimeService.reactMessage(
            userId,
            new ChatReactionRequest(conversationId, messageId, emoji, true)
        );
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
        return ApiResponse.ok("Reaction removed", Map.of("messageId", messageId, "emoji", emoji));
    }

    public record ForwardRequest(UUID targetConversationId) {
    }

    public record ReactionRequest(@NotBlank String emoji) {
    }

    private void emitUnreadSyncEvents(UUID conversationId, MessagePayload messagePayload, String... userIds) {
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

            ChatEventResponse unreadEvent = new ChatEventResponse(
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
            );
            messagingTemplate.convertAndSendToUser(userId, "/queue/chat", unreadEvent);

            ChatEventResponse totalUnreadEvent = new ChatEventResponse(
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
            );
            messagingTemplate.convertAndSendToUser(userId, "/queue/chat", totalUnreadEvent);

            if (messagePayload != null) {
                ChatEventResponse newMessageEvent = new ChatEventResponse(
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
                );
                messagingTemplate.convertAndSendToUser(userId, "/queue/chat", newMessageEvent);
            }
        }
    }
}
