import { useMemo } from 'react';
import { SportEvent, User, UserStats, MonthlyTrend, Badge, DuoStats, LeaderboardEntry, PlayerFormTrend, NemesisData, EventHealthMetrics, ClutchData, SportConfig } from '../types';
import { startOfDay } from 'date-fns';
import {
  computeUserStats, computeEloRatings, computeFormTrend, computeDayHeatmap,
  computeNemesis, computeClutchFactor, computeReliabilityScore, computeLeaderboard,
  computeEventHealth, computeMonthlyTrends, computeDuoStats, computeExtendedBadges,
  THRESHOLDS,
} from './statsEngine';

export interface StatisticsResult {
  personalStats: UserStats | null;
  monthlyTrends: MonthlyTrend[];
  badges: Badge[];
  duoStats: DuoStats[];
  leaderboard: LeaderboardEntry[];
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
): StatisticsResult {
  return useMemo(() => {
    const empty: StatisticsResult = {
      personalStats: null, monthlyTrends: [], badges: [], duoStats: [],
      leaderboard: [], formTrend: null, nemesis: null,
      eventHealth: null, clutchData: null, dayHeatmap: null,
      isReady: !isLoading && events.length > 0,
    };

    if (isLoading || events.length === 0) return { ...empty, isReady: false };

    const today = startOfDay(new Date());
    const pastEvents = events.filter(e => new Date(e.date) <= today);
    if (pastEvents.length === 0) return { ...empty, isReady: true };

    const statsMap = computeUserStats(pastEvents);
    const eloMap = computeEloRatings(pastEvents);

    // Enrich stats with v1.6 fields
    for (const [userId, stats] of statsMap) {
      stats.eloRating = Math.round(eloMap.get(userId) ?? 1000);
      stats.reliabilityScore = computeReliabilityScore(stats);
      stats.dayOfWeekDistribution = computeDayHeatmap(pastEvents, userId);
      const form = computeFormTrend(pastEvents, userId);
      stats.recentFormRate = form.last5WinRate ?? form.allTimeWinRate;
    }

    const personalStats = currentUser ? statsMap.get(currentUser.id) || null : null;
    const monthlyTrends = computeMonthlyTrends(pastEvents);
    const badges = computeExtendedBadges(statsMap, pastEvents);
    const duoStats = computeDuoStats(pastEvents);
    const leaderboard = computeLeaderboard(statsMap, eloMap);

    // Per-user metrics
    let formTrend: PlayerFormTrend | null = null;
    let nemesis: NemesisData | null = null;
    let clutchData: ClutchData | null = null;
    let dayHeatmap: number[] | null = null;

    if (currentUser) {
      formTrend = computeFormTrend(pastEvents, currentUser.id);
      nemesis = computeNemesis(pastEvents, currentUser.id);
      clutchData = computeClutchFactor(pastEvents, currentUser.id);
      const heatmap = computeDayHeatmap(pastEvents, currentUser.id);
      const totalJoined = heatmap.reduce((a, b) => a + b, 0);
      dayHeatmap = totalJoined >= THRESHOLDS.DAY_HEATMAP_MIN_EVENTS ? heatmap : null;
    }

    const eventHealth = computeEventHealth(pastEvents, sportConfigs ?? []);

    return {
      personalStats, monthlyTrends, badges, duoStats,
      leaderboard, formTrend, nemesis, eventHealth, clutchData, dayHeatmap,
      isReady: true,
    };
  }, [events, currentUser, isLoading, sportConfigs]);
}
