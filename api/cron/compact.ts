import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from '../_utils/redis.js';
import {
  compactTeamEvents,
  computeTeamCompactedStats,
  pruneExpiredTokens,
  pruneOrphanedPhotos,
} from '../_utils/compactor.js';

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

const TIMEOUT_BUDGET_MS = 8000; // 8 seconds budget (safe margin for Vercel Hobby 10s timeout)

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const startTime = Date.now();

  try {
    // 1. Verify authorization (CRON_SECRET)
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production' || cronSecret) {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Neautorizováno: Neplatný nebo chybějící CRON_SECRET.' });
      }
    }

    console.log('⏰ Starting scheduled compaction job...');

    // 2. Fetch all registered teams
    const teams: string[] = (await redis.smembers('teams:all')) || [];
    console.log(`📋 Found ${teams.length} teams to process.`);

    let teamsProcessed = 0;
    let totalCompactedEvents = 0;
    let totalPrunedAttendanceKeys = 0;
    let budgetExceeded = false;

    for (const teamId of teams) {
      if (Date.now() - startTime > TIMEOUT_BUDGET_MS) {
        console.warn(`⏳ Approaching execution timeout budget (${TIMEOUT_BUDGET_MS}ms). Ending batch early.`);
        budgetExceeded = true;
        break;
      }

      try {
        // A. Compact events older than 30 days
        const compactResult = await compactTeamEvents(teamId, 30);
        totalCompactedEvents += compactResult.compactedEventsCount;
        totalPrunedAttendanceKeys += compactResult.prunedKeysCount;

        // B. Recompute and cache statistics snapshot
        await computeTeamCompactedStats(teamId);

        teamsProcessed++;
      } catch (err: any) {
        console.error(`❌ Error during compaction for team "${teamId}":`, err.message);
      }
    }

    // 3. Maintenance cleanup (tokens & photos) if time allows
    let prunedTokensCount = 0;
    let prunedPhotosCount = 0;

    if (Date.now() - startTime <= TIMEOUT_BUDGET_MS) {
      try {
        prunedTokensCount = await pruneExpiredTokens();
        prunedPhotosCount = await pruneOrphanedPhotos();
      } catch (err: any) {
        console.warn('Maintenance cleanup warning:', err.message);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`🎉 Compaction completed in ${durationMs}ms. Teams processed: ${teamsProcessed}/${teams.length}`);

    return res.status(200).json({
      success: true,
      durationMs,
      budgetExceeded,
      teamsProcessed,
      totalTeams: teams.length,
      totalCompactedEvents,
      totalPrunedAttendanceKeys,
      prunedTokensCount,
      prunedPhotosCount,
    });
  } catch (error: any) {
    console.error('Cron /api/cron/compact error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
