import Constants from "expo-constants";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { AppState } from "react-native";
import { useAuthStore } from "@/modules/auth/authStore";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT 1-1 REALTIME SERVICE (Mobile) - Following API Spec
// 
// Based on: CHAT_1_1_FRONTEND_API.md
// 
// TWO EVENT FLOWS (per backend):
// 1. Inside conversation screen:
//    - Subscribe: /topic/chat/{conversationId} (✅ slash format)
//    - Receives: MESSAGE_SENT event
//    
// 2. Outside conversation (chat list):
//    - Subscribe: /user/queue/chat (✅ /user prefix required)
//    - Receives: CONVERSATION_UPDATED event with unreadCount, lastMessage
//    
// Publish destinations: /app/chat.send, /app/chat.typing, /app/chat.read, etc.
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true;
const log = (tag: string, ...args: any[]) => {
    if (DEBUG) {
        console.log(`[socketService][${tag}]`, ...args);
    }
};

export type SocketState =
    | "DISCONNECTED"
    | "CONNECTING"
    | "CONNECTED"
    | "RECONNECTING";

class SocketService {
    private client: Client | null = null;
    private token: string | null = null;

    private state: SocketState = "DISCONNECTED";

    private stateListeners = new Set<(state: SocketState) => void>();
    private listeners = new Set<(e: any) => void>();

    private subs = new Map<string, StompSubscription>();

    private reconnectTimer: any = null;

    private shouldReconnect = true;

    // 🔥 FIX: Track pending conversations for reconnect
    private pendingConversationIds: string[] = [];

    // ✅ FIX Bug #14: Reconnect backoff counter
    private reconnectAttempt = 0;
    private readonly RECONNECT_DELAYS = [1000, 2000, 3000, 5000, 10000, 30000];

    constructor() {
        AppState.addEventListener("change", (next) => {
            if (next === "active") {
                // Reconnect when app comes to foreground
                if (!this.isConnected() && this.token) {
                    this.forceReconnect();
                }
            } else if (next === "background" || next === "inactive") {
                // ✅ FIX Bug #13: Disconnect when app goes to background to save battery
                log("appState", "App backgrounded, disconnecting socket to save battery");
                this.disconnect();
            }
        });
    }

    private url() {
        const explicit = Constants.expoConfig?.extra?.socketUrl;
        if (explicit) return explicit;

        const hostUri = Constants.expoConfig?.hostUri;
        if (!hostUri) throw new Error("Missing hostUri");

        const host = hostUri.split(":")[0];
        return `ws://${host}:8083/ws`;
    }

    isConnected() {
        return this.client?.connected === true;
    }

    getState(): SocketState {
        return this.state;
    }

    private setState(newState: SocketState) {
        if (this.state !== newState) {
            log("stateChange", newState);
            this.state = newState;
            this.stateListeners.forEach((l) => l(newState));
        }
    }

    connect(token: string) {
        if (this.isConnected()) return;

        log("connect", `Connecting to ${this.url()}`);
        this.token = token;
        this.shouldReconnect = true;

        this.cleanup();

        this.state = "CONNECTING";

        this.client = new Client({
            reconnectDelay: 0,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,

            // ✅ FIX Bug #1: Refresh token before reconnect to prevent infinite loop
            beforeConnect: async () => {
                const currentToken = this.token;
                const authState = useAuthStore.getState();

                // Try to get fresh token if current one might be expired
                if (currentToken && authState.accessToken) {
                    const freshToken = authState.accessToken;
                    if (freshToken && freshToken !== currentToken) {
                        log("reconnect", "Refreshed token before reconnect");
                        this.token = freshToken;
                        if (this.client) {
                            this.client.connectHeaders = {
                                Authorization: `Bearer ${freshToken}`,
                            };
                        }
                    }
                }
            },

            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },

            webSocketFactory: () =>
                new WebSocket(this.url()),

            onConnect: () => {
                log("connect", "✅ STOMP CONNECTED");
                // ✅ Reset reconnect counter on successful connection
                this.reconnectAttempt = 0;
                this.setState("CONNECTED");

                // notify hook
                this.emit({ type: "SOCKET_CONNECTED" });

                this.resubscribe();
            },

            onDisconnect: () => this.scheduleReconnect(),
            onStompError: () => this.scheduleReconnect(),
            onWebSocketClose: () => this.scheduleReconnect(),
            onWebSocketError: () => this.scheduleReconnect(),
        });

