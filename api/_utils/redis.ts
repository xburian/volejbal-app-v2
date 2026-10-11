import { Redis } from '@upstash/redis';
import { resolve } from 'node:path';
import { MockRedis } from './mockRedis.js';
import { seedMockData } from './mockDataGenerator.js';

const redisUrl =
  process.env.volejbal_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const redisToken =
  process.env.volejbal_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

const isVitest = typeof process !== 'undefined' && Boolean(process.env.VITEST);
const forceMock = process.env.LOCAL_MOCK_DB === 'true' || process.env.MOCK_DB === 'true';
const shouldMock = forceMock || (!isVitest && (!redisUrl || !redisToken));

let clientInstance: any = null;
let mockRedisSingleton: MockRedis | null = null;
let _initializedPromise: Promise<void> | null = null;

export function isMockDb(): boolean {
  return shouldMock;
}

export function getMockRedis(): MockRedis | null {
  return mockRedisSingleton;
}

function initClient() {
  if (clientInstance) return clientInstance;

  if (shouldMock) {
    const persistPath = resolve(process.cwd(), '.mock-db.json');
    mockRedisSingleton = new MockRedis({ persistPath });
    clientInstance = mockRedisSingleton;

    // Auto-seed mock data if empty
    _initializedPromise = (async () => {
      try {
        await seedMockData(mockRedisSingleton, { force: false });
      } catch (err) {
        console.warn('Auto-seed mock data warning:', err);
      }
    })();
  } else {
    clientInstance = new Redis({
      url: redisUrl || 'https://mock.upstash.io',
      token: redisToken || 'mock-token',
    });
  }

  return clientInstance;
}

export const redis = initClient();

export async function resetMockDb() {
  if (mockRedisSingleton) {
    mockRedisSingleton.clear();
    await seedMockData(mockRedisSingleton, { force: true });
    return { success: true, message: 'Mock database reset to defaults.' };
  }
  return { success: false, message: 'Not running in mock DB mode.' };
}

export async function seedRandomMockDb() {
  if (mockRedisSingleton) {
    await seedMockData(mockRedisSingleton, { force: true });
    return { success: true, message: 'Mock database re-seeded with fresh data.' };
  }
  return { success: false, message: 'Not running in mock DB mode.' };
}

export async function getMockDbStats() {
  if (mockRedisSingleton) {
    const teams = await mockRedisSingleton.smembers('teams:all');
    const users = await mockRedisSingleton.smembers('users:all');
    const events = await mockRedisSingleton.smembers('events:all');
    return {
      isMock: true,
      teamsCount: teams.length,
      usersCount: users.length,
      eventsCount: events.length,
    };
  }
  return { isMock: false };
}
