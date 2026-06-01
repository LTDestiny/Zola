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
  phone?: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthdate: string | null;
  hideBirthdate?: boolean | null;
  hideEmail?: boolean | null;
  hidePhone?: boolean | null;
  allowStrangerMessages?: boolean | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
};

export type UpdateUserProfileInput = {
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  hideBirthdate?: boolean | null;
  hideEmail?: boolean | null;
  hidePhone?: boolean | null;
  allowStrangerMessages?: boolean | null;
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

export type FriendshipStatus = {
  friendshipId?: string;
  status: string;
  requesterId?: string;
  addresseeId?: string;
  blockedByMe?: boolean;
  blockedByPeer?: boolean;
};

export type RelationshipStatusPayload = {
  status: string;
  requestId?: string;
  friendshipId?: string;
  requesterId?: string;
  addresseeId?: string;
  isBlockedByMe?: boolean;
  isBlockedMe?: boolean;
  blockedByMe?: boolean;
  blockedByPeer?: boolean;
};

export type ConversationItem = {
  id: string;
  type?: "private" | "group";
  name: string;
  avatar?: string | null;
  lastMessage: string;
  lastMessageSenderId?: string | null;
  lastMessageType?: MessageType | string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned?: boolean;
  pinnedAt?: string | null;
  lastReadAt?: string | null;
  lastReadMessageId?: string | null;
  participants: string[];
  admins?: string[];
  ownerId?: string | null;
  isOnline?: boolean | null;
  otherUserId?: string | null;
};

export type GroupSettings = {
  pinnedMessages?: Array<{
    sourceMessageId: string;
    title: string;
    preview: string;
    createdAtMs: number;
  }>;
  conversationId: string;
  name: string;
  avatar: string | null;
  ownerId: string | null;
  admins: string[];
  participants: string[];
  allowMembersEditGroupProfile: boolean;
  allowMembersPinBoardItems: boolean;
  allowMembersCreateNotes: boolean;
  allowMembersCreatePolls: boolean;
  allowMembersSendMessages: boolean;
  onlyAdminsCanMessage: boolean;
  requireApprovalToJoin: boolean;
  highlightAdminMessages: boolean;
  allowMemberInvite: boolean;
  allowMemberEditGroupInfo?: boolean;
  allowMemberPinBoardItems?: boolean;
  allowMemberCreateNotes?: boolean;
  allowMemberCreateReminders?: boolean;
  allowMemberCreatePolls?: boolean;
  inviteCode?: string | null;
  isOwner: boolean;
  isAdmin: boolean;
};

export type UpdateGroupSettingsInput = {
  name?: string;
  avatar?: string | null;
  allowMembersEditGroupProfile?: boolean;
  allowMembersPinBoardItems?: boolean;
  allowMembersCreateNotes?: boolean;
  allowMembersCreatePolls?: boolean;
  allowMembersSendMessages?: boolean;
  onlyAdminsCanMessage?: boolean;
  requireApprovalToJoin?: boolean;
  highlightAdminMessages?: boolean;
  allowMemberInvite?: boolean;
  allowMemberEditGroupInfo?: boolean;
  allowMemberPinBoardItems?: boolean;
  allowMemberCreateNotes?: boolean;
  allowMemberCreateReminders?: boolean;
  allowMemberCreatePolls?: boolean;
  transferOwnerId?: string;
};

export type UserPresenceItem = {
  userId: string;
  online: boolean;
  lastChangedAt: string | null;
};

export type MessageReactionEntry = {
  userId: string;
  emoji: string;
};

export type MessageType =
  | "TEXT"
  | "EMOJI"
  | "FILE"
  | "FORWARD"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "STICKER"
  | "GIF"
  | "CONTACT"
  | "LOCATION"
  | "POLL"
  | "REMINDER"
  | "NOTE"
  | "MEETING";

export type MessageItem = {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string | null;
  type?: MessageType;
  content: string;
  parentMessageId?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  reactions?: string[];
  reactionEntries?: MessageReactionEntry[];
  recalled?: boolean;
  deletedForUsers?: string[];
  deliveredTo?: string[];
  seenBy?: string[];
  isRead?: boolean;
  createdAt: string | null;
  updatedAt?: string | null;
  edited?: boolean;
};

export type MessagePageData = {
  items: MessageItem[];
  nextCursor: string | null;
};
