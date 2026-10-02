import crypto from 'node:crypto';

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.volejbal_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    'fallback-dev-secret-do-not-use-in-production'
  );
}

/**
 * Hash password using Node's native scrypt with a random 16-byte salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.normalize(), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against stored salt:hash using timingSafeEqual
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password.normalize(), salt, 64).toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyBuffer = Buffer.from(verifyHash, 'hex');
    if (hashBuffer.length !== verifyBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, verifyBuffer);
  } catch {
    return false;
  }
}

/**
 * Create a stateless HMAC-SHA256 signed access token (valid for 2 hours)
 */
export function createAccessToken(payload: { teamId: string; teamName: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (2 * 60 * 60); // 2 hours
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify an access token and extract team payload
 */
export function verifyAccessToken(token: string): { teamId: string; teamName: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!data.teamId || !data.teamName) {
      return null;
    }
    return { teamId: data.teamId, teamName: data.teamName };
  } catch {
    return null;
  }
}

/**
 * Create a cryptographically secure random refresh token (32 bytes / 64 hex characters)
 */
export function createRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extract and verify bearer token from Authorization header
 */
export function getAuthTeam(req: any): { teamId: string; teamName: string } | null {
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyAccessToken(token);
}

/**
 * Safely extract client IP from request (x-forwarded-for on Vercel)
 */
export function getClientIp(req: any): string {
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const ip = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
    return ip.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Sliding rate limit in Redis for auth requests (default: max 10 failed attempts / 60 seconds)
 */
export async function checkRateLimit(redis: any, ip: string, limit = 10, windowSeconds = 60): Promise<boolean> {
  try {
    const key = `ratelimit:auth:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch {
    return true; // Fail open if Redis temporary issue
  }
}
