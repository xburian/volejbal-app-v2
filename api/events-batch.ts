import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.volejbal_KV_REST_API_URL!,
  token: process.env.volejbal_KV_REST_API_TOKEN!,
});

/** Allowed sport types — anything else falls back to 'volejbal' */
const VALID_SPORT_TYPES = ['volejbal', 'tenis', 'badminton'] as const;

const MAX_BATCH_SIZE = 26;

interface ApiRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: any): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { events } = req.body;

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
      const { participants, ...eventData } = event;

      if (!eventData.id) {
        eventData.id = generateId();
      }

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
      pipeline.sadd('events:all', eventData.id);
      ids.push(eventData.id);
    }

    await pipeline.exec();

    return res.status(201).json({ success: true, ids, count: ids.length });
  } catch (error: any) {
    console.error('API /api/events-batch error:', error);
    return res.status(500).json({
      error: 'Batch creation failed',
      detail: error.message || 'Internal server error',
    });
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

