/**
 * Seed script for Gamification & Player Dashboard Demo Data.
 * Enriches users with preferred positions, mottos, dominant hands, and awards,
 * and enriches events with match awards (MVP, Fair-play), firstJoinedAt timestamps,
 * and sets for realistic XP leveling.
 *
 * Usage: npx tsx scripts/seed-gamification-demo.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const mockDbPath = path.resolve(process.cwd(), '.mock-db.json');
const prodBackupPath = path.resolve(process.cwd(), 'backups/backup-prod-2026-10-17T12-45-36-025Z.json');

console.log('🏐 Seeding Gamification & Player Dashboard Demo Data...');

let dbData: Record<string, any> = {};

const useProdBackup = process.argv.includes('--from-prod') || process.argv.includes('--prod');

if (useProdBackup && fs.existsSync(prodBackupPath)) {
  console.log('Loading 53 real events and 25 users from production backup (--from-prod)...');
  const prod = JSON.parse(fs.readFileSync(prodBackupPath, 'utf8'));
  dbData = {};
  for (const item of prod.keys || []) {
    dbData[item.key] = item.value;
  }
} else if (fs.existsSync(mockDbPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    dbData = raw.data || raw;
  } catch (_err) {
    console.warn('Could not read existing mock-db, will initialize new');
  }
}

// 1. Enrich Users with Volleyball Positions, Mottos & Titles
const POSITIONS = ['setter', 'outside_hitter', 'middle_blocker', 'opposite', 'libero', 'allrounder'] as const;
const MOTTOS = [
  'Příjem je základ všeho! 🏐',
  'Na balón se nečeká, pro balón se skáče!',
  'Srdcem a rybičkou na palubovce.',
  'Lepší špatná nahrávka než žádná smeč.',
  'Kdo neblokuje, s námi nehraje!',
  'Hlavně se nezranit a vyhrát koncovku.',
  'Volejbal je týmová poezie.',
];

const allUserKeys = Object.keys(dbData).filter(k => k.startsWith('user:'));
console.log(`Enriching ${allUserKeys.length} users with gamification identity...`);

const userIds: string[] = [];
allUserKeys.forEach((uk, idx) => {
  const user = typeof dbData[uk] === 'string' ? JSON.parse(dbData[uk]) : dbData[uk];
  userIds.push(user.id);

  // Set position and motto if missing
  if (!user.preferredPosition) {
    user.preferredPosition = POSITIONS[idx % POSITIONS.length];
  }
  if (!user.playerMotto) {
    user.playerMotto = MOTTOS[idx % MOTTOS.length];
  }
  if (!user.dominantHand) {
    user.dominantHand = idx % 5 === 0 ? 'left' : 'right';
  }
  if (!user.pinnedBadgeIds) {
    user.pinnedBadgeIds = ['ironman', 'quickPayer'];
  }
  user.teamId = user.teamId || 'team-nahravame-si';

  dbData[uk] = JSON.stringify(user);
});

// 2. Enrich Events with Awards (MVP, Fair-Play) and firstJoinedAt on Attendance
const eventKeys = Object.keys(dbData).filter(k => k.startsWith('event:'));
console.log(`Enriching ${eventKeys.length} events with awards & attendance timestamps...`);

let awardsCount = 0;
eventKeys.forEach((ek, idx) => {
  const ev = typeof dbData[ek] === 'string' ? JSON.parse(dbData[ek]) : dbData[ek];
  const evDate = new Date(`${ev.date}T${ev.time || '18:00'}:00`).getTime();

  // For past events with teams, assign MVP and Fair-Play awards to 50% of matches
  if (evDate < Date.now() && idx % 2 === 0 && userIds.length >= 2) {
    const mvpUser = userIds[idx % userIds.length];
    const fairPlayUser = userIds[(idx + 3) % userIds.length];
    ev.eventAwards = {
      mvpUserId: mvpUser,
      fairPlayUserId: fairPlayUser,
      ironmanUserId: userIds[(idx + 1) % userIds.length],
    };
    awardsCount += 1;
  }

  // Update embedded participants if present
  if (Array.isArray(ev.participants)) {
    ev.participants = ev.participants.map((p: any, pIdx: number) => {
      const earlyOffset = (3 + (pIdx % 3)) * 24 * 60 * 60 * 1000;
      return {
        ...p,
        firstJoinedAt: p.firstJoinedAt || (evDate - earlyOffset),
        kudosReceived: p.kudosReceived || (pIdx % 2 === 0 ? ['setter', 'spikes'] : []),
      };
    });
  }

  dbData[ek] = JSON.stringify(ev);
});

// 3. Enrich live attendance keys
const attKeys = Object.keys(dbData).filter(k => k.startsWith('attendance:'));
console.log(`Enriching ${attKeys.length} attendance records with Early Bird timestamps...`);
attKeys.forEach((ak, idx) => {
  if (ak.startsWith('attendance:event:') || ak.startsWith('attendance:user:')) return;
  const att = typeof dbData[ak] === 'string' ? JSON.parse(dbData[ak]) : dbData[ak];
  if (!att || !att.eventId) return;

  const evKey = `event:${att.eventId}`;
  const evRaw = dbData[evKey];
  if (evRaw) {
    const ev = typeof evRaw === 'string' ? JSON.parse(evRaw) : evRaw;
    const evDate = new Date(`${ev.date}T${ev.time || '18:00'}:00`).getTime();
    const earlyOffset = (3 + (idx % 2)) * 24 * 60 * 60 * 1000;
    att.firstJoinedAt = att.firstJoinedAt || (evDate - earlyOffset);
    if (idx % 3 === 0) {
      att.kudosReceived = ['defense', 'spirit'];
    }
    dbData[ak] = JSON.stringify(att);
  }
});

// Save to .mock-db.json
const wrapped = { data: dbData };
fs.writeFileSync(mockDbPath, JSON.stringify(wrapped, null, 2), 'utf8');

console.log(`✅ Gamification demo data seeded successfully!`);
console.log(`- Users updated: ${allUserKeys.length}`);
console.log(`- Events with awards: ${awardsCount}`);
console.log(`- Saved to ${mockDbPath}`);
