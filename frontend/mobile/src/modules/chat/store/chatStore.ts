import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ConversationItem, MessageItem } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY CHAT STORE - FIXES INTERMITTENT REALTIME BUGS
//
// KEY FIXES:
// 1. All mutations create NEW object/array references (required for React)
// 2. Proper duplicate detection for messages
// 3. Conversation sorting always happens after updates
// 4. Debug logging for all state changes
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[chatStore][${tag}]`, ...args);
  }
}

type MessageState = {
  items: MessageItem[];
  nextCursor: string | null;
};

// ─── TYPING AUTO-CLEAR TIMERS ────────────────────────────────────────────────
// Auto-clear stale typing indicators after 3 seconds (CRITICAL for Test 4)
const TYPING_AUTO_CLEAR_MS = 3000;
const typingClearTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

// ─── HELPER: Sort conversations by lastMessageAt (pinned first) ──────────────
function sortConversations(items: ConversationItem[]): ConversationItem[] {
  return [...items].sort((a, b) => {
    // Pinned conversations first
    const pinnedDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinnedDiff !== 0) return pinnedDiff;

    const pinnedAtDiff = toMillis(b.pinnedAt) - toMillis(a.pinnedAt);
    if (pinnedAtDiff !== 0) return pinnedAtDiff;

    // Then by lastMessageAt descending
    const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return bTime - aTime;
  });
}

// ─── HELPER: Calculate total unread count ────────────────────────────────────
function calcTotalUnread(items: ConversationItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.unreadCount ?? 0), 0);
}

// ─── HELPER: Parse timestamp to milliseconds ─────────────────────────────────
function toMillis(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

// ─── HELPER: Merge messages with deduplication ───────────────────────────────
// CRITICAL: Always returns NEW array reference
function mergeMessages(existing: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const map = new Map<string, MessageItem>();

  // Add existing first
  for (const item of existing) {
    if (item.id) {
      map.set(item.id, { ...item }); // Clone to ensure new reference
    }
  }

  // Merge/update with incoming
  for (const item of incoming) {
    if (!item.id) continue;
    const prev = map.get(item.id);
    // CRITICAL: Create NEW object reference
    map.set(item.id, prev ? { ...prev, ...item } : { ...item });
  }

  // Sort by createdAt ascending (oldest first)
  return [...map.values()].sort(
    (a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)
  );
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
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
          return { ...item }; // New reference
        }

        // For active conversation, use server unreadCount (should be 0)
        if (item.id === activeConversationId) {
          return {
            ...local,
            ...item,
            unreadCount: Math.max(0, item.unreadCount ?? 0),
          };
        }

        // For other conversations, preserve higher unread count
        return {
          ...local,
          ...item,
          unreadCount: Math.max(item.unreadCount ?? 0, local.unreadCount ?? 0),
        };
      });

      const sorted = sortConversations(merged);
      log("setConversations", "Count:", sorted.length, "TotalUnread:", calcTotalUnread(sorted));

      set({
        conversations: sorted,
        totalUnreadCount: calcTotalUnread(sorted),
      });
    },

    setActiveConversation: (conversationId) => {
      log("setActiveConversation", conversationId);
      set({ activeConversationId: conversationId });
    },

    upsertConversation: (patch) => {
      const list = get().conversations;
      const index = list.findIndex((item) => item.id === patch.id);

      log("upsertConversation", {
        id: patch.id,
        exists: index !== -1,
        lastMessage: patch.lastMessage?.slice(0, 30),
        unreadCount: patch.unreadCount,
      });

      // CRITICAL: Create new array reference
      const next = [...list];

      if (index === -1) {
        // Create new conversation
        next.unshift({
          id: patch.id,
          name: patch.name ?? "Unknown",
          lastMessage: patch.lastMessage ?? "",
          lastMessageAt: patch.lastMessageAt ?? new Date().toISOString(),
          unreadCount: patch.unreadCount ?? 0,
          isPinned: patch.isPinned ?? false,
          pinnedAt: patch.pinnedAt ?? null,
          participants: patch.participants ?? [],
        });
      } else {
        // CRITICAL: Create new object reference for updated item
        next[index] = { ...next[index], ...omitUndefined(patch) };
      }

      const sorted = sortConversations(next);
      set({
        conversations: sorted,
        totalUnreadCount: calcTotalUnread(sorted),
      });
    },

    addUnreadForConversation: (conversationId) => {
      const state = get();
      const isActive = state.activeConversationId === conversationId;

      if (isActive) {
        log("addUnread", "Skipping - conversation is active", conversationId);
        return;
      }

      const exists = state.conversations.some((item) => item.id === conversationId);

      if (!exists) {
        log("addUnread", "Creating new conversation with unread=1", conversationId);
        const created: ConversationItem = {
          id: conversationId,
          name: "Unknown",
          lastMessage: "",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 1,
          isPinned: false,
          participants: [],
        };

        const nextWithCreated = sortConversations([created, ...state.conversations]);
        set({
          conversations: nextWithCreated,
          totalUnreadCount: calcTotalUnread(nextWithCreated),
        });
        return;
      }

      // CRITICAL: Create new array and object references
      const next = state.conversations.map((item) =>
        item.id === conversationId
          ? { ...item, unreadCount: (item.unreadCount ?? 0) + 1 }
          : item,
      );

      const newTotal = calcTotalUnread(next);
      log("addUnread", conversationId, "NewTotal:", newTotal);

      set({
        conversations: sortConversations(next),
        totalUnreadCount: newTotal,
      });
    },

    markReadLocal: (conversationId) => {
      const current = get().conversations;
      const conversation = current.find((item) => item.id === conversationId);

      if (!conversation || (conversation.unreadCount ?? 0) === 0) {
        return; // No change needed
      }

      log("markReadLocal", conversationId);

      // CRITICAL: Create new array and object references
      const next = current.map((item) =>
        item.id === conversationId ? { ...item, unreadCount: 0 } : item,
      );

      set({
        conversations: next,
        totalUnreadCount: calcTotalUnread(next),
      });
    },

    setMessages: (conversationId, items, nextCursor) => {
      const current = get().messagesByConversation[conversationId]?.items ?? [];

      log("setMessages", conversationId, "Count:", items.length);

      // CRITICAL: Create new object references throughout
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: mergeMessages(current, items),
            nextCursor,
          },
        },
      }));
    },

    prependMessages: (conversationId, olderItems, nextCursor) => {
      const current = get().messagesByConversation[conversationId]?.items ?? [];

      log("prependMessages", conversationId, "Count:", olderItems.length);

      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: mergeMessages(current, olderItems),
            nextCursor,
          },
        },
      }));
    },

    appendMessageRealtime: (conversationId, message) => {
      if (!message.id) {
        log("appendMessageRealtime", "Message has no ID, skipping");
        return;
      }

      const state = get();
      const current = state.messagesByConversation[conversationId]?.items ?? [];
      const existingIndex = current.findIndex((item) => item.id === message.id);

      log("appendMessageRealtime", {
        conversationId,
        messageId: message.id,
        content: message.content?.slice(0, 30),
        isUpdate: existingIndex >= 0,
        currentCount: current.length,
      });

      if (existingIndex >= 0) {
        // Update existing message - CRITICAL: Create new array and object references
        const nextItems = current.map((item, index) =>
          index === existingIndex ? { ...item, ...message } : item,
        );

        set({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: {
              items: nextItems,
              nextCursor: state.messagesByConversation[conversationId]?.nextCursor ?? null,
            },
          },
        });
        return;
      }

      // Append new message - CRITICAL: Create new array reference
      const nextItems = [...current, { ...message }];

      set({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            items: nextItems,
            nextCursor: state.messagesByConversation[conversationId]?.nextCursor ?? null,
          },
        },
      });

      // Verify state was updated
      const newState = get();
      const newCount = newState.messagesByConversation[conversationId]?.items.length ?? 0;
      log("appendMessageRealtime", `AFTER SET: ${conversationId} now has ${newCount} messages`);
    },

    setTyping: (conversationId, isTyping) => {
      log("setTyping", `${conversationId.slice(0, 8)} → ${isTyping}`);

      // Clear any existing auto-clear timer for this conversation
      const existingTimer = typingClearTimers.get(conversationId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingClearTimers.delete(conversationId);
      }

      // If setting to true, schedule auto-clear after 3 seconds
      // This handles stale typing indicators (Test 4 fix)
      if (isTyping) {
        const timer = setTimeout(() => {
          log("setTyping", `Auto-clearing stale typing for ${conversationId.slice(0, 8)}`);
          typingClearTimers.delete(conversationId);
          set((state) => ({
            typingByConversation: {
              ...state.typingByConversation,
              [conversationId]: false,
            },
          }));
        }, TYPING_AUTO_CLEAR_MS);
        typingClearTimers.set(conversationId, timer);
      }

      set((state) => ({
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: isTyping,
        },
      }));
    },
  })),
);
