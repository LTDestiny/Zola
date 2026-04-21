package com.zola.chat.web;

import com.zola.chat.document.ConversationDocument;
import com.zola.chat.document.MessageDocument;
import com.zola.chat.repository.ConversationRepository;
import com.zola.chat.repository.MessageRepository;
import com.zola.common.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.servlet.http.HttpServletResponse;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/v1/chat-legacy")
@Deprecated(forRemoval = true, since = "2026-04")
public class ChatQueryController {

    private static final String TOPIC_CHAT_PREFIX = "/topic/chat/";
    private static final String USER_QUEUE_CHAT = "/queue/chat";
    private static final String LEGACY_WARNING = "299 - chat-legacy API is deprecated; migrate to /api/v1/chat + STOMP contract in CHAT_1_1_FRONTEND_API.md";
    private static final String LEGACY_SUNSET = "Wed, 01 Oct 2026 00:00:00 GMT";

    private static final Logger log = LoggerFactory.getLogger(ChatQueryController.class);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatQueryController(
        ConversationRepository conversationRepository,
        MessageRepository messageRepository,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping("/conversations")
    public ApiResponse<List<ConversationSummaryResponse>> conversations(
        @RequestHeader("X-User-Id") String userId,
        HttpServletResponse response
    ) {
        markLegacyDeprecated(response, "GET /api/v1/chat-legacy/conversations", userId);
        List<ConversationSummaryResponse> items = conversationRepository.findByParticipantsContains(userId)
            .stream()
            .map(conversation -> toSummary(userId, conversation))
            .sorted(Comparator.comparing(ConversationSummaryResponse::lastMessageAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();

        return ApiResponse.ok("Conversations fetched", items);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ApiResponse<List<MessageResponse>> messages(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") String conversationId,
        HttpServletResponse response
    ) {
        markLegacyDeprecated(response, "GET /api/v1/chat-legacy/conversations/{conversationId}/messages", userId);
        ConversationDocument conversation = ensureConversationMember(userId, conversationId);
        ObjectId objectId = parseObjectId(conversation.getId());
        List<MessageResponse> items = messageRepository.findByConversationIdOrderByCreatedAtAsc(objectId)
            .stream()
            .map(message -> new MessageResponse(
                message.getId() == null ? null : message.getId().toHexString(),
                message.getSenderId(),
                message.getContent(),
                message.getCreatedAt()
            ))
            .toList();

        return ApiResponse.ok("Messages fetched", items);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MessageResponse> sendMessage(
        @RequestHeader("X-User-Id") String userId,
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody SendMessageRequest request,
        HttpServletResponse response
    ) {
        markLegacyDeprecated(response, "POST /api/v1/chat-legacy/conversations/{conversationId}/messages", userId);
        ConversationDocument conversation = ensureConversationMember(userId, conversationId);
        Instant now = Instant.now();
        MessageDocument message = new MessageDocument();
        message.setId(new ObjectId());
        message.setConversationId(parseObjectId(conversationId));
        message.setSenderId(userId);
        message.setType("TEXT");
        message.setContent(request.content().trim());
        message.setCreatedAt(now);
        MessageDocument saved = messageRepository.save(message);

        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);

        ChatRealtimeMessage realtimeMessage = new ChatRealtimeMessage(
            saved.getId().toHexString(),
            saved.getId().toHexString(),
            conversationId,
            saved.getSenderId(),
            saved.getContent(),
            saved.getCreatedAt()
        );

        ChatRealtimeEvent messageEvent = new ChatRealtimeEvent(
            "MESSAGE_SENT",
            conversationId,
            userId,
            null,
            saved.getContent(),
            saved.getCreatedAt(),
            realtimeMessage
        );

        ChatRealtimeEvent conversationUpdatedEvent = new ChatRealtimeEvent(
            "CONVERSATION_UPDATED",
            conversationId,
            userId,
            null,
            saved.getContent(),
            saved.getCreatedAt(),
            realtimeMessage
        );

        // Keep one canonical destination to prevent duplicate timeline events.
        messagingTemplate.convertAndSend(TOPIC_CHAT_PREFIX + conversationId, messageEvent);
        if (conversation.getParticipants() != null) {
            for (String participantId : conversation.getParticipants()) {
                messagingTemplate.convertAndSendToUser(participantId, USER_QUEUE_CHAT, conversationUpdatedEvent);
            }
        }

        return ApiResponse.ok("Message sent", new MessageResponse(
            saved.getId().toHexString(),
            saved.getSenderId(),
            saved.getContent(),
            saved.getCreatedAt()
        ));
    }

    private ConversationSummaryResponse toSummary(String currentUserId, ConversationDocument conversation) {
        ObjectId conversationObjectId = parseObjectId(conversation.getId());
        MessageDocument lastMessage = messageRepository
            .findTopByConversationIdOrderByCreatedAtDesc(conversationObjectId)
            .orElse(null);

        String displayName = resolveDisplayName(currentUserId, conversation);
        Instant lastMessageAt = lastMessage == null ? conversation.getUpdatedAt() : lastMessage.getCreatedAt();
        String lastMessageContent = lastMessage == null ? "" : lastMessage.getContent();

        return new ConversationSummaryResponse(
            conversation.getId(),
            displayName,
            lastMessageContent,
            lastMessageAt,
            conversation.getParticipants()
        );
    }

    private String resolveDisplayName(String currentUserId, ConversationDocument conversation) {
        if (conversation.getParticipants() == null || conversation.getParticipants().isEmpty()) {
            return "Conversation";
        }

        for (String participant : conversation.getParticipants()) {
            if (!currentUserId.equals(participant)) {
                return participant;
            }
        }
        return "You";
    }

    private ConversationDocument ensureConversationMember(String userId, String conversationId) {
        ConversationDocument conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (conversation.getParticipants() == null || !conversation.getParticipants().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant of this conversation");
        }

        return conversation;
    }

    private ObjectId parseObjectId(String value) {
        if (!ObjectId.isValid(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid conversation id");
        }
        return new ObjectId(value);
    }

    private void markLegacyDeprecated(HttpServletResponse response, String endpoint, String userId) {
        response.setHeader("Deprecation", "true");
        response.setHeader("Sunset", LEGACY_SUNSET);
        response.setHeader("Warning", LEGACY_WARNING);
        response.setHeader("X-API-Deprecated", "true");
        log.warn("Deprecated legacy chat endpoint called: endpoint={}, userId={}", endpoint, userId);
    }

    public record ConversationSummaryResponse(
        String id,
        String name,
        String lastMessage,
        Instant lastMessageAt,
        List<String> participants
    ) {
    }

    public record MessageResponse(
        String id,
        String senderId,
        String content,
        Instant createdAt
    ) {
    }

    public record SendMessageRequest(@NotBlank String content) {
    }

    public record ChatRealtimeEvent(
        String eventType,
        String conversationId,
        String actorId,
        Integer unreadCount,
        String lastMessage,
        Instant lastMessageAt,
        ChatRealtimeMessage message
    ) {
    }

    public record ChatRealtimeMessage(
        String id,
        String messageId,
        String conversationId,
        String senderId,
        String content,
        Instant createdAt
    ) {
    }
}
