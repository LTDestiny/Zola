package com.zola.ai.repository;

import com.zola.ai.document.AiChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiChatMessageRepository extends MongoRepository<AiChatMessage, String> {
    List<AiChatMessage> findAllByUserIdOrderByTimestampAsc(String userId);
    void deleteByUserId(String userId);
}
