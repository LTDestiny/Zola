package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record ChatSendRequest(
    UUID conversationId,
    @NotBlank String type,
    @NotBlank String content,
    String fileUrl,
    String fileName
) {
}
