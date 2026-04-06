import { useMemo } from 'react';
import { SportEvent, User, UserStats, MonthlyTrend, Badge, DuoStats, GameRound } from '../types';
import { format, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';

interface StatisticsResult {
  leaderboard: UserStats[];
  paymentRanking: UserStats[];
  personalStats: UserStats | null;
  monthlyTrends: MonthlyTrend[];
  badges: Badge[];
  duoStats: DuoStats[];
  isReady: boolean;
}

function computeUserStats(events: SportEvent[]): Map<string, UserStats> {
  const statsMap = new Map<string, UserStats>();

  // Sort events by date for streak calculation
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // First pass: gather all users from participation records
  for (const event of sortedEvents) {
    for (const p of event.participants) {
      if (!statsMap.has(p.userId)) {
        statsMap.set(p.userId, {
          userId: p.userId,
          name: p.name,
          photoUrl: p.photoUrl,
          totalEvents: 0,
          eventsJoined: 0,
          eventsDeclined: 0,
          eventsMaybe: 0,
          attendanceRate: 0,
          paymentRate: 0,
          totalPaid: 0,
          totalOwed: 0,
          longestStreak: 0,
          currentStreak: 0,
          favoriteLocation: '',
          gamesPlayed: 0,
          gamesWon: 0,
          winRate: 0,
          winStreak: 0,
          longestWinStreak: 0,
        });
      }
    }
  }

  // Second pass: compute per-user stats
  // Track streaks and locations per user
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
        if (p.hasPaid) {
          stats.totalPaid += costPerPerson;
        } else {
          stats.totalOwed += costPerPerson;
        }

        // Location tracking
        if (!locations.has(p.userId)) locations.set(p.userId, new Map());
        const locMap = locations.get(p.userId)!;
        locMap.set(event.location, (locMap.get(event.location) || 0) + 1);
      } else if (p.status === 'declined') {
        stats.eventsDeclined++;
      } else if (p.status === 'maybe') {
        stats.eventsMaybe++;
      }

      // Payment rate
      if (p.status === 'joined' && p.hasPaid) {
        // counted in paymentRate below
      }

      // Streak tracking
      if (!streaks.has(p.userId)) {
        streaks.set(p.userId, { current: 0, longest: 0, lastJoined: false });
      }
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

    // Win tracking: count all completed rounds (history + current)
    const allRounds: GameRound[] = [...(event.gameHistory || [])];
    if (event.teams && event.winningTeam !== undefined) {
      allRounds.push({ teams: event.teams, winningTeam: event.winningTeam });
    }
    for (const round of allRounds) {
      if (round.winningTeam === undefined) continue;
      const winningTeam = round.teams[round.winningTeam];
      const losingTeam = round.teams[1 - round.winningTeam];
      const allTeamMembers = [...winningTeam, ...losingTeam];

      for (const member of allTeamMembers) {
        const stats = statsMap.get(member.userId);
        if (!stats) continue;
        stats.gamesPlayed++;
        const isWinner = winningTeam.some(m => m.userId === member.userId);
        if (isWinner) stats.gamesWon++;
      }
    }
  }

  // Win streak tracking (separate pass since we need chronological order)
  const winStreaks = new Map<string, { current: number; longest: number }>();
  for (const event of sortedEvents) {
    const allRounds: GameRound[] = [...(event.gameHistory || [])];
    if (event.teams && event.winningTeam !== undefined) {
      allRounds.push({ teams: event.teams, winningTeam: event.winningTeam });
    }
    for (const round of allRounds) {
      if (round.winningTeam === undefined) continue;
      const winningTeam = round.teams[round.winningTeam];
      const losingTeam = round.teams[1 - round.winningTeam];
      const allTeamMembers = [...winningTeam, ...losingTeam];

      for (const member of allTeamMembers) {
        if (!winStreaks.has(member.userId)) {
          winStreaks.set(member.userId, { current: 0, longest: 0 });
        }
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

  // Finalize rates, streaks, and locations
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
      let maxCount = 0;
      let favLoc = '';
      for (const [loc, count] of locMap) {
        if (count > maxCount) {
          maxCount = count;
          favLoc = loc;
        }
      }
      stats.favoriteLocation = favLoc;
    }

    // Win rate and win streak
    stats.winRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;
    const ws = winStreaks.get(userId);
    if (ws) {
      stats.winStreak = ws.current;
      stats.longestWinStreak = ws.longest;
    }
  }

  return statsMap;
}

