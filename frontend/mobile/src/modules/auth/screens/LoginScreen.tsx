import { useState, useRef } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loginWithEmailPassword, toErrorMessage } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authStore";
import type { AuthStackParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN - Premium iOS Style (Apple HIG)
// ═══════════════════════════════════════════════════════════════════════════════

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const loginSuccess = useAuthStore((s) => s.loginSuccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
    if (!email.includes("@") || password.length < 6) {
      Alert.alert("Thông báo", "Email hoặc mật khẩu không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const response = await loginWithEmailPassword({
        email,
        password,
        deviceName: "ios-app",
        deviceType: "MOBILE",
      });
      await loginSuccess(response.data);
    } catch (error) {
      Alert.alert("Đăng nhập thất bại", toErrorMessage(error));
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
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>Z</Text>
            </View>
            <Text style={styles.appName}>Zola</Text>
            <Text style={styles.tagline}>Kết nối bạn bè, chia sẻ khoảnh khắc</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
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
                autoComplete="password"
                style={styles.input}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            {/* Forgot Password */}
            <Pressable style={styles.forgotPassword} onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </Pressable>

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                disabled={loading}
                onPress={submit}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={[styles.loginButton, loading && styles.buttonDisabled]}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <Pressable
              onPress={() => navigation.navigate("Register")}
              style={({ pressed }) => [
                styles.registerButton,
                pressed && styles.registerButtonPressed,
              ]}
            >
              <Text style={styles.registerButtonText}>
                Chưa có tài khoản? <Text style={styles.registerLink}>Đăng ký</Text>
              </Text>
            </Pressable>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  logoText: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  appName: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.subhead,
    color: colors.muted,
    textAlign: "center",
  },
  form: {
    width: "100%",
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: spacing.xl,
  },
  forgotPasswordText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    ...typography.headline,
    color: "#FFFFFF",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.footnote,
    color: colors.muted,
    marginHorizontal: spacing.md,
  },
  registerButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  registerButtonPressed: {
    opacity: 0.7,
  },
  registerButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  registerLink: {
    color: colors.primary,
    fontWeight: "600",
  },
});
