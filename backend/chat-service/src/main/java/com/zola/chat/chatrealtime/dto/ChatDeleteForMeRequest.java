package com.zola.chat.chatrealtime.dto;

import java.util.UUID;

public record ChatDeleteForMeRequest(
    UUID conversationId,
    String messageId
) {
}
