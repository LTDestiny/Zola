import { type ConversationItem } from "../../api/chatApi";
import { MessageSquarePlus, RefreshCcw, Search } from "lucide-react";

type ConversationListProps = {
  language: "vi" | "en";
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onOpenAddFriend: () => void;
  onRefresh: () => Promise<void>;
  isLoadingConversations: boolean;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
};

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(value: string | null, language: "vi" | "en") {
  if (!value) return language === "vi" ? "Không rõ" : "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "vi" ? "Không rõ" : "N/A";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function ConversationList({
  language,
  searchText,
  onSearchTextChange,
  onOpenAddFriend,
  onRefresh,
  isLoadingConversations,
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  return (
    <section className="w-full shrink-0 border-r border-slate-200 bg-[#f5f2ff] lg:w-87.5 lg:flex lg:flex-col">
      <div className="p-4 lg:p-6">
        <button
          type="button"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-indigo-600 to-indigo-500 font-semibold text-white shadow-lg shadow-indigo-300/40 lg:h-14"
          onClick={onOpenAddFriend}
        >
          <MessageSquarePlus size={16} />
          <span>{language === "vi" ? "Thêm bạn" : "New Message"}</span>
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative w-full">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-indigo-300"
            placeholder={language === "vi" ? "Tìm kiếm hội thoại..." : "Search conversations..."}
            type="text"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </div>
      </div>

      <div className="max-h-[42vh] space-y-2 overflow-y-auto px-3 pb-4 lg:max-h-none lg:flex-1 lg:pb-6">
        {isLoadingConversations && (
          <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
            {language === "vi" ? "Đang tải hội thoại..." : "Loading conversations..."}
          </div>
        )}

        {!isLoadingConversations && conversations.length === 0 && (
          <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
            {language === "vi" ? "Chưa có hội thoại. Bấm New Message để tạo chat 1-1." : "No conversations. Click New Message to create direct chat."}
          </div>
        )}

        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          return (
            <article
              key={conversation.id}
              className={`relative flex cursor-pointer items-start gap-4 rounded-xl p-3 transition-all ${
                isActive ? "bg-white" : "hover:bg-white/70"
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {isActive && <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-indigo-600" />}
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">
                {initials(conversation.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-sm font-bold">{conversation.name}</h3>
                  <span className={`text-[10px] ${isActive ? "font-bold text-indigo-600" : "text-slate-500"}`}>
                    {formatTime(conversation.lastMessageAt, language)}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-600">{conversation.lastMessage || "..."}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden border-t border-slate-200 p-3 lg:block">
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          onClick={() => void onRefresh()}
        >
          <RefreshCcw size={14} />
          {language === "vi" ? "Làm mới" : "Refresh"}
        </button>
      </div>
    </section>
  );
}
