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
    /** Legacy single-file URL – populated from first attachment when attachments are present. */
    String fileUrl,
    /** Legacy single-file name – populated from first attachment when attachments are present. */
    String fileName,
    /** All attachments for this message. Empty list for TEXT messages. */
    List<AttachmentPayload> attachments,
    List<String> reactions,
    Set<String> deletedForUsers,
    Set<String> deliveredTo,
    Set<String> seenBy,
    String createdAt,
    String updatedAt,
    boolean recalled,
    boolean edited
) {
    public record AttachmentPayload(
        String fileName,
        String fileKey,
        String fileUrl,
        String contentType,
        String mediaType,
        long   sizeBytes,
        int    sortOrder
    ) {}
}

