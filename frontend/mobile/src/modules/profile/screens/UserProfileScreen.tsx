import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  getUserProfile,
  sendFriendRequest,
  cancelFriendRequestForUser,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockRelationshipUser,
  unblockRelationshipUser,
  createDirectConversation,
} from "@/modules/chat/api/chatApi";
import { useRelationshipStore } from "@/modules/chat/store/relationshipStore";
import { useAuthStore } from "@/modules/auth/authStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { UserProfile } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE SCREEN - Handles Relationship Actions
// ═══════════════════════════════════════════════════════════════════════════════

type UserProfileScreenRouteProp = RouteProp<ChatStackParamList, "UserProfile">;
type UserProfileScreenNavigationProp = NativeStackNavigationProp<ChatStackParamList, "UserProfile">;

export function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<UserProfileScreenNavigationProp>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { userId } = route.params;

  const me = useAuthStore((s) => s.me);
  const relationship = useRelationshipStore((s) => s.entries[userId]);
  const fetchRelationship = useRelationshipStore((s) => s.fetchEntry);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes] = await Promise.all([
        getUserProfile(userId),
        fetchRelationship(userId, me?.id),
      ]);
      setProfile(profileRes.data);
    } catch (error) {
      console.log("[UserProfile] Error loading data:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin người dùng");
    } finally {
      setLoading(false);
    }
  }, [userId, me?.id, fetchRelationship]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAction = async (action: () => Promise<any>, successMsg?: string) => {
    if (processing) return;
    setProcessing(true);
    try {
      await action();
      await fetchRelationship(userId, me?.id);
      if (successMsg) {
        Alert.alert("Thông báo", successMsg);
      }
    } catch (error) {
      console.log("[UserProfile] Action error:", error);
      Alert.alert("Lỗi", "Thao tác thất bại. Vui lòng thử lại sau.");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddFriend = () => handleAction(() => sendFriendRequest(userId), "Đã gửi lời mời kết bạn");
  const handleCancelRequest = () => handleAction(() => cancelFriendRequestForUser(userId), "Đã thu hồi lời mời");
  const handleAcceptRequest = () => {
    if (!relationship?.requestId) return;
    handleAction(() => acceptFriendRequest(relationship.requestId!), "Đã chấp nhận lời mời");
  };
  const handleDeclineRequest = () => {
    if (!relationship?.requestId) return;
    handleAction(() => declineFriendRequest(relationship.requestId!), "Đã từ chối lời mời");
  };
  const handleRemoveFriend = () => {
    Alert.alert("Hủy kết bạn", "Bạn có chắc chắn muốn hủy kết bạn?", [
      { text: "Không", style: "cancel" },
      {
        text: "Hủy kết bạn",
        style: "destructive",
        onPress: () => handleAction(() => removeFriend(relationship!.friendshipId!), "Đã hủy kết bạn"),
      },
    ]);
  };
  const handleBlock = () => {
    Alert.alert("Chặn người dùng", "Bạn sẽ không nhận được tin nhắn từ người này?", [
      { text: "Không", style: "cancel" },
      {
        text: "Chặn",
        style: "destructive",
        onPress: () => handleAction(() => blockRelationshipUser(userId), "Đã chặn người dùng"),
      },
    ]);
  };
  const handleUnblock = () => handleAction(() => unblockRelationshipUser(userId), "Đã bỏ chặn");

  const handleMessage = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const response = await createDirectConversation(userId);
      navigation.navigate("ChatDetail", { conversation: response.data });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể bắt đầu cuộc trò chuyện");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initials = (profile?.fullName ?? "U").substring(0, 2).toUpperCase();
  const status = relationship?.status ?? "NONE";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {/* Profile Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
          <Text style={styles.fullName}>{profile?.fullName}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <View style={styles.mainActions}>
            <Pressable onPress={handleMessage} style={[styles.actionButton, styles.primaryAction]}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>Nhắn tin</Text>
            </Pressable>

            {status === "FRIEND" && (
              <Pressable onPress={handleRemoveFriend} style={[styles.actionButton, styles.secondaryAction]}>
                <Text style={styles.actionIcon}>👤</Text>
                <Text style={styles.actionText}>Bạn bè</Text>
              </Pressable>
            )}

            {status === "NONE" && (
              <Pressable onPress={handleAddFriend} style={[styles.actionButton, styles.primaryAction]}>
                <Text style={styles.actionIcon}>➕</Text>
                <Text style={styles.actionText}>Kết bạn</Text>
              </Pressable>
            )}

            {status === "OUTGOING_REQUEST" && (
              <Pressable onPress={handleCancelRequest} style={[styles.actionButton, styles.secondaryAction]}>
                <Text style={styles.actionIcon}>⏳</Text>
                <Text style={styles.actionText}>Đã gửi</Text>
              </Pressable>
            )}
          </View>

          {status === "INCOMING_REQUEST" && (
            <View style={styles.requestBanner}>
              <Text style={styles.requestText}>Đã gửi lời mời kết bạn cho bạn</Text>
              <View style={styles.requestActions}>
                <Pressable onPress={handleDeclineRequest} style={styles.declineButton}>
                  <Text style={styles.declineText}>Từ chối</Text>
                </Pressable>
                <Pressable onPress={handleAcceptRequest} style={styles.acceptButton}>
                  <Text style={styles.acceptText}>Chấp nhận</Text>
                </Pressable>
              </View>
            </View>
          )}

          {status === "BLOCKED_BY_ME" ? (
            <Pressable onPress={handleUnblock} style={styles.unblockBanner}>
              <Text style={styles.unblockText}>Bạn đã chặn người này. Nhấn để bỏ chặn.</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleBlock} style={styles.blockButton}>
              <Text style={styles.blockButtonText}>Chặn người dùng này</Text>
            </Pressable>
          )}
        </View>

        {/* Info Sections */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            <Text style={styles.infoValue}>{profile?.phone || "Chưa cập nhật"}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giới tính</Text>
            <Text style={styles.infoValue}>{profile?.gender || "Chưa cập nhật"}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày sinh</Text>
            <Text style={styles.infoValue}>{profile?.birthdate || "Chưa cập nhật"}</Text>
          </View>
        </View>
      </ScrollView>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
  },
  backButton: {
    position: "absolute",
    left: spacing.lg,
    top: spacing.xl + 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 32,
    color: colors.text,
    lineHeight: 32,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  avatarLargeText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  fullName: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    color: colors.muted,
  },
  actionSection: {
    padding: spacing.lg,
  },
  mainActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionButton: {
    alignItems: "center",
    width: 80,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: "500",
  },
  primaryAction: {
    // maybe color tint
  },
  secondaryAction: {
    opacity: 0.8,
  },
  requestBanner: {
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestText: {
    ...typography.subhead,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  acceptText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  declineButton: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  declineText: {
    color: colors.text,
    fontWeight: "600",
  },
  unblockBanner: {
    padding: spacing.md,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  unblockText: {
    color: colors.danger,
    ...typography.caption1,
    fontWeight: "600",
  },
  blockButton: {
    alignItems: "center",
    padding: spacing.md,
  },
  blockButtonText: {
    color: colors.danger,
    ...typography.caption1,
  },
  infoSection: {
    backgroundColor: colors.cardElevated,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...typography.subhead,
    color: colors.muted,
  },
  infoValue: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "500",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
});
