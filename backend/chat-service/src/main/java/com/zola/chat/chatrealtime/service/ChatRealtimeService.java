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
import com.zola.chat.chatrealtime.dto.MessageReactionPayload;
import com.zola.chat.chatrealtime.dto.MessageItemResponse;
import com.zola.chat.chatrealtime.dto.MessagesPageResponse;
import com.zola.chat.chatrealtime.dto.UserPresenceResponse;
import com.zola.chat.document.ConversationDocument;
import com.zola.chat.document.PendingGroupMemberItem;
import com.zola.chat.document.PinnedMessageItem;
import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.exception.ResourceNotFoundException;
import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import com.zola.chat.infrastructure.persistence.mongo.MessageDocument;
import com.zola.chat.presence.PresenceManager;
import com.zola.chat.infrastructure.persistence.mongo.RealtimeMessageRepository;
import com.zola.chat.infrastructure.persistence.postgres.ConversationEntity;
import com.zola.chat.infrastructure.persistence.postgres.PostgresConversationRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresMessageHiddenRepository;
import com.zola.chat.repository.ConversationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatRealtimeService {

    private static final String CONVERSATION_TYPE_PRIVATE = "private";
    private static final String CONVERSATION_TYPE_GROUP = "group";
    private static final char[] INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int INVITE_CODE_LENGTH = 10;
    private static final int INVITE_CODE_MAX_ATTEMPTS = 8;
    private static final int MAX_PINNED_MESSAGES = 3;
    private static final SecureRandom INVITE_CODE_RANDOM = new SecureRandom();

    private final PostgresConversationRepository conversationRepository;
    private final ConversationRepository groupConversationRepository;
    private final RealtimeMessageRepository messageRepository;
    private final RedisOnlineUserChecker onlineUserChecker;
    private final PresenceManager presenceManager;
    private final PostgresMessageHiddenRepository messageHiddenRepository;
    private final long editWindowSeconds;
    private final long recallWindowSeconds;

    public record GroupActionResult(
        ConversationListItemResponse conversation,
        MessagePayload systemMessage
    ) {
    }

    public record GroupSettingsUpdateResult(
        Map<String, Object> settings,
        MessagePayload systemMessage
    ) {
    }

    public ChatRealtimeService(
        PostgresConversationRepository conversationRepository,
        ConversationRepository groupConversationRepository,
        RealtimeMessageRepository messageRepository,
        RedisOnlineUserChecker onlineUserChecker,
        PresenceManager presenceManager,
        PostgresMessageHiddenRepository messageHiddenRepository,
        @Value("${app.chat.edit-window-seconds:900}") long editWindowSeconds,
        @Value("${app.chat.recall-window-seconds:86400}") long recallWindowSeconds
    ) {
        this.conversationRepository = conversationRepository;
        this.groupConversationRepository = groupConversationRepository;
        this.messageRepository = messageRepository;
        this.onlineUserChecker = onlineUserChecker;
        this.presenceManager = presenceManager;
        this.messageHiddenRepository = messageHiddenRepository;
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

    @Transactional
    public ConversationResponse createGroupConversation(String requesterId, String name, List<String> memberIds, String avatar) {
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isBlank()) {
            throw new IllegalArgumentException("Group name must not be blank");
        }

        LinkedHashSet<String> members = new LinkedHashSet<>();
        members.add(requesterId);
        if (memberIds != null) {
            memberIds.stream()
                .filter(memberId -> memberId != null && !memberId.isBlank())
                .map(String::trim)
                .forEach(members::add);
        }

        if (members.size() < 2) {
            throw new IllegalArgumentException("Group must contain at least 2 members");
        }

        Instant now = Instant.now();
        ConversationDocument conversation = new ConversationDocument();
        conversation.setId(UUID.randomUUID().toString());
        conversation.setType(CONVERSATION_TYPE_GROUP);
        conversation.setName(normalizedName);
        conversation.setAvatar(avatar);
        conversation.setOwnerId(requesterId);
        conversation.setAdmins(new ArrayList<>(List.of(requesterId)));
        conversation.setMembers(new ArrayList<>(members));
        conversation.setParticipants(new ArrayList<>(members));
        conversation.setOnlyAdminsCanMessage(false);
        conversation.setRequireApprovalToJoin(false);
        conversation.setAllowMemberInvite(true);
        conversation.setAllowMemberEditGroupInfo(false);
        conversation.setAllowMemberPinBoardItems(false);
        conversation.setAllowMemberCreateNotes(false);
        conversation.setAllowMemberCreateReminders(false);
        conversation.setAllowMemberCreatePolls(false);
        conversation.setPinnedMessages(new ArrayList<>());
        conversation.setPendingMembers(new ArrayList<>());
        conversation.setInviteCode(generateUniqueInviteCode());
        conversation.setLastMessage("");
        conversation.setLastMessageAt(now.toString());
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        groupConversationRepository.save(conversation);

        return toGroupConversationResponse(conversation, requesterId);
    }
    @Transactional
    public GroupActionResult addGroupMember(String actorId, UUID conversationId, String userId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        String normalizedUserId = userId == null ? "" : userId.trim();
        if (normalizedUserId.isBlank()) {
            throw new IllegalArgumentException("userId must not be blank");
        }

        boolean actorIsOwner = actorId.equals(conversation.getOwnerId());
        boolean actorIsAdmin = normalizeAdmins(conversation).contains(actorId);
        if (!actorIsOwner && !actorIsAdmin && !conversation.isAllowMemberInvite()) {
            throw new ForbiddenOperationException("Only owner/admin can add members when invite link is disabled");
        }

        List<String> members = new ArrayList<>(normalizeMembers(conversation));
        if (members.contains(normalizedUserId)) {
            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), null);
        }

        if (hasPendingMember(conversation, normalizedUserId)) {
            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), null);
        }

        if (conversation.isRequireApprovalToJoin() && !actorIsOwner && !actorIsAdmin) {
            addPendingMember(conversation, normalizedUserId, actorId);
            conversation.setUpdatedAt(Instant.now());
            groupConversationRepository.save(conversation);

            MessagePayload systemMessage = createGroupSystemMessage(
                conversation,
                actorId,
                "[System] " + normalizedUserId + " is waiting for admin approval to join"
            );

            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
        }

        members.add(normalizedUserId);
        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        markAllMessagesAsSeenForUser(conversation.getId(), normalizedUserId);
        MessagePayload systemMessage = createGroupSystemMessage(
            conversation,
            actorId,
            "[System] " + actorId + " added " + normalizedUserId + " to the group"
        );

        return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
    }

    @Transactional
    public GroupActionResult removeGroupMember(String actorId, UUID conversationId, String userId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        String normalizedUserId = userId == null ? "" : userId.trim();
        if (normalizedUserId.isBlank()) {
            throw new IllegalArgumentException("userId must not be blank");
        }

        boolean actorIsOwner = actorId.equals(conversation.getOwnerId());
        boolean actorIsAdmin = normalizeAdmins(conversation).contains(actorId);
        if (!actorIsOwner && !actorIsAdmin) {
            throw new ForbiddenOperationException("Only owner or admin can remove members");
        }

        if (normalizedUserId.equals(conversation.getOwnerId())) {
            throw new ForbiddenOperationException("Owner cannot be removed from group");
        }

        if (normalizeAdmins(conversation).contains(normalizedUserId) && !actorIsOwner) {
            throw new ForbiddenOperationException("Only owner can remove another admin");
        }

        List<String> members = new ArrayList<>(normalizeMembers(conversation));
        if (!members.remove(normalizedUserId)) {
            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), null);
        }

        List<String> admins = new ArrayList<>(normalizeAdmins(conversation));
        admins.remove(normalizedUserId);

        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setAdmins(admins);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        MessagePayload systemMessage = createGroupSystemMessage(
            conversation,
            actorId,
            "[System] " + actorId + " removed " + normalizedUserId + " from the group"
        );

        return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
    }

    @Transactional
    public GroupActionResult leaveGroupConversation(String actorId, UUID conversationId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);

        List<String> members = new ArrayList<>(normalizeMembers(conversation));
        members.remove(actorId);

        if (members.isEmpty()) {
            ConversationListItemResponse removed = new ConversationListItemResponse(
                conversation.getId(),
                CONVERSATION_TYPE_GROUP,
                Optional.ofNullable(conversation.getName()).filter(value -> !value.isBlank()).orElse("Group"),
                conversation.getAvatar(),
                Optional.ofNullable(conversation.getLastMessage()).orElse(""),
                parseInstant(conversation.getLastMessageAt()).orElse(conversation.getUpdatedAt()),
                0,
                null,
                null,
                List.of(),
                List.of(),
                null,
                null,
                false
            );
            deleteConversationAndMessages(conversation.getId());
            return new GroupActionResult(removed, null);
        }

        if (actorId.equals(conversation.getOwnerId())) {
            throw new ForbiddenOperationException("Owner must transfer ownership before leaving a group with other members");
        }

        List<String> admins = new ArrayList<>(normalizeAdmins(conversation));
        admins.remove(actorId);

        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setAdmins(admins);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        MessagePayload systemMessage = createGroupSystemMessage(
            conversation,
            actorId,
            "[System] " + actorId + " left the group"
        );

        return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
    }

    @Transactional
    public GroupActionResult joinGroupByInviteCode(String actorId, String inviteCode) {
        String normalizedCode = inviteCode == null ? "" : inviteCode.trim();
        if (normalizedCode.isBlank()) {
            throw new IllegalArgumentException("Invite code must not be blank");
        }

        ConversationDocument conversation = groupConversationRepository.findByInviteCode(normalizedCode)
            .orElseThrow(() -> new ResourceNotFoundException("Invite link is invalid or expired"));
        if (!CONVERSATION_TYPE_GROUP.equalsIgnoreCase(normalizeConversationType(conversation.getType()))) {
            throw new ResourceNotFoundException("Invite link is invalid or expired");
        }
        if (conversation.isRequireApprovalToJoin()) {
            throw new ForbiddenOperationException("This group requires admin approval to join");
        }
        if (!conversation.isAllowMemberInvite()) {
            throw new ForbiddenOperationException("Invite link is currently disabled for this group");
        }

        List<String> members = new ArrayList<>(normalizeMembers(conversation));
        if (members.contains(actorId)) {
            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), null);
        }

        if (hasPendingMember(conversation, actorId)) {
            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), null);
        }

        if (conversation.isRequireApprovalToJoin()) {
            addPendingMember(conversation, actorId, actorId);
            conversation.setUpdatedAt(Instant.now());
            groupConversationRepository.save(conversation);

            MessagePayload systemMessage = createGroupSystemMessage(
                conversation,
                actorId,
                "[System] " + actorId + " is waiting for admin approval to join"
            );

            return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
        }

        members.add(actorId);
        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        markAllMessagesAsSeenForUser(conversation.getId(), actorId);
        MessagePayload systemMessage = createGroupSystemMessage(
            conversation,
            actorId,
            "[System] " + actorId + " joined the group via invite link"
        );

        return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
    }

    @Transactional
    public ConversationListItemResponse setGroupAdmin(String actorId, UUID conversationId, String userId, boolean admin) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        if (!actorId.equals(conversation.getOwnerId())) {
            throw new ForbiddenOperationException("Only owner can change admin roles");
        }

        if (!normalizeMembers(conversation).contains(userId)) {
            throw new ForbiddenOperationException("Target user is not member of group");
        }

        List<String> admins = new ArrayList<>(normalizeAdmins(conversation));
        if (admin) {
            if (!admins.contains(userId)) {
                admins.add(userId);
            }
        } else {
            admins.remove(userId);
            if (userId.equals(conversation.getOwnerId())) {
                throw new ForbiddenOperationException("Owner must remain admin");
            }
        }

        if (!admins.contains(conversation.getOwnerId())) {
            admins.add(conversation.getOwnerId());
        }

        conversation.setAdmins(admins);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        return toGroupConversationListItem(conversation, actorId);
    }

    @Transactional
    public GroupActionResult approvePendingGroupMember(String actorId, UUID conversationId, String userId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupAdmin(conversation, actorId);
        String normalizedUserId = userId == null ? "" : userId.trim();
        if (normalizedUserId.isBlank()) {
            throw new IllegalArgumentException("userId must not be blank");
        }

        findPendingMember(conversation, normalizedUserId)
            .orElseThrow(() -> new ResourceNotFoundException("Pending member not found"));

        List<String> members = new ArrayList<>(normalizeMembers(conversation));
        if (!members.contains(normalizedUserId)) {
            members.add(normalizedUserId);
        }

        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setPendingMembers(
            normalizePendingMembers(conversation).stream()
                .filter(item -> !normalizedUserId.equals(item.getUserId()))
                .collect(Collectors.toCollection(ArrayList::new))
        );
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);

        markAllMessagesAsSeenForUser(conversation.getId(), normalizedUserId);
        MessagePayload systemMessage = createGroupSystemMessage(
            conversation,
            actorId,
            "[System] " + normalizedUserId + " joined the group"
        );

        return new GroupActionResult(toGroupConversationListItem(conversation, actorId), systemMessage);
    }

    @Transactional
    public ConversationListItemResponse rejectPendingGroupMember(String actorId, UUID conversationId, String userId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupAdmin(conversation, actorId);
        String normalizedUserId = userId == null ? "" : userId.trim();
        if (normalizedUserId.isBlank()) {
            throw new IllegalArgumentException("userId must not be blank");
        }

        boolean removed = normalizePendingMembers(conversation).stream()
            .anyMatch(item -> normalizedUserId.equals(item.getUserId()));
        if (!removed) {
            throw new ResourceNotFoundException("Pending member not found");
        }

        conversation.setPendingMembers(
            normalizePendingMembers(conversation).stream()
                .filter(item -> !normalizedUserId.equals(item.getUserId()))
                .collect(Collectors.toCollection(ArrayList::new))
        );
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);
        return toGroupConversationListItem(conversation, actorId);
    }

    @Transactional
    public Map<String, Object> getGroupSettings(String actorId, UUID conversationId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        ensureInviteCode(conversation);
        return toGroupSettingsPayload(conversation, actorId);
    }

    @Transactional
    public GroupSettingsUpdateResult updateGroupSettings(
        String actorId,
        UUID conversationId,
        String name,
        String avatar,
        Boolean onlyAdminsCanMessage,
        Boolean requireApprovalToJoin,
        Boolean allowMemberInvite,
        Boolean allowMemberEditGroupInfo,
        Boolean allowMemberPinBoardItems,
        Boolean allowMemberCreateNotes,
        Boolean allowMemberCreateReminders,
        Boolean allowMemberCreatePolls,
        String transferOwnerId
    ) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        ensureInviteCode(conversation);

        boolean isOwner = actorId.equals(conversation.getOwnerId());
        boolean isAdmin = normalizeAdmins(conversation).contains(actorId);
        boolean changed = false;
        MessagePayload systemMessage = null;
        boolean canEditGroupInfo = isOwner || isAdmin || conversation.isAllowMemberEditGroupInfo();

        if (name != null || avatar != null) {
            if (!canEditGroupInfo) {
                throw new ForbiddenOperationException("Only allowed members can update group info");
            }

            if (name != null) {
                String normalizedName = name.trim();
                if (normalizedName.isBlank()) {
                    throw new IllegalArgumentException("Group name must not be blank");
                }
                conversation.setName(normalizedName);
                changed = true;
            }

            if (avatar != null) {
                String normalizedAvatar = avatar.trim();
                conversation.setAvatar(normalizedAvatar.isBlank() ? null : normalizedAvatar);
                changed = true;
            }
        }

        if (onlyAdminsCanMessage != null
            || requireApprovalToJoin != null
            || allowMemberInvite != null
            || allowMemberEditGroupInfo != null
            || allowMemberPinBoardItems != null
            || allowMemberCreateNotes != null
            || allowMemberCreateReminders != null
            || allowMemberCreatePolls != null
            || transferOwnerId != null) {
            if (!isOwner && !isAdmin) {
                throw new ForbiddenOperationException("Only owner or admin can update group settings");
            }

            if (onlyAdminsCanMessage != null) {
                conversation.setOnlyAdminsCanMessage(onlyAdminsCanMessage);
                changed = true;
            }
            if (requireApprovalToJoin != null) {
                boolean previousValue = conversation.isRequireApprovalToJoin();
                conversation.setRequireApprovalToJoin(requireApprovalToJoin);
                changed = true;
                if (previousValue != requireApprovalToJoin) {
                    systemMessage = createGroupSystemMessage(
                        conversation,
                        actorId,
                        requireApprovalToJoin
                            ? "[System] " + actorId + " changed join mode to require approval"
                            : "[System] " + actorId + " turned off join approval"
                    );
                }
            }
            if (allowMemberInvite != null) {
                conversation.setAllowMemberInvite(allowMemberInvite);
                changed = true;
            }
            if (allowMemberEditGroupInfo != null) {
                conversation.setAllowMemberEditGroupInfo(allowMemberEditGroupInfo);
                changed = true;
            }
            if (allowMemberPinBoardItems != null) {
                conversation.setAllowMemberPinBoardItems(allowMemberPinBoardItems);
                changed = true;
            }
            if (allowMemberCreateNotes != null) {
                conversation.setAllowMemberCreateNotes(allowMemberCreateNotes);
                changed = true;
            }
            if (allowMemberCreateReminders != null) {
                conversation.setAllowMemberCreateReminders(allowMemberCreateReminders);
                changed = true;
            }
            if (allowMemberCreatePolls != null) {
                conversation.setAllowMemberCreatePolls(allowMemberCreatePolls);
                changed = true;
            }

            if (transferOwnerId != null) {
                if (!isOwner) {
                    throw new ForbiddenOperationException("Only owner can transfer ownership");
                }
                String normalizedOwnerId = transferOwnerId.trim();
                if (normalizedOwnerId.isBlank()) {
                    throw new IllegalArgumentException("transferOwnerId must not be blank");
                }

                if (!normalizeMembers(conversation).contains(normalizedOwnerId)) {
                    throw new ForbiddenOperationException("New owner must be a group member");
                }

                String previousOwnerId = conversation.getOwnerId();
                conversation.setOwnerId(normalizedOwnerId);
                List<String> admins = new ArrayList<>(normalizeAdmins(conversation));
                admins.remove(previousOwnerId);
                if (!admins.contains(normalizedOwnerId)) {
                    admins.add(normalizedOwnerId);
                }
                conversation.setAdmins(admins);
                changed = true;
            }
        }

        if (changed) {
            conversation.setUpdatedAt(Instant.now());
            groupConversationRepository.save(conversation);
        }

        return new GroupSettingsUpdateResult(toGroupSettingsPayload(conversation, actorId), systemMessage);
    }

    @Transactional
    public Map<String, Object> pinGroupMessage(String actorId, UUID conversationId, String sourceMessageId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);

        if (!canPinBoardItems(conversation, actorId)) {
            throw new ForbiddenOperationException("Only allowed members can pin messages");
        }

        String normalizedMessageId = sourceMessageId == null ? "" : sourceMessageId.trim();
        if (normalizedMessageId.isBlank()) {
            throw new IllegalArgumentException("sourceMessageId must not be blank");
        }

        MessageDocument targetMessage = messageRepository.findByConversationIdAndId(conversation.getId(), normalizedMessageId)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        List<PinnedMessageItem> pinnedMessages = new ArrayList<>(normalizePinnedMessages(conversation));
        boolean alreadyPinned = pinnedMessages.stream()
            .anyMatch(item -> normalizedMessageId.equals(item.getSourceMessageId()));
        if (alreadyPinned) {
            return toGroupSettingsPayload(conversation, actorId);
        }
        if (pinnedMessages.size() >= MAX_PINNED_MESSAGES) {
            throw new ForbiddenOperationException("You can pin up to 3 messages");
        }

        PinnedMessageItem pinnedMessage = new PinnedMessageItem();
        pinnedMessage.setSourceMessageId(normalizedMessageId);
        pinnedMessage.setTitle(buildPinnedMessageTitle(targetMessage));
        pinnedMessage.setPreview(buildPinnedMessagePreview(targetMessage));
        pinnedMessage.setCreatedAt(Instant.now());
        pinnedMessages.add(pinnedMessage);

        conversation.setPinnedMessages(sortPinnedMessagesDescending(pinnedMessages));
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);
        return toGroupSettingsPayload(conversation, actorId);
    }

    @Transactional
    public Map<String, Object> unpinGroupMessage(String actorId, UUID conversationId, String sourceMessageId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);

        if (!canPinBoardItems(conversation, actorId)) {
            throw new ForbiddenOperationException("Only allowed members can pin messages");
        }

        String normalizedMessageId = sourceMessageId == null ? "" : sourceMessageId.trim();
        if (normalizedMessageId.isBlank()) {
            throw new IllegalArgumentException("sourceMessageId must not be blank");
        }

        List<PinnedMessageItem> nextPinnedMessages = normalizePinnedMessages(conversation).stream()
            .filter(item -> !normalizedMessageId.equals(item.getSourceMessageId()))
            .collect(Collectors.toCollection(ArrayList::new));

        conversation.setPinnedMessages(sortPinnedMessagesDescending(nextPinnedMessages));
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);
        return toGroupSettingsPayload(conversation, actorId);
    }

    @Transactional
    public void deleteGroupConversation(String actorId, UUID conversationId) {
        ConversationDocument conversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(conversation, actorId);
        if (!actorId.equals(conversation.getOwnerId())) {
            throw new ForbiddenOperationException("Only owner can delete this group");
        }
        deleteConversationAndMessages(conversation.getId());
    }

    public List<String> listConversationMembers(UUID conversationId) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(conversationId);
        if (privateConversation.isPresent()) {
            ConversationEntity conversation = privateConversation.get();
            return List.of(conversation.getUser1Id(), conversation.getUser2Id());
        }
        return normalizeMembers(findGroupConversation(conversationId.toString()));
    }

    /**
     * Send a new message - atomic PostgreSQL transaction.
     * Note: MongoDB save is not transactional with PostgreSQL.
     * If PostgreSQL fails after MongoDB save, message is orphaned (acceptable tradeoff).
     */
    @Transactional
    public ChatEventResponse sendMessage(String senderId, ChatSendRequest request) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(request.conversationId());
        if (privateConversation.isPresent()) {
            return sendPrivateMessage(senderId, request, privateConversation.get());
        }

        ConversationDocument groupConversation = findGroupConversation(request.conversationId().toString());
        return sendGroupMessage(senderId, request, groupConversation);
    }

    public ChatEventResponse recallMessage(String senderId, ChatRecallRequest request) {
        ensureConversationMember(request.conversationId(), senderId);

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
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(request.conversationId());
        if (privateConversation.isPresent()) {
            ensureMember(privateConversation.get(), senderId);
        } else {
            ensureGroupMember(findGroupConversation(request.conversationId().toString()), senderId);
        }

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

        privateConversation.ifPresent(conversation -> {
            conversation.setLastMessage(nextContent);
            conversation.setLastMessageAt(Instant.now());
            conversation.setUpdatedAt(Instant.now());
            conversationRepository.save(conversation);
        });

        if (privateConversation.isEmpty()) {
            ConversationDocument groupConversation = findGroupConversation(request.conversationId().toString());
            groupConversation.setLastMessage(nextContent);
            groupConversation.setLastMessageAt(Instant.now().toString());
            groupConversation.setUpdatedAt(Instant.now());
            groupConversationRepository.save(groupConversation);
        }

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
        ensureConversationMember(request.conversationId(), senderId);

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
        ensureConversationMember(request.conversationId(), userId);

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
        ensureConversationMember(request.sourceConversationId(), senderId);
        ensureConversationMember(request.targetConversationId(), senderId);

        Optional<ConversationEntity> targetPrivateConversation = conversationRepository.findOptionalById(request.targetConversationId());
        ConversationDocument targetGroupConversation = targetPrivateConversation
            .isEmpty() ? findGroupConversation(request.targetConversationId().toString()) : null;

        MessageDocument original = messageRepository.findByConversationIdAndId(request.sourceConversationId().toString(), request.messageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        MessageDocument forwarded = new MessageDocument();
        forwarded.setConversationId(request.targetConversationId().toString());
        forwarded.setId(generateMessageId());
        forwarded.setSenderId(senderId);
        forwarded.setReceiverId(targetPrivateConversation
            .map(target -> resolvePeerUserId(target, senderId))
            .orElse(null));
        forwarded.setType("FORWARD");
        forwarded.setContent(original.getContent());
        forwarded.setParentMessageId(original.getId());
        forwarded.setFileUrl(original.getFileUrl());
        forwarded.setFileName(original.getFileName());
        forwarded.setReactions(Collections.emptyList());
        forwarded.setReactionEntries(Collections.emptyList());
        forwarded.setCreatedAt(Instant.now().toString());
        forwarded.setUpdatedAt(Instant.now().toString());
        forwarded.setRecalled(false);
        forwarded.setEdited(false);
        forwarded.setSeenBy(new HashSet<>(Set.of(senderId)));
        Set<String> deliveredTo = new HashSet<>(Set.of(senderId));
        if (forwarded.getReceiverId() != null) {
            if (onlineUserChecker.isOnline(forwarded.getReceiverId())) {
                deliveredTo.add(forwarded.getReceiverId());
            }
        } else {
            for (String memberId : normalizeMembers(targetGroupConversation)) {
                if (!memberId.equals(senderId) && onlineUserChecker.isOnline(memberId)) {
                    deliveredTo.add(memberId);
                }
            }
        }
        forwarded.setDeliveredTo(deliveredTo);
        messageRepository.save(forwarded);

        targetPrivateConversation.ifPresent(target -> {
            target.setLastMessage(forwarded.getContent());
            target.setLastMessageAt(Instant.now());
            target.setUpdatedAt(Instant.now());
            target.incrementUnread(forwarded.getReceiverId());
            target.markRead(senderId, Instant.now(), forwarded.getId());
            conversationRepository.save(target);
        });

        if (targetGroupConversation != null) {
            targetGroupConversation.setLastMessage(forwarded.getContent());
            targetGroupConversation.setLastMessageAt(Instant.now().toString());
            targetGroupConversation.setUpdatedAt(Instant.now());
            groupConversationRepository.save(targetGroupConversation);
        }

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
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(request.conversationId());
        if (privateConversation.isPresent()) {
            ensureMember(privateConversation.get(), userId);
        } else {
            ensureGroupMember(findGroupConversation(request.conversationId().toString()), userId);
        }

        Optional<MessageDocument> item = markMessagesAsSeenUpTo(userId, request.conversationId(), request.messageId());

        if (item.isPresent() && privateConversation.isPresent()) {
            ConversationEntity conversation = privateConversation.get();
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
        ensureConversationMember(request.conversationId(), userId);

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

        List<MessageDocument.ReactionEntry> reactionEntries = reactions.stream()
            .map(value -> {
                String[] parts = value.split("\\|", 2);
                String reactionUserId = parts[0];
                String reactionEmoji = parts.length > 1 ? parts[1] : "";
                return new MessageDocument.ReactionEntry(reactionUserId, reactionEmoji);
            })
            .toList();

        item.setReactions(reactions);
        item.setReactionEntries(reactionEntries);
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
        ensureConversationMember(conversationId, userId);

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
        List<ConversationEntity> privateEntities = conversationRepository.findByParticipant(userId);
        List<ConversationDocument> groupConversations = groupConversationRepository.findByMemberOrParticipant(userId).stream()
            .filter(conversation -> CONVERSATION_TYPE_GROUP.equalsIgnoreCase(normalizeConversationType(conversation.getType())))
            .toList();

        // Batch-fetch peer presence to avoid N+1 Redis calls
        Set<String> peerIds = new LinkedHashSet<>();

        privateEntities.stream()
            .map(e -> e.getUser1Id().equals(userId) ? e.getUser2Id() : e.getUser1Id())
            .distinct()
            .forEach(peerIds::add);

        groupConversations.stream()
            .flatMap(conversation -> normalizeMembers(conversation).stream())
            .filter(memberId -> !memberId.equals(userId))
            .forEach(peerIds::add);

        Map<String, RedisOnlineUserChecker.PresenceStatus> presenceMap =
            peerIds.isEmpty() ? Map.of() : onlineUserChecker.getPresence(new ArrayList<>(peerIds));

        List<ConversationListItemResponse> items = new ArrayList<>();
        for (ConversationEntity entity : privateEntities) {
            String peerUserId = entity.getUser1Id().equals(userId) ? entity.getUser2Id() : entity.getUser1Id();
            boolean online = Optional.ofNullable(presenceMap.get(peerUserId))
                .map(RedisOnlineUserChecker.PresenceStatus::online)
                .orElse(false);
            items.add(new ConversationListItemResponse(
                entity.getId().toString(),
                CONVERSATION_TYPE_PRIVATE,
                peerUserId,
                null,
                entity.getLastMessage() == null ? "" : entity.getLastMessage(),
                entity.getLastMessageAt(),
                entity.unreadCountOf(userId),
                entity.getUser1Id().equals(userId) ? entity.getUser1LastReadAt() : entity.getUser2LastReadAt(),
                entity.lastReadMessageIdOf(userId),
                List.of(entity.getUser1Id(), entity.getUser2Id()),
                List.of(),
                null,
                peerUserId,
                online
            ));
        }

        for (ConversationDocument conversation : groupConversations) {
            List<String> members = normalizeMembers(conversation);
            List<String> admins = normalizeAdmins(conversation);
            String ownerId = conversation.getOwnerId();
            Instant lastMessageAt = parseInstant(conversation.getLastMessageAt())
                .orElse(conversation.getUpdatedAt());
            String lastMessage = Optional.ofNullable(conversation.getLastMessage())
                .filter(value -> !value.isBlank())
                .orElse("");

            boolean anyMemberOnline = members.stream()
                .filter(memberId -> !memberId.equals(userId))
                .anyMatch(memberId -> Optional.ofNullable(presenceMap.get(memberId))
                    .map(RedisOnlineUserChecker.PresenceStatus::online)
                    .orElse(false));

            items.add(new ConversationListItemResponse(
                conversation.getId(),
                CONVERSATION_TYPE_GROUP,
                Optional.ofNullable(conversation.getName()).filter(value -> !value.isBlank()).orElse("Group"),
                conversation.getAvatar(),
                lastMessage,
                lastMessageAt,
                countGroupUnread(userId, conversation.getId()),
                null,
                null,
                members,
                admins,
                ownerId,
                ownerId,
                anyMemberOnline
            ));
        }

        items.sort(Comparator
            .comparing(ConversationListItemResponse::lastMessageAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(ConversationListItemResponse::id, Comparator.nullsLast(String::compareTo)));

        return items;
    }

    public ConversationListItemResponse getConversationListItem(String userId, UUID conversationId) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(conversationId);
        if (privateConversation.isPresent()) {
            ConversationEntity entity = privateConversation.get();
            ensureMember(entity, userId);
            String peerUserId = entity.getUser1Id().equals(userId) ? entity.getUser2Id() : entity.getUser1Id();
            boolean online = onlineUserChecker.isOnline(peerUserId);
            return new ConversationListItemResponse(
                entity.getId().toString(),
                CONVERSATION_TYPE_PRIVATE,
                peerUserId,
                null,
                entity.getLastMessage() == null ? "" : entity.getLastMessage(),
                entity.getLastMessageAt(),
                entity.unreadCountOf(userId),
                entity.getUser1Id().equals(userId) ? entity.getUser1LastReadAt() : entity.getUser2LastReadAt(),
                entity.lastReadMessageIdOf(userId),
                List.of(entity.getUser1Id(), entity.getUser2Id()),
                List.of(),
                null,
                peerUserId,
                online
            );
        }

        ConversationDocument groupConversation = findGroupConversation(conversationId.toString());
        ensureGroupMember(groupConversation, userId);
        return toGroupConversationListItem(groupConversation, userId);
    }

    @Transactional
    public ChatEventResponse markConversationAsRead(String userId, UUID conversationId, String explicitMessageId) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(conversationId);
        ConversationDocument groupConversation = null;

        if (privateConversation.isPresent()) {
            ensureMember(privateConversation.get(), userId);
        } else {
            groupConversation = findGroupConversation(conversationId.toString());
            ensureGroupMember(groupConversation, userId);
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

        if (messageId != null && !messageId.isBlank() && privateConversation.isPresent()) {
            ConversationEntity conversation = privateConversation.get();
            conversation.markRead(userId, Instant.now(), messageId);
            conversationRepository.save(conversation);
        }

        String lastMessage = privateConversation
            .map(ConversationEntity::getLastMessage)
            .orElse(groupConversation == null ? null : groupConversation.getLastMessage());

        String lastMessageAt = privateConversation
            .map(ConversationEntity::getLastMessageAt)
            .map(Instant::toString)
            .orElse(groupConversation == null ? null : groupConversation.getLastMessageAt());

        int unreadCount = privateConversation
            .map(conversation -> conversation.unreadCountOf(userId))
            .orElseGet(() -> countGroupUnread(userId, conversationId.toString()));

        return new ChatEventResponse(
            "READ_RECEIPT",
            userId,
            conversationId.toString(),
            false,
            false,
            null,
            readMessagePayload,
            unreadCount,
            totalUnreadCount(userId),
            lastMessage,
            lastMessageAt
        );
    }

    public int totalUnreadCount(String userId) {
        int privateUnread = conversationRepository.sumUnreadByParticipant(userId);
        int groupUnread = groupConversationRepository.findByMemberOrParticipant(userId).stream()
            .filter(conversation -> CONVERSATION_TYPE_GROUP.equalsIgnoreCase(normalizeConversationType(conversation.getType())))
            .mapToInt(conversation -> countGroupUnread(userId, conversation.getId()))
            .sum();
        return privateUnread + groupUnread;
    }

    public ChatEventResponse buildConversationUpdatedEvent(String userId, UUID conversationId, String eventType, MessagePayload message) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(conversationId);
        ConversationDocument groupConversation = null;
        if (privateConversation.isPresent()) {
            ensureMember(privateConversation.get(), userId);
        } else {
            groupConversation = findGroupConversation(conversationId.toString());
            ensureGroupMember(groupConversation, userId);
        }

        String lastMessage = privateConversation
            .map(ConversationEntity::getLastMessage)
            .orElse(groupConversation == null ? null : groupConversation.getLastMessage());
        String lastMessageAt = privateConversation
            .map(ConversationEntity::getLastMessageAt)
            .map(Instant::toString)
            .orElse(groupConversation == null ? null : groupConversation.getLastMessageAt());
        int unreadCount = privateConversation
            .map(conversation -> conversation.unreadCountOf(userId))
            .orElseGet(() -> countGroupUnread(userId, conversationId.toString()));

        return new ChatEventResponse(
            eventType,
            userId,
            conversationId.toString(),
            false,
            false,
            null,
            message,
            unreadCount,
            totalUnreadCount(userId),
            lastMessage,
            lastMessageAt
        );
    }

    public MessageItemResponse sendMessageHttp(
        String senderId,
        UUID conversationId,
        String type,
        String content,
        String fileUrl,
        String fileName,
        String parentMessageId
    ) {
        String normalizedType = (type == null || type.isBlank()) ? "TEXT" : type.trim().toUpperCase();
        ChatEventResponse event = sendMessage(senderId, new ChatSendRequest(conversationId, normalizedType, content, fileUrl, fileName, parentMessageId));
        MessagePayload message = event.message();
        return new MessageItemResponse(
            message.messageId(),
            message.conversationId(),
            message.senderId(),
            message.receiverId(),
            message.type(),
            message.content(),
            message.parentMessageId(),
            message.fileUrl(),
            message.fileName(),
            message.reactions(),
            message.reactionEntries(),
            message.recalled(),
            message.deletedForUsers(),
            message.deliveredTo(),
            message.seenBy(),
            message.createdAt(),
            message.updatedAt(),
            message.edited()
        );
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
            .map(message -> new MessageItemResponse(
                message.messageId(),
                message.conversationId(),
                message.senderId(),
                message.receiverId(),
                message.type(),
                message.content(),
                message.parentMessageId(),
                message.fileUrl(),
                message.fileName(),
                message.reactions(),
                message.reactionEntries(),
                message.recalled(),
                message.deletedForUsers(),
                message.deliveredTo(),
                message.seenBy(),
                message.createdAt(),
                message.updatedAt(),
                message.edited()
            ))
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

    private void ensureConversationMember(UUID conversationId, String userId) {
        Optional<ConversationEntity> privateConversation = conversationRepository.findOptionalById(conversationId);
        if (privateConversation.isPresent()) {
            ensureMember(privateConversation.get(), userId);
            return;
        }
        ensureGroupMember(findGroupConversation(conversationId.toString()), userId);
    }

    private void ensureMember(ConversationEntity conversation, String userId) {
        if (!conversationRepository.isMember(conversation, userId)) {
            throw new ForbiddenOperationException("User is not member of conversation");
        }
    }

    private void ensureGroupMember(ConversationDocument conversation, String userId) {
        if (!normalizeMembers(conversation).contains(userId)) {
            throw new ForbiddenOperationException("User is not member of conversation");
        }
    }

    private void ensureGroupAdmin(ConversationDocument conversation, String userId) {
        boolean isOwner = userId.equals(conversation.getOwnerId());
        boolean isAdmin = normalizeAdmins(conversation).contains(userId);
        if (!isOwner && !isAdmin) {
            throw new ForbiddenOperationException("Only group admin can perform this action");
        }
    }

    private ConversationDocument findGroupConversation(String conversationId) {
        return groupConversationRepository.findById(conversationId)
            .filter(conversation -> CONVERSATION_TYPE_GROUP.equalsIgnoreCase(normalizeConversationType(conversation.getType())))
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
    }

    private List<String> normalizeMembers(ConversationDocument conversation) {
        LinkedHashSet<String> members = new LinkedHashSet<>();
        if (conversation.getMembers() != null) {
            members.addAll(conversation.getMembers());
        }
        if (conversation.getParticipants() != null) {
            members.addAll(conversation.getParticipants());
        }
        if (conversation.getOwnerId() != null && !conversation.getOwnerId().isBlank()) {
            members.add(conversation.getOwnerId());
        }
        return members.stream()
            .filter(memberId -> memberId != null && !memberId.isBlank())
            .map(String::trim)
            .toList();
    }

    private List<PendingGroupMemberItem> normalizePendingMembers(ConversationDocument conversation) {
        Set<String> memberIds = new LinkedHashSet<>(normalizeMembers(conversation));
        LinkedHashMap<String, PendingGroupMemberItem> pendingByUserId = new LinkedHashMap<>();
        for (PendingGroupMemberItem item : conversation.getPendingMembers()) {
            if (item == null || item.getUserId() == null || item.getUserId().isBlank()) {
                continue;
            }
            String userId = item.getUserId().trim();
            if (memberIds.contains(userId)) {
                continue;
            }
            PendingGroupMemberItem normalized = new PendingGroupMemberItem();
            normalized.setUserId(userId);
            normalized.setRequestedByUserId(
                item.getRequestedByUserId() == null || item.getRequestedByUserId().isBlank()
                    ? userId
                    : item.getRequestedByUserId().trim()
            );
            normalized.setRequestedAt(item.getRequestedAt());
            pendingByUserId.putIfAbsent(userId, normalized);
        }
        return new ArrayList<>(pendingByUserId.values());
    }

    private Optional<PendingGroupMemberItem> findPendingMember(ConversationDocument conversation, String userId) {
        return normalizePendingMembers(conversation).stream()
            .filter(item -> userId.equals(item.getUserId()))
            .findFirst();
    }

    private boolean hasPendingMember(ConversationDocument conversation, String userId) {
        return findPendingMember(conversation, userId).isPresent();
    }

    private void addPendingMember(ConversationDocument conversation, String userId, String requestedByUserId) {
        List<PendingGroupMemberItem> pendingMembers = new ArrayList<>(normalizePendingMembers(conversation));
        PendingGroupMemberItem pendingMember = new PendingGroupMemberItem();
        pendingMember.setUserId(userId);
        pendingMember.setRequestedByUserId(
            requestedByUserId == null || requestedByUserId.isBlank() ? userId : requestedByUserId.trim()
        );
        pendingMember.setRequestedAt(Instant.now());
        pendingMembers.add(pendingMember);
        conversation.setPendingMembers(pendingMembers);
    }

    private List<String> normalizeAdmins(ConversationDocument conversation) {
        LinkedHashSet<String> admins = new LinkedHashSet<>();
        if (conversation.getAdmins() != null) {
            admins.addAll(conversation.getAdmins());
        }
        if (conversation.getOwnerId() != null && !conversation.getOwnerId().isBlank()) {
            admins.add(conversation.getOwnerId());
        }
        return admins.stream()
            .filter(adminId -> adminId != null && !adminId.isBlank())
            .map(String::trim)
            .toList();
    }

    private String normalizeConversationType(String type) {
        if (type == null || type.isBlank()) {
            return CONVERSATION_TYPE_PRIVATE;
        }
        return type.trim().toLowerCase();
    }

    private int countGroupUnread(String userId, String conversationId) {
        int unread = 0;
        for (MessageDocument message : messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)) {
            if (userId.equals(message.getSenderId())) {
                continue;
            }
            if (message.getDeletedForUsers() != null && message.getDeletedForUsers().contains(userId)) {
                continue;
            }
            if (message.getSeenBy() != null && message.getSeenBy().contains(userId)) {
                continue;
            }
            unread += 1;
        }
        return unread;
    }

    private Optional<Instant> parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Instant.parse(raw));
        } catch (Exception ex) {
            return Optional.empty();
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
            item.getParentMessageId(),
            item.getFileUrl(),
            item.getFileName(),
            item.getReactions(),
            toReactionPayloads(item.getReactionEntries(), item.getReactions()),
            item.getDeletedForUsers(),
            item.getDeliveredTo(),
            item.getSeenBy(),
            item.getCreatedAt(),
            item.getUpdatedAt(),
            item.isRecalled(),
            item.isEdited()
        );
    }

    private List<MessageReactionPayload> toReactionPayloads(List<MessageDocument.ReactionEntry> reactionEntries, List<String> reactions) {
        if (reactionEntries != null && !reactionEntries.isEmpty()) {
            return reactionEntries.stream()
                .map(reaction -> new MessageReactionPayload(reaction.getUserId(), reaction.getEmoji()))
                .toList();
        }

        if (reactions == null || reactions.isEmpty()) {
            return List.of();
        }

        return reactions.stream()
            .map(value -> {
                String[] parts = value.split("\\|", 2);
                String reactionUserId = parts[0];
                String reactionEmoji = parts.length > 1 ? parts[1] : "";
                return new MessageReactionPayload(reactionUserId, reactionEmoji);
            })
            .toList();
    }

    private ChatEventResponse sendPrivateMessage(String senderId, ChatSendRequest request, ConversationEntity conversation) {
        ensureMember(conversation, senderId);
        String normalizedType = (request.type() == null || request.type().isBlank()) ? "TEXT" : request.type().trim().toUpperCase();
        String normalizedContent = request.content() == null ? "" : request.content().trim();
        if (normalizedContent.isBlank()) {
            throw new ForbiddenOperationException("Message content must not be blank");
        }
        String receiverId = resolvePeerUserId(conversation, senderId);
        Instant now = Instant.now();

        MessageDocument item = new MessageDocument();
        item.setConversationId(request.conversationId().toString());
        item.setId(generateMessageId());
        item.setSenderId(senderId);
        item.setReceiverId(receiverId);
        item.setType(normalizedType);
        item.setContent(normalizedContent);
        item.setParentMessageId(request.parentMessageId());
        item.setFileUrl(request.fileUrl());
        item.setFileName(request.fileName());
        item.setReactions(Collections.emptyList());
        item.setReactionEntries(Collections.emptyList());
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

    private ChatEventResponse sendGroupMessage(String senderId, ChatSendRequest request, ConversationDocument conversation) {
        ensureGroupMember(conversation, senderId);
        String normalizedType = (request.type() == null || request.type().isBlank()) ? "TEXT" : request.type().trim().toUpperCase();
        String normalizedContent = request.content() == null ? "" : request.content().trim();
        if (normalizedContent.isBlank()) {
            throw new ForbiddenOperationException("Message content must not be blank");
        }
        boolean isOwner = senderId.equals(conversation.getOwnerId());
        boolean isAdmin = normalizeAdmins(conversation).contains(senderId);

        switch (normalizedType) {
            case "NOTE" -> {
                if (!canCreateGroupNotes(conversation, senderId)) {
                    throw new ForbiddenOperationException("You are not allowed to create notes in this group");
                }
            }
            case "REMINDER" -> {
                if (!canCreateGroupReminders(conversation, senderId)) {
                    throw new ForbiddenOperationException("You are not allowed to create reminders in this group");
                }
            }
            case "POLL" -> {
                if (!canCreateGroupPolls(conversation, senderId)) {
                    throw new ForbiddenOperationException("You are not allowed to create polls in this group");
                }
            }
            default -> {
                if (conversation.isOnlyAdminsCanMessage() && !isOwner && !isAdmin) {
                    throw new ForbiddenOperationException("Only admins can send messages in this group");
                }
            }
        }
        Instant now = Instant.now();

        MessageDocument item = new MessageDocument();
        item.setConversationId(request.conversationId().toString());
        item.setId(generateMessageId());
        item.setSenderId(senderId);
        item.setReceiverId(null);
        item.setType(normalizedType);
        item.setContent(normalizedContent);
        item.setParentMessageId(request.parentMessageId());
        item.setFileUrl(request.fileUrl());
        item.setFileName(request.fileName());
        item.setReactions(Collections.emptyList());
        item.setReactionEntries(Collections.emptyList());
        item.setCreatedAt(now.toString());
        item.setUpdatedAt(now.toString());
        item.setRecalled(false);
        item.setEdited(false);
        item.setSeenBy(new HashSet<>(Set.of(senderId)));

        Set<String> deliveredTo = new HashSet<>(Set.of(senderId));
        for (String memberId : normalizeMembers(conversation)) {
            if (!memberId.equals(senderId) && onlineUserChecker.isOnline(memberId)) {
                deliveredTo.add(memberId);
            }
        }
        item.setDeliveredTo(deliveredTo);
        messageRepository.save(item);

        conversation.setLastMessage(item.getContent());
        conversation.setLastMessageAt(now.toString());
        conversation.setUpdatedAt(now);
        groupConversationRepository.save(conversation);

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

    private String resolvePeerUserId(ConversationEntity conversation, String senderId) {
        if (senderId.equals(conversation.getUser1Id())) {
            return conversation.getUser2Id();
        }
        return conversation.getUser1Id();
    }

    private ConversationResponse toConversationResponse(ConversationEntity entity, String requesterId) {
        String peerUserId = entity.getUser1Id().equals(requesterId) ? entity.getUser2Id() : entity.getUser1Id();
        return new ConversationResponse(
            entity.getId(),
            CONVERSATION_TYPE_PRIVATE,
            peerUserId,
            null,
            entity.getUser1Id(),
            entity.getUser2Id(),
            List.of(entity.getUser1Id(), entity.getUser2Id()),
            List.of(),
            null,
            entity.getLastMessage(),
            entity.getLastMessageAt(),
            entity.unreadCountOf(requesterId),
            entity.getUser1Id().equals(requesterId) ? entity.getUser1LastReadAt() : entity.getUser2LastReadAt(),
            entity.lastReadMessageIdOf(requesterId),
            entity.getUpdatedAt()
        );
    }

    private ConversationResponse toGroupConversationResponse(ConversationDocument conversation, String requesterId) {
        String conversationId = conversation.getId();
        return new ConversationResponse(
            UUID.fromString(conversationId),
            CONVERSATION_TYPE_GROUP,
            Optional.ofNullable(conversation.getName()).filter(value -> !value.isBlank()).orElse("Group"),
            conversation.getAvatar(),
            null,
            null,
            normalizeMembers(conversation),
            normalizeAdmins(conversation),
            conversation.getOwnerId(),
            conversation.getLastMessage(),
            parseInstant(conversation.getLastMessageAt()).orElse(conversation.getUpdatedAt()),
            countGroupUnread(requesterId, conversationId),
            null,
            null,
            conversation.getUpdatedAt()
        );
    }

    private ConversationListItemResponse toGroupConversationListItem(ConversationDocument conversation, String requesterId) {
        return new ConversationListItemResponse(
            conversation.getId(),
            CONVERSATION_TYPE_GROUP,
            Optional.ofNullable(conversation.getName()).filter(value -> !value.isBlank()).orElse("Group"),
            conversation.getAvatar(),
            Optional.ofNullable(conversation.getLastMessage()).orElse(""),
            parseInstant(conversation.getLastMessageAt()).orElse(conversation.getUpdatedAt()),
            countGroupUnread(requesterId, conversation.getId()),
            null,
            null,
            normalizeMembers(conversation),
            normalizeAdmins(conversation),
            conversation.getOwnerId(),
            conversation.getOwnerId(),
            false
        );
    }

    private Map<String, Object> toGroupSettingsPayload(ConversationDocument conversation, String requesterId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("conversationId", conversation.getId());
        payload.put("name", Optional.ofNullable(conversation.getName()).filter(value -> !value.isBlank()).orElse("Group"));
        payload.put("avatar", conversation.getAvatar());
        payload.put("ownerId", conversation.getOwnerId());
        payload.put("admins", normalizeAdmins(conversation));
        payload.put("participants", normalizeMembers(conversation));
        payload.put("onlyAdminsCanMessage", conversation.isOnlyAdminsCanMessage());
        payload.put("requireApprovalToJoin", conversation.isRequireApprovalToJoin());
        payload.put("allowMemberInvite", conversation.isAllowMemberInvite());
        payload.put("allowMemberEditGroupInfo", conversation.isAllowMemberEditGroupInfo());
        payload.put("allowMemberPinBoardItems", conversation.isAllowMemberPinBoardItems());
        payload.put("allowMemberCreateNotes", conversation.isAllowMemberCreateNotes());
        payload.put("allowMemberCreateReminders", conversation.isAllowMemberCreateReminders());
        payload.put("allowMemberCreatePolls", conversation.isAllowMemberCreatePolls());
        payload.put(
            "pendingParticipants",
            normalizePendingMembers(conversation).stream()
                .map(item -> {
                    Map<String, Object> pendingPayload = new LinkedHashMap<>();
                    pendingPayload.put("userId", item.getUserId());
                    pendingPayload.put("requestedByUserId", item.getRequestedByUserId());
                    pendingPayload.put(
                        "requestedAt",
                        item.getRequestedAt() == null ? null : item.getRequestedAt().toString()
                    );
                    return pendingPayload;
                })
                .collect(Collectors.toList())
        );
        payload.put(
            "pinnedMessages",
            normalizePinnedMessages(conversation).stream()
                .map(item -> Map.of(
                    "sourceMessageId", Optional.ofNullable(item.getSourceMessageId()).orElse(""),
                    "title", Optional.ofNullable(item.getTitle()).orElse("Pinned message"),
                    "preview", Optional.ofNullable(item.getPreview()).orElse(""),
                    "createdAtMs", Optional.ofNullable(item.getCreatedAt()).map(Instant::toEpochMilli).orElse(0L)
                ))
                .collect(Collectors.toList())
        );
        payload.put("inviteCode", Optional.ofNullable(conversation.getInviteCode()).orElse(""));
        payload.put("isOwner", requesterId.equals(conversation.getOwnerId()));
        payload.put("isAdmin", normalizeAdmins(conversation).contains(requesterId));
        return payload;
    }

    private boolean canPinBoardItems(ConversationDocument conversation, String actorId) {
        return actorId.equals(conversation.getOwnerId())
            || normalizeAdmins(conversation).contains(actorId)
            || conversation.isAllowMemberPinBoardItems();
    }

    private boolean canCreateGroupNotes(ConversationDocument conversation, String actorId) {
        return actorId.equals(conversation.getOwnerId())
            || normalizeAdmins(conversation).contains(actorId)
            || conversation.isAllowMemberCreateNotes();
    }

    private boolean canCreateGroupReminders(ConversationDocument conversation, String actorId) {
        return actorId.equals(conversation.getOwnerId())
            || normalizeAdmins(conversation).contains(actorId)
            || conversation.isAllowMemberCreateReminders();
    }

    private boolean canCreateGroupPolls(ConversationDocument conversation, String actorId) {
        return actorId.equals(conversation.getOwnerId())
            || normalizeAdmins(conversation).contains(actorId)
            || conversation.isAllowMemberCreatePolls();
    }

    private List<PinnedMessageItem> normalizePinnedMessages(ConversationDocument conversation) {
        return sortPinnedMessagesDescending(
            conversation.getPinnedMessages().stream()
                .filter(item -> item != null && item.getSourceMessageId() != null && !item.getSourceMessageId().isBlank())
                .collect(Collectors.toCollection(ArrayList::new))
        );
    }

    private List<PinnedMessageItem> sortPinnedMessagesDescending(List<PinnedMessageItem> pinnedMessages) {
        pinnedMessages.sort(Comparator.comparing(
            (PinnedMessageItem item) -> Optional.ofNullable(item.getCreatedAt()).orElse(Instant.EPOCH)
        ).reversed());
        return pinnedMessages;
    }

    private String buildPinnedMessageTitle(MessageDocument message) {
        String type = Optional.ofNullable(message.getType()).orElse("TEXT").trim().toUpperCase();
        return switch (type) {
            case "POLL" -> "Pinned poll";
            case "NOTE" -> "Pinned note";
            case "REMINDER" -> "Pinned reminder";
            case "IMAGE" -> "Pinned image";
            case "VIDEO" -> "Pinned video";
            case "FILE" -> "Pinned file";
            default -> "Pinned message";
        };
    }

    private String buildPinnedMessagePreview(MessageDocument message) {
        String content = Optional.ofNullable(message.getContent()).orElse("").trim().replaceAll("\\s+", " ");
        if (!content.isBlank()) {
            return content.length() > 140 ? content.substring(0, 140) : content;
        }
        if (message.getFileName() != null && !message.getFileName().isBlank()) {
            return message.getFileName().trim();
        }
        return "";
    }

    private String ensureInviteCode(ConversationDocument conversation) {
        String inviteCode = conversation.getInviteCode();
        if (inviteCode != null && !inviteCode.isBlank()) {
            return inviteCode;
        }

        String generated = generateUniqueInviteCode();
        conversation.setInviteCode(generated);
        conversation.setUpdatedAt(Instant.now());
        groupConversationRepository.save(conversation);
        return generated;
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
            String candidate = randomInviteCode();
            if (groupConversationRepository.findByInviteCode(candidate).isEmpty()) {
                return candidate;
            }
        }

        return UUID.randomUUID().toString().replace("-", "").substring(0, INVITE_CODE_LENGTH).toUpperCase();
    }

    private String randomInviteCode() {
        StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
        for (int index = 0; index < INVITE_CODE_LENGTH; index += 1) {
            int charIndex = INVITE_CODE_RANDOM.nextInt(INVITE_CODE_CHARS.length);
            builder.append(INVITE_CODE_CHARS[charIndex]);
        }
        return builder.toString();
    }

    private void markAllMessagesAsSeenForUser(String conversationId, String userId) {
        List<MessageDocument> items = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        if (items.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (MessageDocument item : items) {
            Set<String> deliveredTo = item.getDeliveredTo() == null ? new HashSet<>() : new HashSet<>(item.getDeliveredTo());
            Set<String> seenBy = item.getSeenBy() == null ? new HashSet<>() : new HashSet<>(item.getSeenBy());
            boolean changed = false;

            if (deliveredTo.add(userId)) {
                item.setDeliveredTo(deliveredTo);
                changed = true;
            }
            if (seenBy.add(userId)) {
                item.setSeenBy(seenBy);
                changed = true;
            }

            if (changed) {
                item.setUpdatedAt(now.toString());
                messageRepository.save(item);
            }
        }
    }

    private MessagePayload createGroupSystemMessage(ConversationDocument conversation, String actorId, String content) {
        Instant now = Instant.now();

        MessageDocument item = new MessageDocument();
        item.setConversationId(conversation.getId());
        item.setId(generateMessageId());
        item.setSenderId(actorId);
        item.setReceiverId(null);
        item.setType("SYSTEM");
        item.setContent(content);
        item.setParentMessageId(null);
        item.setFileUrl(null);
        item.setFileName(null);
        item.setReactions(Collections.emptyList());
        item.setReactionEntries(Collections.emptyList());
        item.setCreatedAt(now.toString());
        item.setUpdatedAt(now.toString());
        item.setRecalled(false);
        item.setEdited(false);
        item.setSeenBy(new HashSet<>(Set.of(actorId)));

        Set<String> deliveredTo = new HashSet<>(Set.of(actorId));
        for (String memberId : normalizeMembers(conversation)) {
            if (onlineUserChecker.isOnline(memberId)) {
                deliveredTo.add(memberId);
            }
        }
        item.setDeliveredTo(deliveredTo);
        messageRepository.save(item);

        conversation.setLastMessage(content);
        conversation.setLastMessageAt(now.toString());
        conversation.setUpdatedAt(now);
        groupConversationRepository.save(conversation);

        return toMessagePayload(item);
    }

    private void deleteConversationAndMessages(String conversationId) {
        groupConversationRepository.deleteById(conversationId);
        for (MessageDocument message : messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)) {
            messageRepository.delete(message);
        }
    }

    private Optional<String> newestMessageId(UUID conversationId) {
        List<MessageDocument> items = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId.toString());
        if (items.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(items.get(items.size() - 1).getId());
    }

    private Optional<MessageDocument> markMessagesAsSeenUpTo(String userId, UUID conversationId, String messageId) {
        if (messageId == null || messageId.isBlank()) {
            return Optional.empty();
        }

        List<MessageDocument> items = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId.toString());
        if (items.isEmpty()) {
            return Optional.empty();
        }

        int targetIndex = -1;
        for (int index = 0; index < items.size(); index += 1) {
            if (messageId.equals(items.get(index).getId())) {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex < 0) {
            return Optional.empty();
        }

        Instant now = Instant.now();
        MessageDocument target = null;

        for (int index = 0; index <= targetIndex; index += 1) {
            MessageDocument item = items.get(index);
            Set<String> deliveredTo = item.getDeliveredTo() == null ? new HashSet<>() : new HashSet<>(item.getDeliveredTo());
            deliveredTo.add(userId);
            item.setDeliveredTo(deliveredTo);

            Set<String> readBy = item.getSeenBy() == null ? new HashSet<>() : new HashSet<>(item.getSeenBy());
            readBy.add(userId);
            item.setSeenBy(readBy);
            item.setUpdatedAt(now.toString());
            messageRepository.save(item);

            if (messageId.equals(item.getId())) {
                target = item;
            }
        }

        return Optional.ofNullable(target);
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
