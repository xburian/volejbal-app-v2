import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from './_utils/redis.js';
import { getAuthTeam } from './_utils/auth.js';
import { computeTeamCompactedStats, withTeamLock } from './_utils/compactor.js';

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

const RECOMPUTE_RATE_LIMIT_SECONDS = 30;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const authTeam = getAuthTeam(req);
    if (!authTeam) {
      return res.status(401).json({ error: 'Neautorizováno. Přihlaste se prosím k týmu.' });
    }

    const teamId = authTeam.teamId;

    switch (req.method) {
      case 'GET': {
        const forceRefresh = req.query?.refresh === 'true';

        if (!forceRefresh) {
          const cachedRaw: any = await redis.get(`team:${teamId}:stats`);
          if (cachedRaw) {
            const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
            return res.status(200).json(cached);
          }
        }

        // Snapshot not cached yet or forced refresh requested
        const stats = await withTeamLock(teamId, () => computeTeamCompactedStats(teamId));
        return res.status(200).json(stats);
      }

      case 'POST': {
        // Manual on-demand recomputation with rate-limiting
        const rateLimitKey = `ratelimit:stats:${teamId}`;
        const isLimited = await redis.get(rateLimitKey);

        if (isLimited) {
          const ttl = await redis.ttl(rateLimitKey);
          return res.status(429).json({
            error: `Statistiky byly nedávno přepočteny. Další přepočet bude možný za ${Math.max(ttl, 1)} sekund.`,
          });
        }

        const stats = await withTeamLock(teamId, () => computeTeamCompactedStats(teamId));

        // Set rate limit cooldown
        await redis.set(rateLimitKey, '1', { ex: RECOMPUTE_RATE_LIMIT_SECONDS });

        return res.status(200).json({ success: true, stats });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    }
  } catch (error: any) {
    console.error('API /api/stats error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
