import { describe, it, expect } from 'vitest';
import {
  computePlayerRatings,
  balanceTeams,
  teamRating,
  extractRounds,
  DEFAULT_MIN_GAMES_THRESHOLD,
  PlayerRating,
} from './teamBalancer';
import { SportEvent, Participant, TeamMember } from '../types';

// ── Test helpers ──

const makeParticipant = (id: string, name?: string): Participant => ({
  userId: id,
  name: name ?? `Player ${id}`,
  status: 'joined',
  hasPaid: false,
});

/** Shorthand team member */
const tm = (id: string, name?: string): TeamMember => ({
  userId: id,
  name: name ?? `Player ${id}`,
});

/** Create a minimal event with game history */
const makeEventWithHistory = (
  id: string,
  rounds: { teams: [TeamMember[], TeamMember[]]; winningTeam: 0 | 1; score?: [number, number][] }[],
): SportEvent => ({
  id,
  title: 'Test Event',
  date: '2026-01-01',
  time: '18:00',
  location: 'Hala',
  totalCost: 1000,
  accountNumber: '',
  participants: [],
  gameHistory: rounds.slice(0, -1),
  teams: rounds.length > 0 ? rounds[rounds.length - 1].teams : undefined,
  winningTeam: rounds.length > 0 ? rounds[rounds.length - 1].winningTeam : undefined,
  score: rounds.length > 0 ? rounds[rounds.length - 1].score : undefined,
});

/** Empty event with no game history */
const emptyEvent: SportEvent = {
  id: 'e0',
  title: 'Empty',
  date: '2026-01-01',
  time: '18:00',
  location: 'Hala',
  totalCost: 1000,
  accountNumber: '',
  participants: [],
};

// ── extractRounds ──

describe('extractRounds', () => {
  it('returns empty array when event has no history or current round', () => {
    expect(extractRounds(emptyEvent)).toEqual([]);
  });

  it('returns gameHistory rounds + current finished round', () => {
    const event: SportEvent = {
      ...emptyEvent,
      gameHistory: [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ],
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 1,
      score: [[25, 20]],
    };
    const rounds = extractRounds(event);
    expect(rounds).toHaveLength(2);
    expect(rounds[1].winningTeam).toBe(1);
    expect(rounds[1].score).toEqual([[25, 20]]);
  });

  it('does not include current round if winningTeam is undefined', () => {
    const event: SportEvent = {
      ...emptyEvent,
      teams: [[tm('a')], [tm('b')]],
    };
    const rounds = extractRounds(event);
    expect(rounds).toHaveLength(0);
  });
});

// ── computePlayerRatings ──

