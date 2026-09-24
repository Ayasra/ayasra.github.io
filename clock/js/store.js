// Settings, timers and recents in localStorage, one entry per device. Everything read back
// is validated, so a corrupt or outdated entry can never stop the clock from starting.
// The key follows the site's "<app>.<what>.v1" pattern, as other apps share this origin.

import { MAX_TIMERS } from './timers.js';

export const KEY = 'clock.state.v1';

const CHOICES = {
  face: ['segment', 'type'],
  color: ['paper', 'amber', 'phosphor', 'ice', 'red'],
  night: ['off', 'auto', 'on'],
  sound: ['chime', 'digital', 'soft'],
};
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATES = ['idle', 'running', 'paused', 'ringing'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function localeHour12() {
  try {
    return Boolean(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12);
  } catch {
    return false;
  }
}

export function defaultSettings() {
  return {
    face: 'segment',
    color: 'paper',
    hour12: localeHour12(),
    seconds: false,
    night: 'auto',
    nightFrom: '22:00',
    nightTo: '07:00',
    sound: 'chime',
  };
}

function cleanSettings(raw) {
  const s = defaultSettings();
  if (!raw || typeof raw !== 'object') return s;
  for (const [key, allowed] of Object.entries(CHOICES)) if (allowed.includes(raw[key])) s[key] = raw[key];
  for (const key of ['hour12', 'seconds']) if (typeof raw[key] === 'boolean') s[key] = raw[key];
  for (const key of ['nightFrom', 'nightTo']) if (HM.test(raw[key])) s[key] = raw[key];
  return s;
}

const validTimer = (t) =>
  t && typeof t.id === 'string' && typeof t.label === 'string' && STATES.includes(t.state) &&
  isNum(t.duration) && t.duration > 0 && isNum(t.remaining) && isNum(t.endAt);

const validRecent = (r) => r && typeof r.label === 'string' && isNum(r.duration) && r.duration > 0;

export function load(storage = globalThis.localStorage) {
  let raw = {};
  try {
    raw = JSON.parse(storage.getItem(KEY)) || {};
  } catch {
    raw = {};
  }
  const list = (v, ok, max) => (Array.isArray(v) ? v.filter(ok).slice(0, max) : []);
  return {
    settings: cleanSettings(raw.settings),
    timers: list(raw.timers, validTimer, MAX_TIMERS),
    recents: list(raw.recents, validRecent, 4),
    hinted: raw.hinted === true,
  };
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep running from memory.
  }
}
