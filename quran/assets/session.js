/* =========================================================================
   Reading-session pill — the only hook the tracker puts into the reader.

   Deliberately a separate file rather than an edit to quran.js: the reader is
   about rendering the muṣḥaf, and none of its logic needs to know that
   sessions exist. This file only reads the DOM the reader produced.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) return;

  var sid = parseInt(new URLSearchParams(location.search).get('s'), 10);
  if (!(sid >= 1 && sid <= 114)) sid = 1;
  var surahRange = QT.index.surahRange(sid);

  var ar = QT.fmt.ar;
  var ICONS = {
    play:  'M5 3l14 9-14 9z',
    pause: 'M7 4h3.2v16H7zM13.8 4H17v16h-3.2z',
    stop:  'M6 6h12v12H6z',
    close: 'M18 6L6 18M6 6l12 12'
  };
  function svg(d, filled) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"' +
      (filled ? ' fill="currentColor" stroke="none"' : '') + '/></svg>';
  }

  /* ---------------- shell ---------------- */

  var bar = document.createElement('div');
  bar.className = 'sessionbar';
  bar.setAttribute('data-paused', 'false');
  var pill = document.createElement('div');
  pill.className = 'sessionbar__pill';
  bar.appendChild(pill);
  document.body.appendChild(bar);

  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2600);
  }

  function btn(cls, label, html, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sessionbar__btn' + (cls ? ' ' + cls : '');
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = html;
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------------- which plan gets the credit ----------------
     One active plan is the common case. With several, the session belongs to
     the first whose scope contains where the reader actually is — attributing
     it to all of them would double-count, and to none would lose it. */
  function planFor(position) {
    var plans = QT.plans.list().filter(function (p) { return p.type === 'read'; });
    if (!plans.length) return null;
    for (var i = 0; i < plans.length; i++) {
      var st = QT.plans.status(plans[i]);
      if (!st.finished && position >= st.scopeFrom && position <= st.scopeTo) return plans[i];
    }
    return null;
  }

  /* ---------------- what is on screen ----------------
     Verse mode anchors every ayah on `.ayah[data-n]`. Muṣḥaf mode would mean
     observing every word — thousands of nodes — so pages are observed instead
     and widened to their ayah range, which is the right granularity anyway. */

  var io = null;

  function positionNow() {
    var live = QT.live.get();
    if (live) return live.to;
    var first = document.querySelector('.ayah[data-n]');
    if (first) return QT.index.toGlobal(sid, +first.dataset.n || 1);
    return surahRange[0];
  }

  function observeTargets() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      if (!QT.live.get()) return;
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        var n = entries[i].target;
        if (n.dataset.n) {
          QT.live.mark(QT.index.toGlobal(sid, +n.dataset.n));
        } else if (n.dataset.page) {
          var r = QT.index.pageRange(+n.dataset.page);
          /* clipped to this surah so a shared page does not claim its neighbour */
          QT.live.mark(Math.max(r[0], surahRange[0]));
          QT.live.mark(Math.min(r[1], surahRange[1]));
        }
      }
      paint();
    }, { rootMargin: '-25% 0px -25% 0px' });

    var verses = document.querySelectorAll('.ayah[data-n]');
    var targets = verses.length ? verses : document.querySelectorAll('.mushaf__page[data-page]');
    Array.prototype.forEach.call(targets, function (t) { io.observe(t); });
  }

  /* The reader rebuilds #main on every settings change, so targets are
     re-collected rather than bound once. */
  var main = document.getElementById('main');
  if (main) {
    var rescan = null;
    new MutationObserver(function () {
      clearTimeout(rescan);
      rescan = setTimeout(observeTargets, 120);
    }).observe(main, { childList: true });
  }

  /* ---------------- render ---------------- */

  var tick = null;

  function paint() {
    var live = QT.live.get();
    pill.innerHTML = '';

    if (!live) {
      bar.setAttribute('data-paused', 'false');
      pill.appendChild(btn('sessionbar__btn--go', 'ابدأ جلسة قراءة',
        svg(ICONS.play, true) + '<span>ابدأ جلسة</span>', start));
      stopTicking();
      return;
    }

    bar.setAttribute('data-paused', String(!!live.pausedAt));

    pill.appendChild(btn('sessionbar__btn--icon',
      live.pausedAt ? 'استئناف' : 'إيقاف مؤقّت',
      svg(live.pausedAt ? ICONS.play : ICONS.pause, true),
      function () {
        if (QT.live.get().pausedAt) QT.live.resume(); else QT.live.pause();
        paint();
      }));

    var read = document.createElement('div');
    read.className = 'sessionbar__read';
    var clock = document.createElement('div');
    clock.className = 'sessionbar__clock';
    clock.textContent = QT.fmt.clock(QT.live.elapsedMs());
    var range = document.createElement('div');
    range.className = 'sessionbar__range';
    range.textContent = QT.index.rangeLabel(live.from, live.to);
    read.appendChild(clock);
    read.appendChild(range);
    pill.appendChild(read);

    pill.appendChild(btn('sessionbar__btn--icon', 'إنهاء الجلسة وحفظها',
      svg(ICONS.stop, true), finish));

    startTicking();
  }

  function startTicking() {
    if (tick) return;
    tick = setInterval(function () {
      var live = QT.live.get();
      if (!live || live.pausedAt) return;
      var c = pill.querySelector('.sessionbar__clock');
      if (c) c.textContent = QT.fmt.clock(QT.live.elapsedMs());
    }, 1000);
  }
  function stopTicking() {
    if (tick) { clearInterval(tick); tick = null; }
  }

  /* ---------------- actions ---------------- */

  function start() {
    QT.live.start('read', positionNow());
    observeTargets();
    paint();
    toast('بدأت الجلسة');
  }

  function finish() {
    var live = QT.live.get();
    if (!live) return;
    var plan = planFor(live.from);
    var rec = QT.live.stop(plan ? plan.id : null);
    paint();
    if (!rec) { toast('الجلسة أقصر من أن تُحسب'); return; }
    toast('حُفظت: ' + QT.fmt.duration(rec.seconds) + ' · ' +
          ar(rec.to - rec.from + 1) + ' آية' + (plan ? ' · ' + plan.name : ''));
  }

  /* A hidden tab is not being read. Auto-pausing keeps the pace estimate
     honest without the reader having to think about it. */
  document.addEventListener('visibilitychange', function () {
    var live = QT.live.get();
    if (!live) return;
    if (document.hidden) {
      if (!live.pausedAt) { QT.live.pause(); bar.setAttribute('data-paused', 'true'); }
    } else if (live.pausedAt) {
      QT.live.resume();
      paint();
    }
  });

  /* Leaving mid-session is normal — the reader moves from one sūrah to the
     next. The live record is already in localStorage, so nothing is needed
     here beyond releasing the timer. */
  window.addEventListener('pagehide', stopTicking);

  observeTargets();
  paint();
})();
