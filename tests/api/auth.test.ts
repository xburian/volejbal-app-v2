import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, createAccessToken } from '../../api/_utils/auth.js';

// In-memory Redis simulation
class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();

  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: any, options?: { ex?: number }) {
    this.data.set(key, value);
    if (options?.ex) this.ttls.set(key, options.ex);
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
  async incr(key: string) {
    const val = (Number(this.data.get(key)) || 0) + 1;
    this.data.set(key, val);
    return val;
  }
  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
    return 1;
  }
  async ttl(key: string) {
    return this.ttls.get(key) ?? -1;
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
      incr = mockRedisInstance.incr.bind(mockRedisInstance);
      expire = mockRedisInstance.expire.bind(mockRedisInstance);
      ttl = mockRedisInstance.ttl.bind(mockRedisInstance);
      sadd = mockRedisInstance.sadd.bind(mockRedisInstance);
      srem = mockRedisInstance.srem.bind(mockRedisInstance);
      smembers = mockRedisInstance.smembers.bind(mockRedisInstance);
      scard = mockRedisInstance.scard.bind(mockRedisInstance);
      pipeline = mockRedisInstance.pipeline.bind(mockRedisInstance);
    },
  };
});

// Helper to create mock request and response
function createReqRes(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const req: any = {
    method: options.method || 'POST',
    body: options.body || {},
    headers: options.headers || {},
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

describe('API /api/auth handler', () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();
    mockRedisInstance.ttls.clear();

    const mod = await import('../../api/auth.js');
    handler = mod.default;

    // Seed a test team in mock Redis
    const testTeam = {
      id: 'team-nahravame-si',
      name: 'nahravame-si',
      passwordHash: hashPassword('1234'),
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await mockRedisInstance.set('team:team-nahravame-si', JSON.stringify(testTeam));
    await mockRedisInstance.sadd('teams:all', 'team-nahravame-si');
  });

  describe('HTTP Method and Action Validation', () => {
    it('rejects unsupported HTTP methods with 405', async () => {
      const { req, res } = createReqRes({ method: 'PUT' });
      await handler(req, res);
      expect(res.getStatus()).toBe(405);
      expect(res.getJson()).toEqual({ error: 'Method not allowed' });
    });

    it('rejects unknown action with 400', async () => {
      const { req, res } = createReqRes({ body: { action: 'unknown-action' } });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson()).toEqual({ error: 'Neznámá akce (action)' });
    });
  });

  describe('action: login', () => {
    it('rejects missing teamId or password with 400', async () => {
      const { req, res } = createReqRes({ body: { action: 'login', teamId: '' } });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson().error).toMatch(/Vyberte tým a zadejte heslo/);
    });

    it('rejects nonexistent team with 401', async () => {
      const { req, res } = createReqRes({
        body: { action: 'login', teamId: 'nonexistent-team', password: '1234' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getJson().error).toMatch(/Tým nebyl nalezen/);
    });

    it('rejects incorrect password with 401', async () => {
      const { req, res } = createReqRes({
        body: { action: 'login', teamId: 'team-nahravame-si', password: 'wrong-password' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getJson().error).toMatch(/Nesprávné heslo týmu/);
    });

    it('logs in successfully with valid credentials', async () => {
      const { req, res } = createReqRes({
        body: { action: 'login', teamId: 'team-nahravame-si', password: '1234' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const body = res.getJson();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.team).toBeDefined();
      expect(body.team.name).toBe('nahravame-si');
      expect(body.team.passwordHash).toBeUndefined(); // Sensitive data omitted

      // Verify refresh token was stored in Redis
      const sessionRaw = await mockRedisInstance.get(`refreshtoken:${body.refreshToken}`);
      expect(sessionRaw).not.toBeNull();
      const session = JSON.parse(sessionRaw);
      expect(session.teamId).toBe('team-nahravame-si');
    });

    it('enforces rate limit after exceeding max attempts', async () => {
      for (let i = 0; i < 10; i++) {
        const { req, res } = createReqRes({
          body: { action: 'login', teamId: 'team-nahravame-si', password: 'wrong' },
          headers: { 'x-forwarded-for': '1.2.3.4' },
        });
        await handler(req, res);
        expect(res.getStatus()).toBe(401);
      }

      // 11th attempt should be blocked with 429
      const { req, res } = createReqRes({
        body: { action: 'login', teamId: 'team-nahravame-si', password: '1234' },
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(429);
      expect(res.getJson().error).toMatch(/Příliš mnoho pokusů o přihlášení/);
    });
  });

  describe('action: refresh', () => {
    it('rejects missing refreshToken with 400', async () => {
      const { req, res } = createReqRes({ body: { action: 'refresh' } });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson().error).toMatch(/Chybí refresh token/);
    });

    it('rejects invalid or expired refreshToken with 401', async () => {
      const { req, res } = createReqRes({
        body: { action: 'refresh', refreshToken: 'invalid-token' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getJson().error).toMatch(/Neplatný nebo vypršený refresh token/);
    });

    it('refreshes token successfully with active session', async () => {
      const refreshToken = 'valid-refresh-token-123';
      const session = {
        teamId: 'team-nahravame-si',
        createdAt: new Date().toISOString(),
      };
      await mockRedisInstance.set(`refreshtoken:${refreshToken}`, JSON.stringify(session));

      const { req, res } = createReqRes({
        body: { action: 'refresh', refreshToken },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const body = res.getJson();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBe(refreshToken);
    });
  });

  describe('action: logout', () => {
    it('deletes session from Redis and succeeds', async () => {
      const refreshToken = 'logout-refresh-token';
      await mockRedisInstance.set(`refreshtoken:${refreshToken}`, JSON.stringify({ teamId: 'team-nahravame-si' }));
      await mockRedisInstance.sadd('team:team-nahravame-si:refresh_tokens', refreshToken);

      const { req, res } = createReqRes({
        body: { action: 'logout', refreshToken },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getJson()).toEqual({ success: true });

      const session = await mockRedisInstance.get(`refreshtoken:${refreshToken}`);
      expect(session).toBeNull();
    });
  });

  describe('action: change-password', () => {
    it('rejects unauthorized request with 401', async () => {
      const { req, res } = createReqRes({
        body: { action: 'change-password', oldPassword: '1234', newPassword: 'new-pass-5678' },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getJson().error).toMatch(/Neautorizováno/);
    });

    it('rejects short new password with 400', async () => {
      const validToken = createAccessToken({ teamId: 'team-nahravame-si', teamName: 'nahravame-si' });
      const { req, res } = createReqRes({
        body: { action: 'change-password', oldPassword: '1234', newPassword: 'ab' },
        headers: { authorization: `Bearer ${validToken}` },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getJson().error).toMatch(/Nové heslo musí mít alespoň 3 znaky/);
    });

    it('rejects incorrect old password with 401', async () => {
      const validToken = createAccessToken({ teamId: 'team-nahravame-si', teamName: 'nahravame-si' });
      const { req, res } = createReqRes({
        body: { action: 'change-password', oldPassword: 'wrong-old-password', newPassword: 'new-pass-5678' },
        headers: { authorization: `Bearer ${validToken}` },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(401);
      expect(res.getJson().error).toMatch(/Stávající heslo není správné/);
    });

    it('successfully changes team password and updates hash in Redis', async () => {
      const validToken = createAccessToken({ teamId: 'team-nahravame-si', teamName: 'nahravame-si' });
      const { req, res } = createReqRes({
        body: { action: 'change-password', oldPassword: '1234', newPassword: 'super-secret-new-pass' },
        headers: { authorization: `Bearer ${validToken}` },
      });
      await handler(req, res);
      expect(res.getStatus()).toBe(200);

      const body = res.getJson();
      expect(body.success).toBe(true);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Verify that Redis was updated with the new password hash
      const updatedTeamRaw = await mockRedisInstance.get('team:team-nahravame-si');
      const updatedTeam = JSON.parse(updatedTeamRaw);
      expect(updatedTeam.passwordHash).not.toBe(hashPassword('1234'));
    });
  });
});
