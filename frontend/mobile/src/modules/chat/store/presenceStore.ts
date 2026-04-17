import { create } from "zustand";
import { AppState, type AppStateStatus } from "react-native";
import { httpClient } from "@/modules/chat/api/httpClient";
import type { ApiResponse } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE STORE - Zustand store for managing online/offline presence
// 
// Features:
// - Batch presence fetching with caching
// - Realtime updates from WebSocket
// - AppState integration (foreground/background)
// - Automatic periodic refresh
// - Multi-device support (handled by backend)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
    if (DEBUG) {
        console.log(`[presenceStore][${tag}]`, ...args);
    }
}

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export type UserPresenceState = {
    online: boolean;
    lastSeenAt: string | null;
    lastUpdated: number;
};

export type PresenceMap = Record<string, UserPresenceState>;

type PresenceApiItem = {
    userId: string;
    online: boolean;
    lastChangedAt: string | null;
};

interface PresenceStoreState {
    // State
    presenceMap: PresenceMap;
    loading: boolean;
    lastRefresh: number;
    appState: AppStateStatus;

    // Actions
    setPresence: (userId: string, online: boolean, lastSeenAt?: string | null) => void;
    updateFromRealtime: (event: { userId?: string; online?: boolean; lastSeenAt?: string | null }) => void;
    fetchPresenceBatch: (userIds: string[]) => Promise<void>;
    setAppState: (state: AppStateStatus) => void;
    clearAll: () => void;

    // Selectors (actions that return values)
    isOnline: (userId: string) => boolean;
    getPresence: (userId: string) => UserPresenceState | null;
}

// ─── API ───────────────────────────────────────────────────────────────────────

async function fetchUsersPresenceApi(userIds: string[]): Promise<PresenceApiItem[]> {
    const ids = userIds
        .map((value) => value.trim())
        .filter(Boolean)
        .join(",");

    if (!ids) {
        return [];
    }

    try {
        const response = await httpClient.get<ApiResponse<PresenceApiItem[]>>(
            "/api/v1/users/presence",
            { params: { ids } },
        );
        return response.data.data ?? [];
    } catch (error) {
        log("api", "Error fetching presence:", error);
        return [];
    }
}

// ─── STORE ─────────────────────────────────────────────────────────────────────

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
    // Initial state
    presenceMap: {},
    loading: false,
    lastRefresh: 0,
    appState: AppState.currentState,

    // ─── ACTIONS ───────────────────────────────────────────────────────────────

    setPresence: (userId, online, lastSeenAt) => {
        set((state) => ({
            presenceMap: {
                ...state.presenceMap,
                [userId]: {
                    online,
                    lastSeenAt: lastSeenAt ?? state.presenceMap[userId]?.lastSeenAt ?? null,
                    lastUpdated: Date.now(),
                },
            },
        }));
    },

    updateFromRealtime: (event) => {
        if (!event.userId) return;

        log("realtime", `Presence update: ${event.userId} -> ${event.online ? "online" : "offline"}`);

        set((state) => ({
            presenceMap: {
                ...state.presenceMap,
                [event.userId!]: {
                    online: event.online ?? false,
                    lastSeenAt: event.lastSeenAt ?? state.presenceMap[event.userId!]?.lastSeenAt ?? null,
                    lastUpdated: Date.now(),
                },
            },
        }));
    },

    fetchPresenceBatch: async (userIds) => {
        const uniqueIds = [...new Set(userIds.filter((id) => id && id.trim()))];
        if (uniqueIds.length === 0) return;

        log("fetch", `Fetching presence for ${uniqueIds.length} users`);
        set({ loading: true });

        try {
            const items = await fetchUsersPresenceApi(uniqueIds);
            const now = Date.now();

            set((state) => {
                const nextMap = { ...state.presenceMap };
                items.forEach((item) => {
                    nextMap[item.userId] = {
                        online: item.online,
                        lastSeenAt: item.lastChangedAt,
                        lastUpdated: now,
                    };
                });
                return { presenceMap: nextMap, lastRefresh: now };
            });

            log("fetch", `Updated presence for ${items.length} users`);
        } catch (error) {
            log("fetch", "Error:", error);
        } finally {
            set({ loading: false });
        }
    },

    setAppState: (newState) => {
        set({ appState: newState });
    },

    clearAll: () => {
        set({ presenceMap: {}, lastRefresh: 0 });
    },

    // ─── SELECTORS ─────────────────────────────────────────────────────────────

    isOnline: (userId) => {
        return get().presenceMap[userId]?.online ?? false;
    },

    getPresence: (userId) => {
        return get().presenceMap[userId] ?? null;
    },
}));

// ─── APP STATE LISTENER ────────────────────────────────────────────────────────

let appStateListenerSetup = false;

export function setupPresenceAppStateListener() {
    if (appStateListenerSetup) return;
    appStateListenerSetup = true;

    AppState.addEventListener("change", (nextState) => {
        const store = usePresenceStore.getState();
        const prevState = store.appState;

        log("appstate", `${prevState} → ${nextState}`);
        store.setAppState(nextState);

        // When returning to foreground, refresh presence
        const wasBackground = prevState.match(/inactive|background/);
        const isNowForeground = nextState === "active";

        if (wasBackground && isNowForeground) {
            log("appstate", "App returned to foreground - refreshing presence");
            // The actual refresh will be triggered by usePresence hook
            // which watches appState changes
        }
    });
}

// ─── HELPER HOOK FOR PRESENCE LABEL ────────────────────────────────────────────

/**
 * Get formatted presence label for a user.
 * Uses the timeFormatter utilities.
 */
export function getPresenceLabel(
    online: boolean,
    lastSeenAt: string | null | undefined,
    language: "vi" | "en" = "vi"
): string {
    if (online) {
        return language === "vi" ? "Đang hoạt động" : "Active now";
    }

    if (!lastSeenAt) {
        return language === "vi" ? "Không hoạt động" : "Inactive";
    }

    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
        return language === "vi" ? "Vừa mới truy cập" : "Just now";
    }

    if (diffMinutes < 60) {
        return language === "vi"
            ? `Hoạt động ${diffMinutes} phút trước`
            : `Active ${diffMinutes}m ago`;
    }

    if (diffHours < 24) {
        return language === "vi"
            ? `Hoạt động ${diffHours} giờ trước`
            : `Active ${diffHours}h ago`;
    }

    if (diffDays === 1) {
        return language === "vi" ? "Hoạt động hôm qua" : "Active yesterday";
    }

    if (diffDays < 7) {
        return language === "vi"
            ? `Hoạt động ${diffDays} ngày trước`
            : `Active ${diffDays}d ago`;
    }

    // Format as date for older
    const day = lastSeen.getDate().toString().padStart(2, "0");
    const month = (lastSeen.getMonth() + 1).toString().padStart(2, "0");

    return language === "vi"
        ? `Hoạt động ${day}/${month}`
        : `Active ${month}/${day}`;
}
