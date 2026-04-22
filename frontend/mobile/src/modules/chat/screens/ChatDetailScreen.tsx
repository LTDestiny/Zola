import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActionSheet } from "@expo/react-native-action-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addReaction,
  deleteForMe,
  editMessage,
  forwardMessage,
  recallMessage,
  removeReaction,
  sendMessage,
} from "@/modules/chat/api/chatApi";
import {
  inferMessageType,
  pickDocumentFile,
  pickMediaFromLibrary,
  uploadMedia,
} from "@/modules/chat/api/mediaApi";
import {
  InAppCallOverlay,
  type ActiveCallView,
  type InAppCallMode,
  type InAppCallStatus,
  type IncomingCallView,
} from "@/modules/chat/components/InAppCallOverlay";
import { MessageBubble } from "@/modules/chat/components/MessageBubble";
import { MessageInput } from "@/modules/chat/components/MessageInput";
import { PresenceBadge } from "@/modules/chat/components/PresenceBadge";
import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";
import { useMessages } from "@/modules/chat/hooks/useMessages";
import { useTyping } from "@/modules/chat/hooks/useTyping";
import { useAuthStore } from "@/modules/auth/authStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { usePresenceStore, getPresenceLabel as getStoredPresenceLabel } from "@/modules/chat/store/presenceStore";
import {
  fetchUserProfile,
  getConversationDisplayName,
  getPeerUserId,
} from "@/modules/chat/utils/conversationUtils";
import { useSocketStore } from "@/modules/chat/store/socketStore";
import { socketService, type CallRealtimeEvent } from "@/modules/chat/socket/socketService";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { ConversationItem, MessageItem } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

