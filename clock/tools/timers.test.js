import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/timers.js';

const MIN = 60_000;
const t0 = Date.UTC(2026, 8, 24, 12, 0, 0) + 400; // 0.4 s past a whole second

test('a new timer runs and ends on a whole second', () => {
  const t = T.createTimer({ label: 'Tea', duration: 3 * MIN }, t0);
  assert.equal(t.state, 'running');
  assert.equal(t.endAt % 1000, 0);
  assert.equal(t.endAt, t0 - 400 + 3 * MIN);
  assert.deepEqual(T.face(t, t0), { seconds: 180, over: false });
  assert.deepEqual(T.face(t, t0 + 600), { seconds: 179, over: false }); // next whole second
});

test('pause keeps the seconds that were showing; resume realigns to the second', () => {
  let t = T.createTimer({ duration: MIN }, t0);
  t = T.toggle(t, t0 + 10_250); // 49.75 s left, face shows 50
  assert.equal(t.state, 'paused');
  assert.equal(t.remaining, 50_000);
  assert.deepEqual(T.face(t, t0 + 99_999), { seconds: 50, over: false });

  const resumeAt = t0 + 120_700;
  t = T.toggle(t, resumeAt);
  assert.equal(t.state, 'running');
  assert.equal(t.endAt % 1000, 0);
  assert.deepEqual(T.face(t, resumeAt), { seconds: 50, over: false });
});

test('a timer rings once its end passes, then counts up', () => {
  const t = T.createTimer({ duration: 5000 }, t0);
  assert.equal(T.settle(t, t.endAt - 1), t, 'unchanged objects are returned as-is');
  const ringing = T.settle(t, t.endAt);
  assert.equal(ringing.state, 'ringing');
  assert.deepEqual(T.face(ringing, t.endAt + 20), { seconds: 0, over: true });
  assert.deepEqual(T.face(ringing, t.endAt + 12_020), { seconds: 12, over: true });
  assert.equal(T.progress(ringing, t.endAt + 5), 0);
});

test('tapping a ringing timer resets it to ready', () => {
  const t = T.createTimer({ duration: 5000 }, t0);
  const done = T.toggle(t, t.endAt + 3000); // settles to ringing first, then dismisses
  assert.equal(done.state, 'idle');
  assert.equal(done.remaining, 5000);
  assert.deepEqual(T.face(done, t0 + MIN), { seconds: 5, over: false });
  assert.equal(T.toggle(done, t0 + MIN).state, 'running');
});

test('progress runs from 1 to 0', () => {
  const t = T.createTimer({ duration: 10_000 }, t0 - 400);
  assert.equal(T.progress(t, t0 - 400), 1);
  assert.equal(T.progress(t, t0 - 400 + 5000), 0.5);
  assert.equal(T.progress(T.reset(t), t0 + 9999), 1);
});

test('only running and ringing timers need a per-second tick', () => {
  const t = T.createTimer({ duration: 5000 }, t0);
  assert.equal(T.needsTicks(t), true);
  assert.equal(T.needsTicks(T.toggle(t, t0)), false);
  assert.equal(T.needsTicks(T.reset(t)), false);
  assert.equal(T.needsTicks(T.settle(t, t.endAt)), true);
});

test('ids stay unique when timers are created in the same millisecond', () => {
  const a = T.createTimer({ duration: 1000 }, t0);
  const b = T.createTimer({ duration: 1000 }, t0);
  assert.notEqual(a.id, b.id);
});

test('recents are most-recent-first, de-duplicated and capped', () => {
  let r = [];
  r = T.remember(r, { label: 'Tea', duration: 180_000 });
  r = T.remember(r, { label: '', duration: 300_000 });
  r = T.remember(r, { label: 'Tea', duration: 180_000 });
  assert.deepEqual(r.map((x) => x.label), ['Tea', '']);
  for (let i = 1; i <= 5; i++) r = T.remember(r, { label: `T${i}`, duration: i * 1000 });
  assert.equal(r.length, 4);
  assert.equal(r[0].label, 'T5');
});

test('priority is set at creation, defaults to normal, and survives every transition', () => {
  assert.equal(T.createTimer({ duration: 5000 }, t0).priority, 'normal');
  let t = T.createTimer({ label: 'Oven', duration: 5000, priority: 'high' }, t0);
  for (const step of [(x) => T.toggle(x, t0 + 1000), (x) => T.toggle(x, t0 + 2000), (x) => T.settle(x, x.endAt), (x) => T.reset(x)]) {
    t = step(t);
    assert.equal(t.priority, 'high');
  }
});

test('a repeated recent keeps the priority it was last started with', () => {
  let r = T.remember([], { label: 'Tea', duration: 180_000, priority: 'normal' });
  r = T.remember(r, { label: 'Tea', duration: 180_000, priority: 'high' });
  assert.deepEqual(r, [{ label: 'Tea', duration: 180_000, priority: 'high' }]);
});
