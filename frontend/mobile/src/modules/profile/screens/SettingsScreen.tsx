import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { InputField } from "@/modules/profile/components/InputField";
import { SettingsItem } from "@/modules/profile/components/SettingsItem";
import { useSettingsStore } from "@/modules/profile/store/settingsStore";
import { requestForgotOtp, resetPassword } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authStore";
import { updateMyProfile } from "@/modules/chat/api/chatApi";
import type { ProfileStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

type SettingsNavigation = NativeStackNavigationProp<ProfileStackParamList, "Settings">;
type Visibility = "Public" | "Limited" | "Private";

const languageOptions = ["English", "Vietnamese"] as const;
const visibilityOptions: Array<{ value: Visibility; subtitle: string }> = [
  { value: "Public", subtitle: "Show email, phone, birthdate, and allow new messages." },
  { value: "Limited", subtitle: "Hide personal details but allow people to find you." },
  { value: "Private", subtitle: "Hide personal details and block stranger messages." },
];

function inferVisibility(profile: ReturnType<typeof useAuthStore.getState>["me"]): Visibility {
  if (!profile) return "Public";
  const hidesAny = Boolean(profile.hideBirthdate || profile.hideEmail || profile.hidePhone);
  if (!hidesAny && profile.allowStrangerMessages !== false) return "Public";
  if (profile.allowStrangerMessages === false) return "Private";
  return "Limited";
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SettingsNavigation>();
  const me = useAuthStore((s) => s.me);
  const setProfile = useAuthStore((s) => s.setProfile);

  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const twoFactorEnabled = useSettingsStore((s) => s.twoFactorEnabled);
  const pushNotifications = useSettingsStore((s) => s.pushNotifications);
  const emailNotifications = useSettingsStore((s) => s.emailNotifications);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const language = useSettingsStore((s) => s.language);
  const setTwoFactorEnabled = useSettingsStore((s) => s.setTwoFactorEnabled);
  const setPushNotifications = useSettingsStore((s) => s.setPushNotifications);
  const setEmailNotifications = useSettingsStore((s) => s.setEmailNotifications);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const visibility = useMemo(() => inferVisibility(me), [me]);
  const surface = darkMode ? darkStyles : lightStyles;

  const sendPasswordOtp = useCallback(async () => {
    const email = me?.email;
    if (!email) {
      Alert.alert("Change password", "Your account does not have an email address.");
      return;
    }

    setSendingOtp(true);
    try {
      await requestForgotOtp(email);
      Alert.alert("Change password", "Verification code sent to your email.");
    } catch {
      Alert.alert("Change password", "Unable to send verification code.");
    } finally {
      setSendingOtp(false);
    }
  }, [me?.email]);

  const changePassword = useCallback(async () => {
    const email = me?.email;
    if (!email) return;
    if (newPassword.length < 8) {
      Alert.alert("Change password", "Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Change password", "Password confirmation does not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await resetPassword(email, otpCode.trim(), newPassword);
      setPasswordModalOpen(false);
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Change password", "Password updated.");
    } catch {
      Alert.alert("Change password", "Unable to update password. Check the code and try again.");
    } finally {
      setChangingPassword(false);
    }
  }, [confirmPassword, me?.email, newPassword, otpCode]);

  const saveVisibility = useCallback(async (nextVisibility: Visibility) => {
    if (!me) return;

    const nextPrivacy = {
      Public: {
        hideBirthdate: false,
        hideEmail: false,
        hidePhone: false,
        allowStrangerMessages: true,
      },
      Limited: {
        hideBirthdate: true,
        hideEmail: true,
        hidePhone: true,
        allowStrangerMessages: true,
      },
      Private: {
        hideBirthdate: true,
        hideEmail: true,
        hidePhone: true,
        allowStrangerMessages: false,
      },
    }[nextVisibility];

    setSavingPrivacy(true);
    try {
      const response = await updateMyProfile({
        fullName: me.fullName || "User",
        phone: me.phone ?? null,
        avatarUrl: me.avatarUrl ?? null,
        gender: me.gender ?? null,
        birthdate: me.birthdate ?? null,
        ...nextPrivacy,
      });
      setProfile(response.data);
      setVisibilityModalOpen(false);
    } catch {
      Alert.alert("Privacy settings", "Unable to save profile visibility.");
    } finally {
      setSavingPrivacy(false);
    }
  }, [me, setProfile]);

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, surface.container]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, surface.card]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button">
          <Text style={[styles.backIcon, surface.primaryText]}>‹</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, surface.text]}>Settings</Text>
          <Text style={[styles.headerSubtitle, surface.muted]}>Account, notifications, privacy, and app preferences</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={[styles.sectionCard, surface.card]}>
          <Text style={[styles.sectionTitle, surface.text]}>Account Settings</Text>
          <SettingsItem
            icon="🔒"
            title="Change password"
            subtitle="Use an email verification code to set a new password."
            onPress={() => setPasswordModalOpen(true)}
          />
          <View style={styles.separator} />
          <SettingsItem
            icon="2F"
            title="Two-factor authentication"
            subtitle="Require an extra verification step on sign-in."
            switchValue={twoFactorEnabled}
            onSwitchChange={(value) => void setTwoFactorEnabled(value)}
          />
        </View>

        <View style={[styles.sectionCard, surface.card]}>
          <Text style={[styles.sectionTitle, surface.text]}>Notification Settings</Text>
          <SettingsItem
            icon="🔔"
            title="Push notifications"
            subtitle="Receive realtime message and friend request alerts."
            switchValue={pushNotifications}
            onSwitchChange={(value) => void setPushNotifications(value)}
          />
          <View style={styles.separator} />
          <SettingsItem
            icon="@"
            title="Email notifications"
            subtitle="Send important account and security updates to email."
            switchValue={emailNotifications}
            onSwitchChange={(value) => void setEmailNotifications(value)}
          />
        </View>

        <View style={[styles.sectionCard, surface.card]}>
          <Text style={[styles.sectionTitle, surface.text]}>Privacy Settings</Text>
          <SettingsItem
            icon="👁"
            title="Profile visibility"
            subtitle="Controls what other users can see on your profile."
            valueLabel={savingPrivacy ? "Saving..." : visibility}
            onPress={() => setVisibilityModalOpen(true)}
          />
        </View>

        <View style={[styles.sectionCard, surface.card]}>
          <Text style={[styles.sectionTitle, surface.text]}>App Settings</Text>
          <SettingsItem
            icon="◐"
            title="Dark mode"
            subtitle="Use a darker settings surface on this device."
            switchValue={darkMode}
            onSwitchChange={(value) => void setDarkMode(value)}
          />
          <View style={styles.separator} />
          <SettingsItem
            icon="文"
            title="Language"
            subtitle="Choose the app language preference."
            valueLabel={language}
            onPress={() => setLanguageModalOpen(true)}
          />
        </View>
      </ScrollView>

      <Modal visible={passwordModalOpen} transparent animationType="fade" onRequestClose={() => setPasswordModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPasswordModalOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change password</Text>
            <Pressable onPress={() => void sendPasswordOtp()} disabled={sendingOtp} style={styles.otpButton}>
              <Text style={styles.otpButtonText}>{sendingOtp ? "Sending code..." : "Send verification code"}</Text>
            </Pressable>
            <InputField label="Verification code" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" />
            <InputField label="New password" value={newPassword} onChangeText={setNewPassword} />
            <InputField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPasswordModalOpen(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void changePassword()} disabled={changingPassword} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{changingPassword ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={visibilityModalOpen} transparent animationType="fade" onRequestClose={() => setVisibilityModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisibilityModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Profile visibility</Text>
            {visibilityOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => void saveVisibility(option.value)}
                disabled={savingPrivacy}
                style={styles.optionRow}
              >
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>{option.value}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                {visibility === option.value && <Text style={styles.optionCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={languageModalOpen} transparent animationType="fade" onRequestClose={() => setLanguageModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLanguageModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Language</Text>
            {languageOptions.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  void setLanguage(option);
                  setLanguageModalOpen(false);
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>{option}</Text>
                {language === option && <Text style={styles.optionCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const lightStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
  },
  card: {
    backgroundColor: colors.cardElevated,
  },
  text: {
    color: colors.text,
  },
  primaryText: {
    color: colors.primary,
  },
  muted: {
    color: colors.muted,
  },
});

const darkStyles = StyleSheet.create({
  container: {
    backgroundColor: "#07111F",
  },
  card: {
    backgroundColor: "#0E1D2F",
  },
  text: {
    color: "#F8FAFC",
  },
  primaryText: {
    color: "#7CC4FF",
  },
  muted: {
    color: "#AAB6C5",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 34,
    lineHeight: 34,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    ...typography.title2,
  },
  headerSubtitle: {
    ...typography.caption1,
    marginTop: 2,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  sectionCard: {
    overflow: "hidden",
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.headline,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 60,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
    padding: spacing.md,
  },
  modalCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  modalTitle: {
    ...typography.title3,
    color: colors.text,
  },
  otpButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  otpButtonText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  optionRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  optionSubtitle: {
    ...typography.caption1,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  optionCheck: {
    ...typography.headline,
    color: colors.primary,
  },
});
