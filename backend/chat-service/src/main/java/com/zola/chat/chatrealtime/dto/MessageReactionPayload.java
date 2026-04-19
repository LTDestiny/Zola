package com.zola.chat.chatrealtime.dto;

public record MessageReactionPayload(
    String userId,
    String emoji
) {
}
