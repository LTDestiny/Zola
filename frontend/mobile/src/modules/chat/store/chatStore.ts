import { create } from "zustand";
import type { ConversationItem, MessageItem } from "@/shared/types/api";

type MessageState = {
  items: MessageItem[];
  nextCursor: string | null;
};

type ChatState = {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  totalUnreadCount: number;
  typingByConversation: Record<string, boolean>;
  messagesByConversation: Record<string, MessageState>;

  setConversations: (items: ConversationItem[]) => void;
  setActiveConversation: (conversationId: string | null) => void;
  upsertConversation: (patch: Partial<ConversationItem> & { id: string }) => void;
  addUnreadForConversation: (conversationId: string) => void;
  markReadLocal: (conversationId: string) => void;

  setMessages: (conversationId: string, items: MessageItem[], nextCursor: string | null) => void;
  prependMessages: (conversationId: string, olderItems: MessageItem[], nextCursor: string | null) => void;
  appendMessageRealtime: (conversationId: string, message: MessageItem) => void;

  setTyping: (conversationId: string, isTyping: boolean) => void;
};

function byLatest(items: ConversationItem[]) {
  return [...items].sort((a, b) => {
    const pinnedDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinnedDiff !== 0) {
      return pinnedDiff;
    }
    const left = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const right = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return right - left;
  });
}

function totalUnread(items: ConversationItem[]) {
  return items.reduce((sum, item) => sum + Math.max(0, item.unreadCount ?? 0), 0);
}

function toMillis(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergeMessages(existing: MessageItem[], incoming: MessageItem[]) {
  const mergedMap = new Map<string, MessageItem>();

  for (const item of existing) {
    if (item.id) {
      mergedMap.set(item.id, item);
    }
  }

  for (const item of incoming) {
    if (!item.id) {
      continue;
    }
    const prev = mergedMap.get(item.id);
    mergedMap.set(item.id, prev ? { ...prev, ...item } : item);
  }

  return [...mergedMap.values()].sort(
    (a, b) => toMillis(a.createdAt) - toMillis(b.createdAt),
  );
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  totalUnreadCount: 0,
  typingByConversation: {},
  messagesByConversation: {},

  setConversations: (items) => {
    const existing = get().conversations;
    const activeConversationId = get().activeConversationId;
    const merged = items.map((item) => {
      const local = existing.find((entry) => entry.id === item.id);
      if (!local) {
        return item;
      }

      if (item.id === activeConversationId) {
        return {
          ...local,
          ...item,
          unreadCount: Math.max(0, item.unreadCount ?? 0),
        };
      }

      return {
        ...local,
        ...item,
        unreadCount: Math.max(item.unreadCount ?? 0, local.unreadCount ?? 0),
      };
    });

    const sorted = byLatest(merged);
    set({
      conversations: sorted,
      totalUnreadCount: totalUnread(sorted),
      activeConversationId,
    });
  },

  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  upsertConversation: (patch) => {
    const list = get().conversations;
    const index = list.findIndex((item) => item.id === patch.id);
    const next = [...list];

    if (index === -1) {
      next.unshift({
        id: patch.id,
        name: patch.name ?? "Unknown",
        lastMessage: patch.lastMessage ?? "",
        lastMessageAt: patch.lastMessageAt ?? new Date().toISOString(),
        unreadCount: patch.unreadCount ?? 0,
        isPinned: patch.isPinned ?? false,
        participants: patch.participants ?? [],
      });
    } else {
      next[index] = { ...next[index], ...patch };
    }

    const sorted = byLatest(next);
    set({ conversations: sorted, totalUnreadCount: totalUnread(sorted) });
  },

  addUnreadForConversation: (conversationId) => {
    const state = get();
    const isActive = state.activeConversationId === conversationId;
    if (isActive) return;

    const exists = state.conversations.some((item) => item.id === conversationId);
    if (!exists) {
      const created: ConversationItem = {
        id: conversationId,
        name: "Unknown",
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1,
        isPinned: false,
        participants: [],
      };

      const nextWithCreated = byLatest([created, ...state.conversations]);
      set({
        conversations: nextWithCreated,
        totalUnreadCount: totalUnread(nextWithCreated),
      });
      return;
    }

    const next = state.conversations.map((item) =>
      item.id === conversationId ? { ...item, unreadCount: (item.unreadCount ?? 0) + 1 } : item,
    );

    set({
      conversations: byLatest(next),
      totalUnreadCount: totalUnread(next),
    });
  },

  markReadLocal: (conversationId) => {
    const next = get().conversations.map((item) =>
      item.id === conversationId ? { ...item, unreadCount: 0 } : item,
    );
    set({ conversations: next, totalUnreadCount: totalUnread(next) });
  },

  setMessages: (conversationId, items, nextCursor) => {
    set((state) => {
      const current = state.messagesByConversation[conversationId]?.items ?? [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: mergeMessages(current, items),
            nextCursor,
          },
        },
      };
    });
  },

  prependMessages: (conversationId, olderItems, nextCursor) => {
    set((state) => {
      const current = state.messagesByConversation[conversationId]?.items ?? [];
      const merged = mergeMessages(current, olderItems);
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: merged,
            nextCursor,
          },
        },
      };
    });
  },

  appendMessageRealtime: (conversationId, message) => {
    set((state) => {
      const current = state.messagesByConversation[conversationId]?.items ?? [];
      const index = current.findIndex((item) => item.id === message.id);

      if (index >= 0) {
        const nextItems = [...current];
        nextItems[index] = {
          ...nextItems[index],
          ...message,
        };

        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: {
              items: nextItems,
              nextCursor: state.messagesByConversation[conversationId]?.nextCursor ?? null,
            },
          },
        };
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: [...current, message],
            nextCursor: state.messagesByConversation[conversationId]?.nextCursor ?? null,
          },
        },
      };
    });
  },

  setTyping: (conversationId, isTyping) => {
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: isTyping,
      },
    }));
  },
}));
