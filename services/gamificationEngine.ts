import {
  SportEvent,
  User,
  RankTier,
  PlayerAttributes,
  ActiveQuest,
  PlayerGamificationState,
} from '../types';

// ── Rank & Tier Definitions ──

export interface RankDefinition {
  level: number;
  title: string;
  tier: RankTier;
}

export const RANK_TIERS: Record<RankTier, { label: string; color: string; border: string; bg: string; icon: string }> = {
  bronze: { label: 'Bronz', color: 'text-amber-700', border: 'border-amber-700/60', bg: 'bg-amber-50', icon: '🥉' },
  silver: { label: 'Stříbro', color: 'text-slate-500', border: 'border-slate-300', bg: 'bg-slate-50', icon: '🥈' },
  gold: { label: 'Zlato', color: 'text-yellow-600', border: 'border-yellow-400', bg: 'bg-yellow-50', icon: '🥇' },
  platinum: { label: 'Platina', color: 'text-cyan-600', border: 'border-cyan-400', bg: 'bg-cyan-50', icon: '💎' },
  diamond: { label: 'Diamant', color: 'text-indigo-600', border: 'border-indigo-400', bg: 'bg-indigo-50', icon: '🔮' },
  hall_of_fame: { label: 'Síň slávy', color: 'text-purple-600', border: 'border-purple-500', bg: 'bg-gradient-to-r from-amber-100 to-purple-100', icon: '👑' },
};

export const RANK_DEFINITIONS: RankDefinition[] = [
  { level: 1, title: 'Antukový zelenáč', tier: 'bronze' },
  { level: 2, title: 'Volejbalový rekrut', tier: 'bronze' },
  { level: 3, title: 'Učeň příjmu', tier: 'bronze' },
  { level: 4, title: 'Spolehlivý nahrávač', tier: 'bronze' },
  { level: 5, title: 'Palubovkový bojovník', tier: 'bronze' },
  { level: 6, title: 'Polař základní řady', tier: 'silver' },
  { level: 10, title: 'Týmový pilíř', tier: 'silver' },
  { level: 15, title: 'Opora sestavy', tier: 'silver' },
  { level: 16, title: 'Mistr plachtícího servisu', tier: 'gold' },
  { level: 20, title: 'Bloková zeď', tier: 'gold' },
  { level: 25, title: 'Klubový špílmachr', tier: 'gold' },
  { level: 26, title: 'Zástupce kapitána', tier: 'platinum' },
  { level: 30, title: 'Hráč do koncovky', tier: 'platinum' },
  { level: 35, title: 'Taktický dirigent', tier: 'platinum' },
  { level: 36, title: 'Palubovkový virtuóz', tier: 'diamond' },
  { level: 40, title: 'Smečařský fenomén', tier: 'diamond' },
  { level: 45, title: 'Klubová ikona', tier: 'diamond' },
  { level: 50, title: 'Volejbalová Síň slávy', tier: 'hall_of_fame' },
];

export function getRankForLevel(level: number): { title: string; tier: RankTier } {
  let matched = RANK_DEFINITIONS[0];
  for (const def of RANK_DEFINITIONS) {
    if (level >= def.level) {
      matched = def;
    } else {
      break;
    }
  }
  return { title: matched.title, tier: matched.tier };
}

// ── Level & XP Curve Mathematics ──

/**
 * Returns required XP delta to advance from (targetLevel - 1) to targetLevel.
 */
export function getXpDeltaForLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0;
  if (targetLevel <= 5) return 50 + 100 * (targetLevel - 1);
  if (targetLevel <= 15) return 500 + 50 * (targetLevel - 5);
  if (targetLevel <= 35) return 1000 + 25 * (targetLevel - 15);
  return 1500; // Level 36+
}

/**
 * Calculates level, progress in current level and hint from total accumulated XP.
 * Supports a monotonic high-water mark to prevent accidental de-ranking.
 */
