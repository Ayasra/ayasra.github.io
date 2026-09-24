// Timer model: plain JSON objects and pure transitions, so timers survive reloads and
// the logic is testable without a browser.
//
//   idle ──tap──▶ running ◀──tap──▶ paused
//                    │ end reached
//                    ▼
//                 ringing ──tap──▶ idle (ready to run again)
//
// A running timer always ends on a whole second. That puts every readout on screen —
// clock and timers alike — on the same once-a-second heartbeat, so the app wakes the
// CPU once per second no matter how many timers are running.

export const MAX_TIMERS = 6;
const SECOND = 1000;

const floorToSecond = (t) => Math.floor(t / SECOND) * SECOND;

let counter = 0;

export function createTimer({ label = '', duration }, now) {
  const id = now.toString(36) + (counter++).toString(36);
  return start({ id, label, duration, state: 'idle', remaining: duration, endAt: 0 }, now);
}

function start(t, now) {
  return { ...t, state: 'running', endAt: floorToSecond(now) + t.remaining };
}

/** A running timer whose end has passed starts ringing. Unchanged timers are returned as-is. */
export function settle(t, now) {
  return t.state === 'running' && t.endAt <= now ? { ...t, state: 'ringing' } : t;
}

/** The single tap action: start, pause, resume, or dismiss a ringing timer. */
export function toggle(timer, now) {
  const t = settle(timer, now);
  switch (t.state) {
    case 'running':
      // Keep exactly the whole seconds the face was showing.
      return { ...t, state: 'paused', remaining: Math.ceil((t.endAt - now) / SECOND) * SECOND };
    case 'ringing':
      return reset(t);
    default:
      return start(t, now);
  }
}

export function reset(t) {
  return { ...t, state: 'idle', remaining: t.duration, endAt: 0 };
}

export function remaining(t, now) {
  if (t.state === 'running') return Math.max(0, t.endAt - now);
  if (t.state === 'ringing') return 0;
  return t.remaining;
}

/** What the timer face shows: whole seconds left, or seconds past the end while ringing. */
export function face(t, now) {
  if (t.state === 'ringing') return { seconds: Math.max(0, Math.floor((now - t.endAt) / SECOND)), over: true };
  return { seconds: Math.ceil(remaining(t, now) / SECOND), over: false };
}

/** Fraction of the duration still to go, 1 → 0. */
export function progress(t, now) {
  return t.duration > 0 ? remaining(t, now) / t.duration : 0;
}

export const needsTicks = (t) => t.state === 'running' || t.state === 'ringing';

/** Most-recent-first list of timers the user has started, without duplicates. */
export function remember(recents, entry, limit = 4) {
  const same = (r) => r.label === entry.label && r.duration === entry.duration;
  return [entry, ...recents.filter((r) => !same(r))].slice(0, limit);
}
