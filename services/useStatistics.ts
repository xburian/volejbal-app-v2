import { useMemo } from 'react';
import { VolleyballEvent, User, UserStats, MonthlyTrend, Badge } from '../types';
import { format, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';

interface StatisticsResult {
  leaderboard: UserStats[];
  paymentRanking: UserStats[];
  personalStats: UserStats | null;
  monthlyTrends: MonthlyTrend[];
  badges: Badge[];
  isReady: boolean;
}

function computeUserStats(events: VolleyballEvent[]): Map<string, UserStats> {
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

    // Track which users have a record in this event
    new Set(event.participants.map(p => p.userId));
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
  }

  return statsMap;
}

function computeMonthlyTrends(events: VolleyballEvent[]): MonthlyTrend[] {
  const monthMap = new Map<string, { events: VolleyballEvent[] }>();

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

  return badges;
}

export function useStatistics(
  events: VolleyballEvent[],
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

    return {
      leaderboard,
      paymentRanking,
      personalStats,
      monthlyTrends,
      badges,
      isReady: true,
    };
  }, [events, currentUser, isLoading]);
}
