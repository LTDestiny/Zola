import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  setupPresenceAppStateListener,
  usePresenceStore,
} from "@/modules/chat/store/presenceStore";

import { useAuthStore } from "@/modules/auth/authStore";

import {
  getConversationDisplayName,
  getPeerUserId,
} from "@/modules/chat/utils/conversationUtils";

import type { ChatStackParamList } from "@/shared/types/navigation";
import type { ConversationItem } from "@/shared/types/api";

import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from "@/shared/theme/colors";

// ═══════════════════════════════════════
// CHAT LIST SCREEN FIXED
// ═══════════════════════════════════════

type Props = NativeStackScreenProps<ChatStackParamList, "ChatList">;

const keyExtractor = (item: ConversationItem) => item.id;

export function ChatListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const flatListRef = useRef<FlatList<ConversationItem>>(null);

  const me = useAuthStore((s) => s.me);
  const userId = me?.id;

  const conversations = useChatStore((s) => s.conversations);
  const totalUnreadCount = useChatStore((s) => s.totalUnreadCount);
  const setConversations = useChatStore((s) => s.setConversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  // setup presence once
  useEffect(() => {
    setupPresenceAppStateListener();
  }, []);

  const { profileMap } = useUserProfiles(conversations, userId);

  // fetch presence when conversations changed
  useEffect(() => {
    const peerIds = conversations
      .map((item) => getPeerUserId(item, userId))
      .filter(Boolean) as string[];

    if (peerIds.length) {
      usePresenceStore.getState().fetchPresenceBatch(peerIds);
    }
  }, [conversations, userId]);

  const loadConversations = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);

      try {
        const res = await getConversations();
        setConversations(res.data ?? []);
      } catch (err) {
        console.log("load conversations error", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [setConversations]
  );

  // first load
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // focus screen
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(null);
      void loadConversations(true);
      return () => undefined;
    }, [loadConversations, setActiveConversation])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadConversations(true);
  }, [loadConversations]);

  // filter by search only
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return conversations;

    return conversations.filter((item) => {
      const name = getConversationDisplayName(item, userId, profileMap);
      return name.toLowerCase().includes(q);
    });
  }, [conversations, profileMap, search, userId]);

  const renderItem = useCallback(
    ({ item }: { item: ConversationItem }) => {
      const displayName = getConversationDisplayName(
        item,
        userId,
        profileMap
      );

      const peerId = getPeerUserId(item, userId);

      return (
        <ChatItem
          item={item}
          displayName={displayName}
          peerId={peerId ?? undefined}
          onPress={() =>
            navigation.navigate("ChatDetail", {
              conversation: item,
            })
          }
        />
      );
    },
    [navigation, profileMap, userId]
  );

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
        <Text style={styles.emptySub}>
          Hãy bắt đầu nhắn tin với bạn bè ngay
        </Text>
      </View>
    ),
    []
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.row}>
            <Text style={styles.title}>Tin nhắn</Text>

            {totalUnreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </Text>
              </View>
            )}
          </View>

          <Pressable style={styles.composeBtn}>
            <Text style={styles.composeIcon}>✏️</Text>
          </Pressable>
        </View>

        {/* SEARCH */}
        <View
          style={[
            styles.searchBox,
            searchFocused && styles.searchBoxFocused,
          ]}
        >
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
            <Pressable onPress={() => setSearch("")}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={EmptyComponent}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  title: {
    ...typography.largeTitle,
    color: colors.text,
  },

  badge: {
    minWidth: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },

  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  composeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
  },

  composeIcon: {
    fontSize: 18,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },

  searchBoxFocused: {
    borderColor: colors.primary,
  },

  searchIcon: {
    marginRight: spacing.sm,
  },

  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
  },

  clear: {
    color: colors.muted,
    fontSize: 14,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  listContent: {
    flexGrow: 1,
  },

  emptyWrap: {
    flex: 1,
    paddingTop: 120,
    alignItems: "center",
  },

  emptyEmoji: {
    fontSize: 60,
    marginBottom: spacing.md,
  },

  emptyTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  emptySub: {
    ...typography.body,
    color: colors.muted,
  },
});