describe('computePlayerRatings', () => {
  it('returns neutral 0.5 rating when there is no game history', () => {
    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings([], players);

    expect(ratings).toHaveLength(2);
    for (const r of ratings) {
      expect(r.gamesPlayed).toBe(0);
      expect(r.gamesWon).toBe(0);
      expect(r.hasEnoughData).toBe(false);
      expect(r.effectiveRating).toBe(0.5);
      expect(r.setWinRatio).toBe(0.5); // default when no set data
    }
  });

  it('computes correct win rate from game history', () => {
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('c')], [tm('b'), tm('d')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('d')], [tm('b'), tm('c')]], winningTeam: 1 },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b'), makeParticipant('c'), makeParticipant('d')];
    const ratings = computePlayerRatings(events, players, 3);

    const ratingA = ratings.find(r => r.userId === 'a')!;
    expect(ratingA.gamesPlayed).toBe(3);
    expect(ratingA.gamesWon).toBe(2);
    expect(ratingA.winRate).toBeCloseTo(2 / 3);
    expect(ratingA.hasEnoughData).toBe(true);
    // With no score data, setWinRatio defaults to 0.5
    // effectiveRating = 0.6 * (2/3) + 0.4 * 0.5 = 0.4 + 0.2 = 0.6
    expect(ratingA.effectiveRating).toBeCloseTo(0.6 * (2 / 3) + 0.4 * 0.5);
  });

  it('assigns average rating to players below minimum data threshold', () => {
    // a has 3 games (above threshold of 3), b has only 1
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a'), tm('c')], [tm('b'), tm('d')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('c')], [tm('d'), tm('e')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('d')], [tm('c'), tm('e')]], winningTeam: 0 },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings(events, players, 3);

    const ratingA = ratings.find(r => r.userId === 'a')!;
    const ratingB = ratings.find(r => r.userId === 'b')!;

    expect(ratingA.hasEnoughData).toBe(true);
    // A: winRate=1, setWinRatio=0.5 → effective = 0.6*1 + 0.4*0.5 = 0.8
    expect(ratingA.effectiveRating).toBeCloseTo(0.6 + 0.4 * 0.5);

    expect(ratingB.hasEnoughData).toBe(false);
    // Player B should get the average of reliable players (just A)
    expect(ratingB.effectiveRating).toBeCloseTo(ratingA.effectiveRating);
  });

  it('handles all players below threshold — everyone gets 0.5', () => {
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings(events, players, 3); // threshold=3, each has 1 game

    for (const r of ratings) {
      expect(r.hasEnoughData).toBe(false);
      expect(r.effectiveRating).toBe(0.5);
    }
  });

  it('includes rounds from gameHistory AND current teams/winningTeam', () => {
    // 2 rounds in history + 1 current round = 3 total
    const event: SportEvent = {
      ...emptyEvent,
      gameHistory: [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ],
      teams: [[tm('a')], [tm('b')]],
      winningTeam: 1,
    };

    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings([event], players, 3);

    const ratingA = ratings.find(r => r.userId === 'a')!;
    expect(ratingA.gamesPlayed).toBe(3);
    expect(ratingA.gamesWon).toBe(2); // won 2, lost 1
  });

  it('handles new player not present in any game history', () => {
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b'), makeParticipant('newbie')];
    const ratings = computePlayerRatings(events, players, 1);

    const newbieRating = ratings.find(r => r.userId === 'newbie')!;
    expect(newbieRating.gamesPlayed).toBe(0);
    expect(newbieRating.hasEnoughData).toBe(false);
    // Effective rating = average of reliable players
    const reliableAvg = ratings
      .filter(r => r.hasEnoughData)
      .reduce((s, r) => s + r.effectiveRating, 0) / ratings.filter(r => r.hasEnoughData).length;
    expect(newbieRating.effectiveRating).toBeCloseTo(reliableAvg);
  });

  it('respects custom minGamesThreshold', () => {
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ]),
    ];
    const players = [makeParticipant('a'), makeParticipant('b')];

    // threshold = 1: both have enough data
    const ratings1 = computePlayerRatings(events, players, 1);
    expect(ratings1.every(r => r.hasEnoughData)).toBe(true);

    // threshold = 2: neither has enough data
    const ratings2 = computePlayerRatings(events, players, 2);
    expect(ratings2.every(r => !r.hasEnoughData)).toBe(true);
  });

  it('uses set scores to compute setWinRatio and blended effectiveRating', () => {
    // Player A wins with score 25:20, 25:15 → setRatio for A: (25/45 + 25/40) / 2
    // Player B loses → setRatio for B: (20/45 + 15/40) / 2
    const events = [
      makeEventWithHistory('e1', [
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[25, 20], [25, 15]],
        },
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[25, 20], [25, 15]],
        },
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[25, 20], [25, 15]],
        },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings(events, players, 3);

    const ratingA = ratings.find(r => r.userId === 'a')!;
    const ratingB = ratings.find(r => r.userId === 'b')!;

    // A: winRate = 1.0
    expect(ratingA.winRate).toBeCloseTo(1.0);
    // A's setWinRatio: per set 25/45 and 25/40 → avg across all 6 sets
    const aSetRatio = ((25 / 45 + 25 / 40) * 3) / 6;
    expect(ratingA.setWinRatio).toBeCloseTo(aSetRatio);
    // effectiveRating = 0.6 * 1 + 0.4 * aSetRatio
    expect(ratingA.effectiveRating).toBeCloseTo(0.6 + 0.4 * aSetRatio);

    // B: winRate = 0.0
    expect(ratingB.winRate).toBeCloseTo(0.0);
    const bSetRatio = ((20 / 45 + 15 / 40) * 3) / 6;
    expect(ratingB.setWinRatio).toBeCloseTo(bSetRatio);
    expect(ratingB.effectiveRating).toBeCloseTo(0.4 * bSetRatio);

    // Blended ratings should differentiate better than pure win rate
    expect(ratingA.effectiveRating).toBeGreaterThan(ratingB.effectiveRating);
  });

  it('handles rounds with score containing [0,0] sets (skipped)', () => {
    const events = [
      makeEventWithHistory('e1', [
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[0, 0], [25, 20]],
        },
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[25, 20]],
        },
        {
          teams: [[tm('a')], [tm('b')]],
          winningTeam: 0,
          score: [[25, 20]],
        },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b')];
    const ratings = computePlayerRatings(events, players, 3);

    const ratingA = ratings.find(r => r.userId === 'a')!;
    // 3 valid sets of 25:20 → setRatio for A = 25/45 per set
    expect(ratingA.setWinRatio).toBeCloseTo(25 / 45);
  });
});

