package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

public record GroupMemberRequest(
    @NotBlank String userId
) {
}
