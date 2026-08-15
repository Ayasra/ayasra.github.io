/* =========================================================================
   Programme pages — drives qiyam-40.html and khatm-7.html from one file.

   The page declares which programme it is via <body data-program="...">.
   Everything else — the steps, their portions, the tick state — comes from
   assets/data/programs.js and the tracker, so the two pages carry no data of
   their own and cannot drift from what the dashboard shows.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  var KEY = document.body.dataset.program;
  var PROG = (window.QURAN_PROGRAMS || {})[KEY];

  if (!QT || !QT.init() || !PROG) {
    var s = document.getElementById('steps');
    if (s) s.innerHTML = '<p class="note">تعذّر تحميل بيانات البرنامج.</p>';
    return;
  }

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
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2400);
  }

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  /* The plan exists only once the reader has started the programme. Until
     then the page is readable but nothing is tracked — browsing a programme
     should not silently enrol you in it. */
  function currentPlan() {
    return QT.plans.list().filter(function (p) { return p.program === KEY; })[0] || null;
  }

  var filter = 'all';

  /* ---------------- one step ---------------- */

  function stepCard(step, i, plan, covered) {
    var isNight = PROG.unit === 'night';
    var done = plan ? QT.plans.stepComplete(step, covered) : false;

    var card = el('article', 'step');
    card.id = (isNight ? 'n' : 'd') + step.n;
    card.setAttribute('data-done', String(done));
    if (step.themed) card.setAttribute('data-themed', 'true');

    /* head */
    var head = el('div', 'step__head');

    if (plan) {
      var tick = el('button', 'step__tick');
      tick.type = 'button';
      tick.setAttribute('aria-pressed', String(done));
      tick.setAttribute('aria-label', done ? 'إلغاء التسجيل' : 'سجّل أنّك أتممته');
      tick.innerHTML = CHECK;
      tick.addEventListener('click', function () {
        if (QT.plans.stepComplete(step, QT.sessions.coverage('read', plan.id))) {
          QT.plans.clearStep(plan, i);
          toast('أُلغي التسجيل');
        } else {
          QT.plans.completeStep(plan, i);
          toast(isNight ? 'سُجّلت الليلة' : 'سُجّل اليوم');
        }
        draw();
      });
      head.appendChild(tick);
    }

    head.appendChild(el('div', 'step__num',
      step.letter ? step.letter : (step.n < 10 ? '٠' + ar(step.n) : ar(step.n))));

    if (step.themed) head.appendChild(el('span', 'step__badge', 'ليلة موضوعية'));

    var stats = el('div', 'step__stats');
    var bits = [];
    if (step.ayat) bits.push('<span><b>' + ar(step.ayat) + '</b> آية</span>');
    if (step.pages) bits.push('<span><b>' + ar(step.pages) + '</b> صفحة</span>');
    if (step.min) bits.push('<span>نحو <b>' + ar(step.min) + '</b> دقيقة</span>');
    if (step.juz) bits.push('<span class="juz">الجزء ' + ar(step.juz) + '</span>');
    stats.innerHTML = bits.join('');
    head.appendChild(stats);
    card.appendChild(head);

    /* body */
    card.appendChild(el('h3', 'step__title', step.title));
    if (step.sub) card.appendChild(el('p', 'step__sub', step.sub));

    var portion = el('div', 'step__portion');
    portion.innerHTML = '<span class="lab">الورد</span>' +
      (step.span || QT.index.rangeLabel(step.r[0][0], step.r[step.r.length - 1][1]));
    card.appendChild(portion);

    /* rak'ah (nights) or sittings (days) */
    var units = step.rakaat || step.sittings || [];
    if (units.length) {
      var box = el('div', 'units');
      units.forEach(function (u, k) {
        var row = el('div', 'unit' + (step.themed && k === units.length - 1 ? ' unit--themed' : ''));
        row.appendChild(el('div', 'unit__n', isNight ? ar(k + 1) : ar(k + 1)));

        var body = el('div', 'unit__body');
        body.textContent = u.ar;
        if (u.when) body.appendChild(el('span', 'unit__when', u.name + ' · ' + u.when));
        row.appendChild(body);

        var meta = el('div', 'unit__meta');
        meta.innerHTML = (u.min ? '<b>نحو ' + ar(u.min) + ' د</b>' : '') +
                         (u.ayat ? ar(u.ayat) + ' آية' : '');
        row.appendChild(meta);
        box.appendChild(row);
      });
      card.appendChild(box);
    }

    /* the pulled surah, and the closer with the reason it was chosen */
    if (step.pull) {
      var pl = el('div', 'aside');
      pl.innerHTML = '<b>يُقدَّم إلى الركعة الرابعة:</b> ' + step.pull;
      card.appendChild(pl);
    }
    if (step.closer) {
      var cl = el('div', 'aside');
      cl.innerHTML = '<b>الخاتمة (زيادة، من الحفظ):</b> ' + step.closer +
        (step.closerWhy ? '<span class="aside__why">' + step.closerWhy + '</span>' : '');
      card.appendChild(cl);
    }

    /* key passages */
    if (step.keys && step.keys.length) {
      var keys = el('div', 'keys');
      keys.appendChild(el('div', 'keys__lab', 'ترسَّلْ هنا'));
      step.keys.forEach(function (k) {
        var kb = el('div', 'key');
        kb.innerHTML = '<span class="key__ref">' + k.ref + '</span>' +
                       '<div class="key__note">' + k.note + '</div>';
        keys.appendChild(kb);
      });
      card.appendChild(keys);
    }

    /* open the reader at the start of this portion */
    var acts = el('div', 'step__actions');
    var go = el('a', 'btn btn--sm');
    go.href = QT.index.href(step.r[0][0]);
    go.textContent = 'افتح في المصحف';
    acts.appendChild(go);
    card.appendChild(acts);

    return card;
  }

  /* ---------------- page ---------------- */

  function draw() {
    var plan = currentPlan();
    var covered = plan ? QT.sessions.coverage('read', plan.id) : [];
    var st = plan ? QT.plans.status(plan) : null;

    /* the sticky strip */
    var bar = $('#progbar');
    if (plan && st) {
      bar.hidden = false;
      $('#prog-state').innerHTML = st.finished
        ? 'تمّت الختمة، والحمد لله'
        : '<b>' + ar(st.doneUnits) + '</b> من <b>' + ar(st.totalUnits) + '</b> ' +
          (PROG.unit === 'night' ? 'ليلة' : 'يوماً') +
          (st.step ? ' · التالي: ' + st.step.title : '');
      $('#prog-bar').style.width = st.pct + '%';
      $('#prog-start').hidden = true;
      $('#prog-stop').hidden = false;
    } else {
      bar.hidden = false;
      $('#prog-state').textContent = 'برنامج للقراءة — ابدأه لتُتابَع خطواتك';
      $('#prog-bar').style.width = '0%';
      $('#prog-start').hidden = false;
      $('#prog-stop').hidden = true;
    }

    /* the steps */
    var box = $('#steps');
    box.innerHTML = '';
    var shown = 0;
    PROG.steps.forEach(function (step, i) {
      if (plan && filter !== 'all') {
        var done = QT.plans.stepComplete(step, covered);
        if (filter === 'todo' && done) return;
        if (filter === 'done' && !done) return;
      }
      box.appendChild(stepCard(step, i, plan, covered));
      shown++;
    });
    if (!shown) box.appendChild(el('p', 'note', 'لا شيء في هذا التصنيف.'));

    $('#filters').hidden = !plan;
  }

  $('#prog-start').addEventListener('click', function () {
    QT.plans.startProgram(KEY);
    toast('بدأ البرنامج — ستجده في خطط القراءة');
    draw();
  });

  $('#prog-stop').addEventListener('click', function () {
    var plan = currentPlan();
    if (!plan) return;
    if (!confirm('إيقاف متابعة هذا البرنامج؟ الجلسات المسجّلة تبقى كما هي.')) return;
    QT.plans.remove(plan.id);
    toast('أُوقفت المتابعة');
    draw();
  });

  Array.prototype.forEach.call(document.querySelectorAll('#filters button'), function (b) {
    b.addEventListener('click', function () {
      filter = b.dataset.f;
      Array.prototype.forEach.call(document.querySelectorAll('#filters button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      draw();
    });
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

  paintThemeIcon();
  draw();

  window.addEventListener('pageshow', function (e) { if (e.persisted) draw(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) draw(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    });
  }
})();
