package com.zola.chat.infrastructure.persistence.postgres;

import com.zola.chat.exception.ResourceNotFoundException;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class PostgresConversationRepository {

    private final ConversationJpaRepository conversationJpaRepository;

    public PostgresConversationRepository(ConversationJpaRepository conversationJpaRepository) {
        this.conversationJpaRepository = conversationJpaRepository;
    }

    public ConversationEntity getOrCreateDirect(String userA, String userB) {
        return conversationJpaRepository.findDirectConversation(userA, userB)
            .orElseGet(() -> {
                ConversationEntity entity = new ConversationEntity();
                entity.setId(UUID.randomUUID());
                if (userA.compareTo(userB) <= 0) {
                    entity.setUser1Id(userA);
                    entity.setUser2Id(userB);
                } else {
                    entity.setUser1Id(userB);
                    entity.setUser2Id(userA);
                }
                entity.setLastMessage("");
                entity.setLastMessageAt(Instant.now());
                entity.setUpdatedAt(Instant.now());
                entity.setUser1UnreadCount(0);
                entity.setUser2UnreadCount(0);
                return conversationJpaRepository.save(entity);
            });
    }

    public ConversationEntity findById(UUID id) {
        return conversationJpaRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
    }

    public boolean isMember(ConversationEntity entity, String userId) {
        return entity.getUser1Id().equals(userId) || entity.getUser2Id().equals(userId);
    }

    public List<ConversationEntity> findByParticipant(String userId) {
        return conversationJpaRepository.findByParticipant(userId);
    }

    public ConversationEntity save(ConversationEntity entity) {
        return conversationJpaRepository.save(entity);
    }

    public int sumUnreadByParticipant(String userId) {
        return conversationJpaRepository.sumUnreadByParticipant(userId);
    }
}
