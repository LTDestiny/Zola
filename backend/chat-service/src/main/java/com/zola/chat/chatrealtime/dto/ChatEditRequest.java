package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record ChatEditRequest(
    UUID conversationId,
    String messageId,
    @NotBlank String content
) {
}
