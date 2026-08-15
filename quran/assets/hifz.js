/* =========================================================================
   Hifz dashboard — drives hifz.html.

   This page owns the queues and the overview. It does not render Qur'anic
   text: reviewing happens in the reader, which already knows how to set a
   muṣḥaf page, so a review is a link into surah.html carrying the queue with
   it. See assets/test.js for the other end.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) {
    document.getElementById('queues-sec').innerHTML = '<p>تعذّر تحميل بيانات الفهرس.</p>';
    document.getElementById('queues-sec').hidden = false;
    return;
  }

  var H = QT.hifz;
  var ar = QT.fmt.ar;
  var $ = function (s, r) { return (r || document).querySelector(s); };

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
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2400);
  }

  /* A page's ayah range described the way a reader thinks of it. */
  function pageLabel(p) {
    var r = QT.index.pageRange(p);
    return QT.index.rangeLabel(r[0], r[1]);
  }

  /* Open the reader in review mode, handing it the rest of the queue so it can
     move straight from one page to the next without coming back here. */
  function reviewHref(pages) {
    if (!pages.length) return '#';
    var first = pages[0];
    var start = QT.index.pageRange(first)[0];
    var pos = QT.index.fromGlobal(start);
    return 'surah.html?s=' + pos.surah + '&a=' + pos.ayah +
           '&review=' + first +
           (pages.length > 1 ? '&queue=' + pages.slice(1).join(',') : '');
  }

  /* ---------------- queues ---------------- */

  var QUEUE_META = {
    sabaq: {
      name: 'السَّبْق', ar: 'الجديد',
      why: 'الصفحة التي تحفظها الآن. تبقى هنا حتى تقول إنّك أتقنتها، ثم تنتقل إلى السَّبْقي.'
    },
    sabqi: {
      name: 'السَّبْقي', ar: 'القريب',
      why: 'ما حفظته في الأيام الأخيرة. يُراجَع كلّ يوم دون استثناء — الحفظ الجديد لم يستقرّ بعد، والمباعدة بين مراجعاته هي التي تُضيعه.'
    },
    manzil: {
      name: 'المَنْزِل', ar: 'البعيد',
      why: 'الحفظ القديم، على مراجعة متباعدة. كلّما أتقنت صفحةً تباعدت مواعيدها، وكلّما تعثّرت فيها قرُبت.'
    }
  };

  function pageChip(rec, day, opts) {
    var a = el('a', 'pagechip');
    a.href = reviewHref([rec.p]);
    var overdue = rec.due ? QT.date.daysBetween(rec.due, day) : 0;
    if (opts && opts.overdue && overdue > 0) a.setAttribute('data-overdue', 'true');
    a.innerHTML = '<b>' + ar(rec.p) + '</b><small>' + pageLabel(rec.p) + '</small>' +
      (opts && opts.overdue && overdue > 0
        ? '<small>· متأخّرة ' + ar(overdue) + '</small>' : '');
    a.title = 'صفحة ' + rec.p + ' — ' + pageLabel(rec.p);
    return a;
  }

  function queueBlock(key, list, day) {
    var meta = QUEUE_META[key];
    var box = el('div', 'queue');
    box.setAttribute('data-q', key);

    var head = el('div', 'queue__head');
    head.appendChild(el('h3', 'queue__name', meta.name));
    head.appendChild(el('span', 'queue__ar', meta.ar));
    head.appendChild(el('span', 'queue__n', ar(list.length)));
    box.appendChild(head);
    box.appendChild(el('p', 'queue__why', meta.why));

    if (!list.length) {
      box.appendChild(el('p', 'queue__empty',
        key === 'sabaq' ? 'لا سبق اليوم.' : 'لا شيء مستحقّ. الحمد لله.'));
      if (key === 'sabaq') {
        var acts0 = el('div', 'queue__actions');
        var add = el('button', 'btn btn--sm', 'ابدأ صفحة جديدة');
        add.type = 'button';
        add.addEventListener('click', function () { openAdd('learning'); });
        acts0.appendChild(add);
        box.appendChild(acts0);
      }
      return box;
    }

    var wrap = el('div', 'queue__list');
    /* A long queue is dispiriting and slow to render; the rest is one tap away
       via the review flow anyway. */
    var shown = list.slice(0, 24);
    shown.forEach(function (rec) {
      wrap.appendChild(pageChip(rec, day, { overdue: key === 'manzil' }));
    });
    if (list.length > shown.length) {
      wrap.appendChild(el('span', 'pagechip', '+' + ar(list.length - shown.length)));
    }
    box.appendChild(wrap);

    var acts = el('div', 'queue__actions');
    var go = el('a', 'btn btn--go btn--sm',
      key === 'sabaq' ? 'افتح الصفحة' : 'ابدأ المراجعة');
    go.href = reviewHref(list.map(function (r) { return r.p; }));
    acts.appendChild(go);

    if (key === 'sabaq') {
      list.slice(0, 1).forEach(function (rec) {
        var done = el('button', 'btn btn--sm', 'حفظت صفحة ' + ar(rec.p));
        done.type = 'button';
        done.addEventListener('click', function () {
          H.promote(rec.p);
          toast('انتقلت الصفحة إلى السَّبْقي');
          drawAll();
        });
        acts.appendChild(done);
      });
    }
    box.appendChild(acts);
    return box;
  }

  function drawQueues() {
    var all = H.all();
    $('#onboard-sec').hidden = all.length > 0;
    $('#queues-sec').hidden = all.length === 0;
    if (!all.length) return;

    var day = QT.date.today();
    var q = H.queues(day);
    var box = $('#queues');
    box.innerHTML = '';
    ['sabaq', 'sabqi', 'manzil'].forEach(function (k) {
      box.appendChild(queueBlock(k, q[k], day));
    });

    var due = q.sabaq.length + q.sabqi.length + q.manzil.length;
    $('#due-count').textContent = due
      ? ar(due) + (due === 1 ? ' صفحة مستحقّة' : ' صفحة مستحقّة')
      : 'لا شيء مستحقّ';
    $('#crumb').textContent = ar(H.stats().memorized) + ' صفحة';
  }

  /* ---------------- coverage map ---------------- */

  function drawMap() {
    var all = H.all();
    $('#map-sec').hidden = all.length === 0;
    if (!all.length) return;

    var cov = H.coverage();
    var map = $('#map');
    map.innerHTML = '';
    var stale = 0;
    cov.forEach(function (c) {
      var n = el('i');
      n.setAttribute('data-s', c.state);
      if (c.state === 'memorized') {
        n.style.setProperty('--h', c.heat.toFixed(2));
        /* Three days late is a slip; a day late is just life. Only the former
           earns the alarming colour. */
        if (c.overdue >= 3) { n.setAttribute('data-stale', 'true'); stale++; }
      }
      n.title = 'صفحة ' + c.p + ' — ' + (
        c.state === 'none' ? 'لم يُحفظ' :
        c.state === 'learning' ? 'قيد الحفظ' :
        'محفوظ' + (c.overdue > 0 ? ' · متأخّرة ' + c.overdue + ' يوماً' : '')
      );
      map.appendChild(n);
    });

    var st = H.stats();
    $('#map-aside').textContent =
      ar(st.memorized) + ' من ' + ar(st.totalPages) + ' صفحة' +
      (stale ? ' · ' + ar(stale) + ' متأخّرة' : '');
  }

  /* ---------------- weak links ---------------- */

  function drawWeak() {
    var list = H.weakest(12);
    $('#weak-sec').hidden = list.length === 0;
    if (!list.length) return;

    var box = $('#weak');
    box.innerHTML = '';
    list.forEach(function (w) {
      var row = el('div', 'weakrow');

      var link = el('a', 'weakrow__ref', QT.index.label(w.g));
      link.href = QT.index.href(w.g);
      row.appendChild(link);

      row.appendChild(el('span', 'weakrow__n', ar(w.n) + '×'));

      var x = el('button', 'weakrow__x', 'أزل');
      x.type = 'button';
      x.title = 'أزل هذا الموضع';
      x.addEventListener('click', function () {
        H.clearSlip(w.g);
        drawAll();
      });
      row.appendChild(x);

      box.appendChild(row);
    });
  }

  /* ---------------- stats ---------------- */

  function drawStats() {
    var st = H.stats();
    $('#stats-sec').hidden = st.tracked === 0;
    $('#prefs-sec').hidden = st.tracked === 0;
    if (!st.tracked) return;

    $('#stats').innerHTML = [
      '<b>' + ar(st.memorized) + '</b><small>صفحة محفوظة</small>',
      '<b>' + ar(st.juz) + '</b><small>ما يعادل جزءاً</small>',
      '<b>' + ar(st.pct) + '٪</b><small>من المصحف</small>',
      '<b>' + ar(st.dueToday) + '</b><small>مستحقّ اليوم</small>'
    ].map(function (s) { return '<div class="stat">' + s + '</div>'; }).join('');

    var p = H.prefs();
    $('#pf-sabqi').value = p.sabqiDays;
    $('#pf-max').value = p.maxInterval;
  }

  $('#pf-save').addEventListener('click', function () {
    var s = Math.max(1, Math.min(30, parseInt($('#pf-sabqi').value, 10) || 7));
    var m = Math.max(7, Math.min(365, parseInt($('#pf-max').value, 10) || 60));
    H.setPrefs({ sabqiDays: s, maxInterval: m });
    toast('حُفظت الإعدادات');
    drawAll();
  });
  $('#pf-add').addEventListener('click', function () { openAdd('memorized'); });
  $('#add-pages').addEventListener('click', function () { openAdd('learning'); });

  /* ---------------- add pages ---------------- */

  var modal = $('#modal');

  function currentAs() {
    var b = $('.seg button[aria-pressed="true"]');
    return b ? b.dataset.as : 'memorized';
  }

  function fillRanges() {
    var kind = $('#a-kind').value;
    var from = $('#a-from'), to = $('#a-to');
    var prevFrom = from.value, prevTo = to.value;
    from.innerHTML = ''; to.innerHTML = '';

    var opts = [];
    if (kind === 'juz') {
      for (var j = 1; j <= 30; j++) opts.push([String(j), 'الجزء ' + ar(j)]);
    } else if (kind === 'surah') {
      (window.QURAN_SURAHS || []).forEach(function (s) {
        opts.push([String(s.id), ar(s.id) + ' · ' + s.nameAr]);
      });
    } else {
      for (var p = 1; p <= QT.index.pages; p++) opts.push([String(p), 'صفحة ' + ar(p)]);
    }
    opts.forEach(function (o) {
      from.appendChild(new Option(o[1], o[0]));
      to.appendChild(new Option(o[1], o[0]));
    });
    from.value = prevFrom && from.querySelector('option[value="' + prevFrom + '"]') ? prevFrom : opts[0][0];
    to.value = prevTo && to.querySelector('option[value="' + prevTo + '"]') ? prevTo : opts[0][0];
    summarise();
  }

  /* Whatever the reader picked, it becomes a page range in the end. */
  function chosenPages() {
    var kind = $('#a-kind').value;
    var a = parseInt($('#a-from').value, 10) || 1;
    var b = parseInt($('#a-to').value, 10) || 1;
    if (kind === 'page') return [Math.min(a, b), Math.max(a, b)];

    var ra = kind === 'juz' ? QT.index.juzRange(a) : QT.index.surahRange(a);
    var rb = kind === 'juz' ? QT.index.juzRange(b) : QT.index.surahRange(b);
    var lo = Math.min(ra[0], rb[0]), hi = Math.max(ra[1], rb[1]);
    return [QT.index.pageOf(lo), QT.index.pageOf(hi)];
  }

  function summarise() {
    var r = chosenPages();
    var n = r[1] - r[0] + 1;
    $('#a-summary').textContent =
      'صفحات ' + ar(r[0]) + '–' + ar(r[1]) + ' · ' + ar(n) + (n === 1 ? ' صفحة' : ' صفحة');
  }

  function paintAs() {
    $('#as-hint').textContent = currentAs() === 'memorized'
      ? 'تدخل مباشرةً في المراجعة المتباعدة، موزَّعةً على الأيام السبعة القادمة حتى لا تحلّ كلّها دفعةً واحدة.'
      : 'تدخل في السَّبْق، فتبقى معك حتى تقول إنّك أتقنتها.';
  }

  Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      paintAs();
    });
  });
  $('#a-kind').addEventListener('change', fillRanges);
  $('#a-from').addEventListener('change', summarise);
  $('#a-to').addEventListener('change', summarise);

  function openAdd(as) {
    Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.as === as));
    });
    $('#a-kind').value = as === 'learning' ? 'page' : 'juz';
    fillRanges();
    paintAs();
    modal.setAttribute('data-open', 'true');
  }
  function closeAdd() { modal.setAttribute('data-open', 'false'); }

  $('#modal-close').addEventListener('click', closeAdd);
  $('#modal-scrim').addEventListener('click', closeAdd);
  $('#a-cancel').addEventListener('click', closeAdd);
  $('#ob-range').addEventListener('click', function () { openAdd('memorized'); });
  $('#ob-new').addEventListener('click', function () { openAdd('learning'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.getAttribute('data-open') === 'true') closeAdd();
  });

  $('#add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = chosenPages();
    var n = H.addRange(r[0], r[1], { memorized: currentAs() === 'memorized' });
    closeAdd();
    toast(n ? 'أُضيفت ' + ar(n) + ' صفحة' : 'كل هذه الصفحات مسجّلة من قبل');
    drawAll();
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
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content',
      t.base === 'night' ? '#0B1412' : t.palette === 'blue' ? '#EEF4FA' : t.palette === 'mono' ? '#F4F4F4' : '#0E3B39');
    try {
      var q = readSet(); q.theme = t.id;
      localStorage.setItem('quran.settings.v1', JSON.stringify(q));
    } catch (e) {}
    paintThemeIcon();
  });

  /* ---------------- boot ---------------- */

  function drawAll() {
    drawQueues();
    drawMap();
    drawWeak();
    drawStats();
  }

  paintThemeIcon();
  drawAll();

  /* Returning from a review should show the updated queues. */
  window.addEventListener('pageshow', function (e) { if (e.persisted) drawAll(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) drawAll();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
    });
  }
})();
