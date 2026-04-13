package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateDirectConversationRequest(@NotBlank String targetUserId) {
}
