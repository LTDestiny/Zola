import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addFriend,
  createDirectConversation,
  createGroupConversation,
  getConversations,
  joinGroupByInviteCode,
  pinConversation,
  searchUserByEmail,
  toApiErrorMessage,
  unpinConversation,
} from "@/modules/chat/api/chatApi";
import { ChatItem } from "@/modules/chat/components/ChatItem";
import { useUserProfiles } from "@/modules/chat/hooks/useUserProfiles";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { usePresenceStore, setupPresenceAppStateListener } from "@/modules/chat/store/presenceStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { getConversationDisplayName, getConversationLastMessagePreview, getPeerUserId } from "@/modules/chat/utils/conversationUtils";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { ConversationItem } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT LIST SCREEN - Premium iOS Style (Zola + iMessage)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[ChatList][${tag}]`, ...args);
  }
}

type Props = NativeStackScreenProps<ChatStackParamList, "ChatList">;

const keyExtractor = (item: ConversationItem) => item.id;

export function ChatListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"priority" | "other">("priority");
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [quickActionMode, setQuickActionMode] = useState<"direct" | "friend" | "group" | "join">("direct");
  const [actionInputOne, setActionInputOne] = useState("");
  const [actionInputTwo, setActionInputTwo] = useState("");
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const flatListRef = useRef<FlatList<ConversationItem>>(null);

  const me = useAuthStore((s) => s.me);
  const userId = me?.id;

  const conversations = useChatStore((s) => s.conversations);
  const totalUnreadCount = useChatStore((s) => s.totalUnreadCount);
  const setConversations = useChatStore((s) => s.setConversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const upsertConversation = useChatStore((s) => s.upsertConversation);

  useEffect(() => {
    log("conversations", `Count: ${conversations.length}, TotalUnread: ${totalUnreadCount}`);
  }, [conversations, totalUnreadCount]);

  useEffect(() => {
    setupPresenceAppStateListener();
  }, []);

  const { profileMap } = useUserProfiles(conversations, userId);

  useEffect(() => {
    const peerIds = conversations
      .map((c) => getPeerUserId(c, userId))
      .filter((id): id is string => !!id);

    if (peerIds.length > 0) {
      log("presence", `Fetching presence for ${peerIds.length} peers`);
      usePresenceStore.getState().fetchPresenceBatch(peerIds);
    }
  }, [conversations, userId]);

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    const shouldShowLoader = !options?.silent && conversations.length === 0;
    if (shouldShowLoader) {
      setLoading(true);
    }

    try {
      log("load", "Fetching conversations...");
      const response = await getConversations();
      log("load", `Fetched ${response.data.length} conversations`);
      setConversations(response.data);
    } catch (error) {
      log("load", "Error fetching conversations:", error);
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [conversations.length, setConversations]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      log("focus", "Screen focused - clearing active conversation");
      setActiveConversation(null);
      void loadConversations({ silent: true });
      return () => undefined;
    }, [loadConversations, setActiveConversation]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadConversations({ silent: true });
  }, [loadConversations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = activeFilter === "priority"
      ? conversations
      : conversations.filter((item) => (item.unreadCount ?? 0) === 0);

    if (!q) return base;
    return base.filter((item) => {
      const displayName = getConversationDisplayName(item, userId, profileMap);
      return displayName.toLowerCase().includes(q);
    });
  }, [activeFilter, conversations, search, userId, profileMap]);

  const toggleConversationPin = useCallback(async (conversation: ConversationItem) => {
    const nextPinned = !conversation.isPinned;
    if (nextPinned) {
      const pinnedCount = useChatStore.getState().conversations.filter((item) => item.isPinned).length;
      if (pinnedCount >= 3) {
        Alert.alert("Không thể ghim", "Bạn chỉ được ghim tối đa 3 cuộc hội thoại.");
        return;
      }
    }

    const previousPinnedAt = conversation.pinnedAt ?? null;
    upsertConversation({
      id: conversation.id,
      isPinned: nextPinned,
      pinnedAt: nextPinned ? new Date().toISOString() : null,
    });

    try {
      const response = nextPinned
        ? await pinConversation(conversation.id)
        : await unpinConversation(conversation.id);
      upsertConversation(response.data);
    } catch (error) {
      upsertConversation({
        id: conversation.id,
        isPinned: Boolean(conversation.isPinned),
        pinnedAt: previousPinnedAt,
      });
      Alert.alert("Không thể cập nhật ghim", toApiErrorMessage(error));
    }
  }, [upsertConversation]);

  const openConversationActions = useCallback((conversation: ConversationItem) => {
    Alert.alert(
      getConversationDisplayName(conversation, userId, profileMap),
      "Chọn thao tác",
      [
        {
          text: conversation.isPinned ? "Bỏ ghim cuộc hội thoại" : "Ghim cuộc hội thoại",
          onPress: () => {
            void toggleConversationPin(conversation);
          },
        },
        {
          text: "Mở cuộc hội thoại",
          onPress: () => navigation.navigate("ChatDetail", { conversation }),
        },
        { text: "Hủy", style: "cancel" },
      ],
    );
  }, [navigation, profileMap, toggleConversationPin, userId]);

  useEffect(() => {
    log("filtered", `Count: ${filtered.length}`);
  }, [filtered]);

  const renderItem = useCallback(({ item }: { item: ConversationItem }) => {
    const displayName = getConversationDisplayName(item, userId, profileMap);
    const previewText = getConversationLastMessagePreview(item, userId, profileMap);
    const peerId = getPeerUserId(item, userId);
    return (
      <ChatItem
        item={item}
        displayName={displayName}
        previewText={previewText}
        peerId={peerId ?? undefined}
        onPress={() => {
          log("navigate", `Opening conversation: ${item.id.slice(0, 8)}`);
          navigation.navigate("ChatDetail", { conversation: item });
        }}
        onLongPress={() => openConversationActions(item)}
      />
    );
  }, [navigation, openConversationActions, userId, profileMap]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
      <Text style={styles.emptySubtext}>
        Bắt đầu nhắn tin với bạn bè ngay!
      </Text>
    </View>
  ), []);

  const resetQuickActionForm = useCallback(() => {
    setActionInputOne("");
    setActionInputTwo("");
    setQuickActionLoading(false);
  }, []);

  const openQuickActionModal = useCallback(() => {
    setQuickActionMode("direct");
    resetQuickActionForm();
    setShowQuickActionModal(true);
  }, [resetQuickActionForm]);

  const closeQuickActionModal = useCallback(() => {
    setShowQuickActionModal(false);
    resetQuickActionForm();
  }, [resetQuickActionForm]);

  const quickActionTitle = useMemo(() => {
    if (quickActionMode === "friend") return "Thêm bạn bằng email";
    if (quickActionMode === "group") return "Tạo nhóm";
    if (quickActionMode === "join") return "Vào nhóm bằng mã";
    return "Mở chat riêng";
  }, [quickActionMode]);

  const quickActionPlaceholderOne = useMemo(() => {
    if (quickActionMode === "friend") return "Email người dùng";
    if (quickActionMode === "group") return "Tên nhóm";
    if (quickActionMode === "join") return "Mã mời";
    return "User ID";
  }, [quickActionMode]);

  const quickActionPlaceholderTwo = useMemo(() => {
    if (quickActionMode === "group") return "Danh sách User ID, cách nhau bởi dấu phẩy";
    return "";
  }, [quickActionMode]);

  const runQuickAction = useCallback(async () => {
    if (quickActionLoading) {
      return;
    }

    setQuickActionLoading(true);

    try {
      if (quickActionMode === "friend") {
        const email = actionInputOne.trim().toLowerCase();
        if (!email) {
          throw new Error("Vui lòng nhập email");
        }

        const user = await searchUserByEmail(email);
        await addFriend(user.data.id);
        await loadConversations({ silent: true });
        closeQuickActionModal();
        return;
      }

      if (quickActionMode === "direct") {
        const targetUserId = actionInputOne.trim();
        if (!targetUserId) {
          throw new Error("Vui lòng nhập User ID");
        }

        const response = await createDirectConversation(targetUserId);
        await loadConversations({ silent: true });
        closeQuickActionModal();
        navigation.navigate("ChatDetail", { conversation: response.data });
        return;
      }

      if (quickActionMode === "group") {
        const groupName = actionInputOne.trim();
        const memberIds = actionInputTwo
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        if (!groupName) {
          throw new Error("Vui lòng nhập tên nhóm");
        }

        if (memberIds.length === 0) {
          throw new Error("Vui lòng nhập ít nhất 1 thành viên");
        }

        const response = await createGroupConversation(groupName, memberIds);
        await loadConversations({ silent: true });
        closeQuickActionModal();
        navigation.navigate("ChatDetail", { conversation: response.data });
        return;
      }

      const inviteCode = actionInputOne.trim();
      if (!inviteCode) {
        throw new Error("Vui lòng nhập mã mời");
      }

      const response = await joinGroupByInviteCode(inviteCode);
      await loadConversations({ silent: true });
      closeQuickActionModal();
      navigation.navigate("ChatDetail", { conversation: response.data });
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Không thể thực hiện thao tác";
      const message = toApiErrorMessage(error) || fallback;
      Alert.alert("Thông báo", message);
      setQuickActionLoading(false);
    }
  }, [
    actionInputOne,
    actionInputTwo,
    closeQuickActionModal,
    loadConversations,
    navigation,
    quickActionLoading,
    quickActionMode,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Tin nhắn</Text>
            {totalUnreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.composeButton,
              pressed && styles.composeButtonPressed,
            ]}
            onPress={openQuickActionModal}
          >
            <Text style={styles.composeIcon}>✏️</Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[
          styles.searchContainer,
          searchFocused && styles.searchContainerFocused,
        ]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <Pressable
            onPress={() => setActiveFilter("priority")}
            style={[
              styles.filterTab,
              activeFilter === "priority" && styles.filterTabActive,
            ]}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === "priority" && styles.filterTabTextActive,
            ]}>
              Ưu tiên
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveFilter("other")}
            style={[
              styles.filterTab,
              activeFilter === "other" && styles.filterTabActive,
            ]}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === "other" && styles.filterTabTextActive,
            ]}>
              Khác
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Chat List */}
      {loading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          removeClippedSubviews={true}
          maxToRenderPerBatch={15}
          windowSize={10}
          initialNumToRender={15}
          updateCellsBatchingPeriod={50}
          extraData={`${conversations.length}-${totalUnreadCount}-${Object.keys(profileMap).length}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.listContent}
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

      <Modal
        visible={showQuickActionModal}
        transparent
        animationType="fade"
        onRequestClose={closeQuickActionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{quickActionTitle}</Text>

            <View style={styles.modeRow}>
              {[
                { key: "direct", label: "Chat riêng" },
                { key: "friend", label: "Thêm bạn" },
                { key: "group", label: "Tạo nhóm" },
                { key: "join", label: "Vào nhóm" },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setQuickActionMode(item.key as "direct" | "friend" | "group" | "join");
                    setActionInputOne("");
                    setActionInputTwo("");
                  }}
                  style={[
                    styles.modeChip,
                    quickActionMode === item.key && styles.modeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      quickActionMode === item.key && styles.modeChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={actionInputOne}
              onChangeText={setActionInputOne}
              placeholder={quickActionPlaceholderOne}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              style={styles.modalInput}
            />

            {quickActionMode === "group" && (
              <TextInput
                value={actionInputTwo}
                onChangeText={setActionInputTwo}
                placeholder={quickActionPlaceholderTwo}
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                style={[styles.modalInput, styles.modalInputSecondary]}
              />
            )}

            <View style={styles.modalActionRow}>
              <Pressable style={styles.modalCancelButton} onPress={closeQuickActionModal}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={() => void runQuickAction()}>
                <Text style={styles.modalConfirmText}>
                  {quickActionLoading ? "Đang xử lý..." : "Xác nhận"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 24,
    alignItems: "center",
  },
  unreadBadgeText: {
    ...typography.caption1,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  composeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.pill,
    backgroundColor: colors.bgSecondary,
  },
  composeButtonPressed: {
    backgroundColor: colors.border,
  },
  composeIcon: {
    fontSize: 18,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.cardElevated,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm + 2,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    fontSize: 14,
    color: colors.muted,
  },
  filterContainer: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  filterTab: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabActive: {
    borderBottomColor: colors.text,
  },
  filterTabText: {
    ...typography.title2,
    color: colors.muted,
  },
  filterTabTextActive: {
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    flexGrow: 1,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: "100%",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
    ...shadows.md,
  },
  modalTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modeChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  modeChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(0,122,255,0.12)",
  },
  modeChipText: {
    ...typography.caption1,
    color: colors.muted,
    fontWeight: "600",
  },
  modeChipTextActive: {
    color: colors.primary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  modalInputSecondary: {
    marginTop: spacing.sm,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelButton: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "600",
  },
  modalConfirmButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalConfirmText: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
