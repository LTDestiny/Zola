package com.zola.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "friendships")
public class FriendshipEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID requesterId;

    @Column(nullable = false)
    private UUID addresseeId;

    @Column(nullable = false)
    private String status;
}