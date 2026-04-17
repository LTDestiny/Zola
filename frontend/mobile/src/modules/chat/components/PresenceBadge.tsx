import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme/colors';
import { getPresenceLabel } from '@/modules/chat/utils/timeFormatter';

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE BADGE COMPONENT - Premium iOS Style
// ═══════════════════════════════════════════════════════════════════════════════

export interface PresenceBadgeProps {
  /** Whether the user is online */
  online: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show border (for overlaying on avatars) */
  bordered?: boolean;
}

const BADGE_SIZES = {
  sm: 10,   // 10px for mobile
  md: 12,   // 12px
  lg: 14,   // 14px
};

const BORDER_WIDTH = 2;

/**
 * Presence indicator badge for mobile.
 * 
 * @example
 * <PresenceBadge online={true} size="md" />
 */
export const PresenceBadge = memo(function PresenceBadge({
  online,
  size = 'md',
  bordered = true,
}: PresenceBadgeProps) {
  const badgeSize = BADGE_SIZES[size];

  const style = useMemo(() => ({
    width: badgeSize,
    height: badgeSize,
    borderRadius: badgeSize / 2,
    backgroundColor: online ? colors.online : colors.offline,
    borderWidth: bordered ? BORDER_WIDTH : 0,
    borderColor: colors.bg,
  }), [badgeSize, online, bordered]);

  return <View style={style} />;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE STATUS TEXT - Shows "Đang hoạt động" or "Hoạt động X phút trước"
// ═══════════════════════════════════════════════════════════════════════════════

export interface PresenceStatusProps {
  /** Whether the user is online */
  online: boolean;
  /** Last seen timestamp */
  lastSeenAt?: string | null;
  /** Display language */
  language?: 'vi' | 'en';
  /** Show badge alongside text */
  showBadge?: boolean;
  /** Badge size when shown */
  badgeSize?: 'sm' | 'md' | 'lg';
}

/**
 * Presence status text with optional badge.
 * 
 * @example
 * <PresenceStatus online={true} />
 * // "● Đang hoạt động"
 */
export const PresenceStatus = memo(function PresenceStatus({
  online,
  lastSeenAt,
  language = 'vi',
  showBadge = true,
  badgeSize = 'sm',
}: PresenceStatusProps) {
  const label = useMemo(
    () => getPresenceLabel(online, lastSeenAt, language),
    [online, lastSeenAt, language]
  );

  const textColor = online ? '#16a34a' : '#6b7280'; // green-600 : gray-500

  return (
    <View style={styles.statusContainer}>
      {showBadge && <PresenceBadge online={online} size={badgeSize} bordered={false} />}
      <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR WITH PRESENCE - Combines avatar with presence badge
// ═══════════════════════════════════════════════════════════════════════════════

export interface AvatarWithPresenceProps {
  /** Avatar initials */
  initials: string;
  /** Avatar URL (optional) */
  avatarUrl?: string | null;
  /** Whether user is online */
  online: boolean;
  /** Avatar size in pixels (default: 48) */
  size?: number;
  /** Badge size */
  badgeSize?: 'sm' | 'md' | 'lg';
}

/**
 * Avatar component with presence indicator.
 * 
 * @example
 * <AvatarWithPresence
 *   initials="JD"
 *   avatarUrl="https://example.com/avatar.jpg"
 *   online={true}
 *   size={48}
 * />
 */
export const AvatarWithPresence = memo(function AvatarWithPresence({
  initials,
  avatarUrl,
  online,
  size = 48,
  badgeSize = 'md',
}: AvatarWithPresenceProps) {
  const badgeOffset = BADGE_SIZES[badgeSize] / 4;

  return (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarInitials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
      <View style={[styles.badgePosition, { bottom: -badgeOffset, right: -badgeOffset }]}>
        <PresenceBadge online={online} size={badgeSize} bordered />
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HEADER WITH PRESENCE - For ChatDetail screen
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatHeaderPresenceProps {
  /** User display name */
  name: string;
  /** Avatar initials */
  initials: string;
  /** Avatar URL (optional) */
  avatarUrl?: string | null;
  /** Whether user is online */
  online: boolean;
  /** Last seen timestamp */
  lastSeenAt?: string | null;
  /** Display language */
  language?: 'vi' | 'en';
  /** Whether user is typing */
  isTyping?: boolean;
}

/**
 * Chat header content with presence status.
 * Use this as the header content in ChatDetailScreen.
 * 
 * @example
 * <ChatHeaderPresence
 *   name="John Doe"
 *   initials="JD"
 *   online={true}
 *   lastSeenAt="2024-01-15T10:30:00Z"
 * />
 */
export const ChatHeaderPresence = memo(function ChatHeaderPresence({
  name,
  initials,
  avatarUrl,
  online,
  lastSeenAt,
  language = 'vi',
  isTyping = false,
}: ChatHeaderPresenceProps) {
  const statusLabel = useMemo(() => {
    if (isTyping) {
      return language === 'vi' ? 'Đang nhập...' : 'Typing...';
    }
    return getPresenceLabel(online, lastSeenAt, language);
  }, [online, lastSeenAt, language, isTyping]);

  const statusColor = useMemo(() => {
    if (isTyping) return '#3b82f6'; // blue-500
    if (online) return '#16a34a'; // green-600
    return '#6b7280'; // gray-500
  }, [online, isTyping]);

  return (
    <View style={styles.headerContainer}>
      <AvatarWithPresence
        initials={initials}
        avatarUrl={avatarUrl}
        online={online}
        size={40}
        badgeSize="sm"
      />
      <View style={styles.headerInfo}>
        <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        <View style={styles.headerStatusRow}>
          <PresenceBadge online={online} size="sm" bordered={false} />
          <Text style={[styles.headerStatus, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES - Premium iOS Design
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.caption1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.avatarText,
    fontWeight: 'bold',
  },
  badgePosition: {
    position: 'absolute',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    ...typography.headline,
    color: colors.text,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  headerStatus: {
    ...typography.caption1,
  },
});
