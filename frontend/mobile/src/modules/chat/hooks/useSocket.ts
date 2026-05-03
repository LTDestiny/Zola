import { useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { socketService, type ChatRealtimeEvent } from "@/modules/chat/socket/socketService";
import { reconnectManager } from "@/modules/chat/socket/reconnectManager";
import { 
  getConversations, 
  getMessages, 
  markConversationRead,
  getFriends,
  getPendingFriendRequests,
  getSentPendingFriendRequests,
  getBlockedUsers,
} from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { usePresenceStore } from "@/modules/chat/store/presenceStore";
import { useFriendRequestStore } from "@/modules/chat/store/friendRequestStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { useSocketStore } from "@/modules/chat/store/socketStore";
import { useRelationshipStore } from "@/modules/chat/store/relationshipStore";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY SOCKET HOOK - FIXES ALL REALTIME BUGS
// 
// ROOT CAUSES FIXED:
// 1. Stale closure - uses refs + getState() for always-fresh values
// 2. Duplicate socket - uses singleton socketService only
// 3. Race condition - proper subscribe order on reconnect
// 4. WiFi reconnect - uses reconnectManager with NetInfo
// 5. Typing stuck - auto-clear stale typing in chatStore
// 6. DUPLICATE EVENTS - Backend sends to BOTH topic + user queue
//    → We deduplicate by messageId to prevent double processing
// 7. PRESENCE - Updates presenceStore on PRESENCE_UPDATED events
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[useSocket][${tag}]`, ...args);
  }
}

// Normalize conversation ID for comparison (handles case sensitivity, whitespace)
function normalizeId(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

// ─── MESSAGE DEDUPLICATION ───────────────────────────────────────────────────
// Backend sends same message to BOTH /topic/chat/{id} AND /user/queue/chat
// We need to deduplicate to prevent processing twice
const DEDUP_WINDOW_MS = 5000; // 5 second window
const processedEvents = new Map<string, number>(); // eventKey → timestamp

function getEventKey(event: ChatRealtimeEvent): string | null {
  // Only deduplicate message-creation events (backend sends to BOTH topic AND user queue).
  // Update events (RECALLED, UPDATED, READ_RECEIPT) must NEVER be deduplicated —
  // they need to overwrite the same messageId in the store.
  const isCreateEvent =
    event.eventType === "NEW_MESSAGE" ||
    event.eventType === "MESSAGE_SENT" ||
    event.eventType === "new_group_message" ||
    event.eventType === "message_replied" ||
    event.eventType === "NEW_GROUP_MESSAGE" ||
    event.eventType === "MESSAGE_REPLIED";
  if (isCreateEvent) {
    const messageId = event.message?.id ?? event.message?.messageId;
    if (messageId) {
      return `msg:${messageId}`;
    }
  }
  if (event.eventType === "TYPING" || event.eventType === "user_typing_group") {
    return `typing:${event.conversationId}:${event.typing}`;
  }
  return null;
}

function isDuplicateEvent(event: ChatRealtimeEvent): boolean {
  const key = getEventKey(event);
  if (!key) return false;

  const now = Date.now();
  const lastSeen = processedEvents.get(key);

  // Cleanup old entries
  for (const [k, ts] of processedEvents) {
    if (now - ts > DEDUP_WINDOW_MS) {
      processedEvents.delete(k);
    }
  }

  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    log("dedup", `Duplicate event ignored: ${key}`);
    return true;
  }

  processedEvents.set(key, now);
  return false;
}

export function useSocket() {
  // ─── AUTH STATE ────────────────────────────────────────────────────────────
  const accessToken = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.me?.id);

  // ─── SOCKET STATE ──────────────────────────────────────────────────────────
  const connected = useSocketStore((s) => s.connected);

  // ─── REFS FOR STABLE VALUES (prevents stale closures) ──────────────────────
  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventListenerCleanupRef = useRef<(() => void) | null>(null);
  const stateListenerCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // ─── HELPER: Get latest state (ALWAYS fresh, no stale closure) ─────────────
  const getLatestState = useCallback(() => {
    const state = useChatStore.getState();
    return {
      activeConversationId: state.activeConversationId,
      conversations: state.conversations,
      appendMessageRealtime: state.appendMessageRealtime,
      upsertConversation: state.upsertConversation,
      addUnreadForConversation: state.addUnreadForConversation,
      markReadLocal: state.markReadLocal,
      setMessages: state.setMessages,
      setTyping: state.setTyping,
      setConversations: state.setConversations,
    };
  }, []);

  // ─── DEBOUNCED REFRESH ─────────────────────────────────────────────────────
  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        log("refresh", "Fetching conversations from server...");
        const response = await getConversations();
        if (mountedRef.current) {
          const { setConversations } = getLatestState();
          setConversations(response.data);
          log("refresh", "Conversations updated:", response.data.length);

          // Sync subscriptions with new conversation list
          const ids = response.data.map((c) => c.id).filter(Boolean);
          socketService.syncConversationSubscriptions(ids);
        }
      } catch (error) {
        log("refresh", "Failed to refresh conversations:", error);
      }
    }, 300);
  }, [getLatestState]);

  // ─── NORMALIZE MESSAGE FROM EVENT ──────────────────────────────────────────
  const normalizeMessage = useCallback((
    fallbackConversationId: string,
    message: ChatRealtimeEvent["message"]
  ) => {
    if (!message) return null;

    const m = message as Record<string, unknown>;
    const id = (m.id as string) ?? (m.messageId as string) ?? "";
    if (!id) return null;

    return {
      ...message,
      id,
      conversationId: (m.conversationId as string) ?? fallbackConversationId,
      content: (m.content as string) ?? "",
      senderId: String(m.senderId ?? ""), // Handle number vs string
      createdAt: (m.createdAt as string) ?? new Date().toISOString(),
    };
  }, []);

  // ─── MAIN EVENT HANDLER (NO useMemo - uses refs for fresh values) ──────────
  const handleEvent = useCallback(async (event: ChatRealtimeEvent) => {
    if (!mountedRef.current) return;

    // ─── PRESENCE EVENTS (no conversationId) ─────────────────────────────────
    if (
      event.eventType === "PRESENCE_UPDATED" ||
      event.eventType === "USER_LAST_SEEN_UPDATE" ||
      event.eventType === "presence:update"
    ) {
      if (event.userId) {
        log("presence", `📡 ${event.userId} → ${event.online ? "online" : "offline"}`);
        usePresenceStore.getState().updateFromRealtime({
          userId: event.userId,
          online: event.online,
          lastSeenAt: event.lastSeenAt,
        });
      }
      return;
    }

    // ─── FRIENDSHIP EVENTS (no conversationId) ───────────────────────────────
    if (event.eventType === "FRIENDSHIP_REQUEST_RECEIVED" || event.eventType === "friend_request_received") {
      log("friend", "👥 Friend request received");
      useFriendRequestStore.getState().increment();
      Alert.alert("Lời mời kết bạn", "Bạn có lời mời kết bạn mới!");
      
      const { me } = useAuthStore.getState();
      if (event.actorId) {
        useRelationshipStore.getState().fetchEntry(event.actorId, me?.id);
      }
      // Refresh received list
      getPendingFriendRequests().then(res => {
        useRelationshipStore.getState().setReceivedRequests(res.data ?? []);
      });
      return;
    }

    if (event.eventType === "FRIENDSHIP_REQUEST_SENT" || event.eventType === "friend_request_sent") {
      log("friend", "📤 Friend request sent from another device");
      const { me } = useAuthStore.getState();
      if (event.targetId) {
        useRelationshipStore.getState().fetchEntry(event.targetId, me?.id);
      }
      // Refresh sent list
      getSentPendingFriendRequests().then(res => {
        useRelationshipStore.getState().setSentRequests(res.data ?? []);
      });
      return;
    }

    if (event.eventType === "FRIENDSHIP_REQUEST_ACCEPTED" || event.eventType === "friend_request_accepted") {
      log("friend", "✅ Friend request accepted");
      Alert.alert("Kết bạn thành công", "Lời mời kết bạn đã được chấp nhận!");
      
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      
      // Refresh friends and requests lists
      getFriends().then(res => useRelationshipStore.getState().setFriends(res.data ?? []));
      getPendingFriendRequests().then(res => useRelationshipStore.getState().setReceivedRequests(res.data ?? []));
      getSentPendingFriendRequests().then(res => useRelationshipStore.getState().setSentRequests(res.data ?? []));
      return;
    }

    if (
      event.eventType === "FRIENDSHIP_REQUEST_DECLINED" ||
      event.eventType === "FRIENDSHIP_REQUEST_REJECTED" ||
      event.eventType === "friend_request_rejected"
    ) {
      log("friend", "❌ Friend request declined/rejected");
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      getPendingFriendRequests().then(res => useRelationshipStore.getState().setReceivedRequests(res.data ?? []));
      return;
    }

    if (event.eventType === "FRIENDSHIP_REQUEST_CANCELLED" || event.eventType === "friend_request_cancelled") {
      log("friend", "🚫 Friend request cancelled");
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      getPendingFriendRequests().then(res => useRelationshipStore.getState().setReceivedRequests(res.data ?? []));
      getSentPendingFriendRequests().then(res => useRelationshipStore.getState().setSentRequests(res.data ?? []));
      return;
    }

    if (event.eventType === "FRIENDSHIP_REMOVED" || event.eventType === "friendship_removed") {
      log("friend", "💔 Friendship removed");
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      getFriends().then(res => useRelationshipStore.getState().setFriends(res.data ?? []));
      return;
    }

    if (event.eventType === "USER_BLOCKED" || event.eventType === "user_blocked") {
      log("block", "🚫 User blocked");
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      getBlockedUsers().then(res => useRelationshipStore.getState().setBlockedUsers(res.data ?? []));
      // Blocks also affect friend status
      getFriends().then(res => useRelationshipStore.getState().setFriends(res.data ?? []));
      return;
    }

    if (event.eventType === "USER_UNBLOCKED" || event.eventType === "user_unblocked") {
      log("block", "🔓 User unblocked");
      const { me } = useAuthStore.getState();
      const targetId = event.actorId || event.targetId;
      if (targetId) {
        useRelationshipStore.getState().fetchEntry(targetId, me?.id);
      }
      getBlockedUsers().then(res => useRelationshipStore.getState().setBlockedUsers(res.data ?? []));
      return;
    }

    // ─── DEDUPLICATION CHECK ───────────────────────────────────────────────
    // Backend sends same message to BOTH /topic/chat/{id} AND /user/queue/chat
    // Skip duplicate events to prevent double processing
    if (isDuplicateEvent(event)) {
      return;
    }

    // Extract conversation ID (may come from different places)
    const rawId = event.conversationId
      ?? (event.message as { conversationId?: string } | null)?.conversationId
      ?? "";
    const normalizedId = normalizeId(rawId);

    if (!normalizedId) {
      log("event", "⚠️ No conversationId in event, ignoring:", event.eventType);
      return;
    }

    // CRITICAL: Always get fresh state (no stale closures!)
    const state = getLatestState();
    const {
      activeConversationId,
      conversations,
      appendMessageRealtime,
      upsertConversation,
      addUnreadForConversation,
      markReadLocal,
      setMessages,
      setTyping,
    } = state;

    // Find actual conversation ID (may have different casing)
    const matched = conversations.find((c) => normalizeId(c.id) === normalizedId);
    const conversationId = matched?.id ?? rawId;

    const isActive = normalizeId(activeConversationId) === normalizedId;
    const eventType = String(event.eventType ?? "").toUpperCase();

    log("event", `📨 ${event.eventType}`, {
      conversationId: conversationId.slice(0, 8),
      isActive,
      hasMessage: !!event.message,
    });

    // ─── TYPING EVENT ──────────────────────────────────────────────────────
    if (
      eventType === "TYPING" ||
      eventType === "USER_TYPING_GROUP" ||
      event.eventType === "message:typing"
    ) {
      log("event", `⌨️ Typing event: ${conversationId.slice(0, 8)} → ${event.typing}`);
      setTyping(conversationId, Boolean(event.typing));
      return;
    }

    // ─── NEW MESSAGE EVENT ─────────────────────────────────────────────────
    if (
      eventType === "NEW_MESSAGE" ||
      eventType === "MESSAGE_SENT" ||
      eventType === "NEW_GROUP_MESSAGE" ||
      eventType === "MESSAGE_REPLIED" ||
      event.eventType === "new_group_message" ||
      event.eventType === "message_replied" ||
      event.eventType === "message:new"
    ) {
      const message = normalizeMessage(conversationId, event.message);
      if (!message) {
        log("event", "⚠️ Invalid message payload, ignoring");
        return;
      }

      log("event", `💬 New message:`, {
        id: message.id.slice(0, 8),
        senderId: message.senderId.slice(0, 8),
        content: message.content.slice(0, 20),
      });

      // CRITICAL: Update lastReceived for reconnect sync (Test 2 fix)
      if (message.createdAt) {
        reconnectManager.updateLastReceived(conversationId, message.createdAt);
      }

      // CRITICAL: Clear typing indicator when user sends a message (Test 4 fix)
      // If we receive a message from user X, they're no longer typing
      if (message.senderId) {
        setTyping(conversationId, false);
      }

      // 1. Append message to store
      appendMessageRealtime(conversationId, message);

      // 2. Update conversation metadata
      upsertConversation({
        id: conversationId,
        lastMessage: message.content,
        lastMessageSenderId: message.senderId,
        lastMessageType: message.type,
        lastMessageAt: message.createdAt,
      });

      // 3. Handle unread count
      const isFromOther = message.senderId && message.senderId !== meIdRef.current;

      if (!isActive && isFromOther) {
        // User not viewing this conversation - increment unread
        log("event", "📬 Incrementing unread for:", conversationId.slice(0, 8));

        if (typeof event.unreadCount === "number") {
          // Server sent unread count
          const currentUnread = conversations.find((c) => c.id === conversationId)?.unreadCount ?? 0;
          upsertConversation({
            id: conversationId,
            unreadCount: Math.max(currentUnread + 1, event.unreadCount),
          });
        } else {
          addUnreadForConversation(conversationId);
        }
      }

      if (isActive && isFromOther) {
        // User is viewing this conversation - mark as read
        log("event", "📖 Auto-marking as read (user viewing)");
        markReadLocal(conversationId);
        socketService.publish("/app/chat.read", {
          conversationId,
          messageId: message.id
        });
        markConversationRead(conversationId, message.id).catch(() => { });
      }

      // 4. Schedule background refresh
      scheduleRefresh();
      return;
    }

    // ─── MESSAGE UPDATE/RECALL/DELETE ──────────────────────────────────────
    if (
      eventType === "READ_RECEIPT" ||
      eventType === "MESSAGE_UPDATED" ||
      eventType === "MESSAGE_RECALLED" ||
      eventType === "MESSAGE_DELETED_FOR_ME"
    ) {
      const message = normalizeMessage(conversationId, event.message);
      if (message) {
        appendMessageRealtime(conversationId, message);

        if (eventType === "MESSAGE_RECALLED" || eventType === "MESSAGE_UPDATED") {
          upsertConversation({
            id: conversationId,
            lastMessage: message.content,
            lastMessageSenderId: message.senderId,
            lastMessageType: message.type,
            lastMessageAt: message.createdAt,
          });
        }
      }
      scheduleRefresh();
      return;
    }

    // ─── CONVERSATION UPDATE EVENT ─────────────────────────────────────────
    if (
      event.eventType === "conversation:update" ||
      eventType === "CONVERSATION_UPDATED" ||
      eventType === "UNREAD_COUNT_UPDATED" ||
      eventType === "TOTAL_UNREAD_UPDATED" ||
      eventType === "GROUP_CREATED" ||
      event.eventType === "group_created"
    ) {
      log("event", "🔄 Conversation update:", {
        eventType: event.eventType,
        unreadCount: event.unreadCount,
        lastMessage: event.lastMessage?.slice(0, 20),
      });

      const patch: Parameters<typeof upsertConversation>[0] = { id: conversationId };

      if (eventType === "GROUP_CREATED" || event.eventType === "group_created") {
        patch.name = "New group";
        patch.lastMessage = event.lastMessage ?? "";
        patch.lastMessageAt = event.lastMessageAt ?? new Date().toISOString();

        const nextIds = Array.from(
          new Set([...conversations.map((conversation) => conversation.id), conversationId]),
        );
        socketService.syncConversationSubscriptions(nextIds);
      }

      if (typeof event.unreadCount === "number") {
        patch.unreadCount = Math.max(0, event.unreadCount);
      }
      if (event.lastMessage !== undefined) {
        patch.lastMessage = event.lastMessage ?? "";
      }
      if (event.lastMessageAt !== undefined) {
        patch.lastMessageAt = event.lastMessageAt;
      }

      upsertConversation(patch);

      // If active, refresh messages and mark read
      if (isActive) {
        markReadLocal(conversationId);
        getMessages(conversationId, { limit: 40 })
          .then((res) => {
            if (mountedRef.current) {
              setMessages(conversationId, res.data.items, res.data.nextCursor);
            }
          })
          .catch(() => { });
      }

      scheduleRefresh();
      return;
    }

    // ─── READ RECEIPT (mark conversation as read if active) ────────────────
    if (event.eventType === "message:seen" || eventType === "READ_RECEIPT") {
      if (isActive) {
        markReadLocal(conversationId);
      }
      return;
    }

    log("event", "⚠️ Unhandled event type:", event.eventType);
  }, [getLatestState, normalizeMessage, scheduleRefresh]);

  // ─── SETUP: Connect socket and register event listener ─────────────────────
  useEffect(() => {
    if (!accessToken) {
      log("setup", "No access token, skipping socket setup");
      return;
    }

    log("setup", "🔌 Setting up socket connection...");
    mountedRef.current = true;

    // Register event listener (BEFORE connecting to avoid missing events)
    eventListenerCleanupRef.current = socketService.addEventListener(handleEvent);
    log("setup", "Event listener registered");

    // Register state listener for logging
    stateListenerCleanupRef.current = socketService.addStateListener((state) => {
      log("state", `Socket state: ${state}`);

      // CRITICAL: When socket reconnects, sync subscriptions again
      if (state === "CONNECTED") {
        const conversationIds = useChatStore.getState().conversations.map((c) => c.id).filter(Boolean);
        if (conversationIds.length > 0) {
          log("state", `Socket connected - syncing ${conversationIds.length} subscriptions`);
          socketService.syncConversationSubscriptions(conversationIds);
        }
      }
    });

    // Connect socket
    socketService.connect(accessToken);

    // CRITICAL: Start reconnect manager for WiFi/network handling (Test 2 fix)
    reconnectManager.start();
    log("setup", "ReconnectManager started");

    // Fetch conversations and sync subscriptions
    // This ensures we have conversations to subscribe to
    getConversations()
      .then((response) => {
        if (!mountedRef.current) return;
        const { setConversations } = getLatestState();
        setConversations(response.data);
        const ids = response.data.map((c) => c.id).filter(Boolean);
        log("setup", `Loaded ${ids.length} conversations, syncing subscriptions...`);
        socketService.syncConversationSubscriptions(ids);
      })
      .catch((error) => {
        log("setup", "Failed to load conversations:", error);
      });

    // Cleanup on unmount
    return () => {
      log("cleanup", "🔌 Cleaning up socket...");
      mountedRef.current = false;

      if (eventListenerCleanupRef.current) {
        eventListenerCleanupRef.current();
        eventListenerCleanupRef.current = null;
      }

      if (stateListenerCleanupRef.current) {
        stateListenerCleanupRef.current();
        stateListenerCleanupRef.current = null;
      }

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      // Stop reconnect manager
      reconnectManager.stop();

      // Don't disconnect socket here - let socketService manage lifecycle
      // socketService.disconnect() should be called when user logs out
    };
  }, [accessToken, handleEvent, getLatestState]);

  // ─── SYNC: Update subscriptions when conversations change ──────────────────
  // CRITICAL: This effect subscribes to new conversations when they're loaded
  const conversations = useChatStore((s) => s.conversations);

  useEffect(() => {
    // Only sync if we have conversations and socket is connected
    const conversationIds = conversations.map((c) => c.id).filter(Boolean);
    if (conversationIds.length === 0) {
      log("sync", "No conversations to sync");
      return;
    }

    log("sync", `Conversations changed - syncing ${conversationIds.length} subscriptions`);
    socketService.syncConversationSubscriptions(conversationIds);
  }, [conversations]); // React to conversations changes

  // ─── RETURN HOOK API ───────────────────────────────────────────────────────
  return {
    connected,
    publishTyping: useCallback((
      conversationId: string,
      typing: boolean,
      conversationType: "private" | "group" = "private",
    ) => {
      socketService.publishTyping(conversationId, typing, conversationType);
    }, []),
  };
}
