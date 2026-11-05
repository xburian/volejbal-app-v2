import crypto from 'node:crypto';

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.VOLEJBAL_KV_REST_API_TOKEN ||
    process.env.volejbal_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    'fallback-dev-secret-do-not-use-in-production'
  );
}

function getAdminSecret(): string {
  return (
    process.env.ADMIN_AUTH_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    getSecret()
  );
}

const DUMMY_SALT = 'e3b0c44298fc1c149afbf4c8996fb924';
const DUMMY_HASH = `${DUMMY_SALT}:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad1d592652da0e25b736b4923e20e8a7d6d5ef621f8a85702b85e054452097987b`;

/**
 * Constant-time admin credential verification with dummy scrypt burn
 */
export function verifyAdminCredentials(suppliedUser: string, suppliedPass: string): boolean {
  if (!suppliedUser || !suppliedPass) return false;

  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  const devPlainPassword = process.env.ADMIN_PASSWORD;

  const suppliedUserSha = crypto.createHash('sha256').update(suppliedUser.trim().normalize()).digest();
  const expectedUserSha = crypto.createHash('sha256').update(expectedUser.trim().normalize()).digest();
  const userMatches = crypto.timingSafeEqual(suppliedUserSha, expectedUserSha);

  let hashToVerify = DUMMY_HASH;
  let isPlainMatch = false;

  if (expectedHash && expectedHash.includes(':')) {
    hashToVerify = userMatches ? expectedHash : DUMMY_HASH;
  } else if (process.env.NODE_ENV !== 'production') {
    const plainExpected = devPlainPassword || 'admin123';
    const suppliedPassSha = crypto.createHash('sha256').update(suppliedPass.normalize()).digest();
    const expectedPassSha = crypto.createHash('sha256').update(plainExpected.normalize()).digest();
    isPlainMatch = userMatches && crypto.timingSafeEqual(suppliedPassSha, expectedPassSha);
  }

  // Always run verifyPassword to burn scrypt CPU cycles and prevent timing side-channel
  const hashMatches = verifyPassword(suppliedPass, hashToVerify);

  return userMatches && (expectedHash ? hashMatches : isPlainMatch);
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
 * Create an admin access token (valid for 15 minutes)
 */
export function createAdminAccessToken(username: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes
  const payload = {
    sub: `admin:${username}`,
    username,
    role: 'admin',
    aud: 'sport-planner-admin-api',
    iss: 'sport-planner-auth',
    exp,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getAdminSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify an admin access token
 */
export function verifyAdminAccessToken(token: string): { username: string; role: 'admin' } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', getAdminSecret()).update(`${header}.${body}`).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (data.role !== 'admin' || data.aud !== 'sport-planner-admin-api') {
      return null;
    }
    return {
      username: data.username || (data.sub ? data.sub.replace('admin:', '') : 'admin'),
      role: 'admin',
    };
  } catch {
    return null;
  }
}

/**
 * Create an impersonation team access token
 */
export function createImpersonationToken(teamId: string, teamName: string, adminUsername: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes
  const payload = {
    teamId,
    teamName,
    isImpersonated: true,
    impersonatedBy: adminUsername,
    role: 'team',
    aud: 'sport-planner-team-api',
    iss: 'sport-planner-auth',
    exp,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify an access token and extract team payload
 */
export function verifyAccessToken(token: string): {
  teamId: string;
  teamName: string;
  isImpersonated?: boolean;
  impersonatedBy?: string;
} | null {
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
    const result: {
      teamId: string;
      teamName: string;
      isImpersonated?: boolean;
      impersonatedBy?: string;
    } = {
      teamId: data.teamId,
      teamName: data.teamName,
    };
    if (data.isImpersonated) {
      result.isImpersonated = true;
      if (data.impersonatedBy) {
        result.impersonatedBy = data.impersonatedBy;
      }
    }
    return result;
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
export function getAuthTeam(req: any): {
  teamId: string;
  teamName: string;
  isImpersonated?: boolean;
  impersonatedBy?: string;
} | null {
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyAccessToken(token);
}

/**
 * Safely extract client IP from request (x-real-ip or x-forwarded-for on Vercel)
 */
export function getClientIp(req: any): string {
  const xRealIp = req.headers?.['x-real-ip'];
  if (xRealIp && typeof xRealIp === 'string') return xRealIp.trim();

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

/**
 * Strict sliding rate limit in Redis for admin auth (default: max 5 failed attempts / 15 minutes)
 */
export async function checkAdminRateLimit(redis: any, ip: string, limit = 5, windowSeconds = 900): Promise<boolean> {
  try {
    const key = `ratelimit:admin:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch {
    return true; // Fail open if Redis temporary issue
  }
}
