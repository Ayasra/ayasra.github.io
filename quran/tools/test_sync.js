/* Sync engine, driven against a fake backend — node tools/test_sync.js
 *
 * No network and no Firebase. The engine was written against a small adapter
 * interface precisely so the vendor could be swapped for the stand-in below,
 * and so the interesting cases — two devices, offline writes, a remote change
 * arriving mid-session — can be produced deliberately rather than waited for.
 *
 * Each "device" is its own sandbox with its own localStorage, both pointed at
 * one shared server object.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) passed++; else failures.push(name + (detail ? ' — ' + detail : ''));
}
function eq(name, got, want) {
  ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- the fake backend ---------------- */

function makeServer() {
  return {
    state: null,
    months: {},
    pulls: 0,
    pushes: 0,
    /* Per device, because the interesting question is "did *this* device push",
       and a shared counter answers a different one. */
    pushesBy: {},
    monthWrites: [],          /* every month document ever written */
    watchers: [],
    offline: false,
    bump() { this.watchers.forEach(cb => cb()); }
  };
}

function makeAdapter(server, user, label) {
  label = label || 'anon';
  if (!(label in server.pushesBy)) server.pushesBy[label] = 0;
  let current = null;
  const userCbs = [];
  return {
    name: 'memory',
    init: () => Promise.resolve(),
    onUser(cb) { userCbs.push(cb); cb(current); return () => {}; },
    signIn() { current = user; userCbs.forEach(cb => cb(current)); return Promise.resolve(); },
    signOut() { current = null; userCbs.forEach(cb => cb(null)); return Promise.resolve(); },
    pull() {
      if (server.offline) return Promise.reject(new Error('offline'));
      server.pulls++;
      return Promise.resolve({
        state: server.state ? JSON.parse(JSON.stringify(server.state)) : null,
        chunks: JSON.parse(JSON.stringify(server.months))
      });
    },
    push(uid, payload) {
      if (server.offline) return Promise.reject(new Error('offline'));
      server.pushes++;
      server.pushesBy[label]++;
      if (payload.state) server.state = JSON.parse(JSON.stringify(payload.state));
      Object.keys(payload.chunks || {}).forEach(k => {
        server.monthWrites.push(k);
        server.months[k] = JSON.parse(JSON.stringify(payload.chunks[k]));
      });
      server.bump();
      return Promise.resolve();
    },
    watch(uid, cb) {
      server.watchers.push(cb);
      return () => {
        const i = server.watchers.indexOf(cb);
        if (i !== -1) server.watchers.splice(i, 1);
      };
    }
  };
}

/* ---------------- a device ---------------- */

function makeDevice(name) {
  const store = new Map();
  const sandbox = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear()
    },
    setTimeout, clearTimeout, Promise, Date, Math, JSON,
    Object, Array, String, Number, Error, isNaN, parseInt, parseFloat
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  for (const [file, global] of [
    ['assets/data/index.js', 'QURAN_INDEX'],
    ['assets/data/surahs.js', 'QURAN_SURAHS'],
    ['assets/tracker.js', 'QuranTracker'],
    ['assets/sync.js', 'QuranSync']
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox);
    if (!sandbox[global]) throw new Error(file + ' did not define ' + global);
  }
  sandbox.QuranTracker.init();
  return { name, store, QT: sandbox.QuranTracker, SY: sandbox.QuranSync };
}

