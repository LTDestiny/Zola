import { create } from "zustand";
import {
  getRelationshipStatus,
} from "../api/chatApi";
import type {
  FriendContactItem,
  PendingFriendRequestItem,
} from "@/shared/types/api";
import {
  createEmptyRelationshipEntry,
  hydrateRelationshipEntryFromCollections,
  normalizeRelationshipPayload,
  type RelationshipEntry,
} from "../utils/relationship";

type HydrateCollectionsInput = {
  currentUserId?: string | null;
  pendingFriendRequests?: PendingFriendRequestItem[] | null;
  sentPendingFriendRequests?: PendingFriendRequestItem[] | null;
  friendContacts?: FriendContactItem[] | null;
  blockedUserIds?: string[] | null;
  blockedByPeerUserIds?: string[] | null;
};

function mergeEntry(
  current: RelationshipEntry | undefined,
  next: RelationshipEntry,
): RelationshipEntry {
  if (!current) {
    return next;
  }

  return {
    ...current,
    ...next,
  };
}

function preserveLocalBlockState(
  current: RelationshipEntry | undefined,
  next: RelationshipEntry,
): RelationshipEntry {
  if (
    current &&
    (current.status === "BLOCKED_BY_ME" || current.status === "BLOCKED_ME") &&
    next.status === "NONE"
  ) {
    return {
      ...current,
      updatedAt: Date.now(),
    };
  }

  return next;
}

type RelationshipStoreState = {
  entries: Record<string, RelationshipEntry>;
  friends: FriendContactItem[];
  receivedRequests: PendingFriendRequestItem[];
  sentRequests: PendingFriendRequestItem[];
  blockedUsers: Array<{ userId: string }>;
  
  setEntry: (entry: RelationshipEntry) => void;
  clearEntry: (targetUserId: string) => void;
  clearAll: () => void;
  fetchEntry: (
    targetUserId: string,
    currentUserId?: string | null,
  ) => Promise<RelationshipEntry>;
  hydrateFromCollections: (input: HydrateCollectionsInput) => void;
  
  // Explicit setters for lists to ensure UI reactivity
  setFriends: (list: FriendContactItem[]) => void;
  setReceivedRequests: (list: PendingFriendRequestItem[]) => void;
  setSentRequests: (list: PendingFriendRequestItem[]) => void;
  setBlockedUsers: (list: Array<{ userId: string }>) => void;
};

export const useRelationshipStore = create<RelationshipStoreState>((set) => ({
  entries: {},
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  blockedUsers: [],

  setEntry: (entry) => {
    const targetUserId = String(entry.targetUserId ?? "").trim();
    if (!targetUserId) {
      return;
    }

    set((state) => ({
      entries: {
        ...state.entries,
        [targetUserId]: mergeEntry(state.entries[targetUserId], {
          ...entry,
          targetUserId,
        }),
      },
    }));
  },

  clearEntry: (targetUserId) => {
    const normalizedTargetUserId = String(targetUserId ?? "").trim();
    if (!normalizedTargetUserId) {
      return;
    }

    set((state) => {
      const nextEntries = { ...state.entries };
      delete nextEntries[normalizedTargetUserId];
      return { entries: nextEntries };
    });
  },

  clearAll: () => {
    set({
      entries: {},
      friends: [],
      receivedRequests: [],
      sentRequests: [],
      blockedUsers: [],
    });
  },

  setFriends: (list) => set({ friends: list }),
  setReceivedRequests: (list) => set({ receivedRequests: list }),
  setSentRequests: (list) => set({ sentRequests: list }),
  setBlockedUsers: (list) => set({ blockedUsers: list }),

  fetchEntry: async (targetUserId, currentUserId) => {
    const normalizedTargetUserId = String(targetUserId ?? "").trim();
    if (!normalizedTargetUserId) {
      return createEmptyRelationshipEntry(normalizedTargetUserId);
    }

    try {
      const response = await getRelationshipStatus(normalizedTargetUserId);
      const normalizedEntry = normalizeRelationshipPayload(
        normalizedTargetUserId,
        response.data,
        currentUserId,
      );

      set((state) => {
        const entry = preserveLocalBlockState(
          state.entries[normalizedTargetUserId],
          normalizedEntry,
        );
        return {
          entries: {
            ...state.entries,
            [normalizedTargetUserId]: mergeEntry(state.entries[normalizedTargetUserId], entry),
          },
        };
      });

      return normalizedEntry;
    } catch (error) {
       console.error("[relationshipStore] fetchEntry error:", error);
       return createEmptyRelationshipEntry(normalizedTargetUserId);
    }
  },

  hydrateFromCollections: (input) => {
    const targetUserIds = new Set<string>();
    (input.pendingFriendRequests ?? []).forEach((item) => {
      if (item.requesterId) targetUserIds.add(item.requesterId);
    });
    (input.sentPendingFriendRequests ?? []).forEach((item) => {
      if (item.addresseeId) targetUserIds.add(item.addresseeId);
    });
    (input.friendContacts ?? []).forEach((item) => {
      if (item.userId) targetUserIds.add(item.userId);
    });
    (input.blockedUserIds ?? []).forEach((userId) => {
      if (userId) targetUserIds.add(userId);
    });
    (input.blockedByPeerUserIds ?? []).forEach((userId) => {
      if (userId) targetUserIds.add(userId);
    });

    set((state) => {
      const nextEntries = { ...state.entries };

      targetUserIds.forEach((targetUserId) => {
        const hydrated = hydrateRelationshipEntryFromCollections({
          targetUserId,
          currentUserId: input.currentUserId,
          pendingFriendRequests: input.pendingFriendRequests,
          sentPendingFriendRequests: input.sentPendingFriendRequests,
          friendContacts: input.friendContacts,
          blockedUserIds: input.blockedUserIds,
          blockedByPeerUserIds: input.blockedByPeerUserIds,
        });
        nextEntries[targetUserId] = mergeEntry(nextEntries[targetUserId], hydrated);
      });

      return {
        entries: nextEntries,
        friends: input.friendContacts ?? state.friends,
        receivedRequests: input.pendingFriendRequests ?? state.receivedRequests,
        sentRequests: input.sentPendingFriendRequests ?? state.sentRequests,
        blockedUsers: input.blockedUserIds 
          ? input.blockedUserIds.map(id => ({ userId: id })) 
          : state.blockedUsers,
      };
    });
  },
}));
