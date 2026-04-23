package com.zola.chat.document;

import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

public class PendingGroupMemberItem {

    @Field("user_id")
    private String userId;

    @Field("requested_by_user_id")
    private String requestedByUserId;

    @Field("requested_at")
    private Instant requestedAt;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getRequestedByUserId() {
        return requestedByUserId;
    }

    public void setRequestedByUserId(String requestedByUserId) {
        this.requestedByUserId = requestedByUserId;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(Instant requestedAt) {
        this.requestedAt = requestedAt;
    }
}
