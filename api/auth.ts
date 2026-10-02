import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from './_utils/redis.js';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  getAuthTeam,
  getClientIp,
  checkRateLimit,
} from './_utils/auth.js';

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

const REFRESH_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days

export const DEFAULT_TEAM_ID = 'team-nahravame-si';
export const DEFAULT_TEAM_NAME = 'nahravame-si';
export const DEFAULT_TEAM_INITIAL_PASSWORD = '1234';

function getParsedBody(req: ApiRequest): any {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetTeams(res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/auth error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/auth or /api/teams — list public team info
async function handleGetTeams(res: ApiResponse) {
  // Lazy migration: Ensure default team exists if Redis is accessed
  await ensureDefaultTeam();

  const teamIds = await redis.smembers('teams:all');
  if (!teamIds || teamIds.length === 0) {
    return res.status(200).json([]);
  }

  const pipe = redis.pipeline();
  for (const id of teamIds) {
    pipe.get(`team:${id}`);
  }
  const rawResults = await pipe.exec();

  const teams = rawResults
    .filter(Boolean)
    .map((raw: any) => {
      const t = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
      };
    });

  // Sort alphabetically by name (Czech locale)
  teams.sort((a: any, b: any) => a.name.localeCompare(b.name, 'cs'));

  return res.status(200).json(teams);
}

// POST dispatcher for auth actions and team creation
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  req.body = body;
  const { action, name } = body;

  if (action === 'create-team' || (!action && name !== undefined) || (req.url && req.url.includes('teams'))) {
    return await handleCreateTeam(req, res);
  }

  switch (action) {
    case 'login':
      return await handleLogin(req, res);
    case 'refresh':
      return await handleRefresh(req, res);
    case 'logout':
      return await handleLogout(req, res);
    case 'change-password':
      return await handleChangePassword(req, res);
    default:
      return res.status(400).json({ error: 'Neznámá akce (action)' });
  }
}

