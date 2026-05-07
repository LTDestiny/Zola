import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY WEB REALTIME CLIENT
// 
// FIXES:
// 1. Subscribe to /user/queue/notifications for unread count updates
// 2. Better reconnect handling
// 3. Proper subscription management
// ═══════════════════════════════════════════════════════════════════════════════

import { env } from "../shared/env";

const CALL_DEBUG =
  String(env.VITE_CALL_DEBUG ?? "true").toLowerCase() === "true";

function resolveWsUrl() {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "appassets.androidplatform.net") {
      return env.VITE_WS_URL ?? "wss://10.18.76.36:18443/ws";
    }

    if (window.location.port === "5173") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws`;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = protocol === "wss:" ? "18443" : "8083";
    return `${protocol}//${window.location.hostname}:${port}/ws`;
  }

  return "ws://127.0.0.1:8083/ws";
}

const CALL_LOG_PATTERN =
  /\/app\/(call\.signal|signal\/call)|\/topic\/call|\/user\/queue\/call|\/queue\/call|CALL_|WEBRTC_|\bERROR\b/i;

function toLogString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shouldEmitCallLog(tag: string, args: unknown[]): boolean {
  if (tag === "error") {
    return true;
  }

  const snapshot = [tag, ...args.map(toLogString)].join(" ");
  return CALL_LOG_PATTERN.test(snapshot);
}

function log(tag: string, ...args: unknown[]) {
  if (!CALL_DEBUG || !shouldEmitCallLog(tag, args)) {
    return;
  }

  console.log(`[chatRealtime][${tag}]`, ...args);
}

export type ChatRealtimeEvent = {
  eventType: string;
  actorId: string;
  conversationId: string;
  typing: boolean;
  online: boolean;
  targetUserId: string | null;
  affectedUserId?: string | null;
  membershipAction?: "ADDED" | "REMOVED" | "APPROVED" | "LEFT" | null;
  conversationName?: string | null;
  unreadCount?: number | null;
  totalUnreadCount?: number | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  conversation?: {
    id: string;
    type?: "private" | "group";
    name: string;
    avatar?: string | null;
    lastMessage: string;
    lastMessageSenderId?: string | null;
    lastMessageType?: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    lastReadAt?: string | null;
    lastReadMessageId?: string | null;
    participants: string[];
    admins?: string[];
    ownerId?: string | null;
  } | null;
  groupSettings?: {
    conversationId: string;
    name: string;
    avatar: string | null;
    ownerId: string | null;
    admins: string[];
    participants: string[];
    onlyAdminsCanMessage: boolean;
    requireApprovalToJoin: boolean;
    allowMemberInvite: boolean;
    allowMemberEditGroupInfo?: boolean;
    allowMemberPinBoardItems?: boolean;
    allowMemberCreateNotes?: boolean;
    allowMemberCreateReminders?: boolean;
    allowMemberCreatePolls?: boolean;
    pendingParticipants?: Array<{
      userId: string;
      requestedByUserId?: string | null;
      requestedAt?: string | null;
    }>;
    pinnedMessages?: Array<{
      sourceMessageId: string;
      title: string;
      preview: string;
      createdAtMs: number;
    }>;
    inviteCode?: string | null;
    isOwner: boolean;
    isAdmin: boolean;
  } | null;
  message: {
    messageId: string;
    conversationId: string;
    senderId: string;
    receiverId: string | null;
    type: string;
    content: string;
    parentMessageId?: string | null;
    fileUrl: string | null;
    fileName: string | null;
    reactions: string[];
    reactionEntries?: Array<{
      userId: string;
      emoji: string;
    }>;
    deletedForUsers: string[];
    deliveredTo: string[];
    seenBy: string[];
    createdAt: string;
    updatedAt: string;
    recalled: boolean;
    edited: boolean;
  } | null;
};

export type SyncRealtimeEvent = {
  userId: string;
  sourceClient: string;
  eventType: string;
  payload: string;
  timestamp: string;
};

export type PresenceRealtimeEvent = {
  userId: string;
  online: boolean;
  lastSeenAt?: string;      // New field from backend
  lastChangedAt?: string;   // Legacy field name
};

