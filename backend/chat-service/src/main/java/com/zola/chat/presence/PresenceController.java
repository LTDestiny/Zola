package com.zola.chat.presence;

import com.zola.common.response.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST API endpoints for presence.
 * 
 * GET  /api/presence/{userId}     - Get single user presence
 * POST /api/presence/batch        - Get batch user presence
 */
@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private final PresenceManager presenceManager;

    public PresenceController(PresenceManager presenceManager) {
        this.presenceManager = presenceManager;
    }

    /**
     * Get presence for a single user.
     * 
     * GET /api/presence/{userId}
     * 
     * Response:
     * {
     *   "userId": "...",
     *   "online": true,
     *   "lastSeenAt": "2024-01-15T10:30:00Z"
     * }
     */
    @GetMapping("/{userId}")
    public ApiResponse<PresenceResponse> getPresence(@PathVariable("userId") String userId) {
        PresenceManager.PresenceState state = presenceManager.getPresence(userId);
        return ApiResponse.ok("Presence fetched", toResponse(state));
    }

    /**
     * Batch get presence for multiple users.
     * Optimized for chat list rendering.
     * 
     * POST /api/presence/batch
     * Body: { "userIds": ["user1", "user2", ...] }
     * 
     * Response:
     * {
     *   "data": [
     *     { "userId": "user1", "online": true, "lastSeenAt": null },
     *     { "userId": "user2", "online": false, "lastSeenAt": "2024-01-15T10:30:00Z" }
     *   ]
     * }
     */
    @PostMapping("/batch")
    public ApiResponse<List<PresenceResponse>> getPresenceBatch(@RequestBody BatchPresenceRequest request) {
        if (request.userIds() == null || request.userIds().isEmpty()) {
            return ApiResponse.ok("Presence fetched", List.of());
        }

        Map<String, PresenceManager.PresenceState> presenceMap = presenceManager.getPresenceBatch(request.userIds());
        
        List<PresenceResponse> responses = request.userIds().stream()
            .filter(id -> id != null && !id.isBlank())
            .map(String::trim)
            .distinct()
            .map(userId -> {
                PresenceManager.PresenceState state = presenceMap.get(userId);
                if (state == null) {
                    return new PresenceResponse(userId, false, 0, null);
                }
                return toResponse(state);
            })
            .collect(Collectors.toList());

        return ApiResponse.ok("Presence batch fetched", responses);
    }

    /**
     * Subscribe to presence updates for specific users.
     * This is called when a user opens chat list to start watching friends' presence.
     * 
     * POST /api/presence/subscribe
     * Body: { "userIds": ["user1", "user2", ...] }
     */
    @PostMapping("/subscribe")
    public ApiResponse<Void> subscribePresence(
        @RequestHeader("X-User-Id") String currentUserId,
        @RequestBody BatchPresenceRequest request
    ) {
        // This endpoint can be used to register presence watchers
        // The actual subscription happens via WebSocket
        return ApiResponse.ok("Subscribed to presence updates", null);
    }

    private PresenceResponse toResponse(PresenceManager.PresenceState state) {
        return new PresenceResponse(
            state.userId(),
            state.online(),
            state.sessionCount(),
            state.lastSeenAt()
        );
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────────

    public record BatchPresenceRequest(List<String> userIds) {}

    public record PresenceResponse(
        String userId,
        boolean online,
        int sessionCount,
        Instant lastSeenAt
    ) {}
}
