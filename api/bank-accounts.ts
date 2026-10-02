import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAuthTeam } from './_utils/auth.js';
import { redis } from './_utils/redis.js';

const DEFAULT_TEAM_ID = 'team-nahravame-si';

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
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API /api/bank-accounts error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/bank-accounts — list bank accounts belonging to this team's members
async function handleGet(res: ApiResponse, teamId: string) {
  let teamUserIds = await redis.smembers(`team:${teamId}:users`);
  if ((!teamUserIds || teamUserIds.length === 0) && teamId === DEFAULT_TEAM_ID) {
    teamUserIds = await redis.smembers('users:all');
  }

  if (!teamUserIds || teamUserIds.length === 0) {
    return res.status(200).json([]);
  }

  const allAccountUserIds = await redis.smembers('bankaccounts:users');
  if (!allAccountUserIds || allAccountUserIds.length === 0) {
    return res.status(200).json([]);
  }

  // Filter to only users who are in this team
  const relevantUserIds = allAccountUserIds.filter(userId => teamUserIds.includes(userId));
  if (relevantUserIds.length === 0) {
    return res.status(200).json([]);
  }

  const pipeline = redis.pipeline();
  for (const userId of relevantUserIds) {
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
async function handlePost(req: ApiRequest, res: ApiResponse, teamId: string) {
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

  // Verify user belongs to this team
  const isMember = await redis.sismember(`team:${teamId}:users`, userId);
  if (!isMember && teamId !== DEFAULT_TEAM_ID) {
    return res.status(403).json({ error: 'Uživatel nepatří do vašeho týmu.' });
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
