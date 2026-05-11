import { describe, it, expect } from 'vitest';
import { SportEvent, TeamMember } from '../types';
import {
  computeEloRatings, computeFormTrend, computeDayHeatmap,
  computeNemesis, computeClutchFactor, computeReliabilityScore,
  computeLeaderboard, computeEventHealth, computeUserStats,
  computeExtendedBadges, computeDuoStats,
} from './statsEngine';

// ── Helpers ──

const tm = (id: string, name?: string): TeamMember => ({ userId: id, name: name ?? `Player ${id}` });

const makeEvent = (id: string, date: string, participants: SportEvent['participants'], overrides?: Partial<SportEvent>): SportEvent => ({
  id, title: `Event ${id}`, date, time: '18:00', location: 'Hala', totalCost: 1000, accountNumber: '', participants, ...overrides,
});

const PAST = '2025-01-01';

// Helper: create N events with A beating B
function createGames(count: number, winnerId: string, loserId: string, startDate = '2025-01-01'): SportEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().split('T')[0];
    return makeEvent(`g${i}`, date, [
      { userId: winnerId, name: `P${winnerId}`, status: 'joined', hasPaid: true },
      { userId: loserId, name: `P${loserId}`, status: 'joined', hasPaid: true },
    ], {
      teams: [[tm(winnerId, `P${winnerId}`)], [tm(loserId, `P${loserId}`)]],
      winningTeam: 0,
    });
  });
}

// ── ELO Tests ──

describe('computeEloRatings', () => {
  it('returns initial rating of ~1000 for players with no games', () => {
    const events = [makeEvent('e1', PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
    ])];
    const elo = computeEloRatings(events);
    // No games played, so no rating entries
    expect(elo.size).toBe(0);
  });

  it('winner ELO increases, loser ELO decreases after a game', () => {
    const events = createGames(1, 'a', 'b');
    const elo = computeEloRatings(events);
    expect(elo.get('a')!).toBeGreaterThan(1000);
    expect(elo.get('b')!).toBeLessThan(1000);
  });

  it('winning against higher-rated opponent gives more points', () => {
    // First: b wins 5 games to get high ELO
    const bWins = createGames(5, 'b', 'c', '2025-01-01');
    // Then: a (1000) beats b (high ELO)
    const upset = [makeEvent('upset', '2025-02-01', [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
    ], {
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 0,
    })];

    const elo = computeEloRatings([...bWins, ...upset]);
    // a's gain should be more than half of K since b was stronger
    expect(elo.get('a')!).toBeGreaterThan(1000 + 16); // more than K/2
  });

  it('two equal players converge: repeated games keep them near 1000', () => {
    const events: SportEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const winner = i % 2 === 0 ? 'a' : 'b';
      const loser = i % 2 === 0 ? 'b' : 'a';
      events.push(...createGames(1, winner, loser, `2025-01-${String(i + 1).padStart(2, '0')}`));
    }
    const elo = computeEloRatings(events);
    expect(Math.abs(elo.get('a')! - 1000)).toBeLessThan(50);
    expect(Math.abs(elo.get('b')! - 1000)).toBeLessThan(50);
  });
});

// ── Form Trend Tests ──

describe('computeFormTrend', () => {
  it('returns null rates when under threshold', () => {
    const events = createGames(3, 'a', 'b');
    const form = computeFormTrend(events, 'a');
    expect(form.last5WinRate).toBeNull();
    expect(form.last10WinRate).toBeNull();
    expect(form.allTimeWinRate).toBe(1);
  });

  it('computes last5 correctly at threshold', () => {
    const events = createGames(5, 'a', 'b');
    const form = computeFormTrend(events, 'a');
    expect(form.last5WinRate).toBe(1);
    expect(form.last10WinRate).toBeNull();
  });

  it('detects upward trend', () => {
    // First 5: lose all, then win 5
    const losses = createGames(5, 'b', 'a', '2025-01-01');
    const wins = createGames(5, 'a', 'b', '2025-02-01');
    const form = computeFormTrend([...losses, ...wins], 'a');
    expect(form.trend).toBe('up');
    expect(form.last5WinRate).toBe(1);
    expect(form.allTimeWinRate).toBe(0.5);
  });

  it('detects downward trend', () => {
    const wins = createGames(5, 'a', 'b', '2025-01-01');
    const losses = createGames(5, 'b', 'a', '2025-02-01');
    const form = computeFormTrend([...wins, ...losses], 'a');
    expect(form.trend).toBe('down');
  });

  it('recent results are most-recent-first', () => {
    const events = createGames(3, 'a', 'b');
    const form = computeFormTrend(events, 'a');
    expect(form.recentResults).toEqual([true, true, true]);
    // All wins for 'a'
  });

  it('returns empty for events with no games', () => {
    const events = [makeEvent('e1', PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
    ])];
    const form = computeFormTrend(events, 'a');
    expect(form.allTimeWinRate).toBe(0);
    expect(form.recentResults).toEqual([]);
  });
});

// ── Day Heatmap Tests ──

