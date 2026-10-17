import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompactedStatistics } from './useCompactedStatistics';
import * as storage from '../services/storage';
import { CompactedStats, SportStatsBundle, User, SportEvent } from '../types';

vi.mock('../services/storage', () => ({
  getCompactedStats: vi.fn(),
  recomputeStats: vi.fn(),
}));

describe('useCompactedStatistics hook', () => {
  const dummyUser: User = { id: 'u1', name: 'Petr' };
  const mockBundle: SportStatsBundle = {
    leaderboard: [
      {
        userId: 'u1',
        name: 'Petr',
        rank: 1,
        gamesPlayed: 10,
        winRate: 0.7,
        eloRating: 1150,
        compositeScore: 1120,
        activityStatus: 'active',
        attendanceRate: 0.9,
        reliabilityScore: 100,
      },
    ],
    userStats: {
      u1: {
        userId: 'u1',
        name: 'Petr',
        totalEvents: 10,
        eventsJoined: 9,
        eventsDeclined: 1,
        eventsMaybe: 0,
        attendanceRate: 0.9,
        paymentRate: 1,
        totalPaid: 900,
        totalOwed: 0,
        longestStreak: 5,
        currentStreak: 3,
        favoriteLocation: 'Hala',
        gamesPlayed: 10,
        gamesWon: 7,
        winRate: 0.7,
        winStreak: 2,
        longestWinStreak: 4,
        setsWon: 14,
        setsLost: 6,
        setWinRate: 0.7,
        eloRating: 1150,
      },
    },
    formTrends: {},
    dayHeatmaps: {},
    nemesisData: {},
    clutchData: {},
    badges: [],
    duoStats: [],
    eventHealth: {
      avgFillRate: 0.8,
      avgSetMargin: 3.5,
      mostCompetitiveGames: [],
    },
    monthlyTrends: [],
    totalEventsCount: 10,
  };

  const mockSnapshot: CompactedStats = {
    version: 1,
    updatedAt: '2026-10-14T03:00:00.000Z',
    pastEventsCount: 10,
    lastEventDate: '2026-10-10',
    activeSports: ['volejbal'],
    bySport: {
      all: mockBundle,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses live stats when timeFilter is not all', async () => {
    vi.mocked(storage.getCompactedStats).mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() =>
      useCompactedStatistics([], dummyUser, false, [], 'last3months', null)
    );

    // Initial state before snapshot loads
    expect(result.current.isCompacted).toBe(false);

    await waitFor(() => {
      expect(result.current.isSnapshotLoading).toBe(false);
    });

    // Still not compacted because timeFilter is last3months
    expect(result.current.isCompacted).toBe(false);
  });

  it('uses compacted stats when timeFilter is all and snapshot is loaded', async () => {
    vi.mocked(storage.getCompactedStats).mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() =>
      useCompactedStatistics([], dummyUser, false, [], 'all', null)
    );

    await waitFor(() => {
      expect(result.current.isCompacted).toBe(true);
    });

    expect(result.current.leaderboard).toHaveLength(1);
    expect(result.current.leaderboard[0].name).toBe('Petr');
    expect(result.current.personalStats?.eloRating).toBe(1150);
    expect(result.current.updatedAt).toBe('2026-10-14T03:00:00.000Z');
  });

  it('handles a brand new user not present in the snapshot gracefully', async () => {
    vi.mocked(storage.getCompactedStats).mockResolvedValue(mockSnapshot);
    const newUser: User = { id: 'u999', name: 'Nový Hráč' };

    const { result } = renderHook(() =>
      useCompactedStatistics([], newUser, false, [], 'all', null)
    );

    await waitFor(() => {
      expect(result.current.isCompacted).toBe(true);
    });

    expect(result.current.personalStats).toBeNull();
    expect(result.current.leaderboard).toHaveLength(1);
  });

  it('triggers manual recompute and updates state', async () => {
    vi.mocked(storage.getCompactedStats).mockResolvedValue(mockSnapshot);

    const updatedSnapshot: CompactedStats = {
      ...mockSnapshot,
      updatedAt: '2026-10-14T12:00:00.000Z',
    };
    vi.mocked(storage.recomputeStats).mockResolvedValue({
      success: true,
      stats: updatedSnapshot,
    });

    const { result } = renderHook(() =>
      useCompactedStatistics([], dummyUser, false, [], 'all', null)
    );

    await waitFor(() => {
      expect(result.current.isCompacted).toBe(true);
    });

    await act(async () => {
      await result.current.recompute();
    });

    expect(storage.recomputeStats).toHaveBeenCalledTimes(1);
    expect(result.current.updatedAt).toBe('2026-10-14T12:00:00.000Z');
  });

  it('captures recomputation error such as rate limit', async () => {
    vi.mocked(storage.getCompactedStats).mockResolvedValue(mockSnapshot);
    vi.mocked(storage.recomputeStats).mockRejectedValue(new Error('Rate limited: počkejte 25s'));

    const { result } = renderHook(() =>
      useCompactedStatistics([], dummyUser, false, [], 'all', null)
    );

    await waitFor(() => {
      expect(result.current.isCompacted).toBe(true);
    });

    await act(async () => {
      await result.current.recompute();
    });

    expect(result.current.recomputeError).toBe('Rate limited: počkejte 25s');
  });
});
