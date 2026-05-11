import { SportEvent, UserStats, GameRound, MonthlyTrend, Badge, DuoStats, LeaderboardEntry, PlayerFormTrend, NemesisData, EventHealthMetrics, ClutchData, SportConfig, TeamMember } from '../types';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

// ── Thresholds ──
export const THRESHOLDS = {
  ELO_MIN_GAMES: 5,
  FORM_LAST5: 5,
  FORM_LAST10: 10,
  NEMESIS_MIN_GAMES: 3,
  CLUTCH_MIN_SETS: 5,
  DUO_MIN_GAMES: 3,
  LEADERBOARD_MIN_EVENTS: 3,
  DAY_HEATMAP_MIN_EVENTS: 5,
} as const;

// ── Helpers ──

export function getAllRounds(event: SportEvent): GameRound[] {
  const rounds: GameRound[] = [...(event.gameHistory || [])];
  if (event.teams && event.winningTeam !== undefined) {
    rounds.push({ teams: event.teams, winningTeam: event.winningTeam, score: event.score });
  }
  return rounds;
}

// ── Core User Stats (extracted from useStatistics) ──

export function computeUserStats(events: SportEvent[]): Map<string, UserStats> {
  const statsMap = new Map<string, UserStats>();
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // First pass: init all users
  for (const event of sortedEvents) {
    for (const p of event.participants) {
      if (!statsMap.has(p.userId)) {
        statsMap.set(p.userId, {
          userId: p.userId, name: p.name, photoUrl: p.photoUrl,
          totalEvents: 0, eventsJoined: 0, eventsDeclined: 0, eventsMaybe: 0,
          attendanceRate: 0, paymentRate: 0, totalPaid: 0, totalOwed: 0,
          longestStreak: 0, currentStreak: 0, favoriteLocation: '',
          gamesPlayed: 0, gamesWon: 0, winRate: 0,
          winStreak: 0, longestWinStreak: 0,
          setsWon: 0, setsLost: 0, setWinRate: 0,
        });
      }
    }
  }

  // Second pass: compute per-user stats
  const streaks = new Map<string, { current: number; longest: number; lastJoined: boolean }>();
  const locations = new Map<string, Map<string, number>>();

  for (const event of sortedEvents) {
    const joinedCount = event.participants.filter(p => p.status === 'joined').length;
    const costPerPerson = joinedCount > 0 ? Math.ceil(event.totalCost / joinedCount) : 0;

    for (const p of event.participants) {
      const stats = statsMap.get(p.userId)!;
      stats.totalEvents++;

      if (p.status === 'joined') {
        stats.eventsJoined++;
        if (p.hasPaid) stats.totalPaid += costPerPerson;
        else stats.totalOwed += costPerPerson;

        if (!locations.has(p.userId)) locations.set(p.userId, new Map());
        const locMap = locations.get(p.userId)!;
        locMap.set(event.location, (locMap.get(event.location) || 0) + 1);
      } else if (p.status === 'declined') {
        stats.eventsDeclined++;
      } else if (p.status === 'maybe') {
        stats.eventsMaybe++;
      }

      if (!streaks.has(p.userId)) streaks.set(p.userId, { current: 0, longest: 0, lastJoined: false });
      const streak = streaks.get(p.userId)!;
      if (p.status === 'joined') {
        streak.current++;
        streak.lastJoined = true;
        if (streak.current > streak.longest) streak.longest = streak.current;
      } else {
        streak.lastJoined = false;
        streak.current = 0;
      }
    }

    // Win + set tracking
    const allRounds = getAllRounds(event);
    for (const round of allRounds) {
      if (round.winningTeam === undefined) continue;
      const winningTeam = round.teams[round.winningTeam];
      const losingTeam = round.teams[1 - round.winningTeam];

      let teamSetsWon: [number, number] = [0, 0];
      if (round.score && Array.isArray(round.score)) {
        for (const [s0, s1] of round.score) {
          if (s0 + s1 === 0) continue;
          if (s0 > s1) teamSetsWon[0]++;
          else if (s1 > s0) teamSetsWon[1]++;
        }
      }

      for (const member of [...winningTeam, ...losingTeam]) {
        const stats = statsMap.get(member.userId);
        if (!stats) continue;
        stats.gamesPlayed++;
        const isWinner = winningTeam.some(m => m.userId === member.userId);
        if (isWinner) {
          stats.gamesWon++;
          stats.setsWon += teamSetsWon[round.winningTeam];
          stats.setsLost += teamSetsWon[1 - round.winningTeam];
        } else {
          stats.setsWon += teamSetsWon[1 - round.winningTeam];
          stats.setsLost += teamSetsWon[round.winningTeam];
        }
      }
    }
  }

  // Win streak tracking
  const winStreaks = new Map<string, { current: number; longest: number }>();
  for (const event of sortedEvents) {
    const allRounds = getAllRounds(event);
    for (const round of allRounds) {
      if (round.winningTeam === undefined) continue;
      const winningTeam = round.teams[round.winningTeam];
      const losingTeam = round.teams[1 - round.winningTeam];

      for (const member of [...winningTeam, ...losingTeam]) {
        if (!winStreaks.has(member.userId)) winStreaks.set(member.userId, { current: 0, longest: 0 });
        const ws = winStreaks.get(member.userId)!;
        if (winningTeam.some(m => m.userId === member.userId)) {
          ws.current++;
          if (ws.current > ws.longest) ws.longest = ws.current;
        } else {
          ws.current = 0;
        }
      }
    }
  }

  // Finalize rates
  for (const [userId, stats] of statsMap) {
    stats.attendanceRate = stats.totalEvents > 0 ? stats.eventsJoined / stats.totalEvents : 0;
    const paidCount = events.reduce((sum, e) => {
      const p = e.participants.find(p => p.userId === userId);
      return sum + (p && p.status === 'joined' && p.hasPaid ? 1 : 0);
    }, 0);
    stats.paymentRate = stats.eventsJoined > 0 ? paidCount / stats.eventsJoined : 0;

    const streak = streaks.get(userId);
    if (streak) {
      stats.longestStreak = streak.longest;
      stats.currentStreak = streak.lastJoined ? streak.current : 0;
    }

    const locMap = locations.get(userId);
    if (locMap && locMap.size > 0) {
      let maxCount = 0, favLoc = '';
      for (const [loc, count] of locMap) {
        if (count > maxCount) { maxCount = count; favLoc = loc; }
      }
      stats.favoriteLocation = favLoc;
    }

    stats.winRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;
    stats.setWinRate = (stats.setsWon + stats.setsLost) > 0 ? stats.setsWon / (stats.setsWon + stats.setsLost) : 0;
    const ws = winStreaks.get(userId);
    if (ws) {
      stats.winStreak = ws.current;
      stats.longestWinStreak = ws.longest;
    }
  }

  return statsMap;
}

