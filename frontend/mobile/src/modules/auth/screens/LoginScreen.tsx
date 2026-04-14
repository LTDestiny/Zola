import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loginWithEmailPassword, toErrorMessage } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authStore";
import type { AuthStackParamList } from "@/shared/types/navigation";
import { colors } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const loginSuccess = useAuthStore((s) => s.loginSuccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert("Thong bao", "Email hoac mat khau khong hop le");
      return;
    }

    setLoading(true);
    try {
      const response = await loginWithEmailPassword({
        email,
        password,
        deviceName: "android-app",
        deviceType: "MOBILE",
      });
      await loginSuccess(response.data);
    } catch (error) {
      Alert.alert("Dang nhap that bai", toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 6 }}>Zola Mobile</Text>
      <Text style={{ color: colors.muted, marginBottom: 20 }}>Dang nhap de tiep tuc</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Mat khau"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: "white" }}
      />

      <Pressable
        disabled={loading}
        onPress={submit}
        style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>{loading ? "Dang dang nhap..." : "Dang nhap"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Register")} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: colors.primary }}>Chua co tai khoan? Dang ky</Text>
      </Pressable>
    </View>
  );
}
