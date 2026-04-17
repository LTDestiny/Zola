import { useState, useRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { verifyRegisterOtp, toErrorMessage } from "@/modules/auth/authApi";
import type { AuthStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyRegisterOtp">;

export function VerifyRegisterOtpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const submit = async () => {
    if (code.trim().length < 4) {
      Alert.alert("Thông báo", "Vui lòng nhập mã OTP đầy đủ");
      return;
    }
    setLoading(true);
    try {
      await verifyRegisterOtp({
        email,
        code: code.trim(),
        deviceName: "Mobile",
        deviceType: "MOBILE",
      });
      Alert.alert("Thành công", "Xác thực email thành công, vui lòng đăng nhập", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error) {
      Alert.alert("Xác thực thất bại", toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Xác thực email</Text>
            <Text style={styles.subtitle}>
              Nhập mã OTP đã được gửi tới
            </Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* OTP Input */}
          <View style={styles.form}>
            <View style={[styles.inputContainer, focused && styles.inputFocused]}>
              <Text style={styles.inputIcon}>🔐</Text>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={setCode}
                placeholder="Nhập mã OTP"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.input}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </View>

            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                loading && styles.submitButtonDisabled,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {loading ? "Đang xác thực..." : "Xác nhận"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
  },
  titleContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  emailText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text,
    letterSpacing: 4,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: "#fff",
  },
});
