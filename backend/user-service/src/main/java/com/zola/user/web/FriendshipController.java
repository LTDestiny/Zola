package com.zola.user.web;

import com.zola.common.response.ApiResponse;
import com.zola.user.entity.FriendshipEntity;
import com.zola.user.entity.MessageBlockEntity;
import com.zola.user.repository.FriendshipRepository;
import com.zola.user.repository.MessageBlockRepository;
import com.zola.user.service.FriendEventPublisher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/friendships")
public class FriendshipController {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_ACCEPTED = "ACCEPTED";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String STATUS_DECLINED = "DECLINED";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String STATUS_BLOCKED = "BLOCKED";
    private static final String RELATIONSHIP_NONE = "NONE";
    private static final String RELATIONSHIP_FRIENDS = "FRIENDS";
    private static final String RELATIONSHIP_OUTGOING_PENDING = "OUTGOING_PENDING";
    private static final String RELATIONSHIP_INCOMING_PENDING = "INCOMING_PENDING";
    private static final String RELATIONSHIP_BLOCKED_BY_ME = "BLOCKED_BY_ME";
    private static final String RELATIONSHIP_BLOCKED_ME = "BLOCKED_ME";

    private final FriendshipRepository friendshipRepository;
    private final MessageBlockRepository messageBlockRepository;
    private final FriendEventPublisher friendEventPublisher;

    public FriendshipController(
        FriendshipRepository friendshipRepository,
        MessageBlockRepository messageBlockRepository,
        FriendEventPublisher friendEventPublisher
    ) {
        this.friendshipRepository = friendshipRepository;
        this.messageBlockRepository = messageBlockRepository;
        this.friendEventPublisher = friendEventPublisher;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> addFriend(
        @RequestHeader("X-User-Id") String userIdHeader,
        @Valid @RequestBody AddFriendRequest request
    ) {
        UUID requesterId = parseUserId(userIdHeader);
        if (requesterId.equals(request.addresseeId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add yourself as friend");
        }

        List<MessageBlockEntity> blocks = messageBlockRepository.findAllBetweenUsers(requesterId, request.addresseeId());
        if (!blocks.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Friend request is blocked because one of the users blocked the other"
            );
        }

        Optional<FriendshipEntity> existing = friendshipRepository
            .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                requesterId,
                request.addresseeId(),
                request.addresseeId(),
                requesterId
            );

        if (existing.isPresent()) {
            FriendshipEntity relation = existing.get();

            if (
                STATUS_PENDING.equalsIgnoreCase(relation.getStatus()) &&
                relation.getRequesterId().equals(request.addresseeId()) &&
                relation.getAddresseeId().equals(requesterId)
            ) {
                relation.setStatus(STATUS_ACCEPTED);
                relation.setUpdatedAt(Instant.now());
                FriendshipEntity accepted = friendshipRepository.save(relation);
                friendEventPublisher.publishFriendRequestAccepted(
                    accepted.getRequesterId(),
                    accepted.getAddresseeId(),
                    accepted.getId()
                );

                return ApiResponse.ok("Friend request accepted", Map.of(
                    "friendshipId", accepted.getId().toString(),
                    "status", accepted.getStatus(),
                    "requesterId", accepted.getRequesterId().toString(),
                    "addresseeId", accepted.getAddresseeId().toString()
                ));
            }

            if (isResendAllowedStatus(relation.getStatus())) {
                Instant now = Instant.now();
                relation.setRequesterId(requesterId);
                relation.setAddresseeId(request.addresseeId());
                relation.setStatus(STATUS_PENDING);
                relation.setAddresseeViewedAt(null);
                relation.setUpdatedAt(now);
                relation.setCreatedAt(now);

                FriendshipEntity resent = friendshipRepository.save(relation);
                friendEventPublisher.publishFriendRequestReceived(resent.getAddresseeId(), resent.getId(), resent.getRequesterId());
                return ApiResponse.ok("Friend request sent", Map.of(
                    "friendshipId", resent.getId().toString(),
                    "status", resent.getStatus(),
                    "requesterId", resent.getRequesterId().toString(),
                    "addresseeId", resent.getAddresseeId().toString()
                ));
            }

            return ApiResponse.ok("Friendship already exists", Map.of(
                "friendshipId", relation.getId().toString(),
                "status", relation.getStatus()
            ));
        }

        Instant now = Instant.now();
        FriendshipEntity entity = new FriendshipEntity();
        entity.setId(UUID.randomUUID());
        entity.setRequesterId(requesterId);
        entity.setAddresseeId(request.addresseeId());
        entity.setStatus(STATUS_PENDING);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity.setAddresseeViewedAt(null);
        FriendshipEntity created = friendshipRepository.save(entity);
        friendEventPublisher.publishFriendRequestReceived(created.getAddresseeId(), created.getId(), created.getRequesterId());

        return ApiResponse.ok("Friend request sent", Map.of(
            "friendshipId", created.getId().toString(),
            "status", created.getStatus(),
            "requesterId", created.getRequesterId().toString(),
            "addresseeId", created.getAddresseeId().toString()
        ));
    }

    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> getStatus(
        @RequestHeader("X-User-Id") String userIdHeader,
        @RequestParam("targetUserId") UUID targetUserId
    ) {
        UUID currentUserId = parseUserId(userIdHeader);
        return ApiResponse.ok("Friendship status", buildLegacyFriendshipStatusPayload(currentUserId, targetUserId));
    }

