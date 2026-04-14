import { Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <Text style={{ color: colors.muted, fontStyle: "italic" }}>dang nhap...</Text>
    </View>
  );
}
