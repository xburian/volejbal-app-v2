import { describe, it, expect, beforeEach } from 'vitest';
import { MockRedis } from './mockRedis.js';
import {
  compactSingleEvent,
  compactTeamEvents,
  computeTeamCompactedStats,
  withTeamLock,
  pruneExpiredTokens,
  pruneOrphanedPhotos,
} from './compactor.js';

describe('Compactor Engine (api/_utils/compactor.ts)', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = new MockRedis();
  });

  describe('withTeamLock', () => {
    it('acquires and releases lock successfully', async () => {
      let executed = false;
      const res = await withTeamLock('team-1', async () => {
        executed = true;
        return 'success';
      }, redis as any);

      expect(res).toBe('success');
      expect(executed).toBe(true);

      // Lock should be released
      const lockVal = await redis.get('lock:team:team-1:compaction');
      expect(lockVal).toBeNull();
    });

    it('rejects concurrent executions on the same team', async () => {
      await redis.set('lock:team:team-1:compaction', 'existing-token');

      await expect(
        withTeamLock('team-1', async () => 'should-fail', redis as any)
      ).rejects.toThrow('Kompaktace nebo přepočet pro tento tým již právě probíhá.');
    });
  });

  describe('compactSingleEvent and compactTeamEvents', () => {
    it('embeds participants and removes attendance keys atomically', async () => {
      const user1 = { id: 'u1', name: 'Alice', photoUrl: '/api/photos?id=u1' };
      const user2 = { id: 'u2', name: 'Bob' };
      await redis.set('user:u1', JSON.stringify(user1));
      await redis.set('user:u2', JSON.stringify(user2));
      await redis.sadd('team:team-1:users', 'u1', 'u2');

      const oldEvent = {
        id: 'e-old',
        title: 'Past Game',
        date: '2026-01-10',
        totalCost: 1000,
        teamId: 'team-1',
      };
      await redis.set('event:e-old', JSON.stringify(oldEvent));
      await redis.sadd('team:team-1:events', 'e-old');

      // Add attendance
      await redis.set('attendance:e-old_u1', JSON.stringify({ eventId: 'e-old', userId: 'u1', status: 'joined', hasPaid: true }));
      await redis.set('attendance:e-old_u2', JSON.stringify({ eventId: 'e-old', userId: 'u2', status: 'joined', hasPaid: false }));
      await redis.sadd('attendance:event:e-old', 'e-old_u1', 'e-old_u2');
      await redis.sadd('attendance:user:u1', 'e-old_u1');
      await redis.sadd('attendance:user:u2', 'e-old_u2');

      const res = await compactSingleEvent('e-old', 'team-1', redis as any);
      expect(res.success).toBe(true);
      expect(res.prunedKeysCount).toBe(3); // 2 records + 1 event set

      // Verify event is now compacted
      const updatedRaw = await redis.get('event:e-old');
      const updated = JSON.parse(updatedRaw);
      expect(updated.isCompacted).toBe(true);
      expect(updated.compactedAt).toBeDefined();
      expect(updated.participants).toHaveLength(2);
      expect(updated.participants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true }),
          expect.objectContaining({ userId: 'u2', name: 'Bob', status: 'joined', hasPaid: false }),
        ])
      );

      // Verify attendance keys were deleted
      expect(await redis.get('attendance:e-old_u1')).toBeNull();
      expect(await redis.get('attendance:e-old_u2')).toBeNull();
      expect(await redis.smembers('attendance:event:e-old')).toEqual([]);
    });

    it('compactTeamEvents only compacts events older than olderThanDays', async () => {
      const user = { id: 'u1', name: 'Alice' };
      await redis.set('user:u1', JSON.stringify(user));
      await redis.sadd('team:team-1:users', 'u1');

      // 45 days old event
      const oldEvent = { id: 'e-45', title: '45d ago', date: '2026-01-01', teamId: 'team-1' };
      await redis.set('event:e-45', JSON.stringify(oldEvent));
      await redis.set('attendance:e-45_u1', JSON.stringify({ eventId: 'e-45', userId: 'u1', status: 'joined', hasPaid: true }));
      await redis.sadd('attendance:event:e-45', 'e-45_u1');

      // 5 days old event (recent)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);
      const recentEvent = { id: 'e-5', title: '5d ago', date: recentDate.toISOString().slice(0, 10), teamId: 'team-1' };
      await redis.set('event:e-5', JSON.stringify(recentEvent));
      await redis.set('attendance:e-5_u1', JSON.stringify({ eventId: 'e-5', userId: 'u1', status: 'joined', hasPaid: false }));
      await redis.sadd('attendance:event:e-5', 'e-5_u1');

      await redis.sadd('team:team-1:events', 'e-45', 'e-5');

      const res = await compactTeamEvents('team-1', 30, redis as any);
      expect(res.compactedEventsCount).toBe(1);

      // Old event must be compacted
      const e45 = JSON.parse(await redis.get('event:e-45'));
      expect(e45.isCompacted).toBe(true);

      // Recent event must remain uncompacted
      const e5 = JSON.parse(await redis.get('event:e-5'));
      expect(e5.isCompacted).toBeUndefined();
      expect(await redis.get('attendance:e-5_u1')).not.toBeNull();
    });
  });

  describe('computeTeamCompactedStats', () => {
    it('computes complete compacted stats bundle for a team and caches in Redis', async () => {
      const user1 = { id: 'u1', name: 'Alice' };
      const user2 = { id: 'u2', name: 'Bob' };
      await redis.set('user:u1', JSON.stringify(user1));
      await redis.set('user:u2', JSON.stringify(user2));
      await redis.sadd('team:team-1:users', 'u1', 'u2');

      const event = {
        id: 'e1',
        title: 'Match',
        date: '2026-03-01',
        sportType: 'volejbal',
        teamId: 'team-1',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        ],
        teams: [
          [{ userId: 'u1', name: 'Alice' }],
          [{ userId: 'u2', name: 'Bob' }],
        ],
        winningTeam: 0,
        score: [[25, 20]],
      };
      await redis.set('event:e1', JSON.stringify(event));
      await redis.sadd('team:team-1:events', 'e1');

      const stats = await computeTeamCompactedStats('team-1', redis as any);
      expect(stats.version).toBe(1);
      expect(stats.pastEventsCount).toBe(1);
      expect(stats.primarySport).toBe('volejbal');
      expect(stats.bySport.all).toBeDefined();
      expect(stats.bySport.all.userStats['u1'].gamesWon).toBe(1);
      expect(stats.bySport.all.userStats['u2'].gamesWon).toBe(0);

      // Check that it was saved to team:team-1:stats
      const savedRaw = await redis.get('team:team-1:stats');
      expect(savedRaw).not.toBeNull();
      const saved = JSON.parse(savedRaw);
      expect(saved.pastEventsCount).toBe(1);
    });
  });

  describe('pruneExpiredTokens & pruneOrphanedPhotos', () => {
    it('prunes expired refresh tokens', async () => {
      await redis.set('refreshtoken:valid', 'token1', { ex: 3600 });
      // Simulate expired token
      await redis.set('refreshtoken:expired', 'token2', { ex: -1 });
      const pruned = await pruneExpiredTokens(redis as any);
      expect(pruned).toBe(1);
    });

    it('prunes orphaned photos not referenced by any user', async () => {
      const u1 = { id: 'u1', name: 'Alice', photoUrl: '/api/photos?id=p-active&v=123' };
      await redis.set('user:u1', JSON.stringify(u1));
      await redis.sadd('users:all', 'u1');

      await redis.set('photo:p-active', 'data:image/jpeg;base64,ACTIVE');
      await redis.set('photo:p-orphan', 'data:image/jpeg;base64,ORPHAN');

      const pruned = await pruneOrphanedPhotos(redis as any);
      expect(pruned).toBe(1);
      expect(await redis.get('photo:p-orphan')).toBeNull();
      expect(await redis.get('photo:p-active')).not.toBeNull();
    });
  });
});
