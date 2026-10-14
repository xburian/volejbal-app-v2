/**
 * Database Restore & Disaster Recovery Script
 *
 * Reads a JSON backup created by backup-db.ts, validates its SHA-256 checksum,
 * and restores all keys, types, and TTLs back into Redis.
 *
 * Usage:
 *   npx tsx scripts/restore-db.ts [--file backups/backup-prod-xxx.json] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';
import { BackupPayload, loadEnvVars } from './backup-db.js';

export interface RestoreOptions {
  filePath?: string;
  dryRun?: boolean;
  filterPrefix?: string;
}

export async function restoreDatabase(redisClient?: any, options: RestoreOptions = {}): Promise<{ restoredCount: number; errorsCount: number }> {
  let r = redisClient;
  if (!r) {
    const env = loadEnvVars();
    const url = env.VOLEJBAL_KV_REST_API_URL || env.volejbal_KV_REST_API_URL || env.KV_REST_API_URL;
    const token = env.VOLEJBAL_KV_REST_API_TOKEN || env.volejbal_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('Missing Redis credentials in .env.local');
    }
    r = new Redis({ url, token });
  }

  // 1. Locate backup file
  let backupFile = options.filePath;
  if (!backupFile) {
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory "${backupDir}" does not exist.`);
    }
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
    if (files.length === 0) {
      throw new Error(`No backup JSON files found in "${backupDir}".`);
    }
    backupFile = path.join(backupDir, files[0]);
  }

  console.log(`📖 Loading backup from: ${backupFile}`);
  const rawContent = fs.readFileSync(backupFile, 'utf-8');
  const backup: BackupPayload = JSON.parse(rawContent);

  // 2. Validate Checksum
  if (backup.checksum) {
    const { checksum, ...rest } = backup;
    const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(rest, null, 2)).digest('hex');
    if (computedChecksum !== checksum) {
      console.warn(`⚠️ Warning: Checksum mismatch! (Backup: ${checksum}, Computed: ${computedChecksum})`);
    } else {
      console.log('🔒 Backup SHA-256 integrity verified successfully.');
    }
  }

  console.log(`📦 Backup contains ${backup.keys.length} keys from ${backup.timestamp}`);
  if (options.dryRun) {
    console.log('🧪 DRY-RUN MODE: No changes will be written to the database.');
  }

  let restoredCount = 0;
  let errorsCount = 0;

  for (const entry of backup.keys) {
    if (options.filterPrefix && !entry.key.startsWith(options.filterPrefix)) {
      continue;
    }

    try {
      if (!options.dryRun) {
        if (entry.type === 'string') {
          const val = typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value);
          if (entry.ttl > 0) {
            await r.set(entry.key, val, { ex: entry.ttl });
          } else {
            await r.set(entry.key, val);
          }
        } else if (entry.type === 'set') {
          // Delete existing set first to avoid leftover entries
          await r.del(entry.key);
          const members = Array.isArray(entry.value) ? entry.value : [];
          if (members.length > 0) {
            await r.sadd(entry.key, members[0], ...members.slice(1));
          }
          if (entry.ttl > 0) {
            await r.expire(entry.key, entry.ttl);
          }
        } else if (entry.type === 'hash') {
          await r.del(entry.key);
          if (entry.value && Object.keys(entry.value).length > 0) {
            await r.hset(entry.key, entry.value);
          }
          if (entry.ttl > 0) {
            await r.expire(entry.key, entry.ttl);
          }
        }
      }
      restoredCount++;
    } catch (err: any) {
      console.error(`❌ Failed to restore key "${entry.key}":`, err.message);
      errorsCount++;
    }
  }

  console.log(`\n🎉 Restore ${options.dryRun ? 'dry-run ' : ''}completed! Restored: ${restoredCount}, Errors: ${errorsCount}`);
  return { restoredCount, errorsCount };
}

// Only auto-run if executed directly as script
if (process.argv[1] && process.argv[1].includes('restore-db')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileIdx = args.indexOf('--file');
  const filePath = fileIdx !== -1 && args[fileIdx + 1] ? args[fileIdx + 1] : undefined;

  restoreDatabase(undefined, { dryRun, filePath }).catch(err => {
    console.error('❌ Restore failed:', err);
    process.exit(1);
  });
}
