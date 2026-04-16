package com.zola.chat.infrastructure.persistence.postgres;

import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class PostgresMessageHiddenRepository {

    private final MessageHiddenJpaRepository messageHiddenJpaRepository;

    public PostgresMessageHiddenRepository(MessageHiddenJpaRepository messageHiddenJpaRepository) {
        this.messageHiddenJpaRepository = messageHiddenJpaRepository;
    }

    public void saveHidden(String userId, String messageId) {
        if (messageHiddenJpaRepository.existsByUserIdAndMessageId(userId, messageId)) {
            return;
        }

        MessageHiddenEntity entity = new MessageHiddenEntity();
        entity.setId(UUID.randomUUID());
        entity.setUserId(userId);
        entity.setMessageId(messageId);
        entity.setCreatedAt(Instant.now());
        messageHiddenJpaRepository.save(entity);
    }
}
