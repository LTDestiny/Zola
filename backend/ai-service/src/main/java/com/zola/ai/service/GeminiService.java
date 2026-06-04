package com.zola.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zola.ai.document.AiChatMessage;
import com.zola.ai.dto.ChatRequest;
import com.zola.ai.dto.ChatResponse;
import com.zola.ai.repository.AiChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService {

    private final AiChatMessageRepository chatMessageRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${gemini.api.key:AQ.Ab8RN6J4NYHepW2o4sr0IsY4nQdOOvVLXlzZ2bkK0r75EKHrsw}")
    private String geminiApiKey;

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent}")
    private String geminiApiUrl;

    public ChatResponse chat(String userId, ChatRequest request) {
        // Save user message
        AiChatMessage userMessage = AiChatMessage.builder()
            .userId(userId)
            .role("user")
            .content(request.getContent())
            .timestamp(Instant.now())
            .build();
        chatMessageRepository.save(userMessage);

        // Fetch history
        List<AiChatMessage> history = chatMessageRepository.findAllByUserIdOrderByTimestampAsc(userId);

        // Build payload
        ObjectNode payload = objectMapper.createObjectNode();
        ArrayNode contents = payload.putArray("contents");

        for (AiChatMessage msg : history) {
            ObjectNode contentNode = contents.addObject();
            // Gemini uses "user" and "model"
            contentNode.put("role", msg.getRole());
            ArrayNode parts = contentNode.putArray("parts");
            parts.addObject().put("text", msg.getContent());
        }

        try {
            String url = geminiApiUrl + "?key=" + geminiApiKey;
            JsonNode responseNode = restClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(JsonNode.class);

            String responseText = "";
            if (responseNode != null && responseNode.has("candidates") && responseNode.get("candidates").size() > 0) {
                JsonNode firstCandidate = responseNode.get("candidates").get(0);
                if (firstCandidate.has("content") && firstCandidate.get("content").has("parts") && firstCandidate.get("content").get("parts").size() > 0) {
                    responseText = firstCandidate.get("content").get("parts").get(0).get("text").asText();
                }
            }

            if (responseText.isBlank()) {
                responseText = "Xin lỗi, tôi không thể trả lời lúc này.";
            }

            AiChatMessage modelMessage = AiChatMessage.builder()
                .userId(userId)
                .role("model")
                .content(responseText)
                .timestamp(Instant.now())
                .build();
            modelMessage = chatMessageRepository.save(modelMessage);

            return ChatResponse.builder()
                .id(modelMessage.getId())
                .role(modelMessage.getRole())
                .content(modelMessage.getContent())
                .timestamp(modelMessage.getTimestamp())
                .build();

        } catch (RestClientResponseException ex) {
            log.error("Gemini API Error: {}", ex.getResponseBodyAsString(), ex);
            throw new RuntimeException("Error communicating with Gemini API");
        } catch (Exception ex) {
            log.error("Error communicating with Gemini API", ex);
            throw new RuntimeException("Error communicating with Gemini API");
        }
    }



    public List<AiChatMessage> getHistory(String userId) {
        return chatMessageRepository.findAllByUserIdOrderByTimestampAsc(userId);
    }

    public void clearHistory(String userId) {
        chatMessageRepository.deleteByUserId(userId);
    }
}
