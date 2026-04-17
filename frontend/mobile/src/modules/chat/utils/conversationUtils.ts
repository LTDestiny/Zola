import { useAuthStore } from "@/modules/auth/authStore";
import { getUserSummary } from "@/modules/auth/authApi";
import type { ConversationItem, UserProfile } from "@/shared/types/api";

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION DISPLAY NAME RESOLVER
// Resolves the display name for a conversation based on participants
// ═══════════════════════════════════════════════════════════════════════════════

// Cache for user profiles
const userProfileCache: Record<string, UserProfile> = {};

/**
 * Get peer user ID from a conversation (for 1:1 chats)
 */
export function getPeerUserId(
    conversation: ConversationItem,
    currentUserId: string | null | undefined
): string | null {
    const participants = conversation.participants ?? [];
    const peer = participants.find((id) => id && id !== currentUserId);
    return peer ?? null;
}

/**
 * Check if a string looks like a UUID/ID (contains dashes or is long alphanumeric)
 */
function looksLikeId(value: string): boolean {
    if (!value) return false;
    // Contains UUID-like dashes
    if (value.includes("-") && value.length > 30) return true;
    // Is a MongoDB ObjectId (24 hex chars)
    if (/^[a-f0-9]{24}$/i.test(value)) return true;
    return false;
}

/**
 * Get display name for a conversation
 * Priority:
 * 1. Cached user profile fullName
 * 2. Conversation name (if not an ID)
 * 3. Shortened user ID
 * 4. "User"
 */
export function getConversationDisplayName(
    conversation: ConversationItem,
    currentUserId: string | null | undefined,
    userProfileMap?: Record<string, UserProfile>
): string {
    const peerUserId = getPeerUserId(conversation, currentUserId);

    // Check user profile map first
    if (peerUserId && userProfileMap?.[peerUserId]?.fullName) {
        return userProfileMap[peerUserId].fullName;
    }

    // Check local cache
    if (peerUserId && userProfileCache[peerUserId]?.fullName) {
        return userProfileCache[peerUserId].fullName;
    }

    // Use conversation name if it doesn't look like an ID
    if (conversation.name && !looksLikeId(conversation.name)) {
        return conversation.name;
    }

    // Fallback to shortened ID
    if (peerUserId && peerUserId.length >= 8) {
        return `User ${peerUserId.slice(0, 8)}`;
    }

    return conversation.name || "User";
}

/**
 * Fetch and cache user profile
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
    if (userProfileCache[userId]) {
        return userProfileCache[userId];
    }

    try {
        const response = await getUserSummary(userId);
        if (response.data) {
            userProfileCache[userId] = response.data;
            return response.data;
        }
    } catch {
        // Ignore errors, just return null
    }

    return null;
}

/**
 * Get cached profile or null
 */
export function getCachedProfile(userId: string): UserProfile | null {
    return userProfileCache[userId] ?? null;
}

/**
 * Set profile in cache
 */
export function setCachedProfile(userId: string, profile: UserProfile): void {
    userProfileCache[userId] = profile;
}

/**
 * Clear profile cache
 */
export function clearProfileCache(): void {
    Object.keys(userProfileCache).forEach((key) => delete userProfileCache[key]);
}
