/**
 * Complete Database Backup Script
 *
 * Scans all keys, types, values, and TTLs from Redis and writes them to a JSON file.
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

export interface BackupKeyEntry {
  key: string;
  type: string;
  ttl: number; // -1 = no TTL, -2 = expired, >0 = seconds
  value: any;
}

export interface BackupPayload {
  timestamp: string;
  source: string;
  totalKeys: number;
  keys: BackupKeyEntry[];
  checksum?: string;
}

export function loadEnvVars(envPath = '.env.local'): Record<string, string> {
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

export async function createDatabaseBackup(redisClient?: any, outputPath?: string): Promise<{ filePath: string; totalKeys: number; checksum: string }> {
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

  console.log('🔄 Scanning all keys from Redis database...');

  // 1. Scan all keys
  let cursor = '0';
  const allKeys: string[] = [];
  do {
    const res: [string, string[]] = await r.scan(cursor, { count: 100 });
    cursor = res[0];
    allKeys.push(...res[1]);
  } while (cursor !== '0');

  console.log(`📦 Found ${allKeys.length} total keys. Fetching types, values, and TTLs...`);

  const keyEntries: BackupKeyEntry[] = [];

  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const type = await r.type(key);
    let ttl = -1;
    try {
      ttl = await r.ttl(key);
    } catch {
      // Ignore TTL errors on mock
    }

    let value: any;
    if (type === 'string') {
      value = await r.get(key);
    } else if (type === 'set') {
      value = await r.smembers(key);
    } else if (type === 'hash') {
      value = await r.hgetall(key);
    } else {
      console.warn(`Unknown key type "${type}" for key "${key}". Fetching raw get.`);
      value = await r.get(key);
    }

    keyEntries.push({ key, type, ttl, value });

    if ((i + 1) % 50 === 0 || i === allKeys.length - 1) {
      process.stdout.write(`   Fetched ${i + 1}/${allKeys.length} keys...\r`);
    }
  }
  console.log('\n✅ All keys and values fetched successfully.');

  const backupDir = outputPath ? path.dirname(outputPath) : path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetFile = outputPath || path.join(backupDir, `backup-prod-${timestamp}.json`);

  const payloadWithoutChecksum: Omit<BackupPayload, 'checksum'> = {
    timestamp: new Date().toISOString(),
    source: 'upstash-redis-prod',
    totalKeys: keyEntries.length,
    keys: keyEntries,
  };

  const jsonString = JSON.stringify(payloadWithoutChecksum, null, 2);
  const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');

  const finalPayload: BackupPayload = {
    ...payloadWithoutChecksum,
    checksum,
  };

  fs.writeFileSync(targetFile, JSON.stringify(finalPayload, null, 2), 'utf-8');
  const stats = fs.statSync(targetFile);

  console.log(`\n💾 Backup saved to: ${targetFile}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`   Total keys: ${keyEntries.length}`);
  console.log(`   SHA-256 Checksum: ${checksum}`);

  return { filePath: targetFile, totalKeys: keyEntries.length, checksum };
}

// Only run automatically if executed directly from terminal
if (process.argv[1] && process.argv[1].includes('backup-db')) {
  createDatabaseBackup().catch(err => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  });
}
