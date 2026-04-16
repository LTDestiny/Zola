package com.zola.chat.chatrealtime.dto;

import java.util.List;

public record MessagesPageResponse(
    List<MessageItemResponse> items,
    String nextCursor
) {
}
