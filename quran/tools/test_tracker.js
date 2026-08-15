/* Test harness for assets/tracker.js — run with:  node tools/test_tracker.js
   Shims localStorage and the two data globals, then exercises the index
   conversions against all 6236 ayahs and the plan/streak math against hand
   worked cases. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadGlobal(file, name, sandbox) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(src, sandbox);
  if (!sandbox[name]) throw new Error(file + ' did not define ' + name);
}

/* --- sandbox with a localStorage good enough for the module --- */
const store = new Map();
const sandbox = {
  console,
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  },
  Date, Math, JSON, Object, Array, String, Number, Error, isNaN, parseInt, parseFloat
};
sandbox.window = sandbox;
vm.createContext(sandbox);

loadGlobal('assets/data/index.js', 'QURAN_INDEX', sandbox);
loadGlobal('assets/data/programs.js', 'QURAN_PROGRAMS', sandbox);
loadGlobal('assets/data/surahs.js', 'QURAN_SURAHS', sandbox);
loadGlobal('assets/tracker.js', 'QuranTracker', sandbox);

const QT = sandbox.QuranTracker;
QT.init();

/* --- tiny assertion kit --- */
let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { passed++; } else { failures.push(name + (detail ? ' — ' + detail : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}
function reset() { store.clear(); }

/* ===================== index ===================== */

eq('total ayahs', QT.index.total, 6236);
eq('total pages', QT.index.pages, 604);

/* Round-trip every ayah: global -> (surah,ayah) -> global */
let rt = true, rtFail = null;
for (let g = 1; g <= 6236; g++) {
  const p = QT.index.fromGlobal(g);
  const back = QT.index.toGlobal(p.surah, p.ayah);
  if (back !== g) { rt = false; rtFail = `g=${g} -> ${p.surah}:${p.ayah} -> ${back}`; break; }
}
ok('round-trip all 6236 ayahs', rt, rtFail);

/* Known anchors */
eq('Fatihah 1 is global 1', QT.index.toGlobal(1, 1), 1);
eq('Baqarah 1 is global 8', QT.index.toGlobal(2, 1), 8);
eq('Baqarah 255 (Ayat al-Kursi)', QT.index.toGlobal(2, 255), 262);
eq('Nas 6 is the last ayah', QT.index.toGlobal(114, 6), 6236);
eq('page of Fatihah 1', QT.index.pageOf(1), 1);
eq('page of Baqarah 1', QT.index.pageOf(8), 2);
eq('juz of Fatihah 1', QT.index.juzOf(1), 1);
eq('juz of the last ayah', QT.index.juzOf(6236), 30);

/* Every surah's declared verse count matches the index spacing */
let counts = true, countFail = null;
for (const s of sandbox.QURAN_SURAHS) {
  const r = QT.index.surahRange(s.id);
  if (r[1] - r[0] + 1 !== s.verses) {
    counts = false; countFail = `surah ${s.id}: index says ${r[1] - r[0] + 1}, meta says ${s.verses}`;
    break;
  }
}
ok('surah lengths match metadata', counts, countFail);

/* Pages and juz tile the mushaf with no gap and no overlap */
let tiles = true, tileFail = null;
for (let p = 1; p < 604; p++) {
  if (QT.index.pageRange(p)[1] + 1 !== QT.index.pageRange(p + 1)[0]) {
    tiles = false; tileFail = `page ${p} -> ${p + 1}`; break;
  }
}
ok('pages tile contiguously', tiles, tileFail);
eq('page 604 ends at 6236', QT.index.pageRange(604)[1], 6236);
eq('juz 30 ends at 6236', QT.index.juzRange(30)[1], 6236);

/* Clamping */
eq('clamp below range', QT.index.clamp(0), 1);
eq('clamp above range', QT.index.clamp(99999), 6236);

/* ===================== intervals ===================== */

const I = QT._internal;
eq('merge adjacent', JSON.stringify(I.normalize([[1, 5], [6, 9]])), '[[1,9]]');
eq('merge overlapping', JSON.stringify(I.normalize([[1, 5], [3, 9]])), '[[1,9]]');
eq('keep disjoint', JSON.stringify(I.normalize([[1, 5], [8, 9]])), '[[1,5],[8,9]]');
eq('merge unsorted', JSON.stringify(I.normalize([[8, 9], [1, 5], [2, 3]])), '[[1,5],[8,9]]');
eq('measure counts inclusively', I.measure([[1, 5], [8, 9]]), 7);
eq('first gap at start', I.firstGap([], 1, 10), 1);
eq('first gap after a prefix', I.firstGap([[1, 4]], 1, 10), 5);
eq('first gap skips islands', I.firstGap([[1, 4], [6, 8]], 1, 10), 5);
eq('no gap when complete', I.firstGap([[1, 10]], 1, 10), null);
eq('gap respects the window', I.firstGap([[1, 100]], 50, 60), null);

/* ===================== sessions ===================== */

reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, seconds: 120 });
QT.sessions.add({ type: 'read', from: 8, to: 20, seconds: 300 });
QT.sessions.add({ type: 'hifz', from: 1, to: 7, seconds: 600 });
eq('sessions stored', QT.sessions.list().length, 3);
eq('filter by type', QT.sessions.list({ type: 'read' }).length, 2);
eq('coverage merges across sessions', JSON.stringify(QT.sessions.coverage('read')), '[[1,20]]');
eq('coverage is per type', JSON.stringify(QT.sessions.coverage('hifz')), '[[1,7]]');

/* reversed input is normalised rather than rejected */
reset();
const rev = QT.sessions.add({ type: 'read', from: 50, to: 10 });
eq('reversed range is flipped', rev.from + '-' + rev.to, '10-50');

/* ===================== plans ===================== */

