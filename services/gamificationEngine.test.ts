import { describe, it, expect } from 'vitest';
import {
  getXpDeltaForLevel,
  calculateLevelFromTotalXp,
  getRankForLevel,
  isValidSetScore,
  calculateEventXp,
  sanitizeRadarStat,
  calculatePlayerAttributes,
  generateActiveQuests,
  computePlayerGamification,
} from './gamificationEngine';
import { SportEvent, User } from '../types';

describe('Gamification Engine: Level Curve & Ranks', () => {
  it('correctly calculates XP deltas across all 4 phases', () => {
    // Phase 1 (1–5): 50 + 100 * (L - 1)
    expect(getXpDeltaForLevel(2)).toBe(150);
    expect(getXpDeltaForLevel(3)).toBe(250);
    expect(getXpDeltaForLevel(4)).toBe(350);
    expect(getXpDeltaForLevel(5)).toBe(450);

    // Phase 2 (6–15): 500 + 50 * (L - 5)
    expect(getXpDeltaForLevel(6)).toBe(550);
    expect(getXpDeltaForLevel(10)).toBe(750);
    expect(getXpDeltaForLevel(15)).toBe(1000);

    // Phase 3 (16–35): 1000 + 25 * (L - 15)
    expect(getXpDeltaForLevel(16)).toBe(1025);
    expect(getXpDeltaForLevel(25)).toBe(1250);
    expect(getXpDeltaForLevel(35)).toBe(1500);

    // Phase 4 (36+): 1500 fixně
    expect(getXpDeltaForLevel(36)).toBe(1500);
    expect(getXpDeltaForLevel(50)).toBe(1500);
  });

  it('calculates initial Level 1 for 0 XP', () => {
    const res = calculateLevelFromTotalXp(0);
    expect(res.currentLevel).toBe(1);
    expect(res.xpInCurrentLevel).toBe(0);
    expect(res.xpForNextLevel).toBe(150);
    expect(res.levelProgressPercent).toBe(0);
    expect(res.rankTitle).toBe('Antukový zelenáč');
    expect(res.rankTier).toBe('bronze');
  });

  it('advances to Level 2 after 150 XP (first match)', () => {
    const res = calculateLevelFromTotalXp(200);
    expect(res.currentLevel).toBe(2);
    expect(res.xpInCurrentLevel).toBe(50);
    expect(res.xpForNextLevel).toBe(250);
    expect(res.levelProgressPercent).toBe(20);
    expect(res.rankTitle).toBe('Volejbalový rekrut');
    expect(res.rankTier).toBe('bronze');
  });

  it('matches silver tier at Level 10 and gold at Level 16', () => {
    expect(getRankForLevel(10).tier).toBe('silver');
    expect(getRankForLevel(10).title).toBe('Týmový pilíř');

    expect(getRankForLevel(16).tier).toBe('gold');
    expect(getRankForLevel(16).title).toBe('Mistr plachtícího servisu');

    expect(getRankForLevel(50).tier).toBe('hall_of_fame');
    expect(getRankForLevel(50).title).toBe('Volejbalová Síň slávy');
  });

  it('guarantees monotonic high-water mark (never deranks)', () => {
    // Player previously earned Level 12 (highestLevelAchieved = 12)
    // but totalXp recalculation temporarily drops to 500 XP
    const res = calculateLevelFromTotalXp(500, 12);
    expect(res.currentLevel).toBe(12);
    expect(res.levelProgressPercent).toBe(0);
  });
});

describe('Gamification Engine: Anti-Farming & Set Validation', () => {
  it('validates genuine volleyball sets and rejects spam scores', () => {
    expect(isValidSetScore([25, 20])).toBe(true);
    expect(isValidSetScore([26, 24])).toBe(true);
    expect(isValidSetScore([15, 13])).toBe(true); // valid tiebreak

    // Spam / invalid scores
    expect(isValidSetScore([1, 0])).toBe(false);
    expect(isValidSetScore([5, 3])).toBe(false);
    expect(isValidSetScore([25, 25])).toBe(false); // no 2 pt diff
    expect(isValidSetScore([14, 12])).toBe(false); // below 15
  });

  it('calculates event XP with attendance, on-time payment, and caps at 320 XP', () => {
    const event: SportEvent = {
      id: 'ev-1',
      title: 'Volejbal',
      date: '2026-10-10',
      time: '18:00',
      location: 'Hala',
      totalCost: 1000,
      accountNumber: '123/0100',
      participants: [
        {
          userId: 'u1',
          name: 'Lukáš',
          status: 'joined',
          hasPaid: true,
          firstJoinedAt: new Date('2026-10-07T12:00:00').getTime(), // >48h Early bird!
        },
      ],
      teams: [
        [{ userId: 'u1', name: 'Lukáš' }],
        [{ userId: 'u2', name: 'Petr' }],
      ],
      winningTeam: 0,
      score: [
        [25, 20],
        [26, 24], // clutch!
      ],
    };

    const result = calculateEventXp(event, 'u1', 3); // with On-Fire streak >= 3
    expect(result.details.attendance).toBe(100);
    expect(result.details.earlyBird).toBe(30);
    expect(result.details.onTimePayment).toBe(25);
    expect(result.details.setsPlayed).toBe(20); // 2 sets * 10
    expect(result.details.setsWon).toBe(30); // 2 sets * 15
    expect(result.details.matchWon).toBe(30);
    expect(result.details.clutchMoments).toBe(25); // 1 clutch set * 25
    expect(result.details.onFireBonus).toBeGreaterThan(0);
    expect(result.xp).toBeLessThanOrEqual(320); // Hard cap check
  });

  it('awards flat 25 XP compensation for historical events with no recorded scores', () => {
    const historicalEvent: SportEvent = {
      id: 'ev-old',
      title: 'Starý Volejbal',
      date: '2026-01-10',
      time: '18:00',
      location: 'Hala',
      totalCost: 1000,
      accountNumber: '123/0100',
      participants: [
        { userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true },
      ],
    };

    const res = calculateEventXp(historicalEvent, 'u1', 0);
    expect(res.details.attendance).toBe(100);
    expect(res.details.setsPlayed).toBe(25); // compensation
    expect(res.details.onTimePayment).toBe(25);
    expect(res.xp).toBe(150);
  });
});

