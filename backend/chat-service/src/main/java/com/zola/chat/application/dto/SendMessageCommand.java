package com.zola.chat.application.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Command object for send-message use case.
 */
public record SendMessageCommand(
    @NotBlank String conversationId,
    @NotBlank String senderId,
    @NotBlank String content
) {
}