function computeMonthlyTrends(events: SportEvent[]): MonthlyTrend[] {
  const monthMap = new Map<string, { events: SportEvent[] }>();

  for (const event of events) {
    const month = event.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) monthMap.set(month, { events: [] });
    monthMap.get(month)!.events.push(event);
  }

  const trends: MonthlyTrend[] = [];
  for (const [month, data] of monthMap) {
    const date = new Date(month + '-01');
    const totalJoined = data.events.reduce(
      (sum, e) => sum + e.participants.filter(p => p.status === 'joined').length,
      0
    );
    trends.push({
      month,
      label: format(date, 'LLL yyyy', { locale: cs }),
      eventCount: data.events.length,
      averageAttendance: data.events.length > 0 ? Math.round(totalJoined / data.events.length * 10) / 10 : 0,
      totalParticipants: totalJoined,
    });
  }

  return trends.sort((a, b) => a.month.localeCompare(b.month));
}

function computeBadges(statsMap: Map<string, UserStats>): Badge[] {
  const allStats = Array.from(statsMap.values());
  if (allStats.length === 0) return [];

  const badges: Badge[] = [];

  // Iron Man: longest streak
  const ironMan = allStats.reduce((best, s) => s.longestStreak > best.longestStreak ? s : best);
  if (ironMan.longestStreak > 0) {
    badges.push({
      type: 'ironman',
      label: 'Iron Man',
      description: 'Nejdelší série účastí v řadě',
      iconName: 'Flame',
      userId: ironMan.userId,
      userName: ironMan.name,
      photoUrl: ironMan.photoUrl,
      value: `${ironMan.longestStreak}× v řadě`,
    });
  }

  // Ghost: most declines
  const ghost = allStats.reduce((best, s) => s.eventsDeclined > best.eventsDeclined ? s : best);
  if (ghost.eventsDeclined > 0) {
    badges.push({
      type: 'ghost',
      label: 'Duch',
      description: 'Nejvíce odmítnutých událostí',
      iconName: 'Ghost',
      userId: ghost.userId,
      userName: ghost.name,
      photoUrl: ghost.photoUrl,
      value: `${ghost.eventsDeclined}× odmítnuto`,
    });
  }

  // Maybe Master: most maybes
  const maybeMaster = allStats.reduce((best, s) => s.eventsMaybe > best.eventsMaybe ? s : best);
  if (maybeMaster.eventsMaybe > 0) {
    badges.push({
      type: 'maybeMaster',
      label: 'Možná Mistr',
      description: 'Nejvíce odpovědí "možná"',
      iconName: 'HelpCircle',
      userId: maybeMaster.userId,
      userName: maybeMaster.name,
      photoUrl: maybeMaster.photoUrl,
      value: `${maybeMaster.eventsMaybe}× možná`,
    });
  }

  // Quick Payer: best payment rate (min 3 events joined)
  const eligiblePayers = allStats.filter(s => s.eventsJoined >= 3);
  if (eligiblePayers.length > 0) {
    const quickPayer = eligiblePayers.reduce((best, s) => s.paymentRate > best.paymentRate ? s : best);
    if (quickPayer.paymentRate > 0) {
      badges.push({
        type: 'quickPayer',
        label: 'Spolehlivý Platič',
        description: 'Nejlepší platební morálka (min. 3 události)',
        iconName: 'Wallet',
        userId: quickPayer.userId,
        userName: quickPayer.name,
        photoUrl: quickPayer.photoUrl,
        value: `${Math.round(quickPayer.paymentRate * 100)}% zaplaceno`,
      });
    }
  }

  // Social Butterfly: most distinct events joined
  const socialButterfly = allStats.reduce((best, s) => s.eventsJoined > best.eventsJoined ? s : best);
  if (socialButterfly.eventsJoined > 0) {
    badges.push({
      type: 'socialButterfly',
      label: 'Společenský Motýl',
      description: 'Zúčastnil se nejvíce událostí',
      iconName: 'PartyPopper',
      userId: socialButterfly.userId,
      userName: socialButterfly.name,
      photoUrl: socialButterfly.photoUrl,
      value: `${socialButterfly.eventsJoined} událostí`,
    });
  }

  // Lucky Player: highest win rate (min 3 games)
  const eligibleWinners = allStats.filter(s => s.gamesPlayed >= 3);
  if (eligibleWinners.length > 0) {
    const luckyPlayer = eligibleWinners.reduce((best, s) => s.winRate > best.winRate ? s : best);
    if (luckyPlayer.winRate > 0) {
      badges.push({
        type: 'luckyPlayer',
        label: 'Šťastný Hráč',
        description: 'Nejvyšší procento výher (min. 3 zápasy)',
        iconName: 'Star',
        userId: luckyPlayer.userId,
        userName: luckyPlayer.name,
        photoUrl: luckyPlayer.photoUrl,
        value: `${Math.round(luckyPlayer.winRate * 100)}% výher`,
      });
    }
  }

  return badges;
}

