import Constants from "expo-constants";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { MessageItem } from "@/shared/types/api";

function resolveSocketUrl() {
  const explicit = Constants.expoConfig?.extra?.socketUrl as string | undefined;
  if (explicit) {
    return explicit;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    return `ws://${host}:8083/ws`;
  }

  return "ws://10.0.2.2:8083/ws";
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

  private conversationDestinations(conversationId: string) {
    return [
      `/topic/chat.${conversationId}`,
      `/topic/chat/${conversationId}`,
    ];
  }

  constructor(accessToken: string, handlers: Handlers) {
    this.handlers = handlers;
    const wsUrl = resolveSocketUrl();

    this.client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      appendMissingNULLonIncoming: true,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
        authorization: `Bearer ${accessToken}`,
      },
      debug: () => {
        // Keep STOMP debug noise off by default (tokens are never logged here).
        // Turn on when diagnosing connection issues.
        return undefined;
      },
      onConnect: () => this.handlers.onConnect(),
      onDisconnect: () => this.handlers.onDisconnect(),
      onStompError: (frame) =>
        this.handlers.onError(frame.headers.message ?? "STOMP error"),
      onWebSocketError: () => this.handlers.onError("WebSocket error"),
      onWebSocketClose: (event) => {
        this.handlers.onError(
          `WebSocket closed (code=${event.code}, reason=${event.reason || "n/a"})`,
        );
        this.handlers.onDisconnect();
      },
    });
  }

  connect() {
    this.client.activate();
  }

  disconnect() {
    this.conversationSubs.forEach((sub) => sub.unsubscribe());
    this.conversationSubs.clear();
    this.userQueueSubs.forEach((sub) => sub.unsubscribe());
    this.userQueueSubs.clear();
    this.client.deactivate();
  }

  subscribeUserQueue() {
    if (!this.client.connected) return;
    const userQueueDestinations = [
      "/user/queue/chat",
      "/user/queue/notifications",
      "/user/queue/sync",
    ];

    this.userQueueSubs.forEach((sub) => sub.unsubscribe());
    this.userQueueSubs.clear();

    userQueueDestinations.forEach((destination) => {
      const sub = this.client.subscribe(destination, (message) => {
        try {
          this.handlers.onEvent(JSON.parse(message.body) as ChatRealtimeEvent);
        } catch {
          this.handlers.onError(`Cannot parse ${destination} payload`);
        }
      });

      this.userQueueSubs.set(destination, sub);
    });
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) return;

    const uniqueConversationIds = [...new Set(
      conversationIds
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    )];

    const expectedDestinations = new Set(
      uniqueConversationIds.flatMap((id) => this.conversationDestinations(id)),
    );

    this.conversationSubs.forEach((sub, destination) => {
      if (!expectedDestinations.has(destination)) {
        sub.unsubscribe();
        this.conversationSubs.delete(destination);
      }
    });

    expectedDestinations.forEach((destination) => {
      if (this.conversationSubs.has(destination)) {
        return;
      }

      const sub = this.client.subscribe(destination, (message) => {
        try {
          this.handlers.onEvent(JSON.parse(message.body) as ChatRealtimeEvent);
        } catch {
          this.handlers.onError(`Cannot parse ${destination} payload`);
        }
      });

      this.conversationSubs.set(destination, sub);
    });
  }

  subscribeConversation(conversationId: string) {
    if (!this.client.connected) return;
    if (!conversationId) return;

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
    this.syncConversationSubscriptions([...currentConversationIds]);
  }

  publishTyping(conversationId: string, typing: boolean) {
    if (!this.client.connected) return false;
    this.client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ conversationId, typing }),
    });
    return true;
  }

  publishRead(conversationId: string, messageId: string) {
    if (!this.client.connected) return false;
    this.client.publish({
      destination: "/app/chat.read",
      body: JSON.stringify({ conversationId, messageId }),
    });
    return true;
  }
}
