// Sizing as a pure function of the viewport and what's on screen. Everything scales from
// the short side of the screen, so portrait and landscape feel like the same object.
//
// Importance is shown by size alone, in three steps: the clock, then priority timers,
// then normal timers. Each step is kept clearly larger than the next however many timers
// there are — when space runs out, the timers shrink before the order can break.

export const SEC_RATIO = 0.34; // seconds digits, relative to the main digits
export const SIDE_GAP = 0.12; // space before the seconds / AM-PM column
export const AMPM_RATIO = 0.075; // AM-PM text size, relative to the main digits
const DATE_GAP = 0.19;
const DATE_MIN = 13;
const DATE_MAX = 24;

// Minimum ratio of digit heights between neighbouring steps of the hierarchy.
export const CLOCK_OVER_TIMERS = 1.65;
export const HIGH_OVER_NORMAL = 1.6;

// The two kinds of timer card. cardMax and digitMax are fractions of the screen's short
// side and pad is [fraction, min px, max px]; the rest are px: the label row and its text,
// the space above and below the digits, and the progress bar.
export const TIERS = {
  high: { cardMax: 0.5, digitMax: 0.155, pad: [0.026, 14, 22], head: 18, label: 13, above: 16, below: 18, bar: 3 },
  normal: { cardMax: 0.32, digitMax: 0.085, pad: [0.02, 12, 18], head: 16, label: 12, above: 12, below: 14, bar: 2 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const cardHeight = (spec, pad, digitH) => pad * 2 + spec.head + spec.above + digitH + spec.below + spec.bar;

/**
 * @param width, height  viewport in CSS px
 * @param high, normal   how many priority and normal timers there are
 * @param clockWidth     width of the clock line (digits + side column) per unit of digit height
 * @param timerWidth     { high, normal }: width of "00:00" per unit of digit height
 */
export function computeLayout({ width, height, high = 0, normal = 0, clockWidth, timerWidth }) {
  const landscape = width >= height;
  const short = Math.min(width, height);
  const pad = Math.round(clamp(short * 0.06, 20, 64));
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const gapX = Math.round(short * 0.035);
  const gapY = Math.round(short * 0.025);
  const count = high + normal;
  const sectionGap = count ? Math.round(short * 0.07) : 0;
  const tierGap = high && normal ? Math.round(short * 0.04) : 0;
  const byWidth = (innerW * (count ? 0.8 : 0.86)) / clockWidth;

  const tier = (name, n, cols) => {
    const spec = TIERS[name];
    const cardPad = Math.round(clamp(short * spec.pad[0], spec.pad[1], spec.pad[2]));
    const cardW = cols ? Math.floor(Math.min(short * spec.cardMax, (innerW - gapX * (cols - 1)) / cols)) : 0;
    // The largest digits these cards have room for.
    const roomy = cols ? Math.min(short * spec.digitMax, (cardW - cardPad * 2) / timerWidth[name]) : 0;
    return { spec, cols, rows: cols ? Math.ceil(n / cols) : 0, cardPad, cardW, roomy };
  };
  const block = (t, digitH) => (t.rows ? t.rows * cardHeight(t.spec, t.cardPad, digitH) + (t.rows - 1) * gapY : 0);

  // The clock takes the height the timers leave. If that makes it too small to lead,
  // shrink the timers a step at a time until it does.
  const arrange = (hi, lo) => {
    let fit;
    for (let scale = 1, step = 0; step < 60; step++, scale *= 0.95) {
      const highH = Math.floor(hi.roomy * scale);
      const normalH = high
        ? Math.floor(Math.min(lo.roomy, highH / HIGH_OVER_NORMAL))
        : Math.floor(lo.roomy * scale);
      const timersH = block(hi, highH) + tierGap + block(lo, normalH);
      const byHeight = (innerH - timersH - sectionGap - DATE_MAX) / (1 + DATE_GAP);
      const mainH = Math.floor(Math.min(byWidth, byHeight, short * 0.46));
      fit = { hi, lo, highH, normalH, timersH, mainH };
      if (mainH >= CLOCK_OVER_TIMERS * (high ? highH : normalH)) break;
    }
    return fit;
  };

  // Each row of timers can be one long line or wrap onto more; try every combination and
  // keep the one where things come out largest — weighted by importance, so normal timers
  // count for less than the clock and the priority timers.
  let fit = null;
  for (let hc = high ? 1 : 0; hc <= Math.min(high, landscape ? 6 : 3); hc++) {
    for (let nc = normal ? 1 : 0; nc <= Math.min(normal, landscape ? 6 : 4); nc++) {
      const o = arrange(tier('high', high, hc), tier('normal', normal, nc));
      const score = o.mainH * (high ? o.highH : 1) * (normal ? (high ? Math.sqrt(o.normalH) : o.normalH) : 1);
      if (!fit || score > fit.score) fit = { ...o, score };
    }
  }
  const tiers = { high: fit.hi, normal: fit.lo };

  const tierSizes = (name, digitH) => {
    const t = tiers[name];
    return {
      ...t.spec,
      cols: t.cols,
      cardW: t.cardW,
      cardPad: t.cardPad,
      digitH,
      rowW: t.cols ? t.cols * t.cardW + (t.cols - 1) * gapX : 0,
    };
  };
  const mainH = Math.max(40, fit.mainH);
  return {
    pad,
    gapX,
    gapY,
    sectionGap,
    tierGap,
    timersH: fit.timersH,
    mainH,
    secH: Math.round(mainH * SEC_RATIO),
    sideGap: Math.round(mainH * SIDE_GAP),
    ampmSize: Math.round(clamp(mainH * AMPM_RATIO, 11, 24)),
    dateSize: Math.round(clamp(mainH * 0.08, DATE_MIN, DATE_MAX)),
    dateGap: Math.round(mainH * DATE_GAP),
    high: tierSizes('high', fit.highH),
    normal: tierSizes('normal', fit.normalH),
  };
}