// ── ELO ──

const ELO_INITIAL = 1000;
const ELO_K = 32;

function teamAvgRating(team: TeamMember[], ratings: Map<string, number>): number {
  if (team.length === 0) return ELO_INITIAL;
  return team.reduce((s, m) => s + (ratings.get(m.userId) ?? ELO_INITIAL), 0) / team.length;
}

export function computeEloRatings(events: SportEvent[]): Map<string, number> {
  const ratings = new Map<string, number>();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  for (const event of sorted) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined) continue;
      const winners = round.teams[round.winningTeam];
      const losers = round.teams[1 - round.winningTeam];

      const avgW = teamAvgRating(winners, ratings);
      const avgL = teamAvgRating(losers, ratings);
      const expectedW = 1 / (1 + Math.pow(10, (avgL - avgW) / 400));

      for (const m of winners) {
        ratings.set(m.userId, (ratings.get(m.userId) ?? ELO_INITIAL) + ELO_K * (1 - expectedW));
      }
      for (const m of losers) {
        ratings.set(m.userId, (ratings.get(m.userId) ?? ELO_INITIAL) + ELO_K * (0 - (1 - expectedW)));
      }
    }
  }
  return ratings;
}

// ── Form Curve ──

function getChronologicalResults(events: SportEvent[], userId: string): boolean[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const results: boolean[] = [];

  for (const event of sorted) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined) continue;
      const isIn = round.teams[0].some(m => m.userId === userId) || round.teams[1].some(m => m.userId === userId);
      if (!isIn) continue;
      results.push(round.teams[round.winningTeam].some(m => m.userId === userId));
    }
  }
  return results;
}

