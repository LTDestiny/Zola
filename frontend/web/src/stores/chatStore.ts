import { create } from "zustand";
import type { ConversationItem } from "../api/chatApi";

type ChatState = {
    conversations: ConversationItem[];
    selectedConversationId: string | null;
    totalUnreadCount: number;
    setConversations: (items: ConversationItem[]) => void;
    upsertConversation: (patch: Partial<ConversationItem> & { id: string }) => void;
    setSelectedConversationId: (conversationId: string | null) => void;
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
                const shouldPreserveUnread =
                    item.id !== state.selectedConversationId && incomingUnread < existingUnread;

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
            const selectedConversationExists = sorted.some((item) => item.id === state.selectedConversationId);
            return {
                conversations: sorted,
                selectedConversationId: selectedConversationExists ? state.selectedConversationId : sorted[0]?.id ?? null,
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
                    name: patch.name ?? "Unknown",
                    lastMessage: patch.lastMessage ?? "",
                    lastMessageAt: patch.lastMessageAt ?? new Date().toISOString(),
                    unreadCount: patch.unreadCount ?? 0,
                    lastReadAt: patch.lastReadAt ?? null,
                    lastReadMessageId: patch.lastReadMessageId ?? null,
                    participants: patch.participants ?? [],
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
                    const shouldPreserveUnread =
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