reset();
const p1 = QT.plans.create({
  name: 'test', unit: 'page', mode: 'perDay', amount: 4,
  scope: { kind: 'all' }, startDate: QT.date.today()
});
let st = QT.plans.status(p1);
eq('fresh plan total pages', st.totalUnits, 604);
eq('fresh plan done', st.doneUnits, 0);
eq('fresh plan cursor at ayah 1', st.cursor, 1);
eq('today starts at page 1', QT.index.pageOf(st.todayFrom), 1);
eq('today covers 4 pages', QT.index.pageOf(st.todayTo), 4);
ok('today not done yet', st.todayDone === false);

/* Complete today's portion and the cursor should move to page 5 */
QT.sessions.add({ type: 'read', from: st.todayFrom, to: st.todayTo, seconds: 900, planId: p1.id });
st = QT.plans.status(p1);
eq('after reading, done pages', st.doneUnits, 4);
eq('cursor moved to page 5', QT.index.pageOf(st.cursor), 5);
ok('today now reported done', st.todayDone === true);

/* Reading ahead: today's portion stays pinned to this morning's position, but
   the extra pages still count and the true cursor runs past them. */
reset();
const p1b = QT.plans.create({
  name: 'ahead', unit: 'page', mode: 'perDay', amount: 4,
  scope: { kind: 'all' }, startDate: QT.date.today()
});
const eight = QT.index.pageRange(8)[1];
QT.sessions.add({ type: 'read', from: 1, to: eight, seconds: 1800, planId: p1b.id });
st = QT.plans.status(p1b);
eq('read-ahead counts fully', st.doneUnits, 8);
eq("today's portion stays 4 pages", QT.index.pageOf(st.todayTo), 4);
ok('read-ahead ticks today done', st.todayDone === true);
eq('continue point is past the extra pages', QT.index.pageOf(st.nextFrom), 9);

/* Yesterday's reading moves today's anchor forward. */
reset();
const p1c = QT.plans.create({
  name: 'carry', unit: 'page', mode: 'perDay', amount: 4,
  scope: { kind: 'all' }, startDate: QT.date.addDays(QT.date.today(), -1)
});
const four = QT.index.pageRange(4)[1];
QT.sessions.add({ type: 'read', from: 1, to: four, seconds: 900, planId: p1c.id,
                  at: Date.now() - 86400000 });
st = QT.plans.status(p1c);
eq('today starts at page 5', QT.index.pageOf(st.todayFrom), 5);
eq('today ends at page 8', QT.index.pageOf(st.todayTo), 8);
ok('today not done yet', st.todayDone === false);

/* A session on someone else's plan must not count toward this one */
reset();
const p2 = QT.plans.create({ name: 'a', unit: 'page', amount: 2, scope: { kind: 'all' } });
const p3 = QT.plans.create({ name: 'b', unit: 'page', amount: 2, scope: { kind: 'all' } });
QT.sessions.add({ type: 'read', from: 1, to: 200, planId: p3.id });
eq('plans do not share progress', QT.plans.status(p2).doneUnits, 0);
ok('the other plan did advance', QT.plans.status(p3).doneUnits > 0);

/* byDate redistributes as the deadline approaches */
reset();
const soon = QT.date.addDays(QT.date.today(), 9);   /* 10 days inclusive */
const p4 = QT.plans.create({
  name: 'khatm', unit: 'page', mode: 'byDate', endDate: soon,
  scope: { kind: 'all' }, startDate: QT.date.today()
});
st = QT.plans.status(p4);
eq('byDate divides 604 pages over 10 days', st.perDay, Math.ceil(604 / 10));
/* fall behind by a day: with nothing read and one day fewer, the portion grows */
QT.plans.update(p4.id, { endDate: QT.date.addDays(QT.date.today(), 8) });
const st2 = QT.plans.status(QT.plans.get(p4.id));
ok('portion grows when days shrink', st2.perDay > st.perDay,
   `${st.perDay} -> ${st2.perDay}`);

/* scoped plan: one juz only */
reset();
const p5 = QT.plans.create({ name: 'juz 30', unit: 'ayah', amount: 10, scope: { kind: 'juz', juz: 30 } });
st = QT.plans.status(p5);
const j30 = QT.index.juzRange(30);
eq('juz scope total', st.totalUnits, j30[1] - j30[0] + 1);
eq('juz scope starts at the juz', st.cursor, j30[0]);
eq('juz assignment is 10 ayahs', st.todayTo - st.todayFrom + 1, 10);

/* finishing a plan */
reset();
const p6 = QT.plans.create({ name: 'fatihah', unit: 'ayah', amount: 3, scope: { kind: 'surah', surah: 1 } });
QT.sessions.add({ type: 'read', from: 1, to: 7, planId: p6.id });
st = QT.plans.status(p6);
ok('completed plan reports finished', st.finished === true);
eq('completed plan is 100%', st.pct, 100);
eq('completed plan has no assignment', st.todayFrom, null);

/* markTodayDone logs exactly the portion */
reset();
const p7 = QT.plans.create({ name: 'm', unit: 'page', amount: 2, scope: { kind: 'all' } });
QT.plans.markTodayDone(p7);
st = QT.plans.status(p7);
eq('marking done advances 2 pages', st.doneUnits, 2);
eq('marking done logs one session', QT.sessions.list().length, 1);
ok('marked session is flagged manual', QT.sessions.list()[0].manual === true);

/* ===================== streaks ===================== */

reset();
const DAY = 86400000;
const now = Date.now();
QT.sessions.add({ type: 'read', from: 1, to: 7, at: now });
QT.sessions.add({ type: 'read', from: 8, to: 20, at: now - DAY });
QT.sessions.add({ type: 'read', from: 21, to: 30, at: now - 2 * DAY });
eq('three day streak', QT.stats.streak('read'), 3);

reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, at: now - DAY });
QT.sessions.add({ type: 'read', from: 8, to: 20, at: now - 2 * DAY });
eq('streak survives an unread today', QT.stats.streak('read'), 2);

reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, at: now - 2 * DAY });
QT.sessions.add({ type: 'read', from: 8, to: 20, at: now - 3 * DAY });
eq('streak breaks after two idle days', QT.stats.streak('read'), 0);

reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, at: now });
QT.sessions.add({ type: 'read', from: 8, to: 9, at: now });
eq('two sessions in one day are one day', QT.stats.streak('read'), 1);

/* a run across a month boundary — the classic off-by-one */
reset();
const marchFirst = new Date(2026, 2, 1, 12, 0, 0).getTime();
for (let i = 0; i < 5; i++) {
  QT.sessions.add({ type: 'read', from: 1, to: 7, at: marchFirst - i * DAY });
}
eq('longest streak spans Feb->Mar', QT.stats.longestStreak('read'), 5);

/* heatmap length and ordering */
reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, at: now });
const hm = QT.stats.heatmap(30, 'read');
eq('heatmap length', hm.length, 30);
eq('heatmap ends today', hm[29].day, QT.date.today());
ok('heatmap today has data', hm[29].data !== null);
ok('heatmap starts empty', hm[0].data === null);

/* ===================== pace ===================== */

reset();
/* 60 ayahs in 60s, three times => 60 ayahs/min */
for (let i = 0; i < 3; i++) QT.sessions.add({ type: 'read', from: 1, to: 60, seconds: 60, at: now - i * DAY });
const pace = QT.stats.pace('read');
ok('pace computed from three samples', pace !== null);
eq('pace is 60 ayahs per minute', Math.round(pace.ayahsPerMin), 60);
eq('estimate for 120 ayahs is 2 min', Math.round(QT.stats.estimateMinutes(1, 120, 'read')), 2);

reset();
QT.sessions.add({ type: 'read', from: 1, to: 60, seconds: 60 });
ok('pace withheld until enough samples', QT.stats.pace('read') === null);

reset();
QT.sessions.add({ type: 'read', from: 1, to: 60, seconds: 5 });
QT.sessions.add({ type: 'read', from: 1, to: 60, seconds: 5 });
QT.sessions.add({ type: 'read', from: 1, to: 60, seconds: 5 });
ok('sub-30s sessions excluded from pace', QT.stats.pace('read') === null);

/* ===================== live session ===================== */

reset();
QT.live.start('read', 100);
QT.live.mark(150);
QT.live.mark(80);
const live = QT.live.get();
eq('live range widens down', live.from, 80);
eq('live range widens up', live.to, 150);
QT.live.pause();
const held = QT.live.elapsedMs();
ok('paused clock holds', QT.live.elapsedMs() === held);
QT.live.resume();
ok('resumed session is not paused', QT.live.get().pausedAt === null);
eq('short session is discarded', QT.live.stop(), null);
ok('discarded session left no record', QT.sessions.list().length === 0);
ok('stopping clears the live slot', QT.live.get() === null);

/* a long-enough session does commit */
reset();
QT.live.start('read', 1);
const a = QT.live.get();
a.startedAt = Date.now() - 65000;            /* pretend a minute passed */
store.set(QT.keys.active, JSON.stringify(a));
QT.live.mark(30);
const committed = QT.live.stop();
ok('long session commits', committed !== null);
eq('committed range', committed.from + '-' + committed.to, '1-30');
ok('committed seconds are about 65', Math.abs(committed.seconds - 65) <= 2, committed.seconds);

/* ===================== export / import ===================== */

reset();
QT.sessions.add({ type: 'read', from: 1, to: 7, seconds: 100 });
QT.plans.create({ name: 'x', unit: 'page', amount: 3 });
store.set('quran.bookmarks.v1', JSON.stringify({ 2: [255] }));
const dump = QT.io.export();
eq('export format tag', dump.format, 'quran-tracker');
ok('export carries sessions', dump.data.sessions.length === 1);
ok('export carries bookmarks', dump.data.bookmarks['2'][0] === 255);

reset();
ok('store really is empty', QT.sessions.list().length === 0);
QT.io.import(dump, 'replace');
eq('import restores sessions', QT.sessions.list().length, 1);
eq('import restores plans', QT.plans.list().length, 1);
ok('import restores bookmarks', JSON.parse(store.get('quran.bookmarks.v1'))['2'][0] === 255);

/* merge must not duplicate what is already there */
QT.io.import(dump, 'merge');
eq('merge is idempotent', QT.sessions.list().length, 1);

/* a foreign file is rejected */
let rejected = false;
try { QT.io.import({ format: 'something-else' }); } catch (e) { rejected = true; }
ok('foreign import rejected', rejected);

/* ===================== formatting ===================== */

eq('arabic digits', QT.fmt.ar(2026), '٢٠٢٦');
eq('duration under a minute', QT.fmt.duration(45), '٤٥ ث');
eq('duration minutes', QT.fmt.duration(125), '٢ د ٥ ث');
eq('duration hours', QT.fmt.duration(3725), '١ س ٢ د');
eq('label of Ayat al-Kursi', QT.index.label(262), 'البقرة ٢٥٥');
eq('range label within a surah', QT.index.rangeLabel(8, 10), 'البقرة ١–٣');
ok('range label across surahs mentions both',
   QT.index.rangeLabel(1, 10).indexOf('الفاتحة') === 0 &&
   QT.index.rangeLabel(1, 10).indexOf('البقرة') > 0);
eq('href into the reader', QT.index.href(262), 'surah.html?s=2&a=255');
eq('relative day today', QT.fmt.relativeDay(QT.date.today()), 'اليوم');
eq('relative day tomorrow', QT.fmt.relativeDay(QT.date.addDays(QT.date.today(), 1)), 'غداً');

