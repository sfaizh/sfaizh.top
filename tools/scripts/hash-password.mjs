#!/usr/bin/env node
/**
 * Derives the value for `ADMIN_PASSWORD_HASH`.
 *
 *   AUTH_SECRET=... npm run admin:hash -- 'your password'
 *
 * The hash is salted with `AUTH_SECRET`, so rotating the secret invalidates
 * every existing password hash and every issued session token at once.
 */
import { scryptSync, randomBytes } from 'node:crypto';

const password = process.argv[2];
const secret = process.env.AUTH_SECRET;

if (!password) {
  console.error('usage: AUTH_SECRET=<secret> npm run admin:hash -- <password>');
  console.error('');
  console.error('No AUTH_SECRET yet? Here is one:');
  console.error(`  AUTH_SECRET=${randomBytes(32).toString('base64url')}`);
  process.exit(1);
}

if (!secret) {
  console.error('AUTH_SECRET must be set — it is the salt as well as the signing key.');
  console.error(`Suggestion: AUTH_SECRET=${randomBytes(32).toString('base64url')}`);
  process.exit(1);
}

const hash = scryptSync(password, `sfaizh:${secret}`, 32).toString('hex');

console.log('Add these to your environment (Vercel → Settings → Environment Variables):');
console.log('');
console.log(`AUTH_SECRET=${secret}`);
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
