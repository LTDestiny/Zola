package com.zola.user.service;

import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

class FriendEventPublisherTest {

    @Test
    void friendRequestReceivedUsesInternalSecretHeader() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        FriendEventPublisher publisher = new FriendEventPublisher(
            restTemplate,
            "http://chat-service:8083",
            "shared-secret"
        );
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        server.expect(once(), requestTo("http://chat-service:8083/api/v1/sync/users/" + addresseeId + "/emit"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-Internal-Gateway-Secret", "shared-secret"))
            .andExpect(jsonPath("$.userId").value(addresseeId.toString()))
            .andExpect(jsonPath("$.sourceClient").value("user-service"))
            .andExpect(jsonPath("$.eventType").value("FRIENDSHIP_REQUEST_RECEIVED"))
            .andExpect(jsonPath("$.payload").value(org.hamcrest.Matchers.containsString(friendshipId.toString())))
            .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        publisher.publishFriendRequestReceived(addresseeId, friendshipId, requesterId);

        server.verify();
    }
}
