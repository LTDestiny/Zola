package com.zola.chat.repository;

import com.zola.chat.document.ConversationDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ConversationRepository extends MongoRepository<ConversationDocument, String> {
	List<ConversationDocument> findByParticipantsContains(String userId);
}