    @GetMapping("/status/{targetUserId}")
    public ApiResponse<Map<String, Object>> getStatusV2(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        UUID currentUserId = parseUserId(userIdHeader);
        return ApiResponse.ok("Relationship status", buildRelationshipStatusPayload(currentUserId, targetUserId));
    }

    @PostMapping("/{targetUserId}/request")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> addFriendByTargetId(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return addFriend(userIdHeader, new AddFriendRequest(targetUserId));
    }

    @GetMapping("/blocks")
    public ApiResponse<List<BlockedUser>> getBlockedUsers(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID userId = parseUserId(userIdHeader);
        List<BlockedUser> blockedUsers = messageBlockRepository.findAllByBlockerId(userId)
            .stream()
            .map(block -> new BlockedUser(block.getBlockedUserId()))
            .toList();
        return ApiResponse.ok("Blocked users fetched", blockedUsers);
    }

    // Backward compatibility for deployments exposing singular "/block" path.
    @GetMapping("/block")
    public ApiResponse<List<BlockedUser>> getBlockedUsersCompat(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        return getBlockedUsers(userIdHeader);
    }

    @PostMapping("/block")
    public ApiResponse<Map<String, Object>> blockUser(
        @RequestHeader("X-User-Id") String userIdHeader,
        @Valid @RequestBody BlockUserRequest request
    ) {
        UUID blockerId = parseUserId(userIdHeader);
        if (blockerId.equals(request.targetUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot block yourself");
        }

        Optional<MessageBlockEntity> existingBlock = messageBlockRepository.findByBlockerIdAndBlockedUserId(
            blockerId,
            request.targetUserId()
        );

        if (existingBlock.isEmpty()) {
            Instant now = Instant.now();
            MessageBlockEntity block = new MessageBlockEntity();
            block.setId(UUID.randomUUID());
            block.setBlockerId(blockerId);
            block.setBlockedUserId(request.targetUserId());
            block.setCreatedAt(now);
            block.setUpdatedAt(now);
            messageBlockRepository.save(block);

            friendshipRepository
                .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                    blockerId,
                    request.targetUserId(),
                    request.targetUserId(),
                    blockerId
                )
                .ifPresent(friendshipRepository::delete);
        }

        friendEventPublisher.publishFriendshipBlocked(blockerId, request.targetUserId());

        return ApiResponse.ok("User blocked", buildBlockMutationPayload(blockerId, request.targetUserId()));
    }

    @PostMapping("/{targetUserId}/block")
    public ApiResponse<Map<String, Object>> blockUserByTargetId(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return blockUser(userIdHeader, new BlockUserRequest(targetUserId));
    }

