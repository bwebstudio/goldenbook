// generate-apple-secret.js
//
// Generates the Apple OAuth client secret JWT that Supabase expects in
// Authentication → Providers → Apple → "Secret Key".
//
// Usage:
//   1. Place AuthKey_C9S6B593TX.p8 in this directory (project root).
//   2. npm install jsonwebtoken
//   3. node generate-apple-secret.js
//
// The JWT will be printed to stdout. Copy the entire string into Supabase.
// It is valid for 180 days, after which you must regenerate it.

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// ─── Apple Developer values ──────────────────────────────────────────────────
const TEAM_ID   = 'CSZM3NTXA8';                          // iss
const CLIENT_ID = 'com.bwebstudio.goldenbook.auth';      // sub (Service ID)
const KEY_ID    = 'C9S6B593TX';                          // header.kid
const KEY_FILE  = `AuthKey_${KEY_ID}.p8`;                // private key filename

// ─── Read the .p8 private key ────────────────────────────────────────────────
const keyPath = path.resolve(__dirname, KEY_FILE);
if (!fs.existsSync(keyPath)) {
  console.error(`\n✖ Private key not found: ${keyPath}`);
  console.error('  Drop the .p8 file from Apple Developer into this directory and try again.\n');
  process.exit(1);
}
const privateKey = fs.readFileSync(keyPath, 'utf8');

// ─── Sign the JWT ────────────────────────────────────────────────────────────
// Apple requires ES256, an explicit `kid` header, and the audience set to
// https://appleid.apple.com. Lifetime must not exceed 6 months — 180 days
// is the standard maximum that Supabase accepts.
const nowInSeconds        = Math.floor(Date.now() / 1000);
const sixMonthsInSeconds  = 60 * 60 * 24 * 180;

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: nowInSeconds,
    exp: nowInSeconds + sixMonthsInSeconds,
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: KEY_ID,
    },
  }
);

// ─── Output ──────────────────────────────────────────────────────────────────
process.stdout.write(token + '\n');
