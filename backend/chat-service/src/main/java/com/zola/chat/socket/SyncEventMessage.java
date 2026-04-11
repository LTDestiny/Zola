package com.zola.chat.socket;

import java.time.Instant;

public record SyncEventMessage(
    String userId,
    String sourceClient,
    String eventType,
    String payload,
    Instant timestamp
) {
}
