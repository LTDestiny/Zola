// ═══════════════════════════════════════════════════════════════════════════════
// iOS PREMIUM THEME - Zola + iMessage + Telegram Style
// White elegant, minimalist, modern, smooth
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Core Colors
  primary: "#007AFF",
  primaryLight: "#4DA3FF",
  primaryDark: "#0056B3",

  // Backgrounds
  bg: "#FFFFFF",
  bgSecondary: "#F8F9FB",
  card: "#F8F9FB",
  cardElevated: "#FFFFFF",

  // Text
  text: "#111111",
  textSecondary: "#3C3C43",
  muted: "#7A7F8A",
  placeholder: "#8E8E93",

  // Borders & Dividers
  border: "#E8EAF0",
  borderLight: "#F2F2F7",
  separator: "#C6C6C8",

  // Status Colors
  success: "#34C759",
  danger: "#FF3B30",
  warning: "#FF9500",
  info: "#5AC8FA",

  // Chat Bubbles
  bubbleMine: "#007AFF",
  bubbleMineText: "#FFFFFF",
  bubbleOther: "#E9ECEF",
  bubbleOtherText: "#111111",

  // Online Status
  online: "#34C759",
  offline: "#8E8E93",

  // Tab Bar
  tabBarBg: "#FFFFFF",
  tabBarActive: "#007AFF",
  tabBarInactive: "#8E8E93",

  // Avatar
  avatarBg: "#E1E8F0",
  avatarText: "#007AFF",

  // Shadow (for style objects)
  shadowColor: "#000000",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.4)",
  overlayLight: "rgba(0, 0, 0, 0.1)",
};

// Spacing system (8pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Typography - iOS System Font
export const typography = {
  // Large Title (32pt Bold)
  largeTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
  },
  // Title 1 (28pt Bold)
  title1: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
  },
  // Title 2 (22pt Bold)
  title2: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
  },
  // Title 3 (20pt Semibold)
  title3: {
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
  },
  // Headline (17pt Semibold)
  headline: {
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
  },
  // Body (17pt Regular)
  body: {
    fontSize: 17,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
  },
  // Callout (16pt Regular)
  callout: {
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
  },
  // Subhead (15pt Regular)
  subhead: {
    fontSize: 15,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
  },
  // Footnote (13pt Regular)
  footnote: {
    fontSize: 13,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
  // Caption 1 (12pt Regular)
  caption1: {
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  // Caption 2 (11pt Regular)
  caption2: {
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0.07,
  },
};

// Border Radius
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

// Shadows (iOS style)
export const shadows = {
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
};
