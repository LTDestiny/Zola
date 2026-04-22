import { useEffect, useState } from "react";
import { getUserSummary } from "@/modules/auth/authApi";
import { getPeerUserId, setCachedProfile } from "@/modules/chat/utils/conversationUtils";
import type { ConversationItem, UserProfile } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// USE USER PROFILES HOOK
// Fetches user profiles for peer users in conversations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to fetch and cache user profiles for conversation participants
 * Returns a map of userId -> UserProfile and a refresh trigger
 */
export function useUserProfiles(
    conversations: ConversationItem[],
    currentUserId: string | null | undefined,
): {
    profileMap: Record<string, UserProfile>;
    refreshProfiles: () => void;
} {
    const [profileMap, setProfileMap] = useState<Record<string, UserProfile>>({});
    const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (!currentUserId) return;

        const peerIds = conversations
            .flatMap((conv) => {
                const isGroup = conv.type === "group" || (conv.participants?.length ?? 0) > 2;
                if (isGroup) {
                    return (conv.participants ?? []).filter((id) => id && id !== currentUserId);
                }
                const peer = getPeerUserId(conv, currentUserId);
                return peer ? [peer] : [];
            })
            .filter((id): id is string => !!id && !fetchedIds.has(id));

        // Remove duplicates
        const uniquePeerIds = [...new Set(peerIds)];

        if (uniquePeerIds.length === 0) return;

        // Fetch profiles in parallel
        const controller = new AbortController();

        Promise.allSettled(
            uniquePeerIds.map(async (userId) => {
                try {
                    const response = await getUserSummary(userId);
                    if (response.data) {
                        return { userId, profile: response.data };
                    }
                } catch {
                    // Ignore errors
                }
                return null;
            }),
        ).then((results) => {
            if (controller.signal.aborted) return;

            const newProfiles: Record<string, UserProfile> = {};
            const newFetchedIds = new Set(fetchedIds);

            for (const result of results) {
                if (result.status === "fulfilled" && result.value) {
                    const { userId, profile } = result.value;
                    newProfiles[userId] = profile;
                    newFetchedIds.add(userId);
                    // Also update the global cache
                    setCachedProfile(userId, profile);
                }
            }

            setProfileMap((prev) => ({ ...prev, ...newProfiles }));
            setFetchedIds(newFetchedIds);
        });

        return () => {
            controller.abort();
        };
    }, [conversations, currentUserId, fetchedIds, refreshKey]);

    const refreshProfiles = () => {
        setFetchedIds(new Set());
        setRefreshKey((k) => k + 1);
    };

    return { profileMap, refreshProfiles };
}
