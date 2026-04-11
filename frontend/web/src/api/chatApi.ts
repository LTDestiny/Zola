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
  senderId: string;
  content: string;
  createdAt: string | null;
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

export async function getMessages(conversationId: string) {
  const response = await httpClient.get<ApiResponse<MessageItem[]>>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
  );
  return response.data;
}

export async function sendMessage(conversationId: string, content: string) {
  const response = await httpClient.post<ApiResponse<MessageItem>>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      content,
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
