import { useState, useCallback, memo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE INPUT - Premium iOS Style (iMessage + Zola)
// ═══════════════════════════════════════════════════════════════════════════════

type Props = {
  onSend: (value: string) => void;
  onPickImage: () => void;
  onPickFile: () => void;
  onCamera: () => void;
  onRecordAudio: () => void;
  onTextChange?: (text: string) => void;
  onSendComplete?: () => void;
};

function MessageInputComponent({
  onSend,
  onPickImage,
  onPickFile,
  onCamera,
  onRecordAudio,
  onTextChange,
  onSendComplete,
}: Props) {
  const [value, setValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const handleChangeText = useCallback((text: string) => {
    setValue(text);
    onTextChange?.(text);
  }, [onTextChange]);

  const onSendPressIn = () => {
    Animated.spring(sendButtonScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const onSendPressOut = () => {
    Animated.spring(sendButtonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setValue("");
    onSendComplete?.();
  }, [value, onSend, onSendComplete]);

  const hasText = value.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={onCamera}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionIcon}>📷</Text>
        </Pressable>
        <Pressable
          onPress={onPickImage}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
        </Pressable>
        <Pressable
          onPress={onPickFile}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionIcon}>📎</Text>
        </Pressable>
        <Pressable
          onPress={onRecordAudio}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionIcon}>🎤</Text>
        </Pressable>
      </View>

      {/* Input Row */}
      <View style={styles.inputRow}>
        <View style={[
          styles.inputContainer,
          inputFocused && styles.inputContainerFocused,
        ]}>
          <TextInput
            value={value}
            onChangeText={handleChangeText}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={2000}
            style={styles.input}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
          <Pressable
            onPress={handleSend}
            onPressIn={onSendPressIn}
            onPressOut={onSendPressOut}
            disabled={!hasText}
            style={[
              styles.sendButton,
              hasText ? styles.sendButtonActive : styles.sendButtonInactive,
            ]}
          >
            <Text style={[
              styles.sendIcon,
              hasText ? styles.sendIconActive : styles.sendIconInactive,
            ]}>
              ➤
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export const MessageInput = memo(MessageInputComponent);

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.pill,
    backgroundColor: colors.bgSecondary,
  },
  actionButtonPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.95 }],
  },
  actionIcon: {
    fontSize: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    maxHeight: 120,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.cardElevated,
  },
  input: {
    ...typography.body,
    color: colors.text,
    padding: 0,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: colors.bgSecondary,
  },
  sendIcon: {
    fontSize: 18,
    transform: [{ rotate: "-45deg" }],
  },
  sendIconActive: {
    color: "#FFFFFF",
  },
  sendIconInactive: {
    color: colors.muted,
  },
});
