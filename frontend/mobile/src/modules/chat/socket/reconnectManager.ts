// Try to import NetInfo, but make it optional for development
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NetInfo: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NetInfo = require("@react-native-community/netinfo").default;
} catch {
    console.warn("[reconnectManager] @react-native-community/netinfo not installed, network monitoring disabled");
}

import { AppState, type AppStateStatus } from "react-native";
import { socketService } from "./socketService";
import { getConversations, getMessages } from "@/modules/chat/api/chatApi";
import { useChatStore } from "@/modules/chat/store/chatStore";

// ═══════════════════════════════════════════════════════════════════════════════
// RECONNECT MANAGER - Production-ready WiFi/Network reconnect handling
//
// Features:
// - NetInfo listener for network state changes
// - AppState listener for foreground/background
// - Auto-sync missed messages after reconnect
// - Debounce multiple reconnect triggers
// - Tracks lastReceivedMessageAt for delta sync
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true;

function log(tag: string, ...args: unknown[]) {
    if (DEBUG) {
        console.log(`[reconnectManager][${tag}]`, ...args);
    }
}

// How long to wait after network comes back before syncing (debounce)
const RECONNECT_DEBOUNCE_MS = 1500;
// Max messages to fetch per conversation when syncing
const SYNC_MESSAGES_LIMIT = 50;

class ReconnectManager {
    private static instance: ReconnectManager | null = null;

    private netInfoUnsubscribe: (() => void) | null = null;
    private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isSyncing = false;
    private lastAppState: AppStateStatus = AppState.currentState;
    private wasConnected = false;
    private lastSyncAt = 0;

    // Track last received message timestamp per conversation for delta sync
    private lastReceivedByConversation = new Map<string, string>();

    private constructor() {
        log("constructor", "ReconnectManager created");
    }

    static getInstance(): ReconnectManager {
        if (!ReconnectManager.instance) {
            ReconnectManager.instance = new ReconnectManager();
        }
        return ReconnectManager.instance;
    }

    // ─── START MONITORING ────────────────────────────────────────────────────────

    start() {
        log("start", "Starting reconnect monitoring...");

        // 1. NetInfo listener (if available)
        if (NetInfo) {
            this.netInfoUnsubscribe = NetInfo.addEventListener(this.handleNetInfoChange);
            log("start", "NetInfo listener attached");
        } else {
            log("start", "NetInfo not available, skipping network monitoring");
        }

        // 2. AppState listener
        this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);

        // 3. Socket state listener (to know when socket reconnects)
        socketService.addStateListener(this.handleSocketStateChange);

