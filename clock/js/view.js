// The clock face and the timer cards. Rendering is incremental: each call compares with
// what's already on screen and touches only what changed.

import { createReadout, widthFactor } from './readout.js';
import { clockParts, dateText, durationText, durationLabel } from './format.js';
import { SEC_RATIO, SIDE_GAP, AMPM_RATIO } from './layout.js';
import { ICONS } from './icons.js';
import * as T from './timers.js';

export class ClockView {
  constructor({ root, time, ampm, secs, date }) {
    Object.assign(this, { root, timeEl: time, ampmEl: ampm, secsEl: secs, dateEl: date });
    this.face = 'segment';
    this.day = -1;
    this.ampm = null;
  }

  setFace(face) {
    this.face = face;
    this.time = createReadout(face, 'light');
    this.secs = createReadout(face, 'regular');
    this.timeEl.replaceChildren(this.time.el);
    this.secsEl.replaceChildren(this.secs.el);
  }

  setOptions({ seconds, hour12 }) {
    this.seconds = seconds;
    this.hour12 = hour12;
    this.root.classList.toggle('no-secs', !seconds);
    this.root.classList.toggle('no-ampm', !hour12);
    this.root.classList.toggle('no-side', !seconds && !hour12);
  }

  /** Width of the whole clock line, per unit of digit height. */
  widthFactor() {
    let side = 0;
    if (this.seconds) side = SEC_RATIO * widthFactor(this.face, '00', 'regular');
    if (this.hour12) side = Math.max(side, AMPM_RATIO * 1.6); // "PM" in tracked mono
    return widthFactor(this.face, '00:00', 'light') + (side ? SIDE_GAP + side : 0);
  }

  render(date, locale) {
    const p = clockParts(date, this.hour12);
    this.time.set(p.hm);
    if (this.seconds) this.secs.set(p.ss);
    if (p.ampm !== this.ampm) {
      this.ampm = p.ampm;
      this.ampmEl.textContent = p.ampm;
    }
    const day = date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
    if (day !== this.day) {
      this.day = day;
      this.dateEl.textContent = dateText(date, locale);
    }
  }
}

const STATE_WORDS = { idle: 'ready', running: 'running', paused: 'paused', ringing: 'finished' };
const TIERS = ['high', 'normal'];
const WEIGHT = { high: 'light', normal: 'regular' };
const tierOf = (t) => (t.priority === 'high' ? 'high' : 'normal');

/**
 * Timer cards in two rows: priority timers large, just under the clock; normal ones
 * smaller, below them. Which row a card sits in is the only sign of its priority.
 */
export class TimersView {
  constructor(rows) {
    this.rows = rows; // { high, normal } container elements
    this.cards = new Map();
    this.face = 'segment';
    this.fits = { high: { digitH: 100, innerW: 300 }, normal: { digitH: 60, innerW: 200 } };
  }

  setFace(face) {
    this.face = face;
    for (const card of this.cards.values()) card.el.remove();
    this.cards.clear();
  }

  /** Card metrics from the layout, published per row; cards re-fit on the next render. */
  setSize(sizes) {
    for (const tier of TIERS) {
      const s = sizes[tier];
      const px = {
        '--card-w': s.cardW,
        '--card-pad': s.cardPad,
        '--timer-h': s.digitH,
        '--row-w': s.rowW,
        '--head': s.head,
        '--label': s.label,
        '--above': s.above,
        '--below': s.below,
        '--bar': s.bar,
      };
      for (const [key, value] of Object.entries(px)) this.rows[tier].style.setProperty(key, `${value}px`);
      this.fits[tier] = { digitH: s.digitH, innerW: s.cardW - s.cardPad * 2 };
    }
    for (const card of this.cards.values()) card.fitFor = null;
  }

  widthFactor(tier) {
    return widthFactor(this.face, '00:00', WEIGHT[tier]);
  }

