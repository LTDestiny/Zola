package com.zola.chat.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

@Document(collection = "conversations")
public class ConversationDocument {

    @Id
    private String id;

    private String type;

    private String name;

    private String avatar;

    private List<String> participants;

    private List<String> members;

    private List<String> admins;

    @Field("owner_id")
    private String ownerId;

    @Field("only_admins_can_message")
    private Boolean onlyAdminsCanMessage;

    @Field("require_approval_to_join")
    private Boolean requireApprovalToJoin;

    @Field("allow_member_invite")
    private Boolean allowMemberInvite;

    @Field("invite_code")
    private String inviteCode;

    @Field("last_message")
    private String lastMessage;

    @Field("last_message_at")
    private String lastMessageAt;

    @Field("updated_at")
    private Instant updatedAt;

    @Field("created_at")
    private Instant createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public List<String> getParticipants() {
        if (participants != null && !participants.isEmpty()) {
            return participants;
        }
        return members == null ? Collections.emptyList() : members;
    }

    public void setParticipants(List<String> participants) {
        this.participants = participants;
        if (this.members == null || this.members.isEmpty()) {
            this.members = participants;
        }
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public List<String> getMembers() {
        if (members != null && !members.isEmpty()) {
            return members;
        }
        return participants == null ? Collections.emptyList() : participants;
    }

    public void setMembers(List<String> members) {
        this.members = members;
        if (this.participants == null || this.participants.isEmpty()) {
            this.participants = members;
        }
    }

    public List<String> getAdmins() {
        return admins;
    }

    public void setAdmins(List<String> admins) {
        this.admins = admins;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public boolean isOnlyAdminsCanMessage() {
        return Boolean.TRUE.equals(onlyAdminsCanMessage);
    }

    public void setOnlyAdminsCanMessage(Boolean onlyAdminsCanMessage) {
        this.onlyAdminsCanMessage = onlyAdminsCanMessage;
    }

    public boolean isRequireApprovalToJoin() {
        return Boolean.TRUE.equals(requireApprovalToJoin);
    }

    public void setRequireApprovalToJoin(Boolean requireApprovalToJoin) {
        this.requireApprovalToJoin = requireApprovalToJoin;
    }

    public boolean isAllowMemberInvite() {
        return allowMemberInvite == null || allowMemberInvite;
    }

    public void setAllowMemberInvite(Boolean allowMemberInvite) {
        this.allowMemberInvite = allowMemberInvite;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public String getLastMessage() {
        return lastMessage;
    }

    public void setLastMessage(String lastMessage) {
        this.lastMessage = lastMessage;
    }

    public String getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(String lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