export function calculateLevelFromTotalXp(
  totalXp: number,
  highestLevelAchieved: number = 1
): {
  currentLevel: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  levelProgressPercent: number;
  nextLevelDeficit: number;
  nextLevelHintText: string;
  rankTitle: string;
  rankTier: RankTier;
} {
  let xpAccum = 0;
  let level = 1;

  while (true) {
    const nextDelta = getXpDeltaForLevel(level + 1);
    if (totalXp >= xpAccum + nextDelta) {
      xpAccum += nextDelta;
      level += 1;
    } else {
      break;
    }
  }

  // Monotonic high-water mark: level never drops below previously earned level
  const effectiveLevel = Math.max(level, highestLevelAchieved);
  const xpForNextLevel = getXpDeltaForLevel(effectiveLevel + 1);
  
  // If effectiveLevel > calculated level (due to past match edit), progress is 0
  const xpInCurrentLevel = effectiveLevel === level ? Math.max(0, totalXp - xpAccum) : 0;
  const nextLevelDeficit = Math.max(0, xpForNextLevel - xpInCurrentLevel);
  const levelProgressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpForNextLevel) * 100)));

  // Generate encouraging, human-readable hint text
  let hint: string;
  if (nextLevelDeficit <= 100) {
    hint = `Do Levelu ${effectiveLevel + 1} ti chybí už jen ${nextLevelDeficit} XP! Stačí 1 účast na dalším volejbale.`;
  } else if (nextLevelDeficit <= 200) {
    hint = `Už jen ${nextLevelDeficit} XP do Levelu ${effectiveLevel + 1} – jedna vyhraná akce a je to doma!`;
  } else {
    const approxGames = Math.ceil(nextLevelDeficit / 200);
    hint = `Do dalšího levelu zbývá ${nextLevelDeficit} XP (cca ${approxGames} ${approxGames === 1 ? 'zápas' : approxGames < 5 ? 'zápasy' : 'zápasů'}).`;
  }

  const { title: rankTitle, tier: rankTier } = getRankForLevel(effectiveLevel);

  return {
    currentLevel: effectiveLevel,
    xpInCurrentLevel,
    xpForNextLevel,
    levelProgressPercent,
    nextLevelDeficit,
    nextLevelHintText: hint,
    rankTitle,
    rankTier,
  };
}

// ── Event XP Calculation (with Caps & Exploit Protection) ──

const MAX_EVENT_XP_CAP = 320;
const MAX_SETS_COUNTED = 5;

/** Validates whether a set score represents a genuine match set (prevents 1:0 spamming) */
export function isValidSetScore(set: [number, number]): boolean {
  if (!Array.isArray(set) || set.length !== 2) return false;
  const [a, b] = set;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  const maxScore = Math.max(a, b);
  const diff = Math.abs(a - b);
  // Tiebreak minimum is 15 pts with diff >= 2; standard set minimum is 21 or 25 pts with diff >= 2
  return maxScore >= 15 && diff >= 2;
}

export interface EventXpResult {
  xp: number;
  details: {
    attendance: number;
    earlyBird: number;
    lastMinuteHero: number;
    onTimePayment: number;
    setsPlayed: number;
    setsWon: number;
    matchWon: number;
    clutchMoments: number;
    comebackBonus: number;
    threeSetBattle: number;
    mvpAward: number;
    fairPlayAward: number;
    onFireBonus: number;
    rawTotal: number;
  };
}

