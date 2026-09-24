// The two panels — new timer and settings. They're overlays toggled with a class, and
// none of their code runs while they're closed.

import { createReadout } from './readout.js';
import { parseEntry, toEntry, durationText, durationLabel } from './format.js';
import { COLORS } from './theme.js';

const isOpen = (wrap) => wrap.classList.contains('open');

function show(wrap) {
  wrap.classList.add('open');
  wrap.setAttribute('aria-hidden', 'false');
}

function hide(wrap) {
  wrap.classList.remove('open');
  wrap.setAttribute('aria-hidden', 'true');
  if (wrap.contains(document.activeElement)) document.activeElement.blur();
}

// Tapping the dimmed backdrop or a [data-close] button closes the panel.
function closable(wrap) {
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) hide(wrap);
  });
}

export function createAddSheet(wrap, { onStart }) {
  const label = wrap.querySelector('#add-label');
  const startButton = wrap.querySelector('#add-start');
  const recentList = wrap.querySelector('#add-recents');
  const slots = [...wrap.querySelectorAll('.entry-digits')];
  const priorityButtons = [...wrap.querySelectorAll('[data-set-priority]')];
  let digits = '';
  let priority = 'normal';
  let readouts = [];

  function refresh() {
    const { groups, seconds } = parseEntry(digits);
    const unentered = 6 - digits.length;
    readouts.forEach((r, i) => r.set(groups[i], Math.min(2, Math.max(0, unentered - i * 2))));
    startButton.disabled = seconds === 0;
  }

  function press(key) {
    if (key === 'back') digits = digits.slice(0, -1);
    else if (digits || !/^0+$/.test(key)) digits = (digits + key).slice(0, 6); // no leading zeros
    refresh();
  }

  function setPriority(value) {
    priority = value === 'high' ? 'high' : 'normal';
    for (const b of priorityButtons) b.setAttribute('aria-pressed', String(b.dataset.setPriority === priority));
  }

  function start() {
    const { seconds } = parseEntry(digits);
    if (!seconds) return;
    hide(wrap);
    onStart({ label: label.value.trim(), duration: seconds * 1000, priority });
  }

  function recentChip(r) {
    const seconds = r.duration / 1000;
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.seconds = seconds;
    chip.dataset.label = r.label;
    chip.dataset.priority = r.priority;
    chip.classList.toggle('hi', r.priority === 'high');
    chip.textContent = r.label ? `${r.label} · ${durationText(seconds)}` : durationLabel(seconds);
    return chip;
  }

  closable(wrap);
  wrap.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-set-priority]');
    if (choice) return setPriority(choice.dataset.setPriority);
    const key = e.target.closest('[data-digit]');
    if (key) return press(key.dataset.digit);
    const chip = e.target.closest('[data-seconds]');
    if (chip) {
      // Presets set only the duration; a recent timer brings back its label and priority too.
      digits = toEntry(Number(chip.dataset.seconds));
      if (chip.dataset.label !== undefined) label.value = chip.dataset.label;
      if (chip.dataset.priority) setPriority(chip.dataset.priority);
      return refresh();
    }
    if (e.target.closest('#add-start')) start();
  });

  label.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      label.blur();
    }
  });

  // Hardware keyboard: type the duration, Enter to start.
  document.addEventListener('keydown', (e) => {
    if (!isOpen(wrap) || e.target === label || e.metaKey || e.ctrlKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') start();
    else return;
    e.preventDefault(); // or Enter would also "click" whichever button has focus
  });

  return {
    isOpen: () => isOpen(wrap),
    close: () => hide(wrap),
    open(recents) {
      digits = '';
      label.value = '';
      setPriority('normal');
      recentList.replaceChildren(...recents.map(recentChip));
      recentList.hidden = recents.length === 0;
      refresh();
      show(wrap);
    },
    setFace(face) {
      readouts = slots.map((slot) => {
        const r = createReadout(face, 'regular');
        slot.replaceChildren(r.el);
        return r;
      });
      refresh();
    },
  };
}

export function createSettingsSheet(wrap, { get, set, onFullscreen, canFullscreen, isFullscreen }) {
  const from = wrap.querySelector('#night-from');
  const to = wrap.querySelector('#night-to');

  wrap.querySelector('[data-setting="color"]').replaceChildren(
    ...Object.entries(COLORS).map(([id, color]) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.value = JSON.stringify(id);
      b.style.setProperty('--sw', color.rgb.join(' '));
      b.setAttribute('aria-label', color.name);
      return b;
    }),
  );

  function sync() {
    const s = get();
    for (const group of wrap.querySelectorAll('[data-setting]')) {
      const current = JSON.stringify(s[group.dataset.setting]);
      for (const b of group.querySelectorAll('[data-value]')) {
        b.setAttribute('aria-pressed', String(b.dataset.value === current));
      }
    }
    from.value = s.nightFrom;
    to.value = s.nightTo;
    wrap.querySelector('.night-hours').classList.toggle('off', s.night !== 'auto');
    wrap.querySelector('#fs-row').hidden = !canFullscreen();
    wrap.querySelector('#fs-btn').textContent = isFullscreen() ? 'Exit full screen' : 'Full screen';
  }

  closable(wrap);
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('#fs-btn')) {
      onFullscreen();
      return hide(wrap); // show the result straight away
    }
    const b = e.target.closest('[data-value]');
    if (!b) return;
    set(b.closest('[data-setting]').dataset.setting, JSON.parse(b.dataset.value));
    sync();
  });

  for (const [input, key] of [[from, 'nightFrom'], [to, 'nightTo']]) {
    input.addEventListener('change', () => {
      if (/^\d\d:\d\d$/.test(input.value)) set(key, input.value);
      sync();
    });
  }

  return {
    isOpen: () => isOpen(wrap),
    close: () => hide(wrap),
    open() {
      sync();
      show(wrap);
    },
  };
}
