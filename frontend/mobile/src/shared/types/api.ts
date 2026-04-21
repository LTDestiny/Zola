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

export type PendingFriendRequestItem = {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  requesterName?: string;
  requesterAvatar?: string | null;
  createdAt?: string | null;
};

export type FriendContactItem = {
  friendshipId: string;
  userId: string;
  fullName?: string;
  avatarUrl?: string | null;
};

export type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned?: boolean;
  participants: string[];
  isOnline?: boolean | null;
  otherUserId?: string | null;
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
  // ✅ Added missing fields for feature parity with web
  deletedForUsers?: string[];
  deliveredTo?: string[];
  updatedAt?: string | null;
  edited?: boolean;
  // ✅ Added missing fields for feature parity with web
  deletedForUsers?: string[];
  deliveredTo?: string[];
  updatedAt?: string | null;
  edited?: boolean;
};
