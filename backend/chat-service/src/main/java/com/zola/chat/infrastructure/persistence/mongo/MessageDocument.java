package com.zola.chat.infrastructure.persistence.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Document(collection = "messages")
public class MessageDocument {

    @Id
    private String id;
    private String conversationId;
    private String senderId;
    private String receiverId;
    private String type;
    private String content;
    private String fileUrl;
    private String fileName;
    private List<String> reactions;
    private boolean recalled;
    private String recalledBy;
    private String recalledAt;
    private Set<String> deletedForUsers = new HashSet<>();
    private Set<String> seenBy = new HashSet<>();
    private String createdAt;
    private String updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public List<String> getReactions() {
        return reactions;
    }

    public void setReactions(List<String> reactions) {
        this.reactions = reactions;
    }

    public boolean isRecalled() {
        return recalled;
    }

    public void setRecalled(boolean recalled) {
        this.recalled = recalled;
    }

    public String getRecalledBy() {
        return recalledBy;
    }

    public void setRecalledBy(String recalledBy) {
        this.recalledBy = recalledBy;
    }

    public String getRecalledAt() {
        return recalledAt;
    }

    public void setRecalledAt(String recalledAt) {
        this.recalledAt = recalledAt;
    }

    public Set<String> getDeletedForUsers() {
        return deletedForUsers;
    }

    public void setDeletedForUsers(Set<String> deletedForUsers) {
        this.deletedForUsers = deletedForUsers;
    }

    public Set<String> getSeenBy() {
        return seenBy;
    }

    public void setSeenBy(Set<String> seenBy) {
        this.seenBy = seenBy;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
