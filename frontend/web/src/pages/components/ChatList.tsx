import { memo, useMemo, useState } from "react";
import { Pin, Search, UserPlus, UsersRound } from "lucide-react";

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
    isPinned?: boolean;
    presenceLabel?: string;
    peerId?: string;
}

export interface ChatListProps {
    chats: ChatListItem[];
    selectedChatId: string | null;
    searchText: string;
    onSearchTextChange: (value: string) => void;
    onSelectChat: (chatId: string) => void;
    onAddFriend: () => void;
    onCreateGroup: () => void;
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
            className={`absolute bottom-0 right-0 ${sizeClass} rounded-full border-2 border-[#131b28] ${colorClass}`}
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
            className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-slate-700/60 ${isActive ? "bg-sky-700/35 ring-1 ring-sky-500/40" : ""
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
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-200">
                        {chat.avatar}
                    </div>
                )}
                <PresenceBadge online={chat.isOnline} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                {/* Name and timestamp row */}
                <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-1.5">
                        {chat.isPinned && <Pin size={12} className="shrink-0 text-amber-300" />}
                        <p className={`truncate font-semibold ${hasUnread ? "text-slate-100" : "text-slate-200"}`}>
                            {chat.name}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{chat.timestamp}</span>
                </div>

                {/* Presence label (only show when offline with lastSeen) */}
                {chat.presenceLabel && !chat.isOnline && (
                    <p className="mb-1 text-[11px] text-slate-400">
                        {chat.presenceLabel}
                    </p>
                )}

                {/* Last message and unread badge row */}
                <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${hasUnread ? "font-semibold text-slate-100" : "text-slate-400"}`}>
                        {chat.lastMessage}
                    </p>
                    {hasUnread && (
                        <span className="shrink-0 rounded-full bg-sky-500 px-2 text-xs font-medium text-white">
                            {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
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
    onAddFriend,
    onCreateGroup,
}: ChatListProps) {
    const [viewMode, setViewMode] = useState<"all" | "unread">("all");

    const displayChats = useMemo(() => {
        const base = chats.length > 0 ? chats : [];
        if (viewMode === "unread") {
            return base.filter((chat) => chat.unreadCount > 0);
        }
        return base;
    }, [chats, viewMode]);

    return (
        <aside className="flex h-screen w-80 shrink-0 flex-col border-r border-slate-800 bg-[#131b28]">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <h2 className="text-2xl font-bold text-slate-100">Chats</h2>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onAddFriend}
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition-all duration-200 hover:bg-slate-700 hover:text-white"
                        title="Add friend"
                        aria-label="Add friend"
                    >
                        <UserPlus size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onCreateGroup}
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition-all duration-200 hover:bg-slate-700 hover:text-white"
                        title="Create group"
                        aria-label="Create group"
                    >
                        <UsersRound size={18} />
                    </button>
                </div>
            </div>

            <div className="sticky top-0 z-10 bg-[#131b28] px-4 pb-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(event) => onSearchTextChange(event.target.value)}
                        placeholder="Search"
                        className="h-10 w-full rounded-full border border-slate-700 bg-[#0f1724] pl-9 pr-3 text-sm text-slate-100 outline-none transition-all duration-200 focus:border-sky-400"
                    />
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setViewMode("all")}
                        className={`rounded-full px-3 py-1 ${viewMode === "all" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("unread")}
                        className={`rounded-full px-3 py-1 ${viewMode === "unread" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                        Unread
                    </button>
                </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {displayChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
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
