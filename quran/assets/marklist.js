/* =========================================================================
   The bookmarks page — drives marks.html.

   Ayah text lives in the per-sūrah data files, and there are 114 of them, so
   only the sūrahs that actually hold a mark are fetched. Each one loads once
   and the page redraws as it arrives, which keeps a first visit with two
   marks from pulling several megabytes.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) {
    document.getElementById('list').innerHTML = '<p class="note">تعذّر تحميل بيانات الفهرس.</p>';
    return;
  }

  var M = QT.marks;
  var ar = QT.fmt.ar;
  var $ = function (q, r) { return (r || document).querySelector(q); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2200);
  }

  function pad3(n) { return String(n).padStart(3, '0'); }

  /* ---------------- lazy sūrah text ---------------- */

  var textOf = {};                  /* surah id -> { ayah -> arabic } */
  var asked = {};

  function loadSurah(id) {
    if (asked[id]) return;
    asked[id] = true;
    var s = document.createElement('script');
    s.src = 'assets/data/' + pad3(id) + '.js';
    s.onload = function () {
      var d = window.QURAN_SURAH;
      if (d && d.id === id) {
        var map = {};
        d.verses.forEach(function (v) { map[v.n] = v.ar; });
        textOf[id] = map;
        /* the global is reused by the next load, so it is consumed here */
        try { delete window.QURAN_SURAH; } catch (e) { window.QURAN_SURAH = null; }
        draw();
      }
    };
    s.onerror = function () { textOf[id] = {}; };
    document.head.appendChild(s);
  }

  /* Ayah text for a range, joined with their numbers as in the muṣḥaf. */
  function textFor(from, to) {
    var a = QT.index.fromGlobal(from), b = QT.index.fromGlobal(to);
    var parts = [], missing = false;
    for (var s = a.surah; s <= b.surah; s++) {
      if (!textOf[s]) { loadSurah(s); missing = true; continue; }
      var lo = s === a.surah ? a.ayah : 1;
      var hi = s === b.surah ? b.ayah : QT.index.fromGlobal(QT.index.surahRange(s)[1]).ayah;
      for (var n = lo; n <= hi; n++) {
        if (textOf[s][n]) parts.push(textOf[s][n] + ' ﴿' + ar(n) + '﴾');
      }
    }
    return missing && !parts.length ? null : parts.join(' ');
  }

  /* ---------------- state ---------------- */

  var filter = 'all';
  var expanded = {};
  var editing = null;

  /* ---------------- one mark ---------------- */

  function markCard(m) {
    var c = M.cat(m.cat);
    var card = el('div', 'mark');
    card.style.setProperty('--c', c ? c.color : 'var(--accent)');
    card.dataset.id = m.id;

    var top = el('div', 'mark__top');
    var ref = el('a', 'mark__ref',
      m.from === m.to ? QT.index.label(m.from) : QT.index.rangeLabel(m.from, m.to));
    ref.href = QT.index.href(m.from);
    top.appendChild(ref);

    var n = m.to - m.from + 1;
    top.appendChild(el('span', 'mark__meta',
      'صفحة ' + ar(QT.index.pageOf(m.from)) + (n > 1 ? ' · ' + ar(n) + ' آيات' : '')));

    var tools = el('div', 'mark__tools');

    var noteBtn = el('button', null, m.note ? 'عدّل الملاحظة' : 'أضف ملاحظة');
    noteBtn.type = 'button';
    noteBtn.addEventListener('click', function () {
      editing = editing === m.id ? null : m.id;
      draw();
    });
    tools.appendChild(noteBtn);

    var move = el('button', null, 'انقل');
    move.type = 'button';
    move.addEventListener('click', function () {
      var cats = M.cats();
      var i = 0;
      for (var k = 0; k < cats.length; k++) if (cats[k].id === m.cat) i = k;
      var next = cats[(i + 1) % cats.length];
      M.update(m.id, { cat: next.id });
      toast('نُقلت إلى «' + next.name + '»');
      draw();
    });
    tools.appendChild(move);

    var del = el('button', null, 'حذف');
    del.type = 'button';
    del.addEventListener('click', function () {
      M.remove(m.id);
      toast('حُذفت العلامة');
      draw();
    });
    tools.appendChild(del);

    top.appendChild(tools);
    card.appendChild(top);

    var txt = textFor(m.from, m.to);
    var p = el('p', 'mark__ar', txt == null ? '…' : txt);
    /* Long passages are clipped so the list stays scannable. */
    if (txt && n > 1 && !expanded[m.id]) p.classList.add('is-clipped');
    card.appendChild(p);
    if (txt && n > 1) {
      var more = el('button', 'mark__more', expanded[m.id] ? 'اطوِ' : 'اعرض كاملًا');
      more.type = 'button';
      more.addEventListener('click', function () {
        expanded[m.id] = !expanded[m.id];
        draw();
      });
      card.appendChild(more);
    }

    if (editing === m.id) {
      var ta = document.createElement('textarea');
      ta.className = 'mark__noteedit';
      ta.rows = 2;
      ta.value = m.note || '';
      ta.placeholder = 'لماذا وقفت هنا؟';
      ta.addEventListener('blur', function () {
        M.update(m.id, { note: ta.value.trim() });
        editing = null;
        toast('حُفظت الملاحظة');
        draw();
      });
      card.appendChild(ta);
      setTimeout(function () { ta.focus(); }, 20);
    } else if (m.note) {
      card.appendChild(el('div', 'mark__note', m.note));
    }

    return card;
  }

  /* ---------------- page ---------------- */

  function drawFilters() {
    var counts = M.counts();
    var total = M.list().length;
    var box = $('#filters');
    box.innerHTML = '';

    var all = el('button');
    all.type = 'button';
    all.dataset.cat = 'all';
    all.setAttribute('aria-pressed', String(filter === 'all'));
    all.innerHTML = '<span>الكل</span><small>' + ar(total) + '</small>';
    all.addEventListener('click', function () { filter = 'all'; draw(); });
    box.appendChild(all);

    M.cats().forEach(function (c) {
      if (!counts[c.id]) return;
      var b = el('button');
      b.type = 'button';
      b.dataset.cat = c.id;
      b.style.setProperty('--c', c.color);
      b.setAttribute('aria-pressed', String(filter === c.id));
      b.innerHTML = '<i></i><span>' + c.name + '</span><small>' + ar(counts[c.id]) + '</small>';
      b.addEventListener('click', function () { filter = c.id; draw(); });
      box.appendChild(b);
    });

    box.hidden = total === 0;
  }

  function drawList() {
    var all = M.list();
    $('#blank').hidden = all.length > 0;
    $('#crumb').textContent = all.length ? ar(all.length) + ' علامة' : '';

    var box = $('#list');
    box.innerHTML = '';
    if (!all.length) return;

    M.cats().forEach(function (c) {
      if (filter !== 'all' && filter !== c.id) return;
      var mine = M.list({ cat: c.id });
      if (!mine.length) return;

      var g = el('div', 'mgroup');
      g.style.setProperty('--c', c.color);
      var head = el('div', 'mgroup__head');
      head.appendChild(el('span', 'mgroup__dot'));
      head.appendChild(el('h2', 'mgroup__name', c.name));
      head.appendChild(el('span', 'mgroup__n', ar(mine.length)));
      g.appendChild(head);

      mine.forEach(function (m) { g.appendChild(markCard(m)); });
      box.appendChild(g);
    });
  }

  function drawCats() {
    var counts = M.counts();
    var cats = M.cats();
    var box = $('#cats');
    box.innerHTML = '';

    cats.forEach(function (c) {
      var row = el('div', 'catline');

      var color = document.createElement('input');
      color.type = 'color';
      color.value = c.color;
      color.setAttribute('aria-label', 'لون ' + c.name);
      color.addEventListener('change', function () {
        M.updateCat(c.id, { color: color.value });
        draw();
      });
      row.appendChild(color);

      var name = document.createElement('input');
      name.type = 'text';
      name.value = c.name;
      name.setAttribute('aria-label', 'اسم التصنيف');
      name.addEventListener('change', function () {
        M.updateCat(c.id, { name: name.value });
        toast('حُدّث التصنيف');
        draw();
      });
      row.appendChild(name);

      row.appendChild(el('span', 'catline__n', ar(counts[c.id] || 0)));

      var x = el('button', 'catline__x', 'حذف');
      x.type = 'button';
      x.disabled = cats.length <= 1;
      x.addEventListener('click', function () {
        var n = counts[c.id] || 0;
        var moveTo = null;
        if (n) {
          var others = cats.filter(function (o) { return o.id !== c.id; });
          moveTo = confirm(
            'لهذا التصنيف ' + n + ' علامة.\n\n' +
            'موافق = انقلها إلى «' + others[0].name + '»\n' +
            'إلغاء = احذفها معه') ? others[0].id : null;
          if (moveTo === null &&
              !confirm('حذف التصنيف و' + n + ' علامة معه؟ لا يمكن التراجع.')) return;
        }
        M.removeCat(c.id, moveTo);
        toast('حُذف التصنيف');
        if (filter === c.id) filter = 'all';
        draw();
      });
      row.appendChild(x);

      box.appendChild(row);
    });
  }

  $('#add-cat').addEventListener('click', function () {
    var c = M.addCat('تصنيف جديد', '#14514E');
    toast('أُضيف تصنيف — سمِّه كما تشاء');
    draw();
    setTimeout(function () {
      var rows = document.querySelectorAll('.catline input[type="text"]');
      var last = rows[rows.length - 1];
      if (last) { last.focus(); last.select(); }
    }, 40);
  });

  /* ---------------- theme ---------------- */

  var THEMES = [
    { id: 'paper', label: 'ورقي',       base: 'day',   palette: 'paper' },
    { id: 'blue',  label: 'أزرق',       base: 'day',   palette: 'blue'  },
    { id: 'mono',  label: 'أبيض وأسود', base: 'day',   palette: 'mono'  },
    { id: 'night', label: 'ليلي',       base: 'night', palette: 'paper' }
  ];
  var SUN = '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16l-1.42-1.42" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>';
  var MOON = '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 100 17 8.5 8.5 0 0010.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>';

  function readSet() { try { return JSON.parse(localStorage.getItem('quran.settings.v1') || '{}'); } catch (e) { return {}; } }
  function themeIndex() {
    var q = readSet();
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === q.theme) return i;
    return document.documentElement.getAttribute('data-theme') === 'night' ? 3 : 0;
  }
  function paintThemeIcon() {
    var t = THEMES[themeIndex()];
    $('#theme-icon').innerHTML = t.base === 'night' ? SUN : MOON;
    $('#theme-toggle').title = 'السمة: ' + t.label;
  }
  $('#theme-toggle').addEventListener('click', function () {
    var t = THEMES[(themeIndex() + 1) % THEMES.length];
    document.documentElement.setAttribute('data-theme', t.base);
    document.documentElement.setAttribute('data-palette', t.palette);
    try {
      var q = readSet(); q.theme = t.id;
      localStorage.setItem('quran.settings.v1', JSON.stringify(q));
    } catch (e) {}
    paintThemeIcon();
  });

  /* ---------------- boot ---------------- */

  function draw() {
    drawFilters();
    drawList();
    drawCats();
  }

  paintThemeIcon();
  draw();

  window.addEventListener('pageshow', function (e) { if (e.persisted) draw(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    });
  }
})();
