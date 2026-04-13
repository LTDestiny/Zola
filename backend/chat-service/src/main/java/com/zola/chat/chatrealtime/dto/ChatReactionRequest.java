package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record ChatReactionRequest(
    UUID conversationId,
    String messageId,
    @NotBlank String emoji,
    boolean remove
) {
}
