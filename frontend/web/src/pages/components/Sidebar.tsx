import { ChatList, ChatListItem } from "./ChatList";
import { MiniNav, MiniNavTab } from "./MiniNav";

export interface SidebarProps {
  active: MiniNavTab;
  messageBadge?: number;
  contactsBadge?: number;
  chats: ChatListItem[];
  selectedChatId: string | null;
  searchText: string;
  onTabChange: (tab: MiniNavTab) => void;
  onSearchTextChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
}

export function Sidebar({
  active,
  messageBadge,
  contactsBadge,
  chats,
  selectedChatId,
  searchText,
  onTabChange,
  onSearchTextChange,
  onSelectChat,
  onCreateChat,
}: SidebarProps) {
  return (
    <div className="flex shrink-0">
      <MiniNav
        active={active}
        onChange={onTabChange}
        messageBadge={messageBadge}
        contactsBadge={contactsBadge}
      />
      <ChatList
        chats={chats}
        selectedChatId={selectedChatId}
        searchText={searchText}
        onSearchTextChange={onSearchTextChange}
        onSelectChat={onSelectChat}
        onCreateChat={onCreateChat}
      />
    </div>
  );
}
