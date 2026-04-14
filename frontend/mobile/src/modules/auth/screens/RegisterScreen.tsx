import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { registerWithEmail, toErrorMessage } from "@/modules/auth/authApi";
import type { AuthStackParamList } from "@/shared/types/navigation";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert("Thong bao", "Ho ten khong hop le");
      return;
    }
    if (!email.includes("@") || password.length < 6 || confirmPassword !== password) {
      Alert.alert("Thong bao", "Thong tin dang ky khong hop le");
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
      Alert.alert("Thanh cong", "Dang ky thanh cong, vui long dang nhap");
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert("Dang ky that bai", toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 20 }}>Tao tai khoan</Text>

      <TextInput value={fullName} onChangeText={setFullName} placeholder="Ho ten" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }} />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Mat khau" secureTextEntry style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }} />
      <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Nhap lai mat khau" secureTextEntry style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: "white" }} />

      <Pressable disabled={loading} onPress={submit} style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center" }}>
        <Text style={{ color: "white", fontWeight: "700" }}>{loading ? "Dang xu ly..." : "Dang ky"}</Text>
      </Pressable>
    </View>
  );
}
