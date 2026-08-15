/* =========================================================================
   Coloured marks in the reader.

   Two jobs: paint the marks onto whatever the reader just rendered, and put
   the marking panel into the verse sheet when it opens. quran.js knows about
   neither — it announces `quran:sheet` and rebuilds #main, and this file
   reacts to both.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) return;

  var M = QT.marks;
  var ar = QT.fmt.ar;
  var sid = parseInt(new URLSearchParams(location.search).get('s'), 10);
  if (!(sid >= 1 && sid <= 114)) sid = 1;
  var surahRange = QT.index.surahRange(sid);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2200);
  }

  function colorOf(catId) {
    var c = M.cat(catId);
    return c ? c.color : 'var(--accent)';
  }

  /* ---------------- painting ----------------
     One pass over the rendered surah: build ayah -> categories once, then
     stamp the colours as custom properties. At most three stripes are drawn;
     beyond that the page turns into a swatch book and stops being readable. */

  var MAX_STRIPES = 3;

  function stamp(node, cats) {
    if (!cats || !cats.length) {
      node.removeAttribute('data-marked');
      node.style.removeProperty('--mark-1');
      node.style.removeProperty('--mark-2');
      node.style.removeProperty('--mark-3');
      return;
    }
    var n = Math.min(cats.length, MAX_STRIPES);
    node.setAttribute('data-marked', String(n));
    for (var i = 0; i < MAX_STRIPES; i++) {
      if (i < n) node.style.setProperty('--mark-' + (i + 1), colorOf(cats[i]));
      else node.style.removeProperty('--mark-' + (i + 1));
    }
  }

  function paint() {
    var map = M.mapOver(surahRange[0], surahRange[1]);

    /* verse view: the whole card carries the rule */
    Array.prototype.forEach.call(document.querySelectorAll('.ayah[data-n]'), function (li) {
      stamp(li, map[QT.index.toGlobal(sid, +li.dataset.n)]);
    });

    /* page views: every word of the ayah is underlined */
    Array.prototype.forEach.call(
      document.querySelectorAll('.mushaf__line .w[data-n], .mushaf__text .a[data-n]'),
      function (w) {
        stamp(w, map[QT.index.toGlobal(sid, +w.dataset.n)]);
      });
  }

  /* The reader rebuilds #main on every settings change, so repaint on change
     rather than once at load. */
  var main = document.getElementById('main');
  if (main) {
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(paint, 100);
    }).observe(main, { childList: true, subtree: true });
  }

  /* ---------------- the sheet panel ---------------- */

  function panel(ayah) {
    var g = QT.index.toGlobal(sid, ayah);
    var box = el('div', 'marks');

    var head = el('div', 'marks__head');
    head.appendChild(el('h3', null, 'العلامات'));
    var all = el('a', null, 'كل العلامات ←');
    all.href = 'marks.html';
    head.appendChild(all);
    box.appendChild(head);

    /* category chips — a tap marks or unmarks this single ayah */
    var row = el('div', 'catrow');
    var here = M.at(g);
    M.cats().forEach(function (c) {
      var chip = el('button', 'catchip');
      chip.type = 'button';
      chip.style.setProperty('--c', c.color);
      chip.innerHTML = '<i></i><span>' + c.name + '</span>';
      var on = here.some(function (m) { return m.cat === c.id && m.from === g && m.to === g; });
      chip.setAttribute('aria-pressed', String(on));
      chip.addEventListener('click', function () {
        var end = parseInt(endSel.value, 10) || ayah;
        if (end !== ayah) {
          M.add({ cat: c.id, from: g, to: QT.index.toGlobal(sid, end),
                  note: note.value.trim() });
          toast('عُلّم المدى');
        } else {
          var made = M.toggle(g, c.id);
          if (made && note.value.trim()) M.update(made.id, { note: note.value.trim() });
          toast(made ? 'عُلّمت الآية' : 'أُزيلت العلامة');
        }
        redraw();
      });
      row.appendChild(chip);
    });
    box.appendChild(row);

    /* range end — defaults to the same ayah, so a plain tap stays one tap */
    var span = el('div', 'marks__span');
    span.appendChild(el('label', null, 'إلى الآية'));
    var endSel = document.createElement('select');
    var last = QT.index.fromGlobal(surahRange[1]).ayah;
    for (var a = ayah; a <= last; a++) {
      endSel.appendChild(new Option(ar(a) + (a === ayah ? ' (هذه وحدها)' : ''), String(a)));
    }
    span.appendChild(endSel);
    box.appendChild(span);

    var note = document.createElement('textarea');
    note.className = 'marks__note';
    note.rows = 2;
    note.placeholder = 'ملاحظة (اختيارية)…';
    var existingNote = here.filter(function (m) { return m.note; })[0];
    if (existingNote) note.value = existingNote.note;
    box.appendChild(note);

    box.appendChild(el('p', 'marks__hint',
      'اختر تصنيفًا لتعليم هذه الآية. ولتعليم مقطع، حدّد آخر آية فيه أولًا ثم اختر التصنيف.'));

    /* what is already on this ayah */
    if (here.length) {
      var list = el('div', 'marks__list');
      here.forEach(function (m) {
        var c = M.cat(m.cat);
        var r = el('div', 'markrow');
        r.style.setProperty('--c', c ? c.color : 'var(--accent)');
        var label = m.from === m.to
          ? QT.index.label(m.from)
          : QT.index.rangeLabel(m.from, m.to);
        r.innerHTML = '<b>' + (c ? c.name : '—') + '</b><span>' + label +
                      (m.note ? ' · ' + m.note : '') + '</span>';
        var x = el('button', null, 'حذف');
        x.type = 'button';
        x.addEventListener('click', function () {
          M.remove(m.id);
          toast('حُذفت العلامة');
          redraw();
        });
        r.appendChild(x);
        list.appendChild(r);
      });
      box.appendChild(list);
    }

    /* a note typed without choosing a category still has somewhere to land */
    note.addEventListener('blur', function () {
      var v = note.value.trim();
      var mine = M.at(g).filter(function (m) { return m.from === g; })[0];
      if (mine && v !== (mine.note || '')) {
        M.update(mine.id, { note: v });
        toast('حُفظت الملاحظة');
        redraw();
      }
    });

    return box;
  }

  var openAyah = null;

  function redraw() {
    paint();
    if (openAyah != null) mountPanel(openAyah);
  }

  function mountPanel(ayah) {
    var body = document.getElementById('sheet-body');
    if (!body) return;
    var old = body.querySelector('.marks');
    if (old) old.remove();
    body.appendChild(panel(ayah));
  }

  document.addEventListener('quran:sheet', function (e) {
    openAyah = e.detail.ayah;
    mountPanel(openAyah);
  });

  /* the sheet closing means the panel is gone with it */
  var sheet = document.getElementById('sheet');
  if (sheet) {
    new MutationObserver(function () {
      if (sheet.getAttribute('data-open') !== 'true') openAyah = null;
    }).observe(sheet, { attributes: true, attributeFilter: ['data-open'] });
  }

  paint();
  setTimeout(paint, 400);
})();
