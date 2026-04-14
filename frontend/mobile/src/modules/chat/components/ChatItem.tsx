import { Pressable, Text, View } from "react-native";
import type { ConversationItem } from "@/shared/types/api";
import { formatTime } from "@/modules/chat/utils/format";
import { UnreadBadge } from "./UnreadBadge";
import { colors } from "@/shared/theme/colors";

export function ChatItem({
  item,
  onPress,
}: {
  item: ConversationItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "#213247",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text style={{ color: "#9ec3ff", fontWeight: "700", fontSize: 19 }}>
          {item.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: item.unreadCount > 0 ? "700" : "600", fontSize: 18 }} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isPinned ? <Text style={{ fontSize: 12 }}>📌</Text> : null}
        </View>
        <Text style={{ color: colors.muted, fontWeight: item.unreadCount > 0 ? "700" : "400", fontSize: 16, marginTop: 4 }} numberOfLines={1}>
          {item.lastMessage || "Chua co tin nhan"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{formatTime(item.lastMessageAt)}</Text>
        <UnreadBadge count={item.unreadCount ?? 0} />
      </View>
    </Pressable>
  );
}
