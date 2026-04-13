package com.zola.chat.application.port.out;

import com.zola.chat.domain.model.ChatMessage;

import java.util.List;
import java.util.Optional;

public interface MessageStoragePort {

    List<ChatMessage> findByConversationId(String conversationId);

    Optional<ChatMessage> findLatestByConversationId(String conversationId);

    ChatMessage save(ChatMessage message);
}
