/**
 * Migration script: Associate existing users and events with default team 'nahravame-si'
 *
 * Usage:
 *   npx tsx scripts/migrate-to-teams.ts
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { Redis } from '@upstash/redis';
import { hashPassword } from '../api/_utils/auth.js';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

function getRedis(provided?: any) {
  if (provided) return provided;
  const url = process.env.volejbal_KV_REST_API_URL;
  const token = process.env.volejbal_KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error('❌ Missing volejbal_KV_REST_API_URL or volejbal_KV_REST_API_TOKEN in .env.local');
    process.exit(1);
  }

  return new Redis({ url, token });
}

const DEFAULT_TEAM_ID = 'team-nahravame-si';
const DEFAULT_TEAM_NAME = 'nahravame-si';
const DEFAULT_PASSWORD = process.env.DEFAULT_TEAM_PASSWORD || '1234';

export async function runMigration(redisClient?: any) {
  const r = getRedis(redisClient);
  console.log(`🚀 Starting migration to team '${DEFAULT_TEAM_NAME}'...\n`);

  // 1. Create default team if not already existing
  const existingTeam = await r.get(`team:${DEFAULT_TEAM_ID}`);
  if (!existingTeam) {
    console.log(`📦 Creating default team '${DEFAULT_TEAM_NAME}' (password: '${DEFAULT_PASSWORD}')...`);
    const teamRecord = {
      id: DEFAULT_TEAM_ID,
      name: DEFAULT_TEAM_NAME,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      createdAt: new Date().toISOString(),
    };
    await r.set(`team:${DEFAULT_TEAM_ID}`, JSON.stringify(teamRecord));
    await r.sadd('teams:all', DEFAULT_TEAM_ID);
    console.log('   ✅ Team created.');
  } else {
    console.log(`ℹ️  Team '${DEFAULT_TEAM_NAME}' already exists (password preserved).`);
  }

  // 2. Migrate users
  const userIds = await r.smembers('users:all');
  console.log(`\n📦 Migrating ${userIds ? userIds.length : 0} users...`);
  let migratedUsers = 0;

  if (userIds && userIds.length > 0) {
    const pipeline = r.pipeline();
    pipeline.sadd(`team:${DEFAULT_TEAM_ID}:users`, userIds[0], ...userIds.slice(1));

    for (const uid of userIds) {
      pipeline.get(`user:${uid}`);
    }
    const results = await pipeline.exec();

    // Skip the first result (sadd result)
    const updatePipe = r.pipeline();
    let updates = 0;

    for (let i = 1; i < results.length; i++) {
      const raw = results[i];
      if (raw) {
        const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!user.teamId) {
          user.teamId = DEFAULT_TEAM_ID;
          updatePipe.set(`user:${user.id}`, JSON.stringify(user));
          updates++;
        }
      }
    }

    if (updates > 0) {
      await updatePipe.exec();
    }
    migratedUsers = userIds.length;
  }
  console.log(`   ✅ ${migratedUsers} users associated with '${DEFAULT_TEAM_NAME}'.`);

  // 3. Migrate events
  const eventIds = await r.smembers('events:all');
  console.log(`\n📦 Migrating ${eventIds ? eventIds.length : 0} events...`);
  let migratedEvents = 0;

  if (eventIds && eventIds.length > 0) {
    const pipeline = r.pipeline();
    pipeline.sadd(`team:${DEFAULT_TEAM_ID}:events`, eventIds[0], ...eventIds.slice(1));

    for (const eid of eventIds) {
      pipeline.get(`event:${eid}`);
    }
    const results = await pipeline.exec();

    const updatePipe = r.pipeline();
    let updates = 0;

    for (let i = 1; i < results.length; i++) {
      const raw = results[i];
      if (raw) {
        const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!event.teamId) {
          event.teamId = DEFAULT_TEAM_ID;
          updatePipe.set(`event:${event.id}`, JSON.stringify(event));
          updates++;
        }
      }
    }

    if (updates > 0) {
      await updatePipe.exec();
    }
    migratedEvents = eventIds.length;
  }
  console.log(`   ✅ ${migratedEvents} events associated with '${DEFAULT_TEAM_NAME}'.`);

  console.log('\n🎉 Migration completed successfully! No data was lost.');
  return { migratedUsers, migratedEvents };
}

// Only auto-run if executed directly as a script
if (process.argv[1] && process.argv[1].includes('migrate-to-teams')) {
  runMigration().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
