import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  getAuthTeam,
  getClientIp,
} from '../../api/_utils/auth.js';

describe('api/utils/auth', () => {
  describe('Password Hashing & Verification', () => {
    it('hashes and correctly verifies passwords', () => {
      const hash = hashPassword('1234');
      expect(hash).toContain(':');
      expect(verifyPassword('1234', hash)).toBe(true);
      expect(verifyPassword('wrong', hash)).toBe(false);
      expect(verifyPassword('', hash)).toBe(false);
    });

    it('generates unique salts for identical passwords', () => {
      const hash1 = hashPassword('1234');
      const hash2 = hashPassword('1234');
      expect(hash1).not.toBe(hash2);
      expect(verifyPassword('1234', hash1)).toBe(true);
      expect(verifyPassword('1234', hash2)).toBe(true);
    });

    it('handles invalid stored hashes gracefully', () => {
      expect(verifyPassword('1234', '')).toBe(false);
      expect(verifyPassword('1234', 'malformed')).toBe(false);
      expect(verifyPassword('1234', 'salt:nothex')).toBe(false);
    });
  });

  describe('Access Tokens (stateless HMAC-SHA256)', () => {
    it('creates and verifies valid access tokens', () => {
      const payload = { teamId: 'team-1', teamName: 'nahravame-si' };
      const token = createAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const verified = verifyAccessToken(token);
      expect(verified).toEqual(payload);
    });

    it('rejects tampered tokens', () => {
      const token = createAccessToken({ teamId: 'team-1', teamName: 'nahravame-si' });
      const parts = token.split('.');
      // Tamper with payload
      const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
      expect(verifyAccessToken(tampered)).toBeNull();

      // Tamper with signature
      const tamperedSig = `${parts[0]}.${parts[1]}.badsignature`;
      expect(verifyAccessToken(tamperedSig)).toBeNull();
    });

    it('rejects malformed token strings', () => {
      expect(verifyAccessToken('')).toBeNull();
      expect(verifyAccessToken('one.two')).toBeNull();
      expect(verifyAccessToken('a.b.c.d')).toBeNull();
    });
  });

  describe('Refresh Tokens', () => {
    it('creates 64-char hex random strings', () => {
      const token1 = createRefreshToken();
      const token2 = createRefreshToken();
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });

  describe('getAuthTeam Helper', () => {
    it('extracts team from valid Authorization Bearer header', () => {
      const token = createAccessToken({ teamId: 'team-1', teamName: 'nahravame-si' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      expect(getAuthTeam(req)).toEqual({ teamId: 'team-1', teamName: 'nahravame-si' });
    });

    it('returns null for missing, malformed or invalid headers', () => {
      expect(getAuthTeam({})).toBeNull();
      expect(getAuthTeam({ headers: {} })).toBeNull();
      expect(getAuthTeam({ headers: { authorization: 'Basic abc' } })).toBeNull();
      expect(getAuthTeam({ headers: { authorization: 'Bearer invalid-token' } })).toBeNull();
    });
  });

  describe('getClientIp Helper', () => {
    it('extracts first IP from x-forwarded-for header', () => {
      expect(getClientIp({ headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' } })).toBe('203.0.113.195');
      expect(getClientIp({ headers: { 'x-forwarded-for': ['203.0.113.195'] } })).toBe('203.0.113.195');
    });

    it('falls back to socket remoteAddress or 127.0.0.1', () => {
      expect(getClientIp({ headers: {}, socket: { remoteAddress: '192.168.1.5' } })).toBe('192.168.1.5');
      expect(getClientIp({})).toBe('127.0.0.1');
    });
  });
});
