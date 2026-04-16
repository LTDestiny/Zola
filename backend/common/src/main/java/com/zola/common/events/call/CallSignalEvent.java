package com.zola.common.events.call;

import java.time.Instant;

public record CallSignalEvent(
    String callId,
    String fromUserId,
    String toUserId,
    String signalType,
    String payload,
    Instant createdAt
) {
}
