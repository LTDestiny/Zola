import { Edit3, Search } from "lucide-react";

export interface ChatListItem {
  id: string;
  name: string;
  avatar: string;
  timestamp: string;
  lastMessage: string;
  unreadCount: number;
  isOnline: boolean;
  presenceLabel?: string;
}

export interface ChatListProps {
  chats: ChatListItem[];
  selectedChatId: string | null;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
}

const mockChats: ChatListItem[] = [
  {
    id: "mock-1",
    name: "Linh Tran",
    avatar: "LT",
    timestamp: "10:24",
    lastMessage: "Can we review the launch checklist tonight?",
    unreadCount: 3,
    isOnline: true,
  },
  {
    id: "mock-2",
    name: "Minh Pham",
    avatar: "MP",
    timestamp: "09:10",
    lastMessage: "I sent the design tokens in Figma.",
    unreadCount: 0,
    isOnline: true,
  },
];

export function ChatList({
  chats,
  selectedChatId,
  searchText,
  onSearchTextChange,
  onSelectChat,
  onCreateChat,
}: ChatListProps) {
  const displayChats = chats.length > 0 ? chats : mockChats;

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
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

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {displayChats.map((chat) => {
          const isActive = selectedChatId === chat.id;
          const hasUnread = chat.unreadCount > 0;
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat.id)}
              className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-gray-100 ${
                isActive ? "bg-gray-100" : ""
              }`}
            >
              <div className="relative h-12 w-12 shrink-0">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {chat.avatar}
                </div>
                {chat.isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-slate-900">
                    {chat.name}
                  </p>
                  <span className="text-xs text-gray-400">
                    {chat.timestamp}
                  </span>
                </div>

                {chat.presenceLabel && (
                  <p
                    className={`mb-1 text-[11px] ${chat.isOnline ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    {chat.presenceLabel}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${hasUnread ? "font-semibold text-slate-800" : "text-gray-500"}`}
                  >
                    {chat.lastMessage}
                  </p>
                  {hasUnread && (
                    <span className="rounded-full bg-red-500 px-2 text-xs text-white">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
