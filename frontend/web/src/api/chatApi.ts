import { AxiosError } from "axios";
import { httpClient } from "./httpClient";

let supportsConversationReadEndpoint: boolean | null = null;

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthdate: string | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
};

export type UpdateUserProfileInput = {
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  birthdate?: string | null;
};

export type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  lastReadAt?: string | null;
  lastReadMessageId?: string | null;
  participants: string[];
};

export type PendingFriendRequestItem = {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  status: string;
};

export type FriendContactItem = {
  friendshipId: string;
  userId: string;
};

export type UserPresenceItem = {
  userId: string;
  online: boolean;
  lastChangedAt: string | null;
};

export type MessageItem = {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string | null;
  type?: string;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  reactions?: string[];
  recalled?: boolean;
  deletedForUsers?: string[];
  deliveredTo?: string[];
  seenBy?: string[];
  createdAt: string | null;
  updatedAt?: string | null;
  edited?: boolean;
};

export type MessagePageData = {
  items: MessageItem[];
  nextCursor: string | null;
};

export async function getMyProfile() {
  const response = await httpClient.get<ApiResponse<UserProfile>>(
    "/api/v1/users/me/profile",
  );
  return response.data;
}

export async function updateMyProfile(input: UpdateUserProfileInput) {
  const response = await httpClient.put<ApiResponse<UserProfile>>(
    "/api/v1/users/me/profile",
    input,
  );
  return response.data;
}

export async function deleteMyProfile() {
  const response = await httpClient.delete<ApiResponse<{ ok: boolean }>>(
    "/api/v1/users/me/profile",
  );
  return response.data;
}

export async function searchUserByEmail(email: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>(
    "/api/v1/users/search-by-email",
    {
      params: { email },
    },
  );
  return response.data;
}

export async function getUserSummary(userId: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>(
    `/api/v1/users/${userId}/summary`,
  );
  return response.data;
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

  const response = await httpClient.get<ApiResponse<UserPresenceItem[]>>(
    "/api/v1/users/presence",
    {
      params: { ids },
    },
  );
  return response.data;
}

export async function getFriendshipStatus(targetUserId: string) {
  const response = await httpClient.get<ApiResponse<{ status: string }>>(
    "/api/v1/users/friendships/status",
    {
      params: { targetUserId },
    },
  );
  return response.data;
}

export async function addFriend(addresseeId: string) {
  const response = await httpClient.post<
    ApiResponse<{ friendshipId: string; status: string }>
  >("/api/v1/users/friendships", {
    addresseeId,
  });
  return response.data;
}

export async function getPendingFriendRequests() {
  const response = await httpClient.get<
    ApiResponse<PendingFriendRequestItem[]>
  >("/api/v1/users/friendships/pending");
  return response.data;
}

export async function getPendingFriendRequestsUnreadCount() {
  const response = await httpClient.get<ApiResponse<{ count: number }>>(
    "/api/v1/users/friendships/pending/unread-count",
  );
  return response.data;
}

export async function markPendingFriendRequestsRead() {
  const response = await httpClient.post<ApiResponse<{ updated: number }>>(
    "/api/v1/users/friendships/pending/mark-read",
    {},
  );
  return response.data;
}

export async function getFriends() {
  const response = await httpClient.get<ApiResponse<FriendContactItem[]>>(
    "/api/v1/users/friendships/friends",
  );
  return response.data;
}

export async function acceptFriendRequest(friendshipId: string) {
  const response = await httpClient.post<
    ApiResponse<{ friendshipId: string; status: string }>
  >(`/api/v1/users/friendships/${friendshipId}/accept`, {});
  return response.data;
}

export async function declineFriendRequest(friendshipId: string) {
  const response = await httpClient.post<
    ApiResponse<{ friendshipId: string; status: string }>
  >(`/api/v1/users/friendships/${friendshipId}/decline`, {});
  return response.data;
}

export async function removeFriend(friendshipId: string) {
  const response = await httpClient.delete<
    ApiResponse<{ friendshipId: string; status: string }>
  >(`/api/v1/users/friendships/${friendshipId}`);
  return response.data;
}

