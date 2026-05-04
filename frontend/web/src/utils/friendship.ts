export type FriendshipStatus =
  | "NONE"
  | "PENDING"
  | "ACCEPTED"
  | "BLOCKED"
  | "REJECTED"
  | "DECLINED"
  | "CANCELLED";

export type BlockRelationship = "blocked_by_me" | "blocked_by_peer" | "not_blocked";

export function normalizeFriendshipStatus(status: string | null | undefined): FriendshipStatus {
  const normalized = (status ?? "").toString().trim().toUpperCase();
  if (
    normalized === "PENDING" ||
    normalized === "ACCEPTED" ||
    normalized === "BLOCKED" ||
    normalized === "NONE" ||
    normalized === "REJECTED" ||
    normalized === "DECLINED" ||
    normalized === "CANCELLED"
  ) {
    return normalized as FriendshipStatus;
  }
  if (normalized === "CANCELED") return "CANCELLED";
  if (normalized === "FRIENDS" || normalized === "FRIEND") return "ACCEPTED";
  if (normalized === "OUTGOING_PENDING" || normalized === "INCOMING_PENDING") {
    return "PENDING";
  }
  if (normalized === "BLOCKED_BY_ME" || normalized === "BLOCKED_ME") {
    return "BLOCKED";
  }
  if (normalized === "DELETED") return "NONE";
  return "NONE";
}

export function resolveBlockedState(
  payload: {
    blockedByMe?: boolean | null;
    blockedByPeer?: boolean | null;
    isBlockedByMe?: boolean | null;
    isBlockedMe?: boolean | null;
  } | null | undefined,
) {
  return {
    blockedByMe: Boolean(payload?.isBlockedByMe ?? payload?.blockedByMe),
    blockedByPeer: Boolean(payload?.isBlockedMe ?? payload?.blockedByPeer),
  };
}

export function resolveBlockRelationship(
  payload: {
    blockedByMe?: boolean | null;
    blockedByPeer?: boolean | null;
    isBlockedByMe?: boolean | null;
    isBlockedMe?: boolean | null;
  } | null | undefined,
): BlockRelationship {
  if (payload?.isBlockedByMe || payload?.blockedByMe) {
    return "blocked_by_me";
  }
  if (payload?.isBlockedMe || payload?.blockedByPeer) {
    return "blocked_by_peer";
  }
  return "not_blocked";
}
