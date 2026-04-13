package com.zola.chat.chatrealtime.dto;

import java.time.Instant;
import java.util.UUID;

public record ConversationResponse(
    UUID id,
    String user1Id,
    String user2Id,
    String lastMessage,
    Instant updatedAt
) {
}
