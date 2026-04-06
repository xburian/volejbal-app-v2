import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.volejbal_KV_REST_API_URL!,
  token: process.env.volejbal_KV_REST_API_TOKEN!,
});

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
    switch (req.method) {
      case 'GET':
        return await handleGet(res);
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
    console.error('API /api/events error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/events — list all events with hydrated participants
async function handleGet(res: ApiResponse) {
  // Fetch raw events
  const eventIds = await redis.smembers('events:all');
  if (!eventIds || eventIds.length === 0) {
    return res.status(200).json([]);
  }

  const eventPipeline = redis.pipeline();
  for (const id of eventIds) {
    eventPipeline.get(`event:${id}`);
  }
  const rawEvents = (await eventPipeline.exec()).filter(Boolean).map(parseJson);

  // Fetch all users for name resolution
  const userIds = await redis.smembers('users:all');
  let usersMap: Record<string, any> = {};
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
      return { ...event, participants, sportType };
    })
  );

  return res.status(200).json(hydratedEvents);
}

// POST /api/events — create event
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { participants, ...eventData } = req.body;

  if (!eventData.id) {
    eventData.id = generateId();
  }

  // Normalize invalid sport types to 'volejbal'
  if (eventData.sportType && !VALID_SPORT_TYPES.includes(eventData.sportType)) {
    eventData.sportType = 'volejbal';
  }

  await redis.set(`event:${eventData.id}`, JSON.stringify(eventData));
  await redis.sadd('events:all', eventData.id);

  return res.status(201).json({ success: true, id: eventData.id });
}

// PUT /api/events — update event
async function handlePut(req: ApiRequest, res: ApiResponse) {
  const { participants, ...eventData } = req.body;

  if (!eventData.id) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  const existing: any = await redis.get(`event:${eventData.id}`);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const parsed = parseJson(existing);
  const updated = { ...parsed, ...eventData };

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
async function handleDelete(req: ApiRequest, res: ApiResponse) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // 1. Delete event
  await redis.del(`event:${id}`);
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

