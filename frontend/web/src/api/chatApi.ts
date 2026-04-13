import { AxiosError } from "axios";
import { httpClient } from "./httpClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthdate: string | null;
};

export type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  participants: string[];
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
  seenBy?: string[];
  createdAt: string | null;
  updatedAt?: string | null;
};

export async function getMyProfile() {
  const response = await httpClient.get<ApiResponse<UserProfile>>(
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

export async function getConversations() {
  const response = await httpClient.get<ApiResponse<ConversationItem[]>>(
    "/api/v1/chat/conversations",
  );
  return response.data;
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
  options?: { page?: number; size?: number },
) {
  const response = await httpClient.get<ApiResponse<MessageItem[]>>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      params: {
        page: options?.page ?? 0,
        size: options?.size ?? 50,
      },
    },
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

export async function addReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
) {
  const response = await httpClient.post<ApiResponse<{ messageId: string; emoji: string }>>(
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
  const response = await httpClient.delete<ApiResponse<{ messageId: string; emoji: string }>>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      params: { emoji },
    },
  );
  return response.data;
}

export function toApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  return (
    axiosError.response?.data?.message ??
    axiosError.message ??
    "Unexpected error"
  );
}