/* date helpers across a leap day and a year boundary */
eq('leap day exists in 2028', QT.date.addDays('2028-02-28', 1), '2028-02-29');
eq('non-leap year skips it', QT.date.addDays('2026-02-28', 1), '2026-03-01');
eq('year rolls over', QT.date.addDays('2026-12-31', 1), '2027-01-01');
eq('days between across a year', QT.date.daysBetween('2026-12-25', '2027-01-05'), 11);

/* ===================== programmes ===================== */

const PROG = sandbox.QURAN_PROGRAMS;
eq('two programmes shipped', Object.keys(PROG).length, 2);
eq('forty nights', PROG.qiyam40.steps.length, 40);
eq('seven manazil', PROG.manzil7.steps.length, 7);

/* Each programme must tile the whole mushaf exactly once — this is the
   property the whole design rests on, so it is asserted at runtime too. */
for (const key of ['qiyam40', 'manzil7']) {
  const flat = [];
  for (const s of PROG[key].steps) for (const r of s.r) flat.push([r[0], r[1]]);
  const merged = I.normalize(flat);
  const summed = flat.reduce((n, r) => n + r[1] - r[0] + 1, 0);
  eq(key + ' tiles the mushaf', JSON.stringify(merged), '[[1,6236]]');
  eq(key + ' never repeats an ayah', summed, 6236);
}

/* every night's four rakaat rebuild that night */
let rakOk = true;
for (const n of PROG.qiyam40.steps) {
  if (n.rakaat.length !== 4) { rakOk = false; break; }
  const flat = [];
  for (const rk of n.rakaat) for (const r of rk.r) flat.push([r[0], r[1]]);
  if (JSON.stringify(I.normalize(flat)) !== JSON.stringify(I.normalize(n.r.map(r => [r[0], r[1]])))) {
    rakOk = false; break;
  }
}
ok('every night is rebuilt by its four rakaat', rakOk);

eq('eight themed nights', PROG.qiyam40.steps.filter(n => n.themed).length, 8);
ok('every themed night is split', PROG.qiyam40.steps.every(n => !n.themed || n.r.length > 1));

/* The last nights are fragmented too, and legitimately so: a surah pulled
   forward into an earlier themed night is removed from where it would
   otherwise have fallen, leaving gaps behind. That is what keeps the khatm at
   exactly 6,236 with nothing read twice — so the property worth asserting is
   that every gap in a late night is filled by some earlier themed night, which
   the tiling check above already proves. What is checked here is only that the
   fragmentation is confined to the back of the mushaf, where the pulls came
   from. */
const splitUnthemed = PROG.qiyam40.steps.filter(n => !n.themed && n.r.length > 1);
ok('only the closing nights are fragmented',
   splitUnthemed.every(n => n.n >= 35), splitUnthemed.map(n => n.n).join(','));
ok('every night has a title', PROG.qiyam40.steps.every(n => n.title.length > 0));
ok('every manzil has key passages', PROG.manzil7.steps.every(d => d.keys.length > 0));
ok('every manzil has three sittings', PROG.manzil7.steps.every(d => d.sittings.length === 3));
eq('the mnemonic is carried', PROG.manzil7.mnemonic, 'فَمِي بِشَوْقٍ');

/* ---- stepped plans ---- */

reset();
const qp = QT.plans.startProgram('qiyam40');
eq('starting a programme creates a plan', QT.plans.list().length, 1);
eq('it is a stepped plan', qp.mode, 'steps');
eq('starting twice reuses the same plan', QT.plans.startProgram('qiyam40').id, qp.id);
eq('still just one plan', QT.plans.list().length, 1);

let ps = QT.plans.status(qp);
eq('forty steps total', ps.totalUnits, 40);
eq('none done yet', ps.doneUnits, 0);
eq('starts on step one', ps.stepIndex, 0);
eq("tonight's portion is night one", ps.step.n, 1);
eq('night one is a single stretch', ps.todayRanges.length, 1);
ok('not finished', ps.finished === false);

QT.plans.completeStep(qp, 0);
ps = QT.plans.status(qp);
eq('one night done', ps.doneUnits, 1);
ok('tonight now reads as done', ps.todayDone === true);
eq('the next night is two', ps.steps[ps.nextIndex].n, 2);

/* a themed night is two disjoint stretches and both must be logged */
reset();
const qp2 = QT.plans.startProgram('qiyam40');
const themedIdx = PROG.qiyam40.steps.findIndex(n => n.themed);
eq('night 15 is the first themed one', PROG.qiyam40.steps[themedIdx].n, 15);
eq('it has two stretches', PROG.qiyam40.steps[themedIdx].r.length, 2);
QT.plans.completeStep(qp2, themedIdx);
ok('completing it logged both stretches', QT.sessions.list().length === 2);
ok('the themed night reads as complete',
   QT.plans.stepComplete(PROG.qiyam40.steps[themedIdx], QT.sessions.coverage('read', qp2.id)));

/* logging only the main stretch must NOT complete a themed night */
reset();
const qp3 = QT.plans.startProgram('qiyam40');
const themed = PROG.qiyam40.steps[themedIdx];
QT.sessions.add({ type: 'read', from: themed.r[0][0], to: themed.r[0][1], planId: qp3.id });
ok('the pulled surah is still outstanding',
   QT.plans.stepComplete(themed, QT.sessions.coverage('read', qp3.id)) === false);

/* undo */
reset();
const qp4 = QT.plans.startProgram('qiyam40');
QT.plans.completeStep(qp4, 0);
eq('marked done', QT.plans.status(qp4).doneUnits, 1);
QT.plans.clearStep(qp4, 0);
eq('undo removed it', QT.plans.status(qp4).doneUnits, 0);
eq('and removed the session', QT.sessions.list().length, 0);

