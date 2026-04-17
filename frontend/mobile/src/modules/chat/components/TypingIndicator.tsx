import { useEffect, useRef, memo } from "react";
import { Animated, Text, View, StyleSheet, Easing } from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR - Premium iOS Style (iMessage)
// ═══════════════════════════════════════════════════════════════════════════════

type Props = {
  visible: boolean;
  userName?: string;
};

function AnimatedDot({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -5,
            duration: 350,
            delay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 350,
            delay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 350,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 350,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, translateY, opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { transform: [{ translateY }], opacity },
      ]}
    />
  );
}

function TypingIndicatorComponent({ visible, userName }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.8,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]}>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={200} />
          <AnimatedDot delay={400} />
        </View>
        {userName && (
          <Text style={styles.text} numberOfLines={1}>
            {userName}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bubbleOther,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xs,
    ...shadows.sm,
  },
  text: {
    ...typography.footnote,
    color: colors.muted,
    fontStyle: "italic",
    maxWidth: 150,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 20,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
