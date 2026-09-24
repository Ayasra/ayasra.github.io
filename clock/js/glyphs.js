// Seven-segment geometry, shared by the on-screen readouts and tools/make-icons.mjs.
//
// A digit is drawn in a 100 × 184 cell. Each segment is a round-capped stroke pulled
// back from every joint, so neighbouring segments never touch — those hairline gaps are
// what make it read as a display rather than a font.
//
//        a
//      f   b
//        g
//      e   c
//        d

export const CELL_H = 184;
export const WIDTHS = { digit: 100, colon: 28, sign: 56 };
export const TRACK = 26; // space between cells

export const WEIGHTS = {
  light: { stroke: 10, gap: 3.5 },
  regular: { stroke: 13, gap: 4 },
  bold: { stroke: 18, gap: 5 },
};

const LIT = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

export function kindOf(ch) {
  if (ch === ':') return 'colon';
  if (ch === '-' || ch === '−') return 'sign';
  return 'digit';
}

const n = (v) => Math.round(v * 100) / 100;
const line = (x1, y1, x2, y2) => `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;

const cache = new Map();

function segments(weight) {
  let s = cache.get(weight);
  if (s) return s;
  const { stroke, gap } = WEIGHTS[weight];
  const r = stroke / 2;
  const d = (stroke + gap) / Math.SQRT2; // pull-back that leaves `gap` between caps at a joint
  const l = r;
  const rt = WIDTHS.digit - r;
  const t = r;
  const m = CELL_H / 2;
  const b = CELL_H - r;
  s = {
    a: line(l + d, t, rt - d, t),
    b: line(rt, t + d, rt, m - d),
    c: line(rt, m + d, rt, b - d),
    d: line(l + d, b, rt - d, b),
    e: line(l, m + d, l, b - d),
    f: line(l, t + d, l, m - d),
    g: line(l + d, m, rt - d, m),
  };
  cache.set(weight, s);
  return s;
}

/** Path data for the lit segments of `ch` — empty for a blank cell. */
export function digitPath(ch, weight) {
  const s = segments(weight);
  return [...(LIT[ch] || '')].map((k) => s[k]).join('');
}

/** All seven segments: the faint "unlit" layer behind every digit. */
export function ghostPath(weight) {
  return digitPath('8', weight);
}

/** Colon dots, centred on the upper and lower halves of a digit. */
export function colonDots(weight) {
  const { stroke } = WEIGHTS[weight];
  const top = stroke / 2;
  const mid = CELL_H / 2;
  const bottom = CELL_H - stroke / 2;
  const r = n(stroke * 0.62);
  const cx = WIDTHS.colon / 2;
  return [
    { cx, cy: n((top + mid) / 2), r },
    { cx, cy: n((mid + bottom) / 2), r },
  ];
}

/** Minus sign: a lone middle segment in a narrow cell. */
export function signPath(weight) {
  const { stroke, gap } = WEIGHTS[weight];
  const inset = stroke / 2 + gap;
  return line(inset, CELL_H / 2, WIDTHS.sign - inset, CELL_H / 2);
}

/** Rendered width of `text`, in multiples of the digit height. */
export function widthFactor(text) {
  let w = -TRACK;
  for (const ch of text) w += WIDTHS[kindOf(ch)] + TRACK;
  return Math.max(0, w) / CELL_H;
}