function computeDuoStats(events: SportEvent[]): DuoStats[] {
  // Track co-wins for every pair of players
  const pairMap = new Map<string, { players: [string, string]; names: [string, string]; photos: [string | undefined, string | undefined]; played: number; won: number }>();

  for (const event of events) {
    // Collect all completed rounds (history + current)
    const allRounds: GameRound[] = [...(event.gameHistory || [])];
    if (event.teams && event.winningTeam !== undefined) {
      allRounds.push({ teams: event.teams, winningTeam: event.winningTeam });
    }

    for (const round of allRounds) {
      if (round.winningTeam === undefined) continue;

      // Both teams played together
      for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
        const team = round.teams[teamIdx];
        const isWinning = teamIdx === round.winningTeam;

        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const ids = [team[i].userId, team[j].userId].sort();
            const key = ids.join('_');
            if (!pairMap.has(key)) {
              const p1 = ids[0] === team[i].userId ? team[i] : team[j];
              const p2 = ids[0] === team[i].userId ? team[j] : team[i];
              pairMap.set(key, {
                players: [p1.userId, p2.userId],
                names: [p1.name, p2.name],
                photos: [p1.photoUrl, p2.photoUrl],
                played: 0,
                won: 0,
              });
            }
            const pair = pairMap.get(key)!;
            pair.played++;
            if (isWinning) pair.won++;
          }
        }
      }
    }
  }

  return Array.from(pairMap.values())
    .filter(p => p.played >= 2)
    .sort((a, b) => b.won - a.won || (b.won / b.played) - (a.won / a.played))
    .slice(0, 3)
    .map(p => ({
      players: [
        { userId: p.players[0], name: p.names[0], photoUrl: p.photos[0] },
        { userId: p.players[1], name: p.names[1], photoUrl: p.photos[1] },
      ],
      gamesPlayed: p.played,
      gamesWon: p.won,
      winRate: p.played > 0 ? p.won / p.played : 0,
    }));
}

export function useStatistics(
  events: SportEvent[],
  currentUser: User | null,
  isLoading?: boolean
): StatisticsResult {
  return useMemo(() => {
    if (isLoading || events.length === 0) {
      return {
        leaderboard: [],
        paymentRanking: [],
        personalStats: null,
        monthlyTrends: [],
        badges: [],
        duoStats: [],
        isReady: !isLoading && events.length > 0,
      };
    }

    // Only include past and today's events in statistics
    const today = startOfDay(new Date());
    const pastEvents = events.filter(e => new Date(e.date) <= today);

    if (pastEvents.length === 0) {
      return {
        leaderboard: [],
        paymentRanking: [],
        personalStats: null,
        monthlyTrends: [],
        badges: [],
        duoStats: [],
        isReady: true,
      };
    }

    const statsMap = computeUserStats(pastEvents);
    const allStats = Array.from(statsMap.values());

    // Leaderboard: sorted by attendance rate, then by total joined
    const leaderboard = [...allStats]
      .sort((a, b) => b.attendanceRate - a.attendanceRate || b.eventsJoined - a.eventsJoined);

    // Payment ranking: sorted by payment rate, then by events joined
    const paymentRanking = [...allStats]
      .filter(s => s.eventsJoined > 0)
      .sort((a, b) => b.paymentRate - a.paymentRate || b.eventsJoined - a.eventsJoined);

    // Personal stats
    const personalStats = currentUser ? statsMap.get(currentUser.id) || null : null;

    // Monthly trends
    const monthlyTrends = computeMonthlyTrends(pastEvents);

    // Badges
    const badges = computeBadges(statsMap);

    // Duo stats
    const duoStats = computeDuoStats(pastEvents);

    return {
      leaderboard,
      paymentRanking,
      personalStats,
      monthlyTrends,
      badges,
      duoStats,
      isReady: true,
    };
  }, [events, currentUser, isLoading]);
}
