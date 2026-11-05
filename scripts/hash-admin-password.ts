/**
 * CLI utility to generate an scrypt-hashed password string
 * for use in ADMIN_PASSWORD_HASH environment variable.
 *
 * Usage:
 *   npx tsx scripts/hash-admin-password.ts [password]
 */

import { hashPassword } from '../api/_utils/auth.js';

const password = process.argv[2] || process.env.PASSWORD;

if (!password) {
  console.error('Chyba: Zadejte heslo jako argument:');
  console.error('  npx tsx scripts/hash-admin-password.ts <mojeHeslo>');
  process.exit(1);
}

const hash = hashPassword(password);
console.log('\nVygenerovaný hash pro administrátorské heslo:');
console.log('----------------------------------------------------');
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log('----------------------------------------------------');
console.log('Nastavte tuto proměnnou do .env.local nebo ve Vercel Project Settings.\n');
