import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyAdminCredentials,
  createAdminAccessToken,
  verifyAdminAccessToken,
  createImpersonationToken,
  verifyAccessToken,
} from '../../api/_utils/auth.js';

class MockRedis {
  data = new Map<string, any>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();
  lists = new Map<string, any[]>();

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
      if (this.lists.delete(k)) count++;
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
    if (!s) {
      s = new Set();
      this.sets.set(key, s);
    }
    let added = 0;
    for (const m of members) {
      if (!s.has(m)) {
        s.add(m);
        added++;
      }
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
  async lpush(key: string, ...values: any[]) {
    let list = this.lists.get(key);
    if (!list) {
      list = [];
      this.lists.set(key, list);
    }
    list.unshift(...values);
    return list.length;
  }
  async ltrim(key: string, start: number, stop: number) {
    const list = this.lists.get(key);
    if (list) {
      this.lists.set(key, list.slice(start, stop + 1));
    }
    return 'OK';
  }
  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: (key: string) => {
        operations.push(() => this.get(key));
        return pipe;
      },
      set: (key: string, val: any, opts?: any) => {
        operations.push(() => this.set(key, val, opts));
        return pipe;
      },
      scard: (key: string) => {
        operations.push(() => this.scard(key));
        return pipe;
      },
      exec: async () => {
        const results = [];
        for (const op of operations) results.push(await op());
        return results;
      },
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
      lpush = mockRedisInstance.lpush.bind(mockRedisInstance);
      ltrim = mockRedisInstance.ltrim.bind(mockRedisInstance);
      pipeline = mockRedisInstance.pipeline.bind(mockRedisInstance);
    },
  };
});

function createReqRes(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}) {
  const req: any = {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    _getData: () => responseData,
    _getStatus: () => statusCode,
  };

  return { req, res };
}

