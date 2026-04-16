package com.zola.chat.socket;

import com.zola.chat.document.ConversationDocument;
import com.zola.chat.repository.ConversationRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.List;

@Controller
public class ChatRealtimeController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationRepository conversationRepository;

    public ChatRealtimeController(
        SimpMessagingTemplate messagingTemplate,
        ConversationRepository conversationRepository
    ) {
        this.messagingTemplate = messagingTemplate;
        this.conversationRepository = conversationRepository;
    }

    @MessageMapping("/chat.typing")
    public void typing(@Payload TypingPayload payload, Principal principal) {
        if (principal == null || payload == null || payload.conversationId() == null) {
            return;
        }

        ConversationDocument conversation = findConversation(payload.conversationId());
        if (conversation == null || !isParticipant(conversation, principal.getName())) {
            return;
        }

        ChatSignalEvent event = new ChatSignalEvent(
            "TYPING",
            payload.conversationId(),
            principal.getName(),
            null,
            Boolean.TRUE.equals(payload.typing()),
            Instant.now(),
            null
        );

        publishConversationEvent(payload.conversationId(), event);
    }

    @MessageMapping("/chat.read")
    public void read(@Payload ReadPayload payload, Principal principal) {
        if (principal == null || payload == null || payload.conversationId() == null) {
            return;
        }

        ConversationDocument conversation = findConversation(payload.conversationId());
        if (conversation == null || !isParticipant(conversation, principal.getName())) {
            return;
        }

        ChatSignalEvent event = new ChatSignalEvent(
            "READ_RECEIPT",
            payload.conversationId(),
            principal.getName(),
            payload.messageId(),
            false,
            Instant.now(),
            null
        );

        publishConversationEvent(payload.conversationId(), event);
        publishParticipantsQueue(conversation.getParticipants(), event);
    }

    private ConversationDocument findConversation(String conversationId) {
        return conversationRepository.findById(conversationId).orElse(null);
    }

    private boolean isParticipant(ConversationDocument conversation, String userId) {
        List<String> participants = conversation.getParticipants();
        return participants != null && participants.contains(userId);
    }

    private void publishConversationEvent(String conversationId, ChatSignalEvent event) {
        messagingTemplate.convertAndSend("/topic/chat." + conversationId, event);
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, event);
    }

    private void publishParticipantsQueue(List<String> participants, ChatSignalEvent event) {
        if (participants == null) {
            return;
        }

        for (String participantId : participants) {
            messagingTemplate.convertAndSendToUser(participantId, "/queue/chat", event);
            messagingTemplate.convertAndSendToUser(participantId, "/queue/notifications", event);
        }
    }

    public record TypingPayload(String conversationId, Boolean typing) {
    }

    public record ReadPayload(String conversationId, String messageId) {
    }

    public record ChatSignalEvent(
        String eventType,
        String conversationId,
        String actorId,
        String messageId,
        boolean typing,
        Instant occurredAt,
        Object message
    ) {
    }
}
