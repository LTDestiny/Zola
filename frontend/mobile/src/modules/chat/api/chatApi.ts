import { AxiosError } from "axios";
import { httpClient } from "./httpClient";
import type {
  ApiResponse,
  ConversationItem,
  FriendContactItem,
  FriendshipStatus,
  GroupSettings,
  MessageItem,
  MessagePageData,
  MessageType,
  PendingFriendRequestItem,
  RelationshipStatusPayload,
  UpdateGroupSettingsInput,
  UpdateUserProfileInput,
  UserPresenceItem,
  UserProfile,
} from "@/shared/types/api";

let supportsConversationReadEndpoint: boolean | null = null;
let supportsMessageReadEndpoint: boolean | null = null;
let supportsBlockedUsersEndpoint: boolean | null = null;

function shouldFallbackLegacyEndpoint(error: unknown): boolean {
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  return status === 404 || status === 405;
}

function isCompatibilityStatus(error: unknown, statuses: number[]) {
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  return typeof status === "number" && statuses.includes(status);
}

type ConversationPayload = Partial<ConversationItem> & {
  id: string;
  requesterUnreadCount?: number;
  requesterLastReadAt?: string | null;
  requesterLastReadMessageId?: string | null;
  lastMessageSenderId?: string | null;
  lastSenderId?: string | null;
  lastMessageType?: MessageType | string | null;
  messageType?: MessageType | string | null;
};

type RawMessageItem = Omit<MessageItem, "id"> & {
  id?: string;
  messageId?: string;
};

function normalizeConversationItem(item: ConversationPayload): ConversationItem {
  return {
    id: String(item.id),
    type: item.type ?? "private",
    name: item.name ?? "",
    avatar: item.avatar ?? null,
    lastMessage: item.lastMessage ?? "",
    lastMessageSenderId: item.lastMessageSenderId ?? item.lastSenderId ?? null,
    lastMessageType: item.lastMessageType ?? item.messageType ?? null,
    lastMessageAt: item.lastMessageAt ?? null,
    unreadCount: Number.isFinite(item.unreadCount)
      ? (item.unreadCount as number)
      : Number.isFinite(item.requesterUnreadCount)
        ? (item.requesterUnreadCount as number)
        : 0,
    lastReadAt: item.lastReadAt ?? item.requesterLastReadAt ?? null,
    lastReadMessageId:
      item.lastReadMessageId ?? item.requesterLastReadMessageId ?? null,
    participants: item.participants ?? [],
    admins: item.admins ?? [],
    ownerId: item.ownerId ?? null,
    isPinned: Boolean(item.isPinned),
    isOnline: item.isOnline ?? null,
    otherUserId: item.otherUserId ?? null,
  };
}

