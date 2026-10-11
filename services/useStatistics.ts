import { useMemo } from 'react';
import { SportEvent, User, UserStats, MonthlyTrend, Badge, DuoStats, LeaderboardEntry, PlayerFormTrend, NemesisData, EventHealthMetrics, ClutchData, SportConfig, TimeFilter } from '../types';
import { startOfDay } from 'date-fns';
import {
  computeUserStats, computeEloRatings, computeFormTrend, computeDayHeatmap,
  computeNemesis, computeClutchFactor, computeReliabilityScore, computeLeaderboard,
  computeEventHealth, computeMonthlyTrends, computeDuoStats, computeExtendedBadges,
  getChronologicalResults,
  THRESHOLDS,
} from './statsEngine';

export interface StatisticsResult {
  personalStats: UserStats | null;
  monthlyTrends: MonthlyTrend[];
  badges: Badge[];
  duoStats: DuoStats[];
  leaderboard: LeaderboardEntry[];
  activeLeaderboard: LeaderboardEntry[];
  inactiveLeaderboard: LeaderboardEntry[];
  formTrend: PlayerFormTrend | null;
  nemesis: NemesisData | null;
  eventHealth: EventHealthMetrics | null;
  clutchData: ClutchData | null;
  dayHeatmap: number[] | null;
  isReady: boolean;
}

export function useStatistics(
  events: SportEvent[],
  currentUser: User | null,
  isLoading?: boolean,
  sportConfigs?: SportConfig[],
  timeFilter: TimeFilter = 'last3months',
): StatisticsResult {
  return useMemo(() => {
    const empty: StatisticsResult = {
      personalStats: null, monthlyTrends: [], badges: [], duoStats: [],
      leaderboard: [], activeLeaderboard: [], inactiveLeaderboard: [], formTrend: null, nemesis: null,
      eventHealth: null, clutchData: null, dayHeatmap: null,
      isReady: !isLoading && events.length > 0,
    };

    if (isLoading || events.length === 0) return { ...empty, isReady: false };

    const today = startOfDay(new Date());
    const pastEvents = events.filter(e => new Date(e.date) <= today);
    if (pastEvents.length === 0) return { ...empty, isReady: true };

    // Apply time filter
    let effectiveEvents = pastEvents;
    if (timeFilter === 'last3months') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateStr = ninetyDaysAgo.toISOString().split('T')[0];
      const timeFiltered = pastEvents.filter(e => e.date >= dateStr);
      // Fallback to all past events if under threshold in the 90-day window
      if (timeFiltered.length >= 3) {
        effectiveEvents = timeFiltered;
      }
    } else if (timeFilter === 'year') {
      const currentYear = new Date().getFullYear().toString();
      const timeFiltered = pastEvents.filter(e => e.date.startsWith(currentYear));
      if (timeFiltered.length >= 3) {
        effectiveEvents = timeFiltered;
      }
    }

    const statsMap = computeUserStats(effectiveEvents);
    const eloMap = computeEloRatings(effectiveEvents);

    // Enrich stats with v1.6 fields
    for (const [userId, stats] of statsMap) {
      stats.eloRating = Math.round(eloMap.get(userId) ?? 1000);
      stats.reliabilityScore = computeReliabilityScore(stats);
      stats.dayOfWeekDistribution = computeDayHeatmap(effectiveEvents, userId);
    }

    const personalStats = currentUser ? statsMap.get(currentUser.id) || null : null;
    const monthlyTrends = computeMonthlyTrends(effectiveEvents);
    const badges = computeExtendedBadges(statsMap, effectiveEvents);
    const duoStats = computeDuoStats(effectiveEvents);
    const leaderboard = computeLeaderboard(statsMap, eloMap, effectiveEvents);

    // Populate mini-form (recentResults) for each entry
    for (const entry of leaderboard) {
      entry.recentResults = getChronologicalResults(effectiveEvents, entry.userId).slice(-5).reverse();
    }

    const activeLeaderboard = leaderboard.filter(e => e.activityStatus !== 'inactive');
    const inactiveLeaderboard = leaderboard.filter(e => e.activityStatus === 'inactive');

    // Per-user metrics
    let formTrend: PlayerFormTrend | null = null;
    let nemesis: NemesisData | null = null;
    let clutchData: ClutchData | null = null;
    let dayHeatmap: number[] | null = null;

    if (currentUser) {
      formTrend = computeFormTrend(effectiveEvents, currentUser.id);
      nemesis = computeNemesis(effectiveEvents, currentUser.id);
      clutchData = computeClutchFactor(effectiveEvents, currentUser.id);
      const heatmap = computeDayHeatmap(effectiveEvents, currentUser.id);
      const totalJoined = heatmap.reduce((a, b) => a + b, 0);
      dayHeatmap = totalJoined >= THRESHOLDS.DAY_HEATMAP_MIN_EVENTS ? heatmap : null;
    }

    const eventHealth = computeEventHealth(effectiveEvents, sportConfigs ?? []);

    return {
      personalStats, monthlyTrends, badges, duoStats,
      leaderboard, activeLeaderboard, inactiveLeaderboard,
      formTrend, nemesis, eventHealth, clutchData, dayHeatmap,
      isReady: true,
    };
  }, [events, currentUser, isLoading, sportConfigs, timeFilter]);
}
