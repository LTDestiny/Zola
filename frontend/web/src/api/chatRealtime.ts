import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT 1-1 REALTIME CLIENT (Web) - Following API Spec
// 
// Based on: CHAT_1_1_FRONTEND_API.md
// - STOMP destinations: /topic/chat/{conversationId}, /user/queue/chat
// - Publish: /app/chat.send, /app/chat.typing, /app/chat.read, etc.
// - Events: MESSAGE_SENT, CONVERSATION_UPDATED, TYPING, MESSAGE_RECALLED, etc.
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[chatRealtime][${tag}]`, ...args);
  }
}

export type ChatRealtimeEvent = {
  eventType: string;
  actorId: string;
  conversationId: string;
  typing: boolean;
  online: boolean;
  targetUserId: string | null;
  unreadCount?: number | null;
  totalUnreadCount?: number | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  message: {
    messageId: string;
    conversationId: string;
    senderId: string;
    receiverId: string | null;
    type: string;
    content: string;
    fileUrl: string | null;
    fileName: string | null;
    reactions: string[];
    deletedForUsers: string[];
    deliveredTo: string[];
    seenBy: string[];
    createdAt: string;
    updatedAt: string;
    recalled: boolean;
    edited: boolean;
  } | null;
};

type RealtimeHandlers = {
  onEvent: (event: ChatRealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  // Optional: called before each reconnect to get a fresh JWT token
  getAccessToken?: () => string | null;
};

// Exponential backoff delays (ms): 1s → 2s → 4s → 8s → 15s → 30s
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

export class ChatRealtimeClient {
  private readonly client: Client;
  private readonly conversationSubscriptions = new Map<string, StompSubscription>();
  private userQueueSubscription: StompSubscription | null = null;
  private readonly onEvent: (event: ChatRealtimeEvent) => void;
  private readonly onError?: (message: string) => void;
  private readonly getAccessToken?: () => string | null;
  private reconnectAttempt = 0;

  // Track pending conversation IDs for reconnect
  private pendingConversationIds = new Set<string>();

  constructor(accessToken: string, handlers: RealtimeHandlers) {
    this.onEvent = handlers.onEvent;
    this.onError = handlers.onError;
    this.getAccessToken = handlers.getAccessToken;

    // Build WebSocket URL: use VITE_WS_URL if explicitly set,
    // otherwise derive from current page origin so Vite proxy handles it transparently.
    const wsUrl = import.meta.env.VITE_WS_URL ?? (() => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/ws`;
    })();
    log("constructor", `WebSocket URL: ${wsUrl}`);

    this.client = new Client({
      brokerURL: wsUrl,
      // FIXED: Start with 1s reconnect delay; exponential backoff applied via beforeConnect
      reconnectDelay: RECONNECT_DELAYS[0],
      // FIXED: Refresh JWT token and apply exponential backoff before each reconnect attempt
      beforeConnect: async () => {
        // Update delay for next attempt (exponential backoff)
        const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        this.reconnectAttempt++;
        this.client.reconnectDelay = delay;
        log("reconnect", `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

        if (this.getAccessToken) {
          const fresh = this.getAccessToken();
          if (fresh) {
            this.client.connectHeaders = { Authorization: `Bearer ${fresh}` };
            log("reconnect", "Refreshed auth token for reconnect");
          }
        }
      },
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      debug: (str) => {
        if (DEBUG && str.includes(">>>") || str.includes("<<<")) {
          log("stomp", str.slice(0, 100));
        }
      },
      onConnect: () => {
        log("connect", "✅ STOMP CONNECTED");
        this.reconnectAttempt = 0; // Reset on successful connect
        this.subscribeUserQueue();
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
    this.pendingConversationIds.clear();
    this.userQueueSubscription?.unsubscribe();
    this.userQueueSubscription = null;
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
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) {
      // Even if not connected, track the IDs for later
      conversationIds.forEach((id) => this.pendingConversationIds.add(id));
      log("sync", `Queued ${conversationIds.length} conversations (not connected)`);
      return;
    }

    const expected = new Set(conversationIds.filter(Boolean));

    // Unsubscribe from removed conversations
    this.conversationSubscriptions.forEach((subscription, id) => {
      if (!expected.has(id)) {
        subscription.unsubscribe();
        this.conversationSubscriptions.delete(id);
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Subscribe to /user/queue/chat per API spec
    // Receives: CONVERSATION_UPDATED, MESSAGE_DELETED_FOR_ME, READ_RECEIPT
    // ═══════════════════════════════════════════════════════════════════════════
    this.userQueueSubscription?.unsubscribe();
    this.userQueueSubscription = this.client.subscribe(
      "/user/queue/chat",
      (message) => {
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `[user/queue/chat] ${event.eventType}`, {
            conversationId: event.conversationId?.slice(0, 8),
            unreadCount: event.unreadCount,
            totalUnreadCount: event.totalUnreadCount,
          });
          this.onEvent(event);
        } catch {
          this.onError?.("Cannot parse user queue realtime event");
        }
      },
    );
    log("subscribe", "✅ Subscribed to /user/queue/chat");
  }

  publishSend(
    conversationId: string,
    content: string,
    type: "TEXT" | "EMOJI" | "FILE" | "FORWARD" = "TEXT",
    fileUrl: string | null = null,
    fileName: string | null = null,
    clientMessageId: string | null = null,
  ): boolean {
    return this.safePublish("/app/chat.send", {
      conversationId,
      type,
      content,
      fileUrl,
      fileName,
      clientMessageId,
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
}
