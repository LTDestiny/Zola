package com.zola.chat.domain.model;

import java.time.Instant;

/**
 * Message aggregate in chat domain.
 */
public record ChatMessage(
    String id,
    String conversationId,
    String senderId,
    String content,
    Instant sentAt
) {
}
