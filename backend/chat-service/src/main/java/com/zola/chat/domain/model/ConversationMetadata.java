package com.zola.chat.domain.model;

import java.time.Instant;
import java.util.List;

/**
 * Conversation metadata stored in PostgreSQL.
 */
public record ConversationMetadata(
    String id,
    ConversationType type,
    String title,
    List<String> participantIds,
    Instant createdAt,
    Instant updatedAt
) {
}
