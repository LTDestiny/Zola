package com.zola.chat.document;

import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

public class PinnedMessageItem {

    @Field("source_message_id")
    private String sourceMessageId;

    private String title;

    private String preview;

    @Field("created_at")
    private Instant createdAt;

    public String getSourceMessageId() {
        return sourceMessageId;
    }

    public void setSourceMessageId(String sourceMessageId) {
        this.sourceMessageId = sourceMessageId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getPreview() {
        return preview;
    }

    public void setPreview(String preview) {
        this.preview = preview;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
