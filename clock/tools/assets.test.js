// The service worker precaches a fixed list. If a file is missing from it the clock
// won't start offline; if the list names a file that doesn't exist, install fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');
const sw = read('sw.js');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every precached file exists', () => {
  for (const file of assets) if (file !== './') assert.ok(existsSync(root + file), `missing ${file}`);
});

test('every script, style and icon the app loads is precached', () => {
  const needed = new Set(['./', 'manifest.webmanifest']); // './' is the page itself
  for (const file of readdirSync(root + 'js')) needed.add(`js/${file}`);
  for (const m of read('index.html').matchAll(/(?:href|src)="([^"]+)"/g)) needed.add(m[1]);
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons) needed.add(icon.src);
  for (const file of needed) assert.ok(assets.includes(file), `${file} is not in sw.js ASSETS`);
});

test('modules only import files that exist', () => {
  for (const file of readdirSync(root + 'js')) {
    for (const m of read(`js/${file}`).matchAll(/from '\.\/([^']+)'/g)) {
      assert.ok(existsSync(`${root}js/${m[1]}`), `${file} imports missing ${m[1]}`);
    }
  }
});

test('the worker only ever touches its own caches (ayasra.com is shared with other apps)', () => {
  assert.match(sw, /const CACHE = 'clock-/);
  assert.match(sw, /k\.startsWith\('clock-'\) && k !== CACHE/);
  assert.doesNotMatch(sw, /caches\.match\(/, 'look things up in our own cache, never across every app');
});