/* undo leaves a real timed session alone */
reset();
const qp5 = QT.plans.startProgram('qiyam40');
const n1 = PROG.qiyam40.steps[0];
QT.sessions.add({ type: 'read', from: n1.r[0][0], to: n1.r[0][1], seconds: 900, planId: qp5.id });
QT.plans.clearStep(qp5, 0);
eq('a timed session survives undo', QT.sessions.list().length, 1);

/* completing all forty finishes the khatm */
reset();
const qp6 = QT.plans.startProgram('qiyam40');
for (let i = 0; i < 40; i++) QT.plans.completeStep(qp6, i);
ps = QT.plans.status(qp6);
ok('the khatm completes', ps.finished === true);
eq('at a hundred percent', ps.pct, 100);
eq('all forty counted', ps.doneUnits, 40);
ok('and the whole mushaf is covered',
   JSON.stringify(QT.sessions.coverage('read', qp6.id)) === '[[1,6236]]');

/* the seven-day programme behaves the same way */
reset();
const mp = QT.plans.startProgram('manzil7');
eq('seven steps', QT.plans.status(mp).totalUnits, 7);
eq('day one opens at Al-Fatihah', QT.plans.status(mp).todayFrom, 1);
for (let i = 0; i < 7; i++) QT.plans.completeStep(mp, i);
ok('a week completes the khatm', QT.plans.status(mp).finished === true);
ok('covering everything',
   JSON.stringify(QT.sessions.coverage('read', mp.id)) === '[[1,6236]]');

/* both programmes at once must not contaminate each other */
reset();
const a1 = QT.plans.startProgram('qiyam40');
const b1 = QT.plans.startProgram('manzil7');
QT.plans.completeStep(b1, 0);
eq('the manzil advanced', QT.plans.status(b1).doneUnits, 1);
eq('the qiyam did not', QT.plans.status(a1).doneUnits, 0);

/* an unknown programme is refused */
let badProg = false;
try { QT.plans.startProgram('nope'); } catch (e) { badProg = true; }
ok('unknown programme rejected', badProg);

/* ===================== hifz: queues ===================== */

const H = QT.hifz;
const back = n => QT.date.addDays(QT.date.today(), -n);

reset();
H.add(1);
eq('a new page starts in sabaq', I.queueOf(H.get(1), QT.date.today()), 'sabaq');
eq('sabaq page is due', I.isDue(H.get(1), QT.date.today()), true);
eq('queues put it in sabaq', H.queues().sabaq.length, 1);

H.promote(1);
eq('promoted page is memorised', H.get(1).state, 'memorized');
eq('promotion lands in sabqi', I.queueOf(H.get(1), QT.date.today()), 'sabqi');
eq('promotion logs a hifz session', QT.sessions.list({ type: 'hifz' }).length, 1);

/* the sabqi window edge — 7 days by default, so day 6 is still sabqi, day 7 is manzil */
reset();
H.add(1); H.promote(1);
let rec = H.get(1);
rec.learnedOn = back(6);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 1: rec }, slips: {} }));
eq('day 6 is still sabqi', I.queueOf(H.get(1), QT.date.today()), 'sabqi');
rec.learnedOn = back(7);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 1: rec }, slips: {} }));
eq('day 7 graduates to manzil', I.queueOf(H.get(1), QT.date.today()), 'manzil');

/* sabqi is due every single day whatever the interval says */
reset();
H.add(2); H.promote(2);
rec = H.get(2);
rec.due = QT.date.addDays(QT.date.today(), 30);
rec.learnedOn = back(2);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 2: rec }, slips: {} }));
ok('sabqi ignores a far-off due date', I.isDue(H.get(2), QT.date.today()) === true);
eq('sabqi page appears in the sabqi queue', H.queues().sabqi.length, 1);

/* manzil respects its due date */
reset();
H.add(3); H.promote(3);
rec = H.get(3);
rec.learnedOn = back(40);
rec.due = QT.date.addDays(QT.date.today(), 5);
rec.interval = 10;
store.set(QT.keys.hifz, JSON.stringify({ pages: { 3: rec }, slips: {} }));
ok('manzil not yet due is excluded', I.isDue(H.get(3), QT.date.today()) === false);
eq('it waits in "later"', H.queues().later.length, 1);
eq('and not in manzil', H.queues().manzil.length, 0);

/* overdue pages come first */
reset();
[10, 11, 12].forEach(p => { H.add(p); H.promote(p); });
const pages = {};
[[10, 2], [11, 20], [12, 9]].forEach(([p, overdueBy]) => {
  const r = H.get(p);
  r.learnedOn = back(60);
  r.interval = 10;
  r.due = back(overdueBy);
  pages[p] = r;
});
store.set(QT.keys.hifz, JSON.stringify({ pages, slips: {} }));
eq('most overdue sorts first', H.queues().manzil[0].p, 11);
eq('least overdue sorts last', H.queues().manzil[2].p, 10);

/* ===================== hifz: scheduling ===================== */

function manzilPage(p, over) {
  const r = I.blankPage(p, 'memorized', back(60));
  r.interval = 10;
  r.reps = 2;
  r.due = back(over || 0);
  r.lastReview = back(10);
  return r;
}

reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { 20: manzilPage(20) }, slips: {} }));
const before = H.get(20).interval;
H.rate(20, 'clean');
ok('clean grows the interval', H.get(20).interval > before, `${before} -> ${H.get(20).interval}`);
ok('clean raises ease', H.get(20).ease > I.DEFAULT_PREFS.startEase);
eq('clean advances reps', H.get(20).reps, 3);
eq('review is scheduled forward', QT.date.daysBetween(QT.date.today(), H.get(20).due), H.get(20).interval);

reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { 21: manzilPage(21) }, slips: {} }));
H.rate(21, 'forgot');
eq('forgot collapses the interval to 1', H.get(21).interval, 1);
eq('forgot counts a lapse', H.get(21).lapses, 1);
eq('forgot resets the rep streak', H.get(21).reps, 0);
ok('forgot lowers ease', H.get(21).ease < I.DEFAULT_PREFS.startEase);
eq('forgot schedules tomorrow', H.get(21).due, QT.date.addDays(QT.date.today(), 1));

reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { 22: manzilPage(22) }, slips: {} }));
H.rate(22, 'shaky');
eq('shaky grows only slightly', H.get(22).interval, 12);
ok('shaky lowers ease a little', H.get(22).ease < I.DEFAULT_PREFS.startEase);
eq('shaky does not count a lapse', H.get(22).lapses, 0);

/* the interval cap */
reset();
const big = manzilPage(23);
big.interval = 55;
big.ease = 2.8;
store.set(QT.keys.hifz, JSON.stringify({ pages: { 23: big }, slips: {} }));
H.rate(23, 'clean');
eq('interval is capped', H.get(23).interval, I.DEFAULT_PREFS.maxInterval);

/* ease floor holds under repeated failure */
reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { 24: manzilPage(24) }, slips: {} }));
for (let i = 0; i < 15; i++) H.rate(24, 'forgot');
ok('ease never drops below the floor', H.get(24).ease >= I.DEFAULT_PREFS.minEase);
eq('every failure was counted', H.get(24).lapses, 15);

/* a first clean review of a never-scheduled page */
reset();
const fresh = I.blankPage(30, 'memorized', back(30));
store.set(QT.keys.hifz, JSON.stringify({ pages: { 30: fresh }, slips: {} }));
H.rate(30, 'clean');
eq('first clean review gets 3 days', H.get(30).interval, 3);

/* forgetting during sabqi drops the page back to sabaq */
reset();
H.add(40); H.promote(40);
rec = H.get(40);
rec.learnedOn = back(3);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 40: rec }, slips: {} }));
H.rate(40, 'forgot');
eq('sabqi failure returns to learning', H.get(40).state, 'learning');
eq('and back into the sabaq queue', H.queues().sabaq.length, 1);
eq('the lapse is recorded', H.get(40).lapses, 1);

/* a clean sabqi review keeps it in sabqi and does not start an interval */
reset();
H.add(41); H.promote(41);
rec = H.get(41);
rec.learnedOn = back(3);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 41: rec }, slips: {} }));
H.rate(41, 'clean');
eq('clean sabqi stays memorised', H.get(41).state, 'memorized');
eq('clean sabqi stays in sabqi', I.queueOf(H.get(41), QT.date.today()), 'sabqi');

/* every rating logs a review session */
reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { 25: manzilPage(25) }, slips: {} }));
H.rate(25, 'clean', 240);
eq('rating logs a review session', QT.sessions.list({ type: 'review' }).length, 1);
eq('the session covers the page', QT.sessions.list({ type: 'review' })[0].from, QT.index.pageRange(25)[0]);
eq('timed review keeps its seconds', QT.sessions.list({ type: 'review' })[0].seconds, 240);

/* an unknown rating is refused rather than silently mis-scheduling */
let badRating = false;
try { H.rate(25, 'excellent'); } catch (e) { badRating = true; }
ok('unknown rating rejected', badRating);

/* ===================== hifz: bulk entry ===================== */

reset();
const added = H.addRange(1, 20);
eq('bulk add creates every page', added, 20);
eq('bulk added pages are memorised', H.all().filter(r => r.state === 'memorized').length, 20);
eq('bulk add skips sabqi entirely', H.queues().sabqi.length, 0);
ok('bulk add spreads the first reviews', H.queues().manzil.length < 20,
   `${H.queues().manzil.length} due at once`);
ok('bulk add leaves some for later', H.queues().later.length > 0);
eq('re-adding does not duplicate', H.addRange(1, 20), 0);
eq('page count is unchanged', H.all().length, 20);

reset();
H.addRange(600, 604, { memorized: false });
eq('bulk add can create learning pages', H.queues().sabaq.length, 5);

reset();
H.addRange(5, 1);
eq('reversed bulk range is normalised', H.all().length, 5);

/* ===================== hifz: slips ===================== */

reset();
const kursi = QT.index.toGlobal(2, 255);
H.slip(kursi); H.slip(kursi); H.slip(QT.index.toGlobal(2, 254));
eq('slips are counted', H.weakest()[0].g, kursi);
eq('slip count recorded', H.weakest()[0].n, 2);
eq('two ayahs tracked', H.weakest().length, 2);
eq('slips found on their page', H.slipsOn(QT.index.pageOf(kursi)).length, 2);
H.clearSlip(kursi);
eq('cleared slip is gone', H.weakest().length, 1);

/* a clean recitation fades the page's slips */
reset();
const p42 = QT.index.pageOf(kursi);
store.set(QT.keys.hifz, JSON.stringify({ pages: { [p42]: manzilPage(p42) }, slips: {} }));
H.slip(kursi); H.slip(kursi); H.slip(kursi);
eq('three slips logged', H.weakest()[0].n, 3);
H.rate(p42, 'clean');
eq('a clean review fades one slip', H.weakest()[0].n, 2);
H.rate(p42, 'clean');
H.rate(p42, 'clean');
eq('repeated clean reviews clear it', H.weakest().length, 0);

/* a shaky review does not fade slips */
reset();
store.set(QT.keys.hifz, JSON.stringify({ pages: { [p42]: manzilPage(p42) }, slips: {} }));
H.slip(kursi);
H.rate(p42, 'shaky');
eq('shaky leaves slips alone', H.weakest()[0].n, 1);

