package com.zola.chat.repository;

import com.zola.chat.document.ConversationDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConversationRepository extends MongoRepository<ConversationDocument, String> {
}