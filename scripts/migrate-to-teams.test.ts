import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMigration } from './migrate-to-teams.js';
import { verifyPassword } from '../api/utils/auth.js';

class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();

  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: any) {
    this.data.set(key, value);
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
  async scard(key: string) {
    return this.sets.get(key)?.size ?? 0;
  }
  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: (key: string) => { operations.push(() => this.get(key)); return pipe; },
      set: (key: string, val: any) => { operations.push(() => this.set(key, val)); return pipe; },
      sadd: (key: string, ...members: string[]) => { operations.push(() => this.sadd(key, ...members)); return pipe; },
      exec: async () => {
        const results = [];
        for (const op of operations) results.push(await op());
        return results;
      }
    };
    return pipe;
  }
}

describe('migrate-to-teams migration script', () => {
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = new MockRedis();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('creates default team nahravame-si when not existing', async () => {
    await runMigration(mockRedis);

    const teamRaw = await mockRedis.get('team:team-nahravame-si');
    expect(teamRaw).not.toBeNull();
    const team = JSON.parse(teamRaw);
    expect(team.name).toBe('nahravame-si');
    expect(verifyPassword('1234', team.passwordHash)).toBe(true);

    const allTeams = await mockRedis.smembers('teams:all');
    expect(allTeams).toContain('team-nahravame-si');
  });

  it('preserves existing team password if team already exists', async () => {
    const preExisting = {
      id: 'team-nahravame-si',
      name: 'nahravame-si',
      passwordHash: 'custom-password-hash',
      createdAt: '2026-01-01',
    };
    await mockRedis.set('team:team-nahravame-si', JSON.stringify(preExisting));

    await runMigration(mockRedis);

    const teamRaw = await mockRedis.get('team:team-nahravame-si');
    const team = JSON.parse(teamRaw);
    expect(team.passwordHash).toBe('custom-password-hash');
  });

  it('migrates legacy users and events to default team', async () => {
    const user1 = { id: 'u1', name: 'Alice' };
    const user2 = { id: 'u2', name: 'Bob', teamId: 'other-team' }; // should not overwrite existing teamId
    await mockRedis.set('user:u1', JSON.stringify(user1));
    await mockRedis.set('user:u2', JSON.stringify(user2));
    await mockRedis.sadd('users:all', 'u1', 'u2');

    const event1 = { id: 'e1', title: 'Game 1', date: '2026-04-01' };
    await mockRedis.set('event:e1', JSON.stringify(event1));
    await mockRedis.sadd('events:all', 'e1');

    const result = await runMigration(mockRedis);
    expect(result.migratedUsers).toBe(2);
    expect(result.migratedEvents).toBe(1);

    // Verify team:team-nahravame-si:users
    const teamUsers = await mockRedis.smembers('team:team-nahravame-si:users');
    expect(teamUsers).toContain('u1');
    expect(teamUsers).toContain('u2');

    // Verify user1 gained teamId
    const u1Updated = JSON.parse(await mockRedis.get('user:u1'));
    expect(u1Updated.teamId).toBe('team-nahravame-si');

    // Verify user2 preserved existing teamId
    const u2Updated = JSON.parse(await mockRedis.get('user:u2'));
    expect(u2Updated.teamId).toBe('other-team');

    // Verify event1 gained teamId
    const e1Updated = JSON.parse(await mockRedis.get('event:e1'));
    expect(e1Updated.teamId).toBe('team-nahravame-si');

    // Verify team:team-nahravame-si:events
    const teamEvents = await mockRedis.smembers('team:team-nahravame-si:events');
    expect(teamEvents).toContain('e1');
  });
});
