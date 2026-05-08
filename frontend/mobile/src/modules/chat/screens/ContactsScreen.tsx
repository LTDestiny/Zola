import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  getFriends,
  getPendingFriendRequests,
  getSentPendingFriendRequests,
  getBlockedUsers,
  searchUserByEmail,
  getConversations,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequestForUser,
} from "@/modules/chat/api/chatApi";
import { useRelationshipStore } from "@/modules/chat/store/relationshipStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { useFriendRequestStore } from "@/modules/chat/store/friendRequestStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS SCREEN - Friends, Groups, and Requests
// ═══════════════════════════════════════════════════════════════════════════════

type TabType = "friends" | "groups" | "received" | "sent" | "blocked";

type ContactsScreenNavigationProp = NativeStackNavigationProp<ChatStackParamList>;

export function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ContactsScreenNavigationProp>();

  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const friends = useRelationshipStore((s) => s.friends);
  const receivedRequests = useRelationshipStore((s) => s.receivedRequests);
  const sentRequests = useRelationshipStore((s) => s.sentRequests);
  const blockedUsers = useRelationshipStore((s) => s.blockedUsers);
  
  const setFriends = useRelationshipStore((s) => s.setFriends);
  const setReceived = useRelationshipStore((s) => s.setReceivedRequests);
  const setSent = useRelationshipStore((s) => s.setSentRequests);
  const setBlocked = useRelationshipStore((s) => s.setBlockedUsers);

  const friendRequestUnread = useFriendRequestStore((s) => s.unreadCount);

  // Groups from chatStore
  const allConversations = useChatStore((s) => s.conversations);
  const groups = useMemo(() => allConversations.filter(c => c.type === "group"), [allConversations]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fRes, rRes, sRes, bRes] = await Promise.all([
        getFriends(),
        getPendingFriendRequests(),
        getSentPendingFriendRequests(),
        getBlockedUsers(),
      ]);
      
      setFriends(fRes.data ?? []);
      setReceived(rRes.data ?? []);
      setSent(sRes.data ?? []);
      setBlocked(bRes.data ?? []);

      // Also refresh conversations to get updated groups
      await getConversations();
    } catch (error) {
      console.log("[Contacts] Error loading data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setFriends, setReceived, setSent, setBlocked]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await searchUserByEmail(searchQuery.trim());
      if (res.data) {
        navigation.navigate("UserProfile", { userId: res.data.id });
      } else {
        Alert.alert("Thông báo", "Không tìm thấy người dùng");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Đã có lỗi xảy ra khi tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await acceptFriendRequest(requestId);
      await loadData(true);
      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn");
    } catch (error) {
      Alert.alert("Lỗi", "Thao tác thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await declineFriendRequest(requestId);
      await loadData(true);
    } catch (error) {
      Alert.alert("Lỗi", "Thao tác thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (targetUserId: string) => {
    setActionLoading(targetUserId);
    try {
      await cancelFriendRequestForUser(targetUserId);
      await loadData(true);
    } catch (error) {
      Alert.alert("Lỗi", "Thao tác thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isFriend = activeTab === "friends";
    const isGroup = activeTab === "groups";
    const isReceived = activeTab === "received";
    const isSent = activeTab === "sent";
    const isBlocked = activeTab === "blocked";

    let name = "";
    let subtext = "";
    let id = "";

    if (isFriend) {
      name = item.fullName || "Người dùng";
      subtext = item.email || "";
      id = item.userId;
    } else if (isGroup) {
      name = item.name || "Nhóm không tên";
      subtext = `${item.participants?.length || 0} thành viên`;
      id = item.id;
    } else if (isReceived) {
      name = item.requesterName || item.fullName || "Người dùng";
      subtext = "Đã gửi lời mời cho bạn";
      id = item.requesterId;
    } else if (isSent) {
      name = item.addresseeName || item.fullName || "Người dùng";
      subtext = "Chờ phản hồi";
      id = item.addresseeId;
    } else if (isBlocked) {
      name = `User ${item.userId?.slice(0, 8)}`;
      subtext = "Đã chặn";
      id = item.userId;
    }

    const initials = name.substring(0, 2).toUpperCase() || "?";

    return (
      <View style={styles.contactItemContainer}>
        <Pressable
          onPress={() => {
            if (isGroup) {
              navigation.navigate("ChatDetail", { conversation: item });
            } else {
              navigation.navigate("UserProfile", { userId: id });
            }
          }}
          style={({ pressed }) => [styles.contactItem, pressed && styles.pressed]}
        >
          <View style={[styles.avatar, isGroup && { backgroundColor: colors.success }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{name}</Text>
            <Text style={styles.contactSubtext} numberOfLines={1}>{subtext}</Text>
          </View>
          
          {isReceived && (
            <View style={styles.actionGroup}>
              <Pressable 
                onPress={() => handleDecline(item.friendshipId)} 
                disabled={!!actionLoading}
                style={[styles.smallButton, styles.declineButton]}
              >
                <Text style={styles.declineButtonText}>Từ chối</Text>
              </Pressable>
              <Pressable 
                onPress={() => handleAccept(item.friendshipId)} 
                disabled={!!actionLoading}
                style={[styles.smallButton, styles.acceptButton]}
              >
                <Text style={styles.acceptButtonText}>Đồng ý</Text>
              </Pressable>
            </View>
          )}

          {isSent && (
            <Pressable 
              onPress={() => handleCancel(item.addresseeId)} 
              disabled={!!actionLoading}
              style={[styles.smallButton, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Thu hồi</Text>
            </Pressable>
          )}

          {!isReceived && !isSent && (
            <Text style={styles.chevron}>›</Text>
          )}
        </Pressable>
      </View>
    );
  };

  const currentData = activeTab === "friends" ? friends 
                    : activeTab === "groups" ? groups
                    : activeTab === "received" ? receivedRequests
                    : activeTab === "sent" ? sentRequests
                    : activeTab === "blocked" ? blockedUsers
                    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Danh bạ</Text>
        <View style={styles.searchBar}>
          <TextInput
            placeholder="Tìm kiếm bằng email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor={colors.muted}
          />
          <Pressable onPress={handleSearch} style={styles.searchIcon}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <Pressable onPress={() => setActiveTab("friends")} style={[styles.tabButton, activeTab === "friends" && styles.activeTabButton]}>
            <Text style={[styles.tabLabel, activeTab === "friends" && styles.activeTabLabel]}>Bạn bè</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("groups")} style={[styles.tabButton, activeTab === "groups" && styles.activeTabButton]}>
            <Text style={[styles.tabLabel, activeTab === "groups" && styles.activeTabLabel]}>Nhóm</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("received")} style={[styles.tabButton, activeTab === "received" && styles.activeTabButton]}>
            <Text style={[styles.tabLabel, activeTab === "received" && styles.activeTabLabel]}>Lời mời đến</Text>
            {friendRequestUnread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friendRequestUnread}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => setActiveTab("sent")} style={[styles.tabButton, activeTab === "sent" && styles.activeTabButton]}>
            <Text style={[styles.tabLabel, activeTab === "sent" && styles.activeTabLabel]}>Đã gửi</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("blocked")} style={[styles.tabButton, activeTab === "blocked" && styles.activeTabButton]}>
            <Text style={[styles.tabLabel, activeTab === "blocked" && styles.activeTabLabel]}>Đã chặn</Text>
          </Pressable>
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentData}
          renderItem={renderItem}
          keyExtractor={(item, index) => (item.userId || item.requesterId || item.addresseeId || item.friendshipId || index).toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không có dữ liệu</Text>
            </View>
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
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  title: {
    ...typography.title1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  searchIcon: {
    padding: spacing.xs,
  },
  tabsContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  tabButton: {
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
  },
  activeTabButton: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    ...typography.subhead,
    color: colors.muted,
    fontWeight: "500",
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingTop: spacing.md,
  },
  contactItemContainer: {
    backgroundColor: colors.bg,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.bgSecondary,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 20,
  },
  contactInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  smallButton: {
    minHeight: 36,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  acceptButtonText: {
    ...typography.caption1,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  declineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  declineButtonText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: "700",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.34)",
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  cancelButtonText: {
    ...typography.caption1,
    color: colors.danger,
    fontWeight: "700",
  },
  contactName: {
    ...typography.headline,
    color: colors.text,
    marginBottom: 2,
  },
  contactSubtext: {
    ...typography.caption1,
    color: colors.muted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
    opacity: 0.5,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
  },
});
