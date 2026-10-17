/**
 * Batch Past Events Compactor CLI & Migration Script.
 *
 * Scans events older than 30 days across all teams, embeds attendance directly into
 * event.participants, and prunes separate attendance:* keys.
 * Also recomputes and caches team statistics snapshot.
 *
 * Usage:
 *   npx tsx scripts/compact-past-events.ts                    # Dry-run mode (safe preview)
 *   npx tsx scripts/compact-past-events.ts --execute          # Live execution
 *   npx tsx scripts/compact-past-events.ts --execute --team=xyz # Specific team only
 *   npx tsx scripts/compact-past-events.ts --days=60          # Custom age cutoff
 */

import fs from 'node:fs';
import { subDays, startOfDay } from 'date-fns';
import { Redis } from '@upstash/redis';
import {
  compactSingleEvent,
  computeTeamCompactedStats,
  getTeamUsersMap,
  parseJson,
} from '../api/_utils/compactor.js';

export interface BatchCompactionOptions {
  dryRun?: boolean;
  olderThanDays?: number; // default: 30
  teamId?: string; // default: all teams
  redisClient?: any;
}

export interface CompactionDetail {
  teamId: string;
  eventId: string;
  title: string;
  date: string;
  participantsCount: number;
  keysPruned: number;
}

export interface BatchCompactionResult {
  dryRun: boolean;
  cutoffDate: string;
  totalTeamsChecked: number;
  totalEventsChecked: number;
  eventsCompacted: number;
  attendanceKeysPruned: number;
  statsSnapshotsUpdated: number;
  details: CompactionDetail[];
}

function loadEnvVars(envPath = '.env.local'): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return vars;
}

export async function runBatchCompaction(options: BatchCompactionOptions = {}): Promise<BatchCompactionResult> {
  const dryRun = options.dryRun ?? true;
  const olderThanDays = options.olderThanDays ?? 30;

  let r = options.redisClient;
  if (!r) {
    const env = loadEnvVars();
    const url = env.VOLEJBAL_KV_REST_API_URL || env.volejbal_KV_REST_API_URL || env.KV_REST_API_URL;
    const token = env.VOLEJBAL_KV_REST_API_TOKEN || env.volejbal_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('Chybí Redis přihlašovací údaje (VOLEJBAL_KV_REST_API_URL / TOKEN v .env.local).');
    }
    r = new Redis({ url, token });
  }

  const cutoff = subDays(startOfDay(new Date()), olderThanDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // 1. Determine teams to process
  let teams: string[];
  if (options.teamId) {
    teams = [options.teamId];
  } else {
    teams = (await r.smembers('teams:all')) || [];
  }

  const result: BatchCompactionResult = {
    dryRun,
    cutoffDate: cutoffStr,
    totalTeamsChecked: teams.length,
    totalEventsChecked: 0,
    eventsCompacted: 0,
    attendanceKeysPruned: 0,
    statsSnapshotsUpdated: 0,
    details: [],
  };

  for (const teamId of teams) {
    const eventIds: string[] = (await r.smembers(`team:${teamId}:events`)) || [];
    result.totalEventsChecked += eventIds.length;

    const usersMap = await getTeamUsersMap(teamId, r);

    for (const eid of eventIds) {
      const rawEvent = await r.get(`event:${eid}`);
      if (!rawEvent) continue;
      const event = parseJson(rawEvent);
      const eventDate = new Date(event.date);

      if (eventDate < cutoff) {
        // Fetch live attendance keys for this event
        const attKeySet: string[] = (await r.smembers(`attendance:event:${eid}`)) || [];

        // If not dry-run: execute atomic compaction
        if (!dryRun) {
          if (attKeySet.length > 0 || !event.isCompacted) {
            const compactRes = await compactSingleEvent(eid, teamId, r, usersMap);
            if (compactRes.success) {
              result.eventsCompacted++;
              result.attendanceKeysPruned += compactRes.prunedKeysCount;

              result.details.push({
                teamId,
                eventId: eid,
                title: event.title,
                date: event.date,
                participantsCount: (event.participants || []).length,
                keysPruned: compactRes.prunedKeysCount,
              });
            }
          }
        } else {
          // In dry-run: calculate how many keys would be pruned
          // attKeySet + 1 (the attendance:event:${eid} set key itself)
          const prunedCount = attKeySet.length > 0 ? attKeySet.length + 1 : 0;
          if (prunedCount > 0 || !event.isCompacted) {
            result.eventsCompacted++;
            result.attendanceKeysPruned += prunedCount;
            result.details.push({
              teamId,
              eventId: eid,
              title: event.title,
              date: event.date,
              participantsCount: (event.participants || []).length,
              keysPruned: prunedCount,
            });
          }
        }
      }
    }

    // Recompute stats if not dry-run
    if (!dryRun) {
      try {
        await computeTeamCompactedStats(teamId, r);
        result.statsSnapshotsUpdated++;
      } catch (err: any) {
        console.warn(`Failed to update stats snapshot for team ${teamId}:`, err.message);
      }
    }
  }

  return result;
}

// CLI Execution entrypoint
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('compact-past-events.ts') ||
  process.argv[1].endsWith('compact-past-events.js')
);

if (isDirectCli) {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const dryRun = !execute;

  const teamArg = args.find(a => a.startsWith('--team='));
  const teamId = teamArg ? teamArg.split('=')[1] : undefined;

  const daysArg = args.find(a => a.startsWith('--days='));
  const olderThanDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;

  console.log(`📦 Starting Past Events Compactor (${dryRun ? '🔍 DRY RUN' : '🚀 LIVE EXECUTE'})...`);
  console.log(`   Cutoff: older than ${olderThanDays} days`);
  if (teamId) console.log(`   Target team: ${teamId}`);

  runBatchCompaction({ dryRun, olderThanDays, teamId })
    .then((res) => {
      console.log('\n📊 Compaction Summary:');
      console.log(`   Mode: ${res.dryRun ? 'DRY RUN (no DB mutations)' : 'LIVE EXECUTE (changes applied)'}`);
      console.log(`   Cutoff date: < ${res.cutoffDate}`);
      console.log(`   Teams checked: ${res.totalTeamsChecked}`);
      console.log(`   Events checked: ${res.totalEventsChecked}`);
      console.log(`   Events compacted: ${res.eventsCompacted}`);
      console.log(`   Attendance keys freed: ${res.attendanceKeysPruned}`);
      if (!res.dryRun) {
        console.log(`   Stats snapshots created/updated: ${res.statsSnapshotsUpdated}`);
      }

      if (res.details.length > 0) {
        console.log('\n📅 Compacted Events:');
        for (const d of res.details) {
          console.log(`   - [${d.teamId}] ${d.date} "${d.title}" (${d.keysPruned} keys pruned)`);
        }
      }

      if (res.dryRun && res.eventsCompacted > 0) {
        console.log('\n💡 To execute and apply this compaction, run:');
        console.log(`   npx tsx scripts/compact-past-events.ts --execute${teamId ? ` --team=${teamId}` : ''}`);
      }
    })
    .catch((err) => {
      console.error('❌ Compaction failed:', err);
      process.exit(1);
    });
}
