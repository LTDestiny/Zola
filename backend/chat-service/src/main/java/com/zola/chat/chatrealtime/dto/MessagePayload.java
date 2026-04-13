package com.zola.chat.chatrealtime.dto;

import java.util.List;
import java.util.Set;

public record MessagePayload(
    String messageId,
    String conversationId,
    String senderId,
    String receiverId,
    String type,
    String content,
    String fileUrl,
    String fileName,
    List<String> reactions,
    Set<String> deletedForUsers,
    Set<String> seenBy,
    String createdAt,
    String updatedAt,
    boolean recalled
) {
}
