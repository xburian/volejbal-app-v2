import { describe, it, expect, vi, beforeEach } from 'vitest';

class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();

  async get(key: string) {
    const exp = this.ttls.get(key);
    if (exp && exp <= Date.now()) {
      this.data.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: any, options?: { ex?: number; nx?: boolean }) {
    if (options?.nx) {
      const exp = this.ttls.get(key);
      const isAlive = (this.data.has(key) || this.sets.has(key)) && (!exp || exp > Date.now());
      if (isAlive) return null;
    }
    this.data.set(key, value);
    if (options?.ex) {
      this.ttls.set(key, Date.now() + options.ex * 1000);
    }
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
  async ttl(key: string) {
    const exp = this.ttls.get(key);
    if (!exp) return -1;
    const remaining = Math.round((exp - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
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
  async keys(pattern: string) {
    const all = Array.from(new Set([...this.data.keys(), ...this.sets.keys()]));
    if (pattern === '*' || !pattern) return all;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return all.filter(k => regex.test(k));
  }
  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: (key: string) => { operations.push(() => this.get(key)); return pipe; },
      set: (key: string, val: any, opts?: any) => { operations.push(() => this.set(key, val, opts)); return pipe; },
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

const mockRedisInstance = new MockRedis();

vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      get = mockRedisInstance.get.bind(mockRedisInstance);
      set = mockRedisInstance.set.bind(mockRedisInstance);
      del = mockRedisInstance.del.bind(mockRedisInstance);
      ttl = mockRedisInstance.ttl.bind(mockRedisInstance);
      sadd = mockRedisInstance.sadd.bind(mockRedisInstance);
      srem = mockRedisInstance.srem.bind(mockRedisInstance);
      smembers = mockRedisInstance.smembers.bind(mockRedisInstance);
      keys = mockRedisInstance.keys.bind(mockRedisInstance);
      pipeline = mockRedisInstance.pipeline.bind(mockRedisInstance);
    },
  };
});

function createReqRes(options: {
  authHeader?: string;
}) {
  const req: any = {
    method: 'GET',
    headers: options.authHeader ? { authorization: options.authHeader } : {},
    query: {},
  };

  let statusCode = 200;
  let jsonBody: any = null;

  const res: any = {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((data: any) => {
      jsonBody = data;
      return res;
    }),
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };

  return { req, res };
}

describe('API /api/cron/compact handler', () => {
  let cronHandler: any;
  const testSecret = 'super-secret-cron-token';

  beforeEach(async () => {
    process.env.CRON_SECRET = testSecret;
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();
    mockRedisInstance.ttls.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('../../api/cron/compact.js');
    cronHandler = mod.default;
  });

  it('rejects unauthorized calls when CRON_SECRET is set', async () => {
    const { req, res } = createReqRes({ authHeader: 'Bearer invalid-secret' });
    await cronHandler(req, res);
    expect(res.getStatus()).toBe(401);
  });

  it('executes compaction and stats calculation for all teams when authorized', async () => {
    // Setup 1 team with 1 user and 1 old event
    const teamId = 'team-cron-1';
    await mockRedisInstance.sadd('teams:all', teamId);
    await mockRedisInstance.set('user:u1', JSON.stringify({ id: 'u1', name: 'Cron Alice' }));
    await mockRedisInstance.sadd(`team:${teamId}:users`, 'u1');

    const oldEvent = {
      id: 'e-old',
      title: 'Very Old Event',
      date: '2026-01-01',
      teamId,
    };
    await mockRedisInstance.set('event:e-old', JSON.stringify(oldEvent));
    await mockRedisInstance.sadd(`team:${teamId}:events`, 'e-old');
    await mockRedisInstance.set('attendance:e-old_u1', JSON.stringify({ eventId: 'e-old', userId: 'u1', status: 'joined', hasPaid: true }));
    await mockRedisInstance.sadd('attendance:event:e-old', 'e-old_u1');

    const { req, res } = createReqRes({ authHeader: `Bearer ${testSecret}` });
    await cronHandler(req, res);

    expect(res.getStatus()).toBe(200);
    const body = res.getJson();
    expect(body.success).toBe(true);
    expect(body.teamsProcessed).toBe(1);
    expect(body.totalCompactedEvents).toBe(1);

    // Verify stats were computed and saved to team:team-cron-1:stats
    const savedStats = await mockRedisInstance.get(`team:${teamId}:stats`);
    expect(savedStats).not.toBeNull();
  });
});
