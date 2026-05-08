import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AvatarUploader } from "@/modules/profile/components/AvatarUploader";
import { InputField } from "@/modules/profile/components/InputField";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { normalizeGenderLabel } from "@/modules/profile/utils/profileFormat";
import { deleteMyProfile, getMyProfile, updateMyProfile } from "@/modules/chat/api/chatApi";
import { useAuthStore } from "@/modules/auth/authStore";
import type { ProfileStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">;

const genderOptions = [
  { label: "Not set", value: "" },
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Other", value: "OTHER" },
];

function createDateParts(value?: string | null) {
  const [year = "", month = "", day = ""] = (value ?? "").split("-");
  return { year, month, day };
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ProfileNavigation>();
  const me = useAuthStore((s) => s.me);
  const setProfile = useAuthStore((s) => s.setProfile);
  const logout = useAuthStore((s) => s.logout);

  const [loading, setLoading] = useState(!me);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [fullName, setFullName] = useState(me?.fullName ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? "");
  const [gender, setGender] = useState(me?.gender ?? "");
  const [birthdate, setBirthdate] = useState(me?.birthdate ?? "");
  const [dateParts, setDateParts] = useState(createDateParts(me?.birthdate));

  useEffect(() => {
    setFullName(me?.fullName ?? "");
    setPhone(me?.phone ?? "");
    setAvatarUrl(me?.avatarUrl ?? "");
    setGender(me?.gender ?? "");
    setBirthdate(me?.birthdate ?? "");
    setDateParts(createDateParts(me?.birthdate));
  }, [me]);

  useEffect(() => {
    if (me) return;

    let mounted = true;
    setLoading(true);
    getMyProfile()
      .then((response) => {
        if (mounted) setProfile(response.data);
      })
      .catch(() => {
        if (mounted) Alert.alert("Profile", "Unable to load your profile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [me, setProfile]);

  const hasChanges = useMemo(() => {
    if (!me) return false;
    return (
      fullName.trim() !== (me.fullName ?? "") ||
      phone.trim() !== (me.phone ?? "") ||
      avatarUrl.trim() !== (me.avatarUrl ?? "") ||
      gender !== (me.gender ?? "") ||
      birthdate !== (me.birthdate ?? "")
    );
  }, [avatarUrl, birthdate, fullName, gender, me, phone]);

  const handleSave = useCallback(async () => {
    const nextName = fullName.trim();
    if (!nextName) {
      Alert.alert("Profile", "Full name is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await updateMyProfile({
        fullName: nextName,
        phone: phone.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        gender: gender || null,
        birthdate: birthdate || null,
        hideBirthdate: Boolean(me?.hideBirthdate),
        hideEmail: Boolean(me?.hideEmail),
        hidePhone: Boolean(me?.hidePhone),
        allowStrangerMessages: me?.allowStrangerMessages !== false,
      });
      setProfile(response.data);
      Alert.alert("Profile", "Information saved.");
    } catch {
      Alert.alert("Profile", "Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [avatarUrl, birthdate, fullName, gender, me, phone, setProfile]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your profile and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: deleting ? "Deleting..." : "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyProfile();
              await logout();
            } catch {
              Alert.alert("Delete account", "Unable to delete account. Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [deleting, logout]);

  const applyDate = useCallback(() => {
    const year = dateParts.year.trim();
    const month = dateParts.month.trim().padStart(2, "0");
    const day = dateParts.day.trim().padStart(2, "0");
    const next = `${year}-${month}-${day}`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      Alert.alert("Birthdate", "Use a valid date in YYYY-MM-DD format.");
      return;
    }

    setBirthdate(next);
    setDatePickerOpen(false);
  }, [dateParts]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonLineLarge} />
        <View style={styles.skeletonLine} />
        <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 108 },
        ]}
      >
        <ProfileHeader
          fullName={fullName || me?.fullName}
          email={me?.email}
          avatarUrl={avatarUrl || me?.avatarUrl}
          onPressSettings={() => navigation.navigate("Settings")}
        />

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Profile information</Text>
          <InputField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
          <InputField label="Email" value={me?.email ?? ""} readonly />
          <InputField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Add phone number"
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Avatar upload</Text>
            <AvatarUploader
              fullName={fullName || me?.fullName}
              avatarUrl={avatarUrl || me?.avatarUrl}
              uploading={uploadingAvatar}
              onUploadingChange={setUploadingAvatar}
              onUploaded={setAvatarUrl}
            />
          </View>
          <InputField
            label="Gender"
            value={normalizeGenderLabel(gender)}
            readonly
            onPress={() => setGenderPickerOpen(true)}
            rightLabel="›"
          />
          <InputField
            label="Date of birth"
            value={birthdate || "Not set"}
            readonly
            onPress={() => {
              setDateParts(createDateParts(birthdate));
              setDatePickerOpen(true);
            }}
            rightLabel="›"
          />
        </View>

        <Pressable
          onPress={handleDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed, deleting && styles.disabled]}
        >
          <Text style={styles.deleteButtonText}>{deleting ? "Deleting..." : "Delete Account"}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving || uploadingAvatar || !hasChanges}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            (saving || uploadingAvatar || !hasChanges) && styles.disabled,
          ]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save Information</Text>}
        </Pressable>
      </View>

      <Modal visible={genderPickerOpen} transparent animationType="fade" onRequestClose={() => setGenderPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGenderPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gender</Text>
            {genderOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setGender(option.value);
                  setGenderPickerOpen(false);
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                {gender === option.value && <Text style={styles.optionCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDatePickerOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Date of birth</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <InputField
                  label="Year"
                  value={dateParts.year}
                  onChangeText={(value) => setDateParts((prev) => ({ ...prev, year: value.replace(/\D/g, "").slice(0, 4) }))}
                  keyboardType="number-pad"
                  placeholder="YYYY"
                />
              </View>
              <View style={styles.dateField}>
                <InputField
                  label="Month"
                  value={dateParts.month}
                  onChangeText={(value) => setDateParts((prev) => ({ ...prev, month: value.replace(/\D/g, "").slice(0, 2) }))}
                  keyboardType="number-pad"
                  placeholder="MM"
                />
              </View>
              <View style={styles.dateField}>
                <InputField
                  label="Day"
                  value={dateParts.day}
                  onChangeText={(value) => setDateParts((prev) => ({ ...prev, day: value.replace(/\D/g, "").slice(0, 2) }))}
                  keyboardType="number-pad"
                  placeholder="DD"
                />
              </View>
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDatePickerOpen(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={applyDate} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.bgSecondary,
  },
  loadingSpinner: {
    marginTop: spacing.xl,
  },
  skeletonHeader: {
    height: 188,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  skeletonLineLarge: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  skeletonLine: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderLight,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  formCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.text,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.caption1,
    color: colors.muted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardElevated,
  },
  deleteButtonPressed: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  deleteButtonText: {
    ...typography.subhead,
    color: colors.danger,
    fontWeight: "700",
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  saveButtonText: {
    ...typography.headline,
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.55,
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
    marginBottom: spacing.xs,
  },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
  },
  optionCheck: {
    ...typography.headline,
    color: colors.primary,
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
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
});
