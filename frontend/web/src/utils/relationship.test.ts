import { describe, expect, it } from "vitest";
import {
  hydrateRelationshipEntryFromCollections,
  normalizeRelationshipPayload,
  relationshipToLegacyFriendshipStatus,
} from "./relationship";

describe("relationship utils", () => {
  it("maps outgoing pending requests from v2 payload", () => {
    const entry = normalizeRelationshipPayload("user-b", {
      status: "OUTGOING_PENDING",
      requestId: "req-1",
      friendshipId: "req-1",
      requesterId: "user-a",
      addresseeId: "user-b",
    }, "user-a");

    expect(entry.status).toBe("OUTGOING_PENDING");
    expect(entry.requestId).toBe("req-1");
    expect(relationshipToLegacyFriendshipStatus(entry)).toBe("PENDING");
  });

  it("maps legacy pending payload by requester/addressee direction", () => {
    const entry = normalizeRelationshipPayload("user-b", {
      status: "PENDING",
      friendshipId: "req-2",
      requesterId: "user-b",
      addresseeId: "user-a",
    }, "user-a");

    expect(entry.status).toBe("INCOMING_PENDING");
    expect(entry.requestId).toBe("req-2");
  });

  it("maps block state using explicit blocker flags", () => {
    const entry = normalizeRelationshipPayload("user-b", {
      status: "BLOCKED_ME",
      isBlockedByMe: false,
      isBlockedMe: true,
    }, "user-a");

    expect(entry.status).toBe("BLOCKED_ME");
    expect(entry.isBlockedMe).toBe(true);
    expect(relationshipToLegacyFriendshipStatus(entry)).toBe("BLOCKED");
  });

  it("hydrates sent requests only when current user is the requester", () => {
    const entry = hydrateRelationshipEntryFromCollections({
      targetUserId: "user-b",
      currentUserId: "user-a",
      pendingFriendRequests: [
        {
          friendshipId: "req-incoming",
          requesterId: "user-c",
          addresseeId: "user-a",
          status: "PENDING",
        },
      ],
      sentPendingFriendRequests: [
        {
          friendshipId: "req-outgoing",
          requesterId: "user-a",
          addresseeId: "user-b",
          status: "PENDING",
        },
      ],
    });

    expect(entry.status).toBe("OUTGOING_PENDING");
    expect(entry.requestId).toBe("req-outgoing");
    expect(entry.addresseeId).toBe("user-b");
  });

  it("prioritizes block state over pending or friend collections", () => {
    const entry = hydrateRelationshipEntryFromCollections({
      targetUserId: "user-b",
      currentUserId: "user-a",
      pendingFriendRequests: [
        {
          friendshipId: "req-3",
          requesterId: "user-b",
          addresseeId: "user-a",
          status: "PENDING",
        },
      ],
      sentPendingFriendRequests: [
        {
          friendshipId: "req-4",
          requesterId: "user-a",
          addresseeId: "user-b",
          status: "PENDING",
        },
      ],
      friendContacts: [
        {
          friendshipId: "friend-1",
          userId: "user-b",
        },
      ],
      blockedUserIds: ["user-b"],
    });

    expect(entry.status).toBe("BLOCKED_BY_ME");
    expect(entry.isBlockedByMe).toBe(true);
    expect(entry.requestId).toBeNull();
  });
});
