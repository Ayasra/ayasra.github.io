/* =========================================================================
   Reading plans dashboard — drives plan.html.
   All state lives in tracker.js; this file only renders it and collects input.
   ========================================================================= */
(function () {
  'use strict';

  var QT = window.QuranTracker;
  if (!QT || !QT.init()) {
    document.getElementById('today-sec').innerHTML =
      '<div class="blank"><p>تعذّر تحميل بيانات الفهرس.</p></div>';
    return;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ar = QT.fmt.ar;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }
  var I = {
    play:  'M5 3l14 9-14 9z',
    check: 'M20 6L9 17l-5-5',
    edit:  'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
    info:  'M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20z',
    plus:  'M12 5v14M5 12h14'
  };

  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2400);
  }

  /* ---------------- date line ----------------
     The Hijri date matters more than the Gregorian one here, but Intl's
     islamic calendars are uneven across engines, so it is best-effort. */
  function drawDate() {
    var now = new Date();
    var parts = [];
    try {
      parts.push('<b>' + new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',
        { weekday: 'long', day: 'numeric', month: 'long' }).format(now) + '</b>');
    } catch (e) {
      parts.push('<b>' + QT.fmt.dayLabel(QT.date.today()) + '</b>');
    }
    try {
      parts.push('<span>' + new Intl.DateTimeFormat('ar-EG',
        { day: 'numeric', month: 'long', year: 'numeric' }).format(now) + '</span>');
    } catch (e) {}
    $('#datestrip').innerHTML = parts.join('');
  }

  /* ---------------- today ---------------- */

  function ring(pct) {
    var R = 22, C = 2 * Math.PI * R;
    var w = el('div', 'today__ring');
    w.innerHTML =
      '<svg viewBox="0 0 52 52" aria-hidden="true">' +
        '<circle class="trk" cx="26" cy="26" r="' + R + '"/>' +
        '<circle class="val" cx="26" cy="26" r="' + R + '" ' +
          'stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
      '</svg><b>' + ar(pct) + '٪</b>';
    return w;
  }

  function todayCard(plan) {
    var st = QT.plans.status(plan);
    var card = el('div', 'today');
    card.setAttribute('data-done', String(st.todayDone));

    var top = el('div', 'today__top');
    top.appendChild(ring(st.pct));

    var body = el('div', 'today__body');
    body.appendChild(el('p', 'today__name', plan.name + ' · ' + st.scopeLabel));

    if (st.finished) {
      body.appendChild(el('p', 'today__range', 'تمّت الخطة، والحمد لله'));
    } else if (plan.mode === 'steps') {
      /* A programme's portion is given, not computed, and it is measured in
         whole nights or days — so it is named rather than described as an
         amount of pages. */
      var unitAr = st.unit === 'night' ? 'ليلة' : 'يوم';
      body.appendChild(el('p', 'today__range', st.step ? st.step.title : ''));

      var m = el('div', 'today__meta');
      var parts = [
        '<span>' + unitAr + ' <i>' + ar(st.step ? st.step.n : 0) + '</i> من <i>' + ar(st.totalUnits) + '</i></span>',
        '<span>الورد <i>' + (st.step && st.step.span
          ? st.step.span
          : QT.index.rangeLabel(st.todayFrom, st.todayTo)) + '</i></span>'
      ];
      if (st.step && st.step.min) parts.push('<span>نحو <i>' + ar(st.step.min) + ' دقيقة</i></span>');
      if (st.step && st.step.themed) parts.push('<span><i>ليلة موضوعية</i></span>');
      m.innerHTML = parts.join('');
      body.appendChild(m);
    } else {
      body.appendChild(el('p', 'today__range',
        QT.index.rangeLabel(st.todayFrom, st.todayTo)));

      var meta = el('div', 'today__meta');
      var pages = QT.index.pageOf(st.todayTo) - QT.index.pageOf(st.todayFrom) + 1;
      meta.innerHTML =
        '<span>الصفحات <i>' + ar(QT.index.pageOf(st.todayFrom)) + '–' +
          ar(QT.index.pageOf(st.todayTo)) + '</i></span>' +
        '<span>المقدار <i>' + QT.fmt.units(plan.unit === 'page' ? pages : st.todayTo - st.todayFrom + 1, plan.unit) + '</i></span>';

      /* Time estimate uses the reader's own measured pace, not an average. */
      var mins = QT.stats.estimateMinutes(st.todayFrom, st.todayTo, plan.type);
      if (mins != null && mins >= 1) {
        meta.innerHTML += '<span>نحو <i>' + ar(Math.round(mins)) + ' دقيقة</i></span>';
      }
      if (st.leftUnits) {
        meta.innerHTML += '<span>يتبقّى <i>' + QT.fmt.units(st.leftUnits, plan.unit) + '</i></span>';
      }
      body.appendChild(meta);
    }

    top.appendChild(body);
    card.appendChild(top);

    if (!st.finished) {
      var acts = el('div', 'today__actions');

      var go = el('a', 'btn btn--go');
      go.href = QT.index.href(st.todayDone ? st.nextFrom : st.todayFrom);
      go.innerHTML = icon(I.play) + '<span>' + (st.todayDone ? 'تابع القراءة' : 'اقرأ الآن') + '</span>';
      acts.appendChild(go);

      if (!st.todayDone) {
        var done = el('button', 'btn');
        done.type = 'button';
        done.innerHTML = icon(I.check) + '<span>قرأته</span>';
        done.addEventListener('click', function () {
          QT.plans.markTodayDone(plan);
          toast('سُجّل نصيب اليوم');
          drawAll();
        });
        acts.appendChild(done);
      }
      card.appendChild(acts);

      /* Programmes carry their own explanation on their page; repeating a
         schedule lecture on the dashboard would be noise. */
      if (plan.mode === 'steps') {
        var open = el('a', 'btn btn--quiet');
        open.href = plan.program === 'qiyam40' ? 'qiyam-40.html' : 'khatm-7.html';
        open.textContent = 'صفحة البرنامج';
        acts.appendChild(open);
        return card;
      }

      /* Being behind is stated once, plainly, with what it costs — never as a
         scolding, and never as a pile-up: the portion itself does not grow. */
      if (st.debtUnits > 0) {
        var b = el('div', 'behind');
        b.innerHTML = icon(I.info) +
          '<span>أنت متأخّر بـ <b>' + QT.fmt.units(st.debtUnits, plan.unit) + '</b> عن جدول الخطة. ' +
          'النصيب اليومي لم يتغيّر — إنما يتأخّر موعد الختم' +
          (st.projectedEnd ? ' إلى <b>' + QT.fmt.dayLabel(st.projectedEnd) + '</b>' : '') + '.</span>';
        card.appendChild(b);
      } else if (st.plan.mode === 'byDate' && st.daysLeft != null) {
        var d = el('div', 'behind');
        d.innerHTML = icon(I.info) +
          '<span>يتبقّى <b>' + ar(st.daysLeft) + ' يوماً</b> على الموعد، ' +
          'فالنصيب <b>' + QT.fmt.units(st.perDay, plan.unit) + '</b> كل يوم.</span>';
        card.appendChild(d);
      }
    }

    return card;
  }

  function drawToday() {
    var sec = $('#today-sec');
    sec.innerHTML = '';
    var plans = QT.plans.list();

    if (!plans.length) {
      var blank = el('div', 'blank');
      blank.innerHTML =
        '<p>لا خطة بعد. ابدأ بواحدة من هذه، أو أنشئ خطة على مقاسك.</p>';
      var q = el('div', 'quick');
      [
        ['ختمة في ٣٠ يوماً', function () { quickPlan('ختمة في شهر', 'page', 21); }],
        ['صفحتان يومياً',    function () { quickPlan('ورد يومي', 'page', 2); }],
        ['جزء كل يوم',       function () { quickPlan('جزء يومياً', 'page', 20); }],
        ['خطة أخرى…',        function () { openModal(null); }]
      ].forEach(function (p) {
        var b = el('button', 'btn' + (p[0] === 'خطة أخرى…' ? ' btn--quiet' : ''), p[0]);
        b.type = 'button';
        b.addEventListener('click', p[1]);
        q.appendChild(b);
      });
      blank.appendChild(q);
      sec.appendChild(blank);
      return;
    }

    plans.forEach(function (p) { sec.appendChild(todayCard(p)); });
  }

  function quickPlan(name, unit, amount) {
    QT.plans.create({ name: name, unit: unit, mode: 'perDay', amount: amount, scope: { kind: 'all' } });
    toast('أُنشئت الخطة');
    drawAll();
  }

  /* ---------------- streak ---------------- */

  var HEAT_DAYS = 119;   /* 17 weeks — fits a phone without scrolling */

  function drawStreak() {
    var cells = QT.stats.heatmap(HEAT_DAYS, null);
    var any = cells.some(function (c) { return c.data; });
    $('#streak-sec').hidden = !any;
    if (!any) return;

    var cur = QT.stats.streak(null), best = QT.stats.longestStreak(null);
    $('#streak').innerHTML =
      '<span><b class="streak__n">' + ar(cur) + '</b><span class="streak__lbl">يوماً متتالياً</span></span>' +
      '<span><b class="streak__n">' + ar(best) + '</b><span class="streak__lbl">أطول تتابع</span></span>';
    $('#heat-range').textContent = QT.fmt.dayLabel(cells[0].day) + ' — اليوم';

    /* Levels are relative to the reader's own busiest day, so a light routine
       still lights up rather than staying permanently pale. */
    var peak = 0;
    cells.forEach(function (c) { if (c.data && c.data.ayahs > peak) peak = c.data.ayahs; });

    var heat = $('#heat');
    heat.innerHTML = '';
    /* Start on a week boundary so the seven rows read as weekdays. */
    var lead = new Date(cells[0].day.split('-')[0], +cells[0].day.split('-')[1] - 1,
                        +cells[0].day.split('-')[2]).getDay();
    for (var i = 0; i < lead; i++) {
      var pad = el('i');
      pad.style.visibility = 'hidden';
      heat.appendChild(pad);
    }
    cells.forEach(function (c) {
      var n = el('i');
      var lvl = 0;
      if (c.data && peak) lvl = Math.max(1, Math.ceil(c.data.ayahs / peak * 4));
      n.setAttribute('data-l', String(lvl));
      n.title = QT.fmt.dayLabel(c.day) +
        (c.data ? ' · ' + ar(c.data.ayahs) + ' آية · ' + QT.fmt.duration(c.data.seconds) : ' · لا شيء');
      heat.appendChild(n);
    });
  }

  /* ---------------- plans list ---------------- */

  function drawPlans() {
    var plans = QT.plans.list();
    $('#plans-sec').hidden = !plans.length;
    var box = $('#plans');
    box.innerHTML = '';

    plans.forEach(function (p) {
      var st = QT.plans.status(p);
      var row = el('div', 'plan');
      row.setAttribute('data-finished', String(st.finished));

      var top = el('div', 'plan__top');
      var left = el('div');
      left.appendChild(el('p', 'plan__name', p.name));
      left.appendChild(el('p', 'plan__scope', st.scopeLabel));
      top.appendChild(left);
      top.appendChild(el('span', 'plan__pct', ar(st.pct) + '٪'));
      row.appendChild(top);

      var track = el('div', 'plan__track');
      var bar = el('div', 'plan__bar');
      bar.style.width = st.pct + '%';
      track.appendChild(bar);
      row.appendChild(track);

      var meta = el('div', 'plan__meta');
      if (p.mode === 'steps') {
        var ua = st.unit === 'night' ? 'ليلة' : 'يوماً';
        meta.innerHTML =
          '<span><i>' + ar(st.doneUnits) + '</i> من ' + ar(st.totalUnits) + ' ' + ua + '</span>' +
          (st.finished ? '<span>تمّت</span>' : '<span>التالي <i>' + (st.step ? st.step.title : '') + '</i></span>');
        row.appendChild(meta);
        var tools0 = el('div', 'plan__tools');
        var page0 = el('a', 'btn btn--sm btn--quiet');
        page0.href = p.program === 'qiyam40' ? 'qiyam-40.html' : 'khatm-7.html';
        page0.textContent = 'صفحة البرنامج';
        tools0.appendChild(page0);
        var del0 = el('button', 'btn btn--sm btn--danger');
        del0.type = 'button';
        del0.textContent = 'أوقف';
        del0.addEventListener('click', function () {
          if (!confirm('إيقاف متابعة «' + p.name + '»؟ الجلسات المسجّلة تبقى كما هي.')) return;
          QT.plans.remove(p.id);
          toast('أُوقفت المتابعة');
          drawAll();
        });
        tools0.appendChild(del0);
        row.appendChild(tools0);
        box.appendChild(row);
        return;
      }
      meta.innerHTML =
        '<span><i>' + QT.fmt.units(st.doneUnits, p.unit) + '</i> من ' + QT.fmt.units(st.totalUnits, p.unit) + '</span>' +
        (p.mode === 'byDate' && p.endDate
          ? '<span>الموعد <i>' + QT.fmt.dayLabel(p.endDate) + '</i></span>'
          : '<span>النصيب <i>' + QT.fmt.units(p.amount, p.unit) + '/يوم</i></span>') +
        (st.finished ? '<span>تمّت</span>'
                     : (st.projectedEnd ? '<span>الختم المتوقّع <i>' + QT.fmt.dayLabel(st.projectedEnd) + '</i></span>' : ''));
      row.appendChild(meta);

      var tools = el('div', 'plan__tools');

      var edit = el('button', 'btn btn--sm btn--quiet');
      edit.type = 'button';
      edit.innerHTML = icon(I.edit) + '<span>تعديل</span>';
      edit.addEventListener('click', function () { openModal(p); });
      tools.appendChild(edit);

      var del = el('button', 'btn btn--sm btn--danger');
      del.type = 'button';
      del.innerHTML = icon(I.trash) + '<span>حذف</span>';
      del.addEventListener('click', function () {
        if (!confirm('حذف خطة «' + p.name + '»؟ الجلسات المسجّلة تبقى كما هي.')) return;
        QT.plans.remove(p.id);
        toast('حُذفت الخطة');
        drawAll();
      });
      tools.appendChild(del);

      row.appendChild(tools);
      box.appendChild(row);
    });
  }

  /* ---------------- stats ---------------- */

  function drawStats() {
    var t = QT.stats.totals(null);
    $('#stats-sec').hidden = !t.sessions;
    if (!t.sessions) return;

    var hours = t.seconds / 3600;
    $('#stats').innerHTML = [
      '<b>' + ar(t.sessions) + '</b><small>جلسة</small>',
      '<b>' + (hours >= 1 ? ar(hours.toFixed(1)) + ' س'
                          : ar(Math.round(t.seconds / 60)) + ' د') + '</b><small>وقت القراءة</small>',
      '<b>' + ar(t.pctOfQuran) + '٪</b><small>من المصحف</small>',
      /* how many pages the covered ayahs add up to, not where the cursor is */
      '<b>' + ar(QT.index.pageOf(Math.max(1, t.ayahsCovered))) + '</b><small>ما يعادل صفحة</small>'
    ].map(function (s) { return '<div class="stat">' + s + '</div>'; }).join('');

    var pace = QT.stats.pace(null);
    $('#pace-note').textContent = pace
      ? 'سرعتك المقيسة نحو ' + ar(pace.ayahsPerMin.toFixed(1)) + ' آية في الدقيقة، ' +
        'محسوبة من آخر ' + ar(pace.samples) + ' جلسة موقوتة — وعليها تُقدَّر أوقات النصيب.'
      : 'بعد ثلاث جلسات موقوتة تُحسب سرعتك، وتُقدَّر بها مدة كل نصيب.';
  }

  /* ---------------- backup ---------------- */

  function drawStorage() {
    var b = QT.io.bytes();
    var kb = b / 1024;
    $('#storage-size').textContent = kb < 1024
      ? ar(Math.round(kb)) + ' ك.ب'
      : ar((kb / 1024).toFixed(1)) + ' م.ب';

    /* localStorage caps near 5MB and throws without warning, so say something
       while there is still room to act. */
    var q = $('#quota');
    q.innerHTML = kb > 3072
      ? '<div class="warnbar">' + icon(I.info) +
        '<span>البيانات تقترب من حدّ المتصفح. صدّر نسخة، ثم احذف الجلسات القديمة.</span></div>'
      : '';
  }

  $('#export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(QT.io.export(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = QT.io.filename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('صُدّرت نسخة');
  });

  $('#import-btn').addEventListener('click', function () { $('#import-file').click(); });
  $('#import-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var obj = JSON.parse(fr.result);
        var merge = confirm(
          'دمج مع البيانات الحالية؟\n\n' +
          'موافق = دمج (يُبقي ما عندك ويضيف الجديد)\n' +
          'إلغاء = استبدال كامل');
        QT.io.import(obj, merge ? 'merge' : 'replace');
        toast('تمّ الاستيراد');
        drawAll();
      } catch (err) {
        alert('تعذّر قراءة الملف: ' + (err.message || err));
      }
      e.target.value = '';
    };
    fr.readAsText(f);
  });

  $('#wipe').addEventListener('click', function () {
    if (!confirm('مسح كل الخطط والجلسات؟ لا يمكن التراجع.')) return;
    if (!confirm('تأكيد أخير — هل صدّرت نسخة؟')) return;
    QT.io.clear();
    toast('مُسحت البيانات');
    drawAll();
  });

  /* ---------------- plan dialog ---------------- */

  var modal = $('#modal'), editing = null;

  function fillScopeArg() {
    var kind = $('#f-scope').value;
    var argSel = $('#f-scope-arg');
    argSel.innerHTML = '';
    if (kind === 'all') { argSel.hidden = true; return; }
    argSel.hidden = false;
    if (kind === 'juz') {
      for (var j = 1; j <= 30; j++) {
        argSel.appendChild(new Option('الجزء ' + ar(j), String(j)));
      }
    } else {
      (window.QURAN_SURAHS || []).forEach(function (s) {
        argSel.appendChild(new Option(ar(s.id) + ' · ' + s.nameAr, String(s.id)));
      });
    }
  }

  function currentMode() {
    return $('.seg button[aria-pressed="true"]').dataset.mode;
  }

  function paintMode() {
    var mode = currentMode();
    $('#f-amount-field').hidden = mode !== 'perDay';
    $('#f-date-field').hidden = mode !== 'byDate';
    $('#mode-hint').textContent = mode === 'perDay'
      ? 'تقرأ قدراً ثابتاً كل يوم. إن فاتك يوم، تأخّر موعد الختم ولم يزد نصيبك.'
      : 'تنتهي في تاريخ محدّد. إن فاتك يوم، وُزّع الباقي على ما تبقّى من أيام.';
    if (mode === 'byDate') {
      var end = $('#f-end').value;
      $('#date-hint').textContent = end
        ? 'يتبقّى ' + ar(Math.max(1, QT.date.daysBetween(QT.date.today(), end) + 1)) + ' يوماً.'
        : '';
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      paintMode();
    });
  });
  $('#f-scope').addEventListener('change', fillScopeArg);
  $('#f-end').addEventListener('change', paintMode);

  function openModal(plan) {
    editing = plan;
    $('#modal-title').textContent = plan ? 'تعديل الخطة' : 'خطة جديدة';
    $('#f-name').value = plan ? plan.name : '';
    $('#f-name').placeholder = 'ختمة';

    var kind = plan && plan.scope ? plan.scope.kind : 'all';
    $('#f-scope').value = kind;
    fillScopeArg();
    if (plan && kind === 'juz') $('#f-scope-arg').value = String(plan.scope.juz);
    if (plan && kind === 'surah') $('#f-scope-arg').value = String(plan.scope.surah);

    var mode = plan ? plan.mode : 'perDay';
    Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.mode === mode));
    });
    $('#f-amount').value = plan ? plan.amount : 4;
    $('#f-unit').value = plan ? plan.unit : 'page';
    $('#f-end').value = plan && plan.endDate ? plan.endDate : QT.date.addDays(QT.date.today(), 29);
    paintMode();

    modal.setAttribute('data-open', 'true');
    setTimeout(function () { $('#f-name').focus(); }, 40);
  }

  function closeModal() {
    modal.setAttribute('data-open', 'false');
    editing = null;
  }

  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-scrim').addEventListener('click', closeModal);
  $('#f-cancel').addEventListener('click', closeModal);
  $('#add-plan').addEventListener('click', function () { openModal(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.getAttribute('data-open') === 'true') closeModal();
  });

  $('#plan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var mode = currentMode();
    var kind = $('#f-scope').value;
    var scope = { kind: kind };
    if (kind === 'juz') scope.juz = parseInt($('#f-scope-arg').value, 10) || 1;
    if (kind === 'surah') scope.surah = parseInt($('#f-scope-arg').value, 10) || 1;

    var spec = {
      name: ($('#f-name').value || '').trim() || 'خطة قراءة',
      scope: scope,
      mode: mode,
      unit: $('#f-unit').value,
      amount: Math.max(1, parseInt($('#f-amount').value, 10) || 1),
      endDate: mode === 'byDate' ? $('#f-end').value : null
    };

    if (mode === 'byDate') {
      if (!spec.endDate) { alert('اختر تاريخ الانتهاء.'); return; }
      if (QT.date.daysBetween(QT.date.today(), spec.endDate) < 0) {
        alert('التاريخ في الماضي.'); return;
      }
      /* byDate derives the portion itself; amount is only the seed shown until
         the first status() runs. */
      spec.unit = 'page';
    }

    if (editing) QT.plans.update(editing.id, spec);
    else QT.plans.create(spec);

    closeModal();
    toast(editing ? 'حُدّثت الخطة' : 'أُنشئت الخطة');
    drawAll();
  });

  /* ---------------- theme toggle (same cycle as the reader) ---------------- */

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
    drawToday();
    drawStreak();
    drawPlans();
    drawStats();
    drawStorage();
    var n = QT.plans.list().length;
    $('#crumb').textContent = n ? ar(n) + (n === 1 ? ' خطة' : ' خطط') : '';
  }

  drawDate();
  paintThemeIcon();
  drawAll();

  /* A session finished in the reader should be visible on returning here,
     including from the bfcache where no reload event fires. */
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
