import { useMemo } from "react";
import { useChatStore } from "@/modules/chat/store/chatStore";

export function useUnread() {
  const conversations = useChatStore((s) => s.conversations);
  const totalUnreadCount = useChatStore((s) => s.totalUnreadCount);

  return useMemo(
    () => ({
      totalUnreadCount,
      byConversation: Object.fromEntries(conversations.map((item) => [item.id, item.unreadCount ?? 0])),
    }),
    [conversations, totalUnreadCount],
  );
}