        // Initial state
        this.wasConnected = socketService.isConnected();
        log("start", `Initial state: connected=${this.wasConnected}`);
    }

    stop() {
        log("stop", "Stopping reconnect monitoring...");

        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // ─── EVENT HANDLERS ──────────────────────────────────────────────────────────

    private handleNetInfoChange = (state: { isConnected: boolean | null; isInternetReachable: boolean | null; type: string }) => {
        log("netinfo", `Connected: ${state.isConnected}, Type: ${state.type}`);

        if (state.isConnected && state.isInternetReachable !== false) {
            // Network is back - schedule reconnect
            this.scheduleReconnectAndSync("netinfo");
        }
    };

    private handleAppStateChange = (nextState: AppStateStatus) => {
        const wasBackground = this.lastAppState.match(/inactive|background/);
        const isNowForeground = nextState === "active";

        log("appstate", `${this.lastAppState} → ${nextState}`);
        this.lastAppState = nextState;

        if (wasBackground && isNowForeground) {
            // App returned to foreground - check connection and sync
            this.scheduleReconnectAndSync("appstate");
        }
    };

    private handleSocketStateChange = (state: string) => {
        log("socket", `Socket state: ${state}`);

        const isNowConnected = state === "CONNECTED";

        // Socket just connected after being disconnected
        if (isNowConnected && !this.wasConnected) {
            log("socket", "Socket reconnected! Triggering sync...");
            this.triggerMissedMessageSync();
        }

        this.wasConnected = isNowConnected;
    };

    // ─── RECONNECT AND SYNC ──────────────────────────────────────────────────────

    private scheduleReconnectAndSync(trigger: string) {
        // Debounce multiple triggers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        log("schedule", `Scheduling reconnect from ${trigger}, debounce ${RECONNECT_DEBOUNCE_MS}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.performReconnectAndSync();
        }, RECONNECT_DEBOUNCE_MS);
    }

    private async performReconnectAndSync() {
        log("perform", "Performing reconnect and sync...");

        // 1. Force reconnect if not connected
        if (!socketService.isConnected()) {
            log("perform", "Socket not connected, forcing reconnect...");
            socketService.forceReconnect();
            // Sync will be triggered when socket connects (via handleSocketStateChange)
            return;
        }

        // 2. Already connected - just sync
        await this.triggerMissedMessageSync();
    }

    // ─── MISSED MESSAGE SYNC ─────────────────────────────────────────────────────

    async triggerMissedMessageSync() {
        if (this.isSyncing) {
            log("sync", "Already syncing, skipping...");
            return;
        }

        // Rate limit syncs (min 5s between syncs)
        const now = Date.now();
        if (now - this.lastSyncAt < 5000) {
            log("sync", "Sync rate limited, skipping...");
            return;
        }

        this.isSyncing = true;
        this.lastSyncAt = now;

        try {
            log("sync", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            log("sync", "Starting missed message sync...");

            // 1. Fetch all conversations (may have new ones)
            const conversationsResponse = await getConversations();
            const conversations = conversationsResponse.data;

            log("sync", `Fetched ${conversations.length} conversations`);

            // 2. Update store with latest conversations
            const { setConversations, activeConversationId, messagesByConversation, setMessages } = useChatStore.getState();
            setConversations(conversations);

            // 3. Sync subscriptions
            const conversationIds = conversations.map((c) => c.id).filter(Boolean);
            socketService.syncConversationSubscriptions(conversationIds);

            // 4. Fetch missed messages for each conversation
            let totalMissed = 0;
            for (const conv of conversations) {
                const currentMessages = messagesByConversation[conv.id]?.items ?? [];
                const latestLocalMessage = currentMessages.at(-1);

                // Determine if we need to fetch messages
                const shouldFetch =
                    // Active conversation - always refresh
                    conv.id === activeConversationId ||
                    // Has unread messages
                    (conv.unreadCount ?? 0) > 0 ||
                    // No messages loaded yet
                    currentMessages.length === 0 ||
                    // Server has newer lastMessageAt
                    (conv.lastMessageAt && latestLocalMessage?.createdAt &&
                        new Date(conv.lastMessageAt) > new Date(latestLocalMessage.createdAt));

                if (!shouldFetch) continue;

                try {
                    // Fetch latest messages for this conversation
                    // NOTE: API doesn't support 'after' parameter, so we fetch latest and merge
                    const messagesResponse = await getMessages(conv.id, {
                        limit: SYNC_MESSAGES_LIMIT,
                    });

                    const newMessages = messagesResponse.data.items;
                    if (newMessages.length > 0) {
                        log("sync", `[${conv.id.slice(0, 8)}] Fetched ${newMessages.length} messages`);

                        // Count actually new messages (not already in store)
                        const existingIds = new Set(currentMessages.map(m => m.id));
                        const actuallyNew = newMessages.filter(m => !existingIds.has(m.id));

                        if (actuallyNew.length > 0) {
                            log("sync", `[${conv.id.slice(0, 8)}] ${actuallyNew.length} are NEW missed messages`);
                            totalMissed += actuallyNew.length;
                        }

                        // Merge with existing messages
                        setMessages(conv.id, newMessages, messagesResponse.data.nextCursor);

                        // Update last received timestamp
                        const latest = newMessages.at(-1);
                        if (latest?.createdAt) {
                            this.lastReceivedByConversation.set(conv.id, latest.createdAt);
                        }
                    }
                } catch (error) {
                    log("sync-error", `Failed to fetch messages for ${conv.id.slice(0, 8)}:`, error);
                }
            }

            log("sync", `Sync complete! Fetched ${totalMissed} missed messages total`);
            log("sync", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        } catch (error) {
            log("sync-error", "Failed to sync:", error);
        } finally {
            this.isSyncing = false;
        }
    }

    // ─── UPDATE LAST RECEIVED ────────────────────────────────────────────────────

    updateLastReceived(conversationId: string, timestamp: string) {
        const current = this.lastReceivedByConversation.get(conversationId);
        if (!current || new Date(timestamp) > new Date(current)) {
            this.lastReceivedByConversation.set(conversationId, timestamp);
        }
    }

    // ─── MANUAL SYNC (for pull-to-refresh etc) ───────────────────────────────────

    async manualSync() {
        log("manual", "Manual sync triggered");
        this.lastSyncAt = 0; // Reset rate limit
        await this.triggerMissedMessageSync();
    }
}

export const reconnectManager = ReconnectManager.getInstance();
