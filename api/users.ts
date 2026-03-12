import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';

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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/users — list all users (sorted, with lightweight photo URLs)
async function handleGet(req: ApiRequest, res: ApiResponse) {
  const userIds = await redis.smembers('users:all');
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
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { id, name, photoUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Check for duplicate name
  const existingUsers = await getAllUsers();
  if (existingUsers.some((u: any) => u.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Uživatel s tímto jménem již existuje.' });
  }

  const newUser: any = {
    id: id || generateId(),
    name: name.trim(),
  };

  // If photoUrl is base64, store separately and use a lightweight URL
  if (photoUrl && photoUrl.startsWith('data:')) {
    await redis.set(`photo:${newUser.id}`, photoUrl);
    newUser.photoUrl = `/api/photos?id=${newUser.id}&v=${Date.now()}`;
  } else if (photoUrl) {
    newUser.photoUrl = photoUrl;
  }

  await redis.set(`user:${newUser.id}`, JSON.stringify(newUser));
  await redis.sadd('users:all', newUser.id);

  return res.status(201).json(newUser);
}

// PUT /api/users — update user { id, ...updates }
async function handlePut(req: ApiRequest, res: ApiResponse) {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const existing: any = await redis.get(`user:${id}`);
  if (!existing) {
    return res.status(404).json({ error: 'Uživatel nenalezen.' });
  }

  const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
  const updatedUser = { ...parsed, ...updates };

  await redis.set(`user:${id}`, JSON.stringify(updatedUser));
  return res.status(200).json(updatedUser);
}

// DELETE /api/users?id=xxx — delete user + cascade attendance
async function handleDelete(req: ApiRequest, res: ApiResponse) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // 1. Delete user
  await redis.del(`user:${id}`);
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

async function getAllUsers(): Promise<any[]> {
  const userIds = await redis.smembers('users:all');
  if (!userIds || userIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of userIds) {
    pipeline.get(`user:${id}`);
  }
  const results = await pipeline.exec();
  return results.filter(Boolean).map((r: any) => typeof r === 'string' ? JSON.parse(r) : r);
}