export function computeFormTrend(events: SportEvent[], userId: string): PlayerFormTrend {
  const results = getChronologicalResults(events, userId);
  const total = results.length;
  const allTimeWinRate = total > 0 ? results.filter(Boolean).length / total : 0;
  const recent = results.slice(-10).reverse();

  const last5 = total >= THRESHOLDS.FORM_LAST5 ? results.slice(-5) : null;
  const last10 = total >= THRESHOLDS.FORM_LAST10 ? results.slice(-10) : null;
  const last5WinRate = last5 ? last5.filter(Boolean).length / last5.length : null;
  const last10WinRate = last10 ? last10.filter(Boolean).length / last10.length : null;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (last5WinRate !== null) {
    const diff = last5WinRate - allTimeWinRate;
    if (diff > 0.1) trend = 'up';
    else if (diff < -0.1) trend = 'down';
  }

  return { last5WinRate, last10WinRate, allTimeWinRate, trend, recentResults: recent };
}

// ── Day Heatmap ──

export function computeDayHeatmap(events: SportEvent[], userId: string): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 … Sun=6
  for (const event of events) {
    const p = event.participants.find(p => p.userId === userId);
    if (!p || p.status !== 'joined') continue;
    const dayOfWeek = (new Date(event.date + 'T00:00:00').getDay() + 6) % 7;
    days[dayOfWeek]++;
  }
  return days;
}

// ── Nemesis ──

export function computeNemesis(events: SportEvent[], userId: string): NemesisData {
  const opponents = new Map<string, { name: string; photoUrl?: string; wins: number; losses: number }>();

  for (const event of events) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined) continue;
      const myTeamIdx = round.teams[0].some(m => m.userId === userId) ? 0
        : round.teams[1].some(m => m.userId === userId) ? 1 : -1;
      if (myTeamIdx === -1) continue;

      const isWin = myTeamIdx === round.winningTeam;
      for (const opp of round.teams[1 - myTeamIdx]) {
        if (!opponents.has(opp.userId)) opponents.set(opp.userId, { name: opp.name, photoUrl: opp.photoUrl, wins: 0, losses: 0 });
        const r = opponents.get(opp.userId)!;
        if (isWin) r.wins++; else r.losses++;
      }
    }
  }

  let nemesis: NemesisData['nemesis'] = null;
  let favorite: NemesisData['favorite'] = null;
  let worstRate = Infinity, bestRate = -Infinity;

  for (const [oppId, data] of opponents) {
    const total = data.wins + data.losses;
    if (total < THRESHOLDS.NEMESIS_MIN_GAMES) continue;
    const winRate = data.wins / total;
    if (winRate < worstRate || (winRate === worstRate && total > (nemesis?.gamesAgainst ?? 0))) {
      worstRate = winRate;
      nemesis = { userId: oppId, name: data.name, photoUrl: data.photoUrl, winRate, gamesAgainst: total };
    }
    if (winRate > bestRate || (winRate === bestRate && total > (favorite?.gamesAgainst ?? 0))) {
      bestRate = winRate;
      favorite = { userId: oppId, name: data.name, photoUrl: data.photoUrl, winRate, gamesAgainst: total };
    }
  }

  return { nemesis, favorite };
}

// ── Clutch Factor ──

export function computeClutchFactor(events: SportEvent[], userId: string): ClutchData {
  let clutchWins = 0, clutchLosses = 0, blowoutWins = 0, blowoutLosses = 0;

  for (const event of events) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined || !round.score) continue;
      const myTeamIdx = round.teams[0].some(m => m.userId === userId) ? 0
        : round.teams[1].some(m => m.userId === userId) ? 1 : -1;
      if (myTeamIdx === -1) continue;
      const isWin = myTeamIdx === round.winningTeam;

      for (const [s0, s1] of round.score) {
        if (s0 + s1 === 0) continue;
        const margin = Math.abs(s0 - s1);
        if (margin <= 3) { if (isWin) clutchWins++; else clutchLosses++; }
        else { if (isWin) blowoutWins++; else blowoutLosses++; }
      }
    }
  }

  const clutchTotal = clutchWins + clutchLosses;
  const blowoutTotal = blowoutWins + blowoutLosses;
  return {
    clutchWinRate: clutchTotal >= THRESHOLDS.CLUTCH_MIN_SETS ? clutchWins / clutchTotal : null,
    blowoutWinRate: blowoutTotal >= THRESHOLDS.CLUTCH_MIN_SETS ? blowoutWins / blowoutTotal : null,
    clutchSetsPlayed: clutchTotal,
  };
}

