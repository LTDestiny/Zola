import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { addReaction, deleteForMe, recallMessage, sendMessage } from "@/modules/chat/api/chatApi";
import { inferMessageType, pickDocumentFile, pickMediaFromLibrary, uploadMedia } from "@/modules/chat/api/mediaApi";
import { MessageBubble } from "@/modules/chat/components/MessageBubble";
import { MessageInput } from "@/modules/chat/components/MessageInput";
import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";
import { PresenceBadge } from "@/modules/chat/components/PresenceBadge";
import { useMessages } from "@/modules/chat/hooks/useMessages";
import { useTyping } from "@/modules/chat/hooks/useTyping";
import { fetchUserProfile, getConversationDisplayName, getPeerUserId } from "@/modules/chat/utils/conversationUtils";
import { getPresenceLabel } from "@/modules/chat/utils/timeFormatter";
import { useAuthStore } from "@/modules/auth/authStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { usePresenceStore, getPresenceLabel as getStoredPresenceLabel } from "@/modules/chat/store/presenceStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { MessageItem } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT DETAIL SCREEN - Premium iOS Style (iMessage + Zola)
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[ChatDetail][${tag}]`, ...args);
  }
}

type Props = NativeStackScreenProps<ChatStackParamList, "ChatDetail">;

const keyExtractor = (item: MessageItem) => item.id;

export function ChatDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const conversation = route.params.conversation;
  const conversationId = conversation.id;

  const me = useAuthStore((s) => s.me);
  const meId = me?.id;

  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const initialDisplayName = useMemo(
    () => getConversationDisplayName(conversation, meId),
    [conversation, meId],
  );

  useEffect(() => {
    const peerUserId = getPeerUserId(conversation, meId);
    if (!peerUserId) return;

    void fetchUserProfile(peerUserId).then((profile) => {
      if (profile?.fullName) {
        setResolvedName(profile.fullName);
      }
    });
  }, [conversation, meId]);

  const displayName = resolvedName ?? initialDisplayName;

  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const typing = useChatStore(
    useCallback((s) => s.typingByConversation[conversationId] ?? false, [conversationId]),
  );

  const peerUserId = useMemo(
    () => getPeerUserId(conversation, meId),
    [conversation, meId],
  );

  const presenceState = usePresenceStore(
    useCallback((s) => peerUserId ? s.presenceMap[peerUserId] : null, [peerUserId]),
  );
  const isOnline = presenceState?.online ?? false;
  const lastSeenAt = presenceState?.lastSeenAt ?? null;

  useEffect(() => {
    if (peerUserId && !presenceState) {
      usePresenceStore.getState().fetchPresenceBatch([peerUserId]);
    }
  }, [peerUserId, presenceState]);

  const presenceLabel = useMemo(() => {
    if (typing) {
      return 'Đang nhập...';
    }
    return getStoredPresenceLabel(isOnline, lastSeenAt, 'vi');
  }, [typing, isOnline, lastSeenAt]);

  const presenceColor = useMemo(() => {
    if (typing) return colors.primary;
    if (isOnline) return colors.success;
    return colors.muted;
  }, [typing, isOnline]);

  const { onTextChange, onSendMessage } = useTyping(conversationId);

  const { showActionSheetWithOptions } = useActionSheet();

  const { messages, loading, hasMore, loadInitial, loadMore, sendText } = useMessages(conversationId);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<MessageItem>>(null);

  useEffect(() => {
    log("mount", `Setting active conversation: ${conversationId.slice(0, 8)}`);
    setActiveConversation(conversationId);
    void loadInitial();

    return () => {
      log("unmount", "Clearing active conversation");
      setActiveConversation(null);
    };
  }, [conversationId, loadInitial, setActiveConversation]);

  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
      log("messages", `Count changed: ${prevLengthRef.current} → ${messages.length}`);
      prevLengthRef.current = messages.length;
    }
  }, [messages.length]);

  const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

  const onLongPressMessage = useCallback((message: MessageItem) => {
    const isMine = message.senderId === meId;
    const isRecalled = Boolean(message.recalled);
    const isWithin24h = message.createdAt
      ? Date.now() - Date.parse(message.createdAt) < RECALL_WINDOW_MS
      : false;

    type ActionHandler = () => Promise<void> | void;
    const actions: { label: string; handler: ActionHandler }[] = [];

    // Copy — always available, but no-op on recalled messages
    actions.push({
      label: "Sao chép",
      handler: () => {
        if (!isRecalled) Alert.alert("Sao chép", message.content);
      },
    });

    // Recall — only own, not yet recalled, within 24h
    if (isMine && !isRecalled && isWithin24h) {
      actions.push({
        label: "Thu hồi",
        handler: async () => {
          try {
            await recallMessage(conversationId, message.id);
            // Optimistic update — real state also arrives via STOMP MESSAGE_RECALLED
            useChatStore.getState().appendMessageRealtime(conversationId, {
              ...message,
              recalled: true,
              content: "Tin nhắn đã thu hồi",
              updatedAt: new Date().toISOString(),
            });
          } catch {
            Alert.alert("Thông báo", "Không thể thu hồi tin nhắn");
          }
        },
      });
    }

    // Recall expired hint — own message past 24h
    if (isMine && !isRecalled && !isWithin24h) {
      actions.push({
        label: "Thu hồi (hết hạn)",
        handler: () => {
          Alert.alert("Thông báo", "Không thể thu hồi tin nhắn sau 24 giờ");
        },
      });
    }

    // Delete for me — only own messages
    if (isMine) {
      actions.push({
        label: "Xóa phía tôi",
        handler: async () => {
          try {
            await deleteForMe(conversationId, message.id);
          } catch {
            Alert.alert("Thông báo", "Không thể xóa tin nhắn");
          }
        },
      });
    }

    // Forward — not available on recalled messages
    if (!isRecalled) {
      actions.push({
        label: "Chuyển tiếp",
        handler: () => {
          // Forward not yet implemented on mobile
        },
      });
    }

    // Emoji reactions — not on recalled messages
    if (!isRecalled) {
      const emojis = ["👍", "❤️", "😂", "😮", "😢"];
      for (const emoji of emojis) {
        actions.push({
          label: emoji,
          handler: async () => {
            try {
              await addReaction(conversationId, message.id, emoji);
            } catch {
              Alert.alert("Thông báo", "Không thể thêm cảm xúc");
            }
          },
        });
      }
    }

    const options = [...actions.map((a) => a.label), "Hủy"];
    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions({ options, cancelButtonIndex }, async (selectedIndex) => {
      if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;
      await actions[selectedIndex]?.handler();
    });
  }, [conversationId, meId, showActionSheetWithOptions]);

  const onPickImage = useCallback(async () => {
    const asset = await pickMediaFromLibrary();
    if (!asset) return;
    const uploaded = await uploadMedia({
      uri: asset.uri,
      name: asset.fileName ?? `image-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    await sendMessage(conversationId, asset.fileName ?? "Ảnh", {
      type: inferMessageType(uploaded.data.contentType),
      fileUrl: uploaded.data.fileUrl,
      fileName: uploaded.data.fileName,
    });
    if ((uploaded.data.contentType ?? "").startsWith("image/")) {
      setSelectedImage(uploaded.data.fileUrl);
    }
  }, [conversationId]);

  const onPickFile = useCallback(async () => {
    const doc = await pickDocumentFile();
    if (!doc) return;
    const uploaded = await uploadMedia({
      uri: doc.uri,
      name: doc.name,
      mimeType: doc.mimeType ?? "application/octet-stream",
    });
    await sendMessage(conversationId, doc.name, {
      type: inferMessageType(uploaded.data.contentType),
      fileUrl: uploaded.data.fileUrl,
      fileName: uploaded.data.fileName,
    });
  }, [conversationId]);

  const onSend = useCallback((value: string) => {
    void sendText(value);
    onSendMessage();
  }, [sendText, onSendMessage]);

  const reversed = useMemo(() => {
    log("reversed", `Computing reversed messages, count: ${messages.length}`);
    return [...messages].reverse();
  }, [messages]);

  const renderItem = useCallback(({ item }: { item: MessageItem }) => (
    <View style={styles.messageRow}>
      <MessageBubble
        message={item}
        mine={item.senderId === meId}
        onLongPress={() => onLongPressMessage(item)}
      />
    </View>
  ), [meId, onLongPressMessage]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loading) {
      log("loadMore", "Loading more messages...");
      void loadMore();
    }
  }, [hasMore, loading, loadMore]);

  const extraData = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    return `${messages.length}-${lastMsg?.id ?? "none"}-${lastMsg?.content?.slice(0, 10) ?? ""}`;
  }, [messages]);

  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <Pressable style={styles.headerInfo}>
          <View style={styles.headerAvatarContainer}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{avatarLetter}</Text>
            </View>
            {peerUserId && (
              <View style={styles.headerPresenceBadge}>
                <PresenceBadge online={isOnline} size="sm" bordered />
              </View>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.headerStatusRow}>
              <Text style={[styles.headerStatus, { color: presenceColor }]}>
                {presenceLabel}
              </Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerActionButton}>
            <Text style={styles.headerActionIcon}>📞</Text>
          </Pressable>
          <Pressable style={styles.headerActionButton}>
            <Text style={styles.headerActionIcon}>🎥</Text>
          </Pressable>
          <Pressable style={styles.headerActionButton}>
            <Text style={styles.headerActionIcon}>☰</Text>
          </Pressable>
        </View>
      </View>

      {/* Typing Indicator */}
      <TypingIndicator visible={typing} />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={reversed}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        inverted
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={15}
        initialNumToRender={20}
        updateCellsBatchingPeriod={50}
        extraData={extraData}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing.md }]}>
        <MessageInput
          onSend={onSend}
          onPickImage={() => void onPickImage()}
          onPickFile={() => void onPickFile()}
          onCamera={() => Alert.alert("Camera", "Bạn có thể mở rộng bằng expo-camera")}
          onRecordAudio={() => Alert.alert("Audio", "Bạn có thể mở rộng bằng expo-av")}
          onTextChange={onTextChange}
          onSendComplete={onSendMessage}
        />
      </View>

      {/* Image Preview Modal */}
      <Modal visible={Boolean(selectedImage)} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
          <Text style={styles.modalText}>Đã gửi ảnh. Bấm để đóng.</Text>
          <Text style={styles.modalUrl}>{selectedImage}</Text>
        </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.pill,
  },
  backButtonPressed: {
    backgroundColor: colors.bgSecondary,
  },
  backIcon: {
    fontSize: 32,
    color: colors.primary,
    marginTop: -4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  headerAvatarContainer: {
    position: "relative",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    ...typography.headline,
    color: colors.avatarText,
  },
  headerPresenceBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerName: {
    ...typography.headline,
    color: colors.text,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerStatus: {
    ...typography.caption1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.pill,
  },
  headerActionIcon: {
    fontSize: 20,
  },
  messageList: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  messageListContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    paddingHorizontal: spacing.md,
  },
  inputContainer: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalText: {
    ...typography.body,
    color: "#FFFFFF",
    marginBottom: spacing.md,
  },
  modalUrl: {
    ...typography.caption1,
    color: "#FFFFFF",
    opacity: 0.8,
    textAlign: "center",
  },
});
