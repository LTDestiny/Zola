import { useState, useRef } from "react";
import {
    ActivityIndicator,
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
import type { AuthStackParamList } from "@/shared/types/navigation";
import { requestForgotOtp, resetPassword, toErrorMessage } from "@/modules/auth/authApi";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

type Step = "email" | "otp" | "reset";

export function ForgotPasswordScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const otpRef = useRef<TextInput>(null);
    const newPasswordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);

    const onRequestOtp = async () => {
        if (!email.trim()) return;
        try {
            setLoading(true);
            await requestForgotOtp(email.trim());
            setStep("otp");
            setTimeout(() => otpRef.current?.focus(), 300);
        } catch (error) {
            Alert.alert("Lỗi", toErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const onContinueToReset = () => {
        if (!code.trim()) {
            Alert.alert("Thiếu mã OTP", "Vui lòng nhập mã OTP đã được gửi tới email của bạn.");
            return;
        }
        setStep("reset");
        setTimeout(() => newPasswordRef.current?.focus(), 300);
    };

    const onResetPassword = async () => {
        if (newPassword.length < 8) {
            Alert.alert("Mật khẩu quá ngắn", "Mật khẩu phải có ít nhất 8 ký tự.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Không khớp", "Mật khẩu xác nhận không khớp.");
            return;
        }
        try {
            setLoading(true);
            await resetPassword(email.trim(), code.trim(), newPassword);
            Alert.alert("Thành công", "Mật khẩu đã được đặt lại. Vui lòng đăng nhập.", [
                { text: "Đăng nhập", onPress: () => navigation.navigate("Login") },
            ]);
        } catch (error) {
            Alert.alert("Lỗi", toErrorMessage(error), [
                { text: "Thử lại OTP", onPress: () => { setStep("otp"); setCode(""); } },
                { text: "Hủy", style: "cancel" },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const stepLabels: Record<Step, string> = {
        email: "Nhập email",
        otp: "Xác nhận OTP",
        reset: "Mật khẩu mới",
    };

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Back button */}
                <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Quay lại</Text>
                </Pressable>

                {/* Title */}
                <Text style={styles.title}>Khôi phục mật khẩu</Text>
                <Text style={styles.subtitle}>
                    {step === "email" && "Nhập email để nhận mã OTP"}
                    {step === "otp" && `Mã OTP đã được gửi tới ${email}`}
                    {step === "reset" && "Tạo mật khẩu mới cho tài khoản của bạn"}
                </Text>

                {/* Step indicator */}
                <View style={styles.stepIndicator}>
                    {(["email", "otp", "reset"] as Step[]).map((s, i) => (
                        <View key={s} style={styles.stepRow}>
                            <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === "otp" && s === "email") || (step === "reset" && s !== "reset") ? styles.stepDotDone : null]} />
                            <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>{stepLabels[s]}</Text>
                            {i < 2 && <View style={styles.stepLine} />}
                        </View>
                    ))}
                </View>

                {/* Step 1: Email */}
                {step === "email" && (
                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Email của bạn"
                                placeholderTextColor={colors.muted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                value={email}
                                onChangeText={setEmail}
                                onSubmitEditing={() => void onRequestOtp()}
                                returnKeyType="next"
                                autoFocus
                            />
                        </View>
                        <Pressable
                            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, (!email.trim() || loading) && styles.buttonDisabled]}
                            onPress={() => void onRequestOtp()}
                            disabled={!email.trim() || loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Gửi mã OTP</Text>}
                        </Pressable>
                    </View>
                )}

                {/* Step 2: OTP */}
                {step === "otp" && (
                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                ref={otpRef}
                                style={styles.input}
                                placeholder="Nhập mã OTP (6 chữ số)"
                                placeholderTextColor={colors.muted}
                                keyboardType="number-pad"
                                maxLength={6}
                                value={code}
                                onChangeText={setCode}
                                onSubmitEditing={onContinueToReset}
                                returnKeyType="next"
                            />
                        </View>
                        <Pressable
                            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, (!code.trim() || loading) && styles.buttonDisabled]}
                            onPress={onContinueToReset}
                            disabled={!code.trim() || loading}
                        >
                            <Text style={styles.primaryButtonText}>Tiếp tục</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => { setStep("email"); setCode(""); }}>
                            <Text style={styles.secondaryButtonText}>← Nhập lại email</Text>
                        </Pressable>
                    </View>
                )}

                {/* Step 3: New password */}
                {step === "reset" && (
                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                ref={newPasswordRef}
                                style={styles.input}
                                placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                                placeholderTextColor={colors.muted}
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                returnKeyType="next"
                            />
                        </View>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                ref={confirmPasswordRef}
                                style={styles.input}
                                placeholder="Xác nhận mật khẩu mới"
                                placeholderTextColor={colors.muted}
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                onSubmitEditing={() => void onResetPassword()}
                                returnKeyType="done"
                            />
                        </View>
                        <Pressable
                            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, (!newPassword || !confirmPassword || loading) && styles.buttonDisabled]}
                            onPress={() => void onResetPassword()}
                            disabled={!newPassword || !confirmPassword || loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Đặt mật khẩu mới</Text>}
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => { setStep("otp"); setNewPassword(""); setConfirmPassword(""); }}>
                            <Text style={styles.secondaryButtonText}>← Nhập lại OTP</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    container: {
        paddingHorizontal: spacing.lg,
    },
    backButton: {
        alignSelf: "flex-start",
        paddingVertical: spacing.sm,
        marginBottom: spacing.lg,
    },
    backButtonText: {
        ...typography.body,
        color: colors.primary,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.muted,
        marginBottom: spacing.xl,
    },
    stepIndicator: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.border,
    },
    stepDotActive: {
        backgroundColor: colors.primary,
    },
    stepDotDone: {
        backgroundColor: colors.primary,
        opacity: 0.4,
    },
    stepLabel: {
        ...typography.caption1,
        color: colors.muted,
        marginLeft: spacing.xs,
    },
    stepLabelActive: {
        color: colors.primary,
        fontWeight: "600",
    },
    stepLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.xs,
    },
    form: {
        gap: spacing.md,
    },
    inputWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        paddingVertical: spacing.sm,
    },
    input: {
        ...typography.body,
        color: colors.text,
        paddingVertical: 0,
    },
    primaryButton: {
        height: 48,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.pill,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.sm,
    },
    primaryButtonText: {
        ...typography.body,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    secondaryButton: {
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    secondaryButtonText: {
        ...typography.body,
        color: colors.primary,
    },
});
