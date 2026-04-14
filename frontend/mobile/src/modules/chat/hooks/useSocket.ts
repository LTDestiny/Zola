import { useEffect, useMemo, useRef, useState } from "react";
import { ChatSocketClient, type ChatRealtimeEvent } from "@/modules/chat/socket/ChatSocketClient";
import { getConversations, getMessages, markConversationRead } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { useSocketStore } from "@/modules/chat/store/socketStore";

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const setConnectedGlobal = useSocketStore((s) => s.setConnected);
  const setPublishTyping = useSocketStore((s) => s.setPublishTyping);

  const accessToken = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.me?.id);
  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const addUnreadForConversation = useChatStore((s) => s.addUnreadForConversation);
  const setTyping = useChatStore((s) => s.setTyping);
  const appendMessageRealtime = useChatStore((s) => s.appendMessageRealtime);
  const markReadLocal = useChatStore((s) => s.markReadLocal);
  const setMessages = useChatStore((s) => s.setMessages);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  const clientRef = useRef<ChatSocketClient | null>(null);
  const refreshConversationsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeConversationId = (value: string | null | undefined) =>
    String(value ?? "").trim().toLowerCase();

  const scheduleConversationsRefresh = () => {
    if (refreshConversationsTimeoutRef.current) {
      clearTimeout(refreshConversationsTimeoutRef.current);
    }

    refreshConversationsTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await getConversations();
        setConversations(response.data);
      } catch {
        // Keep local realtime state when refresh fails transiently.
      }
    }, 350);
  };

  const normalizeRealtimeMessage = (
    conversationId: string,
    message: ChatRealtimeEvent["message"],
  ) => {
    if (!message) {
      return null;
    }

    const candidate = message as Record<string, unknown>;
    const id =
      (candidate.id as string | undefined) ??
      (candidate.messageId as string | undefined) ??
      "";

    if (!id) {
      return null;
    }

    return {
      ...(message as object),
      id,
      conversationId:
        ((candidate.conversationId as string | undefined) ?? conversationId),
      content: (candidate.content as string | undefined) ?? "",
      senderId: (candidate.senderId as string | undefined) ?? "",
      createdAt:
        (candidate.createdAt as string | undefined) ?? new Date().toISOString(),
    } as Parameters<typeof appendMessageRealtime>[1];
  };

  const onEvent = useMemo(
    () => async (event: ChatRealtimeEvent) => {
      const fallbackConversationId =
        (event.message as { conversationId?: string } | null | undefined)?.conversationId;
      const rawConversationId = event.conversationId ?? fallbackConversationId ?? "";
      const normalizedConversationId = normalizeConversationId(rawConversationId);
      if (!normalizedConversationId) {
        return;
      }

      const currentActiveConversationId = useChatStore.getState().activeConversationId;
      const matchedConversation = useChatStore
        .getState()
        .conversations.find(
          (item) => normalizeConversationId(item.id) === normalizedConversationId,
        );
      const conversationId =
        normalizeConversationId(currentActiveConversationId) === normalizedConversationId
          ? (currentActiveConversationId as string)
          : (matchedConversation?.id ?? rawConversationId);

      const isActiveConversation =
        normalizeConversationId(currentActiveConversationId) === normalizedConversationId;
      const message = normalizeRealtimeMessage(conversationId, event.message);
      const eventType = String(event.eventType ?? "").toUpperCase();

      if (eventType === "TYPING" || event.eventType === "message:typing") {
        setTyping(conversationId, Boolean(event.typing));
        return;
      }

      if ((eventType === "NEW_MESSAGE" || eventType === "MESSAGE_SENT" || event.eventType === "message:new") && message) {
        appendMessageRealtime(conversationId, message);
        upsertConversation({
          id: conversationId,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
        });

        const incomingFromOtherUser = Boolean(message.senderId) && message.senderId !== meId;

        if (!isActiveConversation) {
          if (incomingFromOtherUser) {
            if (typeof event.unreadCount === "number") {
              const currentUnread =
                useChatStore
                  .getState()
                  .conversations.find((item) => item.id === conversationId)
                  ?.unreadCount ?? 0;
              upsertConversation({
                id: conversationId,
                unreadCount: Math.max(currentUnread + 1, Math.max(0, event.unreadCount)),
              });
            } else {
              addUnreadForConversation(conversationId);
            }
          }
          scheduleConversationsRefresh();
          return;
        }

        if (incomingFromOtherUser) {
          markReadLocal(conversationId);
          clientRef.current?.publishRead(conversationId, message.id);
          await markConversationRead(conversationId, message.id).catch(() => undefined);
        }
        scheduleConversationsRefresh();
      }

      if (
        (eventType === "READ_RECEIPT" ||
          eventType === "MESSAGE_UPDATED" ||
          eventType === "MESSAGE_RECALLED" ||
          eventType === "MESSAGE_DELETED_FOR_ME") &&
        message
      ) {
        appendMessageRealtime(conversationId, message);
        if (eventType === "MESSAGE_RECALLED" || eventType === "MESSAGE_UPDATED") {
          upsertConversation({
            id: conversationId,
            lastMessage: message.content,
            lastMessageAt: message.createdAt,
          });
          scheduleConversationsRefresh();
        }
      }

      if (
        event.eventType === "conversation:update" ||
        eventType === "CONVERSATION_UPDATED" ||
        eventType === "UNREAD_COUNT_UPDATED" ||
        eventType === "TOTAL_UNREAD_UPDATED"
      ) {
        const hasUnreadCount = typeof event.unreadCount === "number";
        upsertConversation({
          id: conversationId,
          ...(hasUnreadCount ? { unreadCount: Math.max(0, event.unreadCount as number) } : {}),
          lastMessage: event.lastMessage ?? "",
          lastMessageAt: event.lastMessageAt ?? null,
        });

        if (isActiveConversation) {
          markReadLocal(conversationId);
          void getMessages(conversationId, { limit: 40 })
            .then((response) => {
              setMessages(conversationId, response.data.items, response.data.nextCursor);
            })
            .catch(() => undefined);
        }

        scheduleConversationsRefresh();
      }

      if (
        (event.eventType === "message:seen" || eventType === "READ_RECEIPT") &&
        isActiveConversation
      ) {
        markReadLocal(conversationId);
        void getMessages(conversationId, { limit: 40 })
          .then((response) => {
            setMessages(conversationId, response.data.items, response.data.nextCursor);
          })
          .catch(() => undefined);
      }
    },
    [
      addUnreadForConversation,
      appendMessageRealtime,
      markReadLocal,
      meId,
      setMessages,
      setTyping,
      upsertConversation,
    ],
  );

  useEffect(() => {
    if (!accessToken) return;

    const client = new ChatSocketClient(accessToken, {
      onConnect: () => {
        setConnected(true);
        setConnectedGlobal(true);
        client.subscribeUserQueue();
        const latestConversationIds = new Set(
          useChatStore
          .getState()
          .conversations.map((item) => item.id),
        );
        const latestActiveConversationId = useChatStore.getState().activeConversationId;
        if (latestActiveConversationId) {
          latestConversationIds.add(latestActiveConversationId);
        }
        client.syncConversationSubscriptions([...latestConversationIds]);
      },
      onDisconnect: () => {
        setConnected(false);
        setConnectedGlobal(false);
      },
      onError: () => {
        setConnected(false);
        setConnectedGlobal(false);
      },
      onEvent,
    });

    clientRef.current = client;
    setPublishTyping((conversationId, typing) => {
      client.publishTyping(conversationId, typing);
    });
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
      setPublishTyping(() => undefined);
      if (refreshConversationsTimeoutRef.current) {
        clearTimeout(refreshConversationsTimeoutRef.current);
        refreshConversationsTimeoutRef.current = null;
      }
    };
  }, [accessToken, onEvent, setConnectedGlobal, setPublishTyping]);

  useEffect(() => {
    const ids = new Set(conversations.map((item) => item.id));
    if (activeConversationId) {
      ids.add(activeConversationId);
    }
    clientRef.current?.syncConversationSubscriptions([...ids]);
  }, [activeConversationId, conversations]);

  return {
    connected,
    publishTyping: (conversationId: string, typing: boolean) =>
      clientRef.current?.publishTyping(conversationId, typing) ?? false,
  };
}
