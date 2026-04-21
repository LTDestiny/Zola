import { useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { socketService } from "@/modules/chat/socket/socketService";
import type { ChatRealtimeEvent } from "@/modules/chat/socket/socketTypes";
import { reconnectManager } from "@/modules/chat/socket/reconnectManager";
import { getConversations } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { usePresenceStore } from "@/modules/chat/store/presenceStore";
import { useFriendRequestStore } from "@/modules/chat/store/friendRequestStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { useSocketStore } from "@/modules/chat/store/socketStore";

const DEBUG = true;
const log = (t: string, ...a: any[]) =>
  DEBUG && console.log(`[useSocket][${t}]`, ...a);

function normalizeId(v: string | null | undefined) {
  return String(v ?? "").trim().toLowerCase();
}

const DEDUP = new Map<string, number>();
const WINDOW = 60000;

function isDuplicate(e: ChatRealtimeEvent) {
  const key =
    e?.eventType === "MESSAGE_SENT"
      ? `msg:${(e?.message as any)?.messageId || e?.message?.id}`
      : null;

  if (!key) return false;

  const now = Date.now();
  const last = DEDUP.get(key);

  for (const [k, t] of DEDUP) {
    if (now - t > WINDOW) DEDUP.delete(k);
  }

  if (last && now - last < WINDOW) return true;

  DEDUP.set(key, now);
  return false;
}

export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.me?.id);
  const connected = useSocketStore((s) => s.connected);

  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  const mounted = useRef(true);

  const getState = useCallback(() => {
    const s = useChatStore.getState();
    return {
      activeConversationId: s.activeConversationId,
      conversations: s.conversations,
      appendMessageRealtime: s.appendMessageRealtime,
      upsertConversation: s.upsertConversation,
      markReadLocal: s.markReadLocal,
      setTyping: s.setTyping,
      addUnreadForConversation: s.addUnreadForConversation,
      setConversations: s.setConversations,
    };
  }, []);

  const handle = useCallback(async (rawEvent: any) => {
    if (!mounted.current) return;

    // ✅ 1. ignore system event from SocketService
    if (rawEvent?.type === "SOCKET_CONNECTED") {
      log("connected");
      return;
    }

    // ✅ 2. normalize backend event
    const e = rawEvent as ChatRealtimeEvent;

    if (isDuplicate(e)) return;

    // =====================
    // PRESENCE
    // =====================
    if (e.eventType === "PRESENCE_UPDATED") {
      usePresenceStore.getState().updateFromRealtime({
        userId: e.userId,
        online: e.online,
        lastSeenAt: e.lastSeenAt,
      });
      return;
    }

    // =====================
    // FRIEND REQUEST
    // =====================
    if (e.eventType === "FRIENDSHIP_REQUEST_RECEIVED") {
      useFriendRequestStore.getState().increment();
      Alert.alert("Friend", "New request");
      return;
    }

    const raw =
      e.eventType === "MESSAGE_SENT" || e.eventType === "NEW_MESSAGE"
        ? e.conversationId ?? e.message?.conversationId
        : e.conversationId;

    const convId = normalizeId(raw);
    if (!convId) return;

    const state = getState();
    const {
      activeConversationId,
      conversations,
      appendMessageRealtime,
      upsertConversation,
      markReadLocal,
      setTyping,
      addUnreadForConversation,
    } = state;

    const matched = conversations.find(
      (c) => normalizeId(c.id) === convId
    );

    const id = matched?.id ?? raw ?? convId;

    const isActive =
      normalizeId(activeConversationId) === convId;

    // =====================
    // CONVERSATION UPDATED (from /user/queue/chat)
    // =====================
    // This event arrives when user is NOT in the conversation screen
    // Contains: unreadCount, totalUnreadCount, lastMessage, lastMessageAt
    if (e.eventType === "CONVERSATION_UPDATED") {
      log("CONVERSATION_UPDATED", { convId: id, event: e });

      upsertConversation({
        id,
        lastMessage: e.lastMessage ?? undefined,
        lastMessageAt: e.lastMessageAt ?? undefined,
        unreadCount: e.unreadCount ?? undefined,
      });

      // If user is NOT in this conversation, increment unread
      if (!isActive && e.unreadCount != null && e.unreadCount > 0) {
        // unreadCount already includes the new message
        // No need to call addUnreadForConversation
      }

      return;
    }

    // =====================
    // TYPING
    // =====================
    if (e.eventType === "TYPING") {
      setTyping(id, Boolean(e.typing));
      return;
    }

    // =====================
    // READ RECEIPT (from /topic/chat/{conversationId})
    // =====================
    // ✅ FIX Bug #6: Handle READ_RECEIPT events to update seenBy status
    if (e.eventType === "READ_RECEIPT") {
      const msg = e.message;

      if (msg && e.actorId) {
        // Update seenBy for all messages up to this one
        const conversationMessages = useChatStore.getState()
          .messagesByConversation[id]?.items ?? [];

        const readIndex = conversationMessages.findIndex(m => m.id === msg.id);

        if (readIndex >= 0) {
          // Mark all older messages as seen by this actor
          const updatedMessages = conversationMessages.map((m, idx) => {
            if (idx >= readIndex && m.senderId === meIdRef.current) {
              const seenBy = new Set(m.seenBy ?? []);
              seenBy.add(e.actorId);
              return { ...m, seenBy: Array.from(seenBy) };
            }
            return m;
          });

          // Update store
          useChatStore.getState().setMessages(
            id,
            updatedMessages,
            null
          );
        }
      }

      return;
    }

    // =====================
    // MESSAGE (from /topic/chat/{conversationId})
    // =====================
    // This event arrives when user IS in the conversation screen
    if (
      e.eventType === "MESSAGE_SENT" ||
      e.eventType === "NEW_MESSAGE"
    ) {
      const rawMsg = e.message;
      if (!rawMsg) return;

      // 🔥 FIX: Backend sends messageId, but mobile expects id
      // Transform backend payload to match MessageItem type
      const msg: any = {
        ...rawMsg,
        id: (rawMsg as any).messageId || (rawMsg as any).id,
      };

      appendMessageRealtime(id, msg);

      upsertConversation({
        id,
        lastMessage: (msg as any).content,
        lastMessageAt: (msg as any).createdAt,
      });

      const isFromOther =
        msg.senderId && msg.senderId !== meIdRef.current;

      if (isActive && isFromOther) {
        markReadLocal(id);
      } else if (!isActive && isFromOther) {
        addUnreadForConversation(id);
      }

      return;
    }

    // =====================
    // MESSAGE RECALLED (from /topic/chat/{conversationId})
    // =====================
    // ✅ Handle recalled messages
    if (e.eventType === "MESSAGE_RECALLED") {
      const rawMsg = e.message;
      if (!rawMsg) return;

      const msg: any = {
        ...rawMsg,
        id: (rawMsg as any).messageId || (rawMsg as any).id,
        recalled: true,
      };

      appendMessageRealtime(id, msg);
      return;
    }

    // =====================
    // MESSAGE UPDATED (from /topic/chat/{conversationId})
    // =====================
    // ✅ Handle edited messages
    if (e.eventType === "MESSAGE_UPDATED") {
      const rawMsg = e.message;
      if (!rawMsg) return;

      const msg: any = {
        ...rawMsg,
        id: (rawMsg as any).messageId || (rawMsg as any).id,
        edited: true,
      };

      appendMessageRealtime(id, msg);

      // Update conversation last message if edited
      upsertConversation({
        id,
        lastMessage: (msg as any).content,
        lastMessageAt: (msg as any).updatedAt || (msg as any).createdAt,
      });

      return;
    }

    // =====================
    // MESSAGE REACTION UPDATED (from /topic/chat/{conversationId})
    // =====================
    // ✅ Handle reaction updates
    if (e.eventType === "MESSAGE_REACTION_UPDATED") {
      const rawMsg = e.message;
      if (!rawMsg) return;

      const msg: any = {
        ...rawMsg,
        id: (rawMsg as any).messageId || (rawMsg as any).id,
      };

      appendMessageRealtime(id, msg);
      return;
    }
  }, [getState]);

  useEffect(() => {
    if (!token) return;

    mounted.current = true;

    const unsub = socketService.addListener(handle);

    socketService.connect(token);
    reconnectManager.start();

    getConversations().then((res) => {
      const { setConversations } = getState();
      const currentConversations = useChatStore.getState().conversations;

      // ✅ FIX Bug #4: Merge server data with local state, preserve higher unread counts
      // This prevents unread count flicker during reconnect
      const merged = res.data.map(serverConv => {
        const local = currentConversations.find(c => c.id === serverConv.id);

        if (!local) {
          return serverConv; // New conversation
        }

        // Preserve higher unread count (in case realtime events arrived during fetch)
        return {
          ...serverConv,
          unreadCount: Math.max(
            serverConv.unreadCount ?? 0,
            local.unreadCount ?? 0
          ),
        };
      });

      setConversations(merged);

      socketService.syncConversationSubscriptions(
        merged.map((c) => c.id)
      );
    });

    return () => {
      mounted.current = false;
      unsub();
      reconnectManager.stop();
    };
  }, [token, handle, getState]);

  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  useEffect(() => {
    if (!connected) return;

    socketService.syncConversationSubscriptions(
      conversations.map((c) => c.id)
    );
  }, [connected, conversations]);

  // 🔥 FIX: Immediately subscribe to active conversation when it changes
  useEffect(() => {
    if (!connected || !activeConversationId) return;

    // Ensure active conversation is in the subscribed list
    const conversationIds = conversations.map((c) => c.id);
    if (!conversationIds.includes(activeConversationId)) {
      log("activeConversation", `Subscribing to active conversation: ${activeConversationId.slice(0, 8)}`);
      socketService.syncConversationSubscriptions([...conversationIds, activeConversationId]);
    }
  }, [connected, activeConversationId, conversations]);

  return {
    connected,
    publishTyping: useCallback((id: string, typing: boolean) => {
      socketService.publish("/app/chat.typing", { id, typing });
    }, []),
  };
}