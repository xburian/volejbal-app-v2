import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optimizePhotos } from './optimize-prod-photos.js';
import { Jimp } from 'jimp';

class MockRedis {
  data = new Map<string, string>();

  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
    return 'OK';
  }
  async keys(pattern: string) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter(k => regex.test(k));
  }
}

describe('optimizePhotos script', () => {
  let mockRedis: MockRedis;
  let largePhotoBase64: string;

  beforeEach(async () => {
    mockRedis = new MockRedis();

    // Create a generated image buffer with distinct pixels so PNG is realistically larger
    const img = new Jimp({ width: 250, height: 250 });
    for (let x = 0; x < 250; x++) {
      for (let y = 0; y < 250; y++) {
        img.setPixelColor(((x * 9999 + y * 3333) | 0xff) >>> 0, x, y);
      }
    }
    const buf = await img.getBuffer('image/png');
    largePhotoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
  });

  it('runs dry-run without mutating Redis and reports savings', async () => {
    const user = {
      id: 'u-dry',
      name: 'Dry User',
      photoUrl: largePhotoBase64,
    };
    await mockRedis.set('user:u-dry', JSON.stringify(user));

    const result = await optimizePhotos({
      dryRun: true,
      minBytesToOptimize: 100, // Low threshold to catch our test photo
      redisClient: mockRedis,
    });

    expect(result.dryRun).toBe(true);
    expect(result.photosFound).toBe(1);
    expect(result.photosOptimized).toBe(1);
    expect(result.bytesSaved).toBeGreaterThan(0);

    // Redis must remain UNTOUCHED
    const stored = JSON.parse((await mockRedis.get('user:u-dry'))!);
    expect(stored.photoUrl).toBe(largePhotoBase64);
  });

  it('runs live execute and updates user in Redis', async () => {
    const user = {
      id: 'u-live',
      name: 'Live User',
      photoUrl: largePhotoBase64,
    };
    await mockRedis.set('user:u-live', JSON.stringify(user));
    await mockRedis.set('photo:u-live', largePhotoBase64);

    const result = await optimizePhotos({
      dryRun: false,
      minBytesToOptimize: 100,
      redisClient: mockRedis,
    });

    expect(result.dryRun).toBe(false);
    expect(result.photosOptimized).toBe(1);

    // Verify user in Redis was updated with compressed JPEG data URI
    const stored = JSON.parse((await mockRedis.get('user:u-live'))!);
    expect(stored.photoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(stored.photoUrl).not.toBe(largePhotoBase64);

    // Verify photo:u-live was also synchronized
    const storedPhoto = await mockRedis.get('photo:u-live');
    expect(storedPhoto).toBe(stored.photoUrl);
  });

  it('skips photos below minBytesToOptimize threshold', async () => {
    const user = {
      id: 'u-small',
      name: 'Small Photo User',
      photoUrl: largePhotoBase64,
    };
    await mockRedis.set('user:u-small', JSON.stringify(user));

    const result = await optimizePhotos({
      dryRun: true,
      minBytesToOptimize: 10_000_000, // Very high threshold: 10 MB
      redisClient: mockRedis,
    });

    expect(result.photosFound).toBe(1);
    expect(result.photosOptimized).toBe(0);
    expect(result.bytesSaved).toBe(0);
  });
});
