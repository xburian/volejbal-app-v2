import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from './_utils/redis.js';
import {
  verifyAdminCredentials,
  createAdminAccessToken,
  verifyAdminAccessToken,
  createImpersonationToken,
  createRefreshToken,
  hashPassword,
  getClientIp,
  checkAdminRateLimit,
} from './_utils/auth.js';

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

const AUDIT_LOGS_KEY = 'audit:admin_actions';
const IMPERSONATION_REFRESH_TTL_SECONDS = 2 * 60 * 60; // 2 hours hard cap

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

function getAdminFromRequest(req: ApiRequest): { username: string; role: 'admin' } | null {
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyAdminAccessToken(token);
}

async function recordAuditLog(event: {
  action: string;
  adminUser: string;
  targetTeamId?: string;
  targetTeamName?: string;
  ip: string;
  details?: Record<string, any>;
}) {
  try {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...event,
      timestamp: new Date().toISOString(),
    };
    await redis.lpush(AUDIT_LOGS_KEY, JSON.stringify(entry));
    await redis.ltrim(AUDIT_LOGS_KEY, 0, 9999);
  } catch (err) {
    console.warn('Failed to record admin audit log:', err);
  }
}

function safeNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string' && !isNaN(Number(val))) return Number(val);
  return 0;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/admin error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGet(req: ApiRequest, res: ApiResponse) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: 'Neautorizováno. Vyžadováno přihlášení správce.' });
  }

  const queryAction = req.query?.action;
  if (queryAction === 'overview' || !queryAction) {
    return await handleOverview(res);
  }

  return res.status(400).json({ error: 'Neznámá akce' });
}

