package com.zola.chat.chatrealtime.dto;

import java.util.UUID;

public record ChatReadReceiptRequest(
    UUID conversationId,
    String messageId
) {
}
