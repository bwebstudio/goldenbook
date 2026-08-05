#!/usr/bin/env node
// Guards the app copy against em dashes.
//
// An em dash in UI text reads as machine-written, and Goldenbook's voice is
// meant to read as a person who knows the city. Code comments are exempt:
// they never reach a user. Run with `npm run check:copy`, or wire it into CI.

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const EM_DASH = '—';

let failures = 0;

for (const file of fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.ts'))) {
  const full = path.join(LOCALES_DIR, file);
  fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');           // drop trailing comments
    if (/^\s*\/[/*]/.test(line)) return;                // whole-line comment
    if (!code.includes(EM_DASH)) return;
    console.error(`${file}:${i + 1}  em dash in copy\n    ${line.trim()}`);
    failures++;
  });
}

if (failures) {
  console.error(`\n${failures} string(s) contain an em dash. Use a comma, a colon, a full stop or brackets.`);
  process.exit(1);
}
console.log('copy check passed: no em dashes in user-facing strings');
