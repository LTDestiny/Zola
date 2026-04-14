package com.zola.gateway.proxy;

import com.zola.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class GatewayProxyController {

    private static final ParameterizedTypeReference<ApiResponse<Object>> API_RESPONSE =
        new ParameterizedTypeReference<>() {
        };
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final String authServiceUrl;
    private final String userServiceUrl;
    private final String chatServiceUrl;
    private final String fileServiceUrl;

    public GatewayProxyController(
        @Value("${services.auth-url}") String authServiceUrl,
        @Value("${services.user-url}") String userServiceUrl,
        @Value("${services.chat-url}") String chatServiceUrl,
        @Value("${services.file-url}") String fileServiceUrl
    ) {
        this.restClient = RestClient.builder().build();
        this.authServiceUrl = authServiceUrl;
        this.userServiceUrl = userServiceUrl;
        this.chatServiceUrl = chatServiceUrl;
        this.fileServiceUrl = fileServiceUrl;
    }

    @PostMapping(value = "/media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Object> uploadMedia(
        @RequestPart("file") MultipartFile file,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        try {
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };

            HttpHeaders partHeaders = new HttpHeaders();
            String contentType = file.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : file.getContentType();
            partHeaders.setContentType(MediaType.parseMediaType(contentType));
            HttpEntity<ByteArrayResource> fileEntity = new HttpEntity<>(fileResource, partHeaders);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", fileEntity);

            return restClient.post()
                .uri(fileServiceUrl + "/api/v1/media/upload")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .header("X-User-Id", userId)
                .body(body)
                .retrieve()
                .body(API_RESPONSE);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload payload", ex);
        } catch (RestClientResponseException ex) {
            throw toStatusException(ex);
        }
    }

    @PostMapping("/auth/register")
    public ApiResponse<Object> register(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/register", body, null, null, Map.of());
    }

    @PostMapping("/auth/register/verify-otp")
    public ApiResponse<Object> verifyRegisterOtp(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/register/verify-otp", body, null, null, Map.of());
    }

    @PostMapping("/auth/login")
    public ApiResponse<Object> login(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/login", body, null, null, Map.of());
    }

    @PostMapping("/auth/login/request-otp")
    public ApiResponse<Object> requestLoginOtp(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/login/request-otp", body, null, null, Map.of());
    }

    @PostMapping("/auth/login/verify-otp")
    public ApiResponse<Object> verifyLoginOtp(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/login/verify-otp", body, null, null, Map.of());
    }

    @PostMapping("/auth/forgot-password")
    public ApiResponse<Object> forgotPassword(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/forgot-password", body, null, null, Map.of());
    }

    @PostMapping("/auth/verify-otp")
    public ApiResponse<Object> verifyOtp(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/verify-otp", body, null, null, Map.of());
    }

    @PostMapping("/auth/refresh")
    public ApiResponse<Object> refresh(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/refresh", body, null, null, Map.of());
    }

    @PostMapping("/auth/logout")
    public ApiResponse<Object> logout(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        return postMap(authServiceUrl + "/api/v1/auth/logout", body == null ? Map.of() : body, null, authorization, Map.of());
    }

    @PostMapping("/auth/logout-all")
    public ApiResponse<Object> logoutAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @RequestBody(required = false) Map<String, Object> body
    ) {
        return postMap(authServiceUrl + "/api/v1/auth/logout-all", body == null ? Map.of() : body, null, authorization, Map.of());
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

    @GetMapping("/users/{id}/summary")
    public ApiResponse<Object> userSummary(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @PathVariable("id") String userId
    ) {
        return getMap(authServiceUrl + "/api/v1/auth/users/{id}/summary", authorization, Map.of("id", userId));
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
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships",
            body,
            null,
            Map.of("X-User-Id", userId)
        );
        emitSyncEvent(userId, "FRIENDSHIP_REQUEST_SENT", "{\"friendshipWith\":\"" + body.addresseeId() + "\"}");
        emitSyncEvent(body.addresseeId().toString(), "FRIENDSHIP_REQUEST_SENT", "{\"friendshipWith\":\"" + userId + "\"}");
        return response;
    }

    @GetMapping("/users/friendships/pending")
    public ApiResponse<Object> pendingFriendRequests(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/pending",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/users/friendships/friends")
    public ApiResponse<Object> friends(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/friends",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/users/friendships/{friendshipId}/accept")
    public ApiResponse<Object> acceptFriendRequest(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}/accept",
            Map.of(),
            Map.of("friendshipId", friendshipId),
            Map.of("X-User-Id", userId)
        );
        emitFriendshipSync(response, "FRIENDSHIP_REQUEST_ACCEPTED");
        return response;
    }

    @PostMapping("/users/friendships/{friendshipId}/decline")
    public ApiResponse<Object> declineFriendRequest(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}/decline",
            Map.of(),
            Map.of("friendshipId", friendshipId),
            Map.of("X-User-Id", userId)
        );
        emitFriendshipSync(response, "FRIENDSHIP_REQUEST_DECLINED");
        return response;
    }

    @DeleteMapping("/users/friendships/{friendshipId}")
    public ApiResponse<Object> removeFriend(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = deleteMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}",
            Map.of("friendshipId", friendshipId),
            Map.of("X-User-Id", userId)
        );
        emitFriendshipSync(response, "FRIENDSHIP_REMOVED");
        return response;
    }

    @GetMapping("/chat/conversations")
    public ApiResponse<Object> conversations(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(chatServiceUrl + "/api/v1/chat/conversations", null, null, Map.of("X-User-Id", userId));
    }

    @PostMapping("/chat/conversations/direct")
    public ApiResponse<Object> createDirectConversation(
        @Valid @RequestBody CreateDirectConversationRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/direct",
            body,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/chat/conversations/{conversationId}/messages")
    public ApiResponse<Object> messages(
        @PathVariable("conversationId") String conversationId,
        @RequestParam(name = "cursor", required = false) String cursor,
        @RequestParam(name = "limit", defaultValue = "50") int limit,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return getMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages?limit={limit}&cursor={cursor}",
            null,
            Map.of("conversationId", conversationId, "cursor", cursor == null ? "" : cursor, "limit", limit),
            Map.of("X-User-Id", userId)
        );
    }

    @PatchMapping("/chat/conversations/{conversationId}/messages/{messageId}/edit")
    public ApiResponse<Object> editMessage(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody EditMessageRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return patchMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/edit",
            body,
            Map.of("conversationId", conversationId, "messageId", messageId),
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

    @PostMapping("/chat/conversations/{conversationId}/messages/{messageId}/recall")
    public ApiResponse<Object> recallMessage(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/recall",
            Map.of(),
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/messages/{messageId}/delete-for-me")
    public ApiResponse<Object> deleteForMe(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/delete-for-me",
            Map.of(),
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/messages/{messageId}/forward")
    public ApiResponse<Object> forwardMessage(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody ForwardRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/forward",
            body,
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/messages/{messageId}/read")
    public ApiResponse<Object> readReceipt(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/read",
            Map.of(),
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PatchMapping("/chat/conversations/{conversationId}/read")
    public ApiResponse<Object> markConversationRead(
        @PathVariable("conversationId") String conversationId,
        @RequestParam(name = "messageId", required = false) String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return patchMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/read?messageId={messageId}",
            Map.of(),
            Map.of("conversationId", conversationId, "messageId", messageId == null ? "" : messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/messages/{messageId}/reactions")
    public ApiResponse<Object> addReaction(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        @Valid @RequestBody ReactionRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/reactions",
            body,
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @DeleteMapping("/chat/conversations/{conversationId}/messages/{messageId}/reactions")
    public ApiResponse<Object> removeReaction(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        @RequestParam("emoji") String emoji,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/messages/{messageId}/reactions?emoji={emoji}",
            Map.of("conversationId", conversationId, "messageId", messageId, "emoji", emoji),
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
        return postMap(url, body, uriVars, null, extraHeaders);
    }

    private ApiResponse<Object> deleteMap(String url, Map<String, ?> uriVars, Map<String, String> extraHeaders) {
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.delete().uri(url, uriVars == null ? Map.of() : uriVars);
            for (Map.Entry<String, String> header : extraHeaders.entrySet()) {
                request = request.header(header.getKey(), header.getValue());
            }
            return request.retrieve().body(API_RESPONSE);
        } catch (RestClientResponseException ex) {
            throw toStatusException(ex);
        }
    }

    private ApiResponse<Object> patchMap(String url, Object body, Map<String, ?> uriVars, Map<String, String> extraHeaders) {
        try {
            RestClient.RequestBodySpec request = restClient.patch().uri(url, uriVars == null ? Map.of() : uriVars);
            for (Map.Entry<String, String> header : extraHeaders.entrySet()) {
                request = request.header(header.getKey(), header.getValue());
            }
            return request.body(body).retrieve().body(API_RESPONSE);
        } catch (RestClientResponseException ex) {
            throw toStatusException(ex);
        }
    }

    private ApiResponse<Object> postMap(
        String url,
        Object body,
        Map<String, ?> uriVars,
        String authorization,
        Map<String, String> extraHeaders
    ) {
        try {
            RestClient.RequestBodySpec request = restClient.post().uri(url, uriVars == null ? Map.of() : uriVars);
            if (authorization != null) {
                request = request.header(HttpHeaders.AUTHORIZATION, authorization);
            }
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

        String message = extractErrorMessage(ex.getResponseBodyAsString(), ex.getStatusText());
        return new ResponseStatusException(status, message);
    }

    private String extractErrorMessage(String rawBody, String fallback) {
        if (rawBody == null || rawBody.isBlank()) {
            return fallback;
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(rawBody);
            JsonNode messageNode = root.get("message");
            if (messageNode != null && !messageNode.isNull() && !messageNode.asText().isBlank()) {
                return messageNode.asText();
            }

            JsonNode errorsNode = root.get("errors");
            if (errorsNode != null && errorsNode.isArray() && !errorsNode.isEmpty()) {
                JsonNode first = errorsNode.get(0);
                JsonNode defaultMessage = first.get("defaultMessage");
                if (defaultMessage != null && !defaultMessage.isNull() && !defaultMessage.asText().isBlank()) {
                    return defaultMessage.asText();
                }
            }

            JsonNode errorNode = root.get("error");
            if (errorNode != null && !errorNode.isNull() && !errorNode.asText().isBlank()) {
                return errorNode.asText();
            }
        } catch (Exception ignored) {
            // Keep fallback flow if body is not JSON.
        }

        return fallback;
    }

    private String currentUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("X_USER_ID");
        if (userId instanceof String id && !id.isBlank()) {
            return id;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user context");
    }

    private void emitFriendshipSync(ApiResponse<Object> response, String eventType) {
        if (!(response.data() instanceof Map<?, ?> data)) {
            return;
        }

        Object requesterId = data.get("requesterId");
        Object addresseeId = data.get("addresseeId");
        Object friendshipId = data.get("friendshipId");
        if (!(requesterId instanceof String requester) || !(addresseeId instanceof String addressee)) {
            return;
        }

        String payload = "{\"friendshipId\":\"" + String.valueOf(friendshipId) + "\"}";
        emitSyncEvent(requester, eventType, payload);
        emitSyncEvent(addressee, eventType, payload);
    }

    private void emitSyncEvent(String userId, String eventType, String payload) {
        try {
            postMap(
                chatServiceUrl + "/api/v1/sync/users/{userId}/emit",
                Map.of(
                    "userId", userId,
                    "sourceClient", "gateway",
                    "eventType", eventType,
                    "payload", payload
                ),
                Map.of("userId", userId),
                Map.of()
            );
        } catch (Exception ignored) {
            // Ignore realtime notification failure to keep friendship API reliable.
        }
    }

    public record AddFriendRequest(@NotNull java.util.UUID addresseeId) {
    }

    public record SendMessageRequest(
        String type,
        @NotBlank String content,
        String fileUrl,
        String fileName
    ) {
    }

    public record EditMessageRequest(@NotBlank String content) {
    }

    public record CreateDirectConversationRequest(@NotBlank String targetUserId) {
    }

    public record ForwardRequest(@NotNull java.util.UUID targetConversationId) {
    }

    public record ReactionRequest(@NotBlank String emoji) {
    }
}
