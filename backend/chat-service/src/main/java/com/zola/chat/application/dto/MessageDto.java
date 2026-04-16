package com.zola.chat.application.dto;

import java.time.Instant;

/**
 * Data returned to clients for a single chat message.
 */
public record MessageDto(
    String id,
    String conversationId,
    String senderId,
    String content,
    Instant sentAt
) {
}
