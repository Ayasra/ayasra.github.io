import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, load, save, defaultSettings } from '../js/store.js';

function memory(initial) {
  const data = new Map(initial ? [[KEY, initial]] : []);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('empty storage gives defaults', () => {
  const s = load(memory());
  assert.deepEqual(s.settings, defaultSettings());
  assert.deepEqual(s.timers, []);
  assert.equal(s.hinted, false);
});

test('round-trips state', () => {
  const store = memory();
  const state = load(store);
  state.settings.face = 'type';
  state.timers.push({ id: 'a', label: 'Tea', duration: 180000, state: 'paused', remaining: 90000, endAt: 0, priority: 'high' });
  save(state, store);
  const again = load(store);
  assert.equal(again.settings.face, 'type');
  assert.deepEqual(again.timers, state.timers);
});

test('corrupt or hostile data never breaks start-up', () => {
  assert.deepEqual(load(memory('{not json')).timers, []);
  const s = load(memory(JSON.stringify({
    settings: { face: 'analog', color: 42, seconds: 'yes', nightFrom: '25:00', night: 'on' },
    timers: [{ id: 'x' }, null, { id: 'b', label: '', duration: -1, state: 'running', remaining: 0, endAt: 0 }],
    recents: 'nope',
  })));
  assert.equal(s.settings.face, 'segment');
  assert.equal(s.settings.color, 'paper');
  assert.equal(s.settings.seconds, false);
  assert.equal(s.settings.nightFrom, '22:00');
  assert.equal(s.settings.night, 'on');
  assert.deepEqual(s.timers, []);
  assert.deepEqual(s.recents, []);
});

test('a full or blocked storage is tolerated', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.doesNotThrow(() => save(load(broken), broken));
});

test('priority: saved values are kept, missing or unknown ones become normal', () => {
  const timer = (id, priority) => ({ id, label: '', duration: 60000, state: 'idle', remaining: 60000, endAt: 0, priority });
  const s = load(memory(JSON.stringify({
    timers: [timer('a', 'high'), timer('b', undefined), timer('c', 'urgent')],
    recents: [{ label: 'Tea', duration: 180000 }, { label: 'Oven', duration: 60000, priority: 'high' }],
  })));
  assert.deepEqual(s.timers.map((t) => t.priority), ['high', 'normal', 'normal']);
  assert.deepEqual(s.recents.map((r) => r.priority), ['normal', 'high']);
});