async function handleOverview(res: ApiResponse) {
  const teamIds = await redis.smembers('teams:all');
  if (!teamIds || teamIds.length === 0) {
    return res.status(200).json({
      totalTeams: 0,
      totalUsers: 0,
      totalEvents: 0,
      teams: [],
    });
  }

  // Chunk pipeline execution in batches of 50 teams
  const BATCH_SIZE = 50;
  const teams: any[] = [];
  let totalUsers = 0;
  let totalEvents = 0;

  for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
    const chunk = teamIds.slice(i, i + BATCH_SIZE);
    const pipe = redis.pipeline();
    for (const id of chunk) {
      pipe.get(`team:${id}`);
      pipe.scard(`team:${id}:users`);
      pipe.scard(`team:${id}:events`);
      pipe.get(`team:${id}:last_active_at`);
    }

    const rawResults = await pipe.exec();

    for (let j = 0; j < chunk.length; j++) {
      const id = chunk[j];
      const base = j * 4;
      const rawTeam = rawResults[base];
      const userCount = safeNumber(rawResults[base + 1]);
      const eventCount = safeNumber(rawResults[base + 2]);
      const lastActiveAt = (typeof rawResults[base + 3] === 'string' ? rawResults[base + 3] : null) || null;

      totalUsers += userCount;
      totalEvents += eventCount;

      if (rawTeam) {
        try {
          const t = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;
          teams.push({
            id: t.id || id,
            name: t.name || id,
            createdAt: t.createdAt || new Date().toISOString(),
            userCount,
            eventCount,
            lastActiveAt: lastActiveAt || t.createdAt || null,
          });
        } catch {
          // Graceful handling of corrupted team JSON
          teams.push({
            id,
            name: `[Poškozený tým: ${id}]`,
            createdAt: new Date().toISOString(),
            userCount,
            eventCount,
            lastActiveAt: null,
            isCorrupt: true,
          });
        }
      } else {
        teams.push({
          id,
          name: id,
          createdAt: new Date().toISOString(),
          userCount,
          eventCount,
          lastActiveAt: null,
        });
      }
    }
  }

  // Sort by recent activity descending (fallback to createdAt)
  teams.sort((a, b) => {
    const timeA = new Date(a.lastActiveAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastActiveAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return res.status(200).json({
    totalTeams: teams.length,
    totalUsers,
    totalEvents,
    teams,
  });
}

async function handlePost(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  req.body = body;
  const { action } = body;

  switch (action) {
    case 'login':
      return await handleLogin(req, res);
    case 'impersonate':
      return await handleImpersonate(req, res);
    case 'reset-team-password':
      return await handleResetTeamPassword(req, res);
    case 'logout':
      return res.status(200).json({ success: true });
    default:
      return res.status(400).json({ error: 'Neznámá akce (action)' });
  }
}

async function handleLogin(req: ApiRequest, res: ApiResponse) {
  const body = getParsedBody(req);
  const { username, password } = body || {};
  const ip = getClientIp(req);

  // Pre-Scrypt Rate Limiting: Atomic check before heavy password verification
  const allowed = await checkAdminRateLimit(redis, ip, 5, 900);
  if (!allowed) {
    return res.status(429).json({
      error: 'Příliš mnoho neúspěšných pokusů o přihlášení správce. Zkuste to za 15 minut.',
    });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Zadejte uživatelské jméno a heslo správce.' });
  }

  const isValid = verifyAdminCredentials(username, password);
  if (!isValid) {
    await recordAuditLog({
      action: 'LOGIN_FAILURE',
      adminUser: String(username).trim(),
      ip,
    });
    return res.status(401).json({ error: 'Neplatné administrátorské přihlašovací údaje.' });
  }

  const cleanUser = String(username).trim();
  const accessToken = createAdminAccessToken(cleanUser);

  await recordAuditLog({
    action: 'LOGIN_SUCCESS',
    adminUser: cleanUser,
    ip,
  });

  return res.status(200).json({
    accessToken,
    admin: {
      username: cleanUser,
      role: 'admin',
    },
  });
}

async function handleImpersonate(req: ApiRequest, res: ApiResponse) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: 'Neautorizováno. Vyžadováno přihlášení správce.' });
  }

  const body = getParsedBody(req);
  const { teamId } = body || {};
  if (!teamId) {
    return res.status(400).json({ error: 'Chybí ID týmu pro přepnutí.' });
  }

  const rawTeam: any = await redis.get(`team:${teamId}`);
  if (!rawTeam) {
    return res.status(404).json({ error: 'Tým nebyl nalezen.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;
  const ip = getClientIp(req);

  // Mint scoped impersonation token
  const accessToken = createImpersonationToken(team.id, team.name, admin.username);
  const refreshToken = createRefreshToken();

  const tokenRecord = {
    teamId: team.id,
    isImpersonated: true,
    impersonatedBy: admin.username,
    createdAt: new Date().toISOString(),
  };

  await redis.set(`refreshtoken:${refreshToken}`, JSON.stringify(tokenRecord), {
    ex: IMPERSONATION_REFRESH_TTL_SECONDS,
  });
  await redis.sadd(`team:${team.id}:refresh_tokens`, refreshToken);

  await recordAuditLog({
    action: 'IMPERSONATION_START',
    adminUser: admin.username,
    targetTeamId: team.id,
    targetTeamName: team.name,
    ip,
  });

  return res.status(200).json({
    team: {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt,
    },
    accessToken,
    refreshToken,
    isImpersonated: true,
  });
}

async function handleResetTeamPassword(req: ApiRequest, res: ApiResponse) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: 'Neautorizováno. Vyžadováno přihlášení správce.' });
  }

  const body = getParsedBody(req);
  const { teamId, newPassword } = body || {};
  if (!teamId || !newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 3) {
    return res.status(400).json({ error: 'Zadejte ID týmu a nové heslo (min. 3 znaky).' });
  }

  const rawTeam: any = await redis.get(`team:${teamId}`);
  if (!rawTeam) {
    return res.status(404).json({ error: 'Tým nebyl nalezen.' });
  }

  const team = typeof rawTeam === 'string' ? JSON.parse(rawTeam) : rawTeam;
  team.passwordHash = hashPassword(newPassword.trim());

  await redis.set(`team:${teamId}`, JSON.stringify(team));

  const ip = getClientIp(req);
  await recordAuditLog({
    action: 'RESET_TEAM_PASSWORD',
    adminUser: admin.username,
    targetTeamId: team.id,
    targetTeamName: team.name,
    ip,
  });

  return res.status(200).json({
    success: true,
    message: `Heslo pro tým "${team.name}" bylo úspěšně změněno.`,
  });
}
