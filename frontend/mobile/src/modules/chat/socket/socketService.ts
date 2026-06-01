import Constants from "expo-constants";
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { AppState, type AppStateStatus } from "react-native";
import type { ConversationItem, MessageItem } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY SOCKET SERVICE - SINGLETON
// Features:
// - State machine: DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING
// - Auto-reconnect with exponential backoff
// - Event queue for messages sent while disconnected
// - waitForConnection() promise for typing events
// - AppState handling (foreground/background)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
    if (DEBUG) {
        console.log(`[socketService][${tag}]`, ...args);
    }
}

// Verify polyfills are loaded (critical for React Native STOMP)
log("polyfill-check", {
    TextEncoder: typeof TextEncoder !== "undefined",
    TextDecoder: typeof TextDecoder !== "undefined",
    WebSocket: typeof WebSocket !== "undefined",
});

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export type SocketState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

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
    | "GROUP_CREATED"
    | "NEW_GROUP_MESSAGE"
    | "USER_TYPING_GROUP"
    | "MESSAGE_REPLIED"
    | "group_created"
    | "new_group_message"
    | "user_typing_group"
    | "message_replied"
    | "CONVERSATION_UPDATED"
    | "UNREAD_COUNT_UPDATED"
    | "TOTAL_UNREAD_UPDATED"
    | "conversation:pinned"
    | "conversation:unpinned"
    | "CONVERSATION_PINNED"
    | "CONVERSATION_UNPINNED"
    | "PRESENCE_UPDATED"
    | "USER_LAST_SEEN_UPDATE"
    | "FRIENDSHIP_REQUEST_RECEIVED"
    | "FRIENDSHIP_REQUEST_ACCEPTED"
    | "FRIENDSHIP_REQUEST_DECLINED"
    | "FRIENDSHIP_REQUEST_SENT"
    | "FRIENDSHIP_REQUEST_CANCELLED"
    | "FRIENDSHIP_REQUEST_REJECTED"
    | "FRIENDSHIP_REMOVED"
    | "USER_BLOCKED"
    | "USER_UNBLOCKED"
    | "CALL_INCOMING"
    | "CALL_CANCELLED"
    | "CALL_ACCEPTED"
    | "CALL_REJECTED"
    | "CALL_ENDED"
    | "friend_request_sent"
    | "friend_request_cancelled"
    | "friend_request_received"
    | "friend_request_accepted"
    | "friend_request_rejected"
    | "user_blocked"
    | "user_unblocked"
    | "friendship_removed"
    | "call_incoming"
    | "call_cancelled"
    | "call_accepted"
    | "call_rejected"
    | "call_ended";
    conversationId: string;
    actorId?: string;
    targetId?: string;
    targetUserId?: string;
    typing?: boolean;
    online?: boolean;
    unreadCount?: number | null;
    totalUnreadCount?: number | null;
    lastMessage?: string | null;
    lastMessageAt?: string | null;
    conversation?: ConversationItem | null;
    message: (MessageItem & { messageId?: string }) | null;
    // Presence fields
    userId?: string;
    lastSeenAt?: string | null;
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

type QueuedEvent = {
    destination: string;
    body: string;
    timestamp: number;
};

type EventListener = (event: ChatRealtimeEvent) => void;
type CallEventListener = (event: CallRealtimeEvent) => void;
type StateListener = (state: SocketState) => void;

// ─── SOCKET URL RESOLVER ───────────────────────────────────────────────────────

