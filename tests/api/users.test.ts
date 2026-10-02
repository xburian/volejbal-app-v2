import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccessToken } from '../../api/_utils/auth.js';

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
  async del(...keys: string[]) {
    let count = 0;
    for (const k of keys) {
      if (this.data.delete(k)) count++;
      if (this.sets.delete(k)) count++;
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
  async sismember(key: string, member: string) {
    return this.sets.get(key)?.has(member) ? 1 : 0;
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
      del: (key: string) => { operations.push(() => this.del(key)); return pipe; },
      sadd: (key: string, ...members: string[]) => { operations.push(() => this.sadd(key, ...members)); return pipe; },
      srem: (key: string, ...members: string[]) => { operations.push(() => this.srem(key, ...members)); return pipe; },
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
      sadd = mockRedisInstance.sadd.bind(mockRedisInstance);
      srem = mockRedisInstance.srem.bind(mockRedisInstance);
      sismember = mockRedisInstance.sismember.bind(mockRedisInstance);
      smembers = mockRedisInstance.smembers.bind(mockRedisInstance);
      scard = mockRedisInstance.scard.bind(mockRedisInstance);
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
    }),
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };

  return { req, res };
}

describe('API /api/users handler', () => {
  let handler: any;
  const team1Token = createAccessToken({ teamId: 'team-1', teamName: 'Team 1' });
  const team2Token = createAccessToken({ teamId: 'team-2', teamName: 'Team 2' });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();

    const mod = await import('../../api/users.js');
    handler = mod.default;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { req, res } = createReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.getStatus()).toBe(401);
    expect(res.getJson().error).toMatch(/Neautorizováno/);
  });

  it('creates user with teamId and retrieves only for that team', async () => {
    // Team 1 creates "Alice"
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: { name: 'Alice' },
      token: team1Token,
    });
    await handler(createReq, createRes);
    expect(createRes.getStatus()).toBe(201);
    const alice = createRes.getJson();
    expect(alice.name).toBe('Alice');
    expect(alice.teamId).toBe('team-1');

    // Team 1 lists users -> should see Alice
    const { req: listReq1, res: listRes1 } = createReqRes({ method: 'GET', token: team1Token });
    await handler(listReq1, listRes1);
    expect(listRes1.getStatus()).toBe(200);
    expect(listRes1.getJson()).toHaveLength(1);
    expect(listRes1.getJson()[0].name).toBe('Alice');

    // Team 2 lists users -> should see empty array (tenant isolation)
    const { req: listReq2, res: listRes2 } = createReqRes({ method: 'GET', token: team2Token });
    await handler(listReq2, listRes2);
    expect(listRes2.getStatus()).toBe(200);
    expect(listRes2.getJson()).toHaveLength(0);
  });

  it('allows same user name in different teams', async () => {
    // Team 1 creates "Petr"
    const { req: req1, res: res1 } = createReqRes({
      method: 'POST',
      body: { name: 'Petr' },
      token: team1Token,
    });
    await handler(req1, res1);
    expect(res1.getStatus()).toBe(201);

    // Team 2 creates "Petr"
    const { req: req2, res: res2 } = createReqRes({
      method: 'POST',
      body: { name: 'Petr' },
      token: team2Token,
    });
    await handler(req2, res2);
    expect(res2.getStatus()).toBe(201);
  });

  it('rejects duplicate user name within the same team', async () => {
    const { req: req1, res: res1 } = createReqRes({
      method: 'POST',
      body: { name: 'Petr' },
      token: team1Token,
    });
    await handler(req1, res1);
    expect(res1.getStatus()).toBe(201);

    // Second time in same team -> 409
    const { req: req2, res: res2 } = createReqRes({
      method: 'POST',
      body: { name: 'petr ' },
      token: team1Token,
    });
    await handler(req2, res2);
    expect(res2.getStatus()).toBe(409);
    expect(res2.getJson().error).toMatch(/Hráč s tímto jménem v týmu již existuje/);
  });

  it('updates a user within the team', async () => {
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: { name: 'Jan' },
      token: team1Token,
    });
    await handler(createReq, createRes);
    const user = createRes.getJson();

    const { req: updateReq, res: updateRes } = createReqRes({
      method: 'PUT',
      body: { id: user.id, name: 'Jan Novák' },
      token: team1Token,
    });
    await handler(updateReq, updateRes);
    expect(updateRes.getStatus()).toBe(200);
    expect(updateRes.getJson().name).toBe('Jan Novák');
  });

  it('deletes a user and removes from team users set', async () => {
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: { name: 'ToDelete' },
      token: team1Token,
    });
    await handler(createReq, createRes);
    const user = createRes.getJson();

    const { req: delReq, res: delRes } = createReqRes({
      method: 'DELETE',
      query: { id: user.id },
      token: team1Token,
    });
    await handler(delReq, delRes);
    expect(delRes.getStatus()).toBe(200);

    const teamUsers = await mockRedisInstance.smembers('team:team-1:users');
    expect(teamUsers).not.toContain(user.id);
  });
});
