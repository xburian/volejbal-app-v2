import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';
import { getAuthTeam } from './_utils/auth.js';

const redis = new Redis({
  url: process.env.volejbal_KV_REST_API_URL!,
  token: process.env.volejbal_KV_REST_API_TOKEN!,
});

const DEFAULT_TEAM_ID = 'team-nahravame-si';
const MAX_BATCH_SIZE = 26;

/** Allowed sport types — anything else falls back to 'volejbal' */
const VALID_SPORT_TYPES = ['volejbal', 'tenis', 'badminton'] as const;

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
        return await handleGet(res, teamId);
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
    console.error('API /api/events error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/events — list all events for team with hydrated participants
async function handleGet(res: ApiResponse, teamId: string) {
  let eventIds = await redis.smembers(`team:${teamId}:events`);

  // Backward compatibility fallback for default team
  if ((!eventIds || eventIds.length === 0) && teamId === DEFAULT_TEAM_ID) {
    eventIds = await redis.smembers('events:all');
    if (eventIds && eventIds.length > 0) {
      await redis.sadd(`team:${teamId}:events`, eventIds[0], ...eventIds.slice(1));
    }
  }

  if (!eventIds || eventIds.length === 0) {
    return res.status(200).json([]);
  }

  const eventPipeline = redis.pipeline();
  for (const id of eventIds) {
    eventPipeline.get(`event:${id}`);
  }
  const rawEvents = (await eventPipeline.exec()).filter(Boolean).map(parseJson);

  // Fetch users of this team for name resolution
  let userIds = await redis.smembers(`team:${teamId}:users`);
  if ((!userIds || userIds.length === 0) && teamId === DEFAULT_TEAM_ID) {
    userIds = await redis.smembers('users:all');
  }

  const usersMap: Record<string, any> = {};
  if (userIds && userIds.length > 0) {
    const userPipeline = redis.pipeline();
    for (const id of userIds) {
      userPipeline.get(`user:${id}`);
    }
    const users = (await userPipeline.exec()).filter(Boolean).map(parseJson);
    for (const u of users) {
      usersMap[u.id] = u;
    }
  }

  // Hydrate each event with participants
  const hydratedEvents = await Promise.all(
    rawEvents.map(async (event: any) => {
      const attendanceCompositeKeys = await redis.smembers(`attendance:event:${event.id}`);
      let participants: any[] = [];

      if (attendanceCompositeKeys && attendanceCompositeKeys.length > 0) {
        const attPipeline = redis.pipeline();
        for (const key of attendanceCompositeKeys) {
          attPipeline.get(`attendance:${key}`);
        }
        const attendanceRecords = (await attPipeline.exec()).filter(Boolean).map(parseJson);

        participants = attendanceRecords.map((record: any) => {
          const user = usersMap[record.userId];
          return {
            userId: record.userId,
            name: user ? user.name : 'Neznámý',
            photoUrl: user?.photoUrl,
            status: record.status,
            hasPaid: record.hasPaid,
          };
        });
      }

      const rawType = event.sportType ?? 'volejbal';
      const sportType = VALID_SPORT_TYPES.includes(rawType) ? rawType : 'volejbal';
      return { ...event, participants, sportType, teamId: event.teamId || teamId };
    })
  );

  return res.status(200).json(hydratedEvents);
}

// POST /api/events or /api/events-batch — create event(s) for team
async function handlePost(req: ApiRequest, res: ApiResponse, teamId: string) {
  if (req.body?.events || Array.isArray(req.body) || (req.url && req.url.includes('events-batch'))) {
    return await handleBatchPost(req, res, teamId);
  }

  const { participants: _participants, ...eventData } = req.body || {};

  if (!eventData.id) {
    eventData.id = generateId();
  }

  eventData.teamId = teamId;

  // Normalize invalid sport types to 'volejbal'
  if (eventData.sportType && !VALID_SPORT_TYPES.includes(eventData.sportType)) {
    eventData.sportType = 'volejbal';
  }

  await redis.set(`event:${eventData.id}`, JSON.stringify(eventData));
  await redis.sadd(`team:${teamId}:events`, eventData.id);
  await redis.sadd('events:all', eventData.id);

  return res.status(201).json({ success: true, id: eventData.id });
}

// POST /api/events (batch mode) — create multiple events in an atomic pipeline
async function handleBatchPost(req: ApiRequest, res: ApiResponse, teamId: string) {
  const events = req.body?.events || (Array.isArray(req.body) ? req.body : null);

  // Validation
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Request body must contain an "events" array' });
  }

  if (events.length === 0) {
    return res.status(400).json({ error: 'Events array must not be empty' });
  }

  if (events.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} events`,
      maxAllowed: MAX_BATCH_SIZE,
      received: events.length,
    });
  }

  // Normalize and validate each event
  const normalizedEvents: any[] = [];
  for (const event of events) {
    const { participants: _participants, ...eventData } = event;

    if (!eventData.id) {
      eventData.id = generateId();
    }

    eventData.teamId = teamId;

    // Normalize invalid sport types
    if (eventData.sportType && !VALID_SPORT_TYPES.includes(eventData.sportType)) {
      eventData.sportType = 'volejbal';
    }

    normalizedEvents.push(eventData);
  }

  // Atomic pipeline — all or nothing
  const pipeline = redis.pipeline();
  const ids: string[] = [];

  for (const eventData of normalizedEvents) {
    pipeline.set(`event:${eventData.id}`, JSON.stringify(eventData));
    pipeline.sadd(`team:${teamId}:events`, eventData.id);
    pipeline.sadd('events:all', eventData.id);
    ids.push(eventData.id);
  }

  await pipeline.exec();

  return res.status(201).json({ success: true, ids, count: ids.length });
}

// PUT /api/events — update event
async function handlePut(req: ApiRequest, res: ApiResponse, teamId: string) {
  const { participants: _participants, ...eventData } = req.body;

  if (!eventData.id) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  const existing: any = await redis.get(`event:${eventData.id}`);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const parsed = parseJson(existing);

  // Verify ownership
  const isTeamEvent = await redis.sismember(`team:${teamId}:events`, eventData.id);
  if (!isTeamEvent && parsed.teamId && parsed.teamId !== teamId) {
    return res.status(403).json({ error: 'Tato událost nepatří do vašeho týmu.' });
  }

  const updated = { ...parsed, ...eventData, teamId: parsed.teamId || teamId };

  // Remove keys explicitly set to null (e.g. winningTeam cleared between rounds)
  for (const key of Object.keys(updated)) {
    if (updated[key] === null) {
      delete updated[key];
    }
  }

  await redis.set(`event:${eventData.id}`, JSON.stringify(updated));
  return res.status(200).json({ success: true });
}

// DELETE /api/events?id=xxx — delete event + cascade attendance
async function handleDelete(req: ApiRequest, res: ApiResponse, teamId: string) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // 1. Delete event from sets and keys
  await redis.del(`event:${id}`);
  await redis.srem(`team:${teamId}:events`, id);
  await redis.srem('events:all', id);

  // 2. Cascade delete attendance records for this event
  const attendanceKeys = await redis.smembers(`attendance:event:${id}`);
  if (attendanceKeys && attendanceKeys.length > 0) {
    const pipeline = redis.pipeline();
    for (const key of attendanceKeys) {
      // key format: "eventId_userId" — extract userId
      const userId = (key as string).replace(`${id}_`, '');
      pipeline.del(`attendance:${key}`);
      pipeline.srem(`attendance:user:${userId}`, key);
    }
    await pipeline.exec();
  }
  await redis.del(`attendance:event:${id}`);

  return res.status(200).json({ success: true });
}

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function parseJson(val: any): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}
