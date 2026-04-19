package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record CreateGroupConversationRequest(
    @NotBlank String name,
    @NotEmpty List<String> memberIds,
    String avatar
) {
}
