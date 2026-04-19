import { create } from "zustand";
import type { ConversationItem } from "../api/chatApi";

type ChatState = {
    conversations: ConversationItem[];
    selectedConversationId: string | null;
    totalUnreadCount: number;
    setConversations: (items: ConversationItem[]) => void;
    upsertConversation: (patch: Partial<ConversationItem> & { id: string }) => void;
    setSelectedConversationId: (conversationId: string | null) => void;
    clearSelectedConversation: () => void;  // NEW: Clear selection for Welcome Screen
    markConversationRead: (conversationId: string) => void;
    syncTotalUnread: (value: number) => void;
};

function sortByLatest(conversations: ConversationItem[]) {
    return [...conversations].sort((a, b) => {
        const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        return bTime - aTime;
    });
}

function sumUnread(conversations: ConversationItem[]) {
    return conversations.reduce((sum, item) => sum + Math.max(0, item.unreadCount ?? 0), 0);
}

function toMillis(value: string | null | undefined) {
    if (!value) {
        return 0;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export const useChatStore = create<ChatState>((set) => ({
    conversations: [],
    selectedConversationId: null,
    totalUnreadCount: 0,
    setConversations: (items) => {
        set((state) => {
            const existingById = new Map(
                state.conversations.map((conversation) => [conversation.id, conversation]),
            );
            const existingUnreadById = new Map(
                state.conversations.map((conversation) => [
                    conversation.id,
                    conversation.unreadCount ?? 0,
                ]),
            );

            const normalized = items.map((item) => {
                const existing = existingById.get(item.id);
                const incomingUnread = Math.max(0, item.unreadCount ?? 0);
                const existingUnread = Math.max(0, existingUnreadById.get(item.id) ?? 0);

                // ═══════════════════════════════════════════════════════════════════════
                // FIX: Allow unread to be set to 0 from server (read receipts synced)
                // Only preserve higher local counts for race conditions with new messages
                // This ensures multi-tab sync works: if Tab A read conversation,
                // Tab B's refetch should also show unread=0
                // ═══════════════════════════════════════════════════════════════════════
                const shouldPreserveUnread =
                    incomingUnread > 0 &&  // Allow 0 to always update (read from other tabs)
                    item.id !== state.selectedConversationId &&
                    incomingUnread < existingUnread;

                const incomingLastMessageAtMs = toMillis(item.lastMessageAt);
                const existingLastMessageAtMs = toMillis(existing?.lastMessageAt);
                const shouldPreserveLatestMessage =
                    existingLastMessageAtMs > incomingLastMessageAtMs;

                return {
                    ...item,
                    lastMessage: shouldPreserveLatestMessage
                        ? (existing?.lastMessage ?? item.lastMessage)
                        : item.lastMessage,
                    lastMessageAt: shouldPreserveLatestMessage
                        ? (existing?.lastMessageAt ?? item.lastMessageAt)
                        : item.lastMessageAt,
                    unreadCount: shouldPreserveUnread ? existingUnread : incomingUnread,
                };
            });

            const sorted = sortByLatest(normalized);
            // ═══════════════════════════════════════════════════════════════════════
            // FIX: Do NOT auto-select first conversation when selectedConversationId is null
            // This allows the Welcome Screen to be shown by default on:
            // - Fresh login → /messages shows Welcome
            // - Refresh /messages → shows Welcome
            // - Tab switch → shows Welcome
            // Only preserve selection if user manually selected a conversation AND it still exists
            // ═══════════════════════════════════════════════════════════════════════
            const selectedConversationExists = state.selectedConversationId
                ? sorted.some((item) => item.id === state.selectedConversationId)
                : false;
            return {
                conversations: sorted,
                selectedConversationId: selectedConversationExists ? state.selectedConversationId : null,
                totalUnreadCount: sumUnread(sorted),
            };
        });
    },
    upsertConversation: (patch) => {
        set((state) => {
            const current = state.conversations;
            const index = current.findIndex((item) => item.id === patch.id);
            if (index === -1) {
                const created: ConversationItem = {
                    id: patch.id,
                    type: patch.type ?? "private",
                    name: patch.name ?? "Unknown",
                    avatar: patch.avatar ?? null,
                    lastMessage: patch.lastMessage ?? "",
                    lastMessageAt: patch.lastMessageAt ?? new Date().toISOString(),
                    unreadCount: patch.unreadCount ?? 0,
                    lastReadAt: patch.lastReadAt ?? null,
                    lastReadMessageId: patch.lastReadMessageId ?? null,
                    participants: patch.participants ?? [],
                    admins: patch.admins ?? [],
                    ownerId: patch.ownerId ?? null,
                };
                const next = sortByLatest([...current, created]);
                return {
                    conversations: next,
                    totalUnreadCount: sumUnread(next),
                };
            }

            const updated = {
                ...current[index],
                ...patch,
                unreadCount: (() => {
                    const currentUnread = Math.max(0, current[index].unreadCount ?? 0);
                    const patchedUnread = patch.unreadCount;
                    if (patchedUnread === undefined || patchedUnread === null) {
                        return currentUnread;
                    }

                    const normalizedPatchedUnread = Math.max(0, patchedUnread);

                    // ═══════════════════════════════════════════════════════════════════════
                    // FIX: Allow unread to be set to 0 (read receipts) from any source
                    // Only preserve higher counts when receiving stale NEW_MESSAGE events
                    // This ensures multi-tab sync works correctly:
                    // - Tab A reads conversation → unread becomes 0
                    // - Tab B receives event with unreadCount=0 → must update to 0, not keep old count
                    // ═══════════════════════════════════════════════════════════════════════
                    const shouldPreserveUnread =
                        normalizedPatchedUnread > 0 &&  // Allow 0 to always update (read receipts)
                        patch.id !== state.selectedConversationId &&
                        normalizedPatchedUnread < currentUnread;

                    return shouldPreserveUnread ? currentUnread : normalizedPatchedUnread;
                })(),
            };
            const next = [...current];
            next[index] = updated;
            const sorted = sortByLatest(next);
            return {
                conversations: sorted,
                totalUnreadCount: sumUnread(sorted),
            };
        });
    },
    setSelectedConversationId: (conversationId) => {
        set({ selectedConversationId: conversationId });
    },
    clearSelectedConversation: () => {
        set({ selectedConversationId: null });
    },
    markConversationRead: (conversationId) => {
        set((state) => {
            const next = state.conversations.map((item) =>
                item.id === conversationId ? { ...item, unreadCount: 0 } : item,
            );
            return {
                conversations: next,
                totalUnreadCount: sumUnread(next),
            };
        });
    },
    syncTotalUnread: (value) => {
        set({ totalUnreadCount: Math.max(0, value) });
    },
}));