/* recency outranks raw count */
reset();
const old = QT.index.toGlobal(2, 100), recent = QT.index.toGlobal(2, 200);
const store2 = { pages: {}, slips: {} };
store2.slips[old] = { n: 6, last: Date.now() - 200 * 86400000 };
store2.slips[recent] = { n: 2, last: Date.now() };
store.set(QT.keys.hifz, JSON.stringify(store2));
eq('recent slips outrank stale ones', H.weakest()[0].g, recent);

/* ===================== hifz: overview ===================== */

reset();
H.addRange(1, 302);              /* half the muṣḥaf */
let hs = H.stats();
eq('memorised count', hs.memorized, 302);
eq('percentage of the muṣḥaf', hs.pct, 50);
eq('juz equivalent', hs.juz, 15);
eq('nothing is still being learned', hs.learning, 0);

reset();
H.add(1); H.add(2);
hs = H.stats();
eq('learning pages counted', hs.learning, 2);
eq('learning pages are all due', hs.dueToday, 2);
eq('none memorised yet', hs.memorized, 0);

/* coverage map */
reset();
H.addRange(1, 10);
const cov = H.coverage();
eq('coverage covers every page', cov.length, 604);
eq('untracked pages report none', cov[500].state, 'none');
eq('tracked pages report their state', cov[0].state, 'memorized');
ok('every heat value is in range', cov.every(c => c.heat >= 0 && c.heat <= 1));

/* heat decays as a page goes unreviewed */
reset();
const warm = manzilPage(50);
warm.lastReview = QT.date.today();
const cold = manzilPage(51);
cold.lastReview = back(30);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 50: warm, 51: cold }, slips: {} }));
const c2 = H.coverage();
ok('freshly reviewed page is hot', c2[49].heat > 0.9);
ok('long-unreviewed page is cold', c2[50].heat === 0, String(c2[50].heat));

/* prefs round-trip and affect the window */
reset();
H.setPrefs({ sabqiDays: 3 });
eq('pref saved', H.prefs().sabqiDays, 3);
eq('other prefs keep their defaults', H.prefs().maxInterval, I.DEFAULT_PREFS.maxInterval);
H.add(60); H.promote(60);
rec = H.get(60);
rec.learnedOn = back(4);
store.set(QT.keys.hifz, JSON.stringify({ pages: { 60: rec }, slips: {} }));
eq('a shorter window graduates sooner', I.queueOf(H.get(60), QT.date.today()), 'manzil');
H.setPrefs({ sabqiDays: I.DEFAULT_PREFS.sabqiDays });

/* hifz data survives export and import */
reset();
H.addRange(1, 5);
H.slip(kursi);
const hdump = QT.io.export();
reset();
QT.io.import(hdump, 'replace');
eq('hifz pages restored', H.all().length, 5);
eq('slips restored', H.weakest().length, 1);

/* ===================== marks ===================== */

const MK = QT.marks;
const kursiG = QT.index.toGlobal(2, 255);

