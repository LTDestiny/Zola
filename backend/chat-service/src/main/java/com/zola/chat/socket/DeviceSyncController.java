package com.zola.chat.socket;

import com.zola.common.response.ApiResponse;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/sync")
public class DeviceSyncController {

    private final SimpMessagingTemplate messagingTemplate;

    public DeviceSyncController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/sync.publish")
    public void publish(@Payload SyncEventMessage message, Principal principal) {
        String userId = principal.getName();
        SyncEventMessage normalized = new SyncEventMessage(
            userId,
            message.sourceClient(),
            message.eventType(),
            message.payload(),
            Instant.now()
        );
        messagingTemplate.convertAndSendToUser(userId, "/queue/sync", normalized);
    }

    @PostMapping("/users/{userId}/emit")
    public ApiResponse<Map<String, Object>> emitToUser(@PathVariable String userId, @RequestBody SyncEventMessage message) {
        SyncEventMessage normalized = new SyncEventMessage(
            userId,
            message.sourceClient(),
            message.eventType(),
            message.payload(),
            Instant.now()
        );
        messagingTemplate.convertAndSendToUser(userId, "/queue/sync", normalized);
        return ApiResponse.ok("Sync event emitted", Map.of("userId", userId, "eventType", message.eventType()));
    }
}
