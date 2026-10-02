/**
 * Local API dev server — loads .env.local and serves api/ handlers
 * on port 3001. Vite proxies /api/* here during local development.
 *
 * Usage: npm run dev:api  (or: npx tsx scripts/dev-server.ts)
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import express from 'express';

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') });

const app = express();
app.use(express.json({ limit: '5mb' }));

// Adapt express req/res to match the Vercel handler interface
function wrapHandler(handlerModule: any) {
  return async (req: any, res: any) => {
    try {
      await handlerModule.default(req, res);
    } catch (err: any) {
      console.error('Handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  };
}

async function start() {
  // Dynamically import the consolidated API handlers (after env vars are loaded)
  const usersHandler = await import('../api/users.js');
  const eventsHandler = await import('../api/events.js');
  const attendanceHandler = await import('../api/attendance.js');
  const photosHandler = await import('../api/photos.js');
  const bankAccountsHandler = await import('../api/bank-accounts.js');
  const sportConfigsHandler = await import('../api/sport-configs.js');
  const issuesHandler = await import('../api/issues.js');
  const authHandler = await import('../api/auth.js');
  const { isMockDb, resetMockDb, seedRandomMockDb, getMockDbStats } = await import('../api/_utils/redis.js');

  app.all('/api/auth', wrapHandler(authHandler));
  app.all('/api/teams', wrapHandler(authHandler));
  app.all('/api/users', wrapHandler(usersHandler));
  app.all('/api/events-batch', wrapHandler(eventsHandler));
  app.all('/api/events', wrapHandler(eventsHandler));
  app.all('/api/attendance', wrapHandler(attendanceHandler));
  app.all('/api/photos', wrapHandler(photosHandler));
  app.all('/api/bank-accounts', wrapHandler(bankAccountsHandler));
  app.all('/api/sport-configs', wrapHandler(sportConfigsHandler));
  app.all('/api/issues', wrapHandler(issuesHandler));

  // Dev mock database tools (local dev server only)
  app.post('/api/dev/seed', async (_req, res) => {
    try {
      const result = await seedRandomMockDb();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dev/reset', async (_req, res) => {
    try {
      const result = await resetMockDb();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dev/status', async (_req, res) => {
    try {
      const stats = await getMockDbStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Local API server running on http://localhost:${PORT}`);
    console.log(`   Routes: /api/auth, /api/teams, /api/users, /api/events, /api/events-batch, /api/attendance, /api/photos, /api/bank-accounts, /api/sport-configs, /api/issues`);
    if (isMockDb()) {
      console.log(`   Storage: 💾 IN-MEMORY MOCK DB active (persisting to .mock-db.json)`);
      console.log(`   Dev tools: POST /api/dev/seed, POST /api/dev/reset, GET /api/dev/status`);
    } else {
      console.log(`   Storage: ☁️ UPSTASH REDIS connected`);
    }
  });
}

start().catch((err) => {
  console.error('❌ Failed to start dev server:', err);
  process.exit(1);
});