  /** Match the cards on screen to the list of timers: add, remove, reorder, relabel. */
  sync(timers) {
    const wanted = new Map(timers.map((t) => [t.id, tierOf(t)]));
    for (const [id, card] of this.cards) {
      if (wanted.get(id) !== card.tier) {
        card.el.remove();
        this.cards.delete(id);
      }
    }
    for (const tier of TIERS) {
      const row = this.rows[tier];
      timers.filter((t) => tierOf(t) === tier).forEach((t, i) => {
        let card = this.cards.get(t.id);
        if (!card) {
          card = this.makeCard(t, tier);
          this.cards.set(t.id, card);
        }
        const at = row.children[i];
        if (at !== card.el) row.insertBefore(card.el, at || null);
        const label = t.label || durationLabel(t.duration / 1000);
        if (card.label.textContent !== label) card.label.textContent = label;
      });
    }
  }

  makeCard(t, tier) {
    const el = document.createElement('div');
    el.className = 'tcard';
    el.innerHTML = `
      <button class="tc-main" data-action="toggle">
        <span class="tc-head"><span class="tc-label"></span><span class="tc-status"></span></span>
        <span class="tc-digits"></span>
        <span class="tc-bar"><span></span></span>
      </button>
      <span class="tc-tools">
        <button class="icon-btn" data-action="reset" aria-label="Reset timer">${ICONS.reset}</button>
        <button class="icon-btn" data-action="remove" aria-label="Remove timer">${ICONS.close}</button>
      </span>`;
    for (const button of el.querySelectorAll('[data-action]')) button.dataset.id = t.id;
    const readout = createReadout(this.face, WEIGHT[tier]);
    el.querySelector('.tc-digits').append(readout.el);
    return {
      el,
      tier,
      readout,
      main: el.querySelector('.tc-main'),
      label: el.querySelector('.tc-label'),
      status: el.querySelector('.tc-status'),
      bar: el.querySelector('.tc-bar > span'),
      state: null,
      text: null,
      fitFor: null,
      scale: null,
    };
  }

  render(timers, now, flash) {
    for (const t of timers) {
      const card = this.cards.get(t.id);
      if (!card) continue;

      const f = T.face(t, now);
      const text = (f.over && f.seconds > 0 ? '−' : '') + durationText(f.seconds);
      if (text !== card.text) {
        card.text = text;
        card.readout.set(text);
      }
      this.fit(card, text);

      if (t.state !== card.state) {
        card.state = t.state;
        card.el.dataset.state = t.state;
        card.status.innerHTML = t.state === 'paused' ? ICONS.pause : '';
        card.main.setAttribute('aria-label', `${card.label.textContent}, ${STATE_WORDS[t.state]}`);
      }

      const scale = (t.state === 'ringing' ? 1 : T.progress(t, now)).toFixed(4);
      if (scale !== card.scale) {
        card.scale = scale;
        card.bar.style.transform = `scaleX(${scale})`;
      }

      card.el.classList.toggle('flash', t.state === 'ringing' && flash);
    }
  }

  /** Long readouts ("1:30:00") shrink to fit the card instead of overflowing it. */
  fit(card, text) {
    const shape = text.replace(/\d/g, '0');
    if (card.fitFor === shape) return;
    card.fitFor = shape;
    const { digitH, innerW } = this.fits[card.tier];
    const h = Math.min(digitH, Math.floor(innerW / widthFactor(this.face, text, WEIGHT[card.tier])));
    card.el.style.setProperty('--h', `${h}px`);
  }
}

/** Publish the clock's layout sizes as CSS custom properties (timer rows get theirs in TimersView). */
export function applyLayout(root, sizes) {
  const px = {
    '--pad': sizes.pad,
    '--main-h': sizes.mainH,
    '--sec-h': sizes.secH,
    '--side-gap': sizes.sideGap,
    '--ampm-size': sizes.ampmSize,
    '--date-size': sizes.dateSize,
    '--date-gap': sizes.dateGap,
    '--section-gap': sizes.sectionGap,
    '--tier-gap': sizes.tierGap,
    '--gap-x': sizes.gapX,
    '--gap-y': sizes.gapY,
  };
  for (const [key, value] of Object.entries(px)) root.style.setProperty(key, `${value}px`);
}