reset();
ok('ships default categories', MK.cats().length === 5);
ok('every default has a colour', MK.cats().every(c => /^#[0-9A-F]{6}$/i.test(c.color)));

/* single ayah */
reset();
const m1 = MK.add({ cat: 'tadabbur', from: kursiG });
eq('a single ayah is a range of one', m1.from, m1.to);
eq('it is findable at that ayah', MK.at(kursiG).length, 1);
eq('and nowhere else', MK.at(kursiG + 1).length, 0);
eq('it appears in the list', MK.list().length, 1);

/* a range */
reset();
const from = QT.index.toGlobal(3, 190), to = QT.index.toGlobal(3, 194);
MK.add({ cat: 'dua', from: from, to: to });
eq('the whole range is covered', MK.at(QT.index.toGlobal(3, 192)).length, 1);
eq('the first ayah is in', MK.at(from).length, 1);
eq('the last ayah is in', MK.at(to).length, 1);
eq('one before is out', MK.at(from - 1).length, 0);
eq('one after is out', MK.at(to + 1).length, 0);

/* reversed input is normalised, not rejected */
reset();
const rev2 = MK.add({ cat: 'dua', from: to, to: from });
eq('a reversed range is flipped', rev2.from, from);
eq('and its end is right', rev2.to, to);

/* the same span twice in one category is one mark */
reset();
const a1m = MK.add({ cat: 'hifz', from: kursiG });
const a2m = MK.add({ cat: 'hifz', from: kursiG });
eq('marking twice is idempotent', MK.list().length, 1);
eq('and returns the same record', a1m.id, a2m.id);

/* but the same ayah can carry several categories */
reset();
MK.add({ cat: 'hifz', from: kursiG });
MK.add({ cat: 'dua', from: kursiG });
MK.add({ cat: 'tadabbur', from: kursiG });
eq('three categories on one ayah', MK.at(kursiG).length, 3);

/* toggle */
reset();
MK.toggle(kursiG, 'hifz');
eq('toggle marks', MK.at(kursiG).length, 1);
MK.toggle(kursiG, 'hifz');
eq('toggle unmarks', MK.at(kursiG).length, 0);
MK.toggle(kursiG, 'hifz');
MK.toggle(kursiG, 'dua');
eq('toggling another category is independent', MK.at(kursiG).length, 2);
MK.toggle(kursiG, 'hifz');
eq('and removes only its own', MK.at(kursiG).length, 1);
eq('leaving the right one', MK.at(kursiG)[0].cat, 'dua');

/* a toggle must not remove a range that merely contains the ayah */
reset();
MK.add({ cat: 'hifz', from: from, to: to });
MK.toggle(QT.index.toGlobal(3, 192), 'hifz');
eq('toggling inside a range adds rather than deletes', MK.list().length, 2);

/* notes */
reset();
const nm = MK.add({ cat: 'question', from: kursiG, note: 'لماذا هنا؟' });
eq('a note is stored', MK.get(nm.id).note, 'لماذا هنا؟');
MK.update(nm.id, { note: 'سؤال آخر' });
eq('and can be edited', MK.get(nm.id).note, 'سؤال آخر');
MK.update(nm.id, { cat: 'dua' });
eq('a mark can change category', MK.get(nm.id).cat, 'dua');
MK.update(nm.id, { cat: 'nonexistent' });
eq('an unknown category is refused', MK.get(nm.id).cat, 'dua');

/* lookup by page and range */
reset();
MK.add({ cat: 'hifz', from: kursiG });
const kursiPage = QT.index.pageOf(kursiG);
eq('found on its page', MK.onPage(kursiPage).length, 1);
eq('not on the next page', MK.onPage(kursiPage + 1).length, 0);
eq('found by range query', MK.inRange(1, 6236).length, 1);

/* mapOver: what the reader paints from */
reset();
MK.add({ cat: 'hifz', from: from, to: to });
MK.add({ cat: 'dua', from: from, to: from });
const map = MK.mapOver(from - 2, to + 2);
eq('the first ayah carries two categories', map[from].length, 2);
eq('a middle ayah carries one', map[from + 1].length, 1);
ok('outside the range is unpainted', map[from - 1] === undefined);
ok('mapOver clips to the window', MK.mapOver(from + 1, from + 1)[from] === undefined);

/* counts and filters */
reset();
MK.add({ cat: 'hifz', from: 10 });
MK.add({ cat: 'hifz', from: 20 });
MK.add({ cat: 'dua', from: 30 });
eq('counted per category', MK.counts().hifz, 2);
eq('and the other', MK.counts().dua, 1);
eq('filtered by category', MK.list({ cat: 'hifz' }).length, 2);
/* globals 10, 20 and 30 all fall in Al-Baqarah — Al-Fatihah ends at 7 */
eq('filtered by surah', MK.list({ surah: 2 }).length, 3);
eq('Al-Fatihah holds none of them', MK.list({ surah: 1 }).length, 0);
eq('a surah with none', MK.list({ surah: 50 }).length, 0);
eq('the list is sorted by position', MK.list()[0].from, 10);

/* a mark spanning a surah boundary shows up under both */
reset();
MK.add({ cat: 'hifz', from: QT.index.toGlobal(1, 6), to: QT.index.toGlobal(2, 3) });
eq('found under the first surah', MK.list({ surah: 1 }).length, 1);
eq('and under the second', MK.list({ surah: 2 }).length, 1);
eq('but not a third', MK.list({ surah: 3 }).length, 0);

/* categories */
reset();
const nc = MK.addCat('ليلي', '#123456');
eq('a category can be added', MK.cats().length, 6);
eq('with its colour', MK.cat(nc.id).color, '#123456');
MK.updateCat(nc.id, { name: 'مُعاد التسمية', color: '#654321' });
eq('renamed', MK.cat(nc.id).name, 'مُعاد التسمية');
eq('recoloured', MK.cat(nc.id).color, '#654321');

/* deleting a category takes its marks, or moves them */
reset();
MK.add({ cat: 'hifz', from: 10 });
MK.add({ cat: 'hifz', from: 20 });
MK.add({ cat: 'dua', from: 30 });
MK.removeCat('hifz', 'dua');
eq('moved marks survive', MK.list().length, 3);
eq('and all belong to the new category', MK.list({ cat: 'dua' }).length, 3);
eq('the category is gone', MK.cat('hifz'), null);

reset();
MK.add({ cat: 'hifz', from: 10 });
MK.add({ cat: 'dua', from: 30 });
MK.removeCat('hifz');
eq('deleting without a target drops its marks', MK.list().length, 1);
eq('and leaves the others', MK.list()[0].cat, 'dua');

/* the last category cannot go */
reset();
let cats = MK.cats().slice();
for (let i = 0; i < cats.length - 1; i++) MK.removeCat(cats[i].id);
eq('one category left', MK.cats().length, 1);
ok('the last one is refused', MK.removeCat(MK.cats()[0].id) === false);
eq('still there', MK.cats().length, 1);

/* migration from the old single-colour bookmarks */
reset();
store.set('quran.bookmarks.v1', JSON.stringify({ 2: [255, 285], 3: [190] }));
QT.marks.migrate();
eq('legacy bookmarks carried over', MK.list().length, 3);
ok('all landed in one category', new Set(MK.list().map(m => m.cat)).size === 1);
ok('positions are right', MK.at(QT.index.toGlobal(2, 255)).length === 1);
ok('and the second surah too', MK.at(QT.index.toGlobal(3, 190)).length === 1);
ok('they are flagged as legacy', MK.list().every(m => m.legacy === true));
QT.marks.migrate();
eq('migration does not run twice', MK.list().length, 3);

/* no legacy data is not an error */
reset();
QT.marks.migrate();
eq('nothing to migrate is fine', MK.list().length, 0);

/* marks survive export and import */
reset();
MK.add({ cat: 'hifz', from: kursiG, note: 'ملاحظة' });
MK.addCat('خاص', '#ABCDEF');
const mdump = QT.io.export();
reset();
QT.io.import(mdump, 'replace');
eq('marks restored', MK.list().length, 1);
eq('the note came with it', MK.list()[0].note, 'ملاحظة');
ok('custom categories restored', MK.cats().some(c => c.name === 'خاص'));

/* clamping */
reset();
const clamped = MK.add({ cat: 'hifz', from: 0, to: 99999 });
eq('range start clamped', clamped.from, 1);
eq('range end clamped', clamped.to, 6236);

/* ===================== report ===================== */

console.log('');
console.log(passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  console.log('');
  failures.forEach(f => console.log('  FAIL  ' + f));
  process.exit(1);
}
console.log('tracker.js is behaving.');
