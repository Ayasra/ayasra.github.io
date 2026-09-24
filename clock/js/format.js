// Text helpers. No DOM here, so the tests can run them under Node.

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Clock readout for a moment. `hm` is always five characters (" 9:05" in 12-hour mode),
 * so the segment cells never shift as the hour changes.
 */
export function clockParts(date, hour12) {
  const h = date.getHours();
  const hh = hour12 ? String(h % 12 || 12).padStart(2, ' ') : pad2(h);
  return {
    hm: `${hh}:${pad2(date.getMinutes())}`,
    ss: pad2(date.getSeconds()),
    ampm: hour12 ? (h < 12 ? 'AM' : 'PM') : '',
  };
}

/** Whole seconds → "MM:SS", or "H:MM:SS" from an hour up. */
export function durationText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = pad2(Math.floor(s / 60) % 60);
  const ss = pad2(s % 60);
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Whole seconds → a short label such as "1 h 30 min". */
export function durationLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s) parts.push(`${s} s`);
  return parts.join(' ') || '0 s';
}

const formatters = new Map();

function word(locale, options, date) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, f);
  }
  return f.format(date).replace(/\.$/, '');
}

/** "Thu 24 Sep", using the locale's own day and month names. */
export function dateText(date, locale) {
  return `${word(locale, { weekday: 'short' }, date)} ${date.getDate()} ${word(locale, { month: 'short' }, date)}`;
}

/** "HH:MM" → minutes after midnight. */
export function minutesOf(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return ((((h || 0) * 60 + (m || 0)) % 1440) + 1440) % 1440;
}

/** Is `date` inside the daily window [from, to)? Windows may wrap past midnight. */
export function inWindow(date, from, to) {
  const now = date.getHours() * 60 + date.getMinutes();
  const a = minutesOf(from);
  const b = minutesOf(to);
  if (a === b) return false;
  return a < b ? now >= a && now < b : now >= a || now < b;
}

/** Keypad entry, filled from the right like a microwave: "130" → 1 min 30 s. */
export function parseEntry(digits) {
  const d = digits.padStart(6, '0').slice(-6);
  const h = Number(d.slice(0, 2));
  const m = Number(d.slice(2, 4));
  const s = Number(d.slice(4));
  return { groups: [d.slice(0, 2), d.slice(2, 4), d.slice(4)], seconds: h * 3600 + m * 60 + s };
}

/** Seconds → keypad digits, the inverse of parseEntry: 90 → "130". */
export function toEntry(seconds) {
  const h = Math.min(99, Math.floor(seconds / 3600));
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return `${pad2(h)}${pad2(m)}${pad2(s)}`.replace(/^0+/, '');
}
