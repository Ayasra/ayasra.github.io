// Draws the app icon from the same segment geometry the clock uses, then rasterises the
// PNGs iOS needs. Only needed if you change the icon; the results are committed.
//
//   node tools/make-icons.mjs        (requires rsvg-convert: brew install librsvg)

import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CELL_H, WIDTHS, TRACK, WEIGHTS, kindOf, digitPath, ghostPath, colonDots, widthFactor } from '../js/glyphs.js';

const dir = fileURLToPath(new URL('../icons/', import.meta.url));
const SIZE = 1024;
const INK = '#ECE6DC';
const TEXT = '10:08';
const WEIGHT = 'bold';

const h = 232; // digit height in icon px
const w = widthFactor(TEXT) * h;
const x0 = (SIZE - w) / 2;
const y0 = (SIZE - h) / 2 - 36;
const barY = y0 + h + 84;

let x = 0;
const cells = [];
for (const ch of TEXT) {
  const kind = kindOf(ch);
  const body =
    kind === 'colon'
      ? colonDots(WEIGHT).map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${INK}"/>`).join('')
      : `<path d="${ghostPath(WEIGHT)}" stroke="${INK}" stroke-opacity=".09"/><path d="${digitPath(ch, WEIGHT)}" stroke="${INK}"/>`;
  cells.push(`<g transform="translate(${x} 0)">${body}</g>`);
  x += WIDTHS[kind] + TRACK;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#000"/>
  <g transform="translate(${x0.toFixed(1)} ${y0.toFixed(1)}) scale(${(h / CELL_H).toFixed(4)})" fill="none" stroke-linecap="round" stroke-width="${WEIGHTS[WEIGHT].stroke}">
    ${cells.join('\n    ')}
  </g>
  <rect x="${x0.toFixed(1)}" y="${barY.toFixed(1)}" width="${w.toFixed(1)}" height="9" rx="4.5" fill="${INK}" fill-opacity=".16"/>
  <rect x="${x0.toFixed(1)}" y="${barY.toFixed(1)}" width="${(w * 0.62).toFixed(1)}" height="9" rx="4.5" fill="${INK}" fill-opacity=".75"/>
</svg>
`;

writeFileSync(`${dir}icon.svg`, svg);
for (const [name, px] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  execFileSync('rsvg-convert', ['-w', String(px), '-h', String(px), '-o', `${dir}${name}`, `${dir}icon.svg`]);
}
console.log('icons written to', dir);
