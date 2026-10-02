import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import { getAuthTeam } from './_utils/auth.js';

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

/** Allowed sport types — anything else (e.g. fotbal, florbal) is rejected */
const VALID_SPORT_TYPES = ['volejbal', 'tenis', 'badminton'] as const;

const DEFAULT_SPORT_CONFIGS = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Tenisový kurt', teamSize: 2 },
  { type: 'badminton', label: 'Badminton', maxPlayers: 4, defaultCost: 400, defaultLocation: 'Sportovní centrum', teamSize: 2 },
];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const authTeam = getAuthTeam(req);
    if (!authTeam) {
      return res.status(401).json({ error: 'Neautorizováno. Přihlaste se prosím k týmu.' });
    }

    const teamId = authTeam.teamId;

    switch (req.method) {
      case 'GET':
        return await handleGet(res, teamId);
      case 'PUT':
        return await handlePut(req, res, teamId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/sport-configs error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGet(res: ApiResponse, teamId: string) {
  // Check team-scoped configs first
  const teamConfigs: any = await redis.get(`team:${teamId}:sportconfigs`);
  if (teamConfigs) {
    const parsed: any[] = typeof teamConfigs === 'string' ? JSON.parse(teamConfigs) : teamConfigs;
    const filtered = parsed.filter((c: any) => VALID_SPORT_TYPES.includes(c.type));
    return res.status(200).json(filtered);
  }

  // Fallback to legacy global configs
  const globalConfigs: any = await redis.get('sportconfigs');
  if (globalConfigs) {
    const parsed: any[] = typeof globalConfigs === 'string' ? JSON.parse(globalConfigs) : globalConfigs;
    const filtered = parsed.filter((c: any) => VALID_SPORT_TYPES.includes(c.type));
    return res.status(200).json(filtered);
  }

  // Default fallback
  return res.status(200).json(DEFAULT_SPORT_CONFIGS);
}

async function handlePut(req: ApiRequest, res: ApiResponse, teamId: string) {
  const configs = req.body;
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: 'Body must be an array of sport configs' });
  }
  // Only persist configs whose type is in the allow-list
  const validConfigs = configs.filter((c: any) => VALID_SPORT_TYPES.includes(c.type));
  await redis.set(`team:${teamId}:sportconfigs`, JSON.stringify(validConfigs));
  return res.status(200).json(validConfigs);
}
