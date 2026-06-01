package com.zola.chat.chatrealtime.dto;

import java.time.Instant;
import java.util.List;

public record ConversationListItemResponse(
    String id,
    String type,
    String name,
    String avatar,
    String lastMessage,
    Instant lastMessageAt,
    int unreadCount,
    Instant lastReadAt,
    String lastReadMessageId,
    List<String> participants,
    List<String> admins,
    String ownerId,
    String otherUserId,
    boolean isOnline,
    boolean isPinned,
    Instant pinnedAt
) {
}
