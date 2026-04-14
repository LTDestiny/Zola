import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";

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
  lastChangedAt: string;
};

type RealtimeHandlers = {
  onEvent: (event: ChatRealtimeEvent) => void;
  onSyncEvent?: (event: SyncRealtimeEvent) => void;
  onPresenceEvent?: (event: PresenceRealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
};

export class ChatRealtimeClient {
  private readonly client: Client;
  private readonly conversationSubscriptions = new Map<string, StompSubscription>();
  private userQueueSubscription: StompSubscription | null = null;
  private syncQueueSubscription: StompSubscription | null = null;
  private presenceSubscription: StompSubscription | null = null;
  private readonly onEvent: (event: ChatRealtimeEvent) => void;
  private readonly onSyncEvent?: (event: SyncRealtimeEvent) => void;
  private readonly onPresenceEvent?: (event: PresenceRealtimeEvent) => void;
  private readonly onError?: (message: string) => void;

  constructor(accessToken: string, handlers: RealtimeHandlers) {
    this.onEvent = handlers.onEvent;
    this.onSyncEvent = handlers.onSyncEvent;
    this.onPresenceEvent = handlers.onPresenceEvent;
    this.onError = handlers.onError;

    const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:8083/ws";

    this.client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 3000,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      debug: () => undefined,
      onConnect: () => {
        handlers.onConnect?.();
      },
      onDisconnect: () => {
        handlers.onDisconnect?.();
      },
      onStompError: (frame) => {
        handlers.onError?.(frame.headers.message ?? "WebSocket STOMP error");
      },
      onWebSocketError: () => {
        handlers.onError?.("WebSocket connection error");
      },
    });

    this.client.onUnhandledMessage = (_message: IMessage) => undefined;
  }

  connect() {
    this.client.activate();
  }

  disconnect() {
    this.conversationSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.conversationSubscriptions.clear();
    this.userQueueSubscription?.unsubscribe();
    this.syncQueueSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.userQueueSubscription = null;
    this.syncQueueSubscription = null;
    this.presenceSubscription = null;
    this.client.deactivate();
  }

  isConnected() {
    return this.client.connected;
  }

  private safePublish(destination: string, body: unknown): boolean {
    if (!this.client.connected || !this.client.active) {
      return false;
    }
    const webSocket = (
      this.client as unknown as { webSocket?: { readyState?: number } }
    ).webSocket;
    if (webSocket?.readyState !== undefined && webSocket.readyState !== 1) {
      return false;
    }
    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
      return true;
    } catch {
      this.onError?.("Realtime connection is closing or closed");
      return false;
    }
  }

  subscribeConversation(conversationId: string) {
    if (!this.client.connected) {
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
  }

  syncConversationSubscriptions(conversationIds: string[]) {
    if (!this.client.connected) {
      return;
    }

    const expected = new Set(conversationIds.filter(Boolean));

    this.conversationSubscriptions.forEach((subscription, id) => {
      if (!expected.has(id)) {
        subscription.unsubscribe();
        this.conversationSubscriptions.delete(id);
      }
    });

    expected.forEach((id) => {
      this.subscribeConversation(id);
    });
  }

  subscribeUserQueue() {
    if (!this.client.connected) {
      return;
    }
    this.userQueueSubscription?.unsubscribe();
    this.userQueueSubscription = this.client.subscribe(
      "/user/queue/chat",
      (message) => {
        try {
          const event = JSON.parse(message.body) as ChatRealtimeEvent;
          this.onEvent(event);
        } catch {
          this.onError?.("Cannot parse user queue realtime event");
        }
      },
    );

    this.syncQueueSubscription = this.client.subscribe(
      "/user/queue/sync",
      (message) => {
        try {
          const event = JSON.parse(message.body) as SyncRealtimeEvent;
          this.onSyncEvent?.(event);
        } catch {
          this.onError?.("Cannot parse sync realtime event");
        }
      },
    );

    this.presenceSubscription = this.client.subscribe(
      "/topic/presence",
      (message) => {
        try {
          const event = JSON.parse(message.body) as PresenceRealtimeEvent;
          this.onPresenceEvent?.(event);
        } catch {
          this.onError?.("Cannot parse presence realtime event");
        }
      },
    );
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
