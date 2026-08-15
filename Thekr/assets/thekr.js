/* =========================================================================
   Thekr — shared athkar app
   Expects window.THEKR_DATA = { id, dir, sets:[...], items:[...] }
   ========================================================================= */
(function () {
  'use strict';

  var DATA = window.THEKR_DATA;
  if (!DATA) return;

  var SETTINGS_KEY = 'thekr.settings.v1';
  var PROGRESS_KEY = 'thekr.progress.v1.' + DATA.id;
  var SIZES = [1.12, 1.28, 1.45, 1.66, 1.92];
  var TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

  /* ---------------- storage helpers ---------------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- state ---------------- */
  var settings = Object.assign({
    size: 2, tashkeel: true, translit: false, translation: false, theme: 'auto', awake: false
  }, read(SETTINGS_KEY, {}));

  var progress = read(PROGRESS_KEY, null);
  if (!progress || progress.date !== today()) progress = { date: today(), sets: {} };

  var currentSet = pickSetByClock();
  var wakeLock = null;

  function pickSetByClock() {
    var h = new Date().getHours();
    var early = h >= 3 && h < 15;              /* dawn → mid-afternoon */
    return DATA.sets[early ? 0 : 1].id;
  }
  function setDef(id) {
    for (var i = 0; i < DATA.sets.length; i++) if (DATA.sets[i].id === id) return DATA.sets[i];
    return DATA.sets[0];
  }
  function itemsFor(id) {
    return DATA.items.filter(function (it) { return it.sets.indexOf(id) !== -1; });
  }
  function doneCount(setId, itemId) {
    var s = progress.sets[setId];
    return (s && s[itemId]) || 0;
  }
  function setDoneCount(setId, itemId, n) {
    if (!progress.sets[setId]) progress.sets[setId] = {};
    progress.sets[setId][itemId] = n;
    progress.date = today();
    write(PROGRESS_KEY, progress);
  }

  /* ---------------- icons ---------------- */
  var ICON = {
    sun: '<path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16l-1.42-1.42"/><circle cx="12" cy="12" r="4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 100 17 8.5 8.5 0 0010.5-6.5z"/>',
    sunrise: '<path d="M12 3v6m-4.2-1.8L6.4 5.8m11.2 1.4l1.4-1.4M2 18h20M4 14h2m12 0h2M8.5 14a3.5 3.5 0 017 0"/><path d="M2 22h20"/>',
    bed: '<path d="M3 18V8m0 4h18v6M3 12a3 3 0 013-3h3a3 3 0 013 3"/><circle cx="7.5" cy="8.5" r="1.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    back: '<path d="M19 12H5m7-7l-7 7 7 7"/>',
    undo: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 102.1-6.4L3 9"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.6"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22z"/><path d="M4 17.5A2.5 2.5 0 016.5 15H20"/>',
    star: '<path d="M12 2l2.4 6.5L21 9.2l-4.9 4.3 1.5 6.5L12 16.6 6.4 20l1.5-6.5L3 9.2l6.6-.7z"/>'
  };
  function svg(path, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  }

  /* ---------------- DOM refs ---------------- */
  var $ = function (s) { return document.querySelector(s); };
  var elList = $('#list');
  var elSeg = $('#segmented');
  var elBar = $('#progress-bar');
  var elCount = $('#progress-count');
  var elLabel = $('#progress-label');
  var elFinale = $('#finale');
  var elToast = $('#toast');
  var elSettings = $('#settings');
  var elGear = $('#gear');

  /* ---------------- toast ---------------- */
  var toastTimer;
  function toast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.setAttribute('data-show', 'false'); }, 2200);
  }

  /* ---------------- theme ---------------- */
  function applyTheme() {
    var theme = settings.theme === 'auto' ? setDef(currentSet).theme : settings.theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-set', currentSet);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'night' ? '#0B1119' : '#FAF6EF');
  }
  function applyTypography() {
    document.documentElement.style.setProperty('--dhikr-size', SIZES[settings.size] + 'rem');
  }

  /* ---------------- wake lock ---------------- */
  function applyWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (settings.awake) {
      navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
    } else if (wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && settings.awake) applyWakeLock();
  });

  /* ---------------- text helpers ---------------- */
  function shapeArabic(text) {
    return settings.tashkeel ? text : text.replace(TASHKEEL, '');
  }
  /* Split on Quranic brackets ﴿ ﴾ so verses can be visually distinguished. */
  function renderArabic(target, text) {
    target.textContent = '';
    var shaped = shapeArabic(text);
    shaped.split(/(\uFD3F[^\uFD3E]*\uFD3E)/).forEach(function (chunk) {
      if (!chunk) return;
      if (chunk.charAt(0) === '\uFD3F') {
        var em = document.createElement('em');
        em.textContent = chunk;
        target.appendChild(em);
      } else {
        target.appendChild(document.createTextNode(chunk));
      }
    });
  }

  /* ---------------- rendering ---------------- */
  function buildSegmented() {
    elSeg.innerHTML = '';
    DATA.sets.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(s.id === currentSet));
      b.dataset.set = s.id;
      b.innerHTML = svg(ICON[s.icon]) + '<span>' + s.label + '</span>';
      b.addEventListener('click', function () { switchSet(s.id); });
      elSeg.appendChild(b);
    });
  }

  function ringGeometry(el, done, total) {
    var C = 2 * Math.PI * 24;                       /* r = 24 */
    var fg = el.querySelector('.ring-fg');
    fg.setAttribute('stroke-dasharray', C.toFixed(2));
    fg.setAttribute('stroke-dashoffset', (C * (1 - done / total)).toFixed(2));
  }

  function paintCard(card) {
    var id = card.dataset.id;
    var total = parseInt(card.dataset.total, 10);
    var done = doneCount(currentSet, id);
    var remaining = total - done;
    var isDone = remaining <= 0;

    card.dataset.done = String(isDone);
    var counter = card.querySelector('.counter');
    var num = card.querySelector('.counter__num');

    if (isDone) {
      /* Sizing and stroke live in the stylesheet now — see .counter__num svg.
         Inline styles could not fix this anyway: they cannot override the
         position and transform the tick was picking up from the ring's rule. */
      num.innerHTML = svg(ICON.check, '');
    } else {
      num.textContent = String(remaining);
      num.classList.toggle('is-small', remaining >= 100);
    }
    ringGeometry(counter, done, total);

    card.querySelector('.card__tap').disabled = isDone;
    card.querySelector('[data-act="undo"]').hidden = done === 0;
    card.querySelector('[data-act="finish"]').hidden = isDone;

    var lbl = isDone
      ? DATA.strings.completed
      : DATA.strings.remaining.replace('{n}', remaining);
    card.querySelector('.card__tap').setAttribute('aria-label', lbl);
  }

  function buildCard(item) {
    var li = document.createElement('li');
    li.className = 'card';
    li.id = 'dhikr-' + item.id;
    li.dataset.id = item.id;
    li.dataset.total = item.count;

    /* --- tap area --- */
    var tap = document.createElement('button');
    tap.type = 'button';
    tap.className = 'card__tap';

    var counter = document.createElement('span');
    counter.className = 'counter';
    counter.innerHTML =
      '<svg viewBox="0 0 54 54" aria-hidden="true">' +
      '<circle class="ring-bg" cx="27" cy="27" r="24"/>' +
      '<circle class="ring-fg" cx="27" cy="27" r="24"/></svg>' +
      '<span class="counter__num"></span>';

    var body = document.createElement('span');
    body.className = 'card__body';

    var p = document.createElement('span');
    p.className = 'dhikr';
    p.style.display = 'block';
    renderArabic(p, item.ar);
    body.appendChild(p);

    if (item.tr) {
      var tr = document.createElement('span');
      tr.className = 'translit';
      tr.style.display = settings.translit ? 'block' : 'none';
      tr.dataset.role = 'translit';
      tr.lang = 'ar-Latn';
      tr.textContent = item.tr;
      body.appendChild(tr);
    }
    if (item.en) {
      var en = document.createElement('span');
      en.className = 'translation';
      en.style.display = settings.translation ? 'block' : 'none';
      en.dataset.role = 'translation';
      en.lang = 'en';
      en.textContent = item.en;
      body.appendChild(en);
    }
    if (item.note) {
      var nt = document.createElement('span');
      nt.className = 'note';
      nt.style.display = 'block';
      nt.textContent = item.note;
      body.appendChild(nt);
    }
    if (item.virtue) {
      var v = document.createElement('span');
      v.className = 'virtue';
      v.innerHTML = svg(ICON.star) + '<span><b>' + DATA.strings.virtue + '</b> </span>';
      v.querySelector('span').appendChild(document.createTextNode(item.virtue));
      body.appendChild(v);
    }

    tap.appendChild(counter);
    tap.appendChild(body);
    li.appendChild(tap);

    /* --- footer --- */
    var foot = document.createElement('div');
    foot.className = 'card__foot';

    var ref = document.createElement('span');
    ref.className = 'ref';
    ref.innerHTML = svg(ICON.book);
    ref.appendChild(document.createTextNode(item.ref));
    foot.appendChild(ref);

    if (item.grade) {
      var g = document.createElement('span');
      g.className = 'grade';
      g.dataset.g = item.gradeKey || '';
      g.textContent = item.grade;
      foot.appendChild(g);
    }

    var acts = document.createElement('span');
    acts.className = 'card__actions';
    acts.appendChild(miniBtn('undo', ICON.undo, DATA.strings.undo));
    acts.appendChild(miniBtn('finish', ICON.checkCircle, DATA.strings.markDone));
    foot.appendChild(acts);

    li.appendChild(foot);

    tap.addEventListener('click', function () { tick(li, 1); });
    return li;
  }

  function miniBtn(act, icon, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'minibtn';
    b.dataset.act = act;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = svg(icon);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var card = b.closest('.card');
      if (act === 'undo') tick(card, -1);
      else finish(card);
    });
    return b;
  }

  function tick(card, delta) {
    var id = card.dataset.id;
    var total = parseInt(card.dataset.total, 10);
    var done = Math.min(total, Math.max(0, doneCount(currentSet, id) + delta));
    setDoneCount(currentSet, id, done);

    var counter = card.querySelector('.counter');
    counter.classList.add('bump');
    setTimeout(function () { counter.classList.remove('bump'); }, 170);
    if (delta > 0 && navigator.vibrate) navigator.vibrate(8);

    paintCard(card);
    paintProgress();
    if (delta > 0 && done === total) advanceFrom(card);
  }

  function finish(card) {
    setDoneCount(currentSet, card.dataset.id, parseInt(card.dataset.total, 10));
    paintCard(card);
    paintProgress();
    advanceFrom(card);
  }

  function advanceFrom(card) {
    var next = card.nextElementSibling;
    while (next && next.dataset.done === 'true') next = next.nextElementSibling;
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (allDone()) {
      elFinale.setAttribute('data-show', 'true');
      elFinale.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function allDone() {
    return itemsFor(currentSet).every(function (it) { return doneCount(currentSet, it.id) >= it.count; });
  }

  function paintProgress() {
    var items = itemsFor(currentSet);
    var done = items.filter(function (it) { return doneCount(currentSet, it.id) >= it.count; }).length;
    var pct = items.length ? (done / items.length) * 100 : 0;
    elBar.style.width = pct + '%';
    elBar.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
    elCount.textContent = done + ' / ' + items.length;
    elLabel.textContent = setDef(currentSet).label;
    if (done < items.length) elFinale.setAttribute('data-show', 'false');
  }

  function renderList() {
    elList.innerHTML = '';
    itemsFor(currentSet).forEach(function (item) {
      var card = buildCard(item);
      elList.appendChild(card);
      paintCard(card);
    });
    paintProgress();
    elFinale.setAttribute('data-show', String(allDone()));
  }

  function switchSet(id) {
    if (id === currentSet) return;
    currentSet = id;
    Array.prototype.forEach.call(elSeg.children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.set === id));
    });
    applyTheme();
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- settings panel ---------------- */
  function toggleRow(label, hint, key, onChange) {
    var row = document.createElement('div');
    row.className = 'setting';
    var l = document.createElement('span');
    l.className = 'setting__label';
    l.textContent = label;
    if (hint) {
      var h = document.createElement('span');
      h.className = 'setting__hint';
      h.textContent = hint;
      l.appendChild(h);
    }
    var sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'switch';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(!!settings[key]));
    sw.setAttribute('aria-label', label);
    sw.addEventListener('click', function () {
      settings[key] = !settings[key];
      sw.setAttribute('aria-checked', String(settings[key]));
      write(SETTINGS_KEY, settings);
      onChange();
    });
    row.appendChild(l);
    row.appendChild(sw);
    return row;
  }

  function buildSettings() {
    var box = elSettings.querySelector('.settings__inner');
    box.innerHTML = '';
    var S = DATA.strings;

    /* font size stepper */
    var sizeRow = document.createElement('div');
    sizeRow.className = 'setting';
    sizeRow.innerHTML = '<span class="setting__label">' + S.fontSize + '</span>';
    var stepper = document.createElement('div');
    stepper.className = 'stepper';
    var minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', S.smaller);
    var out = document.createElement('output');
    var plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', S.larger);
    function paintSize() {
      out.textContent = (settings.size + 1) + '/' + SIZES.length;
      minus.disabled = settings.size === 0;
      plus.disabled = settings.size === SIZES.length - 1;
    }
    minus.addEventListener('click', function () {
      settings.size = Math.max(0, settings.size - 1); write(SETTINGS_KEY, settings); applyTypography(); paintSize();
    });
    plus.addEventListener('click', function () {
      settings.size = Math.min(SIZES.length - 1, settings.size + 1); write(SETTINGS_KEY, settings); applyTypography(); paintSize();
    });
    paintSize();
    stepper.appendChild(minus); stepper.appendChild(out); stepper.appendChild(plus);
    sizeRow.appendChild(stepper);
    box.appendChild(sizeRow);

    box.appendChild(toggleRow(S.tashkeel, S.tashkeelHint, 'tashkeel', function () {
      Array.prototype.forEach.call(elList.querySelectorAll('.card'), function (card) {
        var item = DATA.items.filter(function (i) { return String(i.id) === card.dataset.id; })[0];
        if (item) renderArabic(card.querySelector('.dhikr'), item.ar);
      });
    }));

    box.appendChild(toggleRow(S.translit, S.translitHint, 'translit', function () {
      Array.prototype.forEach.call(elList.querySelectorAll('[data-role="translit"]'), function (n) {
        n.style.display = settings.translit ? 'block' : 'none';
      });
    }));

    box.appendChild(toggleRow(S.translation, S.translationHint, 'translation', function () {
      Array.prototype.forEach.call(elList.querySelectorAll('[data-role="translation"]'), function (n) {
        n.style.display = settings.translation ? 'block' : 'none';
      });
    }));

    if ('wakeLock' in navigator) {
      box.appendChild(toggleRow(S.awake, S.awakeHint, 'awake', applyWakeLock));
    }

    /* theme chips */
    var themeRow = document.createElement('div');
    themeRow.className = 'setting';
    themeRow.innerHTML = '<span class="setting__label">' + S.theme + '</span>';
    var chips = document.createElement('div');
    chips.className = 'chips';
    [['auto', S.themeAuto], ['day', S.themeDay], ['night', S.themeNight]].forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = pair[1];
      b.setAttribute('aria-pressed', String(settings.theme === pair[0]));
      b.addEventListener('click', function () {
        settings.theme = pair[0];
        write(SETTINGS_KEY, settings);
        Array.prototype.forEach.call(chips.children, function (c) {
          c.setAttribute('aria-pressed', String(c === b));
        });
        applyTheme();
      });
      chips.appendChild(b);
    });
    themeRow.appendChild(chips);
    box.appendChild(themeRow);

    /* reset */
    var resetRow = document.createElement('div');
    resetRow.className = 'setting';
    resetRow.innerHTML = '<span class="setting__label">' + S.reset + '<span class="setting__hint">' + S.resetHint + '</span></span>';
    var rb = document.createElement('button');
    rb.type = 'button';
    rb.className = 'btn-danger';
    rb.textContent = S.resetBtn;
    rb.addEventListener('click', function () {
      progress = { date: today(), sets: {} };
      write(PROGRESS_KEY, progress);
      renderList();
      toast(S.resetDone);
    });
    resetRow.appendChild(rb);
    box.appendChild(resetRow);
  }

  elGear.addEventListener('click', function () {
    var open = elSettings.getAttribute('data-open') === 'true';
    elSettings.setAttribute('data-open', String(!open));
    elGear.setAttribute('aria-expanded', String(!open));
  });

  /* keyboard: space/enter handled natively by <button> */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && elSettings.getAttribute('data-open') === 'true') {
      elSettings.setAttribute('data-open', 'false');
      elGear.setAttribute('aria-expanded', 'false');
      elGear.focus();
    }
  });

  /* ---------------- boot ---------------- */
  applyTheme();
  applyTypography();
  buildSegmented();
  buildSettings();
  renderList();
  if (settings.awake) applyWakeLock();

  /* midnight rollover while the tab stays open */
  setInterval(function () {
    if (progress.date !== today()) {
      progress = { date: today(), sets: {} };
      write(PROGRESS_KEY, progress);
      renderList();
      toast(DATA.strings.newDay);
    }
  }, 60000);

  /* service worker */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