export async function getConversations() {
  const response = await httpClient.get<ApiResponse<ConversationItem[]>>(
    "/api/v1/chat/conversations",
  );
  const normalized = (response.data.data ?? []).map((item) => ({
    ...item,
    unreadCount: Number.isFinite(item.unreadCount) ? item.unreadCount : 0,
    lastReadAt: item.lastReadAt ?? null,
    lastReadMessageId: item.lastReadMessageId ?? null,
  }));
  return {
    ...response.data,
    data: normalized,
  };
}

export async function createDirectConversation(targetUserId: string) {
  const response = await httpClient.post<ApiResponse<ConversationItem>>(
    "/api/v1/chat/conversations/direct",
    { targetUserId },
  );
  return response.data;
}

export async function getMessages(
  conversationId: string,
  options?: { cursor?: string | null; limit?: number },
) {
  const response = await httpClient.get<
    ApiResponse<MessagePageData | MessageItem[]>
  >(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      params: {
        cursor: options?.cursor ?? undefined,
        limit: options?.limit ?? 50,
      },
    },
  );

  const payload = response.data.data;
  if (Array.isArray(payload)) {
    // Backward compatible shape from old gateway/service: data is MessageItem[]
    return {
      ...response.data,
      data: {
        items: payload,
        nextCursor: null,
      },
    };
  }

  return {
    ...response.data,
    data: {
      items: payload?.items ?? [],
      nextCursor: payload?.nextCursor ?? null,
    },
  };
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string,
) {
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
    type?: "TEXT" | "EMOJI" | "FILE" | "FORWARD" | "IMAGE" | "VIDEO" | "AUDIO";
    fileUrl?: string | null;
    fileName?: string | null;
  },
) {
  const response = await httpClient.post<ApiResponse<MessageItem>>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      type: options?.type ?? "TEXT",
      content,
      fileUrl: options?.fileUrl ?? null,
      fileName: options?.fileName ?? null,
    },
  );
  return response.data;
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

export async function forwardMessage(
  sourceConversationId: string,
  messageId: string,
  targetConversationId: string,
) {
  const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${sourceConversationId}/messages/${messageId}/forward`,
    { targetConversationId },
  );
  return response.data;
}

export async function readMessage(conversationId: string, messageId: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/read`,
  );
  return response.data;
}

export async function markConversationRead(
  conversationId: string,
  messageId?: string | null,
) {
  if (supportsConversationReadEndpoint === false) {
    if (messageId) {
      await readMessage(conversationId, messageId);
    }
    return {
      success: true,
      message: "Read state updated via backward-compatible endpoint",
      data: {
        conversationId,
        messageId: messageId ?? "",
      },
    };
  }

  try {
    const response = await httpClient.patch<
      ApiResponse<{ conversationId: string; messageId: string }>
    >(`/api/v1/chat/conversations/${conversationId}/read`, null, {
      params: {
        messageId: messageId ?? undefined,
      },
    });
    supportsConversationReadEndpoint = true;
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      supportsConversationReadEndpoint = false;
      if (messageId) {
        await readMessage(conversationId, messageId);
      }
      return {
        success: true,
        message: messageId
          ? "Read state updated via fallback endpoint"
          : "Conversation read endpoint unavailable, using compatibility mode",
        data: {
          conversationId,
          messageId: messageId ?? "",
        },
      };
    }
    throw error;
  }
}

export async function addReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
) {
  const response = await httpClient.post<
    ApiResponse<{ messageId: string; emoji: string }>
  >(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    { emoji },
  );
  return response.data;
}

export async function removeReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
) {
  const response = await httpClient.delete<
    ApiResponse<{ messageId: string; emoji: string }>
  >(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      params: { emoji },
    },
  );
  return response.data;
}

export function toApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  if (axiosError.response?.status === 413) {
    return "File qua lon. Vui long chon file nho hon gioi han he thong.";
  }
  return (
    axiosError.response?.data?.message ??
    axiosError.message ??
    "Unexpected error"
  );
}
