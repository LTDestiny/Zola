package com.zola.chat.chatrealtime.service;

import com.zola.chat.exception.BusinessRuleException;
import com.zola.common.response.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Service
public class FriendshipPolicyService {

    private static final ParameterizedTypeReference<ApiResponse<Map<String, Object>>> FRIENDSHIP_STATUS_RESPONSE =
        new ParameterizedTypeReference<>() {
        };

    private final RestClient restClient;
    private final String userServiceUrl;

    public FriendshipPolicyService(@Value("${services.user-url:http://localhost:8082}") String userServiceUrl) {
        this.restClient = RestClient.builder().build();
        this.userServiceUrl = userServiceUrl;
    }

    public void assertUsersAreFriends(String actorId, String targetUserId) {
        if (actorId == null || actorId.isBlank() || targetUserId == null || targetUserId.isBlank()) {
            throw new IllegalArgumentException("actorId and targetUserId must not be blank");
        }
        if (actorId.equals(targetUserId)) {
            throw new BusinessRuleException(
                HttpStatus.BAD_REQUEST,
                "CHAT_INVALID_MEMBER_SELECTION",
                "Cannot add yourself as a group member"
            );
        }

        try {
            ApiResponse<Map<String, Object>> response = restClient.get()
                .uri(
                    userServiceUrl + "/api/v1/users/friendships/status?targetUserId={targetUserId}",
                    Map.of("targetUserId", targetUserId)
                )
                .header("X-User-Id", actorId)
                .retrieve()
                .body(FRIENDSHIP_STATUS_RESPONSE);

            String status = "NONE";
            if (response != null && response.data() != null && response.data().get("status") != null) {
                status = String.valueOf(response.data().get("status"));
            }

            if (!"ACCEPTED".equalsIgnoreCase(status)) {
                throw new BusinessRuleException(
                    HttpStatus.FORBIDDEN,
                    "CHAT_FRIEND_REQUIRED",
                    "Only friends can be added directly. Share invite link for non-friends"
                );
            }
        } catch (BusinessRuleException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new BusinessRuleException(
                HttpStatus.BAD_GATEWAY,
                "CHAT_FRIENDSHIP_CHECK_FAILED",
                "Cannot verify friendship right now"
            );
        }
    }
}
