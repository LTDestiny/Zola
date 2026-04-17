import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
    acceptFriendRequest,
    declineFriendRequest,
    getPendingFriendRequests,
    markPendingFriendRequestsRead,
    getUserProfile,
} from "@/modules/chat/api/chatApi";
import { useFriendRequestStore } from "@/modules/chat/store/friendRequestStore";
import type { PendingFriendRequestItem, UserProfile } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// FRIEND REQUESTS SCREEN - Premium iOS Style
// ═══════════════════════════════════════════════════════════════════════════════

type FriendRequestWithProfile = PendingFriendRequestItem & {
    requesterProfile?: UserProfile | null;
};

// Fetch user profile helper
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const response = await getUserProfile(userId);
        return response.data;
    } catch {
        return null;
    }
}

// Stable keyExtractor
const keyExtractor = (item: FriendRequestWithProfile) => item.friendshipId;

export function FriendRequestsScreen() {
    const insets = useSafeAreaInsets();
    const [requests, setRequests] = useState<FriendRequestWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    const loadRequests = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await getPendingFriendRequests();
            const pendingRequests = response.data ?? [];

            // Fetch profiles for all requesters
            const requestsWithProfiles = await Promise.all(
                pendingRequests.map(async (req) => {
                    const profile = await fetchUserProfile(req.requesterId);
                    return {
                        ...req,
                        requesterProfile: profile,
                    };
                }),
            );

            setRequests(requestsWithProfiles);

            // Mark as read when viewing
            if (pendingRequests.length > 0) {
                void markPendingFriendRequestsRead();
            }
        } catch (error) {
            console.log("[FriendRequests] Error loading requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    useFocusEffect(
        useCallback(() => {
            void loadRequests(true);
            useFriendRequestStore.getState().reset();
        }, [loadRequests]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadRequests(true);
    }, [loadRequests]);

    const handleAccept = useCallback(async (friendshipId: string) => {
        setProcessingIds((prev) => new Set(prev).add(friendshipId));
        try {
            await acceptFriendRequest(friendshipId);
            setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        } catch (error) {
            console.log("[FriendRequests] Error accepting request:", error);
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(friendshipId);
                return next;
            });
        }
    }, []);

    const handleDecline = useCallback(async (friendshipId: string) => {
        setProcessingIds((prev) => new Set(prev).add(friendshipId));
        try {
            await declineFriendRequest(friendshipId);
            setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        } catch (error) {
            console.log("[FriendRequests] Error declining request:", error);
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(friendshipId);
                return next;
            });
        }
    }, []);

    const renderItem = useCallback(
        ({ item }: { item: FriendRequestWithProfile }) => {
            const isProcessing = processingIds.has(item.friendshipId);
            const displayName = item.requesterProfile?.fullName ?? "Người dùng";
            const avatarLetter = displayName.charAt(0).toUpperCase();

            return (
                <Animated.View style={styles.requestCard}>
                    {/* Avatar */}
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{avatarLetter}</Text>
                    </View>

                    {/* Info */}
                    <View style={styles.requestInfo}>
                        <Text style={styles.requestName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text style={styles.requestSubtext}>Muốn kết bạn với bạn</Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Pressable
                            onPress={() => void handleDecline(item.friendshipId)}
                            disabled={isProcessing}
                            style={({ pressed }) => [
                                styles.declineButton,
                                pressed && styles.buttonPressed,
                                isProcessing && styles.buttonDisabled,
                            ]}
                        >
                            <Text style={styles.declineButtonText}>Từ chối</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => void handleAccept(item.friendshipId)}
                            disabled={isProcessing}
                            style={({ pressed }) => [
                                styles.acceptButton,
                                pressed && styles.buttonPressed,
                                isProcessing && styles.buttonDisabled,
                            ]}
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                            )}
                        </Pressable>
                    </View>
                </Animated.View>
            );
        },
        [processingIds, handleAccept, handleDecline],
    );

    const ListEmptyComponent = useMemo(
        () => (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👋</Text>
                <Text style={styles.emptyTitle}>Không có lời mời</Text>
                <Text style={styles.emptySubtext}>
                    Khi ai đó gửi lời mời kết bạn,{"\n"}bạn sẽ thấy ở đây
                </Text>
            </View>
        ),
        [],
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Lời mời kết bạn</Text>
                {requests.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{requests.length}</Text>
                    </View>
                )}
            </View>

            {/* Content */}
            {loading && requests.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={ListEmptyComponent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
    },
    headerTitle: {
        ...typography.title1,
        color: colors.text,
    },
    badge: {
        marginLeft: spacing.sm,
        backgroundColor: colors.danger,
        borderRadius: borderRadius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        minWidth: 24,
        alignItems: "center",
    },
    badgeText: {
        ...typography.caption1,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        flexGrow: 1,
    },
    requestCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.cardElevated,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.avatarBg,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        ...typography.title2,
        color: colors.avatarText,
    },
    requestInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    requestName: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    requestSubtext: {
        ...typography.subhead,
        color: colors.muted,
    },
    actions: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    acceptButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.pill,
        minWidth: 90,
        alignItems: "center",
        justifyContent: "center",
    },
    acceptButtonText: {
        ...typography.subhead,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    declineButton: {
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    declineButtonText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "500",
    },
    buttonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xxl,
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtext: {
        ...typography.body,
        color: colors.muted,
        textAlign: "center",
        lineHeight: 24,
    },
});