(async () => {
  /* ---------------- chunking ---------------- */
  {
    const d = makeDevice('chunk');
    const I = d.SY._internal;
    const jan = new Date(2026, 0, 15).getTime();
    const feb = new Date(2026, 1, 3).getTime();
    const chunks = I.chunkSessions([
      { id: 'a', at: jan }, { id: 'b', at: jan }, { id: 'c', at: feb }
    ]);
    eq('sessions are cut by calendar month', Object.keys(chunks).sort().join(','), '2026-01,2026-02');
    eq('January holds two', chunks['2026-01'].length, 2);
    eq('February holds one', chunks['2026-02'].length, 1);
    eq('a month key is padded', I.monthOf(new Date(2026, 8, 1).getTime()), '2026-09');

    /* the signature is what decides whether a month is resent */
    const sigA = I.signature([{ id: 'x' }, { id: 'y' }]);
    eq('order does not change a signature', I.signature([{ id: 'y' }, { id: 'x' }]), sigA);
    ok('but content does', I.signature([{ id: 'x' }, { id: 'z' }]) !== sigA);
  }

  /* ---------------- one device, first sync ---------------- */
  const server = makeServer();
  const phone = makeDevice('phone');
  {
    phone.QT.sessions.add({ type: 'read', from: 1, to: 7, seconds: 120 });
    phone.QT.plans.create({ name: 'ختمة', unit: 'page', amount: 4 });

    const a = makeAdapter(server, { id: 'u1', name: 'Reader', email: 'r@example.com' }, 'phone');
    await phone.SY.configure(a);
    eq('starts signed out', phone.SY.state().user, null);
    await a.signIn();
    await wait(60);

    ok('the server received a state document', !!server.state);
    ok('and at least one month of sessions', Object.keys(server.months).length === 1);
    eq('the reader is reported', phone.SY.state().user.id, 'u1');
    ok('a sync time was recorded', phone.SY.state().lastSyncAt > 0);
  }

  /* ---------------- a second device adopts, rather than overwrites ---------------- */
  const laptop = makeDevice('laptop');
  {
    laptop.QT.sessions.add({ type: 'read', from: 100, to: 130, seconds: 300 });
    eq('the laptop starts with only its own session', laptop.QT.sessions.list().length, 1);

    const b = makeAdapter(server, { id: 'u1', name: 'Reader', email: 'r@example.com' }, 'laptop');
    await laptop.SY.configure(b);
    await b.signIn();
    await wait(60);

    eq('it gains the phone’s history', laptop.QT.sessions.list().length, 2);
    eq('and keeps its own', laptop.QT.sessions.list().filter(s => s.from === 100).length, 1);
    eq('the plan came across too', laptop.QT.plans.list().length, 1);
    eq('and it is the same plan', laptop.QT.plans.list()[0].name, 'ختمة');
  }

  /* the phone then learns what the laptop added */
  {
    await phone.SY.pull();
    eq('the phone catches up', phone.QT.sessions.list().length, 2);
  }

  /* ---------------- a delete crosses, and does not bounce back ---------------- */
  {
    const doomed = phone.QT.marks.add({ cat: 'hifz', from: 262 });
    await phone.SY.push(true);
    await laptop.SY.pull();
    eq('the mark reached the laptop', laptop.QT.marks.list().length, 1);

    phone.QT.marks.remove(doomed.id);
    await phone.SY.push(true);
    await laptop.SY.pull();
    eq('and the delete reached it too', laptop.QT.marks.list().length, 0);

    /* the laptop pushing back must not resurrect it on the phone */
    await laptop.SY.push(true);
    await phone.SY.pull();
    eq('the delete stays dead', phone.QT.marks.list().length, 0);
  }

  /* ---------------- a local change is pushed by itself ---------------- */
  {
    const before = server.pushesBy.phone;
    phone.QT.sessions.add({ type: 'read', from: 200, to: 220, seconds: 200 });
    await wait(1900);                       /* past the debounce */
    ok('a local edit pushes on its own', server.pushesBy.phone > before,
       `${before} -> ${server.pushesBy.phone}`);
  }

  /* ---------------- a burst becomes one push ---------------- */
  {
    const before = server.pushesBy.phone;
    for (let i = 0; i < 6; i++) phone.QT.marks.add({ cat: 'dua', from: 300 + i });
    await wait(1900);
    eq('six edits in a burst are one write', server.pushesBy.phone - before, 1);
  }

  /* ---------------- applying a remote change does not echo back ---------------- */
  {
    laptop.QT.sessions.add({ type: 'read', from: 400, to: 420, seconds: 100 });
    await laptop.SY.push(true);
    await wait(1900);            /* let the laptop's own debounced push settle */

    const before = server.pushesBy.phone;
    await phone.SY.pull();                  /* the phone merges the laptop's work */
    await wait(1900);                       /* long enough for a push to fire */
    eq('merging a remote change starts no push of its own',
       server.pushesBy.phone, before);
    ok('but the change did land', phone.QT.sessions.list().some(s => s.from === 400));
  }

  /* ---------------- unchanged months are not rewritten ---------------- */
  {
    server.monthWrites.length = 0;
    await phone.SY.push();                  /* not forced */
    const months = new Set(server.monthWrites);
    ok('at most the current month is written', months.size <= 1,
       [...months].join(','));
  }

  /* ---------------- offline, then not ---------------- */
  {
    server.offline = true;
    phone.QT.sessions.add({ type: 'read', from: 500, to: 520, seconds: 60 });
    await wait(1900);
    eq('the engine reports the failure', phone.SY.state().status, 'error');
    ok('and the reading is still recorded locally',
       phone.QT.sessions.list().some(s => s.from === 500));

    server.offline = false;
    await phone.SY.sync();
    await laptop.SY.pull();
    ok('once back, the offline reading reaches the other device',
       laptop.QT.sessions.list().some(s => s.from === 500));
  }

  /* ---------------- signing out stops the loop ---------------- */
  {
    const solo = makeDevice('solo');
    const a = makeAdapter(server, { id: 'u1' }, 'solo');
    await solo.SY.configure(a);
    await a.signIn();
    await wait(60);
    await a.signOut();
    await wait(60);

    const before = server.pushesBy.solo;
    solo.QT.sessions.add({ type: 'read', from: 1, to: 7 });
    await wait(1900);
    eq('nothing is sent once signed out', server.pushesBy.solo, before);
    eq('and the engine says so', solo.SY.state().user, null);
  }

  /* ---------------- no configuration, no network ---------------- */
  {
    const bare = makeDevice('bare');
    const st = bare.SY.state();
    eq('sync reports itself unconfigured', st.configured, false);
    eq('with nobody signed in', st.user, null);
    bare.QT.sessions.add({ type: 'read', from: 1, to: 7 });
    eq('and the app still records normally', bare.QT.sessions.list().length, 1);
  }

  console.log('');
  console.log(passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    console.log('');
    failures.forEach(f => console.log('  FAIL  ' + f));
    process.exit(1);
  }
  console.log('sync behaves against a fake backend.');
  process.exit(0);
})();

process.on('unhandledRejection', e => {
  console.error('\nharness crashed: ' + (e && e.stack || e));
  process.exit(1);
});
