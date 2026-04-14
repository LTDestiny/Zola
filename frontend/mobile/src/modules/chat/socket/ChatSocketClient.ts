import Constants from "expo-constants";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { MessageItem } from "@/shared/types/api";

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
  private userQueueSub: StompSubscription | null = null;
  private handlers: Handlers;

  constructor(accessToken: string, handlers: Handlers) {
    this.handlers = handlers;
    const wsUrl =
      (Constants.expoConfig?.extra?.socketUrl as string | undefined) ??
      "ws://192.168.2.93:8083/ws";

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
      debug: () => undefined,
      onConnect: () => this.handlers.onConnect(),
      onDisconnect: () => this.handlers.onDisconnect(),
      onStompError: (frame) => this.handlers.onError(frame.headers.message ?? "STOMP error"),
      onWebSocketError: () => this.handlers.onError("WebSocket error"),
      onWebSocketClose: () => this.handlers.onDisconnect(),
    });
  }

  connect() {
    this.client.activate();
  }

  disconnect() {
    this.conversationSubs.forEach((sub) => sub.unsubscribe());
    this.conversationSubs.clear();
    this.userQueueSub?.unsubscribe();
    this.userQueueSub = null;
    this.client.deactivate();
  }

  subscribeUserQueue() {
    if (!this.client.connected) return;
    this.userQueueSub?.unsubscribe();
    this.userQueueSub = this.client.subscribe("/user/queue/chat", (message) => {
      try {
        this.handlers.onEvent(JSON.parse(message.body) as ChatRealtimeEvent);
      } catch {
        this.handlers.onError("Cannot parse /user/queue/chat payload");
      }
    });
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) return;

    const expected = new Set(conversationIds.filter(Boolean));
    this.conversationSubs.forEach((sub, id) => {
      if (!expected.has(id)) {
        sub.unsubscribe();
        this.conversationSubs.delete(id);
      }
    });

    expected.forEach((id) => {
      if (this.conversationSubs.has(id)) return;
      const sub = this.client.subscribe(`/topic/chat/${id}`, (message) => {
        try {
          this.handlers.onEvent(JSON.parse(message.body) as ChatRealtimeEvent);
        } catch {
          this.handlers.onError("Cannot parse /topic/chat payload");
        }
      });
      this.conversationSubs.set(id, sub);
    });
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
