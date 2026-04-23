package com.zola.chat.chatrealtime.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

public record ChatSendRequest(
    UUID conversationId,
    @NotBlank String type,
    String content,
    /** Legacy single-file fields – kept for backward compat. Prefer {@code attachments}. */
    String fileUrl,
    String fileName,
    /**
     * Multi-file attachments for IMAGE/VIDEO/FILE messages.
     * When present the message type is automatically treated as MEDIA.
     * Max 10 items (enforced by file-service presign endpoint).
     */
    List<AttachmentInput> attachments,
    /** Optional: client-generated idempotency key (UUID). */
    String clientMessageId
) {
    public record AttachmentInput(
        String fileName,
        String fileKey,
        String fileUrl,
        String contentType,
        String mediaType,
        long   sizeBytes,
        int    sortOrder
    ) {}
}

