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
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/photos error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/photos?id=userId — serve photo as raw image
async function handleGet(req: ApiRequest, res: ApiResponse) {
  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const photoData: string | null = await redis.get(`photo:${id}`);
  if (!photoData) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // photoData is a base64 data URL like "data:image/jpeg;base64,/9j/4AAQ..."
  const match = photoData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return res.status(500).json({ error: 'Invalid photo data format' });
  }

  const contentType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buffer.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.end(buffer);
}

// POST /api/photos — store photo { userId, photoBase64 }
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { userId, photoBase64 } = req.body;

  if (!userId || !photoBase64) {
    return res.status(400).json({ error: 'userId and photoBase64 are required' });
  }

  // Store photo in its own Redis key
  await redis.set(`photo:${userId}`, photoBase64);

  // Build a cache-busted URL
  const photoUrl = `/api/photos?id=${userId}&v=${Date.now()}`;

  // Also update the user's photoUrl field to the lightweight URL
  const existing: any = await redis.get(`user:${userId}`);
  if (existing) {
    const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
    parsed.photoUrl = photoUrl;
    await redis.set(`user:${userId}`, JSON.stringify(parsed));
  }

  return res.status(200).json({ photoUrl });
}

// DELETE /api/photos?id=userId — remove photo
async function handleDelete(req: ApiRequest, res: ApiResponse) {
  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  await redis.del(`photo:${id}`);

  // Also clear photoUrl from user object
  const existing: any = await redis.get(`user:${id}`);
  if (existing) {
    const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
    delete parsed.photoUrl;
    await redis.set(`user:${id}`, JSON.stringify(parsed));
  }

  return res.status(200).json({ success: true });
}

