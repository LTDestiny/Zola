package com.zola.common.events.chat;

import java.time.Instant;

public record ChatMessageRecalledEvent(
    String messageId,
    String conversationId,
    String recalledBy,
    Instant recalledAt
) {
}
