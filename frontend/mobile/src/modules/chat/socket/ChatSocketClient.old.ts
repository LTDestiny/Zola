import Constants from "expo-constants";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { MessageItem } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY SOCKET CLIENT - WITH DEBUG LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true; // ALWAYS enable for debugging

function log(tag: string, ...args: unknown[]) {
  // Always log to help debug realtime issues
  console.log(`[ChatSocketClient][${tag}]`, ...args);
}

// Verify polyfills are loaded
log("polyfill-check", {
  TextEncoder: typeof TextEncoder !== "undefined",
  TextDecoder: typeof TextDecoder !== "undefined",
  WebSocket: typeof WebSocket !== "undefined",
});

function resolveSocketUrl() {
  const explicit = Constants.expoConfig?.extra?.socketUrl as string | undefined;
  if (explicit) {
    log("url", "Using explicit socketUrl:", explicit);
    return explicit;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    const url = `ws://${host}:8083/ws`;
    log("url", "Using hostUri-based URL:", url);
    return url;
  }

  const fallback = "ws://10.0.2.2:8083/ws";
  log("url", "Using fallback URL:", fallback);
  return fallback;
}

export type ChatRealtimeEvent = {
  eventType:
  | "message:new"
  | "message:seen"
  | "message:typing"
  | "message:recall"
  | "presence:update"
  | "conversation:update"
  | "NEW_MESSAGE"
  | "MESSAGE_SENT"
  | "READ_RECEIPT"
  | "TYPING"
  | "MESSAGE_UPDATED"
  | "MESSAGE_RECALLED"
  | "MESSAGE_DELETED_FOR_ME"
  | "CONVERSATION_UPDATED"
  | "UNREAD_COUNT_UPDATED"
  | "TOTAL_UNREAD_UPDATED";
  conversationId: string;
  actorId?: string;
  typing?: boolean;
  online?: boolean;
  unreadCount?: number | null;
  totalUnreadCount?: number | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  message: (MessageItem & { messageId?: string }) | null;
};

type Handlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (message: string) => void;
  onEvent: (event: ChatRealtimeEvent) => void;
};

export class ChatSocketClient {
  private client: Client;
  private conversationSubs = new Map<string, StompSubscription>();
  private userQueueSubs = new Map<string, StompSubscription>();
  private handlers: Handlers;
  private isConnecting = false;

  private conversationDestinations(conversationId: string) {
    return [
      `/topic/chat.${conversationId}`,
      `/topic/chat/${conversationId}`,
    ];
  }

  constructor(accessToken: string, handlers: Handlers) {
    this.handlers = handlers;
    const wsUrl = resolveSocketUrl();

    log("constructor", "Creating client with URL:", wsUrl);

    this.client = new Client({
      webSocketFactory: () => {
        log("webSocketFactory", "Creating WebSocket...");
        const ws = new WebSocket(wsUrl);
        // Use addEventListener to not be overridden by STOMP client
        ws.addEventListener("open", () => log("ws", "RAW WebSocket opened"));
        ws.addEventListener("close", (e) => log("ws", "RAW WebSocket closed", e.code, e.reason));
        ws.addEventListener("error", (e) => log("ws", "RAW WebSocket error", e));
        ws.addEventListener("message", (e) => {
          const data = e.data;
          const preview = typeof data === "string" 
            ? data.slice(0, 100).replace(/\n/g, "\\n")
            : `[binary ${data?.byteLength ?? 0} bytes]`;
          log("ws", "RAW message:", preview);
        });
        return ws;
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      appendMissingNULLonIncoming: true,
      // Remove forceBinaryWSFrames - may cause issues with some servers
      splitLargeFrames: false,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
        authorization: `Bearer ${accessToken}`,
      },
      debug: (str) => {
        // Log ALL STOMP frames (sanitize tokens)
        const sanitized = str.replace(/Bearer [^\s\n]+/gi, "Bearer ***");
        log("stomp", sanitized);
      },
      onConnect: (frame) => {
        log("onConnect", "STOMP CONNECTED! Frame:", JSON.stringify(frame?.headers ?? {}));
        this.isConnecting = false;
        this.handlers.onConnect();
      },
      onDisconnect: () => {
        log("onDisconnect", "Disconnected from WebSocket");
        this.isConnecting = false;
        this.handlers.onDisconnect();
      },
      onStompError: (frame) => {
        log("onStompError", "STOMP ERROR Frame:", JSON.stringify(frame?.headers ?? {}));
        log("onStompError", "Body:", frame?.body ?? "no body");
        this.isConnecting = false;
        this.handlers.onError(frame.headers.message ?? "STOMP error");
      },
      onWebSocketError: (event) => {
        log("onWebSocketError", "WebSocket error:", JSON.stringify(event));
        this.isConnecting = false;
        this.handlers.onError("WebSocket error");
      },
      onWebSocketClose: (event) => {
        log("onWebSocketClose", `Code=${event.code}, Reason=${event.reason || "n/a"}`);
        this.isConnecting = false;
        this.handlers.onError(
          `WebSocket closed (code=${event.code}, reason=${event.reason || "n/a"})`,
        );
        this.handlers.onDisconnect();
      },
    });
  }

