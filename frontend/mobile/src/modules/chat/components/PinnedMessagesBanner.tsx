import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, Animated, LayoutAnimation } from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// PINNED MESSAGES BANNER - Premium iOS Style
// ═══════════════════════════════════════════════════════════════════════════════

type PinnedMessage = {
  sourceMessageId: string;
  title: string;
  preview: string;
  createdAtMs: number;
};

type Props = {
  pinnedMessages: PinnedMessage[];
  onPress: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  canUnpin: boolean;
};

function PinnedMessagesBannerComponent({
  pinnedMessages,
  onPress,
  onUnpin,
  canUnpin,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const safePins = useMemo(() => {
    return [...(pinnedMessages ?? [])].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [pinnedMessages]);

  if (safePins.length === 0) {
    return null;
  }

  const latest = safePins[0];
  const count = safePins.length;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <Pressable style={styles.content} onPress={() => onPress(latest.sourceMessageId)}>
          <View style={styles.iconContainer}>
            <Text style={styles.pinIcon}>📌</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {count > 1 ? `Tin nhắn ghim (${count})` : "Tin nhắn ghim"}
            </Text>
            <Text style={styles.preview} numberOfLines={isExpanded ? 3 : 1}>
              {latest.preview || latest.title || "Nội dung tin nhắn ghim"}
            </Text>
          </View>
        </Pressable>

        {count > 1 && (
          <Pressable style={styles.expandButton} onPress={toggleExpand}>
            <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
          </Pressable>
        )}

        {canUnpin && !isExpanded && (
          <Pressable style={styles.unpinButton} onPress={() => onUnpin(latest.sourceMessageId)}>
            <Text style={styles.unpinIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {isExpanded && count > 1 && (
        <View style={styles.expandedList}>
          {safePins.slice(1).map((pin) => (
            <View key={pin.sourceMessageId} style={styles.expandedItem}>
              <Pressable style={styles.expandedContent} onPress={() => onPress(pin.sourceMessageId)}>
                <Text style={styles.expandedPreview} numberOfLines={2}>
                  {pin.preview || pin.title}
                </Text>
              </Pressable>
              {canUnpin && (
                <Pressable style={styles.expandedUnpin} onPress={() => onUnpin(pin.sourceMessageId)}>
                  <Text style={styles.unpinIcon}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const PinnedMessagesBanner = memo(PinnedMessagesBannerComponent);

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(0, 104, 255, 0.05)",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  pinIcon: {
    fontSize: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.caption1,
    color: colors.primary,
    fontWeight: "700",
  },
  preview: {
    ...typography.caption1,
    color: colors.text,
    marginTop: 1,
  },
  expandButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  expandIcon: {
    fontSize: 10,
    color: colors.muted,
  },
  unpinButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  unpinIcon: {
    fontSize: 14,
    color: colors.muted,
  },
  expandedList: {
    backgroundColor: "rgba(0, 104, 255, 0.02)",
    paddingBottom: spacing.xs,
  },
  expandedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  expandedContent: {
    flex: 1,
  },
  expandedPreview: {
    ...typography.caption2,
    color: colors.muted,
  },
  expandedUnpin: {
    padding: spacing.xs,
  },
});
