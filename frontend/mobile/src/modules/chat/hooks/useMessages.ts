import { useCallback, useEffect, useRef, useState } from "react";
import { getMessages, markConversationRead, readMessage, sendMessage } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { useSocketStore } from "@/modules/chat/store/socketStore";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY MESSAGES HOOK - STOMP FIRST, REST FALLBACK
//
// Following API spec: CHAT_1_1_FRONTEND_API.md
// Send priority: STOMP /app/chat.send, fallback to REST
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
  const lastSyncedReadMessageIdRef = useRef<string | null>(null);
  const readSyncInFlightRef = useRef(false);

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

  const syncReadOnce = useCallback(async (messageId: string | null | undefined) => {
    if (!messageId) {
      return;
    }
    if (readSyncInFlightRef.current) {
      return;
    }
    if (lastSyncedReadMessageIdRef.current === messageId) {
      return;
    }

    readSyncInFlightRef.current = true;
    try {
      await readMessage(conversationId, messageId).catch(() => { });
      markReadLocal(conversationId);
      await markConversationRead(conversationId, messageId).catch(() => { });
      lastSyncedReadMessageIdRef.current = messageId;
    } finally {
      readSyncInFlightRef.current = false;
    }
  }, [conversationId, markReadLocal]);

  const loadInitial = useCallback(async () => {
    log("loadInitial", `Loading messages for: ${conversationId.slice(0, 8)}`);
    setLoading(true);
    try {
      const response = await getMessages(conversationId, { limit: 40 });
      log("loadInitial", `Loaded ${response.data.items.length} messages`);
      setMessages(conversationId, response.data.items, response.data.nextCursor);

      // Mark latest message as read
      const latest = response.data.items[0];
      if (latest?.id) {
        log("loadInitial", `Marking message as read: ${latest.id.slice(0, 8)}`);
        await syncReadOnce(latest.id);
      }
    } catch (error) {
      log("loadInitial", "Error:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, setMessages, syncReadOnce]);

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

      // Generate idempotency key for dedup on server + optimistic UI
      const clientMessageId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const myId = useAuthStore.getState().me?.id ?? "";
      const optimisticId = `optimistic:${clientMessageId}`;

      // Optimistic append: show message immediately before REST call completes
      const optimisticMsg = {
        id: optimisticId,
        conversationId,
        senderId: myId,
        type: "TEXT" as const,
        content: trimmed,
        createdAt: new Date().toISOString(),
        seenBy: [],
      };
      appendMessageRealtime(conversationId, optimisticMsg);
      upsertConversation({
        id: conversationId,
        lastMessage: trimmed,
        lastMessageAt: optimisticMsg.createdAt,
        unreadCount: 0,
      });
      markReadLocal(conversationId);

      log("sendText", `Sending: "${trimmed.slice(0, 30)}..." [${clientMessageId}]`);

      try {
        // ═══════════════════════════════════════════════════════════════════════
        // STOMP FIRST, REST FALLBACK - Per API Spec
        // Priority: STOMP /app/chat.send, fallback to REST
        // ═══════════════════════════════════════════════════════════════════════
        let sendSucceeded = false;
        let serverMessage = null;

        // Try STOMP first if connected
        const { connected, publishSend } = useSocketStore.getState();
        if (connected) {
          try {
            await publishSend(conversationId, trimmed, "TEXT", null, null, clientMessageId);
            sendSucceeded = true;
            log("sendText", `Sent via STOMP [${clientMessageId}]`);
            // Server message will arrive via MESSAGE_SENT event
          } catch (stompError) {
            log("sendText", "STOMP send failed, fallback to REST:", stompError);
          }
        }

        // Fallback to REST if STOMP not available or failed
        if (!sendSucceeded) {
          const response = await sendMessage(conversationId, trimmed, { type: "TEXT", clientMessageId });
          serverMessage = response.data;
          log("sendText", `Sent via REST, id: ${serverMessage.id.slice(0, 8)}`);
        }

        // Replace optimistic message with server message (if REST was used)
        if (serverMessage) {
          const { replaceMessage } = useChatStore.getState();
          if (replaceMessage) {
            replaceMessage(conversationId, optimisticId, serverMessage);
          } else {
            // Fallback if replaceMessage not implemented: just append (dedup handles it)
            appendMessageRealtime(conversationId, serverMessage);
          }

          upsertConversation({
            id: conversationId,
            lastMessage: serverMessage.content,
            lastMessageAt: serverMessage.createdAt,
            unreadCount: 0,
          });
        }

        // Note: When using STOMP, MESSAGE_SENT event will replace optimistic message
        // When using REST, we replace it immediately above

      } catch (error) {
        log("sendText", "Error, removing optimistic message:", error);
        // Remove optimistic message on failure so the user sees it failed
        const { removeMessage } = useChatStore.getState();
        if (removeMessage) {
          removeMessage(conversationId, optimisticId);
        }
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
