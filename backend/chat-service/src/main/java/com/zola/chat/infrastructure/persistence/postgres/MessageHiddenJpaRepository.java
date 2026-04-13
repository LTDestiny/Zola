package com.zola.chat.infrastructure.persistence.postgres;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageHiddenJpaRepository extends JpaRepository<MessageHiddenEntity, UUID> {

    boolean existsByUserIdAndMessageId(String userId, String messageId);
}
