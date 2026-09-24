// The service worker must never mix versions: opening the clock either refreshes every
// file or none of them. Runs the real sw.js in a sandbox, with fake caches and a fake
// server that can deploy, lose a file, crawl, or vanish.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCOPE = 'https://ayasra.com/clock/';
const WAIT_MS = 40; // sw.js waits 4 s for fresh files; the sandbox shortens that
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
  .replace(/const WAIT_MS = \d+;/, `const WAIT_MS = ${WAIT_MS};`);
const CACHE = source.match(/const CACHE = '([^']+)'/)[1];
const ASSETS = JSON.parse(source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeCache {
  entries = new Map();
  url = (req) => (typeof req === 'string' ? req : req.url);
  async put(req, res) { this.entries.set(this.url(req), res); }
  async match(req, { ignoreSearch } = {}) {
    const url = ignoreSearch ? this.url(req).split('?')[0] : this.url(req);
    return this.entries.get(url)?.clone();
  }
  async keys() { return [...this.entries.keys()].map((url) => new Request(url)); }
  async delete(req) { return this.entries.delete(this.url(req)); }
}

/** A pretend GitHub Pages behind Cloudflare. Each file's body names its path and version. */
function server() {
  const s = { version: 'v1', missing: new Set(), slow: new Map(), offline: false, requested: [] };
  s.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    s.requested.push(url.href);
    if (s.offline) throw new TypeError('Failed to fetch');
    const path = url.pathname.slice('/clock/'.length) || './';
    if (s.slow.has(path)) await sleep(s.slow.get(path));
    if (s.missing.has(path)) return new Response('not found', { status: 404 });
    return new Response(`${path} ${s.version}`, { headers: { 'content-type': 'text/plain' } });
  };
  return s;
}

function worker(net) {
  const stores = new Map();
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const on = {};
  const self = {
    location: new URL('sw.js', SCOPE),
    addEventListener: (type, fn) => { on[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  vm.runInNewContext(source, { self, caches, fetch: net.fetch, Response, Request, URL, setTimeout, Promise });
  const lifecycle = (type) => {
    let done;
    on[type]({ waitUntil: (p) => { done = p; } });
    return done;
  };
  return {
    caches,
    install: () => lifecycle('install'),
    activate: () => lifecycle('activate'),
    /** What the page gets for a URL: 'navigate' is opening the clock; anything else is a file it loads. */
    async get(path, mode = 'no-cors') {
      let response;
      on.fetch({ request: { url: new URL(path, SCOPE).href, method: 'GET', mode }, respondWith: (p) => { response = p; } });
      return (await response).text();
    },
  };
}

/** Open the clock, then load every file the way the page would; returns each file's version. */
async function launch(w) {
  const versions = [(await w.get('./', 'navigate')).split(' ')[1]];
  for (const path of ASSETS.filter((p) => p !== './')) versions.push((await w.get(path)).split(' ')[1]);
  return [...new Set(versions)];
}

test('install saves every file under its plain URL, fetched past the CDN cache', async () => {
  const net = server();
  const w = worker(net);
  await w.install();
  const saved = await (await w.caches.open(CACHE)).keys();
  assert.deepEqual(saved.map((r) => r.url).sort(), ASSETS.map((p) => new URL(p, SCOPE).href).sort());
  assert.ok(net.requested.every((url) => /[?&]fresh=\d+/.test(url)), 'every download carries a cache-busting query');
});

test('after a deploy, opening the clock brings every file up to date together', async () => {
  const net = server();
  const w = worker(net);
  await w.install();
  net.version = 'v2';
  assert.deepEqual(await launch(w), ['v2']);
});

test('if any file fails to download, the whole clock stays on the previous version', async () => {
  const net = server();
  const w = worker(net);
  await w.install();
  net.version = 'v2';
  net.missing.add('js/timers.js');
  assert.deepEqual(await launch(w), ['v1']);
});

test('on a slow network the clock opens from its saved copy, and a late download never mixes in', async () => {
  const net = server();
  const w = worker(net);
  await w.install();
  net.version = 'v2';
  net.slow.set('js/view.js', WAIT_MS * 5);
  assert.deepEqual(await launch(w), ['v1']);
  await sleep(WAIT_MS * 8); // the slow download finishes long after the launch
  assert.deepEqual(await launch(w), ['v1'], 'still one version — the late files were not saved');
  net.slow.clear();
  assert.deepEqual(await launch(w), ['v2'], 'the next launch with a good connection updates everything');
});

test('offline, the clock opens exactly as it was saved', async () => {
  const net = server();
  const w = worker(net);
  await w.install();
  net.offline = true;
  assert.deepEqual(await launch(w), ['v1']);
});

test('activating removes old clock caches and leaves the other apps alone', async () => {
  const w = worker(server());
  for (const name of ['clock-v1', 'quran-v22', 'thekr-v14']) await w.caches.open(name);
  await w.install();
  await w.activate();
  assert.deepEqual((await w.caches.keys()).sort(), [CACHE, 'quran-v22', 'thekr-v14'].sort());
});
