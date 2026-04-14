export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type AuthTokenPayload = {
  userId: string;
  sessionId: string;
  accessToken: string;
  accessExpiresInSeconds: number;
  refreshToken: string;
  refreshExpiresInSeconds: number;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthdate: string | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
};

export type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned?: boolean;
  participants: string[];
};

export type MessageType =
  | "TEXT"
  | "EMOJI"
  | "FILE"
  | "FORWARD"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO";

export type MessageItem = {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string | null;
  type?: MessageType;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  reactions?: string[];
  recalled?: boolean;
  seenBy?: string[];
  createdAt: string | null;
};