const DEBUG = false;
const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const CALL_CONNECT_TIMEOUT_MS = 30000;
const GROUP_CALL_SOLO_TIMEOUT_MS = 30000;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[ChatDetail][${tag}]`, ...args);
  }
}

type Props = NativeStackScreenProps<ChatStackParamList, "ChatDetail">;

type GroupCallNotice = {
  callId: string;
  conversationId: string;
  initiatorUserId: string;
  initiatorDisplayName: string;
  mode: InAppCallMode;
  createdAt: string;
};

type IncomingCallState = IncomingCallView & {
  conversationId: string;
  conversationType: "private" | "group";
  initiatorUserId: string;
  peerUserId: string;
};

type DirectCallSession = ActiveCallView & {
  conversationId: string;
  conversationType: "private" | "group";
  initiatorUserId: string;
  peerUserId?: string;
  direction: "incoming" | "outgoing";
  participantIds: string[];
};

type ParsedCallSignalPayload = {
  reason?: string;
};

const keyExtractor = (item: MessageItem) => item.id;

function parseCallSignalPayload(payload: string | null): ParsedCallSignalPayload {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload) as ParsedCallSignalPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function isWithinWindow(createdAt: string | null | undefined, windowMs: number) {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs < windowMs;
}

function inferConversationType(conversation: ConversationItem): "private" | "group" {
  if (conversation.type === "private" || conversation.type === "group") {
    return conversation.type;
  }

  return (conversation.participants?.length ?? 0) > 2 ? "group" : "private";
}

function buildCallDedupKey(event: CallRealtimeEvent) {
  return `${event.signalType}|${event.callId}|${event.actorId}|${event.targetUserId ?? "-"}|${event.createdAt}`;
}

export function ChatDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const conversation = route.params.conversation;
  const conversationId = conversation.id;
  const conversationType = inferConversationType(conversation);

  const me = useAuthStore((s) => s.me);
  const meId = me?.id;

  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolvedParticipantNameMap, setResolvedParticipantNameMap] = useState<Record<string, string>>({});

  const initialDisplayName = useMemo(
    () => getConversationDisplayName(conversation, meId),
    [conversation, meId],
  );

  const displayName = resolvedName ?? initialDisplayName;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const conversations = useChatStore((s) => s.conversations);
  const appendMessageRealtime = useChatStore((s) => s.appendMessageRealtime);

  const typing = useChatStore(
    useCallback((s) => s.typingByConversation[conversationId] ?? false, [conversationId]),
  );

  const peerUserId = useMemo(
    () => getPeerUserId(conversation, meId),
    [conversation, meId],
  );

  const presenceState = usePresenceStore(
    useCallback((s) => (peerUserId ? s.presenceMap[peerUserId] : null), [peerUserId]),
  );
  const isOnline = presenceState?.online ?? false;
  const lastSeenAt = presenceState?.lastSeenAt ?? null;

  useEffect(() => {
    const targetPeerUserId = getPeerUserId(conversation, meId);
    if (!targetPeerUserId) return;

    void fetchUserProfile(targetPeerUserId).then((profile) => {
      if (profile?.fullName) {
        setResolvedName(profile.fullName);
      }
    });
  }, [conversation, meId]);

  const ensureParticipantName = useCallback(async (userId: string) => {
    if (!userId || resolvedParticipantNameMap[userId]) {
      return;
    }

    if (userId === meId) {
      setResolvedParticipantNameMap((prev) => ({ ...prev, [userId]: "Bạn" }));
      return;
    }

    const profile = await fetchUserProfile(userId);
    setResolvedParticipantNameMap((prev) => ({
      ...prev,
      [userId]: profile?.fullName ?? `User ${userId.slice(0, 8)}`,
    }));
  }, [meId, resolvedParticipantNameMap]);

  useEffect(() => {
    if (peerUserId && !presenceState) {
      usePresenceStore.getState().fetchPresenceBatch([peerUserId]);
    }
  }, [peerUserId, presenceState]);

  const presenceLabel = useMemo(() => {
    if (typing) {
      return "Đang nhập...";
    }
    return getStoredPresenceLabel(isOnline, lastSeenAt, "vi");
  }, [typing, isOnline, lastSeenAt]);

  const presenceColor = useMemo(() => {
    if (typing) return colors.primary;
    if (isOnline) return colors.success;
    return colors.muted;
  }, [typing, isOnline]);

  const { onTextChange, onSendMessage } = useTyping(conversationId);
  const publishCallSignal = useSocketStore((s) => s.publishCallSignal);

  const { showActionSheetWithOptions } = useActionSheet();
  const { messages, loading, hasMore, loadInitial, loadMore, sendText } = useMessages(conversationId);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [groupCallNotice, setGroupCallNotice] = useState<GroupCallNotice | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [activeCall, setActiveCall] = useState<DirectCallSession | null>(null);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const flatListRef = useRef<FlatList<MessageItem>>(null);
  const processedCallEventsRef = useRef(new Set<string>());
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupSoloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOutgoingTimeout = useCallback(() => {
    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }
  }, []);

  const clearIncomingTimeout = useCallback(() => {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
  }, []);

  const clearGroupSoloTimeout = useCallback(() => {
    if (groupSoloTimeoutRef.current) {
      clearTimeout(groupSoloTimeoutRef.current);
      groupSoloTimeoutRef.current = null;
    }
  }, []);

  const clearCallRuntime = useCallback(() => {
    clearOutgoingTimeout();
    clearIncomingTimeout();
    clearGroupSoloTimeout();
    setIncomingCall(null);
    setActiveCall(null);
    setMicrophoneEnabled(true);
    setCameraEnabled(true);
  }, [clearGroupSoloTimeout, clearIncomingTimeout, clearOutgoingTimeout]);

  useEffect(() => {
    setActiveConversation(conversationId);
    void loadInitial();

    return () => {
      setActiveConversation(null);
      clearCallRuntime();
    };
  }, [clearCallRuntime, conversationId, loadInitial, setActiveConversation]);

  const onEndCall = useCallback((reason = "ended") => {
    setActiveCall((current) => {
      if (!current) {
        return current;
      }

      publishCallSignal(
        current.conversationId,
        current.conversationType === "private" ? current.peerUserId ?? null : null,
        current.callId,
        current.mode,
        "CALL_END",
        { reason },
      );

      if (conversationType === "group") {
        setGroupCallNotice((prev) => (prev?.callId === current.callId ? null : prev));
      }

      return null;
    });

    clearOutgoingTimeout();
    clearIncomingTimeout();
    clearGroupSoloTimeout();
  }, [clearGroupSoloTimeout, clearIncomingTimeout, clearOutgoingTimeout, conversationType, publishCallSignal]);

  const startOutgoingCall = useCallback((mode: InAppCallMode) => {
    if (!meId) {
      Alert.alert("Thông báo", "Không xác định được người dùng hiện tại");
      return;
    }

    if (conversationType === "private" && !peerUserId) {
      Alert.alert("Thông báo", "Không xác định được người nhận cuộc gọi");
      return;
    }

    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();

    const nextCall: DirectCallSession = {
      callId,
      conversationId,
      conversationType,
      initiatorUserId: meId,
      peerUserId: peerUserId ?? undefined,
      peerDisplayName: displayName,
      mode,
      direction: "outgoing",
      status: "calling",
      startedAt,
      connectedAt: null,
      participantIds: conversationType === "group" ? [meId] : [meId, peerUserId ?? ""].filter(Boolean),
    };

    setIncomingCall(null);
    setActiveCall(nextCall);

    if (conversationType === "group") {
      setGroupCallNotice({
        callId,
        conversationId,
        initiatorUserId: meId,
        initiatorDisplayName: me?.fullName ?? "Bạn",
        mode,
        createdAt: startedAt,
      });
    }

    publishCallSignal(
      conversationId,
      conversationType === "private" ? peerUserId ?? null : null,
      callId,
      mode,
      "CALL_INVITE",
      {
        initiatorUserId: meId,
        conversationType,
      },
    );

    clearOutgoingTimeout();
    outgoingTimeoutRef.current = setTimeout(() => {
      setActiveCall((current) => {
        if (!current || current.callId !== callId || current.status === "connected") {
          return current;
        }

        publishCallSignal(
          conversationId,
          conversationType === "private" ? peerUserId ?? null : null,
          callId,
          mode,
          "CALL_END",
          { reason: "timeout" },
        );

        Alert.alert("Thông báo", "Không có phản hồi trong 30 giây");
        return null;
      });
    }, CALL_CONNECT_TIMEOUT_MS);
  }, [clearOutgoingTimeout, conversationId, conversationType, displayName, me?.fullName, meId, peerUserId, publishCallSignal]);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall || !meId) {
      return;
    }

    const now = new Date().toISOString();
    clearIncomingTimeout();

    const next: DirectCallSession = {
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
      conversationType: incomingCall.conversationType,
      initiatorUserId: incomingCall.initiatorUserId,
      peerUserId: incomingCall.peerUserId,
      peerDisplayName: incomingCall.peerDisplayName,
      mode: incomingCall.mode,
      direction: "incoming",
      status: "connected",
      startedAt: now,
      connectedAt: now,
      participantIds:
        incomingCall.conversationType === "group"
          ? [meId, incomingCall.initiatorUserId]
          : [meId, incomingCall.peerUserId],
    };

    setIncomingCall(null);
    setActiveCall(next);

    publishCallSignal(
      incomingCall.conversationId,
      incomingCall.peerUserId,
      incomingCall.callId,
      incomingCall.mode,
      "CALL_ACCEPT",
    );

    if (incomingCall.conversationType === "group") {
      publishCallSignal(
        incomingCall.conversationId,
        null,
        incomingCall.callId,
        incomingCall.mode,
        "CALL_JOINED",
      );
    }
  }, [clearIncomingTimeout, incomingCall, meId, publishCallSignal]);

  const rejectIncomingCall = useCallback((reason = "rejected") => {
    setIncomingCall((current) => {
      if (!current) {
        return current;
      }

      publishCallSignal(
        current.conversationId,
        current.peerUserId,
        current.callId,
        current.mode,
        "CALL_REJECT",
        { reason },
      );
      return null;
    });

    clearIncomingTimeout();
  }, [clearIncomingTimeout, publishCallSignal]);

  const joinGroupCallFromNotice = useCallback(() => {
    if (!groupCallNotice || !meId) {
      return;
    }

    const now = new Date().toISOString();
    const peerName =
      resolvedParticipantNameMap[groupCallNotice.initiatorUserId] ??
      groupCallNotice.initiatorDisplayName;

    setActiveCall({
      callId: groupCallNotice.callId,
      conversationId,
      conversationType: "group",
      initiatorUserId: groupCallNotice.initiatorUserId,
      peerUserId: groupCallNotice.initiatorUserId,
      peerDisplayName: peerName,
      mode: groupCallNotice.mode,
      direction: "incoming",
      status: "connected",
      startedAt: now,
      connectedAt: now,
      participantIds: [meId, groupCallNotice.initiatorUserId],
    });

    publishCallSignal(
      conversationId,
      null,
      groupCallNotice.callId,
      groupCallNotice.mode,
      "CALL_JOINED",
    );
  }, [conversationId, groupCallNotice, meId, publishCallSignal, resolvedParticipantNameMap]);

  const handleCallEvent = useCallback((event: CallRealtimeEvent) => {
    if (!event?.callId || event.conversationId !== conversationId) {
      return;
    }

    const dedupKey = buildCallDedupKey(event);
    if (processedCallEventsRef.current.has(dedupKey)) {
      return;
    }

    processedCallEventsRef.current.add(dedupKey);
    if (processedCallEventsRef.current.size > 400) {
      const first = processedCallEventsRef.current.values().next().value;
      if (first) {
        processedCallEventsRef.current.delete(first);
      }
    }

    if (event.actorId) {
      void ensureParticipantName(event.actorId);
    }

    const payload = parseCallSignalPayload(event.payload);

    if (event.signalType === "CALL_INVITE") {
      if (!meId || event.actorId === meId) {
        return;
      }

      const actorName = resolvedParticipantNameMap[event.actorId] ?? `User ${event.actorId.slice(0, 8)}`;

      if (conversationType === "group") {
        setGroupCallNotice({
          callId: event.callId,
          conversationId: event.conversationId,
          initiatorUserId: event.actorId,
          initiatorDisplayName: actorName,
          mode: event.mode,
          createdAt: event.createdAt,
        });
      }

      setIncomingCall({
        callId: event.callId,
        conversationId: event.conversationId,
        conversationType,
        initiatorUserId: event.actorId,
        peerUserId: event.actorId,
        peerDisplayName: actorName,
        mode: event.mode,
      });

      clearIncomingTimeout();
      incomingTimeoutRef.current = setTimeout(() => {
        rejectIncomingCall("timeout");
      }, CALL_CONNECT_TIMEOUT_MS);
      return;
    }

    if (event.signalType === "CALL_ACCEPT" || event.signalType === "CALL_JOINED") {
      clearOutgoingTimeout();
      setActiveCall((current) => {
        if (!current || current.callId !== event.callId) {
          return current;
        }

        const participantIds = current.participantIds.includes(event.actorId)
          ? current.participantIds
          : [...current.participantIds, event.actorId];

        return {
          ...current,
          status: "connected",
          connectedAt: current.connectedAt ?? new Date().toISOString(),
          participantIds,
        };
      });
      return;
    }

    if (event.signalType === "CALL_LEAVE") {
      setActiveCall((current) => {
        if (!current || current.callId !== event.callId) {
          return current;
        }

        return {
          ...current,
          participantIds: current.participantIds.filter((id) => id !== event.actorId),
        };
      });
      return;
    }

    if (event.signalType === "CALL_REJECT") {
      if (activeCall?.callId === event.callId) {
        Alert.alert("Thông báo", payload.reason === "timeout" ? "Người nhận không phản hồi" : "Cuộc gọi đã bị từ chối");
        clearCallRuntime();
      }
      if (incomingCall?.callId === event.callId) {
        setIncomingCall(null);
      }
      return;
    }

    if (event.signalType === "CALL_END") {
      if (conversationType === "group") {
        setGroupCallNotice((prev) => (prev?.callId === event.callId ? null : prev));
      }
      if (activeCall?.callId === event.callId || incomingCall?.callId === event.callId) {
        clearCallRuntime();
      }
    }
  }, [
    activeCall?.callId,
    clearCallRuntime,
    clearIncomingTimeout,
    clearOutgoingTimeout,
    conversationId,
    conversationType,
    ensureParticipantName,
    incomingCall?.callId,
    meId,
    rejectIncomingCall,
    resolvedParticipantNameMap,
  ]);

  useEffect(() => {
    const unsubscribe = socketService.addCallListener(handleCallEvent);
    return () => {
      unsubscribe();
    };
  }, [handleCallEvent]);

  useEffect(() => {
    if (!activeCall || activeCall.conversationType !== "group" || activeCall.status !== "connected") {
      clearGroupSoloTimeout();
      return;
    }

    const participantCount = new Set(activeCall.participantIds.filter(Boolean)).size;
    if (participantCount > 1) {
      clearGroupSoloTimeout();
      return;
    }

    clearGroupSoloTimeout();
    groupSoloTimeoutRef.current = setTimeout(() => {
      setActiveCall((current) => {
        if (!current || current.callId !== activeCall.callId) {
          return current;
        }

        publishCallSignal(
          current.conversationId,
          null,
          current.callId,
          current.mode,
          "CALL_END",
          { reason: "solo-timeout" },
        );
        Alert.alert("Thông báo", "Cuộc gọi nhóm tự kết thúc vì chỉ còn 1 người sau 30 giây");
        return null;
      });
    }, GROUP_CALL_SOLO_TIMEOUT_MS);
  }, [activeCall, clearGroupSoloTimeout, publishCallSignal]);

  const onLongPressMessage = useCallback((message: MessageItem) => {
    const isMine = message.senderId === meId;
    const isRecalled = Boolean(message.recalled);
    const canRecall = isMine && !isRecalled && isWithinWindow(message.createdAt, RECALL_WINDOW_MS);
    const canEdit = isMine && !isRecalled && isWithinWindow(message.createdAt, EDIT_WINDOW_MS);

    type ActionHandler = () => Promise<void> | void;
    const actions: { label: string; handler: ActionHandler }[] = [];

    actions.push({
      label: "Sao chép",
      handler: () => {
        if (!isRecalled) {
          Alert.alert("Sao chép", message.content);
        }
      },
    });

    if (canEdit) {
      actions.push({
        label: "Chỉnh sửa",
        handler: () => {
          setEditingMessage(message);
          setEditDraft(message.content ?? "");
        },
      });
    }

    if (canRecall) {
      actions.push({
        label: "Thu hồi",
        handler: async () => {
          try {
            await recallMessage(conversationId, message.id);
            appendMessageRealtime(conversationId, {
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

    if (!isRecalled) {
      actions.push({
        label: "Chuyển tiếp",
        handler: () => {
          setForwardingMessage(message);
        },
      });

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

      // Add removal options for existing reactions
      if (message.reactions && message.reactions.length > 0) {
        const uniqueReactions = new Set<string>();
        for (const r of message.reactions) {
          const parts = String(r).split("|");
          const emoji = parts[1] ?? parts[0];
          if (emoji) uniqueReactions.add(emoji);
        }

        if (uniqueReactions.size > 0) {
          actions.push({
            label: "---",
            handler: () => {},
          });

          for (const emoji of uniqueReactions) {
            actions.push({
              label: `Xóa ${emoji}`,
              handler: async () => {
                try {
                  await removeReaction(conversationId, message.id, emoji);
                } catch {
                  Alert.alert("Thông báo", "Không thể xóa cảm xúc");
                }
              },
            });
          }
        }
      }
    }

    const options = [...actions.map((a) => a.label), "Hủy"];
    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions({ options, cancelButtonIndex }, async (selectedIndex) => {
      if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;
      await actions[selectedIndex]?.handler();
    });
  }, [appendMessageRealtime, conversationId, meId, showActionSheetWithOptions]);

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
  }, [onSendMessage, sendText]);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

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
      void loadMore();
    }
  }, [hasMore, loadMore, loading]);

  const extraData = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    return `${messages.length}-${lastMsg?.id ?? "none"}-${lastMsg?.content?.slice(0, 10) ?? ""}`;
  }, [messages]);

  const forwardTargets = useMemo(
    () => conversations.filter((item) => item.id !== conversationId),
    [conversations, conversationId],
  );

  const onForwardToConversation = useCallback(async (target: ConversationItem) => {
    if (!forwardingMessage) {
      return;
    }

    try {
      await forwardMessage(conversationId, forwardingMessage.id, target.id);
      setForwardingMessage(null);
      Alert.alert("Thông báo", "Đã chuyển tiếp tin nhắn");
    } catch {
      Alert.alert("Thông báo", "Không thể chuyển tiếp tin nhắn");
    }
  }, [conversationId, forwardingMessage]);

  const onSaveEditMessage = useCallback(async () => {
    const target = editingMessage;
    const content = editDraft.trim();

    if (!target) {
      return;
    }

    if (!content) {
      Alert.alert("Thông báo", "Nội dung không được để trống");
      return;
    }

    if (!isWithinWindow(target.createdAt, EDIT_WINDOW_MS)) {
      Alert.alert("Thông báo", "Không thể chỉnh sửa tin nhắn sau 15 phút");
      return;
    }

    try {
      await editMessage(conversationId, target.id, content);
      appendMessageRealtime(conversationId, {
        ...target,
        content,
        edited: true,
        updatedAt: new Date().toISOString(),
      });
      setEditingMessage(null);
      setEditDraft("");
    } catch {
      Alert.alert("Thông báo", "Không thể chỉnh sửa tin nhắn");
    }
  }, [appendMessageRealtime, conversationId, editDraft, editingMessage]);

  const activeCallView: ActiveCallView | null = activeCall
    ? {
        callId: activeCall.callId,
        peerDisplayName: activeCall.peerDisplayName,
        mode: activeCall.mode,
        status: activeCall.status,
        startedAt: activeCall.startedAt,
        connectedAt: activeCall.connectedAt,
      }
    : null;

  const incomingCallView: IncomingCallView | null = incomingCall
    ? {
        callId: incomingCall.callId,
        peerDisplayName: incomingCall.peerDisplayName,
        mode: incomingCall.mode,
      }
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
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
          <Pressable
            style={styles.headerActionButton}
            onPress={() => startOutgoingCall("voice")}
          >
            <Text style={styles.headerActionIcon}>📞</Text>
          </Pressable>
          <Pressable
            style={styles.headerActionButton}
            onPress={() => startOutgoingCall("video")}
          >
            <Text style={styles.headerActionIcon}>🎥</Text>
          </Pressable>
          {conversationType === "group" && (
            <Pressable
              style={styles.headerActionButton}
              onPress={() => navigation.navigate("GroupSettings", { conversation })}
            >
              <Text style={styles.headerActionIcon}>⚙️</Text>
            </Pressable>
          )}
        </View>
      </View>

      {groupCallNotice && !activeCall && conversationType === "group" && (
        <View style={styles.callNoticeBanner}>
          <View style={styles.callNoticeTextWrap}>
            <Text style={styles.callNoticeTitle}>
              Đang có cuộc gọi {groupCallNotice.mode === "video" ? "video" : "thoại"}
            </Text>
            <Text style={styles.callNoticeSubtitle}>
              {groupCallNotice.initiatorDisplayName} đang trong cuộc gọi này
            </Text>
          </View>
          <Pressable style={styles.callNoticeButton} onPress={joinGroupCallFromNotice}>
            <Text style={styles.callNoticeButtonText}>Tham gia</Text>
          </Pressable>
        </View>
      )}

      <TypingIndicator visible={typing} />

      <FlatList
        ref={flatListRef}
        data={reversed}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        inverted
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={15}
        initialNumToRender={20}
        updateCellsBatchingPeriod={50}
        extraData={extraData}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

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

      <Modal
        visible={Boolean(selectedImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
          <Text style={styles.modalText}>Đã gửi ảnh. Bấm để đóng.</Text>
          <Text style={styles.modalUrl}>{selectedImage}</Text>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(forwardingMessage)}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardingMessage(null)}
      >
        <View style={styles.modalOverlay}> 
          <View style={styles.actionModalCard}>
            <Text style={styles.actionModalTitle}>Chuyển tiếp tin nhắn</Text>
            <Text style={styles.actionModalSubtitle} numberOfLines={2}>
              {forwardingMessage?.content || forwardingMessage?.fileName || "Tin nhắn"}
            </Text>
            <FlatList
              data={forwardTargets}
              keyExtractor={(item) => item.id}
              style={styles.forwardList}
              renderItem={({ item }) => (
                <Pressable style={styles.forwardItem} onPress={() => void onForwardToConversation(item)}>
                  <Text style={styles.forwardItemTitle} numberOfLines={1}>
                    {getConversationDisplayName(item, meId)}
                  </Text>
                  <Text style={styles.forwardItemSub} numberOfLines={1}>
                    {item.lastMessage || "Chưa có tin nhắn"}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.forwardEmptyText}>Không có cuộc trò chuyện khả dụng</Text>
              }
            />
            <Pressable style={styles.modalCancelButton} onPress={() => setForwardingMessage(null)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditingMessage(null);
          setEditDraft("");
        }}
      >
        <View style={styles.modalOverlay}> 
          <View style={styles.actionModalCard}>
            <Text style={styles.actionModalTitle}>Chỉnh sửa tin nhắn</Text>
            <TextInput
              value={editDraft}
              onChangeText={setEditDraft}
              multiline
              maxLength={2000}
              style={styles.editInput}
              placeholder="Nhập nội dung mới..."
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.editActionRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setEditingMessage(null);
                  setEditDraft("");
                }}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={() => void onSaveEditMessage()}>
                <Text style={styles.modalSaveText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <InAppCallOverlay
        incomingCall={incomingCallView}
        activeCall={activeCallView}
        microphoneEnabled={microphoneEnabled}
        cameraEnabled={cameraEnabled}
        onAcceptIncoming={acceptIncomingCall}
        onRejectIncoming={() => rejectIncomingCall("rejected")}
        onEndCall={() => onEndCall("ended")}
        onToggleMicrophone={() => setMicrophoneEnabled((prev) => !prev)}
        onToggleCamera={() => setCameraEnabled((prev) => !prev)}
      />
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
  callNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EAF4FF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#B9DAFF",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  callNoticeTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  callNoticeTitle: {
    ...typography.subhead,
    color: "#0B5CAD",
    fontWeight: "700",
  },
  callNoticeSubtitle: {
    ...typography.caption1,
    color: "#2F6EA7",
    marginTop: 2,
  },
  callNoticeButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  callNoticeButtonText: {
    ...typography.caption1,
    color: "#FFFFFF",
    fontWeight: "700",
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
  actionModalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
  },
  actionModalTitle: {
    ...typography.title3,
    color: colors.text,
  },
  actionModalSubtitle: {
    ...typography.caption1,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forwardList: {
    maxHeight: 280,
  },
  forwardItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  forwardItemTitle: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "600",
  },
  forwardItemSub: {
    ...typography.caption1,
    color: colors.muted,
    marginTop: 2,
  },
  forwardEmptyText: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
    marginVertical: spacing.md,
  },
  modalCancelButton: {
    marginTop: spacing.md,
    alignSelf: "center",
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "600",
  },
  editInput: {
    minHeight: 110,
    maxHeight: 180,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    ...typography.body,
    color: colors.text,
    textAlignVertical: "top",
  },
  editActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalSaveButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modalSaveText: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
