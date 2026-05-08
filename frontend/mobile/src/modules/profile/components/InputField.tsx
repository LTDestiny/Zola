import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onPress?: () => void;
  rightLabel?: string;
};

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  readonly,
  keyboardType,
  onPress,
  rightLabel,
}: Props) {
  const input = (
    <View style={[styles.inputShell, readonly && styles.inputShellReadonly]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        editable={!readonly && !onPress}
        keyboardType={keyboardType}
        style={[styles.input, readonly && styles.inputReadonly]}
        pointerEvents={onPress ? "none" : "auto"}
        accessibilityLabel={label}
      />
      {rightLabel && <Text style={styles.rightLabel}>{rightLabel}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {input}
        </Pressable>
      ) : (
        input
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption1,
    color: colors.muted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  inputShell: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardElevated,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  inputShellReadonly: {
    backgroundColor: colors.bgSecondary,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 46,
    paddingVertical: 0,
    color: colors.text,
  },
  inputReadonly: {
    color: colors.muted,
  },
  rightLabel: {
    ...typography.headline,
    color: colors.muted,
    marginLeft: spacing.sm,
  },
  pressed: {
    opacity: 0.76,
  },
});
