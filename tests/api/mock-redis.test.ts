import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockRedis } from '../../api/_utils/mockRedis.js';
import { seedMockData } from '../../api/_utils/mockDataGenerator.js';
import { unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MockRedis in-memory database', () => {
  let redis: MockRedis;
  const testPersistPath = resolve(process.cwd(), '.test-mock-db.json');

  beforeEach(() => {
    if (existsSync(testPersistPath)) {
      unlinkSync(testPersistPath);
    }
    redis = new MockRedis({ persistPath: testPersistPath });
  });

  afterEach(() => {
    if (existsSync(testPersistPath)) {
      unlinkSync(testPersistPath);
    }
  });

  it('handles get and set operations', async () => {
    expect(await redis.get('nonexistent')).toBeNull();
    const res = await redis.set('key1', 'value1');
    expect(res).toBe('OK');
    expect(await redis.get('key1')).toBe('value1');
  });

  it('handles object values in set and get', async () => {
    const obj = { id: 'team-1', name: 'Sparta', active: true };
    await redis.set('team:team-1', obj);
    const retrieved = await redis.get<typeof obj>('team:team-1');
    expect(retrieved).toEqual(obj);
  });

  it('handles del operation', async () => {
    await redis.set('key1', 'value1');
    expect(await redis.del('key1')).toBe(1);
    expect(await redis.get('key1')).toBeNull();
    expect(await redis.del('key1')).toBe(0);
  });

  it('handles sadd, smembers, srem, scard, sismember', async () => {
    expect(await redis.sadd('set1', 'a', 'b', 'c')).toBe(3);
    // Duplicate additions
    expect(await redis.sadd('set1', 'b', 'd')).toBe(1);

    expect(await redis.scard('set1')).toBe(4);
    expect(await redis.sismember('set1', 'a')).toBe(1);
    expect(await redis.sismember('set1', 'z')).toBe(0);

    const members = await redis.smembers('set1');
    expect(members).toHaveLength(4);
    expect(members).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));

    expect(await redis.srem('set1', 'a', 'x')).toBe(1);
    expect(await redis.sismember('set1', 'a')).toBe(0);
    expect(await redis.scard('set1')).toBe(3);
  });

  it('handles incr operation', async () => {
    expect(await redis.incr('counter')).toBe(1);
    expect(await redis.incr('counter')).toBe(2);
    expect(await redis.incr('counter')).toBe(3);
    expect(await redis.get('counter')).toBe(3);
  });

  it('handles pipeline operations', async () => {
    const pipe = redis.pipeline();
    pipe.set('p1', 'val1');
    pipe.set('p2', { num: 42 });
    pipe.sadd('pset', 'item1', 'item2');
    pipe.get('p1');
    pipe.scard('pset');

    const results = await pipe.exec();
    expect(results).toEqual(['OK', 'OK', 2, 'val1', 2]);

    expect(await redis.get('p1')).toBe('val1');
    expect(await redis.get('p2')).toEqual({ num: 42 });
  });

  it('seeds realistic mock data with seedMockData', async () => {
    const stats = await seedMockData(redis, { force: true });
    expect(stats.teamsCount).toBeGreaterThanOrEqual(3);
    expect(stats.usersCount).toBeGreaterThanOrEqual(16);
    expect(stats.eventsCount).toBeGreaterThanOrEqual(6);

    // Verify teams exist
    const teamIds = await redis.smembers('teams:all');
    expect(teamIds).toContain('team-nahravame-si');
    expect(teamIds).toContain('team-brno');
    expect(teamIds).toContain('team-beach-praha');

    // Verify default team data
    const teamNahravameRaw = await redis.get<any>('team:team-nahravame-si');
    const teamNahravame = typeof teamNahravameRaw === 'string' ? JSON.parse(teamNahravameRaw) : teamNahravameRaw;
    expect(teamNahravame).toBeDefined();
    expect(teamNahravame.name).toBe('nahravame-si');

    // Verify users for nahravame-si
    const userIds = await redis.smembers('team:team-nahravame-si:users');
    expect(userIds.length).toBeGreaterThanOrEqual(10);

    // Verify events for nahravame-si
    const eventIds = await redis.smembers('team:team-nahravame-si:events');
    expect(eventIds.length).toBeGreaterThanOrEqual(5);

    // Verify bank accounts for nahravame-si
    const bankAccountIds = await redis.smembers('team:team-nahravame-si:bank_accounts');
    expect(bankAccountIds.length).toBeGreaterThan(0);
  });
});
