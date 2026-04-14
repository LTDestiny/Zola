import { useCallback, useMemo, useState } from "react";
import { getMessages, markConversationRead, readMessage, sendMessage } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";

export function useMessages(conversationId: string) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const data = useChatStore((s) => s.messagesByConversation[conversationId]);
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const appendMessageRealtime = useChatStore((s) => s.appendMessageRealtime);
  const markReadLocal = useChatStore((s) => s.markReadLocal);
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getMessages(conversationId, { limit: 40 });
      setMessages(conversationId, response.data.items, response.data.nextCursor);

      const latest = response.data.items.at(-1);
      if (latest?.id) {
        await readMessage(conversationId, latest.id).catch(() => undefined);
        markReadLocal(conversationId);
        await markConversationRead(conversationId, latest.id).catch(() => undefined);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, markReadLocal, setMessages]);

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await getMessages(conversationId, {
        cursor: data.nextCursor,
        limit: 30,
      });
      prependMessages(conversationId, response.data.items, response.data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, data?.nextCursor, loadingMore, prependMessages]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const response = await sendMessage(conversationId, trimmed, { type: "TEXT" });
      appendMessageRealtime(conversationId, response.data);
      upsertConversation({
        id: conversationId,
        lastMessage: response.data.content,
        lastMessageAt: response.data.createdAt,
        unreadCount: 0,
      });
      markReadLocal(conversationId);
    },
    [appendMessageRealtime, conversationId, markReadLocal, upsertConversation],
  );

  return {
    loading,
    loadingMore,
    messages: useMemo(() => data?.items ?? [], [data?.items]),
    hasMore: Boolean(data?.nextCursor),
    loadInitial,
    loadMore,
    sendText,
  };
}
