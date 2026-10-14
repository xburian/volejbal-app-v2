import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBatchCompaction } from './compact-past-events.js';

class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();

  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: any) {
    this.data.set(key, value);
    return 'OK';
  }
  async del(...keys: string[]) {
    let count = 0;
    for (const k of keys) {
      if (this.data.delete(k)) count++;
      if (this.sets.delete(k)) count++;
      this.ttls.delete(k);
    }
    return count;
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
  async srem(key: string, ...members: string[]) {
    const s = this.sets.get(key);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) {
      if (s.delete(m)) removed++;
    }
    return removed;
  }
  async smembers(key: string) {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }
  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: (key: string) => { operations.push(() => this.get(key)); return pipe; },
      set: (key: string, val: any) => { operations.push(() => this.set(key, val)); return pipe; },
      del: (key: string) => { operations.push(() => this.del(key)); return pipe; },
      sadd: (key: string, ...members: string[]) => { operations.push(() => this.sadd(key, ...members)); return pipe; },
      srem: (key: string, ...members: string[]) => { operations.push(() => this.srem(key, ...members)); return pipe; },
      smembers: (key: string) => { operations.push(() => this.smembers(key)); return pipe; },
      exec: async () => {
        const results = [];
        for (const op of operations) results.push(await op());
        return results;
      }
    };
    return pipe;
  }
}

describe('runBatchCompaction script', () => {
  let mockRedis: MockRedis;
  const teamId = 'team-compact-batch';

  beforeEach(async () => {
    mockRedis = new MockRedis();

    // Setup team and users
    await mockRedis.sadd('teams:all', teamId);
    await mockRedis.set('user:u1', JSON.stringify({ id: 'u1', name: 'Adam' }));
    await mockRedis.set('user:u2', JSON.stringify({ id: 'u2', name: 'Bára' }));
    await mockRedis.sadd(`team:${teamId}:users`, 'u1', 'u2');

    // 1. Very old event (100 days ago) with live attendance keys
    const oldEvent = {
      id: 'e-old-1',
      title: 'Zápas 2025',
      date: '2025-01-01',
      sportType: 'volejbal',
      teamId,
      totalCost: 200,
    };
    await mockRedis.set('event:e-old-1', JSON.stringify(oldEvent));
    await mockRedis.sadd(`team:${teamId}:events`, 'e-old-1');
    await mockRedis.set('attendance:e-old-1_u1', JSON.stringify({ eventId: 'e-old-1', userId: 'u1', status: 'joined', hasPaid: true }));
    await mockRedis.set('attendance:e-old-1_u2', JSON.stringify({ eventId: 'e-old-1', userId: 'u2', status: 'joined', hasPaid: false }));
    await mockRedis.sadd('attendance:event:e-old-1', 'e-old-1_u1', 'e-old-1_u2');

    // 2. Future event (tomorrow)
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    const futureEvent = {
      id: 'e-future-1',
      title: 'Příští týden',
      date: futureDate,
      sportType: 'volejbal',
      teamId,
      totalCost: 300,
    };
    await mockRedis.set('event:e-future-1', JSON.stringify(futureEvent));
    await mockRedis.sadd(`team:${teamId}:events`, 'e-future-1');
    await mockRedis.set('attendance:e-future-1_u1', JSON.stringify({ eventId: 'e-future-1', userId: 'u1', status: 'joined', hasPaid: false }));
    await mockRedis.sadd('attendance:event:e-future-1', 'e-future-1_u1');
  });

  it('runs in dry-run mode without modifying Redis', async () => {
    const result = await runBatchCompaction({
      dryRun: true,
      olderThanDays: 30,
      redisClient: mockRedis,
    });

    expect(result.dryRun).toBe(true);
    expect(result.totalTeamsChecked).toBe(1);
    expect(result.totalEventsChecked).toBe(2);
    expect(result.eventsCompacted).toBe(1); // Only old event
    expect(result.attendanceKeysPruned).toBe(3); // 2 attendance records + 1 set key

    // Redis must still have attendance keys intact
    const attSet = await mockRedis.smembers('attendance:event:e-old-1');
    expect(attSet).toHaveLength(2);
    const eventRaw = await mockRedis.get('event:e-old-1');
    const event = JSON.parse(eventRaw!);
    expect(event.isCompacted).toBeUndefined();
  });

  it('runs live execute, compacts event, prunes keys, and computes stats snapshot', async () => {
    const result = await runBatchCompaction({
      dryRun: false,
      olderThanDays: 30,
      redisClient: mockRedis,
    });

    expect(result.dryRun).toBe(false);
    expect(result.eventsCompacted).toBe(1);
    expect(result.attendanceKeysPruned).toBe(3);
    expect(result.statsSnapshotsUpdated).toBe(1);

    // Verify event is now compacted with embedded participants
    const compactedRaw = await mockRedis.get('event:e-old-1');
    const compactedEvent = JSON.parse(compactedRaw!);
    expect(compactedEvent.isCompacted).toBe(true);
    expect(compactedEvent.participants).toHaveLength(2);
    expect(compactedEvent.participants[0].name).toBe('Adam');

    // Verify separate attendance keys are deleted
    const attSet = await mockRedis.smembers('attendance:event:e-old-1');
    expect(attSet).toHaveLength(0);
    expect(await mockRedis.get('attendance:e-old-1_u1')).toBeNull();

    // Verify future event is completely untouched
    const futureRaw = await mockRedis.get('event:e-future-1');
    const futureEvent = JSON.parse(futureRaw!);
    expect(futureEvent.isCompacted).toBeUndefined();
    expect(await mockRedis.get('attendance:e-future-1_u1')).not.toBeNull();

    // Verify stats snapshot exists for team
    const teamStats = await mockRedis.get(`team:${teamId}:stats`);
    expect(teamStats).not.toBeNull();
  });

  it('is fully idempotent and can be safely re-run multiple times', async () => {
    // First run
    await runBatchCompaction({ dryRun: false, redisClient: mockRedis });

    // Second run
    const result2 = await runBatchCompaction({ dryRun: false, redisClient: mockRedis });
    expect(result2.eventsCompacted).toBe(0);
    expect(result2.attendanceKeysPruned).toBe(0);

    // Event remains valid
    const eventRaw = await mockRedis.get('event:e-old-1');
    const event = JSON.parse(eventRaw!);
    expect(event.isCompacted).toBe(true);
    expect(event.participants).toHaveLength(2);
  });
});
