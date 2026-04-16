package com.zola.chat.infrastructure.persistence.postgres;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversation")
public class ConversationEntity {

    @Id
    private UUID id;

    @Column(name = "user1_id", nullable = false, length = 64)
    private String user1Id;

    @Column(name = "user2_id", nullable = false, length = 64)
    private String user2Id;

    @Column(name = "last_message")
    private String lastMessage;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    @Column(name = "user1_unread_count", nullable = false)
    private int user1UnreadCount;

    @Column(name = "user2_unread_count", nullable = false)
    private int user2UnreadCount;

    @Column(name = "user1_last_read_at")
    private Instant user1LastReadAt;

    @Column(name = "user2_last_read_at")
    private Instant user2LastReadAt;

    @Column(name = "user1_last_read_message_id", length = 128)
    private String user1LastReadMessageId;

    @Column(name = "user2_last_read_message_id", length = 128)
    private String user2LastReadMessageId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getUser1Id() {
        return user1Id;
    }

    public void setUser1Id(String user1Id) {
        this.user1Id = user1Id;
    }

    public String getUser2Id() {
        return user2Id;
    }

    public void setUser2Id(String user2Id) {
        this.user2Id = user2Id;
    }

    public String getLastMessage() {
        return lastMessage;
    }

    public void setLastMessage(String lastMessage) {
        this.lastMessage = lastMessage;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(Instant lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    public int getUser1UnreadCount() {
        return user1UnreadCount;
    }

    public void setUser1UnreadCount(int user1UnreadCount) {
        this.user1UnreadCount = user1UnreadCount;
    }

    public int getUser2UnreadCount() {
        return user2UnreadCount;
    }

    public void setUser2UnreadCount(int user2UnreadCount) {
        this.user2UnreadCount = user2UnreadCount;
    }

    public Instant getUser1LastReadAt() {
        return user1LastReadAt;
    }

    public void setUser1LastReadAt(Instant user1LastReadAt) {
        this.user1LastReadAt = user1LastReadAt;
    }

    public Instant getUser2LastReadAt() {
        return user2LastReadAt;
    }

    public void setUser2LastReadAt(Instant user2LastReadAt) {
        this.user2LastReadAt = user2LastReadAt;
    }

    public String getUser1LastReadMessageId() {
        return user1LastReadMessageId;
    }

    public void setUser1LastReadMessageId(String user1LastReadMessageId) {
        this.user1LastReadMessageId = user1LastReadMessageId;
    }

    public String getUser2LastReadMessageId() {
        return user2LastReadMessageId;
    }

    public void setUser2LastReadMessageId(String user2LastReadMessageId) {
        this.user2LastReadMessageId = user2LastReadMessageId;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public int unreadCountOf(String userId) {
        if (user1Id.equals(userId)) {
            return user1UnreadCount;
        }
        if (user2Id.equals(userId)) {
            return user2UnreadCount;
        }
        return 0;
    }

    public void incrementUnread(String userId) {
        if (user1Id.equals(userId)) {
            user1UnreadCount += 1;
        } else if (user2Id.equals(userId)) {
            user2UnreadCount += 1;
        }
    }

    public void markRead(String userId, Instant readAt, String messageId) {
        if (user1Id.equals(userId)) {
            user1UnreadCount = 0;
            user1LastReadAt = readAt;
            if (messageId != null && !messageId.isBlank()) {
                user1LastReadMessageId = messageId;
            }
            return;
        }
        if (user2Id.equals(userId)) {
            user2UnreadCount = 0;
            user2LastReadAt = readAt;
            if (messageId != null && !messageId.isBlank()) {
                user2LastReadMessageId = messageId;
            }
        }
    }

    public String lastReadMessageIdOf(String userId) {
        if (user1Id.equals(userId)) {
            return user1LastReadMessageId;
        }
        if (user2Id.equals(userId)) {
            return user2LastReadMessageId;
        }
        return null;
    }
}
