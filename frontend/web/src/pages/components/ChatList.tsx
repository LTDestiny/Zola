import { memo, useMemo, useState } from "react";
import { ChevronLeft, CircleAlert, Pin, Search, UserPlus, UsersRound } from "lucide-react";

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
    variant?: "default" | "stranger-inbox";
    tagLabel?: string;
    sortTimeMs?: number;
    pinnedAtMs?: number;
}

export interface ChatListProps {
    language: "vi" | "en";
    chats: ChatListItem[];
    selectedChatId: string | null;
    searchText: string;
    onSearchTextChange: (value: string) => void;
    onSelectChat: (chatId: string) => void;
    onAddFriend: () => void;
    onCreateGroup: () => void;
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBack?: () => void;
    showPrimaryActions?: boolean;
    className?: string;
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
    const isGroupChat = (chat.presenceLabel ?? "").toLowerCase().includes("thanh vien")
        || (chat.presenceLabel ?? "").toLowerCase().includes("members");
    const isStrangerInbox = chat.variant === "stranger-inbox";

    const itemClass = isStrangerInbox
        ? isActive
            ? "bg-[linear-gradient(135deg,rgba(249,115,22,0.26),rgba(251,191,36,0.18))] shadow-[inset_0_0_0_1px_rgba(253,186,116,0.7)]"
            : "bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(251,191,36,0.08))] hover:bg-[linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.12))] shadow-[inset_0_0_0_1px_rgba(253,186,116,0.25)]"
        : isActive
            ? "bg-[var(--color-zola-panel-strong)] shadow-[inset_0_0_0_1px_rgba(104,192,255,0.5)]"
            : "hover:bg-[var(--color-zola-panel-hover)]";

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`mb-1.5 flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 ${itemClass}`}
        >
            {/* Avatar with presence badge */}
            <div className={`relative h-12 w-12 shrink-0 rounded-full ${isStrangerInbox ? "ring-1 ring-amber-300/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.24),rgba(251,191,36,0.2))]" : "ring-1 ring-white/10"}`}>
                {isStrangerInbox ? (
                    <div className="grid h-12 w-12 place-items-center rounded-full text-amber-100">
                        <CircleAlert size={20} />
                    </div>
                ) : chat.avatarUrl ? (
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
                {!isGroupChat && !isStrangerInbox && <PresenceBadge online={chat.isOnline} />}
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
                        {chat.tagLabel && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${isStrangerInbox ? "bg-amber-200/12 text-amber-200" : "bg-sky-200/12 text-sky-200"}`}>
                                {chat.tagLabel}
                            </span>
                        )}
                    </div>
                    <span className={`shrink-0 text-xs ${isStrangerInbox ? "text-amber-100/90" : hasUnread ? "text-sky-300" : "text-slate-400"}`}>{chat.timestamp}</span>
                </div>

                {/* Presence label for groups or offline direct chats */}
                {chat.presenceLabel && (isGroupChat || !chat.isOnline) && (
                    <p className={`mb-1 text-[11px] ${isStrangerInbox ? "text-amber-100/80" : "text-slate-400/90"}`}>
                        {chat.presenceLabel}
                    </p>
                )}

                {/* Last message and unread badge row */}
                <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${isStrangerInbox ? "font-medium text-amber-50/95" : hasUnread ? "font-semibold text-slate-100" : "text-slate-400/90"}`}>
                        {chat.lastMessage}
                    </p>
                    {hasUnread && (
                        <span className={`shrink-0 rounded-full px-2 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)] ${isStrangerInbox ? "bg-amber-500" : "bg-[var(--color-zola-accent)]"}`}>
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
    language,
    chats,
    selectedChatId,
    searchText,
    onSearchTextChange,
    onSelectChat,
    onAddFriend,
    onCreateGroup,
    title,
    subtitle,
    showBackButton = false,
    onBack,
    showPrimaryActions = true,
    className,
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
        <aside className={`flex min-h-0 w-full flex-1 flex-col border-b border-[var(--color-zola-border-strong)] bg-[var(--color-zola-surface)] md:h-screen md:w-[20.5rem] md:flex-none md:border-b-0 md:border-r ${className ?? ""}`}>
            <div className="flex items-center justify-between px-4 pb-3 pt-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {showBackButton && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition-all duration-200 hover:bg-[var(--color-zola-panel-hover)] hover:text-white"
                                title={language === "vi" ? "Quay lai" : "Back"}
                                aria-label={language === "vi" ? "Quay lai" : "Back"}
                            >
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h2 className="truncate text-[1.9rem] font-bold tracking-tight text-white">
                                {title ?? (language === "vi" ? "Tin nhan" : "Chats")}
                            </h2>
                            {subtitle && (
                                <p className="mt-0.5 truncate text-xs text-slate-400">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                {showPrimaryActions && (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onAddFriend}
                            className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition-all duration-200 hover:bg-[var(--color-zola-panel-hover)] hover:text-white"
                            title={language === "vi" ? "Them ban" : "Add friend"}
                            aria-label={language === "vi" ? "Them ban" : "Add friend"}
                        >
                            <UserPlus size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={onCreateGroup}
                            className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition-all duration-200 hover:bg-[var(--color-zola-panel-hover)] hover:text-white"
                            title={language === "vi" ? "Tao nhom" : "Create group"}
                            aria-label={language === "vi" ? "Tao nhom" : "Create group"}
                        >
                            <UsersRound size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="sticky top-0 z-10 bg-[var(--color-zola-surface)] px-4 pb-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(event) => onSearchTextChange(event.target.value)}
                        placeholder={language === "vi" ? "Tim kiem" : "Search"}
                        className="h-10 w-full rounded-full border border-[var(--color-zola-border)] bg-[var(--color-zola-panel)] pl-9 pr-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-[var(--color-zola-accent-soft)]"
                    />
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setViewMode("all")}
                        className={`rounded-full px-3 py-1 ${viewMode === "all" ? "bg-[var(--color-zola-accent)] text-white" : "bg-[var(--color-zola-panel-hover)] text-slate-300 hover:bg-[var(--color-zola-panel-strong)]"}`}
                    >
                        {language === "vi" ? "Tat ca" : "All"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("unread")}
                        className={`rounded-full px-3 py-1 ${viewMode === "unread" ? "bg-[var(--color-zola-accent)] text-white" : "bg-[var(--color-zola-panel-hover)] text-slate-300 hover:bg-[var(--color-zola-panel-strong)]"}`}
                    >
                        {language === "vi" ? "Chua doc" : "Unread"}
                    </button>
                </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
                {displayChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <p className="text-sm">
                            {language === "vi" ? "Chua co hoi thoai nao" : "No conversations yet"}
                        </p>
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
