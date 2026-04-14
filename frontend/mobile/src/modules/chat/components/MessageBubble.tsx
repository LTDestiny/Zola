import { Pressable, Text, View } from "react-native";
import type { MessageItem } from "@/shared/types/api";
import { colors } from "@/shared/theme/colors";
import { formatTime } from "@/modules/chat/utils/format";

export function MessageBubble({
  message,
  mine,
  onLongPress,
}: {
  message: MessageItem;
  mine: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther,
        maxWidth: "82%",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
      }}
    >
      {message.recalled ? (
        <Text style={{ color: colors.muted, fontStyle: "italic" }}>Tin nhan da thu hoi</Text>
      ) : (
        <>
          {message.fileUrl ? (
            <Text style={{ color: colors.primary, marginBottom: 4 }} numberOfLines={1}>
              {message.fileName ?? "tep dinh kem"}
            </Text>
          ) : null}
          <Text style={{ color: colors.text }}>{message.content}</Text>
        </>
      )}
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "right" }}>
        {formatTime(message.createdAt)}
      </Text>
      {mine ? (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: "right" }}>
          {(message.seenBy?.length ?? 0) > 1 ? "Seen" : "Sent"}
        </Text>
      ) : null}
    </Pressable>
  );
}