describe('Gamification Engine: Radar Attributes (50–99 Scale)', () => {
  it('sanitizes NaN and null values safely into 50–99 range', () => {
    expect(sanitizeRadarStat(NaN)).toBe(70);
    expect(sanitizeRadarStat(null)).toBe(70);
    expect(sanitizeRadarStat(undefined)).toBe(70);
    expect(sanitizeRadarStat(120)).toBe(99);
    expect(sanitizeRadarStat(30)).toBe(50);
    expect(sanitizeRadarStat(84.7)).toBe(85);
  });

  it('calibrates ELO form correctly for amateur range (850–1150)', () => {
    const events: SportEvent[] = [
      {
        id: 'ev-1',
        title: 'Volejbal',
        date: '2026-10-01',
        time: '18:00',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true }],
        teams: [
          [{ userId: 'u1', name: 'Lukáš' }, { userId: 'u2', name: 'Petr' }],
          [{ userId: 'u3', name: 'Jan' }, { userId: 'u4', name: 'Tomáš' }],
        ],
        winningTeam: 0,
        score: [[25, 23]],
      },
    ];

    const attrs = calculatePlayerAttributes(events, 'u1', { eloRating: 1100, currentStreak: 1 }, ['u1', 'u2', 'u3', 'u4']);
    expect(attrs.reliability).toBeGreaterThanOrEqual(50);
    expect(attrs.reliability).toBeLessThanOrEqual(99);
    expect(attrs.form).toBeGreaterThan(70); // 1100 ELO + win
    expect(attrs.clutch).toBeGreaterThan(60); // Bayes smoothed
    expect(attrs.teamplay).toBeGreaterThanOrEqual(50);
    expect(attrs.endurance).toBeGreaterThanOrEqual(50);
  });
});

describe('Gamification Engine: Streaks & Season Pause', () => {
  it('preserves attendance streak across a season pause (>14 days gap)', () => {
    const events: SportEvent[] = [
      {
        id: 'ev-dec',
        date: '2025-12-15',
        time: '18:00',
        title: 'Volejbal',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true }],
      },
      {
        id: 'ev-jan',
        date: '2026-01-10', // 26 days gap (Vánoční pauza)
        time: '18:00',
        title: 'Volejbal',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true }],
      },
    ];

    const state = computePlayerGamification(events, 'u1');
    expect(state.currentAttendanceStreak).toBe(2); // Streak was preserved!
  });

  it('resets streak if player declines an event', () => {
    const events: SportEvent[] = [
      {
        id: 'ev-1',
        date: '2026-10-01',
        time: '18:00',
        title: 'Volejbal',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true }],
      },
      {
        id: 'ev-2',
        date: '2026-10-08',
        time: '18:00',
        title: 'Volejbal',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'declined', hasPaid: false }],
      },
    ];

    const state = computePlayerGamification(events, 'u1');
    expect(state.currentAttendanceStreak).toBe(0);
  });
});

describe('Gamification Engine: Quests & Milestones', () => {
  it('generates active quests with correct progress', () => {
    const events: SportEvent[] = [
      {
        id: 'ev-1',
        date: new Date().toISOString().split('T')[0],
        time: '18:00',
        title: 'Volejbal',
        location: 'Hala',
        totalCost: 1000,
        accountNumber: '123/0100',
        participants: [{ userId: 'u1', name: 'Lukáš', status: 'joined', hasPaid: true }],
      },
    ];

    const quests = generateActiveQuests(events, 'u1');
    expect(quests.length).toBe(3);
    const weeklyQuest = quests.find(q => q.id === 'quest-weekly-2');
    expect(weeklyQuest?.progress).toBe(1);
    expect(weeklyQuest?.goal).toBe(2);
    expect(weeklyQuest?.isCompleted).toBe(false);

    const cleanSheetQuest = quests.find(q => q.id === 'quest-clean-sheet');
    expect(cleanSheetQuest?.isCompleted).toBe(true);
  });
});
