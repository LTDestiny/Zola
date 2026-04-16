package com.zola.common.events.notification;

import java.time.Instant;

public record NotificationCreatedEvent(
    String notificationId,
    String userId,
    String title,
    String body,
    String type,
    String refId,
    Instant createdAt
) {
}
