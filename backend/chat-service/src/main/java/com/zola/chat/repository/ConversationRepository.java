package com.zola.chat.repository;

import com.zola.chat.document.ConversationDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<ConversationDocument, String> {
	List<ConversationDocument> findByParticipantsContains(String userId);

	List<ConversationDocument> findByMembersContains(String userId);

	@Query("{ $or: [ { 'members': ?0 }, { 'participants': ?0 } ] }")
	List<ConversationDocument> findByMemberOrParticipant(String userId);

	Optional<ConversationDocument> findByInviteCode(String inviteCode);
}