// POST /api/teams or POST /api/auth { action: 'create-team', name, password }
async function handleCreateTeam(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  const { name, password } = body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Název týmu je povinný.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    return res.status(400).json({ error: 'Název týmu musí mít alespoň 2 znaky.' });
  }

  if (!password || typeof password !== 'string' || password.trim().length < 3) {
    return res.status(400).json({ error: 'Heslo týmu musí mít alespoň 3 znaky.' });
  }

  // Check case-insensitive duplicate name
  const teamIds = await redis.smembers('teams:all');
  if (teamIds && teamIds.length > 0) {
    const pipe = redis.pipeline();
    for (const id of teamIds) {
      pipe.get(`team:${id}`);
    }
    const rawResults = await pipe.exec();
    for (const raw of rawResults) {
      if (raw) {
        const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (existing.name && existing.name.toLowerCase() === trimmedName.toLowerCase()) {
          return res.status(409).json({ error: 'Tým s tímto názvem již existuje.' });
        }
      }
    }
  }

  const id = `team_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const teamData = {
    id,
    name: trimmedName,
    passwordHash: hashPassword(password.trim()),
    createdAt: now,
  };

  await redis.set(`team:${id}`, JSON.stringify(teamData));
  await redis.sadd('teams:all', id);

  // Issue active session for creator
  const accessToken = createAccessToken({ teamId: id, teamName: trimmedName });
  const refreshToken = createRefreshToken();
  const tokenRecord = {
    teamId: id,
    createdAt: now,
  };

  await redis.set(`refreshtoken:${refreshToken}`, JSON.stringify(tokenRecord), {
    ex: REFRESH_TOKEN_TTL_SECONDS,
  });
  await redis.sadd(`team:${id}:refresh_tokens`, refreshToken);

  return res.status(201).json({
    accessToken,
    refreshToken,
    team: {
      id,
      name: trimmedName,
      createdAt: now,
    },
  });
}

/**
 * Ensures the default team 'nahravame-si' exists and existing data is indexed
 */
async function ensureDefaultTeam() {
  try {
    const exists = await redis.get(`team:${DEFAULT_TEAM_ID}`);
    if (!exists) {
      const defaultTeam = {
        id: DEFAULT_TEAM_ID,
        name: DEFAULT_TEAM_NAME,
        passwordHash: hashPassword(DEFAULT_TEAM_INITIAL_PASSWORD),
        createdAt: new Date().toISOString(),
      };
      await redis.set(`team:${DEFAULT_TEAM_ID}`, JSON.stringify(defaultTeam));
      await redis.sadd('teams:all', DEFAULT_TEAM_ID);
    }

    // Safely mirror legacy users if needed
    try {
      const userCount = await redis.scard(`team:${DEFAULT_TEAM_ID}:users`);
      if (userCount === 0) {
        const legacyUserIds = await redis.smembers('users:all');
        if (legacyUserIds && legacyUserIds.length > 0) {
          for (let i = 0; i < legacyUserIds.length; i += 50) {
            const chunk = legacyUserIds.slice(i, i + 50);
            await redis.sadd(`team:${DEFAULT_TEAM_ID}:users`, chunk[0], ...chunk.slice(1));
          }
        }
      }
    } catch (e) {
      console.warn('Lazy migration user mirroring warning:', e);
    }

    // Safely mirror legacy events if needed
    try {
      const eventCount = await redis.scard(`team:${DEFAULT_TEAM_ID}:events`);
      if (eventCount === 0) {
        const legacyEventIds = await redis.smembers('events:all');
        if (legacyEventIds && legacyEventIds.length > 0) {
          for (let i = 0; i < legacyEventIds.length; i += 50) {
            const chunk = legacyEventIds.slice(i, i + 50);
            await redis.sadd(`team:${DEFAULT_TEAM_ID}:events`, chunk[0], ...chunk.slice(1));
          }
        }
      }
    } catch (e) {
      console.warn('Lazy migration event mirroring warning:', e);
    }
  } catch (error) {
    console.error('ensureDefaultTeam error:', error);
  }
}

// POST /api/auth { action: 'login', teamId, password }
async function handleLogin(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  const { teamId, password } = body;
  const ip = getClientIp(req);

  const allowed = await checkRateLimit(redis, ip, 10, 60);
  if (!allowed) {
    return res.status(429).json({ error: 'Příliš mnoho pokusů o přihlášení. Zkuste to za minutu.' });
  }

  if (!teamId || !password) {
    return res.status(400).json({ error: 'Vyberte tým a zadejte heslo.' });
  }

  // Ensure default team exists if user is logging into it
  if (teamId === DEFAULT_TEAM_ID) {
    await ensureDefaultTeam();
  }

  const rawTeam: any = await redis.get(`team:${teamId}`);
  if (!rawTeam) {
    return res.status(401).json({ error: 'Tým nebyl nalezen nebo heslo není správné.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;

  if (!team.passwordHash || !verifyPassword(password, team.passwordHash)) {
    return res.status(401).json({ error: 'Nesprávné heslo týmu.' });
  }

  const accessToken = createAccessToken({ teamId: team.id, teamName: team.name });
  const refreshToken = createRefreshToken();

  const tokenRecord = {
    teamId: team.id,
    createdAt: new Date().toISOString(),
  };

  await redis.set(`refreshtoken:${refreshToken}`, JSON.stringify(tokenRecord), {
    ex: REFRESH_TOKEN_TTL_SECONDS,
  });
  await redis.sadd(`team:${team.id}:refresh_tokens`, refreshToken);

  return res.status(200).json({
    accessToken,
    refreshToken,
    team: {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt,
    },
  });
}

// POST /api/auth { action: 'refresh', refreshToken }
async function handleRefresh(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  const { refreshToken } = body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'Chybí refresh token.' });
  }

  const rawRecord: any = await redis.get(`refreshtoken:${refreshToken}`);
  if (!rawRecord) {
    return res.status(401).json({ error: 'Neplatný nebo vypršený refresh token.' });
  }

  const record = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord;
  const rawTeam: any = await redis.get(`team:${record.teamId}`);
  if (!rawTeam) {
    return res.status(401).json({ error: 'Tým již neexistuje.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;
  const newAccessToken = createAccessToken({ teamId: team.id, teamName: team.name });

  // Roll refresh token expiration
  await redis.expire(`refreshtoken:${refreshToken}`, REFRESH_TOKEN_TTL_SECONDS);

  return res.status(200).json({
    accessToken: newAccessToken,
    refreshToken,
  });
}

// POST /api/auth { action: 'logout', refreshToken }
async function handleLogout(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  const { refreshToken } = body;
  if (refreshToken) {
    const rawRecord: any = await redis.get(`refreshtoken:${refreshToken}`);
    if (rawRecord) {
      const record = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord;
      if (record.teamId) {
        await redis.srem(`team:${record.teamId}:refresh_tokens`, refreshToken);
      }
    }
    await redis.del(`refreshtoken:${refreshToken}`);
  }

  return res.status(200).json({ success: true });
}

// POST /api/auth { action: 'change-password', oldPassword, newPassword } with Bearer token
async function handleChangePassword(req: ApiRequest, res: ApiResponse) {
  const authTeam = getAuthTeam(req);
  if (!authTeam) {
    return res.status(401).json({ error: 'Neautorizováno. Přihlaste se prosím k týmu.' });
  }

  const body = getParsedBody(req);
  const { oldPassword, newPassword } = body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Zadejte stávající i nové heslo.' });
  }

  if (newPassword.trim().length < 3) {
    return res.status(400).json({ error: 'Nové heslo musí mít alespoň 3 znaky.' });
  }

  const rawTeam: any = await redis.get(`team:${authTeam.teamId}`);
  if (!rawTeam) {
    return res.status(404).json({ error: 'Tým nebyl nalezen.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;

  if (!verifyPassword(oldPassword, team.passwordHash)) {
    return res.status(401).json({ error: 'Stávající heslo není správné.' });
  }

  team.passwordHash = hashPassword(newPassword.trim());
  await redis.set(`team:${team.id}`, JSON.stringify(team));

  // Revoke old refresh tokens for this team
  const oldTokens = await redis.smembers(`team:${team.id}:refresh_tokens`);
  if (oldTokens && oldTokens.length > 0) {
    const pipe = redis.pipeline();
    for (const t of oldTokens) {
      pipe.del(`refreshtoken:${t}`);
    }
    pipe.del(`team:${team.id}:refresh_tokens`);
    await pipe.exec();
  }

  // Issue new active session for the caller so they stay logged in
  const newAccessToken = createAccessToken({ teamId: team.id, teamName: team.name });
  const newRefreshToken = createRefreshToken();
  const tokenRecord = {
    teamId: team.id,
    createdAt: new Date().toISOString(),
  };

  await redis.set(`refreshtoken:${newRefreshToken}`, JSON.stringify(tokenRecord), {
    ex: REFRESH_TOKEN_TTL_SECONDS,
  });
  await redis.sadd(`team:${team.id}:refresh_tokens`, newRefreshToken);

  return res.status(200).json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
}
