import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "@/shared/theme/colors";

export function MessageInput({
  onSend,
  onPickImage,
  onPickFile,
  onCamera,
  onRecordAudio,
  onTyping,
}: {
  onSend: (value: string) => void;
  onPickImage: () => void;
  onPickFile: () => void;
  onCamera: () => void;
  onRecordAudio: () => void;
  onTyping: (typing: boolean) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={onCamera}><Text style={{ fontSize: 20 }}>📷</Text></Pressable>
        <Pressable onPress={onPickImage}><Text style={{ fontSize: 20 }}>🖼️</Text></Pressable>
        <Pressable onPress={onPickFile}><Text style={{ fontSize: 20 }}>📎</Text></Pressable>
        <Pressable onPress={onRecordAudio}><Text style={{ fontSize: 20 }}>🎤</Text></Pressable>

        <TextInput
          value={value}
          onChangeText={(text) => {
            setValue(text);
            onTyping(text.trim().length > 0);
          }}
          placeholder="Nhap tin nhan..."
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.bg,
            color: colors.text,
          }}
        />

        <Pressable
          onPress={() => {
            onSend(value);
            setValue("");
            onTyping(false);
          }}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Gui</Text>
        </Pressable>
      </View>
    </View>
  );
}
