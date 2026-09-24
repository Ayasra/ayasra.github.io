// Line icons on a 24-unit grid, stroked in the current text colour.

const icon = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  sliders: icon('<path d="M4 8h8M18 8h2M4 16h2M12 16h8"/><circle cx="15" cy="8" r="2.5"/><circle cx="9" cy="16" r="2.5"/>'),
  expand: icon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  shrink: icon('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  close: icon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  reset: icon('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  pause: icon('<path d="M9 7v10M15 7v10"/>'),
  back: icon('<path d="M9.5 6H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9.5L4 12z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>'),
};

/** Fill every `[data-icon]` element under `root` with its icon. */
export function paintIcons(root) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
}
