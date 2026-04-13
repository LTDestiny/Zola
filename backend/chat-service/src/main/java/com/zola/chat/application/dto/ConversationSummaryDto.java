package com.zola.chat.application.dto;

import java.time.Instant;
import java.util.List;

/**
 * Data returned to clients when listing conversations.
 */
public record ConversationSummaryDto(
    String id,
    String displayName,
    String lastMessage,
    Instant lastMessageAt,
    List<String> participantIds
) {
}