export function calculateEventXp(
  event: SportEvent,
  userId: string,
  streakBeforeEvent: number = 0
): EventXpResult {
  const details = {
    attendance: 0,
    earlyBird: 0,
    lastMinuteHero: 0,
    onTimePayment: 0,
    setsPlayed: 0,
    setsWon: 0,
    matchWon: 0,
    clutchMoments: 0,
    comebackBonus: 0,
    threeSetBattle: 0,
    mvpAward: 0,
    fairPlayAward: 0,
    onFireBonus: 0,
    rawTotal: 0,
  };

  const participant = event.participants?.find(p => p.userId === userId);
  if (!participant || participant.status !== 'joined') {
    return { xp: 0, details };
  }

  // 1. Base Attendance
  details.attendance = 100;

  // 2. Early Bird (>48h before event) or Last Minute Hero (<12h)
  const eventDateTime = new Date(`${event.date}T${event.time || '18:00'}:00`).getTime();
  const joinTimestamp = participant.firstJoinedAt;

  if (joinTimestamp && eventDateTime && !isNaN(eventDateTime)) {
    const hoursBefore = (eventDateTime - joinTimestamp) / (1000 * 60 * 60);
    if (hoursBefore >= 48) {
      details.earlyBird = 30;
    } else if (hoursBefore > 0 && hoursBefore <= 12) {
      details.lastMinuteHero = 40;
    }
  }

  // 3. On-time payment
  if (participant.hasPaid) {
    details.onTimePayment = 25;
  }

  // 4. Sets and match results
  const allRounds: { teams: [any[], any[]]; winningTeam?: number; score?: [number, number][] }[] = [];
  if (event.teams && event.winningTeam !== undefined) {
    allRounds.push({ teams: event.teams, winningTeam: event.winningTeam, score: event.score });
  }
  if (event.gameHistory && event.gameHistory.length > 0) {
    for (const r of event.gameHistory) {
      if (r.teams && r.winningTeam !== undefined) {
        allRounds.push(r);
      }
    }
  }

  let validSetsPlayed = 0;
  let validSetsWon = 0;
  let userWonMatch = false;
  let clutchSetsWon = 0;
  let hasComeback = false;

  for (const round of allRounds) {
    const team0 = round.teams[0] || [];
    const team1 = round.teams[1] || [];
    const inTeam0 = team0.some((m: any) => m.userId === userId);
    const inTeam1 = team1.some((m: any) => m.userId === userId);
    if (!inTeam0 && !inTeam1) continue;

    const userTeamIdx = inTeam0 ? 0 : 1;
    if (round.winningTeam === userTeamIdx) {
      userWonMatch = true;
    }

    const sets = round.score || [];
    let firstSetWonByUser: boolean | null = null;
    let roundSetsPlayed = 0;

    for (const s of sets) {
      if (validSetsPlayed >= MAX_SETS_COUNTED) break;
      if (!isValidSetScore(s)) continue;

      roundSetsPlayed += 1;
      validSetsPlayed += 1;
      const userSetScore = s[userTeamIdx];
      const opponentSetScore = s[1 - userTeamIdx];
      const setWon = userSetScore > opponentSetScore;

      if (firstSetWonByUser === null) {
        firstSetWonByUser = setWon;
      }

      if (setWon) {
        validSetsWon += 1;
        // Clutch check: win by exactly 2 points
        if (userSetScore - opponentSetScore === 2) {
          clutchSetsWon += 1;
        }
      }
    }

    // Comeback check: lost first set, but won round
    if (firstSetWonByUser === false && round.winningTeam === userTeamIdx && roundSetsPlayed >= 2) {
      hasComeback = true;
    }

    if (roundSetsPlayed >= 3) {
      details.threeSetBattle = 20;
    }
  }

  // Historical fallback compensation if event had no set scores recorded
  if (allRounds.length === 0 && participant.status === 'joined') {
    details.setsPlayed = 25; // flat game participation compensation
  } else {
    details.setsPlayed = validSetsPlayed * 10;
    details.setsWon = validSetsWon * 15;
    if (userWonMatch) details.matchWon = 30;
    details.clutchMoments = clutchSetsWon * 25;
    if (hasComeback) details.comebackBonus = 25;
  }

  // 5. Awards (MVP, Fair-play, Ironman)
  if (event.eventAwards) {
    if (event.eventAwards.mvpUserId === userId) {
      details.mvpAward = 40;
    }
    if (event.eventAwards.fairPlayUserId === userId || event.eventAwards.ironmanUserId === userId) {
      details.fairPlayAward = 30;
    }
  }

  // Sum raw points
  const subtotal =
    details.attendance +
    details.earlyBird +
    details.lastMinuteHero +
    details.onTimePayment +
    details.setsPlayed +
    details.setsWon +
    details.matchWon +
    details.clutchMoments +
    details.comebackBonus +
    details.threeSetBattle +
    details.mvpAward +
    details.fairPlayAward;

  // 6. Streak On-Fire bonus (+10% for streak >= 3)
  if (streakBeforeEvent >= 3) {
    details.onFireBonus = Math.round(subtotal * 0.1);
  }

  details.rawTotal = subtotal + details.onFireBonus;
  const finalXp = Math.min(MAX_EVENT_XP_CAP, details.rawTotal);

  return { xp: finalXp, details };
}

// ── Radar Attribute Calculations (Calibrated 50–99 Scale) ──

export function sanitizeRadarStat(val: number | null | undefined, fallback: number = 70): number {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return Math.min(99, Math.max(50, Math.round(val)));
}

