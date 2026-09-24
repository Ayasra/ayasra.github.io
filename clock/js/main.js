// Desk Clock — state, input, and the heartbeat.
//
// Power model: the page sleeps between ticks. With seconds hidden and no timer running it
// wakes once a minute; otherwise once a second, exactly on the second. Nothing animates,
// so between those wakes the CPU and GPU have nothing to do.

import { load, save } from './store.js';
import * as T from './timers.js';
import { inWindow } from './format.js';
import * as sound from './sound.js';
import * as device from './device.js';
import { computeLayout } from './layout.js';
import { measureType } from './readout.js';
import { ClockView, TimersView, applyLayout } from './view.js';
import { createAddSheet, createSettingsSheet } from './sheets.js';
import { applyTheme } from './theme.js';
import { ICONS, paintIcons } from './icons.js';

const ALARM_MS = 2 * 60 * 1000; // ring for two minutes, then keep flashing silently
const CHROME_MS = 7000; // on-screen controls hide themselves after this
const DRIFT_EVERY = 3; // minutes between pixel shifts
// The face drifts around this small orbit so no pixel shows the same thing for days.
const DRIFT = [[0, 0], [2, 1], [1, -2], [-2, -1], [-1, 2], [3, 0], [0, -3], [-3, 0], [0, 3]];

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const app = $('app');
const stage = $('stage');
const hint = $('hint');
const addButton = app.querySelector('[data-action="add"]');
const fullscreenButton = app.querySelector('[data-action="fullscreen"]');
const locale = navigator.language;

const state = load();
let night = null;
let tickTimer = 0;
let lastMinute = -1;
let chromeTimer = 0;
let alarmKey = '';

