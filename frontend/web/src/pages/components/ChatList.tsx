import { memo } from "react";
import { Edit3, Search } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT LIST COMPONENT - With presence indicators
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatListItem {
    id: string;
    name: string;
    avatar: string;
    avatarUrl?: string | null;
    timestamp: string;
    lastMessage: string;
    unreadCount: number;
    isOnline: boolean;
    presenceLabel?: string;
    peerId?: string;
}

export interface ChatListProps {
    chats: ChatListItem[];
    selectedChatId: string | null;
    searchText: string;
    onSearchTextChange: (value: string) => void;
    onSelectChat: (chatId: string) => void;
    onCreateChat: () => void;
    isLoading?: boolean;
    hasError?: boolean;
    onRetry?: () => void;
}

// ─── PRESENCE BADGE ─────────────────────────────────────────────────────────────

interface PresenceBadgeProps {
    online: boolean;
    size?: 'sm' | 'md';
}

const PresenceBadge = memo(function PresenceBadge({ online, size = 'md' }: PresenceBadgeProps) {
    const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
    const colorClass = online ? 'bg-green-500' : 'bg-gray-400';

    return (
        <span
            className={`absolute bottom-0 right-0 ${sizeClass} rounded-full border-2 border-white ${colorClass}`}
            role="status"
            aria-label={online ? 'Online' : 'Offline'}
        />
    );
});

// ─── CHAT LIST ITEM ─────────────────────────────────────────────────────────────

interface ChatItemProps {
    chat: ChatListItem;
    isActive: boolean;
    onSelect: () => void;
}

const ChatItem = memo(function ChatItem({ chat, isActive, onSelect }: ChatItemProps) {
    const hasUnread = chat.unreadCount > 0;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-gray-100 ${isActive ? "bg-gray-100" : ""
                }`}
        >
            {/* Avatar with presence badge */}
            <div className="relative h-12 w-12 shrink-0">
                {chat.avatarUrl ? (
                    <img
                        src={chat.avatarUrl}
                        alt={chat.name}
                        className="h-12 w-12 rounded-full object-cover"
                    />
                ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {chat.avatar}
                    </div>
                )}
                <PresenceBadge online={chat.isOnline} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                {/* Name and timestamp row */}
                <div className="mb-1 flex items-center justify-between gap-2">
                    <p className={`truncate font-semibold ${hasUnread ? "text-slate-900" : "text-slate-700"}`}>
                        {chat.name}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">{chat.timestamp}</span>
                </div>

                {/* Presence label (only show when offline with lastSeen) */}
                {chat.presenceLabel && !chat.isOnline && (
                    <p className="mb-1 text-[11px] text-slate-400">
                        {chat.presenceLabel}
                    </p>
                )}

                {/* Last message and unread badge row */}
                <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${hasUnread ? "font-semibold text-slate-800" : "text-gray-500"}`}>
                        {chat.lastMessage}
                    </p>
                    {hasUnread && (
                        <span className="shrink-0 rounded-full bg-red-500 px-2 text-xs font-medium text-white">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
});

// ─── MAIN CHAT LIST ─────────────────────────────────────────────────────────────

export function ChatList({
    chats,
    selectedChatId,
    searchText,
    onSearchTextChange,
    onSelectChat,
    onCreateChat,
    isLoading = false,
    hasError = false,
    onRetry,
}: ChatListProps) {
    const displayChats = chats.length > 0 ? chats : [];

    return (
        <aside className="flex h-full w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-80">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <h2 className="text-2xl font-bold text-slate-900">Chats</h2>
                <button
                    type="button"
                    onClick={onCreateChat}
                    className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-all duration-200 hover:bg-gray-100 hover:text-slate-800"
                    title="Create new chat"
                >
                    <Edit3 size={18} />
                </button>
            </div>

            <div className="sticky top-0 z-10 bg-white px-4 pb-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(event) => onSearchTextChange(event.target.value)}
                        placeholder="Search"
                        className="h-10 w-full rounded-full bg-gray-100 pl-9 pr-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-200"
                    />
                </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 pb-16 md:pb-3">
                {isLoading ? (
                    <div className="space-y-2 px-1 pt-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                                <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-slate-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-200" />
                                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : hasError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <p className="text-sm text-slate-500">Could not load conversations</p>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                ) : displayChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <p className="text-sm">No conversations yet</p>
                    </div>
                ) : (
                    displayChats.map((chat) => (
                        <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={selectedChatId === chat.id}
                            onSelect={() => onSelectChat(chat.id)}
                        />
                    ))
                )}
            </div>
        </aside>
    );
}
