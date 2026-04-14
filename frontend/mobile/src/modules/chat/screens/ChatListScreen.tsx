import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getConversations } from "@/modules/chat/api/chatApi";
import { ChatItem } from "@/modules/chat/components/ChatItem";
import { useChatStore } from "@/modules/chat/store/chatStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatList">;

export function ChatListScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"priority" | "other">("priority");

  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    const shouldShowLoader = !options?.silent && conversations.length === 0;
    if (shouldShowLoader) {
      setLoading(true);
    }

    try {
      const response = await getConversations();
      setConversations(response.data);
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
    }
  }, [conversations.length, setConversations]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      setActiveConversation(null);
      void loadConversations({ silent: true });
      return () => undefined;
    }, [loadConversations, setActiveConversation]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = activeFilter === "priority" ? conversations : conversations.filter((item) => (item.unreadCount ?? 0) === 0);
    if (!q) return base;
    return base.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeFilter, conversations, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>Tin nhan</Text>
          <Text style={{ color: colors.text, fontSize: 26, lineHeight: 28 }}>+</Text>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tim kiem"
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 11,
            color: colors.text,
            fontSize: 16,
          }}
        />

        <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
          <Pressable onPress={() => setActiveFilter("priority")}>
            <Text style={{ color: activeFilter === "priority" ? colors.text : colors.muted, fontSize: 28, fontWeight: "700" }}>
              Uu tien
            </Text>
            {activeFilter === "priority" ? (
              <View style={{ marginTop: 4, height: 3, backgroundColor: colors.text, borderRadius: 999 }} />
            ) : null}
          </Pressable>
          <Pressable onPress={() => setActiveFilter("other")}>
            <Text style={{ color: activeFilter === "other" ? colors.text : colors.muted, fontSize: 28, fontWeight: "700" }}>
              Khac
            </Text>
            {activeFilter === "other" ? (
              <View style={{ marginTop: 4, height: 3, backgroundColor: colors.text, borderRadius: 999 }} />
            ) : null}
          </Pressable>
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ChatItem
              item={item}
              onPress={() => navigation.navigate("ChatDetail", { conversation: item })}
            />
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.muted, marginTop: 24 }}>Khong co cuoc tro chuyen</Text>}
        />
      )}
    </View>
  );
}
