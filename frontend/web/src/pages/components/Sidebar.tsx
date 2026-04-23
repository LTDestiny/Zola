import { ChatList, ChatListItem } from "./ChatList";
import { MiniNav, MiniNavTab } from "./MiniNav";

export interface SidebarProps {
  language: "vi" | "en";
  active: MiniNavTab;
  showChatList?: boolean;
  chatListTitle?: string;
  chatListSubtitle?: string;
  chatListShowBackButton?: boolean;
  onChatListBack?: () => void;
  chatListShowPrimaryActions?: boolean;
  messageBadge?: number;
  contactsBadge?: number;
  chats: ChatListItem[];
  selectedChatId: string | null;
  searchText: string;
  onTabChange: (tab: MiniNavTab) => void;
  onSearchTextChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onAddFriend: () => void;
  onCreateGroup: () => void;
}

export function Sidebar({
  language,
  active,
  showChatList = true,
  chatListTitle,
  chatListSubtitle,
  chatListShowBackButton,
  onChatListBack,
  chatListShowPrimaryActions,
  messageBadge,
  contactsBadge,
  chats,
  selectedChatId,
  searchText,
  onTabChange,
  onSearchTextChange,
  onSelectChat,
  onAddFriend,
  onCreateGroup,
}: SidebarProps) {
  return (
    <div className="flex shrink-0">
      <MiniNav
        active={active}
        onChange={onTabChange}
        messageBadge={messageBadge}
        contactsBadge={contactsBadge}
      />
      {showChatList && (
      <ChatList
          language={language}
          chats={chats}
          selectedChatId={selectedChatId}
          searchText={searchText}
          onSearchTextChange={onSearchTextChange}
          onSelectChat={onSelectChat}
          onAddFriend={onAddFriend}
          onCreateGroup={onCreateGroup}
          title={chatListTitle}
          subtitle={chatListSubtitle}
          showBackButton={chatListShowBackButton}
          onBack={onChatListBack}
          showPrimaryActions={chatListShowPrimaryActions}
        />
      )}
    </div>
  );
}
