package com.zola.chat.application.service;

import com.zola.chat.application.dto.ConversationSummaryDto;
import com.zola.chat.application.dto.MessageDto;
import com.zola.chat.application.dto.SendMessageCommand;
import com.zola.chat.application.port.in.ConversationQueryUseCase;
import com.zola.chat.application.port.in.MessageCommandUseCase;
import com.zola.chat.application.port.out.ConversationMetadataPort;
import com.zola.chat.application.port.out.MessageStoragePort;

import java.util.Collections;
import java.util.List;

/**
 * Step-1 skeleton service.
 * Real business rules and mapping will be implemented in following steps.
 */
public class ChatApplicationService implements ConversationQueryUseCase, MessageCommandUseCase {

    private final ConversationMetadataPort conversationMetadataPort;
    private final MessageStoragePort messageStoragePort;

    public ChatApplicationService(
        ConversationMetadataPort conversationMetadataPort,
        MessageStoragePort messageStoragePort
    ) {
        this.conversationMetadataPort = conversationMetadataPort;
        this.messageStoragePort = messageStoragePort;
    }

    @Override
    public List<ConversationSummaryDto> getConversations(String userId) {
        return Collections.emptyList();
    }

    @Override
    public List<MessageDto> getMessages(String userId, String conversationId) {
        return Collections.emptyList();
    }

    @Override
    public MessageDto sendMessage(SendMessageCommand command) {
        throw new UnsupportedOperationException("sendMessage will be implemented in Step 4");
    }
}
