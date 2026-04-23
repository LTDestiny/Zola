package com.zola.chat.chatrealtime.service;

import com.zola.chat.chatrealtime.dto.ChatDeleteForMeRequest;
import com.zola.chat.chatrealtime.dto.ChatEditRequest;
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
import com.zola.chat.chatrealtime.dto.MessagesPageResponse;
import com.zola.chat.chatrealtime.dto.UserPresenceResponse;
import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.exception.ResourceNotFoundException;
import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import com.zola.chat.infrastructure.persistence.mongo.AttachmentDocument;
import com.zola.chat.infrastructure.persistence.mongo.MessageDocument;
import com.zola.chat.presence.PresenceManager;
import com.zola.chat.infrastructure.persistence.mongo.RealtimeMessageRepository;
import com.zola.chat.infrastructure.persistence.postgres.ConversationEntity;
import com.zola.chat.infrastructure.persistence.postgres.PostgresConversationRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresMessageHiddenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatRealtimeService {

    private final PostgresConversationRepository conversationRepository;
    private final RealtimeMessageRepository messageRepository;
    private final RedisOnlineUserChecker onlineUserChecker;
    private final PresenceManager presenceManager;
    private final PostgresMessageHiddenRepository messageHiddenRepository;
    private final StringRedisTemplate redisTemplate;
    private final MongoTemplate mongoTemplate;
    private final long editWindowSeconds;
    private final long recallWindowSeconds;

    private static final Duration DEDUP_TTL = Duration.ofMinutes(5);
    private static final String DEDUP_KEY_PREFIX = "msg:idem:";

    public ChatRealtimeService(
        PostgresConversationRepository conversationRepository,
        RealtimeMessageRepository messageRepository,
        RedisOnlineUserChecker onlineUserChecker,
        PresenceManager presenceManager,
        PostgresMessageHiddenRepository messageHiddenRepository,
        StringRedisTemplate redisTemplate,
        MongoTemplate mongoTemplate,
        @Value("${app.chat.edit-window-seconds:900}") long editWindowSeconds,
        @Value("${app.chat.recall-window-seconds:86400}") long recallWindowSeconds
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.onlineUserChecker = onlineUserChecker;
        this.presenceManager = presenceManager;
        this.messageHiddenRepository = messageHiddenRepository;
        this.redisTemplate = redisTemplate;
        this.mongoTemplate = mongoTemplate;
        this.editWindowSeconds = editWindowSeconds;
        this.recallWindowSeconds = recallWindowSeconds;
    }

    public ConversationResponse createDirectConversation(String requesterId, String targetUserId) {
        if (requesterId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot create conversation with yourself");
        }
        ConversationEntity conversation = conversationRepository.getOrCreateDirect(requesterId, targetUserId);
        return toConversationResponse(conversation, requesterId);
    }

    /**
     * Send a new message - atomic PostgreSQL transaction.
     * Note: MongoDB save is not transactional with PostgreSQL.
     * If PostgreSQL fails after MongoDB save, message is orphaned (acceptable tradeoff).
     */
    @Transactional
    public ChatEventResponse sendMessage(String senderId, ChatSendRequest request) {
        // ── IDEMPOTENCY CHECK ────────────────────────────────────────────────────
        // If client sends clientMessageId, use Redis to deduplicate within 5 min.
        // Protects against: double-click, network reconnect resend, race conditions.
        if (request.clientMessageId() != null && !request.clientMessageId().isBlank()) {
            String dedupKey = DEDUP_KEY_PREFIX + senderId + ":" + request.clientMessageId();
            String existingId = redisTemplate.opsForValue().get(dedupKey);
            if (existingId != null) {
                MessageDocument existing = messageRepository.findById(existingId).orElse(null);
                if (existing != null) {
                    return new ChatEventResponse(
                        "MESSAGE_SENT", senderId, request.conversationId().toString(),
                        false, false, null, toMessagePayload(existing), null, null, null, null
                    );
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, senderId);
        String receiverId = resolvePeerUserId(conversation, senderId);
        Instant now = Instant.now();

        MessageDocument item = new MessageDocument();
        item.setConversationId(request.conversationId().toString());
        item.setId(generateMessageId());
        item.setSenderId(senderId);
        item.setReceiverId(receiverId);
        // Resolve type: use MEDIA when attachments are present
        boolean hasAttachments = request.attachments() != null && !request.attachments().isEmpty();
        String resolvedType = hasAttachments ? "MEDIA" : request.type().trim().toUpperCase();
        item.setType(resolvedType);
        String rawContent = request.content();
        item.setContent(rawContent == null ? "" : rawContent.trim());

        // Map attachments and populate legacy single-file fields for backward compat
        if (hasAttachments) {
            List<AttachmentDocument> docs = new ArrayList<>();
            for (ChatSendRequest.AttachmentInput a : request.attachments()) {
                AttachmentDocument doc = new AttachmentDocument();
                doc.setFileName(a.fileName());
                doc.setFileKey(a.fileKey());
                doc.setFileUrl(a.fileUrl());
                doc.setContentType(a.contentType());
                doc.setMediaType(a.mediaType());
                doc.setSizeBytes(a.sizeBytes());
                doc.setSortOrder(a.sortOrder());
                docs.add(doc);
            }
            item.setAttachments(docs);
            // Backward-compat: populate legacy fields from first attachment
            item.setFileUrl(request.attachments().get(0).fileUrl());
            item.setFileName(request.attachments().get(0).fileName());
        } else {
            item.setFileUrl(request.fileUrl());
            item.setFileName(request.fileName());
        }
        item.setReactions(Collections.emptyList());
        item.setCreatedAt(now.toString());
        item.setUpdatedAt(now.toString());
        item.setRecalled(false);
        item.setEdited(false);
        item.setSeenBy(new HashSet<>(Set.of(senderId)));
        Set<String> deliveredTo = new HashSet<>(Set.of(senderId));
        if (onlineUserChecker.isOnline(receiverId)) {
            deliveredTo.add(receiverId);
        }
        item.setDeliveredTo(deliveredTo);
        messageRepository.save(item);

        // ── STORE DEDUP KEY ──────────────────────────────────────────────────────
        if (request.clientMessageId() != null && !request.clientMessageId().isBlank()) {
            String dedupKey = DEDUP_KEY_PREFIX + senderId + ":" + request.clientMessageId();
            redisTemplate.opsForValue().set(dedupKey, item.getId(), DEDUP_TTL);
        }
        // ────────────────────────────────────────────────────────────────────────

        conversation.setLastMessage(item.getContent());
        conversation.setLastMessageAt(now);
        conversation.setUpdatedAt(now);
        conversation.incrementUnread(receiverId);
        conversation.markRead(senderId, now, item.getId());
        conversationRepository.save(conversation);

        return new ChatEventResponse(
            "MESSAGE_SENT",
            senderId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item),
            null,
            null,
            null,
            null
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
        ensureWithinWindow(item.getCreatedAt(), recallWindowSeconds, "Recall time window has expired");

        item.setRecalled(true);
        Instant recalledAt = Instant.now();
        if (item.getAuditRecalledContent() == null) {
            item.setAuditRecalledContent(item.getContent());
        }
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
            toMessagePayload(item),
            null,
            null,
            null,
            null
        );
    }

    @Transactional
    public ChatEventResponse editMessage(String senderId, ChatEditRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, senderId);

        MessageDocument item = messageRepository.findByConversationIdAndId(request.conversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        if (!senderId.equals(item.getSenderId())) {
            throw new ForbiddenOperationException("Only sender can edit this message");
        }
        if (item.isRecalled()) {
            throw new ForbiddenOperationException("Recalled message cannot be edited");
        }

        String nextContent = request.content().trim();
        if (nextContent.isBlank()) {
            throw new ForbiddenOperationException("Message content must not be blank");
        }

        ensureWithinWindow(item.getCreatedAt(), editWindowSeconds, "Edit time window has expired");

        if (item.getOriginalContent() == null) {
            item.setOriginalContent(item.getContent());
        }
        item.setEdited(true);
        item.setEditedAt(Instant.now().toString());
        item.setContent(nextContent);
        item.setUpdatedAt(Instant.now().toString());
        messageRepository.save(item);

        conversation.setLastMessage(nextContent);
        conversation.setLastMessageAt(Instant.now());
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        return new ChatEventResponse(
            "MESSAGE_UPDATED",
            senderId,
            request.conversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(item),
            null,
            null,
            null,
            null
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
            null,
            null,
            null,
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
            toMessagePayload(item),
            null,
            null,
            null,
            null
        );
    }

    @Transactional
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
        forwarded.setAttachments(original.getAttachments());
        forwarded.setReactions(Collections.emptyList());
        forwarded.setCreatedAt(Instant.now().toString());
        forwarded.setUpdatedAt(Instant.now().toString());
        forwarded.setRecalled(false);
        forwarded.setEdited(false);
        forwarded.setSeenBy(new HashSet<>(Set.of(senderId)));
        Set<String> deliveredTo = new HashSet<>(Set.of(senderId));
        if (onlineUserChecker.isOnline(forwarded.getReceiverId())) {
            deliveredTo.add(forwarded.getReceiverId());
        }
        forwarded.setDeliveredTo(deliveredTo);
        messageRepository.save(forwarded);

        target.setLastMessage(forwarded.getContent());
        target.setLastMessageAt(Instant.now());
        target.setUpdatedAt(Instant.now());
        target.incrementUnread(forwarded.getReceiverId());
        target.markRead(senderId, Instant.now(), forwarded.getId());
        conversationRepository.save(target);

        return new ChatEventResponse(
            "MESSAGE_FORWARDED",
            senderId,
            request.targetConversationId().toString(),
            false,
            false,
            null,
            toMessagePayload(forwarded),
            null,
            null,
            null,
            null
        );
    }


    @Transactional
    public ChatEventResponse readReceipt(String userId, ChatReadReceiptRequest request) {
        ConversationEntity conversation = conversationRepository.findById(request.conversationId());
        ensureMember(conversation, userId);

        Optional<MessageDocument> item = markMessagesAsSeenUpTo(userId, request.conversationId(), request.messageId());

        if (item.isPresent()) {
            conversation.markRead(userId, Instant.now(), request.messageId());
            conversationRepository.save(conversation);
        }

        return new ChatEventResponse(
            "READ_RECEIPT",
            userId,
            request.conversationId().toString(),
            false,
            false,
            null,
            item.map(this::toMessagePayload).orElse(null),
            null,
            null,
            null,
            null
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
            toMessagePayload(item),
            null,
            null,
            null,
            null
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
        List<ConversationEntity> entities = conversationRepository.findByParticipant(userId);

        // Batch-fetch peer presence to avoid N+1 Redis calls
        List<String> peerIds = entities.stream()
            .map(e -> e.getUser1Id().equals(userId) ? e.getUser2Id() : e.getUser1Id())
            .distinct()
            .collect(Collectors.toList());

        Map<String, RedisOnlineUserChecker.PresenceStatus> presenceMap =
            peerIds.isEmpty() ? Map.of() : onlineUserChecker.getPresence(peerIds);

        List<ConversationListItemResponse> items = new ArrayList<>();
        for (ConversationEntity entity : entities) {
            String peerUserId = entity.getUser1Id().equals(userId) ? entity.getUser2Id() : entity.getUser1Id();
            boolean online = Optional.ofNullable(presenceMap.get(peerUserId))
                .map(RedisOnlineUserChecker.PresenceStatus::online)
                .orElse(false);
            items.add(new ConversationListItemResponse(
                entity.getId().toString(),
                peerUserId,
                entity.getLastMessage() == null ? "" : entity.getLastMessage(),
                entity.getLastMessageAt(),
                entity.unreadCountOf(userId),
                entity.getUser1Id().equals(userId) ? entity.getUser1LastReadAt() : entity.getUser2LastReadAt(),
                entity.lastReadMessageIdOf(userId),
                List.of(entity.getUser1Id(), entity.getUser2Id()),
                peerUserId,
                online
            ));
        }
        return items;
    }

    @Transactional
    public ChatEventResponse markConversationAsRead(String userId, UUID conversationId, String explicitMessageId) {
        ConversationEntity conversation = conversationRepository.findById(conversationId);
        ensureMember(conversation, userId);

        // Idempotent fast path: avoid repeated writes/events when conversation is already read.
        if (conversation.unreadCountOf(userId) <= 0) {
            return new ChatEventResponse(
                "READ_RECEIPT_NOOP",
                userId,
                conversationId.toString(),
                false,
                false,
                null,
                null,
                0,
                conversationRepository.sumUnreadByParticipant(userId),
                conversation.getLastMessage(),
                conversation.getLastMessageAt() == null ? null : conversation.getLastMessageAt().toString()
            );
        }

        String messageId = explicitMessageId;
        MessagePayload readMessagePayload = null;
        if (messageId == null || messageId.isBlank()) {
            messageId = newestMessageId(conversationId).orElse(null);
        }

        if (messageId != null && !messageId.isBlank()) {
            Optional<MessageDocument> readMessage = markMessagesAsSeenUpTo(userId, conversationId, messageId);
            readMessagePayload = readMessage.map(this::toMessagePayload).orElse(null);
            if (readMessage.isEmpty()) {
                messageId = null;
            }
        }

        if (messageId != null && !messageId.isBlank()) {
            conversation.markRead(userId, Instant.now(), messageId);
            conversationRepository.save(conversation);
        }

        return new ChatEventResponse(
            "READ_RECEIPT",
            userId,
            conversationId.toString(),
            false,
            false,
            null,
            readMessagePayload,
            0,
            conversationRepository.sumUnreadByParticipant(userId),
            conversation.getLastMessage(),
            conversation.getLastMessageAt() == null ? null : conversation.getLastMessageAt().toString()
        );
    }

    public int totalUnreadCount(String userId) {
        return conversationRepository.sumUnreadByParticipant(userId);
    }

    public ChatEventResponse buildConversationUpdatedEvent(String userId, UUID conversationId, String eventType, MessagePayload message) {
        ConversationEntity conversation = conversationRepository.findById(conversationId);
        ensureMember(conversation, userId);
        return new ChatEventResponse(
            eventType,
            userId,
            conversationId.toString(),
            false,
            false,
            null,
            message,
            conversation.unreadCountOf(userId),
            conversationRepository.sumUnreadByParticipant(userId),
            conversation.getLastMessage(),
            conversation.getLastMessageAt() == null ? null : conversation.getLastMessageAt().toString()
        );
    }

    public MessageItemResponse sendMessageHttp(
        String senderId,
        UUID conversationId,
        String type,
        String content,
        String fileUrl,
        String fileName,
        String clientMessageId
    ) {
        String normalizedType = (type == null || type.isBlank()) ? "TEXT" : type.trim().toUpperCase();
        ChatEventResponse event = sendMessage(senderId,
            new ChatSendRequest(conversationId, normalizedType, content, fileUrl, fileName, null, clientMessageId));
        MessagePayload message = event.message();
        return toMessageItemResponse(message);
    }

    public MessagesPageResponse getMessagesHttp(String userId, UUID conversationId, String cursor, int limit) {
        List<MessagePayload> messages = getMessages(userId, conversationId).stream()
            .sorted(Comparator
                .comparing(MessagePayload::createdAt, Comparator.nullsLast(String::compareTo))
                .thenComparing(MessagePayload::messageId, Comparator.nullsLast(String::compareTo))
                .reversed())
            .toList();

        int safeLimit = Math.max(1, Math.min(limit, 100));
        int start = 0;
        if (cursor != null && !cursor.isBlank()) {
            for (int index = 0; index < messages.size(); index += 1) {
                if (cursor.equals(messages.get(index).messageId())) {
                    start = index + 1;
                    break;
                }
            }
        }

        int end = Math.min(start + safeLimit, messages.size());
        List<MessagePayload> pageSlice = messages.subList(start, end);
        String nextCursor = end < messages.size() ? pageSlice.get(pageSlice.size() - 1).messageId() : null;

        List<MessageItemResponse> items = pageSlice.stream()
            .map(this::toMessageItemResponse)
            .toList();

        return new MessagesPageResponse(items, nextCursor);
    }

    public boolean isOnline(String userId) {
        // Use PresenceManager for consistent presence (with delayed offline support)
        PresenceManager.PresenceState state = presenceManager.getPresence(userId);
        return state.online();
    }

    public UserPresenceResponse getUserPresence(String userId) {
        // Use PresenceManager for consistent presence
        PresenceManager.PresenceState state = presenceManager.getPresence(userId);
        return new UserPresenceResponse(
            userId,
            state.online(),
            state.lastSeenAt()
        );
    }

    public List<UserPresenceResponse> getUsersPresence(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }

        List<String> normalizedUserIds = userIds.stream()
            .filter(id -> id != null && !id.isBlank())
            .map(String::trim)
            .distinct()
            .toList();

        if (normalizedUserIds.isEmpty()) {
            return List.of();
        }

        // Use PresenceManager for consistent presence (with delayed offline support)
        Map<String, PresenceManager.PresenceState> presenceMap = presenceManager.getPresenceBatch(normalizedUserIds);
        return normalizedUserIds.stream()
            .map(userId -> {
                PresenceManager.PresenceState state = presenceMap.get(userId);
                if (state == null) {
                    return new UserPresenceResponse(userId, false, null);
                }
                return new UserPresenceResponse(userId, state.online(), state.lastSeenAt());
            })
            .toList();
    }

    private void ensureMember(ConversationEntity conversation, String userId) {
        if (!conversationRepository.isMember(conversation, userId)) {
            throw new ForbiddenOperationException("User is not member of conversation");
        }
    }

    private MessageItemResponse toMessageItemResponse(MessagePayload message) {
        return new MessageItemResponse(
            message.messageId(),
            message.conversationId(),
            message.senderId(),
            message.receiverId(),
            message.type(),
            message.content(),
            message.fileUrl(),
            message.fileName(),
            message.attachments(),
            message.reactions(),
            message.recalled(),
            message.deletedForUsers(),
            message.deliveredTo(),
            message.seenBy(),
            message.createdAt(),
            message.updatedAt(),
            message.edited()
        );
    }

    private MessagePayload toMessagePayload(MessageDocument item) {
        List<MessagePayload.AttachmentPayload> attachmentPayloads =
            item.getAttachments() == null ? Collections.emptyList() :
            item.getAttachments().stream()
                .map(a -> new MessagePayload.AttachmentPayload(
                    a.getFileName(), a.getFileKey(), a.getFileUrl(),
                    a.getContentType(), a.getMediaType(), a.getSizeBytes(), a.getSortOrder()))
                .toList();
        return new MessagePayload(
            item.getId(),
            item.getConversationId(),
            item.getSenderId(),
            item.getReceiverId(),
            item.getType(),
            item.getContent(),
            item.getFileUrl(),
            item.getFileName(),
            attachmentPayloads,
            item.getReactions(),
            item.getDeletedForUsers(),
            item.getDeliveredTo(),
            item.getSeenBy(),
            item.getCreatedAt(),
            item.getUpdatedAt(),
            item.isRecalled(),
            item.isEdited()
        );
    }

    private String resolvePeerUserId(ConversationEntity conversation, String senderId) {
        if (senderId.equals(conversation.getUser1Id())) {
            return conversation.getUser2Id();
        }
        return conversation.getUser1Id();
    }

    private ConversationResponse toConversationResponse(ConversationEntity entity, String requesterId) {
        return new ConversationResponse(
            entity.getId(),
            entity.getUser1Id(),
            entity.getUser2Id(),
            entity.getLastMessage(),
            entity.getLastMessageAt(),
            entity.unreadCountOf(requesterId),
            entity.getUser1Id().equals(requesterId) ? entity.getUser1LastReadAt() : entity.getUser2LastReadAt(),
            entity.lastReadMessageIdOf(requesterId),
            entity.getUpdatedAt()
        );
    }

    private Optional<String> newestMessageId(UUID conversationId) {
        List<MessageDocument> items = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId.toString());
        if (items.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(items.get(items.size() - 1).getId());
    }

    /**
     * PERFORMANCE FIX: Use MongoDB updateMany instead of load-all-then-batch-save.
     *
     * OLD: loadAll(N docs) + findTargetIndex(O(N)) + saveAll(N docs) → O(N) DB operations
     * NEW: findOne(target) + updateMany(lte createdAt) → O(1) indexed queries
     *
     * Requires index on (conversationId, createdAt) in MongoDB for production performance.
     */
    private Optional<MessageDocument> markMessagesAsSeenUpTo(String userId, UUID conversationId, String messageId) {
        if (messageId == null || messageId.isBlank()) {
            return Optional.empty();
        }

        // 1. Find target message to get its createdAt timestamp
        Optional<MessageDocument> targetOpt = messageRepository.findByConversationIdAndId(
            conversationId.toString(), messageId
        );
        if (targetOpt.isEmpty()) {
            return Optional.empty();
        }

        MessageDocument target = targetOpt.get();
        String targetCreatedAt = target.getCreatedAt();
        if (targetCreatedAt == null) {
            return Optional.empty();
        }

        // 2. Bulk update all messages in this conversation up to and including target
        //    ISO 8601 strings sort lexicographically = chronologically for UTC timestamps
        Query query = Query.query(
            Criteria.where("conversationId").is(conversationId.toString())
                .and("createdAt").lte(targetCreatedAt)
        );
        Update update = new Update()
            .addToSet("seenBy", userId)
            .addToSet("deliveredTo", userId)
            .set("updatedAt", Instant.now().toString());

        mongoTemplate.updateMulti(query, update, MessageDocument.class);

        // 3. Re-fetch target to return updated state (seenBy now includes userId)
        return messageRepository.findByConversationIdAndId(conversationId.toString(), messageId);
    }

    private String generateMessageId() {
        return Instant.now().toEpochMilli() + "-" + UUID.randomUUID();
    }

    private void ensureWithinWindow(String createdAtRaw, long windowSeconds, String errorMessage) {
        if (windowSeconds <= 0) {
            return;
        }
        Instant createdAt;
        try {
            createdAt = Instant.parse(createdAtRaw);
        } catch (Exception ex) {
            throw new ForbiddenOperationException(errorMessage);
        }

        Instant deadline = createdAt.plusSeconds(windowSeconds);
        if (Instant.now().isAfter(deadline)) {
            throw new ForbiddenOperationException(errorMessage);
        }
    }
}
