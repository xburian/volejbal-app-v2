import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccessToken } from './utils/auth.js';

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

describe('API /api/events handler', () => {
  let handler: any;
  const team1Token = createAccessToken({ teamId: 'team-1', teamName: 'Team 1' });
  const team2Token = createAccessToken({ teamId: 'team-2', teamName: 'Team 2' });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();

    const mod = await import('./events.js');
    handler = mod.default;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { req, res } = createReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.getStatus()).toBe(401);
    expect(res.getJson().error).toMatch(/Neautorizováno/);
  });

  it('creates event with teamId and retrieves only for that team', async () => {
    const eventData = {
      title: 'Pondělní volejbal',
      date: '2026-04-06',
      time: '18:00',
      location: 'Hala 1',
      totalCost: 1000,
    };

    // Team 1 creates event
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: eventData,
      token: team1Token,
    });
    await handler(createReq, createRes);
    expect(createRes.getStatus()).toBe(201);
    const createdRes = createRes.getJson();
    expect(createdRes.success).toBe(true);
    expect(createdRes.id).toBeDefined();

    // Team 1 lists events -> should see the event
    const { req: listReq1, res: listRes1 } = createReqRes({ method: 'GET', token: team1Token });
    await handler(listReq1, listRes1);
    expect(listRes1.getStatus()).toBe(200);
    expect(listRes1.getJson()).toHaveLength(1);
    expect(listRes1.getJson()[0].title).toBe('Pondělní volejbal');
    expect(listRes1.getJson()[0].teamId).toBe('team-1');

    // Team 2 lists events -> should see 0 events (isolation)
    const { req: listReq2, res: listRes2 } = createReqRes({ method: 'GET', token: team2Token });
    await handler(listReq2, listRes2);
    expect(listRes2.getStatus()).toBe(200);
    expect(listRes2.getJson()).toHaveLength(0);
  });

  it('updates an event within the team', async () => {
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: { title: 'Původní název', date: '2026-04-06', time: '18:00', location: 'Hala', totalCost: 500 },
      token: team1Token,
    });
    await handler(createReq, createRes);
    const createdId = createRes.getJson().id;

    const { req: updateReq, res: updateRes } = createReqRes({
      method: 'PUT',
      body: { id: createdId, title: 'Aktualizovaný název', date: '2026-04-06', time: '18:00', location: 'Hala', totalCost: 500 },
      token: team1Token,
    });
    await handler(updateReq, updateRes);
    expect(updateRes.getStatus()).toBe(200);
    expect(updateRes.getJson()).toEqual({ success: true });

    // Verify via GET
    const { req: getReq, res: getRes } = createReqRes({ method: 'GET', token: team1Token });
    await handler(getReq, getRes);
    expect(getRes.getJson()[0].title).toBe('Aktualizovaný název');
  });

  it('deletes an event and removes from team events set', async () => {
    const { req: createReq, res: createRes } = createReqRes({
      method: 'POST',
      body: { title: 'Na smazání', date: '2026-04-06', time: '18:00', location: 'Hala', totalCost: 500 },
      token: team1Token,
    });
    await handler(createReq, createRes);
    const createdId = createRes.getJson().id;

    const { req: delReq, res: delRes } = createReqRes({
      method: 'DELETE',
      query: { id: createdId },
      token: team1Token,
    });
    await handler(delReq, delRes);
    expect(delRes.getStatus()).toBe(200);

    const teamEvents = await mockRedisInstance.smembers('team:team-1:events');
    expect(teamEvents).not.toContain(createdId);
  });
});
