import { memo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { MessageItem } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";
import { formatTime } from "@/modules/chat/utils/format";

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE - Premium iOS Style (iMessage + Zalo)
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubbleComponent({
  message,
  mine,
  onLongPress,
}: {
  message: MessageItem;
  mine: boolean;
  onLongPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const bubbleStyle = mine ? styles.bubbleMine : styles.bubbleOther;
  const textStyle = mine ? styles.textMine : styles.textOther;

  return (
    <View style={[styles.container, mine && styles.containerMine]}>
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={[styles.bubble, bubbleStyle]}
        >
          {message.recalled ? (
            <Text style={styles.recalledText}>Tin nhắn đã thu hồi</Text>
          ) : (
            <>
              {message.fileUrl && (
                <View style={styles.fileContainer}>
                  <Text style={styles.fileIcon}>📎</Text>
                  <Text style={[styles.fileName, mine && styles.fileNameMine]} numberOfLines={1}>
                    {message.fileName ?? "Tệp đính kèm"}
                  </Text>
                </View>
              )}
              <Text style={[styles.content, textStyle]}>{message.content}</Text>
            </>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.time, mine && styles.timeMine]}>
              {formatTime(message.createdAt)}
            </Text>
            {mine && (
              <Text style={[styles.status, mine && styles.statusMine]}>
                {(message.seenBy?.length ?? 0) > 1 ? "✓✓" : "✓"}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  containerMine: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  bubbleMine: {
    backgroundColor: colors.bubbleMine,
    borderBottomRightRadius: borderRadius.xs,
  },
  bubbleOther: {
    backgroundColor: colors.bubbleOther,
    borderBottomLeftRadius: borderRadius.xs,
  },
  content: {
    ...typography.body,
    lineHeight: 22,
  },
  textMine: {
    color: colors.bubbleMineText,
  },
  textOther: {
    color: colors.bubbleOtherText,
  },
  recalledText: {
    ...typography.body,
    color: colors.muted,
    fontStyle: "italic",
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: borderRadius.sm,
  },
  fileIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  fileName: {
    ...typography.footnote,
    color: colors.primary,
    flex: 1,
  },
  fileNameMine: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  time: {
    ...typography.caption2,
    color: colors.muted,
  },
  timeMine: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  status: {
    ...typography.caption2,
    color: colors.muted,
  },
  statusMine: {
    color: "rgba(255, 255, 255, 0.7)",
  },
});
