import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = {
  title: string;
  subtitle?: string;
  icon?: string;
  valueLabel?: string;
  danger?: boolean;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

export function SettingsItem({
  title,
  subtitle,
  icon,
  valueLabel,
  danger,
  onPress,
  switchValue,
  onSwitchChange,
}: Props) {
  const hasSwitch = typeof switchValue === "boolean" && onSwitchChange;

  return (
    <Pressable
      onPress={hasSwitch ? undefined : onPress}
      disabled={!onPress && !hasSwitch}
      accessibilityRole={hasSwitch ? "switch" : onPress ? "button" : "text"}
      accessibilityState={hasSwitch ? { checked: switchValue } : undefined}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {icon && (
        <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}

      <View style={styles.textWrap}>
        <Text style={[styles.title, danger && styles.titleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={switchValue ? colors.primary : "#FFFFFF"}
        />
      ) : (
        <View style={styles.valueWrap}>
          {valueLabel && <Text style={styles.valueLabel}>{valueLabel}</Text>}
          {onPress && <Text style={[styles.chevron, danger && styles.titleDanger]}>›</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardElevated,
  },
  pressed: {
    backgroundColor: colors.bgSecondary,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  iconWrapDanger: {
    backgroundColor: "rgba(255, 59, 48, 0.12)",
  },
  icon: {
    fontSize: 16,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    color: colors.text,
  },
  titleDanger: {
    color: colors.danger,
  },
  subtitle: {
    ...typography.caption1,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  valueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  valueLabel: {
    ...typography.subhead,
    color: colors.muted,
  },
  chevron: {
    ...typography.title3,
    color: colors.muted,
  },
});
