import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatMessageTime,
  formatLastSeen,
  getPresenceLabel,
  formatPresence,
  isRecentlyActive,
} from '../timeFormatter';

// Mock Date.now() for consistent testing
const MOCK_NOW = new Date('2024-01-15T12:00:00Z').getTime();

describe('timeFormatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatMessageTime', () => {
    test('returns empty string for null/undefined', () => {
      expect(formatMessageTime(null)).toBe('');
      expect(formatMessageTime(undefined)).toBe('');
    });

    test('returns "vừa xong" for < 30 seconds ago (vi)', () => {
      const timestamp = new Date(MOCK_NOW - 10 * 1000); // 10 seconds ago
      expect(formatMessageTime(timestamp, 'vi')).toBe('vừa xong');
    });

    test('returns "just now" for < 30 seconds ago (en)', () => {
      const timestamp = new Date(MOCK_NOW - 10 * 1000);
      expect(formatMessageTime(timestamp, 'en')).toBe('just now');
    });

    test('returns "Xm/Xp" for < 60 minutes ago', () => {
      const timestamp = new Date(MOCK_NOW - 5 * 60 * 1000); // 5 minutes ago
      expect(formatMessageTime(timestamp, 'vi')).toBe('5p');
      expect(formatMessageTime(timestamp, 'en')).toBe('5m');
    });

    test('returns "X giờ/Xh" for < 24 hours ago', () => {
      const timestamp = new Date(MOCK_NOW - 3 * 60 * 60 * 1000); // 3 hours ago
      expect(formatMessageTime(timestamp, 'vi')).toBe('3 giờ');
      expect(formatMessageTime(timestamp, 'en')).toBe('3h');
    });

    test('returns "Hôm qua/Yesterday" for yesterday', () => {
      const yesterday = new Date(MOCK_NOW - 24 * 60 * 60 * 1000);
      expect(formatMessageTime(yesterday, 'vi')).toBe('Hôm qua');
      expect(formatMessageTime(yesterday, 'en')).toBe('Yesterday');
    });

    test('returns "dd/MM" for same year', () => {
      const timestamp = new Date('2024-01-10T12:00:00Z'); // Jan 10, 2024
      expect(formatMessageTime(timestamp, 'vi')).toBe('10/01');
    });

    test('returns "dd/MM/yyyy" for different year', () => {
      const timestamp = new Date('2023-06-15T12:00:00Z'); // Jun 15, 2023
      expect(formatMessageTime(timestamp, 'vi')).toBe('15/06/2023');
    });
  });

  describe('formatLastSeen', () => {
    test('returns "Không hoạt động" for null (vi)', () => {
      expect(formatLastSeen(null, 'vi')).toBe('Không hoạt động');
    });

    test('returns "Inactive" for null (en)', () => {
      expect(formatLastSeen(null, 'en')).toBe('Inactive');
    });

    test('returns "Hoạt động vừa xong" for < 1 minute ago', () => {
      const timestamp = new Date(MOCK_NOW - 30 * 1000); // 30 seconds ago
      expect(formatLastSeen(timestamp, 'vi')).toBe('Hoạt động vừa xong');
      expect(formatLastSeen(timestamp, 'en')).toBe('Active just now');
    });

    test('returns "Hoạt động X phút trước" for < 60 minutes ago', () => {
      const timestamp = new Date(MOCK_NOW - 15 * 60 * 1000); // 15 minutes ago
      expect(formatLastSeen(timestamp, 'vi')).toBe('Hoạt động 15 phút trước');
      expect(formatLastSeen(timestamp, 'en')).toBe('Active 15m ago');
    });

    test('returns "Hoạt động X giờ trước" for < 24 hours ago', () => {
      const timestamp = new Date(MOCK_NOW - 5 * 60 * 60 * 1000); // 5 hours ago
      expect(formatLastSeen(timestamp, 'vi')).toBe('Hoạt động 5 giờ trước');
      expect(formatLastSeen(timestamp, 'en')).toBe('Active 5h ago');
    });

    test('returns "Hoạt động ngày dd/MM" for > 24 hours ago', () => {
      const timestamp = new Date('2024-01-13T12:00:00Z'); // 2 days ago
      expect(formatLastSeen(timestamp, 'vi')).toBe('Hoạt động ngày 13/01');
      expect(formatLastSeen(timestamp, 'en')).toBe('Active on 01/13');
    });
  });

  describe('getPresenceLabel', () => {
    test('returns "Đang hoạt động" when online (vi)', () => {
      expect(getPresenceLabel(true, null, 'vi')).toBe('Đang hoạt động');
    });

    test('returns "Active now" when online (en)', () => {
      expect(getPresenceLabel(true, null, 'en')).toBe('Active now');
    });

    test('returns last seen format when offline', () => {
      const timestamp = new Date(MOCK_NOW - 10 * 60 * 1000); // 10 minutes ago
      expect(getPresenceLabel(false, timestamp, 'vi')).toBe('Hoạt động 10 phút trước');
    });
  });

  describe('isRecentlyActive', () => {
    test('returns false for null', () => {
      expect(isRecentlyActive(null)).toBe(false);
    });

    test('returns true for recent activity within threshold', () => {
      const timestamp = new Date(MOCK_NOW - 10 * 60 * 1000); // 10 minutes ago
      expect(isRecentlyActive(timestamp, 15)).toBe(true); // 15 minute threshold
    });

    test('returns false for activity beyond threshold', () => {
      const timestamp = new Date(MOCK_NOW - 30 * 60 * 1000); // 30 minutes ago
      expect(isRecentlyActive(timestamp, 15)).toBe(false); // 15 minute threshold
    });
  });

  describe('formatPresence', () => {
    test('returns default state for null', () => {
      const result = formatPresence(null, 'vi');
      expect(result.isOnline).toBe(false);
      expect(result.label).toBe('Không hoạt động');
      expect(result.lastSeenAt).toBe(null);
    });

    test('returns formatted presence for online user', () => {
      const presence = {
        userId: 'user123',
        online: true,
        lastSeenAt: new Date(MOCK_NOW).toISOString(),
      };
      const result = formatPresence(presence, 'vi');
      expect(result.isOnline).toBe(true);
      expect(result.label).toBe('Đang hoạt động');
    });

    test('returns formatted presence for offline user', () => {
      const timestamp = new Date(MOCK_NOW - 20 * 60 * 1000); // 20 minutes ago
      const presence = {
        userId: 'user123',
        online: false,
        lastSeenAt: timestamp.toISOString(),
      };
      const result = formatPresence(presence, 'vi');
      expect(result.isOnline).toBe(false);
      expect(result.label).toBe('Hoạt động 20 phút trước');
    });
  });
});
