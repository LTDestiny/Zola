package com.zola.chat.chatrealtime.dto;

public record ChatEventResponse(
    String eventType,
    String actorId,
    String conversationId,
    boolean typing,
    boolean online,
    String targetUserId,
    MessagePayload message,
    Integer unreadCount,
    Integer totalUnreadCount,
    String lastMessage,
    String lastMessageAt
) {
}