    // Backward compatibility for deployments using path-variable block routes.
    @PostMapping("/block/{targetUserId}")
    public ApiResponse<Map<String, Object>> blockUserCompatPost(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return blockUser(userIdHeader, new BlockUserRequest(targetUserId));
    }

    @PutMapping("/block")
    public ApiResponse<Map<String, Object>> blockUserCompatPut(
        @RequestHeader("X-User-Id") String userIdHeader,
        @Valid @RequestBody BlockUserRequest request
    ) {
        return blockUser(userIdHeader, request);
    }

    @PutMapping("/block/{targetUserId}")
    public ApiResponse<Map<String, Object>> blockUserCompatPutPath(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return blockUser(userIdHeader, new BlockUserRequest(targetUserId));
    }

    @DeleteMapping("/block/{targetUserId}")
    public ApiResponse<Map<String, Object>> unblockUser(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        UUID blockerId = parseUserId(userIdHeader);
        messageBlockRepository.findByBlockerIdAndBlockedUserId(blockerId, targetUserId)
            .ifPresent(messageBlockRepository::delete);

        friendEventPublisher.publishFriendshipUnblocked(blockerId, targetUserId);

        return ApiResponse.ok("User unblocked", buildUnblockMutationPayload(blockerId, targetUserId));
    }

    @DeleteMapping("/{targetUserId}/block")
    public ApiResponse<Map<String, Object>> unblockUserByTargetId(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return unblockUser(userIdHeader, targetUserId);
    }

    // Backward compatibility for deployments exposing POST-based unblock routes.
    @PostMapping("/unblock")
    public ApiResponse<Map<String, Object>> unblockUserCompatPost(
        @RequestHeader("X-User-Id") String userIdHeader,
        @Valid @RequestBody BlockUserRequest request
    ) {
        return unblockUser(userIdHeader, request.targetUserId());
    }

    @PostMapping("/unblock/{targetUserId}")
    public ApiResponse<Map<String, Object>> unblockUserCompatPostPath(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return unblockUser(userIdHeader, targetUserId);
    }

    @PostMapping("/block/{targetUserId}/unblock")
    public ApiResponse<Map<String, Object>> unblockUserCompatLegacyPath(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("targetUserId") UUID targetUserId
    ) {
        return unblockUser(userIdHeader, targetUserId);
    }

    @GetMapping("/pending")
    public ApiResponse<List<PendingFriendRequest>> getPendingRequests(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID addresseeId = parseUserId(userIdHeader);
        List<PendingFriendRequest> requests = friendshipRepository
            .findAllByAddresseeIdAndStatus(addresseeId, STATUS_PENDING)
            .stream()
            .map(relation -> new PendingFriendRequest(
                relation.getId(),
                relation.getRequesterId(),
                relation.getAddresseeId(),
                relation.getStatus(),
                relation.getCreatedAt()
            ))
            .toList();

        return ApiResponse.ok("Pending friendship requests", requests);
    }

    @GetMapping("/requests/received")
    public ApiResponse<List<PendingFriendRequest>> getPendingRequestsV2(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        return getPendingRequests(userIdHeader);
    }

    @GetMapping("/pending/sent")
    public ApiResponse<List<PendingFriendRequest>> getSentPendingRequests(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID requesterId = parseUserId(userIdHeader);
        List<PendingFriendRequest> requests = friendshipRepository
            .findAllByRequesterIdAndStatus(requesterId, STATUS_PENDING)
            .stream()
            .map(relation -> new PendingFriendRequest(
                relation.getId(),
                relation.getRequesterId(),
                relation.getAddresseeId(),
                relation.getStatus(),
                relation.getCreatedAt()
            ))
            .toList();

        return ApiResponse.ok("Sent pending friendship requests", requests);
    }

    @GetMapping("/requests/sent")
    public ApiResponse<List<PendingFriendRequest>> getSentPendingRequestsV2(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        return getSentPendingRequests(userIdHeader);
    }

    @GetMapping({"/sent-pending", "/sent"})
    public ApiResponse<List<PendingFriendRequest>> getSentPendingRequestsCompat(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        return getSentPendingRequests(userIdHeader);
    }

