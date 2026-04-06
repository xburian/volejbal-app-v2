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

/** Allowed sport types — anything else (e.g. fotbal, florbal) is rejected */
const VALID_SPORT_TYPES = ['volejbal', 'tenis', 'badminton'] as const;

const DEFAULT_SPORT_CONFIGS = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Tenisový kurt', teamSize: 2 },
  { type: 'badminton', label: 'Badminton', maxPlayers: 4, defaultCost: 400, defaultLocation: 'Sportovní centrum', teamSize: 2 },
];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(res);
      case 'PUT':
        return await handlePut(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/sport-configs error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGet(res: ApiResponse) {
  const existing: any = await redis.get('sportconfigs');
  if (existing) {
    const parsed: any[] = typeof existing === 'string' ? JSON.parse(existing) : existing;
    // Strip out any sport types not in the allow-list
    const filtered = parsed.filter((c: any) => VALID_SPORT_TYPES.includes(c.type));
    return res.status(200).json(filtered);
  }

  // Seed defaults on first read
  await redis.set('sportconfigs', JSON.stringify(DEFAULT_SPORT_CONFIGS));
  return res.status(200).json(DEFAULT_SPORT_CONFIGS);
}

async function handlePut(req: ApiRequest, res: ApiResponse) {
  const configs = req.body;
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: 'Body must be an array of sport configs' });
  }
  // Only persist configs whose type is in the allow-list
  const validConfigs = configs.filter((c: any) => VALID_SPORT_TYPES.includes(c.type));
  await redis.set('sportconfigs', JSON.stringify(validConfigs));
  return res.status(200).json(validConfigs);
}

