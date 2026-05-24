package com.zola.user.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zola.user.entity.FriendshipEntity;
import com.zola.user.entity.MessageBlockEntity;
import com.zola.user.repository.FriendshipRepository;
import com.zola.user.repository.MessageBlockRepository;
import com.zola.user.service.FriendEventPublisher;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class FriendshipControllerTest {

    private static final String CURRENT_USER_ID = "11111111-1111-1111-1111-111111111111";
    private static final String TARGET_USER_ID = "22222222-2222-2222-2222-222222222222";
    private static final String OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private MessageBlockRepository messageBlockRepository;

    @Mock
    private FriendEventPublisher friendEventPublisher;

    private FriendshipController controller;

    @BeforeEach
    void setUp() {
        controller = new FriendshipController(friendshipRepository, messageBlockRepository, friendEventPublisher);
    }

    @Test
    void getStatusV2ReturnsNoneWhenNoRelationshipExists() {
        UUID currentUserId = UUID.fromString(CURRENT_USER_ID);
        UUID targetUserId = UUID.fromString(TARGET_USER_ID);
        when(messageBlockRepository.findAllBetweenUsers(currentUserId, targetUserId)).thenReturn(List.of());
        when(friendshipRepository.findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
            currentUserId,
            targetUserId,
            targetUserId,
            currentUserId
        )).thenReturn(Optional.empty());

        Map<String, Object> payload = controller.getStatusV2(CURRENT_USER_ID, targetUserId).data();

        assertEquals("NONE", payload.get("status"));
        assertNull(payload.get("friendshipId"));
        assertNull(payload.get("requestId"));
    }

    @Test
    void addFriendCreatesOutgoingPendingRequest() {
        UUID currentUserId = UUID.fromString(CURRENT_USER_ID);
        UUID targetUserId = UUID.fromString(TARGET_USER_ID);
        when(messageBlockRepository.findAllBetweenUsers(currentUserId, targetUserId)).thenReturn(List.of());
        when(friendshipRepository.findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
            currentUserId,
            targetUserId,
            targetUserId,
            currentUserId
        )).thenReturn(Optional.empty());
        when(friendshipRepository.save(any(FriendshipEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> payload = controller.addFriend(
            CURRENT_USER_ID,
            new FriendshipController.AddFriendRequest(targetUserId)
        ).data();

        assertEquals("PENDING", payload.get("status"));
        assertEquals(CURRENT_USER_ID, payload.get("requesterId"));
        assertEquals(TARGET_USER_ID, payload.get("addresseeId"));
        verify(friendEventPublisher).publishFriendRequestReceived(eq(targetUserId), any(UUID.class), eq(currentUserId));
    }

    @Test
    void addFriendRejectsSendingRequestToSelf() {
        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> controller.addFriend(
                CURRENT_USER_ID,
                new FriendshipController.AddFriendRequest(UUID.fromString(CURRENT_USER_ID))
            )
        );

        assertEquals(400, exception.getStatusCode().value());
    }

    @Test
    void cancelRequestMarksPendingRequestAsCancelled() {
        UUID friendshipId = UUID.randomUUID();
        FriendshipEntity relation = friendship(friendshipId, CURRENT_USER_ID, TARGET_USER_ID, "PENDING");
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(relation));
        when(friendshipRepository.save(relation)).thenReturn(relation);

        Map<String, Object> payload = controller.cancelRequest(CURRENT_USER_ID, friendshipId).data();

        assertEquals("CANCELLED", payload.get("status"));
        verify(friendEventPublisher).publishFriendRequestCancelled(
            UUID.fromString(CURRENT_USER_ID),
            UUID.fromString(TARGET_USER_ID),
            friendshipId
        );
    }

    @Test
    void acceptRequestMarksIncomingRequestAsAccepted() {
        UUID friendshipId = UUID.randomUUID();
        FriendshipEntity relation = friendship(friendshipId, TARGET_USER_ID, CURRENT_USER_ID, "PENDING");
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(relation));
        when(friendshipRepository.save(relation)).thenReturn(relation);

        Map<String, Object> payload = controller.acceptRequest(CURRENT_USER_ID, friendshipId).data();

        assertEquals("ACCEPTED", payload.get("status"));
        verify(friendEventPublisher).publishFriendRequestAccepted(
            UUID.fromString(TARGET_USER_ID),
            UUID.fromString(CURRENT_USER_ID),
            friendshipId
        );
    }

    @Test
    void declineRequestMarksIncomingRequestAsRejected() {
        UUID friendshipId = UUID.randomUUID();
        FriendshipEntity relation = friendship(friendshipId, TARGET_USER_ID, CURRENT_USER_ID, "PENDING");
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(relation));
        when(friendshipRepository.save(relation)).thenReturn(relation);

        Map<String, Object> payload = controller.declineRequest(CURRENT_USER_ID, friendshipId).data();

        assertEquals("REJECTED", payload.get("status"));
        verify(friendEventPublisher).publishFriendRequestDeclined(UUID.fromString(TARGET_USER_ID), friendshipId);
    }

    @Test
    void removeFriendDeletesAcceptedRelationship() {
        UUID friendshipId = UUID.randomUUID();
        FriendshipEntity relation = friendship(friendshipId, CURRENT_USER_ID, TARGET_USER_ID, "ACCEPTED");
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(relation));

        Map<String, Object> payload = controller.removeFriend(CURRENT_USER_ID, friendshipId).data();

        assertEquals("NONE", payload.get("status"));
        verify(friendshipRepository).delete(relation);
        verify(friendEventPublisher).publishFriendshipRemoved(
            UUID.fromString(CURRENT_USER_ID),
            UUID.fromString(TARGET_USER_ID),
            friendshipId
        );
    }

    @Test
    void blockAndUnblockMutationsReturnExpectedRelationshipStatus() {
        UUID currentUserId = UUID.fromString(CURRENT_USER_ID);
        UUID targetUserId = UUID.fromString(TARGET_USER_ID);
        FriendshipEntity relation = friendship(UUID.randomUUID(), CURRENT_USER_ID, TARGET_USER_ID, "ACCEPTED");
        MessageBlockEntity block = block(currentUserId, targetUserId);

        when(messageBlockRepository.findByBlockerIdAndBlockedUserId(currentUserId, targetUserId)).thenReturn(Optional.empty(), Optional.of(block));
        when(messageBlockRepository.save(any(MessageBlockEntity.class))).thenReturn(block);
        when(friendshipRepository.findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
            currentUserId,
            targetUserId,
            targetUserId,
            currentUserId
        )).thenReturn(Optional.of(relation), Optional.empty());
        when(messageBlockRepository.findAllBetweenUsers(currentUserId, targetUserId)).thenReturn(List.of(block), List.of());

        Map<String, Object> blockedPayload = controller.blockUser(
            CURRENT_USER_ID,
            new FriendshipController.BlockUserRequest(targetUserId)
        ).data();
        assertEquals("BLOCKED_BY_ME", blockedPayload.get("status"));
        verify(friendshipRepository).delete(relation);

        Map<String, Object> unblockedPayload = controller.unblockUser(CURRENT_USER_ID, targetUserId).data();
        assertEquals("NONE", unblockedPayload.get("status"));
        verify(messageBlockRepository).delete(block);
    }

    @Test
    void incomingRequestsOnlyReturnPendingRequestsForCurrentReceiver() {
        UUID currentUserId = UUID.fromString(CURRENT_USER_ID);
        FriendshipEntity pending = friendship(UUID.randomUUID(), OTHER_USER_ID, CURRENT_USER_ID, "PENDING");
        when(friendshipRepository.findAllByAddresseeIdAndStatus(currentUserId, "PENDING")).thenReturn(List.of(pending));

        List<FriendshipController.PendingFriendRequest> payload = controller.getPendingRequests(CURRENT_USER_ID).data();

        assertEquals(1, payload.size());
        assertEquals(OTHER_USER_ID, payload.get(0).requesterId().toString());
        assertEquals(CURRENT_USER_ID, payload.get(0).addresseeId().toString());
    }

    @Test
    void sentRequestsOnlyReturnPendingRequestsForCurrentSender() {
        UUID currentUserId = UUID.fromString(CURRENT_USER_ID);
        FriendshipEntity pending = friendship(UUID.randomUUID(), CURRENT_USER_ID, OTHER_USER_ID, "PENDING");
        when(friendshipRepository.findAllByRequesterIdAndStatus(currentUserId, "PENDING")).thenReturn(List.of(pending));

        List<FriendshipController.PendingFriendRequest> payload = controller.getSentPendingRequests(CURRENT_USER_ID).data();

        assertEquals(1, payload.size());
        assertEquals(CURRENT_USER_ID, payload.get(0).requesterId().toString());
        assertEquals(OTHER_USER_ID, payload.get(0).addresseeId().toString());
    }

    private FriendshipEntity friendship(UUID id, String requesterId, String addresseeId, String status) {
        FriendshipEntity entity = new FriendshipEntity();
        entity.setId(id);
        entity.setRequesterId(UUID.fromString(requesterId));
        entity.setAddresseeId(UUID.fromString(addresseeId));
        entity.setStatus(status);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }

    private MessageBlockEntity block(UUID blockerId, UUID blockedUserId) {
        MessageBlockEntity block = new MessageBlockEntity();
        block.setId(UUID.randomUUID());
        block.setBlockerId(blockerId);
        block.setBlockedUserId(blockedUserId);
        block.setCreatedAt(Instant.now());
        block.setUpdatedAt(Instant.now());
        return block;
    }
}