describe('computeDayHeatmap', () => {
  it('buckets correct weekday', () => {
    // 2025-01-06 is Monday
    const events = [makeEvent('e1', '2025-01-06', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }])];
    const heatmap = computeDayHeatmap(events, 'a');
    expect(heatmap[0]).toBe(1); // Monday
    expect(heatmap.slice(1).every(v => v === 0)).toBe(true);
  });

  it('skips declined events', () => {
    const events = [makeEvent('e1', '2025-01-06', [{ userId: 'a', name: 'A', status: 'declined', hasPaid: false }])];
    const heatmap = computeDayHeatmap(events, 'a');
    expect(heatmap.every(v => v === 0)).toBe(true);
  });

  it('counts multiple days correctly', () => {
    // Mon, Wed, Wed
    const events = [
      makeEvent('e1', '2025-01-06', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]),
      makeEvent('e2', '2025-01-08', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]),
      makeEvent('e3', '2025-01-15', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]),
    ];
    const heatmap = computeDayHeatmap(events, 'a');
    expect(heatmap[0]).toBe(1); // Mon
    expect(heatmap[2]).toBe(2); // Wed
  });
});

// ── Nemesis Tests ──

describe('computeNemesis', () => {
  it('finds worst and best opponent', () => {
    // a loses to b 3 times, beats c 3 times
    const losses = createGames(3, 'b', 'a', '2025-01-01');
    const wins = createGames(3, 'a', 'c', '2025-02-01');
    const all = [...losses, ...wins];
    const result = computeNemesis(all, 'a');
    expect(result.nemesis?.userId).toBe('b');
    expect(result.nemesis?.winRate).toBe(0);
    expect(result.favorite?.userId).toBe('c');
    expect(result.favorite?.winRate).toBe(1);
  });

  it('respects minimum threshold', () => {
    const events = createGames(2, 'a', 'b'); // only 2 games, threshold is 3
    const result = computeNemesis(events, 'a');
    expect(result.nemesis).toBeNull();
    expect(result.favorite).toBeNull();
  });

  it('returns null when no games played', () => {
    const events = [makeEvent('e1', PAST, [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }])];
    const result = computeNemesis(events, 'a');
    expect(result.nemesis).toBeNull();
    expect(result.favorite).toBeNull();
  });
});

// ── Clutch Factor Tests ──

describe('computeClutchFactor', () => {
  it('correctly classifies close sets (margin ≤3)', () => {
    const events = [makeEvent('e1', PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
    ], {
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 0,
      score: [[25, 23], [25, 22], [26, 24], [25, 20], [25, 24]], // 4 close (≤3): margins 2,3,2,1; 1 blowout: margin 5
    })];
    const result = computeClutchFactor(events, 'a');
    expect(result.clutchSetsPlayed).toBe(4); // 25-23(2), 25-22(3), 26-24(2), 25-24(1)
    expect(result.clutchWinRate).toBeNull(); // only 4, need 5
  });

  it('returns non-null when above threshold', () => {
    // Create enough close sets
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`e${i}`, PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
    ], {
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 0,
      score: [[25, 23]], // close set, margin=2
    }));
    const result = computeClutchFactor(events, 'a');
    expect(result.clutchSetsPlayed).toBe(5);
    expect(result.clutchWinRate).toBe(1);
  });

  it('skips [0,0] scores', () => {
    const events = [makeEvent('e1', PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
    ], {
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 0,
      score: [[0, 0], [25, 23]],
    })];
    const result = computeClutchFactor(events, 'a');
    expect(result.clutchSetsPlayed).toBe(1);
  });
});

// ── Reliability Score Tests ──

describe('computeReliabilityScore', () => {
  it('blends 60% attendance + 40% payment', () => {
    const stats = { attendanceRate: 1, paymentRate: 1 } as any;
    expect(computeReliabilityScore(stats)).toBe(100);
  });

  it('computes partial correctly', () => {
    const stats = { attendanceRate: 0.5, paymentRate: 0.5 } as any;
    expect(computeReliabilityScore(stats)).toBe(50);
  });

  it('weights attendance more', () => {
    const highAttendance = { attendanceRate: 1, paymentRate: 0 } as any;
    const highPayment = { attendanceRate: 0, paymentRate: 1 } as any;
    expect(computeReliabilityScore(highAttendance)).toBe(60);
    expect(computeReliabilityScore(highPayment)).toBe(40);
  });
});

// ── Leaderboard Tests ──

