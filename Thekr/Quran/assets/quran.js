/* =========================================================================
   Qur'an reader engine — drives surah.html for every sūrah via ?s=NN
   Data: assets/data/surahs.json, assets/data/NNN.json,
         assets/data/tafsir/NNN.json (lazy), assets/intros.js (optional)
   ========================================================================= */
(function () {
  'use strict';

  var SET_KEY = 'quran.settings.v1';
  var BM_KEY = 'quran.bookmarks.v1';
  var LAST_KEY = 'quran.last.v1';
  var THEKR_SET = 'thekr.settings.v1';
  var SIZES = [1.35, 1.55, 1.75, 2.0, 2.35];

  var RECITERS = [
    { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
    { id: 'Husary_128kbps', name: 'محمود خليل الحصري' },
    { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' },
    { id: 'Abdul_Basit_Murattal_192kbps', name: 'عبد الباسط عبد الصمد' },
    { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبد الرحمن السديس' }
  ];
  var AUDIO_BASE = 'https://everyayah.com/data/';

  /* ---------------- storage ---------------- */
  function read(k, d) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = Object.assign({
    size: 2, translation: true, translit: false, mode: 'mushaf',
    tafsir: 'muyassar', reciter: 'Alafasy_128kbps', autoscroll: true
  }, read(SET_KEY, {}));

  var bookmarks = read(BM_KEY, {});

  /* ---------------- helpers ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  function ar(n) { return String(n).split('').map(function (c) { return AR_DIGITS[+c] != null ? AR_DIGITS[+c] : c; }).join(''); }
  function pad3(n) { return String(n).padStart(3, '0'); }

  var ICON = {
    play: '<polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    next: '<path d="M5 4l10 8-10 8z" fill="currentColor" stroke="none"/><rect x="17" y="4" width="2.4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    prev: '<path d="M19 4L9 12l10 8z" fill="currentColor" stroke="none"/><rect x="4.6" y="4" width="2.4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22z"/><path d="M4 17.5A2.5 2.5 0 016.5 15H20"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    arrow: '<path d="M19 12H5m7-7l-7 7 7 7"/>'
  };
  function svg(p, extra) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (extra || '') + '>' + p + '</svg>';
  }

  /* ---------------- DOM ---------------- */
  var elMain = $('#main'), elState = $('#state'), elSettings = $('#settings'),
      elGear = $('#gear'), elTitle = $('#page-title'), elCrumb = $('#crumb'),
      elPlayer = $('#player'), elPlayLabel = $('#player-label'), elPlayBtn = $('#p-play');

  var surah = null, meta = null, tafsirData = null, audio = new Audio();
  var playing = null;   /* verse number currently playing */
  var sid = 1;

  function applySize() { document.documentElement.style.setProperty('--ayah-size', SIZES[S.size] + 'rem'); }
  function applyMode() { document.documentElement.setAttribute('data-mode', S.mode); }

  /* Forced two-page mode.
     The size that fits a column is a function of the column width, not of the
     reader's chosen size — roughly 18em of measure per line reads well in
     naskh. Compute that, cap it at the reader's size, and if the result would
     fall below the legibility floor, stack the pages instead. */
  var MIN_PAGE_SIZE = 1.05;   /* rem — below this the spread gives up */
  var EM_PER_LINE = 18;       /* target measure per line */

  function fitSpread() {
    var root = document.documentElement;
    if (S.mode !== 'spread') {
      root.removeAttribute('data-spread-stacked');
      root.style.removeProperty('--page-size');
      return;
    }
    root.removeAttribute('data-spread-stacked');
    root.style.removeProperty('--page-size');

    var spread = document.querySelector('.mushaf__spread[data-pair="true"]');
    if (!spread) return;

    var frame = spread.querySelector('.mushaf__frame');
    var colPx = frame ? frame.getBoundingClientRect().width
                      : spread.getBoundingClientRect().width / 2;
    var rootPx = parseFloat(getComputedStyle(root).fontSize) || 16;
    var fitRem = (colPx / EM_PER_LINE) / rootPx;
    var size = Math.min(SIZES[S.size], fitRem);

    if (size < MIN_PAGE_SIZE) {
      root.setAttribute('data-spread-stacked', 'true');
      root.style.removeProperty('--page-size');
      return;
    }
    root.style.setProperty('--page-size', size.toFixed(3) + 'rem');
  }

  /* Measuring straight after appending can read a stale layout box, and the
     Qur'anic webfont changes metrics once it lands — so fit after layout has
     settled and again when the font is ready. */
  function scheduleFit() {
    requestAnimationFrame(function () { requestAnimationFrame(fitSpread); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitSpread).catch(function () {});
    }
  }

  var fitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitSpread, 120);
  });
  window.addEventListener('orientationchange', scheduleFit);
  function applyTheme() {
    var t = read(THEKR_SET, {}).theme;
    var h = new Date().getHours();
    var theme = (!t || t === 'auto') ? ((h >= 5 && h < 18) ? 'day' : 'night') : t;
    document.documentElement.setAttribute('data-theme', theme);
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'night' ? '#0B1119' : '#FAF6EF');
  }

  /* ---------------- data ---------------- */
  function json(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' → ' + r.status);
      return r.json();
    });
  }

  function boot() {
    var q = new URLSearchParams(location.search);
    sid = parseInt(q.get('s'), 10);
    if (!(sid >= 1 && sid <= 114)) sid = 1;
    var jump = parseInt(q.get('a'), 10) || 0;

    applyTheme(); applySize(); applyMode();

    Promise.all([json('assets/data/surahs.json'), json('assets/data/' + pad3(sid) + '.json')])
      .then(function (r) {
        meta = r[0]; surah = r[1];
        render();
        buildSettings();
        if (jump) {
          var el = document.getElementById('a' + jump);
          if (el) setTimeout(function () { el.scrollIntoView({ block: 'center' }); }, 60);
        }
        write(LAST_KEY, { surah: sid, ayah: jump || 1, at: Date.now() });
      })
      .catch(function (e) {
        elState.innerHTML = '<p>تعذّر تحميل السورة.</p><p style="font-size:.8rem;opacity:.7">' +
          String(e.message || e) + '</p>';
        elState.hidden = false;
      });
  }

  /* ---------------- render ---------------- */
  function render() {
    document.title = 'سورة ' + surah.nameAr + ' — ' + surah.nameEn;
    elTitle.textContent = 'سورة ' + surah.nameAr;
    elCrumb.textContent = surah.nameEn;
    elState.hidden = true;
    elMain.innerHTML = '';

    elMain.appendChild(header());
    if (surah.bismillah) {
      var b = document.createElement('p');
      b.className = 'bismillah';
      b.textContent = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
      elMain.appendChild(b);
    }
    applyMode();
    elMain.appendChild(S.mode === 'verse' ? verseList() : mushaf());
    elMain.appendChild(surahNav());
    scheduleFit();
  }

  function fact(label, value, kind) {
    var li = document.createElement('li');
    if (kind) li.dataset.kind = kind;
    li.innerHTML = '<span>' + label + '</span> <b>' + value + '</b>';
    return li;
  }

  function header() {
    var box = document.createElement('section');
    box.className = 'surah-head';

    var h = document.createElement('h1');
    h.className = 'surah-head__name';
    h.textContent = 'سورة ' + surah.nameAr;
    box.appendChild(h);

    var en = document.createElement('p');
    en.className = 'surah-head__en';
    en.textContent = 'Sūrah ' + surah.nameTr;
    box.appendChild(en);

    var mn = document.createElement('p');
    mn.className = 'surah-head__meaning';
    mn.dir = 'ltr';
    mn.textContent = '“' + surah.meaning + '”';
    box.appendChild(mn);

    var ul = document.createElement('ul');
    ul.className = 'facts';
    ul.appendChild(fact('', surah.place === 'makkah' ? 'مكّية' : 'مدنيّة', 'place'));
    ul.appendChild(fact('الآيات', ar(surah.versesCount)));
    ul.appendChild(fact('ترتيب النزول', ar(surah.order)));
    var juzs = surah.verses.map(function (v) { return v.juz; }).filter(Boolean);
    if (juzs.length) {
      var lo = Math.min.apply(null, juzs), hi = Math.max.apply(null, juzs);
      ul.appendChild(fact('الجزء', lo === hi ? ar(lo) : ar(lo) + '–' + ar(hi)));
    }
    if (surah.pages && surah.pages.length === 2) {
      ul.appendChild(fact('الصفحات', ar(surah.pages[0]) + '–' + ar(surah.pages[1])));
    }
    box.appendChild(ul);

    var intro = (window.SURAH_INTROS || {})[surah.id];
    if (intro) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'intro-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span>عن السورة</span>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      box.appendChild(toggle);

      var d = document.createElement('div');
      d.className = 'intro';
      d.hidden = true;
      toggle.addEventListener('click', function () {
        d.hidden = !d.hidden;
        toggle.setAttribute('aria-expanded', String(!d.hidden));
      });
      if (intro.summary) {
        intro.summary.split('\n\n').forEach(function (para) {
          var p = document.createElement('p'); p.textContent = para; d.appendChild(p);
        });
      }
      if (intro.themes && intro.themes.length) {
        var h3 = document.createElement('h3'); h3.textContent = 'المحاور'; d.appendChild(h3);
        var ol = document.createElement('div');
        intro.themes.forEach(function (t) {
          var p = document.createElement('p'); p.textContent = '• ' + t; ol.appendChild(p);
        });
        d.appendChild(ol);
      }
      if (intro.virtue) {
        var h3b = document.createElement('h3'); h3b.textContent = 'من فضلها'; d.appendChild(h3b);
        var pv = document.createElement('p'); pv.textContent = intro.virtue; d.appendChild(pv);
      }
      box.appendChild(d);
    }
    return box;
  }

  function isBookmarked(n) {
    var a = bookmarks[sid] || [];
    return a.indexOf(n) !== -1;
  }

  function vbtn(cls, icon, label, text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'vbtn' + (text ? '' : ' vbtn--icon') + (cls ? ' ' + cls : '');
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = svg(icon) + (text ? '<span>' + text + '</span>' : '');
    return b;
  }

  function verseList() {
    var ul = document.createElement('ul');
    ul.className = 'verses';
    surah.verses.forEach(function (v) { ul.appendChild(verseCard(v)); });
    return ul;
  }

  function verseCard(v) {
    var li = document.createElement('li');
    li.className = 'ayah';
    li.id = 'a' + v.n;
    li.dataset.n = v.n;
    if (isBookmarked(v.n)) li.classList.add('is-bookmarked');

    var p = document.createElement('p');
    p.className = 'ayah__ar';
    p.appendChild(document.createTextNode(v.ar + '\u00A0'));
    var num = document.createElement('span');
    num.className = 'ayah__num';
    num.textContent = '﴿' + ar(v.n) + '﴾';
    p.appendChild(num);
    li.appendChild(p);

    if (v.tr) {
      var tr = document.createElement('p');
      tr.className = 'ayah__tr'; tr.dataset.role = 'translit';
      tr.hidden = !S.translit; tr.lang = 'ar-Latn';
      tr.textContent = v.tr;
      li.appendChild(tr);
    }
    if (v.en) {
      var en = document.createElement('p');
      en.className = 'ayah__en'; en.dataset.role = 'translation';
      en.hidden = !S.translation; en.lang = 'en';
      en.textContent = v.en;
      li.appendChild(en);
    }

    /* toolbar */
    var bar = document.createElement('div');
    bar.className = 'ayah__bar';

    var play = vbtn('js-play', ICON.play, 'استماع للآية');
    play.addEventListener('click', function () { togglePlay(v.n); });
    bar.appendChild(play);

    var taf = vbtn('', ICON.book, 'التفسير', 'تفسير');
    taf.setAttribute('aria-expanded', 'false');
    bar.appendChild(taf);

    var wbw = vbtn('', ICON.grid, 'معاني الكلمات', 'كلمة كلمة');
    wbw.setAttribute('aria-expanded', 'false');
    bar.appendChild(wbw);

    var bm = vbtn('', ICON.bookmark, 'حفظ علامة');
    bm.setAttribute('aria-pressed', String(isBookmarked(v.n)));
    bm.addEventListener('click', function () {
      var arr = bookmarks[sid] || (bookmarks[sid] = []);
      var i = arr.indexOf(v.n);
      if (i === -1) arr.push(v.n); else arr.splice(i, 1);
      write(BM_KEY, bookmarks);
      bm.setAttribute('aria-pressed', String(i === -1));
      li.classList.toggle('is-bookmarked', i === -1);
    });
    bar.appendChild(bm);

    var cp = vbtn('', ICON.copy, 'نسخ الآية');
    cp.addEventListener('click', function () {
      var txt = v.ar + ' ﴿' + ar(v.n) + '﴾\n— سورة ' + surah.nameAr + ': ' + v.n +
                (v.en ? '\n\n' + v.en : '');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(toastCopied, function () {});
    });
    bar.appendChild(cp);

    var metaSpan = document.createElement('span');
    metaSpan.className = 'vbtn__meta';
    metaSpan.textContent = 'صفحة ' + ar(v.page || 0) + ' · جزء ' + ar(v.juz || 0);
    bar.appendChild(metaSpan);
    li.appendChild(bar);

    /* panels */
    var tafPanel = document.createElement('div');
    tafPanel.className = 'panel'; tafPanel.dataset.open = 'false';
    li.appendChild(tafPanel);
    taf.addEventListener('click', function () {
      var open = tafPanel.dataset.open === 'true';
      tafPanel.dataset.open = String(!open);
      taf.setAttribute('aria-expanded', String(!open));
      if (!open) fillTafsir(tafPanel, v.n);
    });

    var wPanel = document.createElement('div');
    wPanel.className = 'panel'; wPanel.dataset.open = 'false';
    li.appendChild(wPanel);
    wbw.addEventListener('click', function () {
      var open = wPanel.dataset.open === 'true';
      wPanel.dataset.open = String(!open);
      wbw.setAttribute('aria-expanded', String(!open));
      if (!open && !wPanel.firstChild) fillWords(wPanel, v);
    });

    return li;
  }

  function fillWords(panel, v) {
    var box = document.createElement('div');
    box.className = 'words';
    (v.w || []).forEach(function (w) {
      var d = document.createElement('div');
      d.className = 'word';
      var b = document.createElement('b'); b.textContent = w.a; d.appendChild(b);
      if (w.t) { var i = document.createElement('i'); i.textContent = w.t; d.appendChild(i); }
      if (w.m) { var s = document.createElement('span'); s.textContent = w.m; d.appendChild(s); }
      box.appendChild(d);
    });
    panel.appendChild(box);
  }

  function fillTafsir(panel, n) {
    panel.innerHTML = '<div class="tafsir"><span class="tafsir__src">…</span></div>';
    var draw = function () {
      var srcs = tafsirData.sources || [];
      var pick = null;
      for (var i = 0; i < srcs.length; i++) if (srcs[i].key === S.tafsir) pick = srcs[i];
      if (!pick) pick = srcs[0];
      var text = ((tafsirData.verses || {})[String(n)] || {})[pick.key] || '';
      var box = document.createElement('div');
      box.className = 'tafsir';
      box.dataset.lang = pick.lang;
      var lab = document.createElement('span');
      lab.className = 'tafsir__src';
      lab.textContent = pick.name;
      box.appendChild(lab);
      if (text) {
        text.split('\n\n').forEach(function (para) {
          var p = document.createElement('p'); p.textContent = para; box.appendChild(p);
        });
      } else {
        var p = document.createElement('p'); p.textContent = 'لا يتوفر تفسير لهذه الآية من هذا المصدر.';
        box.appendChild(p);
      }
      panel.innerHTML = '';
      panel.appendChild(box);
    };
    if (tafsirData) return draw();
    json('assets/data/tafsir/' + pad3(sid) + '.json')
      .then(function (d) { tafsirData = d; draw(); })
      .catch(function () { panel.innerHTML = '<div class="tafsir"><p>تعذّر تحميل التفسير.</p></div>'; });
  }

  function redrawOpenTafsirs() {
    Array.prototype.forEach.call(document.querySelectorAll('.ayah'), function (li) {
      var panels = li.querySelectorAll('.panel');
      if (panels[0] && panels[0].dataset.open === 'true') fillTafsir(panels[0], +li.dataset.n);
    });
  }

  /* ---------------- mushaf mode ---------------- */
  function mushaf() {
    var wrap = document.createElement('div');
    wrap.className = 'mushaf';
    var pages = {}, order = [];
    surah.verses.forEach(function (v) {
      var k = v.page || 0;
      if (!pages[k]) { pages[k] = []; order.push(k); }
      pages[k].push(v);
    });
    /* group pages into spreads of two, right-hand page first (RTL) */
    var spreads = [];
    for (var i = 0; i < order.length; i += 2) spreads.push(order.slice(i, i + 2));

    spreads.forEach(function (pair) {
      var spread = document.createElement('div');
      spread.className = 'mushaf__spread';
      spread.dataset.single = String(pair.length === 1);
      spread.dataset.pair = String(pair.length === 2);
      pair.forEach(function (k) { spread.appendChild(buildPage(k, pages[k])); });
      wrap.appendChild(spread);
    });
    return wrap;

    function buildPage(k, list) {
      var page = document.createElement('div');
      page.className = 'mushaf__page';
      var frame = document.createElement('div');
      frame.className = 'mushaf__frame';
      var p = document.createElement('p');
      p.className = 'mushaf__text';
      list.forEach(function (v) {
        var span = document.createElement('span');
        span.className = 'a';
        span.dataset.n = v.n;
        span.id = 'a' + v.n;
        span.textContent = v.ar + ' ﴿' + ar(v.n) + '﴾ ';
        span.title = 'آية ' + v.n + ' — انقر للاستماع';
        span.addEventListener('click', function () { togglePlay(v.n); });
        p.appendChild(span);
      });
      frame.appendChild(p);
      page.appendChild(frame);
      var f = document.createElement('div');
      f.className = 'mushaf__foot';
      var medallion = document.createElement('span');
      medallion.className = 'mushaf__num';
      medallion.textContent = ar(k);
      medallion.title = 'صفحة ' + ar(k);
      f.appendChild(medallion);
      page.appendChild(f);
      return page;
    }
  }

  /* ---------------- surah nav ---------------- */
  function surahNav() {
    var nav = document.createElement('nav');
    nav.className = 'surah-nav';
    var byId = {};
    (meta || []).forEach(function (m) { byId[m.id] = m; });

    function link(target, dir) {
      var m = byId[target];
      var a = document.createElement('a');
      if (!m) { a.style.visibility = 'hidden'; a.href = '#'; return a; }
      a.href = 'surah.html?s=' + target;
      var label = dir === 'prev' ? 'السورة السابقة' : 'السورة التالية';
      var icon = svg(ICON.arrow, dir === 'next' ? ' style="transform:scaleX(-1)"' : '');
      var body = '<span><small>' + label + '</small><b>' + m.nameAr + '</b></span>';
      a.innerHTML = dir === 'prev' ? icon + body : body + icon;
      return a;
    }
    nav.appendChild(link(sid - 1, 'prev'));
    nav.appendChild(link(sid + 1, 'next'));
    return nav;
  }

  /* ---------------- audio ---------------- */
  function audioUrl(n) { return AUDIO_BASE + S.reciter + '/' + pad3(sid) + pad3(n) + '.mp3'; }

  function markPlaying(n) {
    Array.prototype.forEach.call(document.querySelectorAll('.is-playing'), function (e) {
      e.classList.remove('is-playing');
    });
    if (!n) return;
    var card = document.querySelector('.ayah[data-n="' + n + '"]') ||
               document.querySelector('.mushaf__text .a[data-n="' + n + '"]');
    if (card) {
      card.classList.add('is-playing');
      if (S.autoscroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.js-play'), function (b) {
      var li = b.closest('.ayah');
      b.innerHTML = svg(li && +li.dataset.n === n ? ICON.pause : ICON.play);
    });
  }

  function playVerse(n) {
    if (n < 1 || n > surah.versesCount) return stop();
    playing = n;
    audio.src = audioUrl(n);
    audio.play().catch(function () {
      elPlayLabel.innerHTML = '<b>تعذّر تشغيل الصوت</b> — تحقّق من الاتصال';
    });
    markPlaying(n);
    elPlayer.setAttribute('data-show', 'true');
    elPlayLabel.innerHTML = '<b>' + surah.nameAr + ' · آية ' + ar(n) + '</b>';
    elPlayBtn.innerHTML = svg(ICON.pause);
    write(LAST_KEY, { surah: sid, ayah: n, at: Date.now() });
  }

  function togglePlay(n) {
    if (playing === n && !audio.paused) { audio.pause(); elPlayBtn.innerHTML = svg(ICON.play); markPlaying(0); return; }
    playVerse(n);
  }
  function stop() {
    audio.pause(); playing = null; markPlaying(0);
    elPlayer.setAttribute('data-show', 'false');
  }

  audio.addEventListener('ended', function () {
    if (playing != null && playing < surah.versesCount) playVerse(playing + 1);
    else stop();
  });

  $('#p-play').addEventListener('click', function () {
    if (!playing) return playVerse(1);
    if (audio.paused) { audio.play(); elPlayBtn.innerHTML = svg(ICON.pause); markPlaying(playing); }
    else { audio.pause(); elPlayBtn.innerHTML = svg(ICON.play); }
  });
  $('#p-prev').addEventListener('click', function () { playVerse((playing || 1) - 1); });
  $('#p-next').addEventListener('click', function () { playVerse((playing || 0) + 1); });
  $('#p-close').addEventListener('click', stop);

  /* ---------------- toast ---------------- */
  var toastEl = $('#toast'), toastT;
  function toastCopied() {
    if (!toastEl) return;
    toastEl.textContent = 'نُسخت الآية';
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 1800);
  }

  /* ---------------- settings ---------------- */
  function row(label, hint) {
    var r = document.createElement('div');
    r.className = 'setting';
    var l = document.createElement('span');
    l.className = 'setting__label';
    l.textContent = label;
    if (hint) {
      var h = document.createElement('span'); h.className = 'setting__hint'; h.textContent = hint;
      l.appendChild(h);
    }
    r.appendChild(l);
    return r;
  }
  function toggle(label, hint, key, onChange) {
    var r = row(label, hint);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'switch';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(!!S[key]));
    b.setAttribute('aria-label', label);
    b.addEventListener('click', function () {
      S[key] = !S[key];
      b.setAttribute('aria-checked', String(S[key]));
      write(SET_KEY, S); onChange();
    });
    r.appendChild(b);
    return r;
  }
  function chips(label, key, options, onChange) {
    var r = row(label);
    var c = document.createElement('div');
    c.className = 'chips';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = o[1];
      b.setAttribute('aria-pressed', String(S[key] === o[0]));
      b.addEventListener('click', function () {
        S[key] = o[0]; write(SET_KEY, S);
        Array.prototype.forEach.call(c.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onChange();
      });
      c.appendChild(b);
    });
    r.appendChild(c);
    return r;
  }
  function select(label, hint, key, options, onChange) {
    var r = row(label, hint);
    var sel = document.createElement('select');
    sel.className = 'select';
    sel.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (S[key] === o[0]) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { S[key] = sel.value; write(SET_KEY, S); onChange(); });
    r.appendChild(sel);
    return r;
  }

  function buildSettings() {
    var box = $('.settings__inner', elSettings);
    box.innerHTML = '';

    /* font size */
    var sr = row('حجم الخط');
    var st = document.createElement('div'); st.className = 'stepper';
    var minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'تصغير');
    var out = document.createElement('output');
    var plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'تكبير');
    function paint() { out.textContent = (S.size + 1) + '/' + SIZES.length; minus.disabled = !S.size; plus.disabled = S.size === SIZES.length - 1; }
    minus.addEventListener('click', function () { S.size = Math.max(0, S.size - 1); write(SET_KEY, S); applySize(); scheduleFit(); paint(); });
    plus.addEventListener('click', function () { S.size = Math.min(SIZES.length - 1, S.size + 1); write(SET_KEY, S); applySize(); scheduleFit(); paint(); });
    paint(); st.appendChild(minus); st.appendChild(out); st.appendChild(plus);
    sr.appendChild(st); box.appendChild(sr);

    box.appendChild(chips('طريقة العرض', 'mode',
      [['verse', 'آية آية'], ['mushaf', 'صفحة'], ['spread', 'صفحتان']], render));

    box.appendChild(toggle('الترجمة الإنجليزية', 'Saheeh International', 'translation', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-role="translation"]'), function (n) { n.hidden = !S.translation; });
    }));
    box.appendChild(toggle('النطق بالحروف اللاتينية', 'يفيد من لا يقرأ العربية', 'translit', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-role="translit"]'), function (n) { n.hidden = !S.translit; });
    }));

    box.appendChild(select('مصدر التفسير', '', 'tafsir', [
      ['muyassar', 'الميسر'], ['saadi', 'السعدي'], ['kathir', 'ابن كثير — إنجليزي']
    ], redrawOpenTafsirs));

    box.appendChild(select('القارئ', '', 'reciter',
      RECITERS.map(function (r) { return [r.id, r.name]; }),
      function () { if (playing) playVerse(playing); }));

    box.appendChild(toggle('التمرير التلقائي', 'يتابع الآية أثناء التلاوة', 'autoscroll', function () {}));
  }

  elGear.addEventListener('click', function () {
    var open = elSettings.getAttribute('data-open') === 'true';
    elSettings.setAttribute('data-open', String(!open));
    elGear.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (elSettings.getAttribute('data-open') === 'true') {
        elSettings.setAttribute('data-open', 'false');
        elGear.setAttribute('aria-expanded', 'false');
      } else if (playing) stop();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
    });
  }

  boot();
})();
