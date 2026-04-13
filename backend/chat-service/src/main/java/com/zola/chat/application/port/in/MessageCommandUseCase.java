package com.zola.chat.application.port.in;

import com.zola.chat.application.dto.MessageDto;
import com.zola.chat.application.dto.SendMessageCommand;

public interface MessageCommandUseCase {

    MessageDto sendMessage(SendMessageCommand command);
}
