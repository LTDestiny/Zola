import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePresence, extractPeerUserIds } from '../usePresence';
import * as chatApi from '../../api/chatApi';

// Mock the chatApi
vi.mock('../../api/chatApi', () => ({
  getUsersPresence: vi.fn(),
}));

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('initializes with empty presence map', () => {
    const { result } = renderHook(() =>
      usePresence({ userIds: [], refreshInterval: 0 })
    );

    expect(result.current.presenceMap).toEqual({});
    expect(result.current.loading).toBe(false);
  });

  test('fetches presence for user IDs', async () => {
    const mockPresence = {
      success: true,
      message: "ok",
      data: [
        { userId: 'user1', online: true, lastChangedAt: null },
        { userId: 'user2', online: false, lastChangedAt: '2024-01-15T10:00:00Z' },
      ],
    };
    vi.mocked(chatApi.getUsersPresence).mockResolvedValue(mockPresence);

    const { result } = renderHook(() =>
      usePresence({
        userIds: ['user1', 'user2'],
        refreshInterval: 0,
        debounceMs: 0,
      })
    );

    // Fast-forward debounce timer
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.presenceMap['user1']).toBeDefined();
    });

    expect(result.current.isOnline('user1')).toBe(true);
    expect(result.current.isOnline('user2')).toBe(false);
  });

  test('isOnline returns false for unknown user', () => {
    const { result } = renderHook(() =>
      usePresence({ userIds: [], refreshInterval: 0 })
    );

    expect(result.current.isOnline('unknown')).toBe(false);
  });

  test('getLabel returns default label for unknown user', () => {
    const { result } = renderHook(() =>
      usePresence({ userIds: [], refreshInterval: 0, language: 'vi' })
    );

    expect(result.current.getLabel('unknown')).toBe('Không hoạt động');
  });

  test('updateFromRealtime updates presence map', () => {
    const { result } = renderHook(() =>
      usePresence({ userIds: [], refreshInterval: 0 })
    );

    act(() => {
      result.current.updateFromRealtime({
        userId: 'user1',
        online: true,
        lastSeenAt: null,
      });
    });

    expect(result.current.isOnline('user1')).toBe(true);
  });

  test('tick updates periodically', async () => {
    const { result } = renderHook(() =>
      usePresence({ userIds: [], refreshInterval: 0 })
    );

    const initialTick = result.current.tick;

    await act(async () => {
      vi.advanceTimersByTime(60000); // 1 minute
    });

    // Tick should have changed
    expect(result.current.tick).not.toBe(initialTick);
  });

  test('debounces multiple fetch requests', async () => {
    vi.mocked(chatApi.getUsersPresence).mockResolvedValue({
      success: true,
      message: "ok",
      data: [],
    });

    const { rerender } = renderHook(
      ({ userIds }: { userIds: string[] }) =>
        usePresence({ userIds, refreshInterval: 0, debounceMs: 100 }),
      { initialProps: { userIds: ['user1'] } }
    );

    rerender({ userIds: ['user1', 'user2'] });
    rerender({ userIds: ['user1', 'user2', 'user3'] });

    // Fast-forward debounce timer
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Should only be called once due to debouncing
    expect(chatApi.getUsersPresence).toHaveBeenCalledTimes(1);
  });
});

describe('extractPeerUserIds', () => {
  test('returns empty array for null currentUserId', () => {
    const conversations = [{ participants: ['user1', 'user2'] }];
    expect(extractPeerUserIds(conversations, null)).toEqual([]);
  });

  test('extracts peer IDs excluding current user', () => {
    const conversations = [
      { participants: ['me', 'user1'] },
      { participants: ['me', 'user2'] },
    ];
    const result = extractPeerUserIds(conversations, 'me');
    expect(result).toContain('user1');
    expect(result).toContain('user2');
    expect(result).not.toContain('me');
  });

  test('deduplicates peer IDs', () => {
    const conversations = [
      { participants: ['me', 'user1'] },
      { participants: ['me', 'user1'] }, // Same user
    ];
    const result = extractPeerUserIds(conversations, 'me');
    expect(result).toEqual(['user1']);
  });
});