export function calculatePlayerAttributes(
  events: SportEvent[],
  userId: string,
  userStats?: { eloRating?: number; currentStreak?: number },
  allTeamUserIds: string[] = []
): PlayerAttributes {
  const pastEvents = events
    .filter(e => new Date(e.date) <= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalEvents = pastEvents.length;
  if (totalEvents === 0) {
    return { reliability: 70, form: 70, clutch: 70, teamplay: 70, endurance: 70 };
  }

  let joinedCount = 0;
  let paidCount = 0;
  let clutchWins = 0;
  let clutchSets = 0;
  const teammateSet = new Set<string>();
  const recentWins: boolean[] = [];

  for (const ev of pastEvents) {
    const p = ev.participants?.find(part => part.userId === userId);
    if (!p || p.status !== 'joined') continue;

    joinedCount += 1;
    if (p.hasPaid) paidCount += 1;

    // Check teammates & sets
    const rounds = [...(ev.gameHistory || [])];
    if (ev.teams && ev.winningTeam !== undefined) {
      rounds.push({ teams: ev.teams, winningTeam: ev.winningTeam, score: ev.score });
    }

    for (const r of rounds) {
      const t0 = r.teams[0] || [];
      const t1 = r.teams[1] || [];
      const inT0 = t0.some((m: any) => m.userId === userId);
      const inT1 = t1.some((m: any) => m.userId === userId);
      if (!inT0 && !inT1) continue;

      const userTeam = inT0 ? t0 : t1;
      const userTeamIdx = inT0 ? 0 : 1;
      for (const tm of userTeam) {
        if (tm.userId !== userId) teammateSet.add(tm.userId);
      }

      if (r.winningTeam !== undefined) {
        recentWins.push(r.winningTeam === userTeamIdx);
      }

      for (const s of r.score || []) {
        if (!isValidSetScore(s)) continue;
        const myScore = s[userTeamIdx];
        const oppScore = s[1 - userTeamIdx];
        if (Math.abs(myScore - oppScore) === 2) {
          clutchSets += 1;
          if (myScore > oppScore) clutchWins += 1;
        }
      }
    }
  }

  // 1. Reliability (SPO)
  const attendanceRate = joinedCount / totalEvents;
  const paymentRate = joinedCount > 0 ? paidCount / joinedCount : 1;
  const spoRaw = 50 + 49 * (0.6 * attendanceRate + 0.4 * paymentRate);

  // 2. Form (FOR): Last 5 win rate + normalized ELO (850 - 1150 range)
  const last5 = recentWins.slice(-5);
  const last5WinRate = last5.length > 0 ? last5.filter(Boolean).length / last5.length : 0.5;
  const elo = userStats?.eloRating ?? 1000;
  const normElo = Math.max(0, Math.min(1, (elo - 850) / 300));
  const forRaw = 50 + 49 * (0.5 * last5WinRate + 0.5 * normElo);

  // 3. Clutch (CLU): Bayesian smoothing
  const bayesClutchRate = (clutchWins + 1.5) / (clutchSets + 3.0);
  const cluRaw = 50 + 49 * bayesClutchRate;

  // 4. Teamplay (TÝM): Unique teammates relative to active team size
  const activeTeamSize = Math.max(3, allTeamUserIds.length - 1);
  const targetTeammates = Math.min(15, activeTeamSize);
  const teamplayRatio = Math.min(1, teammateSet.size / targetTeammates);
  const tymRaw = 50 + 49 * teamplayRatio;

  // 5. Endurance (VÝD): Total events played (scale to 25 events)
  const vydRaw = 50 + 49 * Math.min(1, joinedCount / 25);

  return {
    reliability: sanitizeRadarStat(spoRaw),
    form: sanitizeRadarStat(forRaw),
    clutch: sanitizeRadarStat(cluRaw),
    teamplay: sanitizeRadarStat(tymRaw),
    endurance: sanitizeRadarStat(vydRaw),
  };
}

// ── Quests & Milestones Generation ──

export function generateActiveQuests(
  events: SportEvent[],
  userId: string
): ActiveQuest[] {
  const pastEvents = events
    .filter(e => new Date(e.date) <= new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const userJoinedPast = pastEvents.filter(e =>
    e.participants?.some(p => p.userId === userId && p.status === 'joined')
  );

  // Calculate weekly attendance in last 7 days
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const joinedThisWeek = userJoinedPast.filter(e => new Date(e.date) >= weekAgo).length;

  // Count paid on time
  const totalJoined = userJoinedPast.length;
  const totalPaid = userJoinedPast.filter(e =>
    e.participants?.some(p => p.userId === userId && p.hasPaid)
  ).length;

  return [
    {
      id: 'quest-weekly-2',
      title: 'Dvojitá porce',
      description: 'Zúčastni se 2 akcí během jednoho týdne',
      type: 'weekly',
      progress: Math.min(2, joinedThisWeek),
      goal: 2,
      xpReward: 100,
      isCompleted: joinedThisWeek >= 2,
    },
    {
      id: 'quest-clean-sheet',
      title: 'Spolehlivý bankéř',
      description: 'Měj zaplacené všechny odehrané zápasy',
      type: 'monthly',
      progress: totalJoined > 0 ? totalPaid : 1,
      goal: totalJoined > 0 ? totalJoined : 1,
      xpReward: 150,
      isCompleted: totalJoined > 0 && totalPaid >= totalJoined,
    },
    {
      id: 'quest-marathon-10',
      title: 'Klubový veterán',
      description: 'Odehraj alespoň 10 týmových akcí',
      type: 'lifetime',
      progress: Math.min(10, totalJoined),
      goal: 10,
      xpReward: 250,
      isCompleted: totalJoined >= 10,
    },
  ];
}

// ── Main Gamification State Calculator ──

export function computePlayerGamification(
  events: SportEvent[],
  userId: string,
  currentUser?: User,
  allTeamUserIds: string[] = [],
  userStats?: { eloRating?: number; currentStreak?: number }
): PlayerGamificationState {
  const sortedPastEvents = events
    .filter(e => new Date(e.date) <= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalXp = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let mvpAwardsCount = 0;
  let kudosCount = 0;

  for (let i = 0; i < sortedPastEvents.length; i++) {
    const ev = sortedPastEvents[i];
    const p = ev.participants?.find(part => part.userId === userId);
    const joined = p && p.status === 'joined';

    // Season pause check: gap > 14 days between events freezes streak
    if (i > 0) {
      const prevEv = sortedPastEvents[i - 1];
      const daysDiff = (new Date(ev.date).getTime() - new Date(prevEv.date).getTime()) / (1000 * 60 * 60 * 24);
      // Season pause keeps streak alive automatically
      if (daysDiff > 14 && currentStreak > 0) {
        // preserved
      }
    }

    if (joined) {
      currentStreak += 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else if (p && (p.status === 'declined' || p.status === 'maybe')) {
      currentStreak = 0;
    }

    const { xp } = calculateEventXp(ev, userId, currentStreak);
    totalXp += xp;

    if (ev.eventAwards?.mvpUserId === userId) {
      mvpAwardsCount += 1;
    }

    if (p?.kudosReceived && p.kudosReceived.length > 0) {
      kudosCount += p.kudosReceived.length;
    }
  }

  const highestAchieved = currentUser?.highestLevelAchieved ?? 1;
  const levelData = calculateLevelFromTotalXp(totalXp, highestAchieved);
  const attributes = calculatePlayerAttributes(events, userId, userStats, allTeamUserIds);
  const activeQuests = generateActiveQuests(events, userId);

  return {
    userId,
    totalXp,
    currentLevel: levelData.currentLevel,
    highestLevelAchieved: Math.max(highestAchieved, levelData.currentLevel),
    rankTitle: levelData.rankTitle,
    rankTier: levelData.rankTier,
    xpInCurrentLevel: levelData.xpInCurrentLevel,
    xpForNextLevel: levelData.xpForNextLevel,
    levelProgressPercent: levelData.levelProgressPercent,
    currentAttendanceStreak: currentStreak,
    longestAttendanceStreak: longestStreak,
    streakShieldsAvailable: Math.min(2, Math.floor(sortedPastEvents.filter(e => e.participants?.some(p => p.userId === userId && p.status === 'joined')).length / 5)),
    isOnFire: currentStreak >= 3,
    isStreakFrozen: false,
    attributes,
    activeQuests,
    nextLevelDeficit: levelData.nextLevelDeficit,
    nextLevelHintText: levelData.nextLevelHintText,
    mvpAwardsCount,
    kudosCount,
  };
}

export const calculatePlayerGamification = computePlayerGamification;
