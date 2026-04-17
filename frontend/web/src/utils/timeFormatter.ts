/**
 * Time formatting utilities for presence and chat timestamps.
 * Shared logic between Web and Mobile (copy to both platforms).
 * 
 * @example
 * formatMessageTime(new Date()) // "vừa xong"
 * formatLastSeen(new Date(Date.now() - 5 * 60 * 1000)) // "Hoạt động 5 phút trước"
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Format timestamp for message/chat list display.
 * 
 * Rules:
 * - < 30s => "vừa xong"
 * - < 60m => "Xm"
 * - < 24h => "X giờ"
 * - yesterday => "Hôm qua"
 * - same year => "dd/MM"
 * - different year => "dd/MM/yyyy"
 */
export function formatMessageTime(
  timestamp: Date | string | number | null | undefined,
  language: 'vi' | 'en' = 'vi'
): string {
  if (!timestamp) return '';

  const date = toDate(timestamp);
  if (!date) return '';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // < 30 seconds
  if (diff < 30 * SECOND) {
    return language === 'vi' ? 'vừa xong' : 'just now';
  }

  // < 60 minutes
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes}${language === 'vi' ? 'p' : 'm'}`;
  }

  // < 24 hours
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return language === 'vi' ? `${hours} giờ` : `${hours}h`;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return language === 'vi' ? 'Hôm qua' : 'Yesterday';
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return formatDate(date, 'dd/MM');
  }

  // Different year
  return formatDate(date, 'dd/MM/yyyy');
}

/**
 * Format last seen time for presence display.
 * 
 * Rules:
 * - online => null (caller should show "Đang hoạt động")
 * - < 1 minute => "Hoạt động vừa xong"
 * - < 60 minutes => "Hoạt động X phút trước"
 * - < 24 hours => "Hoạt động X giờ trước"
 * - > 24 hours => "Hoạt động ngày dd/MM"
 */
export function formatLastSeen(
  timestamp: Date | string | number | null | undefined,
  language: 'vi' | 'en' = 'vi'
): string {
  if (!timestamp) {
    return language === 'vi' ? 'Không hoạt động' : 'Inactive';
  }

  const date = toDate(timestamp);
  if (!date) {
    return language === 'vi' ? 'Không hoạt động' : 'Inactive';
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // < 1 minute
  if (diff < MINUTE) {
    return language === 'vi'
      ? 'Hoạt động vừa xong'
      : 'Active just now';
  }

  // < 60 minutes
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return language === 'vi'
      ? `Hoạt động ${minutes} phút trước`
      : `Active ${minutes}m ago`;
  }

  // < 24 hours
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return language === 'vi'
      ? `Hoạt động ${hours} giờ trước`
      : `Active ${hours}h ago`;
  }

  // > 24 hours
  return language === 'vi'
    ? `Hoạt động ngày ${formatDate(date, 'dd/MM')}`
    : `Active on ${formatDate(date, 'MM/dd')}`;
}

/**
 * Get presence label for display.
 * 
 * @param online - Whether user is online
 * @param lastSeenAt - Last seen timestamp
 * @param language - Display language
 * @returns Presence label string
 */
export function getPresenceLabel(
  online: boolean,
  lastSeenAt: Date | string | number | null | undefined,
  language: 'vi' | 'en' = 'vi'
): string {
  if (online) {
    return language === 'vi' ? 'Đang hoạt động' : 'Active now';
  }
  return formatLastSeen(lastSeenAt, language);
}

/**
 * Check if user was recently active (within threshold).
 * Useful for showing "recently active" indicator.
 */
export function isRecentlyActive(
  lastSeenAt: Date | string | number | null | undefined,
  thresholdMinutes: number = 15
): boolean {
  if (!lastSeenAt) return false;

  const date = toDate(lastSeenAt);
  if (!date) return false;

  const diff = Date.now() - date.getTime();
  return diff < thresholdMinutes * MINUTE;
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function formatDate(date: Date, pattern: 'dd/MM' | 'dd/MM/yyyy' | 'MM/dd'): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  switch (pattern) {
    case 'dd/MM':
      return `${day}/${month}`;
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`;
    case 'MM/dd':
      return `${month}/${day}`;
    default:
      return `${day}/${month}`;
  }
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PresenceInfo {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
  sessionCount?: number;
}

export interface FormattedPresence {
  isOnline: boolean;
  label: string;
  lastSeenAt: Date | null;
}

/**
 * Transform raw presence data to formatted display data.
 */
export function formatPresence(
  presence: PresenceInfo | null | undefined,
  language: 'vi' | 'en' = 'vi'
): FormattedPresence {
  if (!presence) {
    return {
      isOnline: false,
      label: language === 'vi' ? 'Không hoạt động' : 'Inactive',
      lastSeenAt: null,
    };
  }

  return {
    isOnline: presence.online,
    label: getPresenceLabel(presence.online, presence.lastSeenAt, language),
    lastSeenAt: presence.lastSeenAt ? toDate(presence.lastSeenAt) : null,
  };
}
