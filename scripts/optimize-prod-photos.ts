/**
 * Production User Photo Optimizer Script.
 *
 * Scans all user photos stored in Redis, checks if they exceed the thumbnail threshold (> 30 KB),
 * and compresses them down to 160x160 JPEG (~10-20 KB) using Jimp.
 *
 * Usage:
 *   npx tsx scripts/optimize-prod-photos.ts           # Dry-run mode (safe preview)
 *   npx tsx scripts/optimize-prod-photos.ts --execute # Writes changes to Redis
 */

import fs from 'node:fs';
import { Jimp } from 'jimp';
import { Redis } from '@upstash/redis';

export interface OptimizePhotosOptions {
  dryRun?: boolean;
  minBytesToOptimize?: number; // default: 30_000 (30 KB)
  redisClient?: any;
  targetUserIds?: string[];
}

export interface OptimizedPhotoDetail {
  userId: string;
  userName: string;
  originalBytes: number;
  compressedBytes: number;
  bytesSaved: number;
  percentSaved: number;
}

export interface OptimizePhotosResult {
  dryRun: boolean;
  totalUsersScanned: number;
  photosFound: number;
  photosOptimized: number;
  originalTotalBytes: number;
  compressedTotalBytes: number;
  bytesSaved: number;
  details: OptimizedPhotoDetail[];
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

export async function optimizePhotos(options: OptimizePhotosOptions = {}): Promise<OptimizePhotosResult> {
  const dryRun = options.dryRun ?? true;
  const minBytes = options.minBytesToOptimize ?? 30_000;

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

  // 1. Discover all user keys
  let userKeys: string[] = [];
  if (options.targetUserIds && options.targetUserIds.length > 0) {
    userKeys = options.targetUserIds.map(id => id.startsWith('user:') ? id : `user:${id}`);
  } else if (typeof r.keys === 'function') {
    userKeys = await r.keys('user:*');
  } else if (typeof r.scan === 'function') {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await r.scan(cursor, { match: 'user:*', count: 100 });
      cursor = nextCursor;
      userKeys.push(...keys);
    } while (cursor !== '0');
  }

  const result: OptimizePhotosResult = {
    dryRun,
    totalUsersScanned: userKeys.length,
    photosFound: 0,
    photosOptimized: 0,
    originalTotalBytes: 0,
    compressedTotalBytes: 0,
    bytesSaved: 0,
    details: [],
  };

  for (const userKey of userKeys) {
    const rawUser = await r.get(userKey);
    if (!rawUser) continue;
    const user = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
    const userId = user.id || userKey.replace('user:', '');

    if (!user.photoUrl) continue;
    result.photosFound++;

    const photoUrl: string = user.photoUrl;
    const cleanBase64 = photoUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const originalBytes = Buffer.byteLength(cleanBase64, 'base64');

    if (originalBytes <= minBytes) {
      // Already small enough, skip
      continue;
    }

    try {
      const inputBuffer = Buffer.from(cleanBase64, 'base64');
      const img = await Jimp.read(inputBuffer);

      // Cover center crop to 160x160 avatar
      img.cover({ w: 160, h: 160 });
      const compressedBuffer = await img.getBuffer('image/jpeg', { quality: 82 });
      const compressedBytes = compressedBuffer.length;

      // Only apply if it actually reduced size
      if (compressedBytes < originalBytes) {
        const bytesSaved = originalBytes - compressedBytes;
        const percentSaved = Math.round((bytesSaved / originalBytes) * 100);

        const newPhotoUrl = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;

        result.photosOptimized++;
        result.originalTotalBytes += originalBytes;
        result.compressedTotalBytes += compressedBytes;
        result.bytesSaved += bytesSaved;

        result.details.push({
          userId,
          userName: user.name || 'Neznámý',
          originalBytes,
          compressedBytes,
          bytesSaved,
          percentSaved,
        });

        if (!dryRun) {
          user.photoUrl = newPhotoUrl;
          await r.set(userKey, JSON.stringify(user));

          // Also keep photo:{userId} synchronized if present
          const photoKey = `photo:${userId}`;
          const existingPhotoKey = await r.get(photoKey);
          if (existingPhotoKey) {
            await r.set(photoKey, newPhotoUrl);
          }
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Failed to optimize photo for user ${userId} (${user.name}):`, err.message);
    }
  }

  return result;
}

// CLI Execution entrypoint
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('optimize-prod-photos.ts') ||
  process.argv[1].endsWith('optimize-prod-photos.js')
);

if (isDirectCli) {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const dryRun = !execute;

  console.log(`🖼️  Starting Photo Optimization (${dryRun ? '🔍 DRY RUN' : '🚀 LIVE EXECUTE'})...`);

  optimizePhotos({ dryRun })
    .then((res) => {
      console.log('\n📊 Optimization Summary:');
      console.log(`   Mode: ${res.dryRun ? 'DRY RUN (no DB mutations)' : 'LIVE EXECUTE (changes applied)'}`);
      console.log(`   Users scanned: ${res.totalUsersScanned}`);
      console.log(`   Photos found: ${res.photosFound}`);
      console.log(`   Photos optimized: ${res.photosOptimized}`);
      console.log(`   Original total: ${(res.originalTotalBytes / 1024).toFixed(1)} KB`);
      console.log(`   Compressed total: ${(res.compressedTotalBytes / 1024).toFixed(1)} KB`);
      console.log(`   Storage saved: ${(res.bytesSaved / 1024).toFixed(1)} KB (${res.originalTotalBytes > 0 ? Math.round((res.bytesSaved / res.originalTotalBytes) * 100) : 0}%)`);

      if (res.details.length > 0) {
        console.log('\n👤 Details:');
        for (const d of res.details) {
          console.log(`   - ${d.userName} (${d.userId}): ${(d.originalBytes / 1024).toFixed(1)} KB ➔ ${(d.compressedBytes / 1024).toFixed(1)} KB (-${d.percentSaved}%)`);
        }
      }

      if (res.dryRun && res.photosOptimized > 0) {
        console.log('\n💡 To execute and apply these optimizations to Redis, run:');
        console.log('   npx tsx scripts/optimize-prod-photos.ts --execute');
      }
    })
    .catch((err) => {
      console.error('❌ Photo optimization failed:', err);
      process.exit(1);
    });
}
