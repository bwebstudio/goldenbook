#!/usr/bin/env node
// Guards the app copy against em dashes.
//
// An em dash in UI text reads as machine-written, and Goldenbook's voice is
// meant to read as a person who knows the city. Code comments are exempt:
// they never reach a user. Run with `npm run check:copy`, or wire it into CI.
//
// Scanned: every .ts/.tsx file under CONTENT_DIRS (recursively). These are
// the places that hold user-facing copy: the i18n locales and the static
// content in src/config (info pages, interests, localities...). Add a folder
// here when you create a new home for copy.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIRS = [
  path.join('src', 'i18n', 'locales'),
  path.join('src', 'config'),
];
const EM_DASH = '—';

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Returns the 1-based line numbers where an em dash appears outside a
// comment. A small state machine is enough: it understands line and block
// comments and the three string quote styles, so a `//` inside a string
// (a URL, say) does not hide the rest of the line.
function emDashLines(src) {
  const hits = new Set();
  let line = 1;
  let state = 'code'; // code | line | block | ' | " | `
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '\n') {
      line++;
      if (state === 'line') state = 'code';
      continue;
    }
    switch (state) {
      case 'code':
        if (c === '/' && next === '/') { state = 'line'; i++; }
        else if (c === '/' && next === '*') { state = 'block'; i++; }
        else if (c === "'" || c === '"' || c === '`') state = c;
        else if (c === EM_DASH) hits.add(line);
        break;
      case 'line':
        break;
      case 'block':
        if (c === '*' && next === '/') { state = 'code'; i++; }
        break;
      default: // inside a string
        if (c === '\\') { i++; if (src[i] === '\n') line++; }
        else if (c === state) state = 'code';
        else if (c === EM_DASH) hits.add(line);
    }
  }
  return [...hits];
}

let failures = 0;

for (const dir of CONTENT_DIRS) {
  for (const full of walk(path.join(ROOT, dir))) {
    const src = fs.readFileSync(full, 'utf8');
    const lines = src.split('\n');
    for (const n of emDashLines(src)) {
      console.error(`${path.relative(ROOT, full)}:${n}  em dash in copy\n    ${lines[n - 1].trim()}`);
      failures++;
    }
  }
}

if (failures) {
  console.error(`\n${failures} string(s) contain an em dash. Use a comma, a colon, a full stop or brackets.`);
  process.exit(1);
}
console.log('copy check passed: no em dashes in user-facing strings');
