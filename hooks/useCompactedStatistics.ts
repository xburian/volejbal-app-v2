import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SportEvent,
  User,
  SportConfig,
  SportType,
  TimeFilter,
  CompactedStats,
  SportStatsBundle,
} from '../types';
import * as storage from '../services/storage';
import { useStatistics, StatisticsResult } from '../services/useStatistics';

export interface CompactedStatisticsResult extends StatisticsResult {
  isCompacted: boolean;
  updatedAt: string | null;
  isSnapshotLoading: boolean;
  isRecomputing: boolean;
  recomputeError: string | null;
  recompute: () => Promise<void>;
}

export function useCompactedStatistics(
  events: SportEvent[],
  currentUser: User | null,
  isLoading = false,
  sportConfigs: SportConfig[] = [],
  timeFilter: TimeFilter = 'last3months',
  sportFilter: SportType | null = null
): CompactedStatisticsResult {
  const [snapshot, setSnapshot] = useState<CompactedStats | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  // Filter events by sport locally
  const filteredEvents = useMemo(
    () => (sportFilter ? events.filter(e => (e.sportType ?? 'volejbal') === sportFilter) : events),
    [events, sportFilter]
  );

  // Live client-side calculation (used as fallback or for custom time windows like last3months / year)
  const liveStats = useStatistics(filteredEvents, currentUser, isLoading, sportConfigs, timeFilter);

  // Fetch precomputed snapshot on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadSnapshot() {
      setIsSnapshotLoading(true);
      try {
        const data = await storage.getCompactedStats();
        if (!isCancelled && data) {
          setSnapshot(data);
        }
      } catch (err: any) {
        console.warn('Compacted stats snapshot unavailable, using live computation:', err.message);
      } finally {
        if (!isCancelled) setIsSnapshotLoading(false);
      }
    }

    loadSnapshot();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Manual recomputation trigger
  const recompute = useCallback(async () => {
    setIsRecomputing(true);
    setRecomputeError(null);
    try {
      const result = await storage.recomputeStats();
      if (result.stats) {
        setSnapshot(result.stats);
      }
    } catch (err: any) {
      setRecomputeError(err.message || 'Chyba při přepočtu statistik.');
    } finally {
      setIsRecomputing(false);
    }
  }, []);

  // When timeFilter === 'all' and snapshot is loaded, deliver instant precomputed results!
  const isUsingCompacted = timeFilter === 'all' && snapshot !== null && !isSnapshotLoading;

  return useMemo(() => {
    if (!isUsingCompacted || !snapshot) {
      return {
        ...liveStats,
        isCompacted: false,
        updatedAt: snapshot?.updatedAt ?? null,
        isSnapshotLoading,
        isRecomputing,
        recomputeError,
        recompute,
      };
    }

    // Pick sport-specific bundle or fallback to all
    const bundle: SportStatsBundle =
      sportFilter && snapshot.bySport[sportFilter]
        ? snapshot.bySport[sportFilter]!
        : snapshot.bySport.all;

    const currentUserId = currentUser?.id;
    const personalStats = currentUserId ? bundle.userStats[currentUserId] || null : null;
    const formTrend = currentUserId ? bundle.formTrends[currentUserId] || null : null;
    const nemesis = currentUserId ? bundle.nemesisData[currentUserId] || null : null;
    const clutchData = currentUserId ? bundle.clutchData[currentUserId] || null : null;
    const dayHeatmap = currentUserId ? bundle.dayHeatmaps[currentUserId] || null : null;

    const leaderboard = bundle.leaderboard || [];
    const activeLeaderboard = leaderboard.filter(e => e.activityStatus !== 'inactive');
    const inactiveLeaderboard = leaderboard.filter(e => e.activityStatus === 'inactive');

    return {
      personalStats,
      monthlyTrends: bundle.monthlyTrends || [],
      badges: bundle.badges || [],
      duoStats: bundle.duoStats || [],
      leaderboard,
      activeLeaderboard,
      inactiveLeaderboard,
      formTrend,
      nemesis,
      eventHealth: bundle.eventHealth || null,
      clutchData,
      dayHeatmap,
      isReady: true,
      isCompacted: true,
      updatedAt: snapshot.updatedAt,
      isSnapshotLoading,
      isRecomputing,
      recomputeError,
      recompute,
    };
  }, [
    isUsingCompacted,
    snapshot,
    liveStats,
    currentUser,
    sportFilter,
    isSnapshotLoading,
    isRecomputing,
    recomputeError,
    recompute,
  ]);
}
