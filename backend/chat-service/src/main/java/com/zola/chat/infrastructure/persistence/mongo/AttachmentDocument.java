package com.zola.chat.infrastructure.persistence.mongo;

/**
 * Embedded sub-document for a file attachment within a {@link MessageDocument}.
 * Stored inline in the MongoDB "messages" collection (no separate collection needed).
 */
public class AttachmentDocument {

    /** Original file name as chosen by the uploader. */
    private String fileName;

    /** S3 object key, e.g. "chat/2026/04/userId/uuid-photo.jpg". */
    private String fileKey;

    /** Public (CDN) URL for the file. */
    private String fileUrl;

    /** MIME type, e.g. "image/jpeg", "video/mp4", "application/pdf". */
    private String contentType;

    /** Semantic category: IMAGE | VIDEO | FILE. */
    private String mediaType;

    /** File size in bytes. */
    private long sizeBytes;

    /** 0-based display order among attachments in the same message. */
    private int sortOrder;

    // ── getters / setters ─────────────────────────────────────────────────────

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileKey() { return fileKey; }
    public void setFileKey(String fileKey) { this.fileKey = fileKey; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
