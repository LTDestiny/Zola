package com.zola.chat.chatrealtime.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ConversationResponse(
    UUID id,
    String type,
    String name,
    String avatar,
    String user1Id,
    String user2Id,
    List<String> participants,
    List<String> admins,
    String ownerId,
    String lastMessage,
    Instant lastMessageAt,
    int requesterUnreadCount,
    Instant requesterLastReadAt,
    String requesterLastReadMessageId,
    Instant updatedAt
) {
}
