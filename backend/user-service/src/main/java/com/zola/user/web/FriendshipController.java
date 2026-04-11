package com.zola.user.web;

import com.zola.common.response.ApiResponse;
import com.zola.user.entity.FriendshipEntity;
import com.zola.user.repository.FriendshipRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/friendships")
public class FriendshipController {

    private final FriendshipRepository friendshipRepository;

    public FriendshipController(FriendshipRepository friendshipRepository) {
        this.friendshipRepository = friendshipRepository;
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
            return ApiResponse.ok("Friendship already exists", Map.of(
                "friendshipId", relation.getId().toString(),
                "status", relation.getStatus()
            ));
        }

        FriendshipEntity entity = new FriendshipEntity();
        entity.setId(UUID.randomUUID());
        entity.setRequesterId(requesterId);
        entity.setAddresseeId(request.addresseeId());
        entity.setStatus("PENDING");
        FriendshipEntity created = friendshipRepository.save(entity);

        return ApiResponse.ok("Friend request sent", Map.of(
            "friendshipId", created.getId().toString(),
            "status", created.getStatus()
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

    private UUID parseUserId(String value) {
        try {
            return UUID.fromString(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid user id");
        }
    }

    public record AddFriendRequest(@NotNull UUID addresseeId) {
    }
}