export type CallSignalType =
  | "CALL_INVITE"
  | "CALL_ACCEPT"
  | "CALL_REJECT"
  | "CALL_JOINED"
  | "CALL_LEAVE"
  | "WEBRTC_OFFER"
  | "WEBRTC_ANSWER"
  | "WEBRTC_ICE"
  | "CALL_END";

export type CallRealtimeEvent = {
  actorId: string;
  conversationId: string;
  targetUserId: string | null;
  callId: string;
  mode: "voice" | "video";
  signalType: CallSignalType;
  payload: string | null;
  createdAt: string;
};

type RealtimeHandlers = {
  onEvent: (event: ChatRealtimeEvent) => void;
  onSyncEvent?: (event: SyncRealtimeEvent) => void;
  onPresenceEvent?: (event: PresenceRealtimeEvent) => void;
  onCallEvent?: (event: CallRealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
};

export class ChatRealtimeClient {
  private readonly client: Client;
  private readonly conversationSubscriptions = new Map<string, StompSubscription>();
  private readonly callTopicSubscriptions = new Map<string, StompSubscription>();
  private userQueueSubscription: StompSubscription | null = null;
  private notificationsQueueSubscription: StompSubscription | null = null; // NEW: For unread counts
  private syncQueueSubscription: StompSubscription | null = null;
  private presenceSubscription: StompSubscription | null = null;
  private callQueueSubscription: StompSubscription | null = null;
  private globalCallTopicSubscription: StompSubscription | null = null;
  private readonly onEvent: (event: ChatRealtimeEvent) => void;
  private readonly onSyncEvent?: (event: SyncRealtimeEvent) => void;
  private readonly onPresenceEvent?: (event: PresenceRealtimeEvent) => void;
  private readonly onCallEvent?: (event: CallRealtimeEvent) => void;
  private readonly onError?: (message: string) => void;

  // Track pending conversation IDs for reconnect
  private pendingConversationIds = new Set<string>();
  private readonly processedCallEventKeys = new Set<string>();

  constructor(accessToken: string, handlers: RealtimeHandlers) {
    this.onEvent = handlers.onEvent;
    this.onSyncEvent = handlers.onSyncEvent;
    this.onPresenceEvent = handlers.onPresenceEvent;
    this.onCallEvent = handlers.onCallEvent;
    this.onError = handlers.onError;

    const wsUrl = env.VITE_WS_URL ?? resolveWsUrl();
    log("constructor", `WebSocket URL: ${wsUrl}`);

    this.client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 3000,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      debug: (str) => {
        if (CALL_DEBUG && CALL_LOG_PATTERN.test(str)) {
          log("stomp", str.slice(0, 260));
        }
      },
      onConnect: () => {
        log("connect", "✅ STOMP CONNECTED");
        // Resubscribe to user queues
        this.subscribeUserQueue();
        // Resubscribe to all pending conversations
        this.resubscribeAllConversations();
        handlers.onConnect?.();
      },
      onDisconnect: () => {
        log("disconnect", "STOMP disconnected");
        handlers.onDisconnect?.();
      },
      onStompError: (frame) => {
        log("error", "STOMP error:", frame.headers.message);
        handlers.onError?.(frame.headers.message ?? "WebSocket STOMP error");
      },
      onWebSocketError: () => {
        log("error", "WebSocket connection error");
        handlers.onError?.("WebSocket connection error");
      },
    });

    this.client.onUnhandledMessage = (_message: IMessage) => undefined;
  }

  connect() {
    log("connect", "Activating STOMP client...");
    this.client.activate();
  }

  disconnect() {
    log("disconnect", "Deactivating STOMP client...");
    this.conversationSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.conversationSubscriptions.clear();
    this.callTopicSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.callTopicSubscriptions.clear();
    this.pendingConversationIds.clear();
    this.processedCallEventKeys.clear();
    this.userQueueSubscription?.unsubscribe();
    this.notificationsQueueSubscription?.unsubscribe();
    this.syncQueueSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.callQueueSubscription?.unsubscribe();
    this.globalCallTopicSubscription?.unsubscribe();
    this.userQueueSubscription = null;
    this.notificationsQueueSubscription = null;
    this.syncQueueSubscription = null;
    this.presenceSubscription = null;
    this.callQueueSubscription = null;
    this.globalCallTopicSubscription = null;
    this.client.deactivate();
  }

  isConnected() {
    return this.client.connected;
  }

  private safePublish(destination: string, body: unknown): boolean {
    if (!this.client.connected || !this.client.active) {
      log("publish", `Cannot publish to ${destination} - not connected`);
      return false;
    }
    const webSocket = (
      this.client as unknown as { webSocket?: { readyState?: number } }
    ).webSocket;
    if (webSocket?.readyState !== undefined && webSocket.readyState !== 1) {
      log("publish", `Cannot publish to ${destination} - WebSocket not open`);
      return false;
    }
    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
      log("publish", `✅ Published to ${destination}`);
      return true;
    } catch (err) {
      log("publish", `Failed to publish to ${destination}:`, err);
      this.onError?.("Realtime connection is closing or closed");
      return false;
    }
  }

  // ─── RESUBSCRIBE ALL CONVERSATIONS (after reconnect) ───────────────────────

  private resubscribeAllConversations() {
    if (!this.client.connected) return;

    log("resubscribe", `Resubscribing to ${this.pendingConversationIds.size} conversations...`);

    // Clear existing subscriptions
    this.conversationSubscriptions.forEach((sub) => {
      try { sub.unsubscribe(); } catch { /* ignore */ }
    });
    this.conversationSubscriptions.clear();
    this.callTopicSubscriptions.forEach((sub) => {
      try { sub.unsubscribe(); } catch { /* ignore */ }
    });
    this.callTopicSubscriptions.clear();

    // Resubscribe to all pending
    this.pendingConversationIds.forEach((id) => {
      this.subscribeConversation(id);
    });
  }

  subscribeConversation(conversationId: string) {
    // Always track the conversation ID (even if not connected yet)
    this.pendingConversationIds.add(conversationId);

    if (!this.client.connected) {
      log("subscribe", `Queued conversation ${conversationId.slice(0, 8)} (not connected)`);
      return;
    }
    if (this.conversationSubscriptions.has(conversationId)) {
      if (!this.callTopicSubscriptions.has(conversationId)) {
        this.subscribeCallTopic(conversationId);
      }
      return;
    }

    const subscription = this.client.subscribe(
      `/topic/chat/${conversationId}`,
      (message) => {
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `[topic/chat/${conversationId.slice(0, 8)}] ${event.eventType}`);
          if (event.conversationId !== conversationId) {
            return;
          }
          this.onEvent(event);
        } catch {
          this.onError?.("Cannot parse realtime event");
        }
      },
    );
    this.conversationSubscriptions.set(conversationId, subscription);
    log("subscribe", `✅ Subscribed to conversation ${conversationId.slice(0, 8)}`);
    this.subscribeCallTopic(conversationId);
  }

  private subscribeCallTopic(conversationId: string) {
    if (!this.client.connected || this.callTopicSubscriptions.has(conversationId)) {
      return;
    }

    const subscription = this.client.subscribe(
      `/topic/call/${conversationId}`,
      (message) => {
        try {
          const event = JSON.parse(message.body) as CallRealtimeEvent;
          this.emitCallEvent(event, `topic/call/${conversationId.slice(0, 8)}`);
        } catch {
          this.onError?.("Cannot parse call topic realtime event");
        }
      },
    );

    this.callTopicSubscriptions.set(conversationId, subscription);
    log("subscribe", `✅ Subscribed to call topic ${conversationId.slice(0, 8)}`);
  }

  private emitCallEvent(event: CallRealtimeEvent, source: string) {
    const dedupKey = `${event.signalType}|${event.callId}|${event.actorId}|${event.targetUserId ?? "-"}|${event.createdAt}`;
    if (this.processedCallEventKeys.has(dedupKey)) {
      return;
    }

    this.processedCallEventKeys.add(dedupKey);
    if (this.processedCallEventKeys.size > 1200) {
      const first = this.processedCallEventKeys.values().next().value;
      if (first) {
        this.processedCallEventKeys.delete(first);
      }
    }

    log("event", `[${source}] ${event.signalType}`, {
      callId: event.callId,
      conversationId: event.conversationId?.slice(0, 8),
      targetUserId: event.targetUserId?.slice(0, 8),
    });
    this.onCallEvent?.(event);
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) {
      // Even if not connected, track the IDs for later
      conversationIds.forEach((id) => this.pendingConversationIds.add(id));
      log("sync", `Queued ${conversationIds.length} conversations (not connected)`);
      return;
    }

    const expected = new Set(conversationIds.filter(Boolean));
    const current = new Set(this.conversationSubscriptions.keys());

    let changed = expected.size !== current.size;
    if (!changed) {
      for (const id of expected) {
        if (!current.has(id)) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return;
    }

    // Unsubscribe from removed conversations
    this.conversationSubscriptions.forEach((subscription, id) => {
      if (!expected.has(id)) {
        subscription.unsubscribe();
        this.conversationSubscriptions.delete(id);
        const callTopicSubscription = this.callTopicSubscriptions.get(id);
        if (callTopicSubscription) {
          callTopicSubscription.unsubscribe();
          this.callTopicSubscriptions.delete(id);
        }
        this.pendingConversationIds.delete(id);
      }
    });

    // Subscribe to new conversations
    expected.forEach((id) => {
      this.subscribeConversation(id);
    });

    log("sync", `Synced ${expected.size} conversations`);
  }

  subscribeUserQueue() {
    if (!this.client.connected) {
      log("subscribe", "Cannot subscribe user queue - not connected");
      return;
    }

    // 1. Subscribe to /user/queue/chat (main chat events)
    this.userQueueSubscription?.unsubscribe();
    this.userQueueSubscription = this.client.subscribe(
      "/user/queue/chat",
      (message) => {
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `[user/queue/chat] ${event.eventType}`, {
            conversationId: event.conversationId?.slice(0, 8),
          });
          this.onEvent(event);
        } catch {
          this.onError?.("Cannot parse user queue realtime event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /user/queue/chat");

    // 2. Subscribe to /user/queue/notifications (CRITICAL: unread counts!)
    this.notificationsQueueSubscription?.unsubscribe();
    this.notificationsQueueSubscription = this.client.subscribe(
      "/user/queue/notifications",
      (message) => {
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `[user/queue/notifications] ${event.eventType}`, {
            unreadCount: event.unreadCount,
            totalUnreadCount: event.totalUnreadCount,
          });
          this.onEvent(event);
        } catch {
          this.onError?.("Cannot parse notifications queue event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /user/queue/notifications");

    // 3. Subscribe to /user/queue/sync
    this.syncQueueSubscription?.unsubscribe();
    this.syncQueueSubscription = this.client.subscribe(
      "/user/queue/sync",
      (message) => {
        try {
          const event = JSON.parse(message.body) as SyncRealtimeEvent;
          log("event", `[user/queue/sync] ${event.eventType}`);
          this.onSyncEvent?.(event);
        } catch {
          this.onError?.("Cannot parse sync realtime event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /user/queue/sync");

    // 4. Subscribe to /topic/presence
    this.presenceSubscription?.unsubscribe();
    this.presenceSubscription = this.client.subscribe(
      "/topic/presence",
      (message) => {
        try {
          const event = JSON.parse(message.body) as PresenceRealtimeEvent;
          log("event", `[topic/presence] userId=${event.userId} online=${event.online}`);
          this.onPresenceEvent?.(event);
        } catch {
          this.onError?.("Cannot parse presence realtime event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /topic/presence");

    // 5. Subscribe to /user/queue/call
    this.callQueueSubscription?.unsubscribe();
    this.callQueueSubscription = this.client.subscribe(
      "/user/queue/call",
      (message) => {
        try {
          const event = JSON.parse(message.body) as CallRealtimeEvent;
          this.emitCallEvent(event, "user/queue/call");
        } catch {
          this.onError?.("Cannot parse call queue realtime event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /user/queue/call");

    // 6. Subscribe to /topic/call as a global fallback channel
    this.globalCallTopicSubscription?.unsubscribe();
    this.globalCallTopicSubscription = this.client.subscribe(
      "/topic/call",
      (message) => {
        try {
          const event = JSON.parse(message.body) as CallRealtimeEvent;
          this.emitCallEvent(event, "topic/call");
        } catch {
          this.onError?.("Cannot parse global call topic event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /topic/call");
  }

  publishSend(
    conversationId: string,
    content: string,
    type: "TEXT" | "EMOJI" | "FILE" | "FORWARD" = "TEXT",
    fileUrl: string | null = null,
    fileName: string | null = null,
  ): boolean {
    return this.safePublish("/app/chat.send", {
      conversationId,
      type,
      content,
      fileUrl,
      fileName,
    });
  }

  publishCreateGroup(name: string, memberIds: string[], avatar: string | null = null): boolean {
    return this.safePublish("/app/create_group", {
      name,
      memberIds,
      avatar,
    });
  }

  publishJoinGroup(conversationId: string): boolean {
    return this.safePublish("/app/join_group", {
      conversationId,
    });
  }

  publishSendGroupMessage(
    conversationId: string,
    content: string,
    type: "TEXT" | "EMOJI" | "FILE" | "FORWARD" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT",
    fileUrl: string | null = null,
    fileName: string | null = null,
    parentMessageId: string | null = null,
  ): boolean {
    return this.safePublish("/app/send_group_message", {
      conversationId,
      type,
      content,
      fileUrl,
      fileName,
      parentMessageId,
    });
  }

  publishTypingGroup(conversationId: string, typing: boolean): boolean {
    return this.safePublish("/app/typing_group", {
      conversationId,
      typing,
    });
  }

  publishReactMessage(
    conversationId: string,
    messageId: string,
    emoji: string,
    remove = false,
  ): boolean {
    return this.safePublish("/app/react_message", {
      conversationId,
      messageId,
      emoji,
      remove,
    });
  }

  publishReplyMessage(
    conversationId: string,
    content: string,
    parentMessageId: string,
    type: "TEXT" | "EMOJI" | "FILE" | "FORWARD" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT",
    fileUrl: string | null = null,
    fileName: string | null = null,
  ): boolean {
    return this.safePublish("/app/reply_message", {
      conversationId,
      type,
      content,
      fileUrl,
      fileName,
      parentMessageId,
    });
  }

  publishTyping(conversationId: string, typing: boolean): boolean {
    return this.safePublish("/app/chat.typing", {
      conversationId,
      typing,
    });
  }

  publishRecall(conversationId: string, messageId: string): boolean {
    return this.safePublish("/app/chat.recall", {
      conversationId,
      messageId,
    });
  }

  publishEdit(conversationId: string, messageId: string, content: string): boolean {
    return this.safePublish("/app/chat.edit", {
      conversationId,
      messageId,
      content,
    });
  }

  publishDeleteForMe(conversationId: string, messageId: string): boolean {
    return this.safePublish("/app/chat.delete-for-me", {
      conversationId,
      messageId,
    });
  }

  publishRead(conversationId: string, messageId: string): boolean {
    return this.safePublish("/app/chat.read", {
      conversationId,
      messageId,
    });
  }

  publishForward(
    sourceConversationId: string,
    messageId: string,
    targetConversationId: string,
  ): boolean {
    return this.safePublish("/app/chat.forward", {
      sourceConversationId,
      messageId,
      targetConversationId,
    });
  }

  publishReact(
    conversationId: string,
    messageId: string,
    emoji: string,
    remove = false,
  ): boolean {
    return this.safePublish("/app/chat.react", {
      conversationId,
      messageId,
      emoji,
      remove,
    });
  }

  publishCallSignal(
    conversationId: string,
    targetUserId: string | null,
    callId: string,
    mode: "voice" | "video",
    signalType: CallSignalType,
    payload?: unknown,
  ): boolean {
    const normalizedPayload =
      payload == null
        ? null
        : typeof payload === "string"
          ? payload
          : JSON.stringify(payload);

    const destination = "/app/signal/call";
    log("call-publish", `${signalType} -> ${destination}`, {
      conversationId: conversationId.slice(0, 8),
      targetUserId: targetUserId?.slice(0, 8) ?? null,
      callId,
      payloadLength: normalizedPayload?.length ?? 0,
    });

    return this.safePublish(destination, {
      conversationId,
      targetUserId,
      callId,
      mode,
      signalType,
      payload: normalizedPayload,
    });
  }
}
