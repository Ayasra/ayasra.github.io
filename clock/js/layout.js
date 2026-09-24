// Sizing as a pure function of the viewport and what's on screen. Everything scales from
// the short side of the screen, so portrait and landscape feel like the same object.

export const SEC_RATIO = 0.34; // seconds digits, relative to the main digits
export const SIDE_GAP = 0.12; // space before the seconds / AM-PM column
export const AMPM_RATIO = 0.075; // AM-PM text size, relative to the main digits
const DATE_GAP = 0.19;
const DATE_MIN = 13;
const DATE_MAX = 24;

// Fixed parts of a timer card in px: label row, space around the digits, progress bar.
export const CARD = { head: 16, above: 14, below: 16, bar: 2 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param width, height  viewport in CSS px
 * @param count          number of timers
 * @param clockWidth     width of the clock line (digits + side column) per unit of digit height
 * @param timerWidth     width of "00:00" per unit of timer digit height
 */
export function computeLayout({ width, height, count, clockWidth, timerWidth }) {
  const landscape = width >= height;
  const short = Math.min(width, height);
  const pad = Math.round(clamp(short * 0.06, 20, 64));
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const cols = count <= 3 ? count : count === 4 ? (landscape ? 4 : 2) : 3;
  const rows = cols ? Math.ceil(count / cols) : 0;
  const gapX = Math.round(short * 0.035);
  const gapY = Math.round(short * 0.025);
  const cardPad = Math.round(clamp(short * 0.022, 12, 20));
  const cardW = cols ? Math.floor(Math.min(short * 0.36, (innerW - gapX * (cols - 1)) / cols)) : 0;
  const timerH = cols ? Math.floor(Math.min(short * 0.095, (cardW - cardPad * 2) / timerWidth)) : 0;
  const cardH = cardPad * 2 + CARD.head + CARD.above + timerH + CARD.below + CARD.bar;
  const timersH = rows ? rows * cardH + (rows - 1) * gapY : 0;
  const sectionGap = count ? Math.round(short * 0.075) : 0;

  // The clock block is the digits, a gap, and the date line under them.
  const byWidth = (innerW * (count ? 0.8 : 0.86)) / clockWidth;
  const byHeight = (innerH - timersH - sectionGap - DATE_MAX) / (1 + DATE_GAP);
  const mainH = Math.max(40, Math.floor(Math.min(byWidth, byHeight, short * 0.46)));

  return {
    pad,
    cols,
    gapX,
    gapY,
    cardPad,
    cardW,
    cardH,
    timerH,
    timersW: cols ? cols * cardW + (cols - 1) * gapX : 0,
    timersH,
    sectionGap,
    mainH,
    secH: Math.round(mainH * SEC_RATIO),
    sideGap: Math.round(mainH * SIDE_GAP),
    ampmSize: Math.round(clamp(mainH * AMPM_RATIO, 11, 24)),
    dateSize: Math.round(clamp(mainH * 0.08, DATE_MIN, DATE_MAX)),
    dateGap: Math.round(mainH * DATE_GAP),
  };
}
