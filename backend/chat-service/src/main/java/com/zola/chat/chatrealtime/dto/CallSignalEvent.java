package com.zola.chat.chatrealtime.dto;

public record CallSignalEvent(
    String actorId,
    String conversationId,
    String targetUserId,
    String callId,
    String mode,
    String signalType,
    String payload,
    String createdAt
) {
}
