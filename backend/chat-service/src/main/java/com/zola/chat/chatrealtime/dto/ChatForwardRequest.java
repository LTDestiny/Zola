package com.zola.chat.chatrealtime.dto;

import java.util.UUID;

public record ChatForwardRequest(
    UUID sourceConversationId,
    String messageId,
    UUID targetConversationId
) {
}
