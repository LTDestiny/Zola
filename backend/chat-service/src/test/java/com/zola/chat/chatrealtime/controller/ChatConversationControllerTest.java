package com.zola.chat.chatrealtime.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zola.chat.chatrealtime.dto.ConversationListItemResponse;
import com.zola.chat.chatrealtime.service.ChatRealtimeService;
import com.zola.chat.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatConversationController.class)
@AutoConfigureMockMvc(addFilters = false)
class ChatConversationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatRealtimeService chatRealtimeService;

    @MockBean
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void addMember_shouldSucceedForFriend() throws Exception {
        UUID conversationId = UUID.randomUUID();
        ConversationListItemResponse response = new ConversationListItemResponse(
            conversationId.toString(),
            "group",
            "Team",
            null,
            "",
            Instant.now(),
            0,
            null,
            null,
            List.of("actor", "friend-1"),
            List.of("actor"),
            "actor",
            "actor",
            false
        );
        when(chatRealtimeService.addGroupMember(anyString(), any(UUID.class), anyString()))
            .thenReturn(new ChatRealtimeService.GroupActionResult(response, null));

        mockMvc.perform(post("/api/v1/chat/conversations/{conversationId}/add-member", conversationId)
                .header("X-User-Id", "actor")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new GroupMemberRequestBody("friend-1"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void addMember_shouldRejectStranger() throws Exception {
        UUID conversationId = UUID.randomUUID();
        when(chatRealtimeService.addGroupMember(anyString(), any(UUID.class), anyString()))
            .thenThrow(new BusinessRuleException(
                HttpStatus.FORBIDDEN,
                "CHAT_FRIEND_REQUIRED",
                "Only friends can be added directly"
            ));

        mockMvc.perform(post("/api/v1/chat/conversations/{conversationId}/add-member", conversationId)
                .header("X-User-Id", "actor")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new GroupMemberRequestBody("stranger"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.data.code").value("CHAT_FRIEND_REQUIRED"));
    }

    @Test
    void joinByInviteLink_shouldSucceedForValidCode() throws Exception {
        UUID conversationId = UUID.randomUUID();
        ConversationListItemResponse response = new ConversationListItemResponse(
            conversationId.toString(),
            "group",
            "Team",
            null,
            "",
            Instant.now(),
            0,
            null,
            null,
            List.of("owner", "actor"),
            List.of("owner"),
            "owner",
            "owner",
            false
        );
        when(chatRealtimeService.joinGroupByInviteCode(anyString(), anyString()))
            .thenReturn(new ChatRealtimeService.GroupActionResult(response, null));

        mockMvc.perform(post("/api/v1/chat/groups/join-by-link")
                .header("X-User-Id", "actor")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new JoinByLinkRequestBody("VALIDCODE"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void validateInviteLink_shouldRejectInvalidCode() throws Exception {
        when(chatRealtimeService.validateGroupInviteLink(anyString(), anyString()))
            .thenThrow(new BusinessRuleException(
                HttpStatus.NOT_FOUND,
                "CHAT_INVITE_LINK_INVALID",
                "Invite link is invalid or revoked"
            ));

        mockMvc.perform(get("/api/v1/chat/groups/invite-link/validate")
                .header("X-User-Id", "actor")
                .param("code", "INVALID"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.data.code").value("CHAT_INVITE_LINK_INVALID"));
    }

    private record GroupMemberRequestBody(String userId) {
    }

    private record JoinByLinkRequestBody(String code) {
    }
}
