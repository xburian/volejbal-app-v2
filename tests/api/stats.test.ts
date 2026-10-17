import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccessToken } from '../../api/_utils/auth.js';

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
  async smembers(key: string) {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }
  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: (key: string) => { operations.push(() => this.get(key)); return pipe; },
      set: (key: string, val: any, opts?: any) => { operations.push(() => this.set(key, val, opts)); return pipe; },
      del: (key: string) => { operations.push(() => this.del(key)); return pipe; },
      sadd: (key: string, ...members: string[]) => { operations.push(() => this.sadd(key, ...members)); return pipe; },
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
      smembers = mockRedisInstance.smembers.bind(mockRedisInstance);
      pipeline = mockRedisInstance.pipeline.bind(mockRedisInstance);
    },
  };
});

function createReqRes(options: {
  method?: string;
  body?: any;
  query?: Record<string, string>;
  token?: string;
}) {
  const req: any = {
    method: options.method || 'GET',
    body: options.body || {},
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    query: options.query || {},
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

describe('API /api/stats handler', () => {
  let statsHandler: any;
  const teamId = 'team-stats-test';
  const token = createAccessToken({ teamId, teamName: 'Stats Team' });

  beforeEach(async () => {
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();
    mockRedisInstance.ttls.clear();

    const mod = await import('../../api/stats.js');
    statsHandler = mod.default;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { req, res } = createReqRes({ method: 'GET' });
    await statsHandler(req, res);
    expect(res.getStatus()).toBe(401);
  });

  it('returns cached snapshot if already present in Redis', async () => {
    const existingStats = {
      version: 1,
      updatedAt: '2026-10-10T12:00:00Z',
      pastEventsCount: 5,
      activeSports: ['volejbal'],
      bySport: { all: { leaderboard: [] } },
    };
    await mockRedisInstance.set(`team:${teamId}:stats`, JSON.stringify(existingStats));

    const { req, res } = createReqRes({ method: 'GET', token });
    await statsHandler(req, res);

    expect(res.getStatus()).toBe(200);
    const data = res.getJson();
    expect(data.pastEventsCount).toBe(5);
    expect(data.updatedAt).toBe('2026-10-10T12:00:00Z');
  });

  it('computes and caches stats when snapshot does not exist', async () => {
    // Setup 1 user and 1 event
    await mockRedisInstance.set('user:u1', JSON.stringify({ id: 'u1', name: 'Alice' }));
    await mockRedisInstance.sadd(`team:${teamId}:users`, 'u1');

    const event = {
      id: 'e1',
      title: 'Game 1',
      date: '2026-03-01',
      sportType: 'volejbal',
      teamId,
      participants: [{ userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true }],
      teams: [[{ userId: 'u1', name: 'Alice' }], []],
      winningTeam: 0,
    };
    await mockRedisInstance.set('event:e1', JSON.stringify(event));
    await mockRedisInstance.sadd(`team:${teamId}:events`, 'e1');

    const { req, res } = createReqRes({ method: 'GET', token });
    await statsHandler(req, res);

    expect(res.getStatus()).toBe(200);
    const data = res.getJson();
    expect(data.pastEventsCount).toBe(1);
    expect(data.bySport.all.userStats['u1']).toBeDefined();

    // Verify it was cached in Redis
    const cached = await mockRedisInstance.get(`team:${teamId}:stats`);
    expect(cached).not.toBeNull();
  });

  it('POST /api/stats recomputes and enforces 30s rate limit', async () => {
    const { req: postReq1, res: postRes1 } = createReqRes({ method: 'POST', token });
    await statsHandler(postReq1, postRes1);
    expect(postRes1.getStatus()).toBe(200);
    expect(postRes1.getJson().success).toBe(true);

    // Immediate second call should be rate-limited (429)
    const { req: postReq2, res: postRes2 } = createReqRes({ method: 'POST', token });
    await statsHandler(postReq2, postRes2);
    expect(postRes2.getStatus()).toBe(429);
    expect(postRes2.getJson().error).toContain('nedávno přepočteny');
  });
});
