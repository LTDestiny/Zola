package com.zola.ai.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ai_chat_messages")
public class AiChatMessage {
    @Id
    private String id;
    private String userId;
    private String role; // "user" or "model"
    private String content;
    private Instant timestamp;
}
