package com.zola.chat.application.port.in;

import com.zola.chat.application.dto.ConversationSummaryDto;
import com.zola.chat.application.dto.MessageDto;

import java.util.List;

public interface ConversationQueryUseCase {

    List<ConversationSummaryDto> getConversations(String userId);

    List<MessageDto> getMessages(String userId, String conversationId);
}