  connect() {
    if (this.isConnecting) {
      log("connect", "Already connecting, skipping");
      return;
    }
    if (this.client.connected) {
      log("connect", "Already connected");
      return;
    }
    log("connect", "Activating client...");
    this.isConnecting = true;
    this.client.activate();
  }

  disconnect() {
    log("disconnect", "Disconnecting...");
    this.conversationSubs.forEach((sub, dest) => {
      log("disconnect", "Unsubscribing from:", dest);
      sub.unsubscribe();
    });
    this.conversationSubs.clear();
    this.userQueueSubs.forEach((sub, dest) => {
      log("disconnect", "Unsubscribing from:", dest);
      sub.unsubscribe();
    });
    this.userQueueSubs.clear();
    this.client.deactivate();
    this.isConnecting = false;
  }

  subscribeUserQueue() {
    if (!this.client.connected) {
      log("subscribeUserQueue", "Not connected, skipping");
      return;
    }

    const userQueueDestinations = [
      "/user/queue/chat",
      "/user/queue/notifications",
      "/user/queue/sync",
    ];

    // Clear existing subscriptions first
    this.userQueueSubs.forEach((sub) => sub.unsubscribe());
    this.userQueueSubs.clear();

    userQueueDestinations.forEach((destination) => {
      log("subscribeUserQueue", "Subscribing to:", destination);
      const sub = this.client.subscribe(destination, (message) => {
        log("rawMessage", `Received from ${destination}, body length: ${message.body?.length ?? 0}`);
        log("rawMessage", `Headers:`, JSON.stringify(message.headers ?? {}));
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `Received from ${destination}:`, event.eventType, event.conversationId);
          this.handlers.onEvent(event);
        } catch (error) {
          log("event", `Parse error for ${destination}:`, error);
          this.handlers.onError(`Cannot parse ${destination} payload`);
        }
      });

      this.userQueueSubs.set(destination, sub);
    });

    log("subscribeUserQueue", "Subscribed to", userQueueDestinations.length, "user queues");
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) {
      log("syncSubs", "Not connected, skipping");
      return;
    }

    const uniqueConversationIds = [...new Set(
      conversationIds
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    )];

    const expectedDestinations = new Set(
      uniqueConversationIds.flatMap((id) => this.conversationDestinations(id)),
    );

    // Unsubscribe from destinations no longer needed
    const toRemove: string[] = [];
    this.conversationSubs.forEach((sub, destination) => {
      if (!expectedDestinations.has(destination)) {
        log("syncSubs", "Unsubscribing from:", destination);
        sub.unsubscribe();
        toRemove.push(destination);
      }
    });
    toRemove.forEach((dest) => this.conversationSubs.delete(dest));

    // Subscribe to new destinations
    let newSubs = 0;
    expectedDestinations.forEach((destination) => {
      if (this.conversationSubs.has(destination)) {
        return;
      }

      const sub = this.client.subscribe(destination, (message) => {
        log("rawMessage", `Received from ${destination}, body length: ${message.body?.length ?? 0}`);
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          log("event", `Received from ${destination}:`, event.eventType);
          this.handlers.onEvent(event);
        } catch (error) {
          log("event", `Parse error for ${destination}:`, error);
          this.handlers.onError(`Cannot parse ${destination} payload`);
        }
      });

      this.conversationSubs.set(destination, sub);
      newSubs++;
    });

    log("syncSubs", `Synced: ${newSubs} new, ${toRemove.length} removed, ${this.conversationSubs.size} total`);
  }

  subscribeConversation(conversationId: string) {
    if (!this.client.connected) {
      log("subscribeSingle", "Not connected, skipping");
      return;
    }
    if (!conversationId) {
      log("subscribeSingle", "No conversationId provided");
      return;
    }

    const currentConversationIds = new Set<string>();
    this.conversationSubs.forEach((_sub, destination) => {
      const dotPrefix = "/topic/chat.";
      const slashPrefix = "/topic/chat/";
      if (destination.startsWith(dotPrefix)) {
        currentConversationIds.add(destination.slice(dotPrefix.length));
      } else if (destination.startsWith(slashPrefix)) {
        currentConversationIds.add(destination.slice(slashPrefix.length));
      }
    });

    currentConversationIds.add(conversationId);
    log("subscribeSingle", "Adding conversation:", conversationId);
    this.syncConversationSubscriptions([...currentConversationIds]);
  }

  publishTyping(conversationId: string, typing: boolean) {
    if (!this.client.connected) {
      log("publishTyping", "Not connected");
      return false;
    }
    log("publishTyping", conversationId, typing);
    this.client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ conversationId, typing }),
    });
    return true;
  }

  publishRead(conversationId: string, messageId: string) {
    if (!this.client.connected) {
      log("publishRead", "Not connected");
      return false;
    }
    log("publishRead", conversationId, messageId);
    this.client.publish({
      destination: "/app/chat.read",
      body: JSON.stringify({ conversationId, messageId }),
    });
    return true;
  }

  isConnected() {
    return this.client.connected;
  }
}
