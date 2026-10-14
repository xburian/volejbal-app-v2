import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from './_utils/redis.js';
import { getAuthTeam } from './_utils/auth.js';

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

    const rawEvent = await redis.get(`event:${eventId}`);
    const event = rawEvent ? (typeof rawEvent === 'string' ? JSON.parse(rawEvent) : rawEvent) : null;

    const attendanceKeys = (await redis.smembers(`attendance:event:${eventId}`)) || [];
    const isCompacted = Boolean(event?.isCompacted || (event?.participants?.length > 0 && attendanceKeys.length === 0));

    if (isCompacted && event) {
      // Event is compacted — update embedded participant directly in event object
      let found = false;
      const updatedParticipants = (event.participants || []).map((p: any) => {
        if (p.userId === userId) {
          found = true;
          return {
            ...p,
            status,
            hasPaid: hasPaid ?? p.hasPaid ?? false,
          };
        }
        return p;
      });

      if (!found) {
        const rawUser = await redis.get(`user:${userId}`);
        const user = rawUser ? (typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser) : null;
        updatedParticipants.push({
          userId,
          name: user ? user.name : 'Neznámý',
          photoUrl: user?.photoUrl,
          status,
          hasPaid: hasPaid ?? false,
        });
      }

      event.participants = updatedParticipants;
      await redis.set(`event:${eventId}`, JSON.stringify(event));
      await redis.del(`team:${authTeam.teamId}:stats`);

      return res.status(200).json({ success: true, compacted: true });
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
    await redis.del(`team:${authTeam.teamId}:stats`);

    return res.status(200).json({ success: true, compacted: false });
  } catch (error: any) {
    console.error('API /api/attendance error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
