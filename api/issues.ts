import type { IncomingMessage, ServerResponse } from 'node:http';
import { redis } from './_utils/redis.js';

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
    console.error('API /api/issues error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/issues — list all issues
async function handleGet(res: ApiResponse) {
  const issueIds = await redis.smembers('issues:all');
  if (!issueIds || issueIds.length === 0) {
    return res.status(200).json([]);
  }

  const pipeline = redis.pipeline();
  for (const id of issueIds) {
    pipeline.get(`issue:${id}`);
  }
  const results = await pipeline.exec();

  const issues = results
    .map((r: any) => {
      if (!r) return null;
      return typeof r === 'string' ? JSON.parse(r) : r;
    })
    .filter(Boolean);

  // Sort by createdAt descending (newest first)
  issues.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.status(200).json(issues);
}

// POST /api/issues — create a new issue
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { id, title, description, tag, authorId, authorName } = req.body;

  if (!id || !title || !tag || !authorId || !authorName) {
    return res.status(400).json({ error: 'Missing required fields: id, title, tag, authorId, authorName' });
  }

  if (!['bug', 'feature'].includes(tag)) {
    return res.status(400).json({ error: 'Invalid tag. Must be "bug" or "feature".' });
  }

  const now = new Date().toISOString();
  const issue = {
    id,
    title: title.trim(),
    description: (description || '').trim(),
    tag,
    status: 'todo',
    authorId,
    authorName,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(`issue:${id}`, JSON.stringify(issue));
  await redis.sadd('issues:all', id);

  return res.status(201).json(issue);
}

// PUT /api/issues — update an issue (status, title, description)
async function handlePut(req: ApiRequest, res: ApiResponse) {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }

  const existing: any = await redis.get(`issue:${id}`);
  if (!existing) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;

  if (updates.status && !['todo', 'in_progress', 'done'].includes(updates.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updated = {
    ...parsed,
    ...updates,
    id, // prevent id override
    updatedAt: new Date().toISOString(),
  };

  await redis.set(`issue:${id}`, JSON.stringify(updated));

  return res.status(200).json(updated);
}

// DELETE /api/issues?id=xxx — delete an issue
async function handleDelete(req: ApiRequest, res: ApiResponse) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'Missing required query param: id' });
  }

  await redis.del(`issue:${id}`);
  await redis.srem('issues:all', id);

  return res.status(200).json({ success: true });
}
