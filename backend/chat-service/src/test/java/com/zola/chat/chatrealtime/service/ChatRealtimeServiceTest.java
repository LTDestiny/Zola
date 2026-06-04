package com.zola.chat.chatrealtime.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zola.chat.document.ConversationDocument;
import com.zola.chat.document.PinnedMessageItem;
import com.zola.chat.exception.ForbiddenOperationException;
import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import com.zola.chat.infrastructure.persistence.mongo.MessageDocument;
import com.zola.chat.infrastructure.persistence.mongo.RealtimeMessageRepository;
import com.zola.chat.infrastructure.persistence.postgres.ConversationEntity;
import com.zola.chat.infrastructure.persistence.postgres.PostgresConversationRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresMessageHiddenRepository;
import com.zola.chat.infrastructure.persistence.postgres.UserPinnedConversationRepository;
import com.zola.chat.integration.UserRelationshipClient;
import com.zola.chat.presence.PresenceManager;
import com.zola.chat.repository.ConversationRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ChatRealtimeServiceTest {

    private static final String OWNER_ID = "11111111-1111-1111-1111-111111111111";
    private static final String MEMBER_ID = "22222222-2222-2222-2222-222222222222";

    @Mock
    private PostgresConversationRepository conversationRepository;

    @Mock
    private ConversationRepository groupConversationRepository;

    @Mock
    private UserPinnedConversationRepository pinnedConversationRepository;

    @Mock
    private RealtimeMessageRepository messageRepository;

    @Mock
    private RedisOnlineUserChecker onlineUserChecker;

    @Mock
    private PresenceManager presenceManager;

    @Mock
    private PostgresMessageHiddenRepository messageHiddenRepository;

    @Mock
    private UserRelationshipClient userRelationshipClient;

    private ChatRealtimeService service;

    @BeforeEach
    void setUp() {
        service = new ChatRealtimeService(
            conversationRepository,
            groupConversationRepository,
            pinnedConversationRepository,
            messageRepository,
            onlineUserChecker,
            presenceManager,
            messageHiddenRepository,
            userRelationshipClient,
            new com.fasterxml.jackson.databind.ObjectMapper(),
            900,
            86_400
        );
    }

    @Test
    void pinGroupMessageAddsPinnedMessageToSettingsPayload() {
        UUID conversationId = UUID.randomUUID();
        ConversationDocument conversation = groupConversation(conversationId.toString());
        MessageDocument message = message("msg-1", conversationId.toString(), "TEXT", "Pinned hello");

        when(groupConversationRepository.findById(conversationId.toString())).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdAndId(conversationId.toString(), "msg-1")).thenReturn(Optional.of(message));
        when(groupConversationRepository.save(any(ConversationDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> payload = service.pinGroupMessage(OWNER_ID, conversationId, "msg-1");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pinnedMessages = (List<Map<String, Object>>) payload.get("pinnedMessages");
        assertEquals(1, pinnedMessages.size());
        assertEquals("msg-1", pinnedMessages.get(0).get("sourceMessageId"));
        verify(groupConversationRepository).save(any(ConversationDocument.class));
    }

    @Test
    void unpinGroupMessageRemovesPinnedMessageFromSettingsPayload() {
        UUID conversationId = UUID.randomUUID();
        ConversationDocument conversation = groupConversation(conversationId.toString());
        PinnedMessageItem pinned = new PinnedMessageItem();
        pinned.setSourceMessageId("msg-1");
        pinned.setTitle("Pinned message");
        pinned.setPreview("Preview");
        pinned.setCreatedAt(Instant.now());
        conversation.setPinnedMessages(new ArrayList<>(List.of(pinned)));

        when(groupConversationRepository.findById(conversationId.toString())).thenReturn(Optional.of(conversation));
        when(groupConversationRepository.save(any(ConversationDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> payload = service.unpinGroupMessage(OWNER_ID, conversationId, "msg-1");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pinnedMessages = (List<Map<String, Object>>) payload.get("pinnedMessages");
        assertEquals(0, pinnedMessages.size());
    }

    @Test
    void unpinGroupMessageIgnoresMissingPinnedMessage() {
        UUID conversationId = UUID.randomUUID();
        ConversationDocument conversation = groupConversation(conversationId.toString());

        when(groupConversationRepository.findById(conversationId.toString())).thenReturn(Optional.of(conversation));
        when(groupConversationRepository.save(any(ConversationDocument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> payload = service.unpinGroupMessage(OWNER_ID, conversationId, "missing-message");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pinnedMessages = (List<Map<String, Object>>) payload.get("pinnedMessages");
        assertEquals(0, pinnedMessages.size());
    }

    @Test
    void sendMessageHttpRejectsPrivateMessagesWhenUsersAreBlocked() {
        UUID conversationId = UUID.randomUUID();
        ConversationEntity conversation = new ConversationEntity();
        conversation.setId(conversationId);
        conversation.setType("private");
        conversation.setUser1Id(OWNER_ID);
        conversation.setUser2Id(MEMBER_ID);
        conversation.setLastMessage("");
        conversation.setLastMessageAt(Instant.now());
        conversation.setUpdatedAt(Instant.now());

        when(conversationRepository.findOptionalById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversationRepository.isMember(conversation, OWNER_ID)).thenReturn(true);
        when(userRelationshipClient.isMessagingBlocked(OWNER_ID, MEMBER_ID)).thenReturn(true);

        assertThrows(
            ForbiddenOperationException.class,
            () -> service.sendMessageHttp(OWNER_ID, conversationId, "TEXT", "blocked", null, null, null)
        );
    }

    @Test
    void sendMessageHttpRejectsPrivateMessagesWhenUsersAreNotFriends() {
        UUID conversationId = UUID.randomUUID();
        ConversationEntity conversation = new ConversationEntity();
        conversation.setId(conversationId);
        conversation.setType("private");
        conversation.setUser1Id(OWNER_ID);
        conversation.setUser2Id(MEMBER_ID);
        conversation.setLastMessage("");
        conversation.setLastMessageAt(Instant.now());
        conversation.setUpdatedAt(Instant.now());

        when(conversationRepository.findOptionalById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversationRepository.isMember(conversation, OWNER_ID)).thenReturn(true);
        when(userRelationshipClient.isMessagingBlocked(OWNER_ID, MEMBER_ID)).thenReturn(false);
        when(userRelationshipClient.areFriends(OWNER_ID, MEMBER_ID)).thenReturn(false);

        assertThrows(
            ForbiddenOperationException.class,
            () -> service.sendMessageHttp(OWNER_ID, conversationId, "TEXT", "stranger", null, null, null)
        );
    }

    @Test
    void sendMessageHttpRejectsNonAdminWhenGroupIsAdminOnly() {
        UUID conversationId = UUID.randomUUID();
        ConversationDocument conversation = groupConversation(conversationId.toString());
        conversation.setOnlyAdminsCanMessage(true);

        when(groupConversationRepository.findById(conversationId.toString())).thenReturn(Optional.of(conversation));

        assertThrows(
            ForbiddenOperationException.class,
            () -> service.sendMessageHttp(MEMBER_ID, conversationId, "TEXT", "member message", null, null, null)
        );
    }

    private ConversationDocument groupConversation(String conversationId) {
        ConversationDocument conversation = new ConversationDocument();
        conversation.setId(conversationId);
        conversation.setType("group");
        conversation.setOwnerId(OWNER_ID);
        conversation.setMembers(new ArrayList<>(List.of(OWNER_ID, MEMBER_ID)));
        conversation.setParticipants(new ArrayList<>(List.of(OWNER_ID, MEMBER_ID)));
        conversation.setAdmins(new ArrayList<>(List.of(OWNER_ID)));
        conversation.setPinnedMessages(new ArrayList<>());
        conversation.setPendingMembers(new ArrayList<>());
        conversation.setName("Group");
        conversation.setLastMessage("");
        conversation.setLastMessageAt(Instant.now().toString());
        conversation.setUpdatedAt(Instant.now());
        conversation.setCreatedAt(Instant.now());
        return conversation;
    }

    private MessageDocument message(String id, String conversationId, String type, String content) {
        MessageDocument message = new MessageDocument();
        message.setId(id);
        message.setConversationId(conversationId);
        message.setType(type);
        message.setContent(content);
        message.setSenderId(OWNER_ID);
        message.setReceiverId(null);
        message.setCreatedAt(Instant.now().toString());
        message.setUpdatedAt(Instant.now().toString());
        return message;
    }
}
