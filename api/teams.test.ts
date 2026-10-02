import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Redis simulation
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

const mockRedisInstance = new MockRedis();

vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      get = mockRedisInstance.get.bind(mockRedisInstance);
      set = mockRedisInstance.set.bind(mockRedisInstance);
      sadd = mockRedisInstance.sadd.bind(mockRedisInstance);
      smembers = mockRedisInstance.smembers.bind(mockRedisInstance);
      scard = mockRedisInstance.scard.bind(mockRedisInstance);
      pipeline = mockRedisInstance.pipeline.bind(mockRedisInstance);
    },
  };
});

function createReqRes(options: {
  method?: string;
  body?: any;
}) {
  const req: any = {
    method: options.method || 'GET',
    body: options.body || {},
    headers: {},
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
    }),
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };

  return { req, res };
}

describe('API /api/teams handler', () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();

    const mod = await import('./teams.js');
    handler = mod.default;
  });

  describe('HTTP Method Validation', () => {
    it('rejects PUT and DELETE with 405', async () => {
      const { req: putReq, res: putRes } = createReqRes({ method: 'PUT' });
      await handler(putReq, putRes);
      expect(putRes.getStatus()).toBe(405);
      expect(putRes.getJson()).toEqual({ error: 'Method not allowed' });

      const { req: delReq, res: delRes } = createReqRes({ method: 'DELETE' });
      await handler(delReq, delRes);
      expect(delRes.getStatus()).toBe(405);
    });
  });

  describe('GET /api/teams', () => {
    it('performs lazy migration and returns default team if DB is empty', async () => {
      const { req, res } = createReqRes({ method: 'GET' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const teams = res.getJson();
      expect(teams).toHaveLength(1);
      expect(teams[0].id).toBe('team-nahravame-si');
      expect(teams[0].name).toBe('nahravame-si');
      expect(teams[0].passwordHash).toBeUndefined(); // Never expose hashes
    });

    it('mirrors legacy users:all and events:all during lazy migration', async () => {
      await mockRedisInstance.sadd('users:all', 'u1', 'u2');
      await mockRedisInstance.sadd('events:all', 'e1', 'e2', 'e3');

      const { req, res } = createReqRes({ method: 'GET' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const teamUsers = await mockRedisInstance.smembers('team:team-nahravame-si:users');
      expect(teamUsers).toEqual(expect.arrayContaining(['u1', 'u2']));

      const teamEvents = await mockRedisInstance.smembers('team:team-nahravame-si:events');
      expect(teamEvents).toEqual(expect.arrayContaining(['e1', 'e2', 'e3']));
    });

    it('returns all existing teams without sensitive data', async () => {
      const customTeam = {
        id: 'team-brno',
        name: 'Volejbal Brno',
        passwordHash: 'scrypt$hash',
        createdAt: '2026-02-01T00:00:00.000Z',
      };
      await mockRedisInstance.set('team:team-brno', JSON.stringify(customTeam));
      await mockRedisInstance.sadd('teams:all', 'team-brno');

      const { req, res } = createReqRes({ method: 'GET' });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const teams = res.getJson();
      expect(teams.length).toBeGreaterThanOrEqual(2);
      const brno = teams.find((t: any) => t.id === 'team-brno');
      expect(brno).toBeDefined();
      expect(brno.name).toBe('Volejbal Brno');
      expect(brno.passwordHash).toBeUndefined();
    });
  });

  describe('POST /api/teams (Create Team)', () => {
    it('rejects empty team name with 400', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { name: '   ', password: 'password123' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson().error).toMatch(/Název týmu/);
    });

    it('rejects password shorter than 3 characters with 400', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { name: 'Novi hraci', password: 'ab' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson().error).toMatch(/Heslo týmu musí mít alespoň 3 znaky/);
    });

    it('rejects creating duplicate team name case-insensitively with 409', async () => {
      // First ensure default team exists
      await handler(createReqRes({ method: 'GET' }).req, createReqRes({ method: 'GET' }).res);

      const { req, res } = createReqRes({
        method: 'POST',
        body: { name: 'NAHRAVAME-SI', password: 'new-password' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(409);
      expect(res.getJson().error).toMatch(/Tým s tímto názvem již existuje/);
    });

    it('creates new team successfully and returns auth tokens', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { name: 'Beachvolejbal Praha', password: 'praha-heslo' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(201);

      const body = res.getJson();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.team).toBeDefined();
      expect(body.team.name).toBe('Beachvolejbal Praha');
      expect(body.team.id).toMatch(/^team_/);

      // Verify stored in Redis
      const teamInRedis = await mockRedisInstance.get(`team:${body.team.id}`);
      expect(teamInRedis).not.toBeNull();
      const parsed = JSON.parse(teamInRedis);
      expect(parsed.name).toBe('Beachvolejbal Praha');
      expect(parsed.passwordHash).toBeDefined();

      const allTeams = await mockRedisInstance.smembers('teams:all');
      expect(allTeams).toContain(body.team.id);
    });
  });
});
