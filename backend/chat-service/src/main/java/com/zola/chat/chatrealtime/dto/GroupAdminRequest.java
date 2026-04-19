package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

public record GroupAdminRequest(
    @NotBlank String userId,
    boolean admin
) {
}