// ── balanceTeams ──

describe('balanceTeams', () => {
  it('returns null when not enough players for fixed team size', () => {
    const players = [makeParticipant('a'), makeParticipant('b')];
    // team size 2 requires 4 players
    const result = balanceTeams(players, [], { teamSize: 2 });
    expect(result).toBeNull();
  });

  it('returns null when fewer than 2 players for even split', () => {
    const players = [makeParticipant('a')];
    const result = balanceTeams(players, [], { teamSize: null });
    expect(result).toBeNull();
  });

  it('splits 2 players into 1v1 with no history', () => {
    const players = [makeParticipant('a'), makeParticipant('b')];
    const result = balanceTeams(players, [], { teamSize: null });

    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    expect(team0).toHaveLength(1);
    expect(team1).toHaveLength(1);
    // Both players should be assigned
    const allIds = [...team0, ...team1].map(m => m.userId).sort();
    expect(allIds).toEqual(['a', 'b']);
  });

  it('splits even number of players into equal teams', () => {
    const players = Array.from({ length: 6 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, [], { teamSize: null });

    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    expect(team0).toHaveLength(3);
    expect(team1).toHaveLength(3);
  });

  it('splits odd number of players into teams differing by 1', () => {
    const players = Array.from({ length: 7 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, [], { teamSize: null });

    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    expect(Math.abs(team0.length - team1.length)).toBeLessThanOrEqual(1);
    expect(team0.length + team1.length).toBe(7);
  });

  it('uses fixed team size when specified', () => {
    const players = Array.from({ length: 6 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, [], { teamSize: 2 });

    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    expect(team0).toHaveLength(2);
    expect(team1).toHaveLength(2);
  });

  it('balances teams based on player performance data', () => {
    // Create history where a,b always win and c,d always lose
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0 },
        { teams: [[tm('a'), tm('b')], [tm('c'), tm('d')]], winningTeam: 0 },
      ]),
    ];

    const players = [
      makeParticipant('a'),
      makeParticipant('b'),
      makeParticipant('c'),
      makeParticipant('d'),
    ];

    const result = balanceTeams(players, events, { teamSize: null, minGamesThreshold: 3 });
    expect(result).not.toBeNull();
    const [team0, team1] = result!;

    // The algorithm should split strong (a,b) and weak (c,d) across teams
    const team0Ids = team0.map(m => m.userId);
    const team1Ids = team1.map(m => m.userId);

    // The key assertion: a and b should NOT be on the same team
    const aTeam = team0Ids.includes('a') ? 0 : 1;
    const bTeam = team0Ids.includes('b') ? 0 : 1;
    expect(aTeam).not.toBe(bTeam);
    // All 4 players should be distributed
    expect([...team0Ids, ...team1Ids].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(aTeam).not.toBe(bTeam);
  });

  it('produces balanced team ratings', () => {
    // Create varied win rates
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('p0'), tm('p1'), tm('p2')], [tm('p3'), tm('p4'), tm('p5')]], winningTeam: 0 },
        { teams: [[tm('p0'), tm('p3'), tm('p4')], [tm('p1'), tm('p2'), tm('p5')]], winningTeam: 0 },
        { teams: [[tm('p0'), tm('p5')], [tm('p1'), tm('p3')]], winningTeam: 0 },
      ]),
    ];

    const players = Array.from({ length: 6 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, events, { teamSize: null, minGamesThreshold: 2 });
    expect(result).not.toBeNull();

    const [team0, team1] = result!;
    const ratings = computePlayerRatings(events, players, 2);

    const rating0 = teamRating(team0, ratings);
    const rating1 = teamRating(team1, ratings);

    // Teams should be reasonably balanced — total rating difference < 0.5
    expect(Math.abs(rating0 - rating1)).toBeLessThan(0.5);
  });

  it('treats new players as average (minimum data threshold)', () => {
    // a has 100% win rate (3 games), newbie has 0 games
    const events = [
      makeEventWithHistory('e1', [
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
        { teams: [[tm('a')], [tm('b')]], winningTeam: 0 },
      ]),
    ];

    const players = [makeParticipant('a'), makeParticipant('b'), makeParticipant('newbie1'), makeParticipant('newbie2')];
    const ratings = computePlayerRatings(events, players, 3);

    // newbie should get average of reliable players
    const newbieRating = ratings.find(r => r.userId === 'newbie1')!;
    const reliableAvg = ratings.filter(r => r.hasEnoughData).reduce((s, r) => s + r.effectiveRating, 0) / ratings.filter(r => r.hasEnoughData).length;
    expect(newbieRating.effectiveRating).toBeCloseTo(reliableAvg);
  });

  it('handles all players without history equally', () => {
    const players = Array.from({ length: 4 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, [], { teamSize: null });

    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    // With everyone at 0.5, should still produce valid 2v2
    expect(team0).toHaveLength(2);
    expect(team1).toHaveLength(2);
  });

  it('assigns all players (no one left out) in even split', () => {
    const players = Array.from({ length: 10 }, (_, i) => makeParticipant(`p${i}`));
    const result = balanceTeams(players, [], { teamSize: null });
    expect(result).not.toBeNull();
    const [team0, team1] = result!;
    expect(team0.length + team1.length).toBe(10);
    // No duplicates
    const allIds = [...team0, ...team1].map(m => m.userId);
    expect(new Set(allIds).size).toBe(10);
  });

  it('preserves player name and photoUrl in output', () => {
    const players: Participant[] = [
      { userId: 'x', name: 'Alice', photoUrl: 'alice.jpg', status: 'joined', hasPaid: false },
      { userId: 'y', name: 'Bob', photoUrl: 'bob.jpg', status: 'joined', hasPaid: false },
    ];

    const result = balanceTeams(players, [], { teamSize: null });
    expect(result).not.toBeNull();
    const allMembers = [...result![0], ...result![1]];
    const alice = allMembers.find(m => m.userId === 'x')!;
    expect(alice.name).toBe('Alice');
    expect(alice.photoUrl).toBe('alice.jpg');
  });
});

// ── teamRating ──

describe('teamRating', () => {
  it('sums effective ratings of team members', () => {
    const team: TeamMember[] = [tm('a'), tm('b')];
    const ratings: PlayerRating[] = [
      { userId: 'a', name: 'A', gamesPlayed: 5, gamesWon: 4, winRate: 0.8, setWinRatio: 0.6, effectiveRating: 0.8, hasEnoughData: true },
      { userId: 'b', name: 'B', gamesPlayed: 5, gamesWon: 1, winRate: 0.2, setWinRatio: 0.4, effectiveRating: 0.2, hasEnoughData: true },
    ];

    expect(teamRating(team, ratings)).toBeCloseTo(1.0);
  });

  it('uses 0.5 fallback for unknown members', () => {
    const team: TeamMember[] = [tm('unknown')];
    const ratings: PlayerRating[] = [];

    expect(teamRating(team, ratings)).toBeCloseTo(0.5);
  });
});

// ── DEFAULT_MIN_GAMES_THRESHOLD ──

describe('DEFAULT_MIN_GAMES_THRESHOLD', () => {
  it('is set to 3', () => {
    expect(DEFAULT_MIN_GAMES_THRESHOLD).toBe(3);
  });
});

