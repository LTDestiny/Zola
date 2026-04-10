package com.zola.user.repository;

import com.zola.user.entity.FriendshipEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<FriendshipEntity, UUID> {
}