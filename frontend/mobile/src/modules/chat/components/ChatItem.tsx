import { useRef, memo } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { ConversationItem } from "@/shared/types/api";
import { formatTime } from "@/modules/chat/utils/format";
import { UnreadBadge } from "./UnreadBadge";
import { PresenceBadge } from "./PresenceBadge";
import { usePresenceStore } from "@/modules/chat/store/presenceStore";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT ITEM - Premium iOS Style (iMessage + Zola)
// ═══════════════════════════════════════════════════════════════════════════════

type Props = {
  item: ConversationItem;
  displayName: string;
  previewText: string;
  peerId?: string;
  onPress: () => void;
  onLongPress?: () => void;
};

function ChatItemComponent({ item, displayName, previewText, peerId, onPress, onLongPress }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isOnline = usePresenceStore(
    (s) => peerId ? s.presenceMap[peerId]?.online ?? false : false,
  );

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

  const hasUnread = (item.unreadCount ?? 0) > 0;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.container}
      >
        {/* Avatar with presence indicator */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          {peerId && (
            <View style={styles.presenceBadge}>
              <PresenceBadge online={isOnline} size="sm" bordered />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.name,
                  hasUnread && styles.nameUnread,
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {item.isPinned && <Text style={styles.pinIcon}>📌</Text>}
            </View>
            <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.message,
                hasUnread && styles.messageUnread,
              ]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
            <UnreadBadge count={item.unreadCount ?? 0} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const ChatItem = memo(ChatItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  avatarContainer: {
    position: "relative",
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.title2,
    color: colors.avatarText,
  },
  presenceBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.headline,
    color: colors.text,
    flex: 1,
  },
  nameUnread: {
    fontWeight: "700",
  },
  pinIcon: {
    fontSize: 12,
    marginLeft: spacing.xs,
  },
  time: {
    ...typography.caption1,
    color: colors.muted,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  message: {
    ...typography.subhead,
    color: colors.muted,
    flex: 1,
    marginRight: spacing.sm,
  },
  messageUnread: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