describe('computeLeaderboard', () => {
  it('sorts by ELO descending and assigns ranks', () => {
    const statsMap = new Map<string, any>([
      ['a', { userId: 'a', name: 'A', eventsJoined: 5, winRate: 0.8, gamesPlayed: 10, attendanceRate: 0.9, paymentRate: 1 }],
      ['b', { userId: 'b', name: 'B', eventsJoined: 5, winRate: 0.6, gamesPlayed: 10, attendanceRate: 0.7, paymentRate: 0.8 }],
    ]);
    const eloMap = new Map([['a', 1100], ['b', 1050]]);
    const lb = computeLeaderboard(statsMap, eloMap);
    expect(lb[0].userId).toBe('a');
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(2);
  });

  it('excludes players below event threshold', () => {
    const statsMap = new Map<string, any>([
      ['a', { userId: 'a', name: 'A', eventsJoined: 2, winRate: 1, gamesPlayed: 5, attendanceRate: 1, paymentRate: 1 }],
      ['b', { userId: 'b', name: 'B', eventsJoined: 5, winRate: 0.5, gamesPlayed: 5, attendanceRate: 0.7, paymentRate: 0.8 }],
    ]);
    const eloMap = new Map([['a', 1200], ['b', 1050]]);
    const lb = computeLeaderboard(statsMap, eloMap);
    expect(lb).toHaveLength(1);
    expect(lb[0].userId).toBe('b');
  });
});

// ── Event Health Tests ──

describe('computeEventHealth', () => {
  it('computes fill rate correctly', () => {
    const configs = [{ type: 'volejbal' as const, label: 'V', maxPlayers: 10, defaultCost: 0, defaultLocation: '', teamSize: null }];
    const events = [
      makeEvent('e1', PAST, Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, name: `U${i}`, status: 'joined' as const, hasPaid: true }))),
      makeEvent('e2', PAST, Array.from({ length: 10 }, (_, i) => ({ userId: `u${i}`, name: `U${i}`, status: 'joined' as const, hasPaid: true }))),
    ];
    const health = computeEventHealth(events, configs);
    expect(health.avgFillRate).toBeCloseTo(0.75); // (5/10 + 10/10) / 2
  });

  it('finds most competitive games by lowest margin', () => {
    const configs = [{ type: 'volejbal' as const, label: 'V', maxPlayers: 12, defaultCost: 0, defaultLocation: '', teamSize: null }];
    const events = [
      makeEvent('close', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], { teams: [[tm('a')], [tm('b')]], winningTeam: 0, score: [[25, 24]] }),
      makeEvent('blowout', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], { teams: [[tm('a')], [tm('b')]], winningTeam: 0, score: [[25, 10]] }),
    ];
    const health = computeEventHealth(events, configs);
    expect(health.mostCompetitiveGames[0].eventId).toBe('close');
    expect(health.mostCompetitiveGames[0].avgMargin).toBe(1);
  });
});

// ── Extended Badges Tests ──

describe('computeExtendedBadges', () => {
  it('includes comeback king badge', () => {
    // a loses set 1 but wins the game (2 comebacks)
    const events = [
      makeEvent('e1', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], { teams: [[tm('a')], [tm('b')]], winningTeam: 0, score: [[20, 25], [25, 20], [25, 20]] }),
      makeEvent('e2', PAST, [
        { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
        { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      ], { teams: [[tm('a')], [tm('b')]], winningTeam: 0, score: [[18, 25], [25, 18], [25, 15]] }),
    ];
    const statsMap = computeUserStats(events);
    const badges = computeExtendedBadges(statsMap, events);
    const comeback = badges.find(b => b.type === 'comebackKing');
    expect(comeback).toBeDefined();
    expect(comeback!.userId).toBe('a');
    expect(comeback!.value).toContain('2');
  });

  it('includes weekday warrior badge for varied days', () => {
    const events = [
      makeEvent('e1', '2025-01-06', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]), // Mon
      makeEvent('e2', '2025-01-08', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]), // Wed
      makeEvent('e3', '2025-01-10', [{ userId: 'a', name: 'A', status: 'joined', hasPaid: true }]), // Fri
    ];
    const statsMap = computeUserStats(events);
    const badges = computeExtendedBadges(statsMap, events);
    const warrior = badges.find(b => b.type === 'weekdayWarrior');
    expect(warrior).toBeDefined();
    expect(warrior!.value).toContain('3');
  });
});

// ── computeUserStats backward compat ──

describe('computeUserStats', () => {
  it('computes basic stats correctly', () => {
    const events = [makeEvent('e1', PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'declined', hasPaid: false },
    ])];
    const stats = computeUserStats(events);
    expect(stats.get('a')!.eventsJoined).toBe(1);
    expect(stats.get('b')!.eventsDeclined).toBe(1);
    expect(stats.get('a')!.attendanceRate).toBe(1);
  });
});

// ── Duo Stats threshold ──

describe('computeDuoStats', () => {
  it('filters out pairs with fewer than 3 games', () => {
    // 2 games together — should be excluded
    const events = Array.from({ length: 2 }, (_, i) => makeEvent(`e${i}`, PAST, [
      { userId: 'a', name: 'A', status: 'joined', hasPaid: true },
      { userId: 'b', name: 'B', status: 'joined', hasPaid: true },
      { userId: 'c', name: 'C', status: 'joined', hasPaid: true },
      { userId: 'd', name: 'D', status: 'joined', hasPaid: true },
    ], {
      teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]],
      winningTeam: 0,
    }));
    const duos = computeDuoStats(events);
    expect(duos).toHaveLength(0);
  });
});