describe('Admin Authentication & Portal API', () => {
  let adminHandler: any;
  let authHandler: any;

  beforeEach(async () => {
    mockRedisInstance.data.clear();
    mockRedisInstance.sets.clear();
    mockRedisInstance.ttls.clear();
    mockRedisInstance.lists.clear();

    adminHandler = (await import('../../api/admin.js')).default;
    authHandler = (await import('../../api/auth.js')).default;
  });

  describe('Admin Auth Utilities', () => {
    it('verifies admin credentials in development default mode', () => {
      expect(verifyAdminCredentials('admin', 'admin123')).toBe(true);
      expect(verifyAdminCredentials('admin', 'wrongpass')).toBe(false);
      expect(verifyAdminCredentials('wronguser', 'admin123')).toBe(false);
      expect(verifyAdminCredentials('', '')).toBe(false);
    });

    it('creates and verifies admin access token with admin audience and role', () => {
      const token = createAdminAccessToken('superadmin');
      const verified = verifyAdminAccessToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.username).toBe('superadmin');
      expect(verified?.role).toBe('admin');
    });

    it('rejects regular team token on admin verification', () => {
      const impersonatedTeamToken = createImpersonationToken('team-1', 'Team One', 'admin');
      expect(verifyAdminAccessToken(impersonatedTeamToken)).toBeNull();
    });

    it('creates impersonation token with isImpersonated and impersonatedBy claims', () => {
      const token = createImpersonationToken('team-abc', 'Team ABC', 'boss');
      const verified = verifyAccessToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.teamId).toBe('team-abc');
      expect(verified?.teamName).toBe('Team ABC');
      expect(verified?.isImpersonated).toBe(true);
      expect(verified?.impersonatedBy).toBe('boss');
    });
  });

  describe('POST /api/admin action=login', () => {
    it('returns 200 and access token for valid admin credentials', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { action: 'login', username: 'admin', password: 'admin123' },
      });

      await adminHandler(req, res);

      expect(res._getStatus()).toBe(200);
      const data = res._getData();
      expect(data.accessToken).toBeDefined();
      expect(data.admin).toEqual({ username: 'admin', role: 'admin' });
    });

    it('returns 401 for invalid password and logs audit failure', async () => {
      const { req, res } = createReqRes({
        method: 'POST',
        body: { action: 'login', username: 'admin', password: 'bad-password' },
      });

      await adminHandler(req, res);

      expect(res._getStatus()).toBe(401);
      expect(res._getData().error).toContain('Neplatné administrátorské přihlašovací údaje');
    });

    it('rate-limits admin login after 5 failed attempts', async () => {
      const ip = '192.168.1.55';
      for (let i = 0; i < 5; i++) {
        const { req, res } = createReqRes({
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
          body: { action: 'login', username: 'admin', password: 'wrong' },
        });
        await adminHandler(req, res);
        expect(res._getStatus()).toBe(401);
      }

      // 6th attempt should return 429 Too Many Requests
      const { req, res } = createReqRes({
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: { action: 'login', username: 'admin', password: 'admin123' },
      });
      await adminHandler(req, res);
      expect(res._getStatus()).toBe(429);
      expect(res._getData().error).toContain('Příliš mnoho neúspěšných pokusů');
    });
  });

  describe('GET /api/admin action=overview', () => {
    it('returns 401 if not authenticated as admin', async () => {
      const { req, res } = createReqRes({
        method: 'GET',
        query: { action: 'overview' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(401);
    });

    it('returns aggregated metrics for all teams in Redis', async () => {
      const adminToken = createAdminAccessToken('admin');

      // Seed teams in Redis
      const team1 = { id: 'team-alpha', name: 'Alpha Team', createdAt: '2025-01-01T00:00:00Z' };
      const team2 = { id: 'team-beta', name: 'Beta Team', createdAt: '2025-02-01T00:00:00Z' };

      await mockRedisInstance.set('team:team-alpha', JSON.stringify(team1));
      await mockRedisInstance.set('team:team-beta', JSON.stringify(team2));
      await mockRedisInstance.sadd('teams:all', 'team-alpha', 'team-beta');

      await mockRedisInstance.sadd('team:team-alpha:users', 'u1', 'u2');
      await mockRedisInstance.sadd('team:team-alpha:events', 'e1', 'e2', 'e3');

      await mockRedisInstance.sadd('team:team-beta:users', 'u3');
      await mockRedisInstance.sadd('team:team-beta:events', 'e4');

      const { req, res } = createReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${adminToken}` },
        query: { action: 'overview' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(200);
      const data = res._getData();

      expect(data.totalTeams).toBe(2);
      expect(data.totalUsers).toBe(3);
      expect(data.totalEvents).toBe(4);
      expect(data.teams).toHaveLength(2);

      const alpha = data.teams.find((t: any) => t.id === 'team-alpha');
      expect(alpha).toBeDefined();
      expect(alpha.userCount).toBe(2);
      expect(alpha.eventCount).toBe(3);
    });

    it('gracefully handles corrupted team JSON without crashing overview', async () => {
      const adminToken = createAdminAccessToken('admin');

      await mockRedisInstance.set('team:team-corrupt', '{invalid-json');
      await mockRedisInstance.sadd('teams:all', 'team-corrupt');

      const { req, res } = createReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${adminToken}` },
        query: { action: 'overview' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(200);
      const data = res._getData();
      expect(data.totalTeams).toBe(1);
      expect(data.teams[0].isCorrupt).toBe(true);
    });
  });

  describe('POST /api/admin action=impersonate', () => {
    it('returns 404 if team does not exist', async () => {
      const adminToken = createAdminAccessToken('admin');
      const { req, res } = createReqRes({
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { action: 'impersonate', teamId: 'non-existent' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(404);
    });

    it('mints scoped team token with isImpersonated=true and stores refresh token', async () => {
      const adminToken = createAdminAccessToken('admin_super');
      const team = { id: 'team-volejbal', name: 'Volejbal Stars', createdAt: '2025-01-01' };
      await mockRedisInstance.set('team:team-volejbal', JSON.stringify(team));

      const { req, res } = createReqRes({
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { action: 'impersonate', teamId: 'team-volejbal' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(200);
      const data = res._getData();

      expect(data.team.id).toBe('team-volejbal');
      expect(data.isImpersonated).toBe(true);
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();

      const decoded = verifyAccessToken(data.accessToken);
      expect(decoded?.teamId).toBe('team-volejbal');
      expect(decoded?.isImpersonated).toBe(true);
      expect(decoded?.impersonatedBy).toBe('admin_super');

      // Verify refresh token was stored in Redis with 2h TTL
      const stored = await mockRedisInstance.get(`refreshtoken:${data.refreshToken}`);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.isImpersonated).toBe(true);
      expect(parsed.impersonatedBy).toBe('admin_super');
    });

    it('propagates impersonation claims when refreshing token via /api/auth', async () => {
      const team = { id: 'team-refresh', name: 'Refresh Team', createdAt: '2025-01-01' };
      await mockRedisInstance.set('team:team-refresh', JSON.stringify(team));

      const refreshToken = 'test-refresh-token-123';
      const record = {
        teamId: 'team-refresh',
        isImpersonated: true,
        impersonatedBy: 'admin_audit',
        createdAt: new Date().toISOString(),
      };
      await mockRedisInstance.set(`refreshtoken:${refreshToken}`, JSON.stringify(record));

      const { req, res } = createReqRes({
        method: 'POST',
        body: { action: 'refresh', refreshToken },
      });

      await authHandler(req, res);
      expect(res._getStatus()).toBe(200);
      const data = res._getData();

      const decoded = verifyAccessToken(data.accessToken);
      expect(decoded?.isImpersonated).toBe(true);
      expect(decoded?.impersonatedBy).toBe('admin_audit');
    });
  });

  describe('POST /api/admin action=reset-team-password', () => {
    it('updates team password in Redis and enables login with new password', async () => {
      const adminToken = createAdminAccessToken('admin');
      const team = {
        id: 'team-to-reset',
        name: 'Reset Me',
        passwordHash: hashPassword('old-password-123'),
        createdAt: '2025-01-01',
      };
      await mockRedisInstance.set('team:team-to-reset', JSON.stringify(team));

      const { req, res } = createReqRes({
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { action: 'reset-team-password', teamId: 'team-to-reset', newPassword: 'smec-9999' },
      });

      await adminHandler(req, res);
      expect(res._getStatus()).toBe(200);
      expect(res._getData().success).toBe(true);

      // Verify that team login now succeeds with the new password
      const loginReqRes = createReqRes({
        method: 'POST',
        body: { action: 'login', teamId: 'team-to-reset', password: 'smec-9999' },
      });
      await authHandler(loginReqRes.req, loginReqRes.res);
      expect(loginReqRes.res._getStatus()).toBe(200);
    });
  });
});