const clock = new ClockView({ root: $('clock'), time: $('time'), ampm: $('ampm'), secs: $('secs'), date: $('date') });
const timers = new TimersView({ high: $('timers-high'), normal: $('timers-normal') });
const addSheet = createAddSheet($('add-sheet'), { onStart: addTimer });
const settingsSheet = createSettingsSheet($('settings-sheet'), {
  get: () => state.settings,
  set: changeSetting,
  onFullscreen: () => setFullscreen(!device.isFullscreen()),
  canFullscreen: device.canFullscreen,
  isFullscreen: device.isFullscreen,
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

function tick() {
  clearTimeout(tickTimer);
  const now = Date.now();
  try {
    settleTimers(now);
    const date = new Date(now);
    const minute = Math.floor(now / 60000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      updateNight(date);
      if (minute % DRIFT_EVERY === 0) drift(minute / DRIFT_EVERY);
    }
    clock.render(date, locale);
    timers.render(state.timers, now, Math.floor(now / 1000) % 2 === 0);
    ring(now);
  } finally {
    schedule(now); // a clock must never stop, even if a render throws
  }
}

function schedule(now) {
  if (document.hidden) return;
  const period = state.settings.seconds || state.timers.some(T.needsTicks) ? 1000 : 60000;
  tickTimer = setTimeout(tick, period - (now % period) + 20);
}

function settleTimers(now) {
  let changed = false;
  state.timers = state.timers.map((t) => {
    const next = T.settle(t, now);
    if (next !== t) changed = true;
    return next;
  });
  if (changed) save(state);
}

function ring(now) {
  let since = 0;
  for (const t of state.timers) if (t.state === 'ringing') since = Math.max(since, t.endAt);
  if (!since || now - since > ALARM_MS) return;
  const second = Math.floor((now - since) / 1000);
  const key = `${since}/${second}`;
  if (second % sound.PERIOD[state.settings.sound] === 0 && key !== alarmKey) {
    alarmKey = key;
    sound.play(state.settings.sound);
  }
}

function updateNight(date) {
  const s = state.settings;
  const isNight = s.night === 'on' || (s.night === 'auto' && inWindow(date, s.nightFrom, s.nightTo));
  if (isNight !== night) {
    night = isNight;
    applyTheme(s.color, night);
  }
}

function drift(step) {
  const [x, y] = DRIFT[step % DRIFT.length];
  stage.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
}

function relayout() {
  const high = state.timers.filter((t) => t.priority === 'high').length;
  const sizes = computeLayout({
    width: window.innerWidth,
    height: window.innerHeight,
    high,
    normal: state.timers.length - high,
    clockWidth: clock.widthFactor(),
    timerWidth: { high: timers.widthFactor('high'), normal: timers.widthFactor('normal') },
  });
  applyLayout(root, sizes);
  timers.setSize(sizes);
}

function setChrome(on, ms = CHROME_MS) {
  clearTimeout(chromeTimer);
  app.classList.toggle('chrome-on', on);
  if (on) chromeTimer = setTimeout(() => setChrome(false), ms);
}

// ── Actions ─────────────────────────────────────────────────────────────────

function commit(layoutChanged = false) {
  save(state);
  timers.sync(state.timers);
  if (layoutChanged) relayout();
  addButton.disabled = state.timers.length >= T.MAX_TIMERS;
  if (!state.timers.some((t) => t.state === 'ringing')) sound.stop();
  tick();
}

function update(id, change) {
  const now = Date.now();
  state.timers = state.timers.map((t) => (t.id === id ? change(t, now) : t));
  commit();
}

function addTimer({ label, duration, priority }) {
  if (state.timers.length >= T.MAX_TIMERS) return;
  state.timers = [...state.timers, T.createTimer({ label, duration, priority }, Date.now())];
  state.recents = T.remember(state.recents, { label, duration, priority });
  commit(true);
}

function removeTimer(id) {
  state.timers = state.timers.filter((t) => t.id !== id);
  commit(true);
}

function dismissRinging() {
  state.timers = state.timers.map((t) => (t.state === 'ringing' ? T.reset(t) : t));
  commit();
}

function applyFace() {
  const face = state.settings.face;
  root.dataset.face = face;
  clock.setFace(face);
  timers.setFace(face);
  timers.sync(state.timers);
  addSheet.setFace(face);
}

// Full screen hides the status bar. A page may only enter it from a tap, so the choice is
// remembered: after a relaunch, the first tap anywhere puts the clock back in full screen.
function setFullscreen(on) {
  state.settings = { ...state.settings, fullscreen: on };
  save(state);
  device.setFullscreen(on);
}

function showFullscreenState() {
  const on = device.isFullscreen();
  fullscreenButton.innerHTML = ICONS[on ? 'shrink' : 'expand'];
  fullscreenButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
}

function changeSetting(key, value) {
  state.settings = { ...state.settings, [key]: value };
  save(state);
  if (key === 'face') applyFace();
  if (key === 'face' || key === 'seconds' || key === 'hour12') {
    clock.setOptions(state.settings);
    relayout();
  }
  if (key === 'color') applyTheme(value, night);
  if (key.startsWith('night')) {
    night = null;
    updateNight(new Date());
  }
  if (key === 'sound') sound.play(value);
  tick();
}

// ── Input ───────────────────────────────────────────────────────────────────

// Listening on #app rather than document: iOS only sends clicks to elements that have a
// click handler somewhere below <body>.
app.addEventListener('click', (e) => {
  sound.unlock();
  device.keepAwake();
  const fullscreenControl = e.target.closest('[data-action="fullscreen"], #fs-btn');
  if (state.settings.fullscreen && !device.isFullscreen() && !fullscreenControl) device.setFullscreen(true);
  hint.classList.remove('show');
  if (e.target.closest('.sheet-wrap')) return; // panels handle their own taps

  // While anything rings, a tap anywhere silences it — no hunting for the right button.
  if (state.timers.some((t) => t.state === 'ringing')) return dismissRinging();

  const target = e.target.closest('[data-action]');
  if (!target) return setChrome(!app.classList.contains('chrome-on'));
  if (app.classList.contains('chrome-on')) setChrome(true); // keep controls up while in use

  const { action, id } = target.dataset;
  if (action === 'toggle') update(id, T.toggle);
  else if (action === 'reset') update(id, T.reset);
  else if (action === 'remove') removeTimer(id);
  else if (action === 'fullscreen') setFullscreen(!device.isFullscreen());
  else if (action === 'add' || action === 'settings') {
    setChrome(false);
    if (action === 'add') addSheet.open(state.recents);
    else settingsSheet.open();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    addSheet.close();
    settingsSheet.close();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(tickTimer);
  } else {
    tick();
    device.keepAwake();
  }
});
window.addEventListener('pageshow', (e) => e.persisted && tick());
device.onFullscreenChange(() => {
  showFullscreenState();
  // Leaving through iPadOS's own ✕ turns full screen off; a reload or the page being
  // hidden doesn't, so it comes back with the next tap.
  if (!device.isFullscreen() && !document.hidden && state.settings.fullscreen) {
    state.settings = { ...state.settings, fullscreen: false };
    save(state);
  }
});
window.addEventListener('resize', () => {
  relayout();
  tick();
});

document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active styles show on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch-zoom on a clock

// ── Start ───────────────────────────────────────────────────────────────────

paintIcons(document);
measureType();
fullscreenButton.hidden = !device.canFullscreen();
applyFace();
clock.setOptions(state.settings);
updateNight(new Date());
relayout();
commit();

if (!state.hinted) {
  state.hinted = true;
  save(state);
  hint.classList.add('show');
  setChrome(true, 10000);
  setTimeout(() => hint.classList.remove('show'), 10000);
} else if (state.timers.some((t) => t.state === 'running') && !sound.isUnlocked()) {
  // After a reload iOS keeps audio locked until the next tap; say so rather than stay silent.
  hint.textContent = 'Tap once to enable alert sounds';
  hint.classList.add('show');
}

// The type face is sized from font metrics; measure again once everything has loaded.
const remeasure = () => {
  measureType();
  relayout();
  tick();
};
if (document.readyState === 'complete') remeasure();
else window.addEventListener('load', remeasure, { once: true });

device.keepAwake();

// Tells the safety net in index.html that the clock started, and re-arms it for next time.
window.clockStarted = true;
try {
  sessionStorage.removeItem('clock.retried');
} catch {
  // Storage blocked: the safety net simply won't retry.
}
