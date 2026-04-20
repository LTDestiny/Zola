package com.zola.chat.chatrealtime.service;

import com.zola.chat.chatrealtime.dto.ConversationListItemResponse;
import com.zola.chat.document.ConversationDocument;
import com.zola.chat.exception.BusinessRuleException;
import com.zola.chat.infrastructure.cache.RedisOnlineUserChecker;
import com.zola.chat.infrastructure.persistence.mongo.MessageDocument;
import com.zola.chat.infrastructure.persistence.mongo.RealtimeMessageRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresConversationRepository;
import com.zola.chat.infrastructure.persistence.postgres.PostgresMessageHiddenRepository;
import com.zola.chat.presence.PresenceManager;
import com.zola.chat.repository.ConversationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRealtimeServiceTest {

    @Mock
    private PostgresConversationRepository conversationRepository;
    @Mock
    private ConversationRepository groupConversationRepository;
    @Mock
    private RealtimeMessageRepository messageRepository;
    @Mock
    private RedisOnlineUserChecker onlineUserChecker;
    @Mock
    private PresenceManager presenceManager;
    @Mock
    private PostgresMessageHiddenRepository messageHiddenRepository;
    @Mock
    private FriendshipPolicyService friendshipPolicyService;

    private ChatRealtimeService service;

    @BeforeEach
    void setUp() {
        service = new ChatRealtimeService(
            conversationRepository,
            groupConversationRepository,
            messageRepository,
            onlineUserChecker,
            presenceManager,
            messageHiddenRepository,
            friendshipPolicyService,
            900,
            86400,
            24
        );

        lenient().when(messageRepository.findByConversationIdOrderByCreatedAtAsc(anyString())).thenReturn(List.of());
    }

    @Test
    void addGroupMember_shouldRejectNonFriend() {
        String actorId = "user-a";
        String targetId = "user-b";
        UUID conversationId = UUID.randomUUID();

        when(groupConversationRepository.findById(conversationId.toString()))
            .thenReturn(Optional.of(buildConversation(conversationId, List.of(actorId), Instant.now())));
        doThrow(new BusinessRuleException(HttpStatus.FORBIDDEN, "CHAT_FRIEND_REQUIRED", "Only friends can be added directly"))
            .when(friendshipPolicyService)
            .assertUsersAreFriends(actorId, targetId);

        BusinessRuleException error = assertThrows(
            BusinessRuleException.class,
            () -> service.addGroupMember(actorId, conversationId, targetId)
        );

        assertEquals("CHAT_FRIEND_REQUIRED", error.getCode());
        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
    }

    @Test
    void addGroupMember_shouldAddFriendSuccessfully() {
        String actorId = "user-a";
        String targetId = "user-b";
        UUID conversationId = UUID.randomUUID();

        ConversationDocument conversation = buildConversation(conversationId, List.of(actorId), Instant.now());
        when(groupConversationRepository.findById(conversationId.toString())).thenReturn(Optional.of(conversation));
        doNothing().when(friendshipPolicyService).assertUsersAreFriends(actorId, targetId);

        ChatRealtimeService.GroupActionResult result = service.addGroupMember(actorId, conversationId, targetId);
        ConversationListItemResponse response = result.conversation();

        assertNotNull(result.systemMessage());
        assertNotNull(response);
        assertEquals(2, response.participants().size());
    }

    @Test
    void joinGroupByInviteCode_shouldRejectExpiredInviteCode() {
        String actorId = "user-joiner";
        String code = "EXPIREDCODE";
        UUID conversationId = UUID.randomUUID();
        Instant issuedAt = Instant.now().minus(3, ChronoUnit.DAYS);

        ConversationDocument conversation = buildConversation(conversationId, List.of("owner"), issuedAt);
        conversation.setInviteCode(code);
        conversation.setInviteCodeIssuedAt(issuedAt);
        when(groupConversationRepository.findByInviteCode(code)).thenReturn(Optional.of(conversation));

        BusinessRuleException error = assertThrows(
            BusinessRuleException.class,
            () -> service.joinGroupByInviteCode(actorId, code)
        );

        assertEquals("CHAT_INVITE_LINK_EXPIRED", error.getCode());
    }

    @Test
    void joinGroupByInviteCode_shouldJoinWhenInviteCodeIsValid() {
        String actorId = "user-joiner";
        String code = "VALIDCODE12";
        UUID conversationId = UUID.randomUUID();

        ConversationDocument conversation = buildConversation(conversationId, List.of("owner"), Instant.now());
        conversation.setInviteCode(code);
        conversation.setInviteCodeIssuedAt(Instant.now());
        when(groupConversationRepository.findByInviteCode(code)).thenReturn(Optional.of(conversation));

        ChatRealtimeService.GroupActionResult result = service.joinGroupByInviteCode(actorId, code);

        assertNotNull(result.systemMessage());
        assertEquals(true, result.conversation().participants().contains(actorId));
    }

    private ConversationDocument buildConversation(UUID id, List<String> members, Instant issuedAt) {
        ConversationDocument conversation = new ConversationDocument();
        conversation.setId(id.toString());
        conversation.setType("group");
        conversation.setName("Test Group");
        conversation.setOwnerId(members.get(0));
        conversation.setMembers(members);
        conversation.setParticipants(members);
        conversation.setAdmins(List.of(members.get(0)));
        conversation.setAllowMemberInvite(true);
        conversation.setRequireApprovalToJoin(false);
        conversation.setInviteCode("CODE123456");
        conversation.setInviteCodeIssuedAt(issuedAt);
        conversation.setLastMessage("");
        conversation.setLastMessageAt(Instant.now().toString());
        conversation.setCreatedAt(Instant.now());
        conversation.setUpdatedAt(Instant.now());
        return conversation;
    }
}