// ── Reliability Score ──

export function computeReliabilityScore(stats: UserStats): number {
  return Math.round((0.6 * stats.attendanceRate + 0.4 * stats.paymentRate) * 100);
}

// ── Leaderboard ──

export function computeLeaderboard(statsMap: Map<string, UserStats>, eloMap: Map<string, number>): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  for (const [userId, stats] of statsMap) {
    if (stats.eventsJoined < THRESHOLDS.LEADERBOARD_MIN_EVENTS) continue;
    entries.push({
      userId, name: stats.name, photoUrl: stats.photoUrl, rank: 0,
      eloRating: Math.round(eloMap.get(userId) ?? ELO_INITIAL),
      winRate: stats.winRate, gamesPlayed: stats.gamesPlayed,
      attendanceRate: stats.attendanceRate,
      reliabilityScore: computeReliabilityScore(stats),
    });
  }
  entries.sort((a, b) => b.eloRating - a.eloRating);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

// ── Event Health ──

export function computeEventHealth(events: SportEvent[], sportConfigs: SportConfig[]): EventHealthMetrics {
  let totalFillRate = 0, eventsWithFill = 0;
  const gameMargins: EventHealthMetrics['mostCompetitiveGames'] = [];

  for (const event of events) {
    const joinedCount = event.participants.filter(p => p.status === 'joined').length;
    const config = sportConfigs.find(c => c.type === (event.sportType ?? 'volejbal'));
    const maxPlayers = config?.maxPlayers ?? 12;
    if (maxPlayers > 0) { totalFillRate += Math.min(joinedCount / maxPlayers, 1); eventsWithFill++; }

    const margins: number[] = [];
    for (const round of getAllRounds(event)) {
      if (!round.score) continue;
      for (const [s0, s1] of round.score) {
        if (s0 + s1 === 0) continue;
        margins.push(Math.abs(s0 - s1));
      }
    }
    if (margins.length > 0) {
      gameMargins.push({ eventId: event.id, eventTitle: event.title, date: event.date, avgMargin: margins.reduce((a, b) => a + b, 0) / margins.length });
    }
  }

  const sorted = [...gameMargins].sort((a, b) => a.avgMargin - b.avgMargin).slice(0, 3);
  const allM = gameMargins.map(g => g.avgMargin);
  return {
    avgFillRate: eventsWithFill > 0 ? totalFillRate / eventsWithFill : 0,
    mostCompetitiveGames: sorted,
    avgSetMargin: allM.length > 0 ? Math.round(allM.reduce((a, b) => a + b, 0) / allM.length * 10) / 10 : 0,
  };
}

// ── Monthly Trends ──

