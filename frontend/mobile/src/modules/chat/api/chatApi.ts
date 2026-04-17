import { AxiosError } from "axios";
import { httpClient } from "./httpClient";
import type { ApiResponse, ConversationItem, MessageItem, MessageType, UserProfile } from "@/shared/types/api";

let supportsConversationReadEndpoint: boolean | null = null;
let supportsMessageReadEndpoint: boolean | null = null;

type MessagePageData = {
  items: MessageItem[];
  nextCursor: string | null;
};

type RawMessageItem = Omit<MessageItem, "id"> & {
  id?: string;
  messageId?: string;
};

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
  // Backend paginates newest-first; mobile store expects oldest-first.
  return items
    .map(normalizeMessage)
    .filter((item) => Boolean(item.id))
    .reverse();
}

export async function getMyProfile() {
  const response = await httpClient.get<ApiResponse<UserProfile>>("/api/v1/users/me/profile");
  return response.data;
}

export async function getUserProfile(userId: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>(`/api/v1/users/${userId}/summary`);
  return response.data;
}

export async function getConversations() {
  const response = await httpClient.get<ApiResponse<ConversationItem[]>>("/api/v1/chat/conversations");
  return {
    ...response.data,
    data: (response.data.data ?? []).map((item) => ({
      ...item,
      unreadCount: Number.isFinite(item.unreadCount) ? item.unreadCount : 0,
      isOnline: Boolean(item.isOnline),
      otherUserId: item.otherUserId ?? null,
    })),
  };
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
      items: normalizeMessagesInAscendingOrder(
        (response.data.data?.items ?? []) as RawMessageItem[],
      ),
      nextCursor: response.data.data?.nextCursor ?? null,
    },
  };
}

export async function sendMessage(
  conversationId: string,
  content: string,
  options?: { type?: MessageType; fileUrl?: string | null; fileName?: string | null },
) {
  const response = await httpClient.post<ApiResponse<RawMessageItem>>(`/api/v1/chat/conversations/${conversationId}/messages`, {
    type: options?.type ?? "TEXT",
    content,
    fileUrl: options?.fileUrl ?? null,
    fileName: options?.fileName ?? null,
  });
  return {
    ...response.data,
    data: normalizeMessage(response.data.data),
  };
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
      { params: { messageId: messageId ?? undefined } },
    );
    supportsConversationReadEndpoint = true;
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      supportsConversationReadEndpoint = false;
      return {
        success: true,
        message: "Conversation read endpoint unavailable",
        data: { conversationId, messageId: messageId ?? "" },
      };
    }
    throw error;
  }
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

export async function addReaction(conversationId: string, messageId: string, emoji: string) {
  const response = await httpClient.post<ApiResponse<{ messageId: string; emoji: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    { emoji },
  );
  return response.data;
}

export function toApiErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? axiosError.message ?? "Unexpected error";
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRIEND REQUEST APIs
// ═══════════════════════════════════════════════════════════════════════════════

import type { PendingFriendRequestItem, FriendContactItem } from "@/shared/types/api";

export async function getPendingFriendRequests() {
  const response = await httpClient.get<ApiResponse<PendingFriendRequestItem[]>>(
    "/api/v1/users/friendships/pending",
  );
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
