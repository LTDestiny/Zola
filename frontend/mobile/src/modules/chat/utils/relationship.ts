import type {
  FriendshipStatus,
  PendingFriendRequestItem,
  FriendContactItem,
  RelationshipStatusPayload,
} from "@/shared/types/api";

export type RelationshipStatus =
  | "NONE"
  | "OUTGOING_REQUEST"
  | "INCOMING_REQUEST"
  | "FRIEND"
  | "BLOCKED_BY_ME"
  | "BLOCKED_ME";

export type RelationshipEntry = {
  targetUserId: string;
  status: RelationshipStatus;
  requestId: string | null;
  friendshipId: string | null;
  requesterId: string | null;
  addresseeId: string | null;
  isBlockedByMe: boolean;
  isBlockedMe: boolean;
  updatedAt: number;
};

type LegacyRelationshipPayload = FriendshipStatus | RelationshipStatusPayload;

export function createEmptyRelationshipEntry(
  targetUserId: string | null | undefined,
): RelationshipEntry {
  return {
    targetUserId: String(targetUserId ?? "").trim(),
    status: "NONE",
    requestId: null,
    friendshipId: null,
    requesterId: null,
    addresseeId: null,
    isBlockedByMe: false,
    isBlockedMe: false,
    updatedAt: 0,
  };
}

function toOptionalId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function normalizeRelationshipPayload(
  targetUserId: string,
  payload: LegacyRelationshipPayload | null | undefined,
  currentUserId?: string | null,
): RelationshipEntry {
  const empty = createEmptyRelationshipEntry(targetUserId);
  if (!payload) {
    return empty;
  }

  const blockedByMe = Boolean(
    (payload as RelationshipStatusPayload).isBlockedByMe ?? payload.blockedByMe,
  );
  const blockedMe = Boolean(
    (payload as RelationshipStatusPayload).isBlockedMe ?? payload.blockedByPeer,
  );
  const requesterId = toOptionalId(payload.requesterId);
  const addresseeId = toOptionalId(payload.addresseeId);
  const friendshipId = toOptionalId(payload.friendshipId);
  const requestId = toOptionalId((payload as RelationshipStatusPayload).requestId) ?? friendshipId;
  const normalizedStatus = String(payload.status ?? "").trim().toUpperCase();

  let status: RelationshipStatus = "NONE";
  if (blockedByMe) {
    status = "BLOCKED_BY_ME";
  } else if (blockedMe) {
    status = "BLOCKED_ME";
  } else if (normalizedStatus === "OUTGOING_REQUEST") {
    status = "OUTGOING_REQUEST";
  } else if (normalizedStatus === "INCOMING_REQUEST") {
    status = "INCOMING_REQUEST";
  } else if (normalizedStatus === "FRIEND" || normalizedStatus === "ACCEPTED") {
    status = "FRIEND";
  } else if (normalizedStatus === "PENDING") {
    const normalizedCurrentUserId = String(currentUserId ?? "").trim();
    if (normalizedCurrentUserId && requesterId === normalizedCurrentUserId) {
      status = "OUTGOING_REQUEST";
    } else if (normalizedCurrentUserId && addresseeId === normalizedCurrentUserId) {
      status = "INCOMING_REQUEST";
    }
  } else if (normalizedStatus === "BLOCKED") {
    if (blockedByMe) {
      status = "BLOCKED_BY_ME";
    } else if (blockedMe) {
      status = "BLOCKED_ME";
    }
  }

  return {
    targetUserId: String(targetUserId).trim(),
    status,
    requestId:
      status === "OUTGOING_REQUEST" || status === "INCOMING_REQUEST"
        ? requestId
        : null,
    friendshipId,
    requesterId,
    addresseeId,
    isBlockedByMe: blockedByMe,
    isBlockedMe: blockedMe,
    updatedAt: Date.now(),
  };
}

export function relationshipToLegacyFriendshipStatus(
  entry: RelationshipEntry | null | undefined,
) {
  switch (entry?.status) {
    case "OUTGOING_REQUEST":
    case "INCOMING_REQUEST":
      return "PENDING";
    case "FRIEND":
      return "ACCEPTED";
    case "BLOCKED_BY_ME":
    case "BLOCKED_ME":
      return "BLOCKED";
    default:
      return "NONE";
  }
}

export function relationshipToRequestDirection(
  entry: RelationshipEntry | null | undefined,
) {
  if (entry?.status === "OUTGOING_REQUEST") {
    return "outgoing" as const;
  }
  if (entry?.status === "INCOMING_REQUEST") {
    return "incoming" as const;
  }
  return null;
}

export function hydrateRelationshipEntryFromCollections(args: {
  targetUserId: string;
  currentUserId?: string | null;
  pendingFriendRequests?: PendingFriendRequestItem[] | null;
  sentPendingFriendRequests?: PendingFriendRequestItem[] | null;
  friendContacts?: FriendContactItem[] | null;
  blockedUserIds?: string[] | null;
  blockedByPeerUserIds?: string[] | null;
}): RelationshipEntry {
  const targetUserId = String(args.targetUserId ?? "").trim();
  if (!targetUserId) {
    return createEmptyRelationshipEntry(targetUserId);
  }

  const blockedByMe = (args.blockedUserIds ?? []).includes(targetUserId);
  const blockedMe = (args.blockedByPeerUserIds ?? []).includes(targetUserId);
  if (blockedByMe || blockedMe) {
    return {
      ...createEmptyRelationshipEntry(targetUserId),
      status: blockedByMe ? "BLOCKED_BY_ME" : "BLOCKED_ME",
      isBlockedByMe: blockedByMe,
      isBlockedMe: blockedMe,
      updatedAt: Date.now(),
    };
  }

  const friend = (args.friendContacts ?? []).find((item) => item.userId === targetUserId);
  if (friend) {
    return {
      ...createEmptyRelationshipEntry(targetUserId),
      status: "FRIEND",
      friendshipId: friend.friendshipId,
      updatedAt: Date.now(),
    };
  }

  const incoming = (args.pendingFriendRequests ?? []).find(
    (item) => item.requesterId === targetUserId,
  );
  if (incoming) {
    return {
      ...createEmptyRelationshipEntry(targetUserId),
      status: "INCOMING_REQUEST",
      requestId: incoming.friendshipId,
      friendshipId: incoming.friendshipId,
      requesterId: incoming.requesterId,
      addresseeId: incoming.addresseeId,
      updatedAt: Date.now(),
    };
  }

  const sent = (args.sentPendingFriendRequests ?? []).find(
    (item) => item.addresseeId === targetUserId,
  );
  if (sent) {
    return {
      ...createEmptyRelationshipEntry(targetUserId),
      status: "OUTGOING_REQUEST",
      requestId: sent.friendshipId,
      friendshipId: sent.friendshipId,
      requesterId: sent.requesterId,
      addresseeId: sent.addresseeId,
      updatedAt: Date.now(),
    };
  }

  return {
    ...createEmptyRelationshipEntry(targetUserId),
    updatedAt: Date.now(),
  };
}
