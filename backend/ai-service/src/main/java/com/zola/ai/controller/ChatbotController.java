package com.zola.ai.controller;

import com.zola.ai.document.AiChatMessage;
import com.zola.ai.dto.ChatRequest;
import com.zola.ai.dto.ChatResponse;
import com.zola.ai.service.GeminiService;
import com.zola.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class ChatbotController {

    private final GeminiService geminiService;

    @PostMapping("/chat")
    public ApiResponse<ChatResponse> chat(
        @RequestHeader("X-User-Id") String userId,
        @RequestBody ChatRequest request
    ) {
        ChatResponse response = geminiService.chat(userId, request);
        return ApiResponse.ok("Chat generated", response);
    }



    @GetMapping("/chat/history")
    public ApiResponse<List<AiChatMessage>> getHistory(
        @RequestHeader("X-User-Id") String userId
    ) {
        List<AiChatMessage> history = geminiService.getHistory(userId);
        return ApiResponse.ok("History fetched", history);
    }
}
