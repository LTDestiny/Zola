package com.zola.chat.chatrealtime.service;

import com.zola.chat.chatrealtime.dto.ChatDeleteForMeRequest;
import com.zola.chat.chatrealtime.dto.ChatEventResponse;
import com.zola.chat.chatrealtime.dto.ChatForwardRequest;
import com.zola.chat.chatrealtime.dto.ChatReadReceiptRequest;
import com.zola.chat.chatrealtime.dto.ChatReactionRequest;
import com.zola.chat.chatrealtime.dto.ChatRecallRequest;
import com.zola.chat.chatrealtime.dto.ChatSendRequest;
import com.zola.chat.chatrealtime.dto.ChatTypingRequest;
import com.zola.chat.chatrealtime.dto.ConversationListItemResponse;
import com.zola.chat.chatrealtime.dto.ConversationResponse;
import com.zola.chat.chatrealtime.dto.MessagePayload;
import com.zola.chat.chatrealtime.dto.MessageItemResponse;
import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.exception.ResourceNotFoundException;
import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import com.zola.chat.infrastructure.persistence.mongo.MessageDocument;
import com.zola.chat.infrastructure.persistence.mongo.RealtimeMessageRepository;
import com.zola.chat.infrastructure.persistence.postgres.ConversationEntity;
import com.zola.chat.infrastructure.persistence.postgres.PostgresConversationRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresMessageHiddenRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatRealtimeService {

    private final PostgresConversationRepository conversationRepository;
    private final RealtimeMessageRepository messageRepository;
    private final RedisOnlineUserChecker onlineUserChecker;
    private final PostgresMessageHiddenRepository messageHiddenRepository;

    public ChatRealtimeService(
        PostgresConversationRepository conversationRepository,
        RealtimeMessageRepository messageRepository,
        RedisOnlineUserChecker onlineUserChecker,
        PostgresMessageHiddenRepository messageHiddenRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.onlineUserChecker = onlineUserChecker;
        this.messageHiddenRepository = messageHiddenRepository;
    }

    public ConversationResponse createDirectConversation(String requesterId, String targetUserId) {
        if (requesterId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot create conversation with yourself");
        }
        ConversationEntity conversation = conversationRepository.getOrCreateDirect(requesterId, targetUserId);
        return toConversationResponse(conversation);
    }

    public ChatEventResponse sendMessage(String senderId, ChatSendRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, senderId);
        String receiverId = resolvePeerUserId(conversation, senderId);
        Instant now = Instant.now();

        MessageDocument item = new MessageDocument();
        item.setConversationId(request.conversationId().toString());
        item.setId(generateMessageId());
        item.setSenderId(senderId);
        item.setReceiverId(receiverId);
        item.setType(request.type().trim().toUpperCase());
        item.setContent(request.content().trim());
        item.setFileUrl(request.fileUrl());
        item.setFileName(request.fileName());
        item.setReactions(Collections.emptyList());
        item.setCreatedAt(now.toString());
        item.setUpdatedAt(now.toString());
        item.setRecalled(false);
        item.setSeenBy(new HashSet<>(Set.of(senderId)));
        messageRepository.save(item);

        conversation.setLastMessage(item.getContent());
        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);

        return new ChatEventResponse(
            "MESSAGE_SENT",
            senderId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item)
        );
    }

    public ChatEventResponse recallMessage(String senderId, ChatRecallRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, senderId);

        MessageDocument item = messageRepository.findByConversationIdAndId(request.conversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        if (!senderId.equals(item.getSenderId())) {
            throw new ForbiddenOperationException("Only sender can recall this message");
        }

        item.setRecalled(true);
        Instant recalledAt = Instant.now();
        item.setContent("This message was recalled");
        item.setRecalledBy(senderId);
        item.setRecalledAt(recalledAt.toString());
        item.setUpdatedAt(recalledAt.toString());
        messageRepository.save(item);

        return new ChatEventResponse(
            "MESSAGE_RECALLED",
            senderId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item)
        );
    }

    public ChatEventResponse typing(String senderId, ChatTypingRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, senderId);

        return new ChatEventResponse(
            "TYPING",
            senderId,
            request.conversationId().toString(),
            request.typing(),
            false,
            null,
            null
        );
    }

    public ChatEventResponse deleteForMe(String userId, ChatDeleteForMeRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, userId);

        MessageDocument item = messageRepository.findByConversationIdAndId(request.conversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        Set<String> deletedFor = item.getDeletedForUsers() == null ? new HashSet<>() : new HashSet<>(item.getDeletedForUsers());
        deletedFor.add(userId);
        item.setDeletedForUsers(deletedFor);
        item.setUpdatedAt(Instant.now().toString());
        messageRepository.save(item);
        messageHiddenRepository.saveHidden(userId, request.messageId());

        return new ChatEventResponse(
            "MESSAGE_DELETED_FOR_ME",
            userId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item)
        );
    }

    public ChatEventResponse forwardMessage(String senderId, ChatForwardRequest request) {
        ConversationEntity source = conversationRepository.findById(request.sourceConversationId());
        ConversationEntity target = conversationRepository.findById(request.targetConversationId());
        ensureMember(source, senderId);
        ensureMember(target, senderId);

        MessageDocument original = messageRepository.findByConversationIdAndId(request.sourceConversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        MessageDocument forwarded = new MessageDocument();
        forwarded.setConversationId(request.targetConversationId().toString());
        forwarded.setId(generateMessageId());
        forwarded.setSenderId(senderId);
        forwarded.setReceiverId(resolvePeerUserId(target, senderId));
        forwarded.setType("FORWARD");
        forwarded.setContent(original.getContent());
        forwarded.setFileUrl(original.getFileUrl());
        forwarded.setFileName(original.getFileName());
        forwarded.setReactions(Collections.emptyList());
        forwarded.setCreatedAt(Instant.now().toString());
        forwarded.setUpdatedAt(Instant.now().toString());
        forwarded.setRecalled(false);
        forwarded.setSeenBy(new HashSet<>(Set.of(senderId)));
        messageRepository.save(forwarded);

        target.setLastMessage(forwarded.getContent());
        target.setUpdatedAt(Instant.now());
        conversationRepository.save(target);

        return new ChatEventResponse(
            "MESSAGE_FORWARDED",
            senderId,
            request.targetConversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(forwarded)
        );
    }

    public ChatEventResponse readReceipt(String userId, ChatReadReceiptRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, userId);

        MessageDocument item = messageRepository.findByConversationIdAndId(request.conversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        Set<String> readBy = item.getSeenBy() == null ? new HashSet<>() : new HashSet<>(item.getSeenBy());
        readBy.add(userId);
        item.setSeenBy(readBy);
        item.setUpdatedAt(Instant.now().toString());
        messageRepository.save(item);

        return new ChatEventResponse(
            "READ_RECEIPT",
            userId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item)
        );
    }

    public ChatEventResponse reactMessage(String userId, ChatReactionRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, userId);

        MessageDocument item = messageRepository.findByConversationIdAndId(request.conversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        String normalizedEmoji = request.emoji().trim();
        List<String> reactions = item.getReactions() == null ? new ArrayList<>() : new ArrayList<>(item.getReactions());
        reactions = reactions.stream()
            .filter(reaction -> !reaction.startsWith(userId + "|"))
            .collect(Collectors.toCollection(ArrayList::new));

        if (!request.remove()) {
            reactions.add(userId + "|" + normalizedEmoji);
        }

        item.setReactions(reactions);
        item.setUpdatedAt(Instant.now().toString());
        messageRepository.save(item);

        return new ChatEventResponse(
            "MESSAGE_REACTION_UPDATED",
            userId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item)
        );
    }

    public List<MessagePayload> getMessages(String userId, UUID conversationId) {
        ConversationEntity conversation = conversationRepository.findById(conversationId);
        ensureMember(conversation, userId);

        List<MessagePayload> result = new ArrayList<>();
        for (MessageDocument item : messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId.toString())) {
            if (item.getDeletedForUsers() != null && item.getDeletedForUsers().contains(userId)) {
                continue;
            }
            result.add(toMessagePayload(item));
        }
        return result;
    }

    public List<ConversationListItemResponse> listConversations(String userId) {
        List<ConversationListItemResponse> items = new ArrayList<>();
        for (ConversationEntity entity : conversationRepository.findByParticipant(userId)) {
            String peerUserId = entity.getUser1Id().equals(userId) ? entity.getUser2Id() : entity.getUser1Id();
            items.add(new ConversationListItemResponse(
                entity.getId().toString(),
                peerUserId,
                entity.getLastMessage() == null ? "" : entity.getLastMessage(),
                entity.getUpdatedAt(),
                List.of(entity.getUser1Id(), entity.getUser2Id())
            ));
        }
        return items;
    }

    public MessageItemResponse sendMessageHttp(
        String senderId,
        UUID conversationId,
        String type,
        String content,
        String fileUrl,
        String fileName
    ) {
        String normalizedType = (type == null || type.isBlank()) ? "TEXT" : type.trim().toUpperCase();
        ChatEventResponse event = sendMessage(senderId, new ChatSendRequest(conversationId, normalizedType, content, fileUrl, fileName));
        MessagePayload message = event.message();
        return new MessageItemResponse(
            message.messageId(),
            message.conversationId(),
            message.senderId(),
            message.receiverId(),
            message.type(),
            message.content(),
            message.fileUrl(),
            message.fileName(),
            message.reactions(),
            message.recalled(),
            message.deletedForUsers(),
            message.seenBy(),
            message.createdAt(),
            message.updatedAt()
        );
    }

    public List<MessageItemResponse> getMessagesHttp(String userId, UUID conversationId, int page, int size) {
        List<MessagePayload> messages = getMessages(userId, conversationId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        int fromIndex = Math.min(safePage * safeSize, messages.size());
        int toIndex = Math.min(fromIndex + safeSize, messages.size());

        return messages.subList(fromIndex, toIndex).stream()
            .map(message -> new MessageItemResponse(
                message.messageId(),
                message.conversationId(),
                message.senderId(),
                message.receiverId(),
                message.type(),
                message.content(),
                message.fileUrl(),
                message.fileName(),
                message.reactions(),
                message.recalled(),
                message.deletedForUsers(),
                message.seenBy(),
                message.createdAt(),
                message.updatedAt()
            ))
            .toList();
    }

    public boolean isOnline(String userId) {
        return onlineUserChecker.isOnline(userId);
    }

    private void ensureMember(ConversationEntity conversation, String userId) {
        if (!conversationRepository.isMember(conversation, userId)) {
            throw new ForbiddenOperationException("User is not member of conversation");
        }
    }

    private MessagePayload toMessagePayload(MessageDocument item) {
        return new MessagePayload(
            item.getId(),
            item.getConversationId(),
            item.getSenderId(),
            item.getReceiverId(),
            item.getType(),
            item.getContent(),
            item.getFileUrl(),
            item.getFileName(),
            item.getReactions(),
            item.getDeletedForUsers(),
            item.getSeenBy(),
            item.getCreatedAt(),
            item.getUpdatedAt(),
            item.isRecalled()
        );
    }

    private String resolvePeerUserId(ConversationEntity conversation, String senderId) {
        if (senderId.equals(conversation.getUser1Id())) {
            return conversation.getUser2Id();
        }
        return conversation.getUser1Id();
    }

    private ConversationResponse toConversationResponse(ConversationEntity entity) {
        return new ConversationResponse(
            entity.getId(),
            entity.getUser1Id(),
            entity.getUser2Id(),
            entity.getLastMessage(),
            entity.getUpdatedAt()
        );
    }

    private String generateMessageId() {
        return Instant.now().toEpochMilli() + "-" + UUID.randomUUID();
    }
}
