package com.zola.chat.application.port.out;

import com.zola.chat.domain.model.ConversationMetadata;

import java.util.List;
import java.util.Optional;

public interface ConversationMetadataPort {

    List<ConversationMetadata> findByParticipantId(String userId);

    Optional<ConversationMetadata> findById(String conversationId);
}
