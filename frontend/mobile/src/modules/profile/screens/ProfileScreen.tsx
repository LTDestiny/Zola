import { Pressable, Text, View } from "react-native";
import { useAuthStore } from "@/modules/auth/authStore";
import { colors } from "@/shared/theme/colors";

export function ProfileScreen() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>{me?.fullName ?? "User"}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{me?.email ?? "No email"}</Text>
      </View>

      <Pressable
        onPress={() => void logout()}
        style={{ backgroundColor: colors.danger, borderRadius: 12, padding: 12, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Dang xuat</Text>
      </Pressable>
    </View>
  );
}
