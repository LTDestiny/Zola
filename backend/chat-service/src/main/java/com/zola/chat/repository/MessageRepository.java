package com.zola.chat.repository;

import com.zola.chat.document.MessageDocument;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<MessageDocument, ObjectId> {
    Optional<MessageDocument> findTopByConversationIdOrderByCreatedAtDesc(ObjectId conversationId);

    List<MessageDocument> findByConversationIdOrderByCreatedAtAsc(ObjectId conversationId);
}
