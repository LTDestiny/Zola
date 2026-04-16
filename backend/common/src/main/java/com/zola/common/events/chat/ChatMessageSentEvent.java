package com.zola.common.events.chat;

import java.time.Instant;

public record ChatMessageSentEvent(
    String messageId,
    String conversationId,
    String senderId,
    String type,
    String content,
    String fileUrl,
    Instant createdAt
) {
}
