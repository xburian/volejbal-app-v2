import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import { getAuthTeam } from './_utils/auth.js';

const redis = new Redis({
  url: process.env.volejbal_KV_REST_API_URL!,
  token: process.env.volejbal_KV_REST_API_TOKEN!,
});

const DEFAULT_TEAM_ID = 'team-nahravame-si';

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const authTeam = getAuthTeam(req);
    if (!authTeam) {
      return res.status(401).json({ error: 'Neautorizováno. Přihlaste se prosím k týmu.' });
    }

    const teamId = authTeam.teamId;

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, teamId);
      case 'POST':
        return await handlePost(req, res, teamId);
      case 'PUT':
        return await handlePut(req, res, teamId);
      case 'DELETE':
        return await handleDelete(req, res, teamId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/users — list users for team (sorted, with lightweight photo URLs)
async function handleGet(req: ApiRequest, res: ApiResponse, teamId: string) {
  let userIds = await redis.smembers(`team:${teamId}:users`);

  // Backward compatibility fallback for default team
  if ((!userIds || userIds.length === 0) && teamId === DEFAULT_TEAM_ID) {
    userIds = await redis.smembers('users:all');
    if (userIds && userIds.length > 0) {
      await redis.sadd(`team:${teamId}:users`, userIds[0], ...userIds.slice(1));
    }
  }

  if (!userIds || userIds.length === 0) {
    return res.status(200).json([]);
  }

  const pipeline = redis.pipeline();
  for (const id of userIds) {
    pipeline.get(`user:${id}`);
  }
  const results = await pipeline.exec();

  const users = results.filter(Boolean).map((r: any) => parseJson(r));

  // Lazy migration: extract any remaining base64 photos into separate keys
  const migrationPipeline = redis.pipeline();
  let hasMigrations = false;

  for (const user of users) {
    if (user.photoUrl && user.photoUrl.startsWith('data:')) {
      migrationPipeline.set(`photo:${user.id}`, user.photoUrl);
      user.photoUrl = `/api/photos?id=${user.id}&v=${Date.now()}`;
      migrationPipeline.set(`user:${user.id}`, JSON.stringify(user));
      hasMigrations = true;
    }
  }

  if (hasMigrations) {
    await migrationPipeline.exec();
  }

  // Sort alphabetically by name (Czech locale, diacritics-normalized)
  users.sort((a: any, b: any) => {
    const na = normalizeString(a.name);
    const nb = normalizeString(b.name);
    return na.localeCompare(nb, 'cs');
  });

  // Optional search filter
  const search = (req.query?.search as string) || '';
  if (search.trim()) {
    const normalizedSearch = normalizeString(search.trim());
    const filtered = users.filter((u: any) => normalizeString(u.name).includes(normalizedSearch));
    return res.status(200).json(filtered);
  }

  return res.status(200).json(users);
}

// POST /api/users — create user { name, photoUrl? }
async function handlePost(req: ApiRequest, res: ApiResponse, teamId: string) {
  const { id, name, photoUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Check for duplicate name WITHIN the team
  const existingUsers = await getTeamUsers(teamId);
  if (existingUsers.some((u: any) => u.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Hráč s tímto jménem v týmu již existuje.' });
  }

  const newUser: any = {
    id: id || generateId(),
    name: name.trim(),
    teamId,
  };

  // If photoUrl is base64, store separately and use a lightweight URL
  if (photoUrl && photoUrl.startsWith('data:')) {
    await redis.set(`photo:${newUser.id}`, photoUrl);
    newUser.photoUrl = `/api/photos?id=${newUser.id}&v=${Date.now()}`;
  } else if (photoUrl) {
    newUser.photoUrl = photoUrl;
  }

  await redis.set(`user:${newUser.id}`, JSON.stringify(newUser));
  await redis.sadd(`team:${teamId}:users`, newUser.id);
  await redis.sadd('users:all', newUser.id);

  return res.status(201).json(newUser);
}

// PUT /api/users — update user { id, ...updates }
async function handlePut(req: ApiRequest, res: ApiResponse, teamId: string) {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const existing: any = await redis.get(`user:${id}`);
  if (!existing) {
    return res.status(404).json({ error: 'Uživatel nenalezen.' });
  }

  const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;

  // Verify user belongs to this team
  const isMember = await redis.sismember(`team:${teamId}:users`, id);
  if (!isMember && parsed.teamId && parsed.teamId !== teamId) {
    return res.status(403).json({ error: 'Tento uživatel nepatří do vašeho týmu.' });
  }

  const updatedUser = { ...parsed, ...updates, teamId: parsed.teamId || teamId };

  await redis.set(`user:${id}`, JSON.stringify(updatedUser));
  return res.status(200).json(updatedUser);
}

// DELETE /api/users?id=xxx — delete user + cascade attendance
async function handleDelete(req: ApiRequest, res: ApiResponse, teamId: string) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // 1. Delete user from Redis sets
  await redis.del(`user:${id}`);
  await redis.srem(`team:${teamId}:users`, id);
  await redis.srem('users:all', id);

  // 2. Delete user's photo
  await redis.del(`photo:${id}`);

  // 3. Cascade delete attendance records for this user
  const attendanceKeys = await redis.smembers(`attendance:user:${id}`);
  if (attendanceKeys && attendanceKeys.length > 0) {
    const pipeline = redis.pipeline();
    for (const key of attendanceKeys) {
      // key format: "eventId_userId" — extract eventId
      const eventId = (key as string).replace(`_${id}`, '');
      pipeline.del(`attendance:${key}`);
      pipeline.srem(`attendance:event:${eventId}`, key);
    }
    await pipeline.exec();
  }
  await redis.del(`attendance:user:${id}`);

  // 4. Cascade delete bank account if configured
  await redis.del(`bankaccount:user:${id}`);
  await redis.srem('bankaccounts:users', id);

  return res.status(200).json({ success: true });
}

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseJson(val: any): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

async function getTeamUsers(teamId: string): Promise<any[]> {
  const userIds = await redis.smembers(`team:${teamId}:users`);
  if (!userIds || userIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of userIds) {
    pipeline.get(`user:${id}`);
  }
  const results = await pipeline.exec();
  return results.filter(Boolean).map((r: any) => typeof r === 'string' ? JSON.parse(r) : r);
}
