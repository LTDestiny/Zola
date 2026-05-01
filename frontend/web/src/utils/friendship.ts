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
  if (normalized === "DELETED") return "NONE";
  return "NONE";
}

export function resolveBlockedState(
  payload: { blockedByMe?: boolean | null; blockedByPeer?: boolean | null } | null | undefined,
) {
  return {
    blockedByMe: Boolean(payload?.blockedByMe),
    blockedByPeer: Boolean(payload?.blockedByPeer),
  };
}

export function resolveBlockRelationship(
  payload: { blockedByMe?: boolean | null; blockedByPeer?: boolean | null } | null | undefined,
): BlockRelationship {
  if (payload?.blockedByMe) {
    return "blocked_by_me";
  }
  if (payload?.blockedByPeer) {
    return "blocked_by_peer";
  }
  return "not_blocked";
}
