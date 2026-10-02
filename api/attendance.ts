import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import { getAuthTeam } from './_utils/auth.js';

const redis = new Redis({
  url: (process.env.volejbal_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)!,
  token: (process.env.volejbal_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)!,
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
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed. Use PUT.' });
    }

    const authTeam = getAuthTeam(req);
    if (!authTeam) {
      return res.status(401).json({ error: 'Neautorizováno. Přihlaste se prosím k týmu.' });
    }

    const { eventId, userId, status, hasPaid } = req.body;

    if (!eventId || !userId || !status) {
      return res.status(400).json({ error: 'eventId, userId, and status are required' });
    }

    const compositeKey = `${eventId}_${userId}`;

    // Get existing record for merge
    const existing: any = await redis.get(`attendance:${compositeKey}`);
    const parsed = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : {};

    const record = {
      eventId,
      userId,
      status,
      hasPaid: hasPaid ?? parsed.hasPaid ?? false,
      timestamp: Date.now(),
    };

    // Store the attendance record
    await redis.set(`attendance:${compositeKey}`, JSON.stringify(record));

    // Maintain index sets for efficient lookups
    await redis.sadd(`attendance:event:${eventId}`, compositeKey);
    await redis.sadd(`attendance:user:${userId}`, compositeKey);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('API /api/attendance error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