export function computeMonthlyTrends(events: SportEvent[]): MonthlyTrend[] {
  const monthMap = new Map<string, SportEvent[]>();
  for (const event of events) {
    const month = event.date.substring(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(event);
  }
  const trends: MonthlyTrend[] = [];
  for (const [month, evts] of monthMap) {
    const date = new Date(month + '-01');
    const totalJoined = evts.reduce((sum, e) => sum + e.participants.filter(p => p.status === 'joined').length, 0);
    trends.push({
      month, label: format(date, 'LLL yyyy', { locale: cs }),
      eventCount: evts.length,
      averageAttendance: evts.length > 0 ? Math.round(totalJoined / evts.length * 10) / 10 : 0,
      totalParticipants: totalJoined,
    });
  }
  return trends.sort((a, b) => a.month.localeCompare(b.month));
}

// ── Duo Stats ──

export function computeDuoStats(events: SportEvent[]): DuoStats[] {
  const pairMap = new Map<string, { players: [string, string]; names: [string, string]; photos: [string | undefined, string | undefined]; played: number; won: number; setsWon: number; setsLost: number }>();

  for (const event of events) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined) continue;
      let teamSetsWon: [number, number] = [0, 0];
      if (round.score && Array.isArray(round.score)) {
        for (const [s0, s1] of round.score) {
          if (s0 + s1 === 0) continue;
          if (s0 > s1) teamSetsWon[0]++; else if (s1 > s0) teamSetsWon[1]++;
        }
      }
      for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
        const team = round.teams[teamIdx];
        const isWin = teamIdx === round.winningTeam;
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const ids = [team[i].userId, team[j].userId].sort();
            const key = ids.join('_');
            if (!pairMap.has(key)) {
              const p1 = ids[0] === team[i].userId ? team[i] : team[j];
              const p2 = ids[0] === team[i].userId ? team[j] : team[i];
              pairMap.set(key, { players: [p1.userId, p2.userId], names: [p1.name, p2.name], photos: [p1.photoUrl, p2.photoUrl], played: 0, won: 0, setsWon: 0, setsLost: 0 });
            }
            const pair = pairMap.get(key)!;
            pair.played++;
            if (isWin) pair.won++;
            pair.setsWon += teamSetsWon[teamIdx];
            pair.setsLost += teamSetsWon[1 - teamIdx];
          }
        }
      }
    }
  }

  return Array.from(pairMap.values())
    .filter(p => p.played >= THRESHOLDS.DUO_MIN_GAMES)
    .sort((a, b) => {
      const aS = (a.setsWon + a.setsLost) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0.5;
      const bS = (b.setsWon + b.setsLost) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0.5;
      const aW = a.played > 0 ? a.won / a.played : 0;
      const bW = b.played > 0 ? b.won / b.played : 0;
      return (0.6 * bW + 0.4 * bS) - (0.6 * aW + 0.4 * aS) || b.won - a.won;
    })
    .slice(0, 5)
    .map(p => ({
      players: [
        { userId: p.players[0], name: p.names[0], photoUrl: p.photos[0] },
        { userId: p.players[1], name: p.names[1], photoUrl: p.photos[1] },
      ] as DuoStats['players'],
      gamesPlayed: p.played, gamesWon: p.won,
      winRate: p.played > 0 ? p.won / p.played : 0,
      setsWon: p.setsWon, setsLost: p.setsLost,
      setWinRate: (p.setsWon + p.setsLost) > 0 ? p.setsWon / (p.setsWon + p.setsLost) : 0,
    }));
}

// ── Extended Badges ──

