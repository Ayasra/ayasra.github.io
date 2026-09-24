// Digit readouts. Both faces share one small API:
//
//   el               the element to put on the page
//   set(text, dim)   show `text`, drawing its first `dim` characters faint;
//                    only cells whose character changed are touched
//
// widthFactor(face, text) gives the rendered width in multiples of the digit height,
// which is all the layout needs to size things without measuring the page.

import { CELL_H, WIDTHS, WEIGHTS, kindOf, digitPath, ghostPath, colonDots, signPath, widthFactor as segmentWidth } from './glyphs.js';

const SVG = 'http://www.w3.org/2000/svg';

function svgChild(parent, name, attrs) {
  const el = document.createElementNS(SVG, name);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  parent.appendChild(el);
  return el;
}

function makeCell(ch, weight) {
  const kind = kindOf(ch);
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('class', `cell ${kind}`);
  el.setAttribute('viewBox', `0 0 ${WIDTHS[kind]} ${CELL_H}`);
  el.setAttribute('stroke-width', WEIGHTS[weight].stroke);
  el.setAttribute('aria-hidden', 'true');
  const cell = { el, kind, ch: null, dim: false, lit: null };
  if (kind === 'digit') {
    svgChild(el, 'path', { class: 'off', d: ghostPath(weight) });
    cell.lit = svgChild(el, 'path', { class: 'on', d: '' });
  } else if (kind === 'colon') {
    for (const dot of colonDots(weight)) svgChild(el, 'circle', { class: 'on', ...dot });
  } else {
    svgChild(el, 'path', { class: 'on', d: signPath(weight) });
  }
  return cell;
}

function segmentReadout(weight) {
  const el = document.createElement('span');
  el.className = 'readout seg';
  let cells = [];
  let text = null;
  let dimmed = 0;

  return {
    el,
    set(next, dim = 0) {
      if (next === text && dim === dimmed) return;
      const chars = [...next];
      if (chars.length !== cells.length || chars.some((c, i) => kindOf(c) !== cells[i].kind)) {
        cells = chars.map((c) => makeCell(c, weight));
        el.replaceChildren(...cells.map((c) => c.el));
      }
      chars.forEach((c, i) => {
        const cell = cells[i];
        if (cell.ch !== c) {
          cell.ch = c;
          if (cell.lit) cell.lit.setAttribute('d', digitPath(c, weight));
        }
        const faint = i < dim;
        if (cell.dim !== faint) {
          cell.dim = faint;
          cell.el.classList.toggle('dim', faint);
        }
      });
      text = next;
      dimmed = dim;
    },
  };
}

function typeReadout(weight) {
  const el = document.createElement('span');
  el.className = `readout type ${weight}`;
  const faint = document.createElement('span');
  faint.className = 'dim';
  const bright = document.createTextNode('');
  el.append(faint, bright);
  let text = null;
  let dimmed = 0;

  return {
    el,
    set(next, dim = 0) {
      if (next === text && dim === dimmed) return;
      // Type is set flush: the leading blank of " 9:05" is a segment-display idiom only.
      const lead = next.length - next.trimStart().length;
      const cut = Math.max(lead, dim);
      if (faint.textContent !== next.slice(lead, cut)) faint.textContent = next.slice(lead, cut);
      bright.data = next.slice(cut);
      text = next;
      dimmed = dim;
    },
  };
}

export function createReadout(face, weight = 'regular') {
  return face === 'type' ? typeReadout(weight) : segmentReadout(weight);
}

// Type widths come from measuring once per character pattern; tabular figures make every
// digit the same width, so "12:34" and "00:00" measure alike.
const typeWidths = new Map();
let ruler = null;

export function widthFactor(face, text, weight = 'regular') {
  if (face !== 'type') return segmentWidth(text);
  const key = `${weight}|${text.trimStart().replace(/\d/g, '0')}`;
  let w = typeWidths.get(key);
  if (w === undefined) {
    if (!ruler) {
      ruler = document.createElement('span');
      ruler.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ruler);
    }
    ruler.className = `readout type ${weight} ruler`;
    ruler.textContent = key.slice(key.indexOf('|') + 1);
    w = ruler.getBoundingClientRect().width / 100;
    typeWidths.set(key, w);
  }
  return w;
}

/**
 * Fit the type face to its box using the font's real metrics, which differ between
 * browsers: the cap height sets the font size, and the offset moves the figures from
 * wherever the line box puts them to dead centre. Also forgets measured widths.
 */
export function measureType() {
  typeWidths.clear();
  const root = document.documentElement;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return;
  ctx.font = `300 100px ${getComputedStyle(root).getPropertyValue('--font-type')}`;
  const m = ctx.measureText('0');
  const cap = m.actualBoundingBoxAscent / 100;
  const ascent = m.fontBoundingBoxAscent / 100;
  const descent = m.fontBoundingBoxDescent / 100;
  if (!(cap > 0.5 && cap < 0.9) || !(ascent > 0) || !(descent >= 0)) return; // keep the CSS defaults
  const baseline = (1 - ascent - descent) / 2 + ascent; // in a line-height: 1 box, from its top
  root.style.setProperty('--type-cap', cap.toFixed(4));
  root.style.setProperty('--type-dy', (baseline - cap / 2 - 0.5).toFixed(4));
}
