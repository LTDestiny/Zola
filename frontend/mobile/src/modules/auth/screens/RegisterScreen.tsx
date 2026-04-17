import { useState, useRef } from "react";
import {
  Alert,
  Animated,
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
import { registerWithEmail, toErrorMessage } from "@/modules/auth/authApi";
import type { AuthStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTER SCREEN - Premium iOS Style (Apple HIG)
// ═══════════════════════════════════════════════════════════════════════════════

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  // Animation for button press
  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const submit = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert("Thông báo", "Họ tên không hợp lệ");
      return;
    }
    if (!email.includes("@") || password.length < 6 || confirmPassword !== password) {
      Alert.alert("Thông báo", "Thông tin đăng ký không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({
        fullName,
        email,
        password,
        confirmPassword,
        acceptedPolicy: true,
        policyVersion: "1.0",
      });
      Alert.alert("Thành công", "Đăng ký thành công, vui lòng đăng nhập", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error) {
      Alert.alert("Đăng ký thất bại", toErrorMessage(error));
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
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Tạo tài khoản</Text>
            <Text style={styles.subtitle}>
              Điền thông tin để bắt đầu sử dụng Zola
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name Input */}
            <View style={[
              styles.inputContainer,
              nameFocused && styles.inputFocused,
            ]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Họ và tên"
                placeholderTextColor={colors.placeholder}
                autoComplete="name"
                style={styles.input}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            {/* Email Input */}
            <View style={[
              styles.inputContainer,
              emailFocused && styles.inputFocused,
            ]}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Input */}
            <View style={[
              styles.inputContainer,
              passwordFocused && styles.inputFocused,
            ]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mật khẩu"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                autoComplete="password-new"
                style={styles.input}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={[
              styles.inputContainer,
              confirmFocused && styles.inputFocused,
            ]}>
              <Text style={styles.inputIcon}>🔐</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                autoComplete="password-new"
                style={styles.input}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              Bằng việc đăng ký, bạn đồng ý với{" "}
              <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{" "}
              <Text style={styles.termsLink}>Chính sách bảo mật</Text>
            </Text>

            {/* Register Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                disabled={loading}
                onPress={submit}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={[styles.registerButton, loading && styles.buttonDisabled]}
              >
                <Text style={styles.registerButtonText}>
                  {loading ? "Đang xử lý..." : "Đăng ký"}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Login Link */}
            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={({ pressed }) => [
                styles.loginLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.loginLinkText}>
                Đã có tài khoản? <Text style={styles.loginLinkHighlight}>Đăng nhập</Text>
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
    paddingHorizontal: spacing.xl,
  },
  header: {
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.pill,
    backgroundColor: colors.bgSecondary,
  },
  backButtonPressed: {
    backgroundColor: colors.border,
  },
  backIcon: {
    fontSize: 28,
    color: colors.text,
    marginTop: -2,
  },
  titleContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.cardElevated,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.lg,
  },
  terms: {
    ...typography.footnote,
    color: colors.muted,
    textAlign: "center",
    marginVertical: spacing.lg,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "500",
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    ...typography.headline,
    color: "#FFFFFF",
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  loginLinkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loginLinkHighlight: {
    color: colors.primary,
    fontWeight: "600",
  },
});
