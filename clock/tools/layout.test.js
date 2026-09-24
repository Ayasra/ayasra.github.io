import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/layout.js';
import { widthFactor } from '../js/glyphs.js';

// iPad Pro 9.7" and 10.5" in both orientations, plus a small window.
const SCREENS = [[1024, 768], [768, 1024], [1112, 834], [834, 1112], [640, 480]];
const CLOCKS = {
  plain: widthFactor('00:00'),
  seconds: widthFactor('00:00') + 0.12 + 0.34 * widthFactor('00'),
};

for (const [width, height] of SCREENS) {
  for (const [name, clockWidth] of Object.entries(CLOCKS)) {
    test(`everything fits on ${width}×${height} (${name})`, () => {
      for (let count = 0; count <= 6; count++) {
        const L = computeLayout({ width, height, count, clockWidth, timerWidth: widthFactor('00:00') });
        const innerW = width - 2 * L.pad;
        const innerH = height - 2 * L.pad;
        const clockBlock = L.mainH + L.dateGap + L.dateSize;
        assert.ok(L.mainH * clockWidth <= innerW, `clock too wide with ${count} timers`);
        assert.ok(clockBlock + L.sectionGap + L.timersH <= innerH, `too tall with ${count} timers`);
        assert.ok(L.timersW <= innerW, `timers too wide with ${count} timers`);
        if (count) {
          assert.ok(L.timerH * widthFactor('00:00') <= L.cardW - 2 * L.cardPad, 'timer digits overflow card');
          assert.ok(L.timerH >= 30, 'timer digits unreadably small');
        }
      }
    });
  }
}

test('the clock gets smaller as timers are added, never larger', () => {
  let last = Infinity;
  for (let count = 0; count <= 6; count++) {
    const { mainH } = computeLayout({ width: 1024, height: 768, count, clockWidth: CLOCKS.plain, timerWidth: widthFactor('00:00') });
    assert.ok(mainH <= last);
    last = mainH;
  }
});
