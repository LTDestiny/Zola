import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActionSheet } from "@expo/react-native-action-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  addReaction,
  deleteForMe,
  recallMessage,
  sendMessage,
} from "@/modules/chat/api/chatApi";

import {
  inferMessageType,
  pickDocumentFile,
  pickMediaFromLibrary,
  uploadMedia,
} from "@/modules/chat/api/mediaApi";

import { MessageBubble } from "@/modules/chat/components/MessageBubble";
import { MessageInput } from "@/modules/chat/components/MessageInput";
import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";
import { PresenceBadge } from "@/modules/chat/components/PresenceBadge";

import { useMessages } from "@/modules/chat/hooks/useMessages";
import { useTyping } from "@/modules/chat/hooks/useTyping";

import {
  fetchUserProfile,
  getConversationDisplayName,
  getPeerUserId,
} from "@/modules/chat/utils/conversationUtils";

import { useAuthStore } from "@/modules/auth/authStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import {
  usePresenceStore,
  getPresenceLabel as getStoredPresenceLabel,
} from "@/modules/chat/store/presenceStore";

import type { ChatStackParamList } from "@/shared/types/navigation";
import type { MessageItem } from "@/shared/types/api";

import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT DETAIL SCREEN
// FIXED: subscribe realtime conversation đúng chỗ
// ═══════════════════════════════════════════════════════════════════════════════

type Props = NativeStackScreenProps<ChatStackParamList, "ChatDetail">;

const keyExtractor = (item: MessageItem) => item.id;

export function ChatDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();

  const conversation = route.params.conversation;
  const conversationId = conversation.id;

  const me = useAuthStore((s) => s.me);
  const meId = me?.id;

  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<MessageItem>>(null);

  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const { showActionSheetWithOptions } = useActionSheet();

  const { messages, loading, hasMore, loadInitial, loadMore, sendText } =
    useMessages(conversationId);

  const { onTextChange, onSendMessage } = useTyping(conversationId);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD INITIAL + ACTIVE CONVERSATION
  // ═══════════════════════════════════════════════════════════════════════════
  // Note: Conversation subscriptions are managed automatically by syncConversationSubscriptions
  // in useSocket hook based on the conversations list
  useEffect(() => {
    setActiveConversation(conversationId);
    void loadInitial();

    return () => {
      setActiveConversation(null);
    };
  }, [conversationId, loadInitial, setActiveConversation]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY NAME
  // ═══════════════════════════════════════════════════════════════════════════
  const initialDisplayName = useMemo(
    () => getConversationDisplayName(conversation, meId),
    [conversation, meId]
  );

  useEffect(() => {
    const peerId = getPeerUserId(conversation, meId);
    if (!peerId) return;

    void fetchUserProfile(peerId).then((profile) => {
      if (profile?.fullName) {
        setResolvedName(profile.fullName);
      }
    });
  }, [conversation, meId]);

  const displayName = resolvedName ?? initialDisplayName;

  // ═══════════════════════════════════════════════════════════════════════════
  // PRESENCE
  // ═══════════════════════════════════════════════════════════════════════════
  const peerUserId = useMemo(
    () => getPeerUserId(conversation, meId),
    [conversation, meId]
  );

  const presenceState = usePresenceStore(
    useCallback(
      (s) => (peerUserId ? s.presenceMap[peerUserId] : null),
      [peerUserId]
    )
  );

  const isOnline = presenceState?.online ?? false;
  const lastSeenAt = presenceState?.lastSeenAt ?? null;

  useEffect(() => {
    if (peerUserId && !presenceState) {
      usePresenceStore.getState().fetchPresenceBatch([peerUserId]);
    }
  }, [peerUserId, presenceState]);

  const typing = useChatStore(
    useCallback(
      (s) => s.typingByConversation[conversationId] ?? false,
      [conversationId]
    )
  );

  const presenceLabel = useMemo(() => {
    if (typing) return "Đang nhập...";
    return getStoredPresenceLabel(isOnline, lastSeenAt, "vi");
  }, [typing, isOnline, lastSeenAt]);

  const presenceColor = typing
    ? colors.primary
    : isOnline
      ? colors.success
      : colors.muted;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  const onSend = useCallback(
    (value: string) => {
      void sendText(value);
      onSendMessage();
    },
    [sendText, onSendMessage]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER LIST
  // ═══════════════════════════════════════════════════════════════════════════
  const renderItem = useCallback(
    ({ item }: { item: MessageItem }) => (
      <View style={styles.messageRow}>
        <MessageBubble
          message={item}
          mine={item.senderId === meId}
          onLongPress={() => { }}
        />
      </View>
    ),
    [meId]
  );

  const onEndReached = useCallback(() => {
    if (hasMore && !loading) {
      void loadMore();
    }
  }, [hasMore, loading, loadMore]);

  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{avatarLetter}</Text>
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{displayName}</Text>
            <Text style={[styles.headerStatus, { color: presenceColor }]}>
              {presenceLabel}
            </Text>
          </View>
        </View>

        {peerUserId && <PresenceBadge online={isOnline} size="sm" bordered />}
      </View>

      {/* TYPING */}
      <TypingIndicator visible={typing} />

      {/* MESSAGE LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        inverted
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        windowSize={10}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        removeClippedSubviews
        style={styles.messageList}
      />

      {/* INPUT */}
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom || spacing.md },
        ]}
      >
        <MessageInput
          onSend={onSend}
          onTextChange={onTextChange}
          onSendComplete={onSendMessage}
          onPickImage={() => { }}
          onPickFile={() => { }}
          onCamera={() => Alert.alert("Camera")}
          onRecordAudio={() => Alert.alert("Audio")}
        />
      </View>

      {/* MODAL */}
      <Modal visible={Boolean(selectedImage)} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedImage(null)}
        >
          <Text style={styles.modalText}>Đã gửi ảnh</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },

  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  backIcon: {
    fontSize: 32,
    color: colors.primary,
  },

  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.avatarBg,
    justifyContent: "center",
    alignItems: "center",
  },

  headerAvatarText: {
    ...typography.headline,
    color: colors.avatarText,
  },

  headerTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },

  headerName: {
    ...typography.headline,
    color: colors.text,
  },

  headerStatus: {
    ...typography.caption1,
  },

  messageList: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },

  messageRow: {
    paddingHorizontal: spacing.md,
  },

  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
  },

  modalText: {
    color: "#fff",
  },
});