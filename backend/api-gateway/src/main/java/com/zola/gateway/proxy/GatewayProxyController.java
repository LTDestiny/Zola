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
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
    private final String internalGatewaySecret;

    public GatewayProxyController(
        @Value("${services.auth-url}") String authServiceUrl,
        @Value("${services.user-url}") String userServiceUrl,
        @Value("${services.chat-url}") String chatServiceUrl,
        @Value("${services.file-url}") String fileServiceUrl,
        @Value("${app.internal.gateway-secret:internal-dev-secret}") String internalGatewaySecret
    ) {
        this.restClient = RestClient.builder()
            .defaultHeader("X-Internal-Gateway-Secret", internalGatewaySecret)
            .build();
        this.authServiceUrl = authServiceUrl;
        this.userServiceUrl = userServiceUrl;
        this.chatServiceUrl = chatServiceUrl;
        this.fileServiceUrl = fileServiceUrl;
        this.internalGatewaySecret = internalGatewaySecret;
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

    @GetMapping("/media/object")
    public ResponseEntity<byte[]> proxyMediaObject(
        @RequestParam("key") String key,
        HttpServletRequest request
    ) {
        String userId = currentUserIdOrNull(request);
        try {
            var requestSpec = restClient.get()
                .uri(fileServiceUrl + "/api/v1/media/object?key={key}", Map.of("key", key));

            if (userId != null && !userId.isBlank()) {
                requestSpec = requestSpec.header("X-User-Id", userId);
            }

            return requestSpec
                .retrieve()
                .toEntity(byte[].class);
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

    @PostMapping("/auth/reset-password")
    public ApiResponse<Object> resetPassword(@RequestBody Map<String, Object> body) {
        return postMap(authServiceUrl + "/api/v1/auth/reset-password", body, null, null, Map.of());
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

    @PutMapping("/users/me/profile")
    public ApiResponse<Object> updateMyProfile(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @RequestBody Map<String, Object> body,
        HttpServletRequest request
    ) {
        ApiResponse<Object> response = putMap(authServiceUrl + "/api/v1/auth/profile", body, null, authorization, Map.of());
        emitProfileSync(response, "PROFILE_UPDATED", currentUserId(request));
        return response;
    }

    @DeleteMapping("/users/me/profile")
    public ApiResponse<Object> deleteMyProfile(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = deleteMap(authServiceUrl + "/api/v1/auth/profile", null, authorization, Map.of());
        emitSyncEvent(userId, "PROFILE_DELETED", "{\"userId\":\"" + userId + "\"}");
        return response;
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

    @GetMapping("/users/presence")
    public ApiResponse<Object> usersPresence(
        @RequestParam("ids") String userIds,
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization
    ) {
        return getMap(
            chatServiceUrl + "/api/v1/chat/users/presence?ids={ids}",
            authorization,
            Map.of("ids", userIds)
        );
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

    @GetMapping("/users/friendships/status/{targetUserId}")
    public ApiResponse<Object> friendshipStatusV2(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        try {
            return getMap(
                userServiceUrl + "/api/v1/users/friendships/status/{targetUserId}",
                null,
                Map.of("targetUserId", targetUserId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            return getMap(
                userServiceUrl + "/api/v1/users/friendships/status?targetUserId={targetUserId}",
                null,
                Map.of("targetUserId", targetUserId),
                Map.of("X-User-Id", userId)
            );
        }
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

        String status = null;
        if (response.data() instanceof Map<?, ?> data) {
            Object rawStatus = data.get("status");
            if (rawStatus != null) {
                status = String.valueOf(rawStatus).trim().toUpperCase();
            }
        }

        if ("ACCEPTED".equals(status)) {
            ensureDirectConversationForFriendship(response);
            emitFriendshipSync(response, "FRIENDSHIP_REQUEST_ACCEPTED");
        } else if ("PENDING".equals(status)) {
            String addresseeId = body.addresseeId().toString();
            String payload = "{\"requesterId\":\"" + userId + "\",\"addresseeId\":\"" + addresseeId + "\",\"friendshipWith\":\"";
            emitSyncEvent(userId, "FRIENDSHIP_REQUEST_SENT", payload + addresseeId + "\"}");
            emitSyncEvent(addresseeId, "FRIENDSHIP_REQUEST_RECEIVED", payload + userId + "\"}");
        }

        return response;
    }

    @PostMapping("/users/friendships/{targetUserId}/request")
    public ApiResponse<Object> addFriendByTargetId(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return addFriend(new AddFriendRequest(java.util.UUID.fromString(targetUserId)), request);
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

    @GetMapping("/users/friendships/requests/received")
    public ApiResponse<Object> pendingFriendRequestsV2(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/requests/received",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/users/friendships/pending/sent")
    public ApiResponse<Object> sentPendingFriendRequests(HttpServletRequest request) {
        String userId = currentUserId(request);
        try {
            return getMap(
                userServiceUrl + "/api/v1/users/friendships/pending/sent",
                null,
                null,
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            return ApiResponse.ok("Sent pending friendship requests endpoint unavailable", java.util.List.of());
        }
    }

    @GetMapping("/users/friendships/requests/sent")
    public ApiResponse<Object> sentPendingFriendRequestsV2(HttpServletRequest request) {
        String userId = currentUserId(request);
        try {
            return getMap(
                userServiceUrl + "/api/v1/users/friendships/requests/sent",
                null,
                null,
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            return sentPendingFriendRequests(request);
        }
    }

    @GetMapping({"/users/friendships/sent-pending", "/users/friendships/sent"})
    public ApiResponse<Object> sentPendingFriendRequestsCompat(HttpServletRequest request) {
        return sentPendingFriendRequests(request);
    }

    @GetMapping("/users/friendships/pending/unread-count")
    public ApiResponse<Object> pendingFriendRequestsUnreadCount(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/pending/unread-count",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/users/friendships/pending/mark-read")
    public ApiResponse<Object> markPendingFriendRequestsRead(HttpServletRequest request) {
        String userId = currentUserId(request);
        return postMap(
            userServiceUrl + "/api/v1/users/friendships/pending/mark-read",
            Map.of(),
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

    @GetMapping("/users/friendships/blocks")
    public ApiResponse<Object> blockedUsers(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            userServiceUrl + "/api/v1/users/friendships/blocks",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/users/friendships/block")
    public ApiResponse<Object> blockedUsersCompat(HttpServletRequest request) {
        return blockedUsers(request);
    }

    @PostMapping("/users/friendships/block")
    public ApiResponse<Object> blockUser(
        @Valid @RequestBody BlockUserRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = postMap(
                userServiceUrl + "/api/v1/users/friendships/block",
                body,
                null,
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            response = postMap(
                userServiceUrl + "/api/v1/users/friendships/block/{targetUserId}",
                Map.of(),
                Map.of("targetUserId", body.targetUserId().toString()),
                Map.of("X-User-Id", userId)
            );
        }
        emitBlockSync(response, "FRIENDSHIP_BLOCKED");
        return response;
    }

    // Backward compatibility routes for environments using path-variable block endpoints.
    @PostMapping("/users/friendships/block/{targetUserId}")
    public ApiResponse<Object> blockUserCompatPostPath(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return blockUser(new BlockUserRequest(java.util.UUID.fromString(targetUserId)), request);
    }

    @PostMapping("/users/friendships/{targetUserId}/block")
    public ApiResponse<Object> blockUserByTargetId(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return blockUserCompatPostPath(targetUserId, request);
    }

    @PutMapping("/users/friendships/block")
    public ApiResponse<Object> blockUserCompatPut(
        @Valid @RequestBody BlockUserRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = putMap(
            userServiceUrl + "/api/v1/users/friendships/block",
            body,
            null,
            null,
            Map.of("X-User-Id", userId)
        );
        emitBlockSync(response, "FRIENDSHIP_BLOCKED");
        return response;
    }

    @PutMapping("/users/friendships/block/{targetUserId}")
    public ApiResponse<Object> blockUserCompatPutPath(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = putMap(
            userServiceUrl + "/api/v1/users/friendships/block/{targetUserId}",
            Map.of(),
            Map.of("targetUserId", targetUserId),
            null,
            Map.of("X-User-Id", userId)
        );
        emitBlockSync(response, "FRIENDSHIP_BLOCKED");
        return response;
    }

    @DeleteMapping("/users/friendships/block/{targetUserId}")
    public ApiResponse<Object> unblockUser(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = deleteMap(
                userServiceUrl + "/api/v1/users/friendships/block/{targetUserId}",
                Map.of("targetUserId", targetUserId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            try {
                response = postMap(
                    userServiceUrl + "/api/v1/users/friendships/unblock/{targetUserId}",
                    Map.of(),
                    Map.of("targetUserId", targetUserId),
                    Map.of("X-User-Id", userId)
                );
            } catch (ResponseStatusException legacyEx) {
                if (!isLegacyRouteMismatch(legacyEx)) {
                    throw legacyEx;
                }
                response = postMap(
                    userServiceUrl + "/api/v1/users/friendships/block/{targetUserId}/unblock",
                    Map.of(),
                    Map.of("targetUserId", targetUserId),
                    Map.of("X-User-Id", userId)
                );
            }
        }
        emitBlockSync(response, "FRIENDSHIP_UNBLOCKED");
        return response;
    }

    @DeleteMapping("/users/friendships/{targetUserId}/block")
    public ApiResponse<Object> unblockUserByTargetId(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return unblockUser(targetUserId, request);
    }

    @PostMapping("/users/blocks/{targetUserId}")
    public ApiResponse<Object> blockUserPublicAlias(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return blockUserCompatPostPath(targetUserId, request);
    }

    @DeleteMapping("/users/blocks/{targetUserId}")
    public ApiResponse<Object> unblockUserPublicAlias(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return unblockUser(targetUserId, request);
    }

    @PostMapping("/users/friendships/unblock")
    public ApiResponse<Object> unblockUserCompatPost(
        @Valid @RequestBody BlockUserRequest body,
        HttpServletRequest request
    ) {
        return unblockUser(body.targetUserId().toString(), request);
    }

    @PostMapping("/users/friendships/unblock/{targetUserId}")
    public ApiResponse<Object> unblockUserCompatPostPath(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return unblockUser(targetUserId, request);
    }

    @PostMapping("/users/friendships/block/{targetUserId}/unblock")
    public ApiResponse<Object> unblockUserCompatLegacyPath(
        @PathVariable("targetUserId") String targetUserId,
        HttpServletRequest request
    ) {
        return unblockUser(targetUserId, request);
    }

    @PostMapping("/users/friendships/{friendshipId}/accept")
    public ApiResponse<Object> acceptFriendRequest(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}/accept",
            Map.of(),
            Map.of("friendshipId", friendshipId),
            Map.of("X-User-Id", currentUserId(request))
        );
        ensureDirectConversationForFriendship(response);
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

    @PostMapping("/users/friendships/{friendshipId}/cancel")
    public ApiResponse<Object> cancelFriendRequest(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = postMap(
                userServiceUrl + "/api/v1/users/friendships/{friendshipId}/cancel",
                Map.of(),
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            response = deleteMap(
                userServiceUrl + "/api/v1/users/friendships/{friendshipId}/cancel",
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        }
        emitFriendshipSync(response, "FRIENDSHIP_REQUEST_CANCELLED");
        return response;
    }

    @DeleteMapping("/users/friendships/requests/{friendshipId}")
    public ApiResponse<Object> cancelFriendRequestByRequestId(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = deleteMap(
                userServiceUrl + "/api/v1/users/friendships/requests/{friendshipId}",
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            return cancelFriendRequest(friendshipId, request);
        }
        emitFriendshipSync(response, "FRIENDSHIP_REQUEST_CANCELLED");
        return response;
    }

    @DeleteMapping("/users/friendships/{friendshipId}/cancel")
    public ApiResponse<Object> cancelFriendRequestLegacyMethod(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = deleteMap(
                userServiceUrl + "/api/v1/users/friendships/{friendshipId}/cancel",
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            response = postMap(
                userServiceUrl + "/api/v1/users/friendships/{friendshipId}/cancel",
                Map.of(),
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        }
        emitFriendshipSync(response, "FRIENDSHIP_REQUEST_CANCELLED");
        return response;
    }

    @DeleteMapping("/users/friendships/{friendshipId}")
    public ApiResponse<Object> removeFriend(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response;
        try {
            response = deleteMap(
                userServiceUrl + "/api/v1/users/friendships/{friendshipId}",
                Map.of("friendshipId", friendshipId),
                Map.of("X-User-Id", userId)
            );
        } catch (ResponseStatusException ex) {
            if (!isLegacyRouteMismatch(ex)) {
                throw ex;
            }
            try {
                response = postMap(
                    userServiceUrl + "/api/v1/users/friendships/{friendshipId}/remove",
                    Map.of(),
                    Map.of("friendshipId", friendshipId),
                    Map.of("X-User-Id", userId)
                );
            } catch (ResponseStatusException legacyEx) {
                if (!isLegacyRouteMismatch(legacyEx)) {
                    throw legacyEx;
                }
                response = postMap(
                    userServiceUrl + "/api/v1/users/friendships/{friendshipId}/delete",
                    Map.of(),
                    Map.of("friendshipId", friendshipId),
                    Map.of("X-User-Id", userId)
                );
            }
        }
        emitFriendshipSync(response, "FRIENDSHIP_REMOVED");
        return response;
    }

    @PostMapping("/users/friendships/{friendshipId}/remove")
    public ApiResponse<Object> removeFriendLegacyRoute(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}/remove",
            Map.of(),
            Map.of("friendshipId", friendshipId),
            Map.of("X-User-Id", userId)
        );
        emitFriendshipSync(response, "FRIENDSHIP_REMOVED");
        return response;
    }

    @PostMapping("/users/friendships/{friendshipId}/delete")
    public ApiResponse<Object> removeFriendLegacyDeleteRoute(
        @PathVariable("friendshipId") String friendshipId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        ApiResponse<Object> response = postMap(
            userServiceUrl + "/api/v1/users/friendships/{friendshipId}/delete",
            Map.of(),
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

    @PostMapping("/chat/conversations/group")
    public ApiResponse<Object> createGroupConversation(
        @Valid @RequestBody CreateGroupConversationRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/group",
            body,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/add-member")
    public ApiResponse<Object> addGroupMember(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody GroupMemberRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/add-member",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/remove-member")
    public ApiResponse<Object> removeGroupMember(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody GroupMemberRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/remove-member",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/approve-member")
    public ApiResponse<Object> approvePendingGroupMember(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody GroupMemberRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/approve-member",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/reject-member")
    public ApiResponse<Object> rejectPendingGroupMember(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody GroupMemberRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/reject-member",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/leave")
    public ApiResponse<Object> leaveGroupConversation(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/leave",
            Map.of(),
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/set-admin")
    public ApiResponse<Object> setGroupAdmin(
        @PathVariable("conversationId") String conversationId,
        @Valid @RequestBody GroupAdminRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/set-admin",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/groups/join-by-link")
    public ApiResponse<Object> joinGroupByLink(
        @Valid @RequestBody JoinByLinkRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/groups/join-by-link",
            body,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/chat/conversations/{conversationId}/settings")
    public ApiResponse<Object> getGroupSettings(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return getMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/settings",
            null,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PatchMapping("/chat/conversations/{conversationId}/settings")
    public ApiResponse<Object> updateGroupSettings(
        @PathVariable("conversationId") String conversationId,
        @RequestBody UpdateGroupSettingsRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return patchMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/settings",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/pins")
    public ApiResponse<Object> pinGroupMessage(
        @PathVariable("conversationId") String conversationId,
        @RequestBody PinMessageRequest body,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pins",
            body,
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/pin")
    public ApiResponse<Object> pinConversation(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return postMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pin",
            Map.of(),
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @GetMapping("/chat/conversations/pinned")
    public ApiResponse<Object> getPinnedConversations(HttpServletRequest request) {
        String userId = currentUserId(request);
        return getMap(
            chatServiceUrl + "/api/v1/chat/conversations/pinned",
            null,
            null,
            Map.of("X-User-Id", userId)
        );
    }

    @DeleteMapping("/chat/conversations/{conversationId}/pin")
    public ApiResponse<Object> unpinConversation(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pin",
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/pin/unpin")
    public ApiResponse<Object> unpinConversationCompatibility(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pin",
            Map.of("conversationId", conversationId),
            Map.of("X-User-Id", userId)
        );
    }

    @DeleteMapping("/chat/conversations/{conversationId}/pins/{messageId}")
    public ApiResponse<Object> unpinGroupMessage(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pins/{messageId}",
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @PostMapping("/chat/conversations/{conversationId}/pins/{messageId}/unpin")
    public ApiResponse<Object> unpinGroupMessageCompatibility(
        @PathVariable("conversationId") String conversationId,
        @PathVariable("messageId") String messageId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}/pins/{messageId}",
            Map.of("conversationId", conversationId, "messageId", messageId),
            Map.of("X-User-Id", userId)
        );
    }

    @DeleteMapping("/chat/conversations/{conversationId}")
    public ApiResponse<Object> deleteGroupConversation(
        @PathVariable("conversationId") String conversationId,
        HttpServletRequest request
    ) {
        String userId = currentUserId(request);
        return deleteMap(
            chatServiceUrl + "/api/v1/chat/conversations/{conversationId}",
            Map.of("conversationId", conversationId),
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
        return deleteMap(url, uriVars, null, extraHeaders);
    }

    private ApiResponse<Object> deleteMap(
        String url,
        Map<String, ?> uriVars,
        String authorization,
        Map<String, String> extraHeaders
    ) {
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.delete().uri(url, uriVars == null ? Map.of() : uriVars);
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

    private ApiResponse<Object> putMap(
        String url,
        Object body,
        Map<String, ?> uriVars,
        String authorization,
        Map<String, String> extraHeaders
    ) {
        try {
            RestClient.RequestBodySpec request = restClient.put().uri(url, uriVars == null ? Map.of() : uriVars);
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

    private boolean isLegacyRouteMismatch(ResponseStatusException ex) {
        int statusCode = ex.getStatusCode().value();
        return statusCode == HttpStatus.NOT_FOUND.value() || statusCode == HttpStatus.METHOD_NOT_ALLOWED.value();
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
        } catch (IOException ignored) {
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

    private String currentUserIdOrNull(HttpServletRequest request) {
        Object userId = request.getAttribute("X_USER_ID");
        if (userId instanceof String id && !id.isBlank()) {
            return id;
        }
        return null;
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

    private void emitBlockSync(ApiResponse<Object> response, String eventType) {
        if (!(response.data() instanceof Map<?, ?> data)) {
            return;
        }

        Object blockerId = data.get("blockerId");
        Object blockedUserId = data.get("blockedUserId");
        if (!(blockerId instanceof String blocker) || !(blockedUserId instanceof String blockedUser)) {
            return;
        }

        String payload = "{\"blockerId\":\"" + blocker + "\",\"blockedUserId\":\"" + blockedUser + "\"}";
        emitSyncEvent(blocker, eventType, payload);
        emitSyncEvent(blockedUser, eventType, payload);
    }

    private void ensureDirectConversationForFriendship(ApiResponse<Object> response) {
        if (!(response.data() instanceof Map<?, ?> data)) {
            return;
        }

        Object requesterId = data.get("requesterId");
        Object addresseeId = data.get("addresseeId");
        Object friendshipId = data.get("friendshipId");
        if (!(requesterId instanceof String requester) || !(addresseeId instanceof String addressee)) {
            return;
        }

        try {
            ApiResponse<Object> chatResponse = postMap(
                chatServiceUrl + "/api/v1/chat/conversations/direct",
                Map.of("targetUserId", addressee),
                null,
                Map.of("X-User-Id", requester)
            );

            String conversationId = null;
            if (chatResponse != null && chatResponse.data() instanceof Map<?, ?> chatData) {
                Object id = chatData.get("id");
                if (id instanceof String conversation) {
                    conversationId = conversation;
                }
            }

            if (conversationId != null) {
                String payload = "{\"friendshipId\":\"" + String.valueOf(friendshipId) + "\",\"conversationId\":\"" + conversationId + "\"}";
                emitSyncEvent(requester, "FRIENDSHIP_CHAT_READY", payload);
                emitSyncEvent(addressee, "FRIENDSHIP_CHAT_READY", payload);
            }
        } catch (RuntimeException ignored) {
            // Ignore cross-service failure, clients still reconcile from friendship sync events.
        }
    }

    private void emitProfileSync(ApiResponse<Object> response, String eventType, String fallbackUserId) {
        String userId = fallbackUserId;
        if (response != null && response.data() instanceof Map<?, ?> data) {
            Object responseUserId = data.get("id");
            if (responseUserId instanceof String id && !id.isBlank()) {
                userId = id;
            }
        }

        if (userId == null || userId.isBlank()) {
            return;
        }

        String payload = "{\"userId\":\"" + userId + "\"}";
        emitSyncEvent(userId, eventType, payload);
        emitProfileSyncToFriends(userId, payload, eventType);
    }

    private void emitProfileSyncToFriends(String userId, String payload, String eventType) {
        try {
            ApiResponse<Object> friendsResponse = getMap(
                userServiceUrl + "/api/v1/users/friendships/friends",
                null,
                null,
                Map.of("X-User-Id", userId)
            );

            if (!(friendsResponse.data() instanceof java.util.List<?> friends)) {
                return;
            }

            for (Object item : friends) {
                if (!(item instanceof Map<?, ?> friendMap)) {
                    continue;
                }
                Object friendIdObj = friendMap.get("userId");
                if (friendIdObj instanceof String friendId && !friendId.isBlank()) {
                    emitSyncEvent(friendId, eventType, payload);
                }
            }
        } catch (RuntimeException ignored) {
            // Ignore friend sync failures to keep profile API reliable.
        }
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

    public record BlockUserRequest(@NotNull java.util.UUID targetUserId) {
    }

    public record SendMessageRequest(
        String type,
        @NotBlank String content,
        String fileUrl,
        String fileName,
        String parentMessageId
    ) {
    }

    public record EditMessageRequest(@NotBlank String content) {
    }

    public record CreateDirectConversationRequest(@NotBlank String targetUserId) {
    }

    public record CreateGroupConversationRequest(
        @NotBlank String name,
        java.util.List<String> memberIds,
        String avatar
    ) {
    }

    public record GroupMemberRequest(@NotBlank String userId) {
    }

    public record GroupAdminRequest(
        @NotBlank String userId,
        boolean admin
    ) {
    }

    public record JoinByLinkRequest(@NotBlank String code) {
    }

    public record UpdateGroupSettingsRequest(
        String name,
        String avatar,
        Boolean allowMembersEditGroupProfile,
        Boolean allowMembersPinBoardItems,
        Boolean allowMembersCreateNotes,
        Boolean allowMembersCreatePolls,
        Boolean allowMembersSendMessages,
        Boolean onlyAdminsCanMessage,
        Boolean requireApprovalToJoin,
        Boolean highlightAdminMessages,
        Boolean allowMemberInvite,
        Boolean allowMemberEditGroupInfo,
        Boolean allowMemberPinBoardItems,
        Boolean allowMemberCreateNotes,
        Boolean allowMemberCreateReminders,
        Boolean allowMemberCreatePolls,
        String transferOwnerId
    ) {
    }

    public record PinMessageRequest(@NotBlank String sourceMessageId) {
    }

    public record ForwardRequest(@NotNull java.util.UUID targetConversationId) {
    }

    public record ReactionRequest(@NotBlank String emoji) {
    }
}
