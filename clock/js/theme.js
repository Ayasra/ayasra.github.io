// One ink colour on black. Night mode swaps it for a dim red that is easy on dark-adapted eyes.

export const COLORS = {
  paper: { name: 'Paper', rgb: [236, 230, 220] },
  amber: { name: 'Amber', rgb: [255, 181, 76] },
  phosphor: { name: 'Phosphor', rgb: [118, 240, 214] },
  ice: { name: 'Ice', rgb: [168, 208, 255] },
  red: { name: 'Red', rgb: [255, 96, 76] },
};

const NIGHT = [178, 44, 30];

export function applyTheme(color, night) {
  const root = document.documentElement;
  const rgb = night ? NIGHT : (COLORS[color] || COLORS.paper).rgb;
  root.style.setProperty('--ink-rgb', rgb.join(' '));
  root.classList.toggle('night', night);
}
