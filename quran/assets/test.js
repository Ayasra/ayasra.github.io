/* =========================================================================
   Review surface — activated on surah.html by ?review=<page>.

   The three testing modes are one idea wearing three hats: a function that
   decides, for each ayah on the page, whether its words are hidden, shown, or
   acting as a cue. Everything else here is the bar around it.

     hide     كامل الصفحة مخفيّ, tap an ayah to check it
     firstWord أول كلمة من كل آية ظاهرة — أقرب إلى ما يستذكر به الحافظ فعلاً
     next     آية ظاهرة, والمطلوب التي تليها

   ?queue=p,p,p carries the rest of the day's pages, so rating one page moves
   straight to the next without a trip back to the dashboard.
   ========================================================================= */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var reviewPage = parseInt(params.get('review'), 10);
  if (!(reviewPage >= 1 && reviewPage <= 604)) return;

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) return;

  var H = QT.hifz;
  var ar = QT.fmt.ar;
  var queue = (params.get('queue') || '')
    .split(',').map(function (x) { return parseInt(x, 10); })
    .filter(function (x) { return x >= 1 && x <= 604; });

  var pageRange = QT.index.pageRange(reviewPage);
  var rec = H.get(reviewPage);
  var startedAt = Date.now();

  var MODES = [
    { id: 'hide',      label: 'إخفاء' },
    { id: 'firstWord', label: 'أول كلمة' },
    { id: 'next',      label: 'ما التالية' }
  ];
  var mode = 'hide';
  var marking = false;
  var shown = {};        /* ayah number -> revealed */
  var promptAyah = null; /* for 'next' mode */

  document.documentElement.setAttribute('data-review', 'on');

  /* ---------------- which ayahs are on this page ---------------- */

  var sid = parseInt(params.get('s'), 10) || 1;

  function ayahsOnPage() {
    var out = [];
    var sr = QT.index.surahRange(sid);
    var lo = Math.max(pageRange[0], sr[0]), hi = Math.min(pageRange[1], sr[1]);
    for (var g = lo; g <= hi; g++) out.push(QT.index.fromGlobal(g).ayah);
    return out;
  }

  /* Fifty-four of the 604 sheets carry the end of one sūrah and the start of
     the next, and the reader draws one sūrah at a time — a neighbouring
     sūrah's lines are left blank in their true place. So on those pages a
     review covers only half the sheet unless the reciter is told, and given
     the other half to go to. */
  function surahsOnPage() {
    var a = QT.index.fromGlobal(pageRange[0]).surah;
    var b = QT.index.fromGlobal(pageRange[1]).surah;
    var out = [];
    for (var s = a; s <= b; s++) out.push(s);
    return out;
  }

  function wordsOf(n) {
    return document.querySelectorAll(
      '.mushaf__page[data-page="' + reviewPage + '"] .w[data-n="' + n + '"], ' +
      '.mushaf__page[data-page="' + reviewPage + '"] .a[data-n="' + n + '"]');
  }

  /* ---------------- the mask ---------------- */

  function applyMask() {
    var list = ayahsOnPage();
    if (!list.length) return;

    if (mode === 'next' && promptAyah == null) {
      /* Ask about a seam rather than the opening — the joins between ayahs are
         where hifz actually gives way. */
      promptAyah = list[Math.floor(Math.random() * Math.max(1, list.length - 1))];
    }

    list.forEach(function (n) {
      var ws = wordsOf(n);
      var revealed = !!shown[n];
      Array.prototype.forEach.call(ws, function (w, i) {
        w.classList.remove('is-masked', 'is-cue', 'is-shown', 'is-prompt');

        if (revealed) { w.classList.add('is-shown'); return; }

        if (mode === 'hide') {
          w.classList.add('is-masked');
        } else if (mode === 'firstWord') {
          if (i === 0) w.classList.add('is-cue'); else w.classList.add('is-masked');
        } else {
          if (n === promptAyah) w.classList.add('is-prompt');
          else if (n === promptAyah + 1) w.classList.add('is-masked');
          else w.classList.add('is-shown');
        }
      });
    });

    paintSlips();
  }

  function paintSlips() {
    H.slipsOn(reviewPage).forEach(function (s) {
      var pos = QT.index.fromGlobal(s.g);
      /* Ayah numbers restart with every sūrah, so on a page shared by two of
         them an unguarded lookup would paint the wrong ayah. */
      if (pos.surah !== sid) return;
      Array.prototype.forEach.call(wordsOf(pos.ayah), function (w) { w.classList.add('is-slip'); });
    });
  }

  function revealAll() {
    ayahsOnPage().forEach(function (n) { shown[n] = true; });
    applyMask();
  }

  function resetMask() {
    shown = {};
    promptAyah = null;
    applyMask();
  }

  /* A tap means "check this ayah" normally, and "flag this ayah" while marking.
     Bound on the page rather than per word so it survives the reader's
     re-renders, and captured so it beats quran.js's own word handlers — during
     a test, tapping a word must not start the recitation. */
  function onPageClick(e) {
    var w = e.target.closest ? e.target.closest('.w[data-n], .a[data-n]') : null;
    if (!w) return;
    var page = w.closest('.mushaf__page');
    if (!page || +page.dataset.page !== reviewPage) return;

    e.preventDefault();
    e.stopPropagation();

    var n = +w.dataset.n;
    if (marking) {
      var g = QT.index.toGlobal(parseInt(params.get('s'), 10) || 1, n);
      H.slip(g);
      paintSlips();
      toast('سُجِّل موضع التعثّر');
      return;
    }
    shown[n] = !shown[n];
    applyMask();
  }
  document.addEventListener('click', onPageClick, true);

  /* ---------------- bar ---------------- */

  var bar = document.createElement('div');
  bar.className = 'reviewbar';
  document.body.appendChild(bar);

  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2200);
  }

  function icon(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var I = {
    eye:  'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
    flag: 'M4 22V4h13l-2 4 2 4H4',
    redo: 'M23 4v6h-6M20.5 15a9 9 0 11-2.1-9.4L23 10'
  };

  function drawBar() {
    bar.innerHTML = '';
    var inner = document.createElement('div');
    inner.className = 'reviewbar__inner';

    /* where we are */
    var top = document.createElement('div');
    top.className = 'reviewbar__top';

    var where = document.createElement('span');
    where.className = 'reviewbar__where';
    var q = rec ? queueLabel() : '';
    where.innerHTML = 'صفحة <b>' + ar(reviewPage) + '</b> <small>· ' +
      QT.index.rangeLabel(pageRange[0], pageRange[1]) + (q ? ' · ' + q : '') + '</small>';
    top.appendChild(where);

    if (queue.length) {
      var count = document.createElement('span');
      count.className = 'reviewbar__count';
      count.textContent = 'بقي ' + ar(queue.length);
      top.appendChild(count);
    }
    inner.appendChild(top);

    /* the other half of a shared sheet */
    var others = surahsOnPage().filter(function (s) { return s !== sid; });
    if (others.length) {
      var note = document.createElement('div');
      note.className = 'reviewbar__span';
      var links = others.map(function (s) {
        var r = QT.index.surahRange(s);
        var at = QT.index.fromGlobal(Math.max(r[0], pageRange[0]));
        return '<a href="surah.html?s=' + s + '&a=' + at.ayah + '&review=' + reviewPage +
               (queue.length ? '&queue=' + queue.join(',') : '') + '">' +
               QT.index.surahName(s) + '</a>';
      }).join('، ');
      note.innerHTML = 'هذه الصفحة تشترك فيها أكثر من سورة — بقيّتها في ' + links + '.';
      inner.appendChild(note);
    }

    /* mode switch */
    var modes = document.createElement('div');
    modes.className = 'modes';
    MODES.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.setAttribute('aria-pressed', String(m.id === mode));
      b.addEventListener('click', function () {
        mode = m.id;
        resetMask();
        drawBar();
      });
      modes.appendChild(b);
    });

    var tools = document.createElement('div');
    tools.className = 'reviewbar__tools';
    tools.appendChild(modes);

    var reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'rbtn';
    reveal.innerHTML = icon(I.eye) + '<span>اكشف</span>';
    reveal.addEventListener('click', revealAll);
    tools.appendChild(reveal);

    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'rbtn rbtn--quiet';
    again.innerHTML = icon(I.redo) + '<span>' + (mode === 'next' ? 'سؤال آخر' : 'أعد') + '</span>';
    again.addEventListener('click', resetMask);
    tools.appendChild(again);

    var mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'rbtn';
    mark.setAttribute('aria-pressed', String(marking));
    mark.innerHTML = icon(I.flag) + '<span>علّم التعثّر</span>';
    mark.title = 'حين يعمل هذا، النقر على الآية يسجّلها موضع تعثّر';
    mark.addEventListener('click', function () {
      marking = !marking;
      document.documentElement.setAttribute('data-marking', String(marking));
      drawBar();
      toast(marking ? 'انقر الآية التي تعثّرت فيها' : 'عاد النقر إلى الكشف');
    });
    tools.appendChild(mark);

    inner.appendChild(tools);

    /* ratings */
    var rates = document.createElement('div');
    rates.className = 'rates';
    [
      ['forgot', 'نسيت', 'من الغد'],
      ['shaky', 'تعثّرت', 'قريباً'],
      ['clean', 'أتقنت', 'تتباعد']
    ].forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rate--' + r[0];
      b.innerHTML = r[1] + '<small>' + r[2] + '</small>';
      b.addEventListener('click', function () { submit(r[0]); });
      rates.appendChild(b);
    });
    inner.appendChild(rates);

    bar.appendChild(inner);
  }

  function queueLabel() {
    var qn = QT._internal.queueOf(rec, QT.date.today());
    return { sabaq: 'سَبْق', sabqi: 'سَبْقي', manzil: 'مَنْزِل' }[qn] || '';
  }

  /* ---------------- rating ---------------- */

  function submit(rating) {
    if (!rec) {
      /* Reviewing a page that was never added — take the rating as intent to
         start tracking it rather than dropping the input on the floor. */
      H.add(reviewPage);
      H.promote(reviewPage);
      rec = H.get(reviewPage);
    }
    var seconds = Math.round((Date.now() - startedAt) / 1000);
    H.rate(reviewPage, rating, seconds > 5 ? seconds : 0);

    var next = queue.shift();
    if (next) {
      var pos = QT.index.fromGlobal(QT.index.pageRange(next)[0]);
      location.href = 'surah.html?s=' + pos.surah + '&a=' + pos.ayah +
        '&review=' + next + (queue.length ? '&queue=' + queue.join(',') : '');
      return;
    }
    location.href = 'hifz.html';
  }

  /* ---------------- boot ----------------
     The reader builds #main asynchronously and rebuilds it on every settings
     change, so the mask is re-applied whenever the page's children change
     rather than once at load. */

  var main = document.getElementById('main');
  if (main) {
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(applyMask, 120);
    }).observe(main, { childList: true, subtree: true });
  }

  drawBar();
  applyMask();
  setTimeout(applyMask, 400);   /* after the reader's first paint and font fit */

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { location.href = 'hifz.html'; }
    if (e.key === ' ' && !/input|textarea|select/i.test((e.target.tagName || ''))) {
      e.preventDefault();
      revealAll();
    }
  });
})();
