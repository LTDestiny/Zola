import { StyleSheet, Text, View } from "react-native";
import { colors, typography, borderRadius } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// UNREAD BADGE - Premium iOS Style
// ═══════════════════════════════════════════════════════════════════════════════

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);
  const isWide = count > 9;

  return (
    <View style={[styles.badge, isWide && styles.badgeWide]}>
      <Text style={styles.text}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
  },
  badgeWide: {
    paddingHorizontal: 8,
  },
  text: {
    ...typography.caption2,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
