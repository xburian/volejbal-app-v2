import crypto from 'node:crypto';
import { startOfDay, subDays } from 'date-fns';
import { redis as defaultRedis } from './redis.js';
import {
  SportEvent,
  User,
  SportType,
  CompactedStats,
  SportStatsBundle,
  PlayerFormTrend,
  NemesisData,
  ClutchData,
  UserStats,
} from '../../types.js';
import {
  computeUserStats,
  computeEloRatings,
  computeMonthlyTrends,
  computeExtendedBadges,
  computeDuoStats,
  computeLeaderboard,
  computeEventHealth,
  computeFormTrend,
  computeNemesis,
  computeClutchFactor,
  computeDayHeatmap,
  computeReliabilityScore,
  THRESHOLDS,
} from '../../services/statsEngine.js';

export function parseJson(val: any): any {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

/**
 * Distributed mutex lock wrapper for team compaction operations.
 */
export async function withTeamLock<T>(
  teamId: string,
  fn: () => Promise<T>,
  redisClient = defaultRedis,
  ttlSeconds = 60
): Promise<T> {
  const lockKey = `lock:team:${teamId}:compaction`;
  const lockToken = crypto.randomUUID();

  // Try to acquire lock
  const acquired = await redisClient.set(lockKey, lockToken, { nx: true, ex: ttlSeconds });
  if (!acquired) {
    throw new Error('Kompaktace nebo přepočet pro tento tým již právě probíhá.');
  }

  try {
    return await fn();
  } finally {
    // Release lock only if token matches
    try {
      const currentToken = await redisClient.get(lockKey);
      if (currentToken === lockToken) {
        await redisClient.del(lockKey);
      }
    } catch (err) {
      console.warn(`Failed to release lock "${lockKey}":`, err);
    }
  }
}

/**
 * Fetches all users belonging to a team and maps them by id.
 */
export async function getTeamUsersMap(teamId: string, redisClient = defaultRedis): Promise<Record<string, User>> {
  const userIds: string[] = (await redisClient.smembers(`team:${teamId}:users`)) || [];
  const map: Record<string, User> = {};
  if (userIds.length === 0) return map;

  const pipe = redisClient.pipeline();
  for (const uid of userIds) {
    pipe.get(`user:${uid}`);
  }
  const users = (await pipe.exec()).filter(Boolean).map(parseJson);
  for (const u of users) {
    if (u?.id) map[u.id] = u;
  }
  return map;
}

/**
 * Compacts a single past event:
 * - Embeds current participants into event object
 * - Sets isCompacted: true and compactedAt
 * - Prunes separate attendance:* records and sets
 */
export async function compactSingleEvent(
  eventId: string,
  teamId: string,
  redisClient = defaultRedis,
  preloadedUsersMap?: Record<string, User>
): Promise<{ success: boolean; prunedKeysCount: number }> {
  const rawEvent = await redisClient.get(`event:${eventId}`);
  if (!rawEvent) return { success: false, prunedKeysCount: 0 };
  const event: SportEvent = parseJson(rawEvent);

  // Idempotence check: if already compacted and no dangling keys, skip
  const attendanceKeys: string[] = (await redisClient.smembers(`attendance:event:${eventId}`)) || [];
  if (event.isCompacted && attendanceKeys.length === 0) {
    return { success: true, prunedKeysCount: 0 };
  }

  const usersMap = preloadedUsersMap || (await getTeamUsersMap(teamId, redisClient));

  // Determine participants: start with existing embedded or build from live keys
  let participants = Array.isArray(event.participants) ? event.participants : [];

  if (attendanceKeys.length > 0) {
    const pipe = redisClient.pipeline();
    for (const k of attendanceKeys) {
      pipe.get(`attendance:${k}`);
    }
    const liveRecords = (await pipe.exec()).filter(Boolean).map(parseJson);

    // Merge: live records take precedence
    const liveMap = new Map<string, any>();
    for (const record of liveRecords) {
      const user = usersMap[record.userId];
      liveMap.set(record.userId, {
        userId: record.userId,
        name: user ? user.name : 'Neznámý',
        photoUrl: user?.photoUrl,
        status: record.status,
        hasPaid: Boolean(record.hasPaid),
      });
    }

    const mergedMap = new Map<string, any>();
    for (const p of participants) {
      const user = usersMap[p.userId];
      mergedMap.set(p.userId, {
        ...p,
        name: user ? user.name : p.name,
        photoUrl: user ? user.photoUrl : p.photoUrl,
      });
    }
    for (const [uid, p] of liveMap.entries()) {
      mergedMap.set(uid, p);
    }
    participants = Array.from(mergedMap.values());
  } else {
    // Refresh names and photos from usersMap
    participants = participants.map(p => {
      const user = usersMap[p.userId];
      return {
        ...p,
        name: user ? user.name : p.name,
        photoUrl: user ? user.photoUrl : p.photoUrl,
      };
    });
  }

  const updatedEvent: SportEvent = {
    ...event,
    participants,
    isCompacted: true,
    compactedAt: new Date().toISOString(),
  };

  const pipe = redisClient.pipeline();
  pipe.set(`event:${eventId}`, JSON.stringify(updatedEvent));

  let prunedCount = 0;
  if (attendanceKeys.length > 0) {
    for (const key of attendanceKeys) {
      const userId = key.replace(`${eventId}_`, '');
      pipe.del(`attendance:${key}`);
      pipe.srem(`attendance:user:${userId}`, key);
      prunedCount++;
    }
    pipe.del(`attendance:event:${eventId}`);
    prunedCount++;
  }

  await pipe.exec();
  return { success: true, prunedKeysCount: prunedCount };
}

/**
 * Compacts all events for a team older than specified days (default: 30 days).
 */
export async function compactTeamEvents(
  teamId: string,
  olderThanDays = 30,
  redisClient = defaultRedis
): Promise<{ compactedEventsCount: number; prunedKeysCount: number }> {
  const eventIds: string[] = (await redisClient.smembers(`team:${teamId}:events`)) || [];
  if (eventIds.length === 0) return { compactedEventsCount: 0, prunedKeysCount: 0 };

  const cutoff = subDays(startOfDay(new Date()), olderThanDays);
  const usersMap = await getTeamUsersMap(teamId, redisClient);

  let compactedCount = 0;
  let totalPrunedKeys = 0;

  for (const eid of eventIds) {
    const raw = await redisClient.get(`event:${eid}`);
    if (!raw) continue;
    const event = parseJson(raw);
    const eventDate = new Date(event.date);

    if (eventDate < cutoff) {
      const res = await compactSingleEvent(eid, teamId, redisClient, usersMap);
      if (res.success && res.prunedKeysCount > 0) {
        compactedCount++;
        totalPrunedKeys += res.prunedKeysCount;
      }
    }
  }

  return { compactedEventsCount: compactedCount, prunedKeysCount: totalPrunedKeys };
}

/**
 * Helper to build a complete stats bundle from a list of past events.
 */
function buildStatsBundle(pastEvents: SportEvent[], teamUsers: User[]): SportStatsBundle {
  const statsMap = computeUserStats(pastEvents);
  const eloMap = computeEloRatings(pastEvents);

  // Enrich user stats
  for (const [userId, stats] of statsMap) {
    stats.eloRating = Math.round(eloMap.get(userId) ?? 1000);
    stats.reliabilityScore = computeReliabilityScore(stats);
    stats.dayOfWeekDistribution = computeDayHeatmap(pastEvents, userId);
  }

  const leaderboard = computeLeaderboard(statsMap, eloMap);
  const monthlyTrends = computeMonthlyTrends(pastEvents);
  const badges = computeExtendedBadges(statsMap, pastEvents);
  const duoStats = computeDuoStats(pastEvents);
  const eventHealth = computeEventHealth(pastEvents, []);

  const userStatsObj: Record<string, UserStats> = {};
  const formTrendsObj: Record<string, PlayerFormTrend> = {};
  const dayHeatmapsObj: Record<string, number[]> = {};
  const nemesisDataObj: Record<string, NemesisData> = {};
  const clutchDataObj: Record<string, ClutchData> = {};

  // Compute metrics for all known users
  for (const user of teamUsers) {
    const s = statsMap.get(user.id);
    if (s) {
      userStatsObj[user.id] = s;
    }

    formTrendsObj[user.id] = computeFormTrend(pastEvents, user.id);
    nemesisDataObj[user.id] = computeNemesis(pastEvents, user.id);
    clutchDataObj[user.id] = computeClutchFactor(pastEvents, user.id);

    const heatmap = computeDayHeatmap(pastEvents, user.id);
    const totalDays = heatmap.reduce((a, b) => a + b, 0);
    dayHeatmapsObj[user.id] = totalDays >= THRESHOLDS.DAY_HEATMAP_MIN_EVENTS ? heatmap : heatmap;
  }

  return {
    leaderboard,
    userStats: userStatsObj,
    formTrends: formTrendsObj,
    dayHeatmaps: dayHeatmapsObj,
    nemesisData: nemesisDataObj,
    clutchData: clutchDataObj,
    badges,
    duoStats,
    eventHealth,
    monthlyTrends,
    totalEventsCount: pastEvents.length,
  };
}

/**
 * Computes and caches the compacted statistics snapshot for a team.
 * Saves directly into `team:{teamId}:stats`.
 */
export async function computeTeamCompactedStats(
  teamId: string,
  redisClient = defaultRedis
): Promise<CompactedStats> {
  const eventIds: string[] = (await redisClient.smembers(`team:${teamId}:events`)) || [];
  const usersMap = await getTeamUsersMap(teamId, redisClient);
  const teamUsers = Object.values(usersMap);

  // 1. Fetch and hydrate all events
  const rawEvents: SportEvent[] = [];
  for (const eid of eventIds) {
    const raw = await redisClient.get(`event:${eid}`);
    if (raw) rawEvents.push(parseJson(raw));
  }

  // Hydrate events if not compacted
  const hydratedEvents: SportEvent[] = await Promise.all(
    rawEvents.map(async event => {
      const attendanceKeys: string[] = (await redisClient.smembers(`attendance:event:${event.id}`)) || [];
      const embeddedParticipants = Array.isArray(event.participants) ? event.participants : [];

      if (attendanceKeys.length > 0) {
        const pipe = redisClient.pipeline();
        for (const k of attendanceKeys) pipe.get(`attendance:${k}`);
        const liveRecords = (await pipe.exec()).filter(Boolean).map(parseJson);

        const liveMap = new Map<string, any>();
        for (const record of liveRecords) {
          const user = usersMap[record.userId];
          liveMap.set(record.userId, {
            userId: record.userId,
            name: user ? user.name : 'Neznámý',
            photoUrl: user?.photoUrl,
            status: record.status,
            hasPaid: Boolean(record.hasPaid),
          });
        }

        const mergedMap = new Map<string, any>();
        for (const p of embeddedParticipants) {
          const user = usersMap[p.userId];
          mergedMap.set(p.userId, { ...p, name: user ? user.name : p.name, photoUrl: user ? user.photoUrl : p.photoUrl });
        }
        for (const [uid, p] of liveMap.entries()) {
          mergedMap.set(uid, p);
        }
        return { ...event, participants: Array.from(mergedMap.values()) };
      }

      // No live keys, use embedded with updated user names/photos
      const participants = embeddedParticipants.map(p => {
        const user = usersMap[p.userId];
        return { ...p, name: user ? user.name : p.name, photoUrl: user ? user.photoUrl : p.photoUrl };
      });
      return { ...event, participants };
    })
  );

  const today = startOfDay(new Date());
  const pastEvents = hydratedEvents
    .filter(e => new Date(e.date) <= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Active sports
  const sportSet = new Set<SportType>();
  for (const e of pastEvents) {
    sportSet.add((e.sportType as SportType) || 'volejbal');
  }
  const activeSports = Array.from(sportSet);
  const primarySport = activeSports.length === 1 ? activeSports[0] : undefined;

  // Build bundle for 'all'
  const allBundle = buildStatsBundle(pastEvents, teamUsers);

  const bySport: CompactedStats['bySport'] = {
    all: allBundle,
  };

  // If team plays multiple sports, build bundles for each
  if (activeSports.length > 1) {
    for (const sport of activeSports) {
      const sportEvents = pastEvents.filter(e => (e.sportType || 'volejbal') === sport);
      bySport[sport] = buildStatsBundle(sportEvents, teamUsers);
    }
  }

  const compactedStats: CompactedStats = {
    version: 1,
    updatedAt: new Date().toISOString(),
    pastEventsCount: pastEvents.length,
    lastEventDate: pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].date : '',
    activeSports,
    primarySport,
    bySport,
  };

  await redisClient.set(`team:${teamId}:stats`, JSON.stringify(compactedStats));
  return compactedStats;
}

/**
 * Prunes expired refresh tokens across the database.
 */
export async function pruneExpiredTokens(redisClient = defaultRedis): Promise<number> {
  const tokenKeys: string[] = (await redisClient.keys('refreshtoken:*')) || [];
  let pruned = 0;

  for (const key of tokenKeys) {
    const ttl = await redisClient.ttl(key);
    // If expired or key no longer has valid value
    if (ttl === -2 || ttl === 0) {
      await redisClient.del(key);
      pruned++;
    }
  }
  return pruned;
}

/**
 * Prunes orphaned photo keys that are no longer referenced by any user.
 */
export async function pruneOrphanedPhotos(redisClient = defaultRedis): Promise<number> {
  const photoKeys: string[] = (await redisClient.keys('photo:*')) || [];
  if (photoKeys.length === 0) return 0;

  const userIds: string[] = (await redisClient.smembers('users:all')) || [];
  const pipe = redisClient.pipeline();
  for (const uid of userIds) pipe.get(`user:${uid}`);
  const users = (await pipe.exec()).filter(Boolean).map(parseJson);

  const referencedPhotoIds = new Set<string>();
  for (const u of users) {
    if (u?.photoUrl) {
      const match = u.photoUrl.match(/id=([^&]+)/);
      if (match) referencedPhotoIds.add(match[1]);
    }
  }

  let pruned = 0;
  for (const pk of photoKeys) {
    const pid = pk.replace('photo:', '');
    if (!referencedPhotoIds.has(pid)) {
      await redisClient.del(pk);
      pruned++;
    }
  }
  return pruned;
}
