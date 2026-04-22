import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
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
import { getConversations } from "@/modules/chat/api/chatApi";
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
  const flatListRef = useRef<FlatList<ConversationItem>>(null);

  const me = useAuthStore((s) => s.me);
  const userId = me?.id;

  const conversations = useChatStore((s) => s.conversations);
  const totalUnreadCount = useChatStore((s) => s.totalUnreadCount);
  const setConversations = useChatStore((s) => s.setConversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

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
      />
    );
  }, [navigation, userId, profileMap]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
      <Text style={styles.emptySubtext}>
        Bắt đầu nhắn tin với bạn bè ngay!
      </Text>
    </View>
  ), []);

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
});
