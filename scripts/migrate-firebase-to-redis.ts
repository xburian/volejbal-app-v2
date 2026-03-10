/**
 * One-time migration script: Firebase Firestore → Upstash Redis
 *
 * Usage:
 *   1. Replace the placeholder strings below with your real credentials
 *   2. Run: npm run migrate   (or: npx tsx scripts/migrate-firebase-to-redis.ts)
 *   3. Verify data in Upstash console, then delete this script
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Redis } from '@upstash/redis';

// ============================================================
// 🔑  REPLACE THESE WITH YOUR REAL CREDENTIALS
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: 'ALREADY_MIGRATED',
  authDomain: 'volejball-app.firebaseapp.com',
  projectId: 'volejball-app',
  storageBucket: 'volejball-app.firebasestorage.app',
  messagingSenderId: 'ALREADY_MIGRATED',
  appId: 'ALREADY_MIGRATED',
};

const UPSTASH_URL = 'ALREADY_MIGRATED';
const UPSTASH_TOKEN = 'ALREADY_MIGRATED';

// ============================================================

async function migrate() {
  console.log('🚀 Starting migration: Firebase Firestore → Upstash Redis (users only)\n');

  // --- Init Firebase ---
  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(firebaseApp);

  // --- Init Redis ---
  const redis = new Redis({
    url: UPSTASH_URL,
    token: UPSTASH_TOKEN,
  });

  // --- Migrate Users ---
  console.log('📦 Migrating users...');
  const usersSnapshot = await getDocs(collection(db, 'users'));
  let userCount = 0;

  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    const userId = user.id || doc.id;

    await redis.set(`user:${userId}`, JSON.stringify({ ...user, id: userId }));
    await redis.sadd('users:all', userId);
    userCount++;
  }
  console.log(`   ✅ Migrated ${userCount} users`);

  // --- Summary ---
  console.log('\n🎉 Migration complete!');
  console.log(`   Users: ${userCount}`);
  console.log('\nYou can now verify data in the Upstash console: https://console.upstash.com');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

