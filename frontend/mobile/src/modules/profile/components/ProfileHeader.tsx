import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";
import { getInitials, resolveMediaUrl } from "@/modules/profile/utils/profileFormat";

type Props = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  onPressSettings?: () => void;
};

export function ProfileHeader({ fullName, email, avatarUrl, onPressSettings }: Props) {
  const resolvedAvatar = resolveMediaUrl(avatarUrl);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryDark, "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cover}
      >
        {onPressSettings && (
          <Pressable
            onPress={onPressSettings}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        )}
      </LinearGradient>

      <View style={styles.identity}>
        <View style={styles.avatarWrap}>
          {resolvedAvatar ? (
            <Image source={{ uri: resolvedAvatar }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
            </View>
          )}
        </View>
        <View style={styles.nameWrap}>
          <Text style={styles.fullName} numberOfLines={1}>
            {fullName || "User"}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {email || "No email"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    ...shadows.md,
  },
  cover: {
    height: 132,
  },
  settingsButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  settingsButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    transform: [{ scale: 0.97 }],
  },
  settingsIcon: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  identity: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: -44,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.cardElevated,
    overflow: "hidden",
    backgroundColor: colors.avatarBg,
    ...shadows.md,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.avatarBg,
  },
  avatarText: {
    ...typography.title2,
    color: colors.avatarText,
    fontSize: 30,
  },
  nameWrap: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  fullName: {
    ...typography.title2,
    color: colors.text,
  },
  email: {
    ...typography.subhead,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
