import { describe, it, expect } from 'vitest';
import { useStatistics } from './useStatistics';
import { SportEvent, User, TeamMember } from '../types';
import { renderHook } from '@testing-library/react';

// ── Helpers ──

const tm = (id: string, name?: string): TeamMember => ({
  userId: id,
  name: name ?? `Player ${id}`,
});

const makeUser = (id: string): User => ({ id, name: `User ${id}` });

const makeEvent = (
  id: string,
  date: string,
  participants: SportEvent['participants'],
  overrides?: Partial<SportEvent>,
): SportEvent => ({
  id,
  title: `Event ${id}`,
  date,
  time: '18:00',
  location: 'Hala',
  totalCost: 1000,
  accountNumber: '',
  participants,
  ...overrides,
});

// Use a past date so stats are included
const PAST = '2025-01-01';

// ── Tests ──

describe('useStatistics — set tracking in personalStats', () => {
  it('computes setsWon, setsLost, setWinRate for a user', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 0,
        score: [[25, 20], [25, 18]],
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(1);
    // Team 0 won both sets → setsWon=2, setsLost=0
    expect(stats.setsWon).toBe(2);
    expect(stats.setsLost).toBe(0);
    expect(stats.setWinRate).toBe(1);
  });

  it('tracks sets for the losing side', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 0,
        score: [[25, 20], [18, 25], [25, 22]],
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('b'), false));
    const stats = result.current.personalStats!;

    expect(stats.gamesWon).toBe(0);
    // B is on team 1 (loser). Team 1 won 1 set (18:25 → team1 wins that set).
    // Team 0 won 2 sets, team 1 won 1 set.
    expect(stats.setsWon).toBe(1);
    expect(stats.setsLost).toBe(2);
    expect(stats.setWinRate).toBeCloseTo(1 / 3);
  });

  it('skips [0,0] score entries', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 0,
        score: [[0, 0], [25, 20]],
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    expect(stats.setsWon).toBe(1);
    expect(stats.setsLost).toBe(0);
  });

  it('accumulates sets across multiple rounds and events', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        gameHistory: [
          { teams: [[tm('a')], [tm('b')]], winningTeam: 0, score: [[25, 20]] },
        ],
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 1,
        score: [[20, 25], [18, 25]],
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    // Round 1 (history): team0 wins 1 set, team1 wins 0
    // Round 2 (current): team1 wins 2 sets, team0 wins 0
    // A is on team0: setsWon=1 (from round1) + 0 (from round2) = 1
    // setsLost=0 + 2 = 2
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.gamesWon).toBe(1);
    expect(stats.setsWon).toBe(1);
    expect(stats.setsLost).toBe(2);
  });

  it('returns setWinRate=0 when no score data exists', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 0,
        // no score
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    expect(stats.setsWon).toBe(0);
    expect(stats.setsLost).toBe(0);
    expect(stats.setWinRate).toBe(0);
  });
});

describe('useStatistics — duoStats with set tracking', () => {
  it('computes setsWon, setsLost, setWinRate for a duo', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
        { userId: 'c', name: 'C', status: 'joined', hasPaid: true },
        { userId: 'd', name: 'D', status: 'joined', hasPaid: true },
      ], {
        gameHistory: [
          { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0, score: [[25, 20], [25, 18]] },
        ],
        teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]],
        winningTeam: 0,
        score: [[25, 22], [20, 25], [25, 23]],
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const duos = result.current.duoStats;

    // a&b played together twice, won both
    const abDuo = duos.find(d =>
      d.players.some(p => p.userId === 'a') && d.players.some(p => p.userId === 'b'),
    );
    expect(abDuo).toBeDefined();
    expect(abDuo!.gamesPlayed).toBe(2);
    expect(abDuo!.gamesWon).toBe(2);
    // Round 1: team0 won 2 sets, team1 won 0 → setsWon+=2, setsLost+=0
    // Round 2: team0 won 2 sets (25:22, 25:23), team1 won 1 (20:25) → setsWon+=2, setsLost+=1
    expect(abDuo!.setsWon).toBe(4);
    expect(abDuo!.setsLost).toBe(1);
    expect(abDuo!.setWinRate).toBeCloseTo(4 / 5);
  });

  it('sorts duos by blended score (winRate + setWinRate)', () => {
    // Duo A&B: 2 wins, good set record
    // Duo C&D: 2 wins, worse set record
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
        { userId: 'c', name: 'C', status: 'joined', hasPaid: true },
        { userId: 'd', name: 'D', status: 'joined', hasPaid: true },
      ], {
        gameHistory: [
          { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0, score: [[25, 10], [25, 10]] },
        ],
        teams: [[tm('c'), tm('d')], [tm('a'), tm('b')]], // swap teams
        winningTeam: 0, // c&d win
        score: [[26, 25]], // close win for c&d
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const duos = result.current.duoStats;

    // Both pairs played 2 games, each won 1. But A&B have better set record.
    const abDuo = duos.find(d =>
      d.players.some(p => p.userId === 'a') && d.players.some(p => p.userId === 'b'),
    );
    const cdDuo = duos.find(d =>
      d.players.some(p => p.userId === 'c') && d.players.some(p => p.userId === 'd'),
    );
    expect(abDuo).toBeDefined();
    expect(cdDuo).toBeDefined();
    // A&B should rank higher due to better set performance
    const abIdx = duos.indexOf(abDuo!);
    const cdIdx = duos.indexOf(cdDuo!);
    expect(abIdx).toBeLessThan(cdIdx);
  });

  it('returns setWinRate=0 for duos with no score data', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
        { userId: 'c', name: 'C', status: 'joined', hasPaid: true },
        { userId: 'd', name: 'D', status: 'joined', hasPaid: true },
      ], {
        gameHistory: [
          { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0 },
        ],
        teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]],
        winningTeam: 0,
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const abDuo = result.current.duoStats.find(d =>
      d.players.some(p => p.userId === 'a') && d.players.some(p => p.userId === 'b'),
    );
    expect(abDuo).toBeDefined();
    expect(abDuo!.setsWon).toBe(0);
    expect(abDuo!.setsLost).toBe(0);
    expect(abDuo!.setWinRate).toBe(0);
  });
});

describe('useStatistics — consistency with teamBalancer', () => {
  it('counts games the same way as teamBalancer (gameHistory + current round)', () => {
    // 2 rounds in history + 1 current round = 3 total games for each player
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        gameHistory: [
          { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
          { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
        ],
        teams: [[tm('a')], [tm('b')]],
        winningTeam: 1,
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(2);
    expect(stats.winRate).toBeCloseTo(2 / 3);
  });

  it('does not count current round if winningTeam is undefined', () => {
    const events: SportEvent[] = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], {
        teams: [[tm('a')], [tm('b')]],
        // no winningTeam → not counted
      }),
    ];

    const { result } = renderHook(() => useStatistics(events, makeUser('a'), false));
    const stats = result.current.personalStats!;

    expect(stats.gamesPlayed).toBe(0);
  });
});

