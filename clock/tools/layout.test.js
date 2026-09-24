import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, CLOCK_OVER_TIMERS, HIGH_OVER_NORMAL } from '../js/layout.js';
import { widthFactor } from '../js/glyphs.js';

// iPad Pro 9.7" and 10.5" in both orientations, plus a small window.
const IPADS = [[1024, 768], [768, 1024], [1112, 834], [834, 1112]];
const SCREENS = [...IPADS, [640, 480]];
const CLOCKS = {
  plain: widthFactor('00:00'),
  seconds: widthFactor('00:00') + 0.12 + 0.34 * widthFactor('00'),
};
const TIMER = { high: widthFactor('00:00'), normal: widthFactor('00:00') };
const MAX = 6;

const layout = (width, height, high, normal, clockWidth = CLOCKS.plain) =>
  computeLayout({ width, height, high, normal, clockWidth, timerWidth: TIMER });

// Every mix of priority and normal timers the app allows.
const MIXES = [];
for (let high = 0; high <= MAX; high++) for (let normal = 0; high + normal <= MAX; normal++) MIXES.push([high, normal]);

for (const [width, height] of SCREENS) {
  for (const [name, clockWidth] of Object.entries(CLOCKS)) {
    test(`every mix of timers fits on ${width}×${height} (${name})`, () => {
      for (const [high, normal] of MIXES) {
        const L = layout(width, height, high, normal, clockWidth);
        const mix = `${high} priority + ${normal} normal`;
        const innerW = width - 2 * L.pad;
        const innerH = height - 2 * L.pad;
        assert.ok(L.mainH * clockWidth <= innerW, `clock too wide with ${mix}`);
        assert.ok(L.mainH + L.dateGap + L.dateSize + L.sectionGap + L.timersH <= innerH, `too tall with ${mix}`);
        for (const [tier, n] of [['high', high], ['normal', normal]]) {
          if (!n) continue;
          const T = L[tier];
          assert.ok(T.rowW <= innerW, `${tier} row too wide with ${mix}`);
          assert.ok(T.digitH * TIMER[tier] <= T.cardW - 2 * T.cardPad, `${tier} digits overflow their card with ${mix}`);
        }
      }
    });
  }
}

test('size alone keeps the order: clock, then priority timers, then normal timers', () => {
  for (const [width, height] of SCREENS) {
    for (const clockWidth of Object.values(CLOCKS)) {
      for (const [high, normal] of MIXES) {
        if (!high && !normal) continue;
        const L = layout(width, height, high, normal, clockWidth);
        const mix = `${width}×${height}, ${high} priority + ${normal} normal`;
        const largest = high ? L.high.digitH : L.normal.digitH;
        assert.ok(L.mainH >= CLOCK_OVER_TIMERS * largest, `clock doesn't lead on ${mix}`);
        if (high && normal) assert.ok(L.high.digitH >= HIGH_OVER_NORMAL * L.normal.digitH, `priority doesn't stand out on ${mix}`);
      }
    }
  }
});

test('timers stay readable and the clock keeps most of its size, on the iPad in every mix', () => {
  for (const [width, height] of IPADS) {
    for (const clockWidth of Object.values(CLOCKS)) {
      const alone = layout(width, height, 0, 0, clockWidth).mainH;
      for (const [high, normal] of MIXES) {
        const L = layout(width, height, high, normal, clockWidth);
        const mix = `${width}×${height}, ${high} priority + ${normal} normal`;
        assert.ok(L.mainH >= 0.55 * alone, `clock squeezed to ${L.mainH}px on ${mix}`);
        if (high) assert.ok(L.high.digitH >= 40, `priority digits too small on ${mix}: ${L.high.digitH}px`);
        if (normal) assert.ok(L.normal.digitH >= 24, `normal digits too small on ${mix}: ${L.normal.digitH}px`);
      }
    }
  }
});

test('one priority timer is far larger than normal ones, and the clock still leads', () => {
  const L = layout(1024, 768, 1, 3);
  assert.ok(L.high.digitH >= 100, `priority ${L.high.digitH}px`);
  assert.ok(L.normal.digitH >= 60, `normal ${L.normal.digitH}px`);
  assert.ok(L.mainH >= 180, `clock ${L.mainH}px`);
});
