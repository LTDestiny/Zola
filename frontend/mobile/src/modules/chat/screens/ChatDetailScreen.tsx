import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { addReaction, deleteForMe, recallMessage, sendMessage } from "@/modules/chat/api/chatApi";
import { inferMessageType, pickDocumentFile, pickMediaFromLibrary, uploadMedia } from "@/modules/chat/api/mediaApi";
import { MessageBubble } from "@/modules/chat/components/MessageBubble";
import { MessageInput } from "@/modules/chat/components/MessageInput";
import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";
import { useMessages } from "@/modules/chat/hooks/useMessages";
import { useAuthStore } from "@/modules/auth/authStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import { useSocketStore } from "@/modules/chat/store/socketStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { MessageItem } from "@/shared/types/api";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatDetail">;

export function ChatDetailScreen({ route, navigation }: Props) {
  const conversation = route.params.conversation;
  const me = useAuthStore((s) => s.me);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const typing = useChatStore((s) => s.typingByConversation[conversation.id] ?? false);
  const publishTyping = useSocketStore((s) => s.publishTyping);
  const { showActionSheetWithOptions } = useActionSheet();

  const { messages, loading, hasMore, loadInitial, loadMore, sendText } = useMessages(conversation.id);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    setActiveConversation(conversation.id);
    void loadInitial();
    return () => setActiveConversation(null);
  }, [conversation.id, loadInitial, setActiveConversation]);

  const onLongPressMessage = (message: MessageItem) => {
    const options = ["Copy", "Reply", "Recall", "Delete for me", "Forward", "👍", "❤️", "😂", "😮", "😢", "Cancel"];
    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions({ options, cancelButtonIndex }, async (selectedIndex) => {
      if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) return;

      try {
        if (selectedIndex === 0) {
          Alert.alert("Copy", message.content);
        }
        if (selectedIndex === 2) {
          await recallMessage(conversation.id, message.id);
        }
        if (selectedIndex === 3) {
          await deleteForMe(conversation.id, message.id);
        }
        if (selectedIndex >= 5 && selectedIndex <= 9) {
          const emojis = ["👍", "❤️", "😂", "😮", "😢"];
          await addReaction(conversation.id, message.id, emojis[selectedIndex - 5]);
        }
      } catch {
        Alert.alert("Thong bao", "Khong thuc hien duoc hanh dong");
      }
    });
  };

  const onPickImage = async () => {
    const asset = await pickMediaFromLibrary();
    if (!asset) return;
    const uploaded = await uploadMedia({
      uri: asset.uri,
      name: asset.fileName ?? `image-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    await sendMessage(conversation.id, asset.fileName ?? "Anh", {
      type: inferMessageType(uploaded.data.contentType),
      fileUrl: uploaded.data.fileUrl,
      fileName: uploaded.data.fileName,
    });
    if ((uploaded.data.contentType ?? "").startsWith("image/")) {
      setSelectedImage(uploaded.data.fileUrl);
    }
  };

  const onPickFile = async () => {
    const doc = await pickDocumentFile();
    if (!doc) return;
    const uploaded = await uploadMedia({
      uri: doc.uri,
      name: doc.name,
      mimeType: doc.mimeType ?? "application/octet-stream",
    });
    await sendMessage(conversation.id, doc.name, {
      type: inferMessageType(uploaded.data.contentType),
      fileUrl: uploaded.data.fileUrl,
      fileName: uploaded.data.fileName,
    });
  };

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.text, fontSize: 24 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 30 }} numberOfLines={1}>
              {conversation.name}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 2, fontSize: 14 }}>{typing ? "dang go..." : "online"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 21 }}>📞</Text>
          <Text style={{ color: colors.text, fontSize: 21 }}>🎥</Text>
          <Text style={{ color: colors.text, fontSize: 21 }}>☰</Text>
        </View>
      </View>

      <TypingIndicator visible={typing} />

      <FlatList
        data={reversed}
        keyExtractor={(item) => item.id}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <MessageBubble
              message={item}
              mine={item.senderId === me?.id}
              onLongPress={() => onLongPressMessage(item)}
            />
          </View>
        )}
        inverted
        onEndReached={() => {
          if (hasMore && !loading) {
            void loadMore();
          }
        }}
      />

      <MessageInput
        onSend={(value) => void sendText(value)}
        onPickImage={() => void onPickImage()}
        onPickFile={() => void onPickFile()}
        onCamera={() => Alert.alert("Camera", "Ban co the mo rong bang expo-camera")}
        onRecordAudio={() => Alert.alert("Audio", "Ban co the mo rong bang expo-av")}
        onTyping={(value) => publishTyping(conversation.id, value)}
      />

      <Modal visible={Boolean(selectedImage)} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center" }} onPress={() => setSelectedImage(null)}>
          <Text style={{ color: "white", marginBottom: 12 }}>Da gui anh. Bam de dong.</Text>
          <Text style={{ color: "white", paddingHorizontal: 16 }}>{selectedImage}</Text>
        </Pressable>
      </Modal>
    </View>
  );
}