function resolveSocketUrl(): string {
    const explicit = Constants.expoConfig?.extra?.socketUrl as string | undefined;
    if (explicit && explicit !== "ws://172.20.10.2:8083/ws") {
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

// ─── RECONNECT DELAYS ──────────────────────────────────────────────────────────

const RECONNECT_DELAYS = [500, 1000, 2000, 5000, 10000, 30000]; // ms - faster initial reconnect
const MAX_QUEUE_SIZE = 50;
const QUEUE_MAX_AGE_MS = 30000; // Drop queued events older than 30s
const CONNECT_TIMEOUT_MS = 8000; // 8s timeout for STOMP CONNECTED
const TYPING_WAIT_TIMEOUT_MS = 3000; // 3s timeout for typing wait

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class SocketService {
    private static instance: SocketService | null = null;

    private client: Client | null = null;
    private accessToken: string | null = null;
    private state: SocketState = "DISCONNECTED";
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    // Subscriptions - FIXED: Use Maps for proper tracking
    private conversationSubs = new Map<string, StompSubscription>();
    private callTopicSubs = new Map<string, StompSubscription>();
    private userQueueSubs = new Map<string, StompSubscription>(); // FIXED: was single sub, now Map
    private presenceSub: StompSubscription | null = null; // Global presence subscription
    private callQueueSub: StompSubscription | null = null;
    private globalCallTopicSub: StompSubscription | null = null;
    private pendingConversationIds = new Set<string>(); // FIXED: renamed, NOT cleared on cleanup

    // Event queue
    private eventQueue: QueuedEvent[] = [];

    // Listeners
    private eventListeners = new Set<EventListener>();
    private callEventListeners = new Set<CallEventListener>();
    private stateListeners = new Set<StateListener>();

    // Connection waiters
    private connectionWaiters: Array<{
        resolve: () => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }> = [];

    // AppState
    private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
    private lastAppState: AppStateStatus = AppState.currentState;

    private constructor() {
        log("constructor", "SocketService created");
        this.setupAppStateListener();
    }

    static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    // ─── STATE MANAGEMENT ────────────────────────────────────────────────────────

    private setState(newState: SocketState) {
        if (this.state !== newState) {
            log("state", `${this.state} → ${newState}`);
            this.state = newState;
            this.stateListeners.forEach((listener) => listener(newState));

            // Resolve waiters when connected
            if (newState === "CONNECTED") {
                this.resolveAllWaiters();
                this.flushQueue();
            }
        }
    }

    getState(): SocketState {
        return this.state;
    }

    isConnected(): boolean {
        return this.state === "CONNECTED" && this.client?.connected === true;
    }

    // ─── LISTENERS ───────────────────────────────────────────────────────────────

    addEventListener(listener: EventListener): () => void {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }

    addStateListener(listener: StateListener): () => void {
        this.stateListeners.add(listener);
        // Immediately notify of current state
        listener(this.state);
        return () => this.stateListeners.delete(listener);
    }

    addCallListener(listener: CallEventListener): () => void {
        this.callEventListeners.add(listener);
        return () => this.callEventListeners.delete(listener);
    }

    private emitEvent(event: ChatRealtimeEvent) {
        this.eventListeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                log("emit-error", "Listener threw:", error);
            }
        });
    }

    private emitCallEvent(event: CallRealtimeEvent) {
        this.callEventListeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                log("emit-call-error", "Listener threw:", error);
            }
        });
    }

    // ─── CONNECTION WAITERS ──────────────────────────────────────────────────────

    waitForConnection(timeoutMs = 5000): Promise<void> {
        if (this.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const index = this.connectionWaiters.findIndex((w) => w.timer === timer);
                if (index !== -1) {
                    this.connectionWaiters.splice(index, 1);
                }
                reject(new Error("Connection timeout"));
            }, timeoutMs);

            this.connectionWaiters.push({ resolve, reject, timer });

            // Start connecting if not already
            if (this.state === "DISCONNECTED" && this.accessToken) {
                this.connect(this.accessToken);
            }
        });
    }

    private resolveAllWaiters() {
        const waiters = [...this.connectionWaiters];
        this.connectionWaiters = [];
        waiters.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve();
        });
        log("waiters", `Resolved ${waiters.length} waiters`);
    }

    private rejectAllWaiters(error: Error) {
        const waiters = [...this.connectionWaiters];
        this.connectionWaiters = [];
        waiters.forEach(({ reject, timer }) => {
            clearTimeout(timer);
            reject(error);
        });
    }

    // ─── EVENT QUEUE ─────────────────────────────────────────────────────────────

    private queueEvent(destination: string, body: string) {
        // Remove old events
        const now = Date.now();
        this.eventQueue = this.eventQueue.filter(
            (e) => now - e.timestamp < QUEUE_MAX_AGE_MS
        );

        // Limit queue size
        if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
            this.eventQueue.shift();
            log("queue", "Queue full, dropped oldest event");
        }

        this.eventQueue.push({ destination, body, timestamp: now });
        log("queue", `Queued event to ${destination}, queue size: ${this.eventQueue.length}`);
    }

    private flushQueue() {
        if (!this.isConnected() || this.eventQueue.length === 0) return;

        const now = Date.now();
        const validEvents = this.eventQueue.filter(
            (e) => now - e.timestamp < QUEUE_MAX_AGE_MS
        );
        this.eventQueue = [];

        log("queue", `Flushing ${validEvents.length} queued events`);

        validEvents.forEach((event) => {
            try {
                this.client?.publish({
                    destination: event.destination,
                    body: event.body,
                });
                log("queue", `Flushed: ${event.destination}`);
            } catch (error) {
                log("queue-error", "Failed to flush:", error);
            }
        });
    }

    // ─── APP STATE ───────────────────────────────────────────────────────────────

    private setupAppStateListener() {
        this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
            const wasBackground = this.lastAppState.match(/inactive|background/);
            const isNowForeground = nextState === "active";

            log("appstate", `${this.lastAppState} → ${nextState}`);
            this.lastAppState = nextState;

            if (wasBackground && isNowForeground) {
                log("appstate", "App returned to foreground");
                if (!this.isConnected() && this.accessToken) {
                    log("appstate", "Reconnecting...");
                    this.connect(this.accessToken);
                }
            }
        });
    }

    // ─── CONNECT ─────────────────────────────────────────────────────────────────

    connect(accessToken: string) {
        log("connect", `Called with token length=${accessToken?.length}, state=${this.state}`);

        if (this.state === "CONNECTING" || this.state === "RECONNECTING") {
            log("connect", "Already connecting, skipping");
            return;
        }

        if (this.isConnected() && this.accessToken === accessToken) {
            log("connect", "Already connected with same token");
            return;
        }

        // Store token for reconnects
        this.accessToken = accessToken;

        // Disconnect existing client if any
        if (this.client) {
            this.cleanupClient();
        }

        this.setState("CONNECTING");
        this.createClient(accessToken);

        // Set connection timeout - if CONNECTED not received in 10s, retry
        this.clearConnectTimeout();
        this.connectTimeoutTimer = setTimeout(() => {
            if (this.state === "CONNECTING") {
                log("connect-timeout", "STOMP CONNECTED not received in 10s, retrying...");
                this.cleanupClient();
                this.setState("DISCONNECTED");
                this.scheduleReconnect();
            }
        }, CONNECT_TIMEOUT_MS);

        this.client?.activate();
        log("connect", "Activating client...");
    }

    private clearConnectTimeout() {
        if (this.connectTimeoutTimer) {
            clearTimeout(this.connectTimeoutTimer);
            this.connectTimeoutTimer = null;
        }
    }

    private createClient(accessToken: string) {
        const wsUrl = resolveSocketUrl();
        log("createClient", `Creating STOMP client with URL: ${wsUrl}`);

        this.client = new Client({
            webSocketFactory: () => {
                log("ws-factory", `Creating WebSocket to ${wsUrl}...`);
                const ws = new WebSocket(wsUrl);

                // ⚠️ CRITICAL: Force text mode for React Native STOMP compatibility
                // React Native WebSocket may default to blob/arraybuffer which STOMP can't parse
                try {
                    if ("binaryType" in ws) {
                        (ws as unknown as { binaryType: string }).binaryType = "text";
                    }
                } catch {
                    log("ws-factory", "Could not set binaryType=text");
                }

                ws.addEventListener("open", () => {
                    log("ws", "WebSocket OPEN - TCP connection established");
                });

                ws.addEventListener("message", (event) => {
                    // Log frame type for debugging
                    const data = event.data;
                    if (typeof data === "string") {
                        const preview = data.slice(0, 80).replace(/\n/g, "\\n");
                        log("ws-recv", `String (${data.length}): ${preview}`);
                    } else if (data instanceof ArrayBuffer) {
                        log("ws-recv", `ArrayBuffer: ${data.byteLength} bytes - decoding...`);
                        try {
                            const text = new TextDecoder().decode(data);
                            log("ws-recv-decoded", text.slice(0, 80).replace(/\n/g, "\\n"));
                        } catch {
                            log("ws-recv", "Failed to decode ArrayBuffer");
                        }
                    } else if (data && typeof data === "object" && "size" in data) {
                        // Blob
                        log("ws-recv", `Blob: ${(data as Blob).size} bytes - converting...`);
                        (data as Blob).text().then((text) => {
                            log("ws-recv-blob", text.slice(0, 80).replace(/\n/g, "\\n"));
                        });
                    }
                });

                ws.addEventListener("close", (e) => {
                    log("ws", `WebSocket CLOSED: code=${e.code} reason="${e.reason || "none"}"`);
                });

                ws.addEventListener("error", (e) => {
                    log("ws", "WebSocket ERROR:", e);
                });

                return ws;
            },
            reconnectDelay: 0, // We handle reconnect ourselves
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            appendMissingNULLonIncoming: true,
            splitLargeFrames: false,
            // Force text frames (important for React Native)
            forceBinaryWSFrames: false,
            connectHeaders: {
                Authorization: `Bearer ${accessToken}`,
                authorization: `Bearer ${accessToken}`,
            },
            debug: (str) => {
                // Log ALL STOMP debug messages
                const sanitized = str.replace(/Bearer [^\s\n]+/gi, "Bearer ***");
                log("stomp-debug", sanitized.slice(0, 300).replace(/\n/g, "\\n"));
            },
            onConnect: (frame) => {
                log("onConnect", "STOMP onConnect callback fired!", JSON.stringify(frame?.headers || {}));
                this.handleConnect();
            },
            onDisconnect: (frame) => {
                log("onDisconnect", "STOMP onDisconnect callback fired");
                this.handleDisconnect();
            },
            onStompError: (frame) => {
                log("onStompError", "STOMP ERROR:", frame?.headers?.message, frame?.body);
                this.handleStompError(frame);
            },
            onWebSocketError: (event) => {
                log("onWebSocketError", "WebSocket error event");
                this.handleWebSocketError();
            },
            onWebSocketClose: (event) => {
                log("onWebSocketClose", `WebSocket close event: ${event.code}`);
                this.handleWebSocketClose(event);
            },
        });
    }

    // ─── CONNECTION HANDLERS ─────────────────────────────────────────────────────

    private handleConnect() {
        log("connected", "✅ STOMP CONNECTED! Clearing timeout...");
        this.clearConnectTimeout();
        this.reconnectAttempt = 0;
        this.setState("CONNECTED");

        // Subscribe to user queues FIRST (critical for receiving messages)
        this.subscribeUserQueue();

        // Re-subscribe to all pending conversations
        // FIXED: pendingConversationIds is NOT cleared on disconnect, so we always have them
        if (this.pendingConversationIds.size > 0) {
            log("connected", `Re-subscribing to ${this.pendingConversationIds.size} conversations...`);
            this.resubscribeAll();
        } else {
            log("connected", "No conversations to subscribe to yet");
        }
    }

    private handleDisconnect() {
        log("disconnected", "STOMP disconnected");
        this.clearConnectTimeout();
        this.setState("DISCONNECTED");
        this.scheduleReconnect();
    }

    private handleStompError(frame: { headers: { message?: string }; body?: string }) {
        log("stomp-error", "STOMP ERROR:", frame.headers.message, frame.body);
        this.clearConnectTimeout();
        this.setState("DISCONNECTED");
        this.scheduleReconnect();
    }

    private handleWebSocketError() {
        log("ws-error", "WebSocket error");
        this.clearConnectTimeout();
        if (this.state === "CONNECTING") {
            this.setState("DISCONNECTED");
            this.scheduleReconnect();
        }
    }

    private handleWebSocketClose(event: CloseEvent) {
        log("ws-close", `Code=${event.code}, Reason=${event.reason || "n/a"}`);
        this.clearConnectTimeout();
        if (this.state !== "DISCONNECTED") {
            this.setState("DISCONNECTED");
            this.scheduleReconnect();
        }
    }

    // ─── RECONNECT ───────────────────────────────────────────────────────────────

    private scheduleReconnect() {
        if (!this.accessToken) {
            log("reconnect", "No token, not reconnecting");
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        this.reconnectAttempt++;

        log("reconnect", `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);
        this.setState("RECONNECTING");

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.accessToken && this.state === "RECONNECTING") {
                log("reconnect", "Attempting reconnect...");
                this.connect(this.accessToken);
            }
        }, delay);
    }

    // Force immediate reconnect (useful when user takes action requiring connection)
    forceReconnect() {
        if (!this.accessToken) {
            log("forceReconnect", "No token");
            return;
        }

        log("forceReconnect", "Forcing immediate reconnect...");

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.cleanupClient();
        this.reconnectAttempt = 0;
        this.setState("DISCONNECTED");
        this.connect(this.accessToken);
    }

    // ─── DISCONNECT ──────────────────────────────────────────────────────────────

    disconnect() {
        log("disconnect", "Disconnecting...");

        this.clearConnectTimeout();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.rejectAllWaiters(new Error("Disconnected"));
        this.cleanupClient();
        this.accessToken = null;
        this.setState("DISCONNECTED");
    }

    private cleanupClient() {
        log("cleanup", "Cleaning up client connections...");

        // Unsubscribe all conversation subscriptions
        this.conversationSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.conversationSubs.clear();
        this.callTopicSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.callTopicSubs.clear();
        // CRITICAL FIX: Do NOT clear pendingConversationIds!
        // We need to keep track of which conversations to re-subscribe after reconnect

        // Unsubscribe user queues
        this.userQueueSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.userQueueSubs.clear();

        // Unsubscribe presence
        if (this.presenceSub) {
            try { this.presenceSub.unsubscribe(); } catch { /* ignore */ }
            this.presenceSub = null;
        }

        if (this.callQueueSub) {
            try { this.callQueueSub.unsubscribe(); } catch { /* ignore */ }
            this.callQueueSub = null;
        }

        if (this.globalCallTopicSub) {
            try { this.globalCallTopicSub.unsubscribe(); } catch { /* ignore */ }
            this.globalCallTopicSub = null;
        }

        if (this.client) {
            try {
                this.client.deactivate();
            } catch {
                // Ignore
            }
            this.client = null;
        }

        log("cleanup", `Cleanup done. ${this.pendingConversationIds.size} conversations pending for re-subscribe`);
    }

    // ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────

    private subscribeUserQueue() {
        if (!this.client?.connected) {
            log("subscribe", "Cannot subscribe user queue - not connected");
            return;
        }

        // CRITICAL FIX: Subscribe to ALL user queues (was only subscribing to first one!)
        const destinations = [
            "/user/queue/chat",
            "/user/queue/messages",
            "/user/queue/notifications",
            "/user/queue/sync",
            "/user/queue/presence", // User-specific presence notifications
        ];

        // Clear existing subscriptions first
        this.userQueueSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.userQueueSubs.clear();

        destinations.forEach((dest) => {
            try {
                const sub = this.client!.subscribe(dest, (message) => {
                    this.handleMessage(message, dest);
                });
                this.userQueueSubs.set(dest, sub);
                log("subscribe", `✅ Subscribed to ${dest}`);
            } catch (error) {
                log("subscribe-error", `Failed to subscribe to ${dest}:`, error);
            }
        });

        log("subscribe", `User queues subscribed: ${this.userQueueSubs.size}/${destinations.length}`);

        // Subscribe to global presence topic
        this.subscribePresence();
        this.subscribeCallQueues();
    }

    /**
     * Subscribe to global presence topic for realtime online/offline updates.
     */
    private subscribePresence() {
        if (!this.client?.connected) {
            log("subscribe", "Cannot subscribe presence - not connected");
            return;
        }

        // Unsubscribe existing
        if (this.presenceSub) {
            try { this.presenceSub.unsubscribe(); } catch { /* ignore */ }
            this.presenceSub = null;
        }

        try {
            this.presenceSub = this.client.subscribe("/topic/presence", (message) => {
                this.handlePresenceMessage(message);
            });
            log("subscribe", "✅ Subscribed to /topic/presence");
        } catch (error) {
            log("subscribe-error", "Failed to subscribe to /topic/presence:", error);
        }
    }

    private subscribeCallQueues() {
        if (!this.client?.connected) {
            return;
        }

        if (this.callQueueSub) {
            try { this.callQueueSub.unsubscribe(); } catch { /* ignore */ }
            this.callQueueSub = null;
        }

        if (this.globalCallTopicSub) {
            try { this.globalCallTopicSub.unsubscribe(); } catch { /* ignore */ }
            this.globalCallTopicSub = null;
        }

        try {
            this.callQueueSub = this.client.subscribe("/user/queue/call", (message) => {
                this.handleCallMessage(message, "/user/queue/call");
            });
            log("subscribe", "✅ Subscribed to /user/queue/call");
        } catch (error) {
            log("subscribe-error", "Failed to subscribe to /user/queue/call:", error);
        }

        try {
            this.globalCallTopicSub = this.client.subscribe("/topic/call", (message) => {
                this.handleCallMessage(message, "/topic/call");
            });
            log("subscribe", "✅ Subscribed to /topic/call");
        } catch (error) {
            log("subscribe-error", "Failed to subscribe to /topic/call:", error);
        }
    }

    /**
     * Handle incoming presence message.
     */
    private handlePresenceMessage(message: IMessage) {
        try {
            const body = message.body;
            const data = JSON.parse(body) as {
                eventType?: string;
                userId?: string;
                online?: boolean;
                lastSeenAt?: string | null;
                sessionCount?: number;
            };

            log("presence", `Received: userId=${data.userId} online=${data.online}`);

            // Emit as a ChatRealtimeEvent for consistency
            const event: ChatRealtimeEvent = {
                eventType: (data.eventType as ChatRealtimeEvent["eventType"]) ?? "PRESENCE_UPDATED",
                conversationId: "", // Not conversation-specific
                userId: data.userId,
                online: data.online,
                lastSeenAt: data.lastSeenAt,
                message: null,
            };

            this.emitEvent(event);
        } catch (error) {
            log("presence-error", "Failed to parse presence message:", error);
        }
    }

    private handleCallMessage(message: IMessage, destination: string) {
        try {
            const event = JSON.parse(message.body) as CallRealtimeEvent;
            if (!event?.callId || !event?.signalType) {
                return;
            }

            log("call-event", `[${destination}] ${event.signalType}`, {
                callId: event.callId,
                conversationId: event.conversationId?.slice(0, 8),
                targetUserId: event.targetUserId?.slice(0, 8),
            });
            this.emitCallEvent(event);
        } catch (error) {
            log("call-parse-error", `Failed parsing call event from ${destination}:`, error);
        }
    }

    subscribeConversation(conversationId: string) {
        if (!conversationId) return;

        // Always track the conversation ID (even if not connected yet)
        this.pendingConversationIds.add(conversationId);

        if (!this.client?.connected) {
            log("subscribe", `Queued conversation ${conversationId.slice(0, 8)} (not connected)`);
            return;
        }

        // Check if already subscribed
        const destKey1 = `/topic/chat.${conversationId}`;
        const destKey2 = `/topic/chat/${conversationId}`;

        if (this.conversationSubs.has(destKey1) || this.conversationSubs.has(destKey2)) {
            log("subscribe", `Already subscribed to ${conversationId.slice(0, 8)}`);
            return;
        }

        const destinations = [destKey1, destKey2];

        destinations.forEach((dest) => {
            try {
                const sub = this.client!.subscribe(dest, (message) => {
                    this.handleMessage(message, dest);
                });
                this.conversationSubs.set(dest, sub);
                log("subscribe", `✅ Subscribed to ${dest}`);
            } catch (error) {
                log("subscribe-error", `Failed to subscribe to ${dest}:`, error);
            }
        });

        const callDest = `/topic/call/${conversationId}`;
        if (!this.callTopicSubs.has(callDest)) {
            try {
                const callSub = this.client!.subscribe(callDest, (message) => {
                    this.handleCallMessage(message, callDest);
                });
                this.callTopicSubs.set(callDest, callSub);
                log("subscribe", `✅ Subscribed to ${callDest}`);
            } catch (error) {
                log("subscribe-error", `Failed to subscribe to ${callDest}:`, error);
            }
        }
    }

    unsubscribeConversation(conversationId: string) {
        const destKey1 = `/topic/chat.${conversationId}`;
        const destKey2 = `/topic/chat/${conversationId}`;

        [destKey1, destKey2].forEach((dest) => {
            const sub = this.conversationSubs.get(dest);
            if (sub) {
                try { sub.unsubscribe(); } catch { /* ignore */ }
                this.conversationSubs.delete(dest);
            }
        });

        const callDest = `/topic/call/${conversationId}`;
        const callSub = this.callTopicSubs.get(callDest);
        if (callSub) {
            try { callSub.unsubscribe(); } catch { /* ignore */ }
            this.callTopicSubs.delete(callDest);
        }

        this.pendingConversationIds.delete(conversationId);
        log("unsubscribe", `Unsubscribed from conversation ${conversationId.slice(0, 8)}`);
    }

    syncConversationSubscriptions(conversationIds: string[]) {
        const newIds = new Set(conversationIds.filter(Boolean));

        log("sync", `Syncing ${newIds.size} conversations (currently ${this.pendingConversationIds.size} pending)`);

        // Unsubscribe from removed conversations
        const toRemove: string[] = [];
        this.pendingConversationIds.forEach((id) => {
            if (!newIds.has(id)) {
                toRemove.push(id);
            }
        });
        toRemove.forEach((id) => this.unsubscribeConversation(id));

        // Subscribe to new conversations
        conversationIds.forEach((id) => {
            if (id && !this.pendingConversationIds.has(id)) {
                this.subscribeConversation(id);
            }
        });

        log("sync", `After sync: ${this.pendingConversationIds.size} conversations tracked`);
    }

    // Re-subscribe all pending conversations (called after reconnect)
    private resubscribeAll() {
        if (!this.client?.connected) return;

        log("resubscribe", `Re-subscribing to ${this.pendingConversationIds.size} conversations...`);

        // Clear existing conversation subscriptions (not the pending list!)
        this.conversationSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.conversationSubs.clear();
        this.callTopicSubs.forEach((sub) => {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        });
        this.callTopicSubs.clear();

        // Re-subscribe to all pending conversations
        this.pendingConversationIds.forEach((id) => {
            this.subscribeConversation(id);
        });
    }

    // ─── MESSAGE HANDLING ────────────────────────────────────────────────────────

    private handleMessage(message: IMessage, destination: string) {
        try {
            const event = JSON.parse(message.body) as ChatRealtimeEvent;
            log("event", `[${destination}] ${event.eventType}`, {
                conversationId: event.conversationId,
                actorId: event.actorId,
            });
            this.emitEvent(event);
        } catch (error) {
            log("parse-error", "Failed to parse message:", message.body?.slice(0, 100));
        }
    }

    // ─── PUBLISH ─────────────────────────────────────────────────────────────────

    publish(destination: string, body: object) {
        const bodyStr = JSON.stringify(body);

        if (!this.isConnected()) {
            log("publish", `Not connected, queueing to ${destination}`);
            this.queueEvent(destination, bodyStr);
            return;
        }

        try {
            this.client?.publish({ destination, body: bodyStr });
            log("publish", `Sent to ${destination}`);
        } catch (error) {
            log("publish-error", "Failed to publish:", error);
            this.queueEvent(destination, bodyStr);
        }
    }

    async publishTyping(
        conversationId: string,
        typing: boolean,
        conversationType: "private" | "group" = "private",
    ): Promise<void> {
        const destination = conversationType === "group"
            ? "/app/typing_group"
            : "/app/chat.typing";
        const body = { conversationId, typing };

        // If not connected, try to wait briefly
        if (!this.isConnected()) {
            log("typing", `Not connected (state=${this.state}), waiting ${TYPING_WAIT_TIMEOUT_MS}ms...`);
            try {
                await this.waitForConnection(TYPING_WAIT_TIMEOUT_MS);
                log("typing", "Connection established, proceeding...");
            } catch {
                log("typing", "Timeout waiting for connection, dropping event");
                return;
            }
        }

        // Double-check connection after wait
        if (this.isConnected()) {
            try {
                this.client?.publish({ destination, body: JSON.stringify(body) });
                log("typing", `✅ Sent typing=${typing} for ${conversationId}`);
            } catch (error) {
                log("typing-error", "Failed to send:", error);
            }
        } else {
            log("typing", "Still not connected after wait, dropping");
        }
    }

    publishCallSignal(
        conversationId: string,
        targetUserId: string | null,
        callId: string,
        mode: "voice" | "video",
        signalType: CallSignalType,
        payload?: unknown,
    ) {
        const normalizedPayload =
            payload == null
                ? null
                : typeof payload === "string"
                    ? payload
                    : JSON.stringify(payload);

        this.publish("/app/signal/call", {
            conversationId,
            targetUserId,
            callId,
            mode,
            signalType,
            payload: normalizedPayload,
        });
    }

    // ─── CLEANUP ─────────────────────────────────────────────────────────────────

    destroy() {
        this.disconnect();
        this.appStateSubscription?.remove();
        this.eventListeners.clear();
        this.callEventListeners.clear();
        this.stateListeners.clear();
        SocketService.instance = null;
        log("destroy", "SocketService destroyed");
    }
}

// Export singleton instance
export const socketService = SocketService.getInstance();
export default socketService;
