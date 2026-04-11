package com.zola.gateway.proxy;

import com.zola.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class GatewayProxyController {

    private static final ParameterizedTypeReference<ApiResponse<Object>> API_RESPONSE =
        new ParameterizedTypeReference<>() {
        };

    private final RestClient restClient;
    private final String authServiceUrl;
    private final String userServiceUrl;
    private final String chatServiceUrl;

    public GatewayProxyController(
        @Value("${services.auth-url}") String authServiceUrl,
        @Value("${services.user-url}") String userServiceUrl,
        @Value("${services.chat-url}") String chatServiceUrl
    ) {
        this.restClient = RestClient.builder().build();
        this.authServiceUrl = authServiceUrl;
        this.userServiceUrl = userServiceUrl;
        this.chatServiceUrl = chatServiceUrl;
    }

    @GetMapping("/users/me/profile")
    public ApiResponse<Object> myProfile(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return getMap(authServiceUrl + "/api/v1/auth/profile", authorization, null);
    }

    @GetMapping("/users/search-by-email")
    public ApiResponse<Object> searchByEmail(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @RequestParam("email") String email
    ) {
        return getMap(authServiceUrl + "/api/v1/auth/users/search-by-email?email={email}", authorization, Map.of("email", email));
    }

    @GetMapping("/users/friendships/status")
    public ApiResponse<Object> friendshipStatus(
        @RequestParam("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/status?targetUserId={targetUserId}",
            null,
            Map.of("targetUserId", targetUserId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/users/friendships")
    public ApiResponse<Object> addFriend(
        @Valid @RequestBody AddFriendRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            userServiceUrl + "/api/v1/users/friendships",
            body,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/chat/conversations")
    public ApiResponse<Object> conversations(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(chatServiceUrl + "/api/v1/chat/conversations", null, null, Map.of("X-User-Id", userId));
    }

    @GetMapping("/chat/conversations/{conversationId}/messages")
    public ApiResponse<Object> messages(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return getMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages",
            null,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/messages")
    public ApiResponse<Object> sendMessage(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody SendMessageRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    private ApiResponse<Object> getMap(String url, String authorization, Map<String, ?> uriVars) {
        return getMap(url, authorization, uriVars, Map.of());
    }

    private ApiResponse<Object> getMap(String url, String authorization, Map<String, ?> uriVars, Map<String, String> extraHeaders) {
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.get().uri(url, uriVars == null ? Map.of() : uriVars);
            if (authorization != null) {
                request = request.header(HttpHeaders.AUTHORIZATION, authorization);
            }
            for (Map.Entry<String, String> header : extraHeaders.entrySet()) {
                request = request.header(header.getKey(), header.getValue());
            }
            return request.retrieve().body(API_RESPONSE);
        } catch (RestClientResponseException ex) {
            throw toStatusException(ex);
        }
    }

    private ApiResponse<Object> postMap(String url, Object body, Map<String, ?> uriVars, Map<String, String> extraHeaders) {
        try {
            RestClient.RequestBodySpec request = restClient.post().uri(url, uriVars == null ? Map.of() : uriVars);
            for (Map.Entry<String, String> header : extraHeaders.entrySet()) {
                request = request.header(header.getKey(), header.getValue());
            }
            return request.body(body).retrieve().body(API_RESPONSE);
        } catch (RestClientResponseException ex) {
            throw toStatusException(ex);
        }
    }

    private ResponseStatusException toStatusException(RestClientResponseException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        String message = ex.getResponseBodyAsString();
        if (message == null || message.isBlank()) {
            message = ex.getStatusText();
        }
        return new ResponseStatusException(status, message);
    }

    private String currentUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("X_USER_ID");
        if (userId instanceof String id && !id.isBlank()) {
            return id;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user context");
    }

    public record AddFriendRequest(@NotNull java.util.UUID addresseeId) {
    }

    public record SendMessageRequest(@NotBlank String content) {
    }
}
