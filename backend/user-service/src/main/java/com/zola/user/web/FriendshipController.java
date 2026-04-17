package com.zola.user.web;

import com.zola.common.response.ApiResponse;
import com.zola.user.entity.FriendshipEntity;
import com.zola.user.repository.FriendshipRepository;
import com.zola.user.service.FriendEventPublisher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    private final FriendshipRepository friendshipRepository;
    private final FriendEventPublisher friendEventPublisher;

    public FriendshipController(FriendshipRepository friendshipRepository, FriendEventPublisher friendEventPublisher) {
        this.friendshipRepository = friendshipRepository;
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

        Optional<FriendshipEntity> existing = friendshipRepository
            .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                requesterId,
                request.addresseeId(),
                request.addresseeId(),
                requesterId
            );

        if (existing.isPresent()) {
            FriendshipEntity relation = existing.get();

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
        UUID requesterId = parseUserId(userIdHeader);
        Optional<FriendshipEntity> existing = friendshipRepository
            .findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
                requesterId,
                targetUserId,
                targetUserId,
                requesterId
            );

        if (existing.isEmpty()) {
            return ApiResponse.ok("Friendship status", Map.of("status", "NONE"));
        }

        FriendshipEntity relation = existing.get();
        return ApiResponse.ok("Friendship status", Map.of(
            "status", relation.getStatus(),
            "requesterId", relation.getRequesterId().toString(),
            "addresseeId", relation.getAddresseeId().toString()
        ));
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
                relation.getStatus()
            ))
            .toList();

        return ApiResponse.ok("Pending friendship requests", requests);
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

        friendshipRepository.delete(relation);
        return ApiResponse.ok("Friendship removed", Map.of(
            "friendshipId", relation.getId().toString(),
            "status", "NONE",
            "requesterId", relation.getRequesterId().toString(),
            "addresseeId", relation.getAddresseeId().toString()
        ));
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
        String status
    ) {
    }

    public record FriendContact(
        UUID friendshipId,
        UUID userId
    ) {
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
