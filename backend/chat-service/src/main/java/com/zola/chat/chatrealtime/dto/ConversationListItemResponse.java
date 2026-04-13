package com.zola.chat.chatrealtime.dto;

import java.time.Instant;
import java.util.List;

public record ConversationListItemResponse(
    String id,
    String name,
    String lastMessage,
    Instant lastMessageAt,
    List<String> participants
) {
}
