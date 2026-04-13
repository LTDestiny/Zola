package com.zola.chat.chatrealtime.dto;

import java.util.UUID;

public record ChatRecallRequest(
    UUID conversationId,
    String messageId
) {
}
