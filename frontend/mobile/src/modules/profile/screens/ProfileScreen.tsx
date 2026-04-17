import { useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/modules/auth/authStore";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE SCREEN - Premium iOS Settings Style
// ═══════════════════════════════════════════════════════════════════════════════

type SettingsItemProps = {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
};

function SettingsItem({ icon, label, value, onPress, danger, showChevron = true }: SettingsItemProps) {
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

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.settingsItem,
          pressed && styles.settingsItemPressed,
        ]}
      >
        <View style={styles.settingsItemLeft}>
          <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>
            {label}
          </Text>
        </View>
        <View style={styles.settingsItemRight}>
          {value && <Text style={styles.settingsValue}>{value}</Text>}
          {showChevron && (
            <Text style={[styles.chevron, danger && styles.chevronDanger]}>›</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile
  };

  const handleChangePassword = () => {
    // TODO: Navigate to change password
  };

  const handleNotificationSettings = () => {
    // TODO: Navigate to notification settings
  };

  const handlePrivacySettings = () => {
    // TODO: Navigate to privacy settings
  };

  const handleHelpSupport = () => {
    // TODO: Navigate to help & support
  };

  const handleAbout = () => {
    // TODO: Navigate to about
  };

  const handleLogout = () => {
    void logout();
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Header with Safe Area */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Cá nhân</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(me?.fullName ?? "U")}
              </Text>
            </View>
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.fullName}>{me?.fullName ?? "Người dùng"}</Text>
            <Text style={styles.email}>{me?.email ?? "Chưa có email"}</Text>
          </View>
          <Pressable
            onPress={handleEditProfile}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.editButtonPressed,
            ]}
          >
            <Text style={styles.editButtonText}>Chỉnh sửa</Text>
          </Pressable>
        </View>

        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài khoản</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon="👤"
              label="Thông tin cá nhân"
              onPress={handleEditProfile}
            />
            <View style={styles.separator} />
            <SettingsItem
              icon="🔒"
              label="Đổi mật khẩu"
              onPress={handleChangePassword}
            />
            <View style={styles.separator} />
            <SettingsItem
              icon="🔔"
              label="Thông báo"
              onPress={handleNotificationSettings}
            />
            <View style={styles.separator} />
            <SettingsItem
              icon="🛡️"
              label="Quyền riêng tư"
              onPress={handlePrivacySettings}
            />
          </View>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chung</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon="❓"
              label="Trợ giúp & Hỗ trợ"
              onPress={handleHelpSupport}
            />
            <View style={styles.separator} />
            <SettingsItem
              icon="ℹ️"
              label="Về ứng dụng"
              value="v1.0.0"
              onPress={handleAbout}
            />
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon="🚪"
              label="Đăng xuất"
              onPress={handleLogout}
              danger
              showChevron={false}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Zola Messenger</Text>
          <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  header: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.md,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },
  avatarText: {
    ...typography.title2,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 32,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.online,
    borderWidth: 3,
    borderColor: colors.cardElevated,
  },
  profileInfo: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  fullName: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    color: colors.muted,
  },
  editButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
  },
  editButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  editButtonText: {
    ...typography.subheadline,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.footnote,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.sm,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.cardElevated,
  },
  settingsItemPressed: {
    backgroundColor: colors.bgSecondary,
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  iconContainerDanger: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  iconText: {
    fontSize: 16,
  },
  settingsLabel: {
    ...typography.body,
    color: colors.text,
  },
  settingsLabelDanger: {
    color: colors.danger,
  },
  settingsItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsValue: {
    ...typography.body,
    color: colors.muted,
    marginRight: spacing.xs,
  },
  chevron: {
    ...typography.title3,
    color: colors.muted,
    opacity: 0.5,
  },
  chevronDanger: {
    color: colors.danger,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },
  footer: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    ...typography.footnote,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  footerVersion: {
    ...typography.caption1,
    color: colors.placeholder,
  },
});