function normalizeMessage(raw: RawMessageItem): MessageItem {
  const resolvedId = raw.id ?? raw.messageId;
  return {
    ...raw,
    id: resolvedId ?? "",
    conversationId: raw.conversationId ?? undefined,
    type: raw.type ?? "TEXT",
    content: raw.content ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function normalizeMessagesInAscendingOrder(items: RawMessageItem[]): MessageItem[] {
  return items
    .map(normalizeMessage)
    .filter((item) => Boolean(item.id))
    .reverse();
}

export async function getMyProfile() {
  const response = await httpClient.get<ApiResponse<UserProfile>>("/api/v1/users/me/profile");
  return response.data;
}

export async function updateMyProfile(input: UpdateUserProfileInput) {
  const response = await httpClient.put<ApiResponse<UserProfile>>("/api/v1/users/me/profile", input);
  return response.data;
}

export async function deleteMyProfile() {
  const response = await httpClient.delete<ApiResponse<{ ok: boolean }>>("/api/v1/users/me/profile");
  return response.data;
}

export async function searchUserByEmail(email: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>("/api/v1/users/search-by-email", {
    params: { email },
  });
  return response.data;
}

export async function getUserSummary(userId: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>(`/api/v1/users/${userId}/summary`);
  return response.data;
}

export async function getUserProfile(userId: string) {
  return getUserSummary(userId);
}

export async function getUsersPresence(userIds: string[]) {
  const ids = userIds
    .map((value) => value.trim())
    .filter(Boolean)
    .join(",");

  if (!ids) {
    return {
      success: true,
      message: "Presence fetched",
      data: [] as UserPresenceItem[],
    };
  }

  try {
    const response = await httpClient.get<ApiResponse<UserPresenceItem[]>>("/api/v1/users/presence", {
      params: { ids },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      return {
        success: true,
        message: "Presence endpoint unavailable, fallback to empty presence",
        data: [] as UserPresenceItem[],
      };
    }
    throw error;
  }
}

export async function getFriendshipStatus(targetUserId: string) {
  const response = await httpClient.get<ApiResponse<FriendshipStatus>>("/api/v1/users/friendships/status", {
    params: { targetUserId },
  });
  return response.data;
}

export async function getRelationshipStatus(targetUserId: string) {
  try {
    const response = await httpClient.get<ApiResponse<RelationshipStatusPayload>>(
      `/api/v1/users/friendships/status/${targetUserId}`,
    );
    return response.data;
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  try {
    const legacy = await getFriendshipStatus(targetUserId);
    return {
      ...legacy,
      data: {
        ...legacy.data,
        requestId: legacy.data?.friendshipId,
        isBlockedByMe: legacy.data?.blockedByMe ?? false,
        isBlockedMe: legacy.data?.blockedByPeer ?? false,
      },
    };
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  throw new Error("Unable to fetch relationship status");
}

export async function addFriend(addresseeId: string) {
  const response = await httpClient.post<ApiResponse<{ friendshipId: string; status: string }>>("/api/v1/users/friendships", {
    addresseeId,
  });
  return response.data;
}

export async function sendFriendRequest(targetUserId: string) {
  try {
    return await addFriend(targetUserId);
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  try {
    const response = await httpClient.post<ApiResponse<{ friendshipId: string; status: string }>>(
      `/api/v1/users/friendships/${targetUserId}/request`,
      {},
    );
    return response.data;
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  throw new Error("Unable to send friend request");
}

export async function getPendingFriendRequests() {
  const paths = ["/api/v1/users/friendships/requests/received", "/api/v1/users/friendships/pending"];
  let latestError: unknown;

  for (const path of paths) {
    try {
      const response = await httpClient.get<ApiResponse<PendingFriendRequestItem[]>>(path);
      return response.data;
    } catch (error) {
      latestError = error;
      if (!isCompatibilityStatus(error, [404, 405, 501])) {
        throw error;
      }
    }
  }

  if (latestError && !isCompatibilityStatus(latestError, [404, 405, 501])) {
    throw latestError;
  }

  return {
    success: true,
    message: "Pending friend requests endpoint unavailable, fallback to empty list",
    data: [],
  };
}

export async function getSentPendingFriendRequests() {
  const paths = [
    "/api/v1/users/friendships/requests/sent",
    "/api/v1/users/friendships/pending/sent",
    "/api/v1/users/friendships/sent-pending",
  ];
  let latestError: unknown;

  for (const path of paths) {
    try {
      const response = await httpClient.get<ApiResponse<PendingFriendRequestItem[]>>(path);
      return response.data;
    } catch (error) {
      latestError = error;
      if (!isCompatibilityStatus(error, [404, 405, 501])) {
        throw error;
      }
    }
  }

  if (latestError && !isCompatibilityStatus(latestError, [404, 405, 501])) {
    throw latestError;
  }

  return {
    success: true,
    message: "Sent pending friend requests endpoint unavailable, fallback to empty list",
    data: [],
  };
}

export async function getPendingFriendRequestsUnreadCount() {
  const response = await httpClient.get<ApiResponse<{ count: number }>>("/api/v1/users/friendships/pending/unread-count");
  return response.data;
}

export async function markPendingFriendRequestsRead() {
  const response = await httpClient.post<ApiResponse<{ updated: number }>>("/api/v1/users/friendships/pending/mark-read", {});
  return response.data;
}

export async function getFriends() {
  const response = await httpClient.get<ApiResponse<FriendContactItem[]>>("/api/v1/users/friendships/friends");
  return response.data;
}

export async function removeFriend(friendshipId: string) {
  const response = await httpClient.delete<ApiResponse<{ friendshipId: string; status: string }>>(
    `/api/v1/users/friendships/${friendshipId}`,
  );
  return response.data;
}

export async function getBlockedUsers() {
  if (supportsBlockedUsersEndpoint === false) {
    return {
      success: true,
      message: "Blocked-users endpoint unavailable, compatibility mode enabled",
      data: [] as Array<{ userId: string }>,
    };
  }

  try {
    const response = await httpClient.get<ApiResponse<Array<{ userId: string }>>>("/api/v1/users/friendships/blocks");
    supportsBlockedUsersEndpoint = true;
    return response.data;
  } catch (error) {
    if (isCompatibilityStatus(error, [404, 405])) {
      try {
        const fallback = await httpClient.get<ApiResponse<Array<{ userId: string }>>>("/api/v1/users/friendships/block");
        supportsBlockedUsersEndpoint = true;
        return fallback.data;
      } catch (fallbackError) {
        if (isCompatibilityStatus(fallbackError, [404, 405])) {
          supportsBlockedUsersEndpoint = false;
          return {
            success: true,
            message: "Blocked-users endpoint unavailable, fallback to empty list",
            data: [],
          };
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function blockUser(targetUserId: string) {
  try {
    const response = await httpClient.post<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/${targetUserId}/block`, {});
    return {
      ...response.data,
      data: {
        ...response.data.data,
        status: String(response.data.data?.status ?? "BLOCKED"),
        blockedByMe: response.data.data?.blockedByMe ?? true,
      },
    };
  } catch (error) {
    if (!isCompatibilityStatus(error, [404, 405])) {
      throw error;
    }
  }

  const body = { targetUserId };
  const fallbacks: Array<() => Promise<ApiResponse<FriendshipStatus>>> = [
    async () => (await httpClient.post<ApiResponse<FriendshipStatus>>("/api/v1/users/friendships/block", body)).data,
    async () => (await httpClient.post<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/block/${targetUserId}`, {})).data,
    async () => (await httpClient.put<ApiResponse<FriendshipStatus>>("/api/v1/users/friendships/block", body)).data,
    async () => (await httpClient.put<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/block/${targetUserId}`, {})).data,
  ];

  let latestError: unknown;
  for (const request of fallbacks) {
    try {
      const result = await request();
      return {
        ...result,
        data: {
          ...result.data,
          status: String(result.data?.status ?? "BLOCKED"),
          blockedByMe: result.data?.blockedByMe ?? true,
        },
      };
    } catch (error) {
      latestError = error;
      if (!isCompatibilityStatus(error, [404, 405])) {
        throw error;
      }
    }
  }

  throw latestError;
}

export async function unblockUser(targetUserId: string) {
  try {
    const response = await httpClient.delete<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/${targetUserId}/block`);
    return {
      ...response.data,
      data: {
        ...response.data.data,
        status: String(response.data.data?.status ?? "NONE"),
        blockedByMe: response.data.data?.blockedByMe ?? false,
      },
    };
  } catch (error) {
    if (!isCompatibilityStatus(error, [404, 405])) {
      throw error;
    }
  }

  const fallbacks: Array<() => Promise<ApiResponse<FriendshipStatus>>> = [
    async () => (await httpClient.delete<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/block/${targetUserId}`)).data,
    async () =>
      (await httpClient.post<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/unblock/${targetUserId}`, {})).data,
    async () => (await httpClient.post<ApiResponse<FriendshipStatus>>("/api/v1/users/friendships/unblock", { targetUserId })).data,
    async () =>
      (await httpClient.post<ApiResponse<FriendshipStatus>>(`/api/v1/users/friendships/block/${targetUserId}/unblock`, {})).data,
  ];

  let latestError: unknown;
  for (const request of fallbacks) {
    try {
      const result = await request();
      return {
        ...result,
        data: {
          ...result.data,
          status: String(result.data?.status ?? "NONE"),
          blockedByMe: result.data?.blockedByMe ?? false,
        },
      };
    } catch (error) {
      latestError = error;
      if (!isCompatibilityStatus(error, [404, 405])) {
        throw error;
      }
    }
  }

  throw latestError;
}

export async function acceptFriendRequest(friendshipId: string) {
  const response = await httpClient.post<ApiResponse<{ friendshipId: string; status: string }>>(
    `/api/v1/users/friendships/${friendshipId}/accept`,
    {},
  );
  return response.data;
}

export async function declineFriendRequest(friendshipId: string) {
  const response = await httpClient.post<ApiResponse<{ friendshipId: string; status: string }>>(
    `/api/v1/users/friendships/${friendshipId}/decline`,
    {},
  );
  return response.data;
}

export async function cancelFriendRequest(friendshipId: string) {
  try {
    const response = await httpClient.delete<ApiResponse<{ friendshipId: string; status: string }>>(
      `/api/v1/users/friendships/requests/${friendshipId}`,
    );
    return response.data;
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  try {
    const response = await httpClient.post<ApiResponse<{ friendshipId: string; status: string }>>(
      `/api/v1/users/friendships/${friendshipId}/cancel`,
      {},
    );
    return response.data;
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  const legacyResponse = await httpClient.delete<ApiResponse<{ friendshipId: string; status: string }>>(
    `/api/v1/users/friendships/${friendshipId}/cancel`,
  );
  return legacyResponse.data;
}

export async function cancelFriendRequestForUser(targetUserId: string, requestId?: string | null) {
  let resolvedRequestId = requestId ? String(requestId).trim() : "";
  if (!resolvedRequestId) {
    const status = await getRelationshipStatus(targetUserId);
    resolvedRequestId = String(status.data?.requestId ?? status.data?.friendshipId ?? "").trim();
  }

  if (!resolvedRequestId) {
    const notFoundError = new Error("No pending friend request found for this user");
    (notFoundError as Error & { code?: string }).code = "RELATIONSHIP_REQUEST_NOT_FOUND";
    throw notFoundError;
  }

  return cancelFriendRequest(resolvedRequestId);
}

export async function blockRelationshipUser(targetUserId: string) {
  try {
    return await blockUser(targetUserId);
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  const response = await httpClient.post<ApiResponse<FriendshipStatus>>(`/api/v1/users/blocks/${targetUserId}`, {});
  return response.data;
}

export async function unblockRelationshipUser(targetUserId: string) {
  try {
    return await unblockUser(targetUserId);
  } catch (error) {
    if (!shouldFallbackLegacyEndpoint(error)) {
      throw error;
    }
  }

  const response = await httpClient.delete<ApiResponse<FriendshipStatus>>(`/api/v1/users/blocks/${targetUserId}`);
  return response.data;
}

export async function getConversations() {
  const response = await httpClient.get<ApiResponse<ConversationPayload[]>>("/api/v1/chat/conversations");
  const normalized = (response.data.data ?? []).map((item) => normalizeConversationItem(item));
  return {
    ...response.data,
    data: normalized,
  };
}

export async function createDirectConversation(targetUserId: string) {
  const response = await httpClient.post<ApiResponse<ConversationPayload>>("/api/v1/chat/conversations/direct", {
    targetUserId,
  });
  return {
    ...response.data,
    data: normalizeConversationItem(response.data.data),
  };
}

export async function createGroupConversation(name: string, memberIds: string[], avatar?: string | null) {
  const response = await httpClient.post<ApiResponse<ConversationPayload>>("/api/v1/chat/conversations/group", {
    name,
    memberIds,
    avatar: avatar ?? null,
  });
  return {
    ...response.data,
    data: normalizeConversationItem(response.data.data),
  };
}

export async function joinGroupByInviteCode(code: string) {
  const response = await httpClient.post<ApiResponse<ConversationPayload>>("/api/v1/chat/groups/join-by-link", { code });
  return {
    ...response.data,
    data: normalizeConversationItem(response.data.data),
  };
}

export async function addGroupMember(conversationId: string, userId: string) {
  const response = await httpClient.post<ApiResponse<ConversationItem>>(
    `/api/v1/chat/conversations/${conversationId}/add-member`,
    { userId },
  );
  return response.data;
}

export async function removeGroupMember(conversationId: string, userId: string) {
  const response = await httpClient.post<ApiResponse<ConversationItem>>(
    `/api/v1/chat/conversations/${conversationId}/remove-member`,
    { userId },
  );
  return response.data;
}

export async function leaveGroupConversation(conversationId: string) {
  const response = await httpClient.post<ApiResponse<ConversationItem>>(
    `/api/v1/chat/conversations/${conversationId}/leave`,
  );
  return response.data;
}

export async function setGroupAdmin(conversationId: string, userId: string, admin = true) {
  const response = await httpClient.post<ApiResponse<ConversationItem>>(
    `/api/v1/chat/conversations/${conversationId}/set-admin`,
    { userId, admin },
  );
  return response.data;
}

export async function getGroupSettings(conversationId: string) {
  const response = await httpClient.get<ApiResponse<GroupSettings>>(`/api/v1/chat/conversations/${conversationId}/settings`);
  return response.data;
}

export async function updateGroupSettings(conversationId: string, input: UpdateGroupSettingsInput) {
  const response = await httpClient.patch<ApiResponse<GroupSettings>>(
    `/api/v1/chat/conversations/${conversationId}/settings`,
    input,
  );
  return response.data;
}

export async function deleteGroupConversation(conversationId: string) {
  const response = await httpClient.delete<ApiResponse<{ conversationId: string }>>(
    `/api/v1/chat/conversations/${conversationId}`,
  );
  return response.data;
}

export async function getMessages(conversationId: string, options?: { cursor?: string | null; limit?: number }) {
  const response = await httpClient.get<ApiResponse<MessagePageData | RawMessageItem[]>>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      params: {
        cursor: options?.cursor ?? undefined,
        limit: options?.limit ?? 40,
      },
    },
  );

  if (Array.isArray(response.data.data)) {
    return {
      ...response.data,
      data: {
        items: normalizeMessagesInAscendingOrder(response.data.data),
        nextCursor: null,
      },
    };
  }

  return {
    ...response.data,
    data: {
      items: normalizeMessagesInAscendingOrder((response.data.data?.items ?? []) as RawMessageItem[]),
      nextCursor: response.data.data?.nextCursor ?? null,
    },
  };
}

export async function editMessage(conversationId: string, messageId: string, content: string) {
  const response = await httpClient.patch<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/edit`,
    { content },
  );
  return response.data;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  options?: {
    type?: MessageType;
    fileUrl?: string | null;
    fileName?: string | null;
    parentMessageId?: string | null;
  },
) {
  const response = await httpClient.post<ApiResponse<RawMessageItem>>(`/api/v1/chat/conversations/${conversationId}/messages`, {
    type: options?.type ?? "TEXT",
    content,
    fileUrl: options?.fileUrl ?? null,
    fileName: options?.fileName ?? null,
    parentMessageId: options?.parentMessageId ?? null,
  });
  return {
    ...response.data,
    data: normalizeMessage(response.data.data),
  };
}

export async function recallMessage(conversationId: string, messageId: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/recall`,
  );
  return response.data;
}

export async function deleteForMe(conversationId: string, messageId: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/delete-for-me`,
  );
  return response.data;
}

export async function forwardMessage(sourceConversationId: string, messageId: string, targetConversationId: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${sourceConversationId}/messages/${messageId}/forward`,
    { targetConversationId },
  );
  return response.data;
}

export async function readMessage(conversationId: string, messageId: string) {
  if (supportsMessageReadEndpoint === false) {
    return {
      success: true,
      message: "Message read endpoint unavailable",
      data: { messageId },
    };
  }

  try {
    const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
      `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/read`,
    );
    supportsMessageReadEndpoint = true;
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      supportsMessageReadEndpoint = false;
      return {
        success: true,
        message: "Message read endpoint unavailable",
        data: { messageId },
      };
    }
    throw error;
  }
}

export async function markConversationRead(conversationId: string, messageId?: string | null) {
  if (supportsConversationReadEndpoint === false) {
    return {
      success: true,
      message: "Conversation read endpoint unavailable",
      data: { conversationId, messageId: messageId ?? "" },
    };
  }

  try {
    const response = await httpClient.patch<ApiResponse<{ conversationId: string; messageId: string }>>(
      `/api/v1/chat/conversations/${conversationId}/read`,
      null,
      {
        params: { messageId: messageId ?? undefined },
      },
    );
    supportsConversationReadEndpoint = true;
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      supportsConversationReadEndpoint = false;
      supportsMessageReadEndpoint = false;
      return {
        success: true,
        message: "Conversation read endpoint unavailable",
        data: { conversationId, messageId: messageId ?? "" },
      };
    }
    throw error;
  }
}

export async function addReaction(conversationId: string, messageId: string, emoji: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string; emoji: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    { emoji },
  );
  return response.data;
}

export async function removeReaction(conversationId: string, messageId: string, emoji: string) {
  const response = await httpClient.delete<ApiResponse<{ messageId: string; emoji: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      params: { emoji },
    },
  );
  return response.data;
}

export function toApiErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }>;
  if (axiosError.response?.status === 413) {
    return "File quá lớn. Vui lòng chọn file nhỏ hơn giới hạn hệ thống.";
  }
  return axiosError.response?.data?.message ?? axiosError.message ?? "Unexpected error";
}