export function computeExtendedBadges(statsMap: Map<string, UserStats>, events: SportEvent[]): Badge[] {
  const allStats = Array.from(statsMap.values());
  if (allStats.length === 0) return [];
  const badges: Badge[] = [];

  const ironMan = allStats.reduce((best, s) => s.longestStreak > best.longestStreak ? s : best);
  if (ironMan.longestStreak > 0) badges.push({ type: 'ironman', label: 'Iron Man', description: 'Nejdelší série účastí v řadě', iconName: 'Flame', userId: ironMan.userId, userName: ironMan.name, photoUrl: ironMan.photoUrl, value: `${ironMan.longestStreak}× v řadě` });

  const ghost = allStats.reduce((best, s) => s.eventsDeclined > best.eventsDeclined ? s : best);
  if (ghost.eventsDeclined > 0) badges.push({ type: 'ghost', label: 'Duch', description: 'Nejvíce odmítnutých událostí', iconName: 'Ghost', userId: ghost.userId, userName: ghost.name, photoUrl: ghost.photoUrl, value: `${ghost.eventsDeclined}× odmítnuto` });

  const maybeMaster = allStats.reduce((best, s) => s.eventsMaybe > best.eventsMaybe ? s : best);
  if (maybeMaster.eventsMaybe > 0) badges.push({ type: 'maybeMaster', label: 'Možná Mistr', description: 'Nejvíce odpovědí "možná"', iconName: 'HelpCircle', userId: maybeMaster.userId, userName: maybeMaster.name, photoUrl: maybeMaster.photoUrl, value: `${maybeMaster.eventsMaybe}× možná` });

  const payers = allStats.filter(s => s.eventsJoined >= 3);
  if (payers.length > 0) {
    const best = payers.reduce((b, s) => s.paymentRate > b.paymentRate ? s : b);
    if (best.paymentRate > 0) badges.push({ type: 'quickPayer', label: 'Spolehlivý Platič', description: 'Nejlepší platební morálka (min. 3 události)', iconName: 'Wallet', userId: best.userId, userName: best.name, photoUrl: best.photoUrl, value: `${Math.round(best.paymentRate * 100)}% zaplaceno` });
  }

  const social = allStats.reduce((b, s) => s.eventsJoined > b.eventsJoined ? s : b);
  if (social.eventsJoined > 0) badges.push({ type: 'socialButterfly', label: 'Společenský Motýl', description: 'Zúčastnil se nejvíce událostí', iconName: 'PartyPopper', userId: social.userId, userName: social.name, photoUrl: social.photoUrl, value: `${social.eventsJoined} událostí` });

  const winners = allStats.filter(s => s.gamesPlayed >= 3);
  if (winners.length > 0) {
    const best = winners.reduce((b, s) => s.winRate > b.winRate ? s : b);
    if (best.winRate > 0) badges.push({ type: 'luckyPlayer', label: 'Šťastný Hráč', description: 'Nejvyšší procento výher (min. 3 zápasy)', iconName: 'Star', userId: best.userId, userName: best.name, photoUrl: best.photoUrl, value: `${Math.round(best.winRate * 100)}% výher` });
  }

  // Comeback King
  const comebackCounts = new Map<string, number>();
  for (const event of events) {
    for (const round of getAllRounds(event)) {
      if (round.winningTeam === undefined || !round.score || round.score.length < 2) continue;
      const [s0, s1] = round.score[0];
      if (s0 + s1 === 0) continue;
      const set1Loser = s0 > s1 ? 1 : 0;
      if (set1Loser === round.winningTeam) {
        for (const m of round.teams[round.winningTeam]) {
          comebackCounts.set(m.userId, (comebackCounts.get(m.userId) ?? 0) + 1);
        }
      }
    }
  }
  if (comebackCounts.size > 0) {
    let bestId = '', bestCount = 0;
    for (const [id, count] of comebackCounts) { if (count > bestCount) { bestCount = count; bestId = id; } }
    const s = statsMap.get(bestId);
    if (s && bestCount >= 2) badges.push({ type: 'comebackKing', label: 'Comeback King', description: 'Nejvíce výher po prohraném prvním setu', iconName: 'TrendingUp', userId: s.userId, userName: s.name, photoUrl: s.photoUrl, value: `${bestCount}× comeback` });
  }

  // Clutch Player
  const clutchRates: { userId: string; rate: number }[] = [];
  for (const stats of allStats) {
    if (stats.gamesPlayed < 3) continue;
    const c = computeClutchFactor(events, stats.userId);
    if (c.clutchWinRate !== null) clutchRates.push({ userId: stats.userId, rate: c.clutchWinRate });
  }
  if (clutchRates.length > 0) {
    const best = clutchRates.reduce((a, b) => a.rate > b.rate ? a : b);
    const s = statsMap.get(best.userId);
    if (s) badges.push({ type: 'clutchPlayer', label: 'Clutch Hráč', description: 'Nejvyšší výhry v těsných setech (≤3 body)', iconName: 'Zap', userId: s.userId, userName: s.name, photoUrl: s.photoUrl, value: `${Math.round(best.rate * 100)}% v clutchi` });
  }

  // Weekday Warrior
  const weekdayCounts = new Map<string, Set<number>>();
  for (const event of events) {
    for (const p of event.participants) {
      if (p.status !== 'joined') continue;
      if (!weekdayCounts.has(p.userId)) weekdayCounts.set(p.userId, new Set());
      weekdayCounts.get(p.userId)!.add((new Date(event.date + 'T00:00:00').getDay() + 6) % 7);
    }
  }
  let bestWarriorId = '', bestDays = 0;
  for (const [id, days] of weekdayCounts) { if (days.size > bestDays) { bestDays = days.size; bestWarriorId = id; } }
  if (bestWarriorId && bestDays >= 3) {
    const s = statsMap.get(bestWarriorId);
    if (s) badges.push({ type: 'weekdayWarrior', label: 'Všední Válečník', description: 'Hraje v nejvíce různých dnech', iconName: 'Calendar', userId: s.userId, userName: s.name, photoUrl: s.photoUrl, value: `${bestDays} různých dnů` });
  }

  return badges;
}

