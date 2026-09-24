// Alert sounds, synthesised with Web Audio — nothing to download or cache.
//
// The audio context is suspended whenever nothing is playing. A running context keeps the
// audio hardware awake even in silence, which is exactly what a desk clock should not do.
// iOS only lets audio start from a tap, so unlock() runs on the first tap; after that the
// context may be resumed from a timer.

const Context = globalThis.AudioContext || globalThis.webkitAudioContext;

/** Seconds between repeats of each alert while a timer rings. */
export const PERIOD = { chime: 3, digital: 2, soft: 3 };

let ctx = null;
let out = null;
let bus = null;
let busyUntil = 0;
let sleepTimer = 0;

export const isUnlocked = () => ctx !== null || !Context;

export function unlock() {
  if (ctx || !Context) return;
  ctx = new Context();
  out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  // Starting a silent source inside the tap is what unlocks output on iOS.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(out);
  src.start(0);
  if (ctx.resume) ctx.resume().catch(() => {});
  sleepSoon(0.5);
}

export async function play(kind) {
  if (!ctx) return;
  clearTimeout(sleepTimer); // don't let a pending suspend race the resume below
  try {
    if (ctx.state !== 'running') await ctx.resume();
  } catch {
    return;
  }
  if (!bus) {
    bus = ctx.createGain();
    bus.connect(out);
  }
  const at = ctx.currentTime + 0.03;
  const end = (VOICES[kind] || VOICES.chime)(bus, at);
  busyUntil = Math.max(busyUntil, end);
  sleepSoon(busyUntil - ctx.currentTime + 0.3);
}

/** Cut whatever is sounding (with a short fade, so it doesn't click) and let the hardware sleep. */
export function stop() {
  if (!ctx || !bus) return;
  const b = bus;
  bus = null;
  b.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  setTimeout(() => b.disconnect(), 250);
  busyUntil = 0;
  sleepSoon(0.3);
}

function sleepSoon(seconds) {
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    if (ctx && ctx.state === 'running' && ctx.currentTime >= busyUntil) ctx.suspend().catch(() => {});
  }, Math.max(0, seconds) * 1000);
}

/** One enveloped oscillator. Returns the time it falls silent. */
function tone(dest, { freq, at, peak, decay, type = 'sine', attack = 0.006, hold = 0 }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + attack);
  if (hold) env.gain.setValueAtTime(peak, at + attack + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + decay);
  osc.connect(env);
  env.connect(dest);
  osc.start(at);
  osc.stop(at + attack + hold + decay + 0.05);
  return at + attack + hold + decay;
}

const VOICES = {
  // Two soft bell strikes, a falling fourth.
  chime(dest, at) {
    const bell = (freq, t) =>
      Math.max(
        tone(dest, { freq, at: t, peak: 0.5, decay: 1.7 }),
        tone(dest, { freq: freq * 2, at: t, peak: 0.13, decay: 0.8 }),
        tone(dest, { freq: freq * 3, at: t, peak: 0.05, decay: 0.4 }),
      );
    return Math.max(bell(1318.5, at), bell(987.8, at + 0.36));
  },

  // The classic wristwatch beep-beep-beep-beep, softened by a low-pass.
  digital(dest, at) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    lp.connect(dest);
    let end = at;
    for (let i = 0; i < 4; i++) {
      end = tone(lp, { freq: 2093, type: 'square', at: at + i * 0.13, peak: 0.2, attack: 0.003, hold: 0.06, decay: 0.012 });
    }
    return end;
  },

  // A gentle rising triad, like a marimba.
  soft(dest, at) {
    let end = at;
    [880, 1108.7, 1318.5].forEach((freq, i) => {
      const t = at + i * 0.17;
      tone(dest, { freq: freq * 4, at: t, peak: 0.035, decay: 0.06 });
      end = tone(dest, { freq, at: t, peak: 0.4, decay: 0.9 });
    });
    return end;
  },
};
