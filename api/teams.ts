import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import {
  hashPassword,
  createAccessToken,
  createRefreshToken,
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

export const DEFAULT_TEAM_ID = 'team-nahravame-si';
export const DEFAULT_TEAM_NAME = 'nahravame-si';
export const DEFAULT_TEAM_INITIAL_PASSWORD = '1234';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/teams error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/teams — list public team info
async function handleGet(res: ApiResponse) {
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

// POST /api/teams — create a new team { name, password }
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { name, password } = req.body || {};

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

  // Check if users:all exists and need to be mirrored to team-nahravame-si:users
  const userCount = await redis.scard(`team:${DEFAULT_TEAM_ID}:users`);
  if (userCount === 0) {
    const legacyUserIds = await redis.smembers('users:all');
    if (legacyUserIds && legacyUserIds.length > 0) {
      await redis.sadd(`team:${DEFAULT_TEAM_ID}:users`, legacyUserIds[0], ...legacyUserIds.slice(1));
    }
  }

  // Check if events:all exists and need to be mirrored to team-nahravame-si:events
  const eventCount = await redis.scard(`team:${DEFAULT_TEAM_ID}:events`);
  if (eventCount === 0) {
    const legacyEventIds = await redis.smembers('events:all');
    if (legacyEventIds && legacyEventIds.length > 0) {
      await redis.sadd(`team:${DEFAULT_TEAM_ID}:events`, legacyEventIds[0], ...legacyEventIds.slice(1));
    }
  }
}