        this.client.activate();
    }

    private emit(event: any) {
        this.listeners.forEach((l) => l(event));
    }

    private scheduleReconnect() {
        if (!this.shouldReconnect || !this.token) return;

        clearTimeout(this.reconnectTimer);

        this.setState("RECONNECTING");

        // ✅ FIX: Exponential backoff on reconnect
        const delay = this.RECONNECT_DELAYS[
            Math.min(this.reconnectAttempt, this.RECONNECT_DELAYS.length - 1)
        ];
        this.reconnectAttempt++;
        log("reconnect", `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect(this.token!);
        }, delay);
    }

    forceReconnect() {
        if (!this.token) return;
        // ✅ FIX Bug #14: Reset reconnect attempt counter on manual reconnect
        this.reconnectAttempt = 0;
        this.cleanup();
        const freshToken = useAuthStore.getState().accessToken ?? this.token;
        this.connect(freshToken);
    }

    disconnect() {
        this.shouldReconnect = false;
        this.cleanup();
        this.setState("DISCONNECTED");
    }

    private cleanup() {
        this.subs.forEach((s) => {
            try {
                s.unsubscribe();
            } catch { }
        });

        this.subs.clear();

        if (this.client) {
            try {
                this.client.deactivate();
            } catch { }
            this.client = null;
        }
    }

    // 🔥 CORE FIX: SINGLE SOURCE SUBSCRIPTION SYNC
    syncConversationSubscriptions(ids: string[]) {
        log("sync", `Syncing ${ids.length} conversations`, ids.map(id => id.slice(0, 8)));

        // 🔥 FIX: Always track pending conversations even when not connected
        this.pendingConversationIds = ids;

        if (!this.client?.connected) {
            log("sync", "⚠️ Not connected, queuing conversations for later subscription");
            return;
        }

        const target = new Set(ids);

        // unsubscribe old rooms
        for (const [dest, sub] of this.subs) {
            if (dest === "/user/queue/chat") continue;

            const id = dest.split("/").pop();
            if (!id || !target.has(id)) {
                try {
                    sub.unsubscribe();
                } catch { }
                this.subs.delete(dest);
            }
        }

        // subscribe new rooms
        for (const id of ids) {
            const dest = `/topic/chat/${id}`; // ✅ Slash format - receives MESSAGE_SENT

            if (this.subs.has(dest)) continue;

            log("subscribe", `✅ Subscribing to conversation: ${dest}`);
            const sub = this.client.subscribe(dest, (msg) =>
                this.handle(msg, dest)
            );

            this.subs.set(dest, sub);
        }

        // always ensure user queue exists for CONVERSATION_UPDATED events
        if (!this.subs.has("/user/queue/chat")) {
            log("subscribe", "✅ Subscribing to user queue: /user/queue/chat");
            const sub = this.client.subscribe("/user/queue/chat", (msg) => // ✅ /user prefix
                this.handle(msg, "/user/queue/chat")
            );

            this.subs.set("/user/queue/chat", sub);
        }

        log("sync", `📊 Active subscriptions: ${Array.from(this.subs.keys()).join(", ")}`);
    }

    private resubscribe() {
        if (!this.client) return;

        log("resubscribe", "Re-subscribing to conversations and user queue on reconnect");

        // ✅ FIX Bug #3: Subscribe to conversations FIRST, then user queue
        // This prevents message loss during subscription window

        // 1. Re-subscribe to all conversations that were pending
        if (this.pendingConversationIds.length > 0) {
            log("resubscribe", `Re-subscribing to ${this.pendingConversationIds.length} conversations`);
            this.syncConversationSubscriptions(this.pendingConversationIds);
        }

        // 2. THEN subscribe to user queue (after topics are ready)
        if (!this.subs.has("/user/queue/chat")) {
            log("subscribe", "✅ Subscribing to user queue (reconnect): /user/queue/chat");
            const sub = this.client.subscribe(
                "/user/queue/chat",
                (msg) => this.handle(msg, "/user/queue/chat")
            );

            this.subs.set("/user/queue/chat", sub);
        }
    }

    private handle(msg: IMessage, destination?: string) {
        try {
            const data = JSON.parse(msg.body);
            const eventType = data.eventType || "UNKNOWN";
            const convId = data.conversationId?.slice(0, 8) || "none";

            log("event", `📨 [${destination || msg.headers.destination}] ${eventType} (conv: ${convId})`, {
                eventType,
                conversationId: data.conversationId,
                hasMessage: !!data.message,
                unreadCount: data.unreadCount,
                totalUnreadCount: data.totalUnreadCount
            });

            this.listeners.forEach((l) => l(data));
        } catch (err) {
            log("error", "Failed to parse message", err);
        }
    }

    addListener(fn: (e: any) => void) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    addStateListener(fn: (state: SocketState) => void) {
        this.stateListeners.add(fn);
        return () => this.stateListeners.delete(fn);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLISH METHODS - Per API Spec
    // ═══════════════════════════════════════════════════════════════════════════

    private safePublish(destination: string, body: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client?.connected) {
                reject(new Error("Socket not connected"));
                return;
            }

            try {
                this.client.publish({
                    destination,
                    body: JSON.stringify(body),
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async publishSend(
        conversationId: string,
        content: string,
        type: "TEXT" | "EMOJI" | "FILE" | "FORWARD" = "TEXT",
        fileUrl: string | null = null,
        fileName: string | null = null,
        clientMessageId: string | null = null,
    ): Promise<void> {
        return this.safePublish("/app/chat.send", {
            conversationId,
            type,
            content,
            fileUrl,
            fileName,
            clientMessageId,
        });
    }

    async publishTyping(conversationId: string, typing: boolean): Promise<void> {
        return this.safePublish("/app/chat.typing", {
            conversationId,
            typing,
        });
    }

    async publishRead(conversationId: string, messageId: string): Promise<void> {
        return this.safePublish("/app/chat.read", {
            conversationId,
            messageId,
        });
    }

    async publishRecall(conversationId: string, messageId: string): Promise<void> {
        return this.safePublish("/app/chat.recall", {
            conversationId,
            messageId,
        });
    }

    async publishEdit(conversationId: string, messageId: string, content: string): Promise<void> {
        return this.safePublish("/app/chat.edit", {
            conversationId,
            messageId,
            content,
        });
    }

    async publishDeleteForMe(conversationId: string, messageId: string): Promise<void> {
        return this.safePublish("/app/chat.delete-for-me", {
            conversationId,
            messageId,
        });
    }

    async publishForward(
        sourceConversationId: string,
        messageId: string,
        targetConversationId: string,
    ): Promise<void> {
        return this.safePublish("/app/chat.forward", {
            sourceConversationId,
            messageId,
            targetConversationId,
        });
    }

    async publishReact(
        conversationId: string,
        messageId: string,
        emoji: string,
        remove = false,
    ): Promise<void> {
        return this.safePublish("/app/chat.react", {
            conversationId,
            messageId,
            emoji,
            remove,
        });
    }

    // Legacy publish method - use specific methods above
    publish(dest: string, body: any) {
        if (!this.client?.connected) return;

        this.client.publish({
            destination: dest,
            body: JSON.stringify(body),
        });
    }
}

export const socketService = new SocketService();