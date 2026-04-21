import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { httpClient } from "@/modules/chat/api/httpClient";
import { formatPresence, getPresenceLabel, type PresenceInfo } from "@/modules/chat/utils/timeFormatter";
import type { ApiResponse } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE HOOK - Manages online/offline status with realtime updates (Mobile)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[usePresence][${tag}]`, ...args);
  }
}

export type UserPresenceState = {
  online: boolean;
  lastSeenAt: string | null;
  lastUpdated: number;
};

export type PresenceMap = Record<string, UserPresenceState>;

type UserPresenceItem = {
  userId: string;
  online: boolean;
  lastChangedAt: string | null;
};

interface UsePresenceOptions {
  /** User IDs to track presence for */
  userIds: string[];
  /** Auto-refresh interval in ms (default: 60000 = 1 minute) */
  refreshInterval?: number;
  /** Debounce time for batch requests in ms (default: 300) */
  debounceMs?: number;
  /** Language for presence labels */
  language?: 'vi' | 'en';
}

interface UsePresenceReturn {
  /** Map of userId -> presence state */
  presenceMap: PresenceMap;
  /** Check if a specific user is online */
  isOnline: (userId: string) => boolean;
  /** Get formatted presence label for a user */
  getLabel: (userId: string) => string;
  /** Get full presence info for a user */
  getPresence: (userId: string) => UserPresenceState | null;
  /** Manually refresh presence for specific users */
  refreshPresence: (userIds?: string[]) => Promise<void>;
  /** Update presence from realtime event */
  updateFromRealtime: (event: { userId: string; online: boolean; lastSeenAt?: string | null }) => void;
  /** Loading state */
  loading: boolean;
  /** Current tick for re-rendering time-based labels */
  tick: number;
}

/**
 * Fetch presence for multiple users.
 */
async function getUsersPresence(userIds: string[]): Promise<{ data: UserPresenceItem[] }> {
  const ids = userIds
    .map((value) => value.trim())
    .filter(Boolean)
    .join(",");

  if (!ids) {
    return { data: [] };
  }

  try {
    const response = await httpClient.get<ApiResponse<UserPresenceItem[]>>(
      "/api/v1/users/presence",
      { params: { ids } },
    );
    return { data: response.data.data ?? [] };
  } catch (error) {
    log("api", "Error fetching presence:", error);
    return { data: [] };
  }
}

/**
 * Hook for managing user presence (online/offline status) on Mobile.
 * 
 * Features:
 * - Batch fetching with debouncing
 * - Automatic refresh interval
 * - Realtime updates from socket
 * - Memoized presence lookups
 * - Periodic tick for updating time-based labels
 * 
 * @example
 * const { presenceMap, isOnline, getLabel } = usePresence({
 *   userIds: conversations.map(c => c.peerId),
 *   refreshInterval: 60000,
 * });
 */
export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const {
    userIds,
    refreshInterval = 60000,
    debounceMs = 300,
    language = 'vi',
  } = options;

  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(Date.now());

  // Refs for debouncing and tracking
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUserIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const loadedUserIdsRef = useRef<Set<string>>(new Set());
  const loadingUserIdsRef = useRef<Set<string>>(new Set());
  const loadedAtByUserRef = useRef<Record<string, number>>({});
  const PRESENCE_TTL_MS = 60000;

  // ─── BATCH FETCH PRESENCE ─────────────────────────────────────────────────────

  const fetchPresenceBatch = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const uniqueIds = [...new Set(ids.filter(id => id && id.trim()))];
    if (uniqueIds.length === 0) return;

    const now = Date.now();
    const targetIds = uniqueIds.filter((id) => {
      if (loadingUserIdsRef.current.has(id)) {
        return false;
      }
      const loadedAt = loadedAtByUserRef.current[id] ?? 0;
      return !loadedUserIdsRef.current.has(id) || now - loadedAt > PRESENCE_TTL_MS;
    });

    if (targetIds.length === 0) {
      return;
    }

    log('fetch', `Fetching presence for ${targetIds.length} users`);
    targetIds.forEach((id) => loadingUserIdsRef.current.add(id));

    try {
      setLoading(true);
      const response = await getUsersPresence(targetIds);

      if (!mountedRef.current) return;

      const entries = response.data ?? [];
      const fetchedAt = Date.now();

      setPresenceMap(prev => {
        const next = { ...prev };
        entries.forEach((item: UserPresenceItem) => {
          next[item.userId] = {
            online: item.online,
            lastSeenAt: item.lastChangedAt,
            lastUpdated: fetchedAt,
          };
          loadedUserIdsRef.current.add(item.userId);
          loadedAtByUserRef.current[item.userId] = fetchedAt;
        });
        return next;
      });

      log('fetch', `Updated presence for ${entries.length} users`);
    } catch (error) {
      log('fetch', 'Error fetching presence:', error);
    } finally {
      targetIds.forEach((id) => loadingUserIdsRef.current.delete(id));
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ─── DEBOUNCED FETCH ──────────────────────────────────────────────────────────

  const debouncedFetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const ids = [...pendingUserIdsRef.current];
      pendingUserIdsRef.current.clear();
      void fetchPresenceBatch(ids);
    }, debounceMs);
  }, [debounceMs, fetchPresenceBatch]);

  // ─── QUEUE USER IDS FOR FETCH ─────────────────────────────────────────────────

  const queueForFetch = useCallback((ids: string[]) => {
    ids.forEach(id => {
      if (id && id.trim()) {
        pendingUserIdsRef.current.add(id.trim());
      }
    });
    debouncedFetch();
  }, [debouncedFetch]);

  // ─── PUBLIC: REFRESH PRESENCE ─────────────────────────────────────────────────

  const refreshPresence = useCallback(async (ids?: string[]) => {
    const idsToFetch = ids ?? userIds;
    await fetchPresenceBatch(idsToFetch);
  }, [userIds, fetchPresenceBatch]);

  // ─── PUBLIC: UPDATE FROM REALTIME ─────────────────────────────────────────────

  const updateFromRealtime = useCallback((event: {
    userId: string;
    online: boolean;
    lastSeenAt?: string | null;
  }) => {
    if (!event.userId) return;

    log('realtime', `Presence update: ${event.userId} -> ${event.online ? 'online' : 'offline'}`);

    setPresenceMap(prev => ({
      ...prev,
      [event.userId]: {
        online: event.online,
        lastSeenAt: event.lastSeenAt ?? prev[event.userId]?.lastSeenAt ?? null,
        lastUpdated: Date.now(),
      },
    }));

    loadedUserIdsRef.current.add(event.userId);
    loadedAtByUserRef.current[event.userId] = Date.now();
  }, []);

  // ─── PUBLIC: CHECK IF ONLINE ──────────────────────────────────────────────────

  const isOnline = useCallback((userId: string): boolean => {
    return presenceMap[userId]?.online ?? false;
  }, [presenceMap]);

  // ─── PUBLIC: GET PRESENCE LABEL ───────────────────────────────────────────────

  const getLabel = useCallback((userId: string): string => {
    const state = presenceMap[userId];
    if (!state) {
      return language === 'vi' ? 'Không hoạt động' : 'Inactive';
    }
    return getPresenceLabel(state.online, state.lastSeenAt, language);
  }, [presenceMap, language]);

  // ─── PUBLIC: GET FULL PRESENCE ────────────────────────────────────────────────

  const getPresence = useCallback((userId: string): UserPresenceState | null => {
    return presenceMap[userId] ?? null;
  }, [presenceMap]);

  // ─── EFFECT: FETCH ON USER IDS CHANGE ─────────────────────────────────────────

  useEffect(() => {
    if (userIds.length > 0) {
      // Only fetch users we don't have data for
      const missingIds = userIds.filter(id => !presenceMap[id]);
      if (missingIds.length > 0) {
        queueForFetch(missingIds);
      }
    }
  }, [userIds, queueForFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── EFFECT: PERIODIC REFRESH ─────────────────────────────────────────────────

  useEffect(() => {
    if (refreshInterval <= 0 || userIds.length === 0) return;

    const intervalId = setInterval(() => {
      void fetchPresenceBatch(userIds);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [userIds, refreshInterval, fetchPresenceBatch]);

  // ─── EFFECT: TICK FOR TIME-BASED LABELS ───────────────────────────────────────

  useEffect(() => {
    // Update tick every minute to re-render time-based labels
    const tickId = setInterval(() => {
      setTick(Date.now());
    }, 60000);

    return () => clearInterval(tickId);
  }, []);

  // ─── EFFECT: CLEANUP ──────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    presenceMap,
    isOnline,
    getLabel,
    getPresence,
    refreshPresence,
    updateFromRealtime,
    loading,
    tick,
  };
}

// ─── UTILITY: EXTRACT PEER USER IDS FROM CONVERSATIONS ──────────────────────────

export function extractPeerUserIds(
  conversations: Array<{ participants: string[] }>,
  currentUserId: string | null | undefined
): string[] {
  if (!currentUserId) return [];

  const peerIds = new Set<string>();

  conversations.forEach(conv => {
    conv.participants?.forEach(participantId => {
      if (participantId && participantId !== currentUserId) {
        peerIds.add(participantId);
      }
    });
  });

  return [...peerIds];
}
