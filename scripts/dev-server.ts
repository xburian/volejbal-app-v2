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
app.use(express.json());

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
  // Dynamically import the API handlers (after env vars are loaded)
  const usersHandler = await import('../api/users.js');
  const eventsHandler = await import('../api/events.js');
  const attendanceHandler = await import('../api/attendance.js');

  app.all('/api/users', wrapHandler(usersHandler));
  app.all('/api/events', wrapHandler(eventsHandler));
  app.all('/api/attendance', wrapHandler(attendanceHandler));

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Local API server running on http://localhost:${PORT}`);
    console.log(`   Routes: /api/users, /api/events, /api/attendance`);
    console.log(`   Redis: ${process.env.volejbal_KV_REST_API_URL ? '✅ connected' : '❌ missing volejbal_KV_REST_API_URL'}`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start dev server:', err);
  process.exit(1);
});

