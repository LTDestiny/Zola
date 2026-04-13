package com.zola.chat.infrastructure.persistence.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface RealtimeMessageRepository extends MongoRepository<MessageDocument, String> {

    List<MessageDocument> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    Optional<MessageDocument> findByConversationIdAndId(String conversationId, String id);
}