    @GetMapping("/friends")
    public ApiResponse<List<FriendContact>> getFriends(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID userId = parseUserId(userIdHeader);
        List<FriendContact> friends = friendshipRepository
            .findAllByUserIdAndStatus(userId, STATUS_ACCEPTED)
            .stream()
            .map(relation -> {
                UUID friendId = relation.getRequesterId().equals(userId)
                    ? relation.getAddresseeId()
                    : relation.getRequesterId();
                return new FriendContact(relation.getId(), friendId);
            })
            .toList();

        return ApiResponse.ok("Friend list", friends);
    }

    @GetMapping("/internal/accepted")
    public ApiResponse<Map<String, Object>> isAcceptedFriendship(
        @RequestParam("userA") UUID userA,
        @RequestParam("userB") UUID userB
    ) {
        boolean accepted = friendshipRepository.existsAcceptedFriendshipBetweenUsers(userA, userB, STATUS_ACCEPTED);
        return ApiResponse.ok("Friendship acceptance fetched", Map.of("accepted", accepted));
    }

    @GetMapping("/internal/blocked")
    public ApiResponse<Map<String, Object>> isBlocked(
        @RequestParam("userA") UUID userA,
        @RequestParam("userB") UUID userB
    ) {
        List<MessageBlockEntity> blocks = messageBlockRepository.findAllBetweenUsers(userA, userB);
        boolean blockedByUserA = blocks.stream().anyMatch(block -> userA.equals(block.getBlockerId()));
        boolean blockedByUserB = blocks.stream().anyMatch(block -> userB.equals(block.getBlockerId()));
        return ApiResponse.ok("Block status fetched", Map.of(
            "blocked", !blocks.isEmpty(),
            "blockedByUserA", blockedByUserA,
            "blockedByUserB", blockedByUserB
        ));
    }

