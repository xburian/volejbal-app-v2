import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  getAuthTeam,
  getClientIp,
  checkRateLimit,
} from './utils/auth.js';

const redis = new Redis({
  url: process.env.volejbal_KV_REST_API_URL!,
  token: process.env.volejbal_KV_REST_API_TOKEN!,
});

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

const REFRESH_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.body || {};

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
  } catch (error: any) {
    console.error('API /api/auth error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// POST /api/auth { action: 'login', teamId, password }
async function handleLogin(req: ApiRequest, res: ApiResponse) {
  const { teamId, password } = req.body;
  const ip = getClientIp(req);

  const allowed = await checkRateLimit(redis, ip, 10, 60);
  if (!allowed) {
    return res.status(429).json({ error: 'Příliš mnoho pokusů o přihlášení. Zkuste to za minutu.' });
  }

  if (!teamId || !password) {
    return res.status(400).json({ error: 'Vyberte tým a zadejte heslo.' });
  }

  const rawTeam: any = await redis.get(`team:${teamId}`);
  if (!rawTeam) {
    return res.status(401).json({ error: 'Tým nebyl nalezen nebo heslo není správné.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;

  if (!verifyPassword(password, team.passwordHash)) {
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
  const { refreshToken } = req.body;
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
  const { refreshToken } = req.body;
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

  const { oldPassword, newPassword } = req.body;

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
