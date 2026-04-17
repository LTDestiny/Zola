import React, { memo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE BADGE COMPONENT - Shows online/offline indicator
// ═══════════════════════════════════════════════════════════════════════════════

export interface PresenceBadgeProps {
  /** Whether the user is online */
  online: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Show border (for overlaying on avatars) */
  bordered?: boolean;
  /** Position when used as overlay */
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
}

const SIZE_CLASSES = {
  sm: 'h-2 w-2',      // 8px
  md: 'h-2.5 w-2.5',  // 10px
  lg: 'h-3 w-3',      // 12px
};

const POSITION_CLASSES = {
  'bottom-right': 'absolute bottom-0 right-0',
  'top-right': 'absolute top-0 right-0',
  'bottom-left': 'absolute bottom-0 left-0',
  'top-left': 'absolute top-0 left-0',
};

/**
 * Presence indicator badge.
 * 
 * @example
 * // Standalone
 * <PresenceBadge online={true} size="md" />
 * 
 * // As overlay on avatar
 * <div className="relative">
 *   <Avatar />
 *   <PresenceBadge online={true} position="bottom-right" bordered />
 * </div>
 */
export const PresenceBadge = memo(function PresenceBadge({
  online,
  size = 'md',
  className = '',
  bordered = true,
  position,
}: PresenceBadgeProps) {
  const colorClass = online ? 'bg-green-500' : 'bg-gray-400';
  const borderClass = bordered ? 'border-2 border-white' : '';
  const positionClass = position ? POSITION_CLASSES[position] : '';
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`${sizeClass} ${colorClass} ${borderClass} ${positionClass} rounded-full ${className}`}
      role="status"
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
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
  /** Additional CSS classes */
  className?: string;
}

/**
 * Presence status text with optional badge.
 * 
 * @example
 * <PresenceStatus online={true} />
 * // "● Đang hoạt động"
 * 
 * <PresenceStatus online={false} lastSeenAt="2024-01-15T10:30:00Z" />
 * // "● Hoạt động 5 phút trước"
 */
export const PresenceStatus = memo(function PresenceStatus({
  online,
  lastSeenAt,
  language = 'vi',
  showBadge = true,
  badgeSize = 'sm',
  className = '',
}: PresenceStatusProps) {
  const label = getPresenceLabel(online, lastSeenAt, language);
  const textColorClass = online ? 'text-green-600' : 'text-gray-500';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {showBadge && <PresenceBadge online={online} size={badgeSize} bordered={false} />}
      <span className={`text-xs ${textColorClass}`}>{label}</span>
    </span>
  );
});

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function getPresenceLabel(
  online: boolean,
  lastSeenAt: string | null | undefined,
  language: 'vi' | 'en'
): string {
  if (online) {
    return language === 'vi' ? 'Đang hoạt động' : 'Active now';
  }

  if (!lastSeenAt) {
    return language === 'vi' ? 'Không hoạt động' : 'Inactive';
  }

  const date = new Date(lastSeenAt);
  if (isNaN(date.getTime())) {
    return language === 'vi' ? 'Không hoạt động' : 'Inactive';
  }

  const diff = Date.now() - date.getTime();

  if (diff < MINUTE) {
    return language === 'vi' ? 'Hoạt động vừa xong' : 'Active just now';
  }

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return language === 'vi'
      ? `Hoạt động ${minutes} phút trước`
      : `Active ${minutes}m ago`;
  }

  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return language === 'vi'
      ? `Hoạt động ${hours} giờ trước`
      : `Active ${hours}h ago`;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return language === 'vi'
    ? `Hoạt động ngày ${day}/${month}`
    : `Active on ${month}/${day}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR WITH PRESENCE - Combines avatar with presence badge
// ═══════════════════════════════════════════════════════════════════════════════

export interface AvatarWithPresenceProps {
  /** Avatar content (initials or image) */
  avatar: string;
  /** Avatar URL (if image) */
  avatarUrl?: string | null;
  /** User name for alt text */
  name?: string;
  /** Whether user is online */
  online: boolean;
  /** Avatar size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Avatar component with presence indicator.
 * 
 * @example
 * <AvatarWithPresence
 *   avatar="JD"
 *   avatarUrl="/path/to/avatar.jpg"
 *   name="John Doe"
 *   online={true}
 *   size={48}
 * />
 */
export const AvatarWithPresence = memo(function AvatarWithPresence({
  avatar,
  avatarUrl,
  name,
  online,
  size = 48,
  className = '',
}: AvatarWithPresenceProps) {
  const sizeStyle = { width: size, height: size };
  const badgeSize = size <= 32 ? 'sm' : size <= 48 ? 'md' : 'lg';

  return (
    <div className={`relative inline-block ${className}`} style={sizeStyle}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
          {avatar}
        </div>
      )}
      <PresenceBadge
        online={online}
        size={badgeSize}
        position="bottom-right"
        bordered
      />
    </div>
  );
});
