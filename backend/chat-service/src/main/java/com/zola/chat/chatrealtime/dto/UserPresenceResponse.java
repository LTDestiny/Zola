package com.zola.chat.chatrealtime.dto;

import java.time.Instant;

public record UserPresenceResponse(
    String userId,
    boolean online,
    Instant lastChangedAt
) {
}
