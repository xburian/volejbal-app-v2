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
        return await handleGet(res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/bank-accounts error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/bank-accounts — list all user bank accounts
async function handleGet(res: ApiResponse) {
  const userAccountIds = await redis.smembers('bankaccounts:users');
  if (!userAccountIds || userAccountIds.length === 0) {
    return res.status(200).json([]);
  }

  const pipeline = redis.pipeline();
  for (const userId of userAccountIds) {
    pipeline.get(`bankaccount:user:${userId}`);
  }
  const results = await pipeline.exec();

  const accounts = results
    .filter(Boolean)
    .map((r: any) => parseJson(r));

  // Sort by ownerName
  accounts.sort((a: any, b: any) =>
    (a.ownerName || '').localeCompare(b.ownerName || '', 'cs')
  );

  return res.status(200).json(accounts);
}

// POST /api/bank-accounts — create personal bank account { ownerName, accountNumber, userId }
async function handlePost(req: ApiRequest, res: ApiResponse) {
  const { ownerName, accountNumber, userId } = req.body;

  if (!ownerName || !ownerName.trim()) {
    return res.status(400).json({ error: 'Jméno vlastníka je povinné.' });
  }
  if (!accountNumber || !accountNumber.trim()) {
    return res.status(400).json({ error: 'Číslo účtu je povinné.' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId je povinné.' });
  }

  // Check if user already has a bank account
  const existing = await redis.get(`bankaccount:user:${userId}`);
  if (existing) {
    return res.status(409).json({ error: 'Již máte nastavený bankovní účet.' });
  }

  const id = generateId();
  const account = {
    id,
    ownerName: ownerName.trim(),
    accountNumber: accountNumber.trim(),
    userId,
  };
  await redis.set(`bankaccount:user:${userId}`, JSON.stringify(account));
  await redis.sadd('bankaccounts:users', userId);
  return res.status(201).json(account);
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