    @PostMapping("/{friendshipId}/accept")
    public ApiResponse<Map<String, Object>> acceptRequest(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        UUID userId = parseUserId(userIdHeader);
        FriendshipEntity relation = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));

        if (!relation.getAddresseeId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot accept this request");
        }
        if (!STATUS_PENDING.equalsIgnoreCase(relation.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }

        relation.setStatus(STATUS_ACCEPTED);
        relation.setUpdatedAt(Instant.now());
        FriendshipEntity updated = friendshipRepository.save(relation);
        friendEventPublisher.publishFriendRequestAccepted(updated.getRequesterId(), updated.getAddresseeId(), updated.getId());
        return ApiResponse.ok("Friend request accepted", Map.of(
            "friendshipId", updated.getId().toString(),
            "status", updated.getStatus(),
            "requesterId", updated.getRequesterId().toString(),
            "addresseeId", updated.getAddresseeId().toString()
        ));
    }

    @PostMapping("/{friendshipId}/decline")
    public ApiResponse<Map<String, Object>> declineRequest(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        UUID userId = parseUserId(userIdHeader);
        FriendshipEntity relation = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));

        if (!relation.getAddresseeId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot decline this request");
        }
        if (!STATUS_PENDING.equalsIgnoreCase(relation.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }

        relation.setStatus(STATUS_REJECTED);
        relation.setUpdatedAt(Instant.now());
        FriendshipEntity updated = friendshipRepository.save(relation);
        friendEventPublisher.publishFriendRequestDeclined(updated.getRequesterId(), updated.getId());
        return ApiResponse.ok("Friend request rejected", Map.of(
            "friendshipId", updated.getId().toString(),
            "status", updated.getStatus(),
            "requesterId", updated.getRequesterId().toString(),
            "addresseeId", updated.getAddresseeId().toString()
        ));
    }

    @GetMapping("/pending/unread-count")
    public ApiResponse<Map<String, Object>> getUnreadPendingCount(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID addresseeId = parseUserId(userIdHeader);
        long unread = friendshipRepository.countByAddresseeIdAndStatusAndAddresseeViewedAtIsNull(addresseeId, STATUS_PENDING);
        return ApiResponse.ok("Unread pending friend request count", Map.of("count", unread));
    }

    @PostMapping("/pending/mark-read")
    @Transactional
    public ApiResponse<Map<String, Object>> markPendingAsRead(
        @RequestHeader("X-User-Id") String userIdHeader
    ) {
        UUID addresseeId = parseUserId(userIdHeader);
        Instant now = Instant.now();
        int updated = friendshipRepository.markPendingAsViewed(addresseeId, STATUS_PENDING, now);
        return ApiResponse.ok("Pending friend requests marked as read", Map.of("updated", updated));
    }

    @PostMapping("/{friendshipId}/cancel")
    public ApiResponse<Map<String, Object>> cancelRequest(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        UUID userId = parseUserId(userIdHeader);
        FriendshipEntity relation = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));

        if (!relation.getRequesterId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot cancel this request");
        }
        if (!STATUS_PENDING.equalsIgnoreCase(relation.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }

        relation.setStatus(STATUS_CANCELLED);
        relation.setUpdatedAt(Instant.now());
        FriendshipEntity updated = friendshipRepository.save(relation);
        friendEventPublisher.publishFriendRequestCancelled(
            updated.getRequesterId(),
            updated.getAddresseeId(),
            updated.getId()
        );

        return ApiResponse.ok("Friend request cancelled", Map.of(
            "friendshipId", updated.getId().toString(),
            "status", updated.getStatus(),
            "requesterId", updated.getRequesterId().toString(),
            "addresseeId", updated.getAddresseeId().toString()
        ));
    }

    @DeleteMapping("/requests/{friendshipId}")
    public ApiResponse<Map<String, Object>> cancelRequestByRequestId(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        return cancelRequest(userIdHeader, friendshipId);
    }

    @DeleteMapping("/{friendshipId}/cancel")
    public ApiResponse<Map<String, Object>> cancelRequestLegacyMethod(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        return cancelRequest(userIdHeader, friendshipId);
    }

    @DeleteMapping("/{friendshipId}")
    public ApiResponse<Map<String, Object>> removeFriend(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        UUID userId = parseUserId(userIdHeader);
        FriendshipEntity relation = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship not found"));

        boolean isParticipant = relation.getRequesterId().equals(userId) || relation.getAddresseeId().equals(userId);
        if (!isParticipant) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot remove this friendship");
        }
        if (!STATUS_ACCEPTED.equalsIgnoreCase(relation.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only accepted friendships can be removed");
        }

        friendshipRepository.delete(relation);
        friendEventPublisher.publishFriendshipRemoved(
            relation.getRequesterId(),
            relation.getAddresseeId(),
            relation.getId()
        );
        return ApiResponse.ok("Friendship removed", Map.of(
            "friendshipId", relation.getId().toString(),
            "status", "NONE",
            "requesterId", relation.getRequesterId().toString(),
            "addresseeId", relation.getAddresseeId().toString()
        ));
    }

    @PostMapping("/{friendshipId}/remove")
    public ApiResponse<Map<String, Object>> removeFriendLegacyRoute(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        return removeFriend(userIdHeader, friendshipId);
    }

    @PostMapping("/{friendshipId}/delete")
    public ApiResponse<Map<String, Object>> removeFriendLegacyDeleteRoute(
        @RequestHeader("X-User-Id") String userIdHeader,
        @PathVariable("friendshipId") UUID friendshipId
    ) {
        return removeFriend(userIdHeader, friendshipId);
    }

    private UUID parseUserId(String value) {
        try {
            return UUID.fromString(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid user id");
        }
    }

    public record AddFriendRequest(@NotNull UUID addresseeId) {
    }

    public record PendingFriendRequest(
        UUID friendshipId,
        UUID requesterId,
        UUID addresseeId,
        String status,
        Instant createdAt
    ) {
    }

    public record FriendContact(
        UUID friendshipId,
        UUID userId
    ) {
    }

    public record BlockUserRequest(@NotNull UUID targetUserId) {
    }

    public record BlockedUser(UUID userId) {
    }

    private Map<String, Object> buildRelationshipStatusPayload(UUID currentUserId, UUID targetUserId) {
        List<MessageBlockEntity> blocks = messageBlockRepository.findAllBetweenUsers(currentUserId, targetUserId);
        boolean blockedByMe = blocks.stream().anyMatch(block -> currentUserId.equals(block.getBlockerId()));
        boolean blockedMe = blocks.stream().anyMatch(block -> targetUserId.equals(block.getBlockerId()));

        if (blockedByMe || blockedMe) {
            return createRelationshipStatusPayload(
                blockedByMe ? RELATIONSHIP_BLOCKED_BY_ME : RELATIONSHIP_BLOCKED_ME,
                null,
                null,
                null,
                blockedByMe,
                blockedMe
            );
        }

        Optional<FriendshipEntity> existing = friendshipRepository
            .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                currentUserId,
                targetUserId,
                targetUserId,
                currentUserId
            );

        if (existing.isEmpty()) {
            return createRelationshipStatusPayload(
                RELATIONSHIP_NONE,
                null,
                null,
                null,
                false,
                false
            );
        }

        FriendshipEntity relation = existing.get();
        String normalizedStoredStatus = normalizeStoredStatus(relation.getStatus());
        if (STATUS_BLOCKED.equals(normalizedStoredStatus)) {
            boolean storedBlockedByMe = relation.getRequesterId().equals(currentUserId);
            boolean storedBlockedMe = relation.getRequesterId().equals(targetUserId);
            return createRelationshipStatusPayload(
                storedBlockedByMe ? RELATIONSHIP_BLOCKED_BY_ME : RELATIONSHIP_BLOCKED_ME,
                relation,
                null,
                null,
                storedBlockedByMe,
                storedBlockedMe
            );
        }

        String relationshipStatus = switch (normalizedStoredStatus) {
            case STATUS_PENDING -> relation.getRequesterId().equals(currentUserId)
                ? RELATIONSHIP_OUTGOING_PENDING
                : RELATIONSHIP_INCOMING_PENDING;
            case STATUS_ACCEPTED -> RELATIONSHIP_FRIENDS;
            default -> RELATIONSHIP_NONE;
        };

        return createRelationshipStatusPayload(
            relationshipStatus,
            relation,
            relation.getRequesterId(),
            relation.getAddresseeId(),
            false,
            false
        );
    }

    private Map<String, Object> buildLegacyFriendshipStatusPayload(UUID currentUserId, UUID targetUserId) {
        List<MessageBlockEntity> blocks = messageBlockRepository.findAllBetweenUsers(currentUserId, targetUserId);
        boolean blockedByMe = blocks.stream().anyMatch(block -> currentUserId.equals(block.getBlockerId()));
        boolean blockedByPeer = blocks.stream().anyMatch(block -> targetUserId.equals(block.getBlockerId()));
        if (blockedByMe || blockedByPeer) {
            return createLegacyStatusPayload(
                STATUS_BLOCKED,
                null,
                blockedByMe,
                blockedByPeer
            );
        }

        Optional<FriendshipEntity> existing = friendshipRepository
            .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                currentUserId,
                targetUserId,
                targetUserId,
                currentUserId
            );

        if (existing.isEmpty()) {
            return createLegacyStatusPayload(RELATIONSHIP_NONE, null, false, false);
        }

        FriendshipEntity relation = existing.get();
        String normalizedStatus = normalizeStoredStatus(relation.getStatus());
        if (!STATUS_PENDING.equals(normalizedStatus)
            && !STATUS_ACCEPTED.equals(normalizedStatus)
            && !STATUS_BLOCKED.equals(normalizedStatus)) {
            return createLegacyStatusPayload(RELATIONSHIP_NONE, null, false, false);
        }

        return createLegacyStatusPayload(
            normalizedStatus,
            relation,
            STATUS_BLOCKED.equals(normalizedStatus) && relation.getRequesterId().equals(currentUserId),
            STATUS_BLOCKED.equals(normalizedStatus) && relation.getRequesterId().equals(targetUserId)
        );
    }

    private Map<String, Object> createRelationshipStatusPayload(
        String status,
        FriendshipEntity relation,
        UUID senderId,
        UUID receiverId,
        boolean blockedByMe,
        boolean blockedMe
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String normalizedStatus = status == null ? RELATIONSHIP_NONE : status.trim().toUpperCase();
        UUID effectiveSenderId = senderId != null
            ? senderId
            : relation == null ? null : relation.getRequesterId();
        UUID effectiveReceiverId = receiverId != null
            ? receiverId
            : relation == null ? null : relation.getAddresseeId();

        payload.put("status", normalizedStatus);
        payload.put(
            "requestId",
            RELATIONSHIP_OUTGOING_PENDING.equals(normalizedStatus) || RELATIONSHIP_INCOMING_PENDING.equals(normalizedStatus)
                ? relation == null ? null : relation.getId().toString()
                : null
        );
        payload.put("friendshipId", relation == null ? null : relation.getId().toString());
        payload.put("senderId", effectiveSenderId == null ? null : effectiveSenderId.toString());
        payload.put("receiverId", effectiveReceiverId == null ? null : effectiveReceiverId.toString());
        payload.put("requesterId", effectiveSenderId == null ? null : effectiveSenderId.toString());
        payload.put("addresseeId", effectiveReceiverId == null ? null : effectiveReceiverId.toString());
        payload.put("isBlockedByMe", blockedByMe);
        payload.put("isBlockedMe", blockedMe);
        payload.put("blockedByMe", blockedByMe);
        payload.put("blockedByPeer", blockedMe);
        return payload;
    }

    private Map<String, Object> createLegacyStatusPayload(
        String status,
        FriendshipEntity relation,
        boolean blockedByMe,
        boolean blockedByPeer
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String normalizedStatus = status == null ? RELATIONSHIP_NONE : status.trim().toUpperCase();
        payload.put("status", normalizedStatus);
        payload.put(
            "requestId",
            STATUS_PENDING.equals(normalizedStatus) && relation != null ? relation.getId().toString() : null
        );
        payload.put("friendshipId", relation == null ? null : relation.getId().toString());
        payload.put("requesterId", relation == null ? null : relation.getRequesterId().toString());
        payload.put("addresseeId", relation == null ? null : relation.getAddresseeId().toString());
        payload.put("senderId", relation == null ? null : relation.getRequesterId().toString());
        payload.put("receiverId", relation == null ? null : relation.getAddresseeId().toString());
        payload.put("blockedByMe", blockedByMe);
        payload.put("blockedByPeer", blockedByPeer);
        payload.put("isBlockedByMe", blockedByMe);
        payload.put("isBlockedMe", blockedByPeer);
        return payload;
    }

    private String normalizeStoredStatus(String status) {
        if (status == null) {
            return RELATIONSHIP_NONE;
        }

        String normalized = status.trim().toUpperCase();
        if ("CANCELED".equals(normalized)) {
            return STATUS_CANCELLED;
        }
        return normalized;
    }

    private Map<String, Object> buildBlockMutationPayload(UUID currentUserId, UUID targetUserId) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>(buildRelationshipStatusPayload(currentUserId, targetUserId));
        payload.put("targetUserId", targetUserId.toString());
        payload.put("blockerId", currentUserId.toString());
        payload.put("blockedUserId", targetUserId.toString());
        return payload;
    }

    private Map<String, Object> buildUnblockMutationPayload(UUID currentUserId, UUID targetUserId) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>(buildRelationshipStatusPayload(currentUserId, targetUserId));
        payload.put("targetUserId", targetUserId.toString());
        payload.put("blockerId", currentUserId.toString());
        payload.put("blockedUserId", targetUserId.toString());
        return payload;
    }

    private boolean isResendAllowedStatus(String status) {
        if (status == null) {
            return false;
        }

        String normalized = status.trim().toUpperCase();
        return STATUS_REJECTED.equals(normalized)
            || STATUS_DECLINED.equals(normalized)
            || STATUS_CANCELLED.equals(normalized);
    }
}

