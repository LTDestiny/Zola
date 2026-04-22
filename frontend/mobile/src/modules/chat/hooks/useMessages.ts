import { useCallback, useEffect, useRef, useState } from "react";
import { getMessages, markConversationRead, readMessage, sendMessage } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY MESSAGES HOOK - FIXES INTERMITTENT REALTIME BUGS
//
// KEY FIXES:
// 1. Uses atomic selector for messages (re-renders on store change)
// 2. Proper debug logging
// 3. Returns store data directly (no local state duplication)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[useMessages][${tag}]`, ...args);
  }
}

export function useMessages(conversationId: string) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // CRITICAL: Use atomic selector with conversationId
  // This creates a subscription that triggers re-render when messages change
  const data = useChatStore(
    useCallback((s) => s.messagesByConversation[conversationId], [conversationId]),
  );

  // Track previous count for logging
  const prevCountRef = useRef(data?.items?.length ?? 0);
  useEffect(() => {
    const count = data?.items?.length ?? 0;
    if (count !== prevCountRef.current) {
      log("change", `${conversationId.slice(0, 8)}: ${prevCountRef.current} → ${count} messages`);
      prevCountRef.current = count;
    }
  }, [data?.items?.length, conversationId]);

  // Get store methods (these are stable references)
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const appendMessageRealtime = useChatStore((s) => s.appendMessageRealtime);
  const markReadLocal = useChatStore((s) => s.markReadLocal);
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  const loadInitial = useCallback(async () => {
    log("loadInitial", `Loading messages for: ${conversationId.slice(0, 8)}`);
    setLoading(true);
    try {
      const response = await getMessages(conversationId, { limit: 40 });
      log("loadInitial", `Loaded ${response.data.items.length} messages`);
      setMessages(conversationId, response.data.items, response.data.nextCursor);

      // Mark latest message as read
      const latest = response.data.items.at(-1);
      if (latest?.id) {
        log("loadInitial", `Marking message as read: ${latest.id.slice(0, 8)}`);
        await readMessage(conversationId, latest.id).catch(() => { });
        markReadLocal(conversationId);
        await markConversationRead(conversationId, latest.id).catch(() => { });
      }
    } catch (error) {
      log("loadInitial", "Error:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, markReadLocal, setMessages]);

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || loadingMore) {
      log("loadMore", "Skipping - no cursor or already loading");
      return;
    }
    log("loadMore", `Loading more, cursor: ${data.nextCursor.slice(0, 20)}`);
    setLoadingMore(true);
    try {
      const response = await getMessages(conversationId, {
        cursor: data.nextCursor,
        limit: 30,
      });
      log("loadMore", `Loaded ${response.data.items.length} older messages`);
      prependMessages(conversationId, response.data.items, response.data.nextCursor);
    } catch (error) {
      log("loadMore", "Error:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, data?.nextCursor, loadingMore, prependMessages]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      log("sendText", `Sending: "${trimmed.slice(0, 30)}..."`);
      try {
        const response = await sendMessage(conversationId, trimmed, { type: "TEXT" });
        log("sendText", `Sent, id: ${response.data.id.slice(0, 8)}`);

        // Append to store immediately
        appendMessageRealtime(conversationId, response.data);

        // Update conversation metadata
        upsertConversation({
          id: conversationId,
          lastMessage: response.data.content,
          lastMessageSenderId: response.data.senderId,
          lastMessageType: response.data.type,
          lastMessageAt: response.data.createdAt,
          unreadCount: 0,
        });

        markReadLocal(conversationId);
      } catch (error) {
        log("sendText", "Error:", error);
        throw error;
      }
    },
    [appendMessageRealtime, conversationId, markReadLocal, upsertConversation],
  );

  // CRITICAL: Return data directly from store
  // When store updates, this component re-renders with new data
  return {
    loading,
    loadingMore,
    messages: data?.items ?? [],
    hasMore: Boolean(data?.nextCursor),
    loadInitial,
    loadMore,
    sendText,
  };
}
