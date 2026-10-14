import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseBackup } from './backup-db.js';
import { restoreDatabase } from './restore-db.js';

class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();

  async scan(cursor: string) {
    if (cursor === '0') {
      const allKeys = [...Array.from(this.data.keys()), ...Array.from(this.sets.keys())];
      return ['0', allKeys] as [string, string[]];
    }
    return ['0', []] as [string, string[]];
  }

  async type(key: string) {
    if (this.sets.has(key)) return 'set';
    if (this.data.has(key)) return 'string';
    return 'none';
  }

  async ttl(key: string) {
    return this.ttls.get(key) ?? -1;
  }

  async get(key: string) {
    return this.data.get(key) ?? null;
  }

  async set(key: string, val: any, opts?: { ex?: number }) {
    this.data.set(key, val);
    if (opts?.ex) this.ttls.set(key, opts.ex);
    return 'OK';
  }

  async sadd(key: string, ...members: string[]) {
    let s = this.sets.get(key);
    if (!s) { s = new Set(); this.sets.set(key, s); }
    let added = 0;
    for (const m of members) {
      if (!s.has(m)) { s.add(m); added++; }
    }
    return added;
  }

  async smembers(key: string) {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }

  async del(key: string) {
    this.data.delete(key);
    this.sets.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  async expire(key: string, ttl: number) {
    this.ttls.set(key, ttl);
    return 1;
  }
}

describe('Database Backup & Disaster Recovery', () => {
  let mockRedis: MockRedis;
  const testDir = path.resolve(process.cwd(), 'backups-test-tmp');
  const testBackupFile = path.join(testDir, 'test-backup.json');

  beforeEach(() => {
    mockRedis = new MockRedis();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('backs up strings and sets with TTLs to JSON and verifies checksum', async () => {
    // Populate mock DB
    await mockRedis.set('user:u1', JSON.stringify({ id: 'u1', name: 'Lukas' }));
    await mockRedis.set('refreshtoken:tok1', 'valid', { ex: 3600 });
    await mockRedis.sadd('teams:all', 'team-1', 'team-2');

    const result = await createDatabaseBackup(mockRedis, testBackupFile);
    expect(result.totalKeys).toBe(3);
    expect(fs.existsSync(testBackupFile)).toBe(true);

    const backupData = JSON.parse(fs.readFileSync(testBackupFile, 'utf-8'));
    expect(backupData.totalKeys).toBe(3);
    expect(backupData.checksum).toBeDefined();

    const tokenEntry = backupData.keys.find((k: any) => k.key === 'refreshtoken:tok1');
    expect(tokenEntry).toBeDefined();
    expect(tokenEntry.type).toBe('string');
    expect(tokenEntry.ttl).toBe(3600);

    const teamsEntry = backupData.keys.find((k: any) => k.key === 'teams:all');
    expect(teamsEntry).toBeDefined();
    expect(teamsEntry.type).toBe('set');
    expect(teamsEntry.value).toEqual(expect.arrayContaining(['team-1', 'team-2']));
  });

  it('restores database completely from backup file (Disaster Recovery)', async () => {
    await mockRedis.set('user:u1', JSON.stringify({ id: 'u1', name: 'Original Lukas' }));
    await mockRedis.sadd('teams:all', 'team-1', 'team-2');
    await createDatabaseBackup(mockRedis, testBackupFile);

    // Simulate disaster: DB wiped out or corrupted
    const freshDb = new MockRedis();
    await freshDb.set('user:u1', 'CORRUPTED');

    const restoreResult = await restoreDatabase(freshDb, { filePath: testBackupFile });
    expect(restoreResult.restoredCount).toBe(2);
    expect(restoreResult.errorsCount).toBe(0);

    // Verify restored state
    const userVal = await freshDb.get('user:u1');
    expect(JSON.parse(userVal)).toEqual({ id: 'u1', name: 'Original Lukas' });

    const teams = await freshDb.smembers('teams:all');
    expect(teams).toEqual(expect.arrayContaining(['team-1', 'team-2']));
  });

  it('supports dry-run restore without modifying database', async () => {
    await mockRedis.set('user:u1', 'original');
    await createDatabaseBackup(mockRedis, testBackupFile);

    const freshDb = new MockRedis();
    const restoreResult = await restoreDatabase(freshDb, { filePath: testBackupFile, dryRun: true });
    expect(restoreResult.restoredCount).toBe(1);

    // freshDb should remain empty because of dry-run
    const val = await freshDb.get('user:u1');
    expect(val).toBeNull();
  });
});
