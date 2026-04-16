package com.zola.chat.chatrealtime.dto;

import java.util.List;
import java.util.Set;

public record MessageItemResponse(
    String id,
    String conversationId,
    String senderId,
    String receiverId,
    String type,
    String content,
    String fileUrl,
    String fileName,
    List<String> reactions,
    boolean recalled,
    Set<String> deletedForUsers,
    Set<String> deliveredTo,
    Set<String> seenBy,
    String createdAt,
    String updatedAt,
    boolean edited
) {
}
