/* =========================================================================
   Qur'an reader engine — drives surah.html for every sūrah via ?s=NN
   Data: assets/data/surahs.json, assets/data/NNN.json,
         assets/data/tafsir/NNN.json (lazy), assets/intros.js (optional)
   ========================================================================= */
(function () {
  'use strict';

  var SET_KEY = 'quran.settings.v1';
  /* quran.bookmarks.v1 is read once by tracker.js, which folds the old
     single-colour bookmarks into the coloured marks store. */
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

  /* Each theme is a (light-or-dark base, palette) pair. The base is what the
     shared athkar stylesheet understands, so those pages never receive a
     theme name they cannot style. */
  var THEMES = [
    { id: 'paper', label: 'ورقي',        base: 'day',   palette: 'paper' },
    { id: 'blue',  label: 'أزرق',        base: 'day',   palette: 'blue'  },
    { id: 'mono',  label: 'أبيض وأسود',  base: 'day',   palette: 'mono'  },
    { id: 'night', label: 'ليلي',        base: 'night', palette: 'paper' }
  ];

  var S = Object.assign({
    size: 2, translation: true, translit: false, mode: 'mushaf',
    tafsir: 'muyassar', reciter: 'Minshawy_Murattal_128kbps', autoscroll: true,
    theme: null, frame: true, pattern: true, flip: false
  }, read(SET_KEY, {}));

  /* Hifz review needs one span per word, which only the page views produce —
     the verse view sets each ayah as a single block. So a review link pins the
     mode regardless of the saved preference, without overwriting it. */
  if (new URLSearchParams(location.search).has('review') && S.mode === 'verse') S.mode = 'mushaf';


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

  /* Each muṣḥaf page has its own font in which one glyph is one whole word,
     already shaped and spaced by the calligrapher. Injecting the @font-face
     on demand means a reader only downloads the pages actually opened. */
  var fontsAsked = {};
  function ensurePageFont(pageNo) {
    if (fontsAsked[pageNo]) return;
    fontsAsked[pageNo] = true;
    var n = pad3(pageNo);
    var css = document.createElement('style');
    css.textContent =
      '@font-face{font-family:"QCF' + n + '";' +
      'src:url("assets/fonts/pages/p' + n + '.woff2") format("woff2");' +
      'font-display:swap;font-weight:normal;font-style:normal}';
    document.head.appendChild(css);
  }
  function applyMode() { document.documentElement.setAttribute('data-mode', S.mode); applyFlip(); }

  /* Page-flip mode: one sheet at a time, turned sideways. It only means
     anything where there are sheets, so the verse view never enters it however
     the setting is left. The layout itself lives in reader-ui.css; all this
     file does is publish the state. */
  function applyFlip() {
    var on = !!S.flip && S.mode !== 'verse';
    document.documentElement.setAttribute('data-flip', on ? 'on' : 'off');
  }

  /* The two decorative rules a reader may want out of the way: the ruled box
     drawn around the text on every sheet, and the geometric watermark behind
     the whole page. */
  function applyOrnament() {
    var root = document.documentElement;
    root.setAttribute('data-frame', S.frame ? 'on' : 'off');
    root.setAttribute('data-pattern', S.pattern ? 'on' : 'off');
  }

  /* Where a sūrah opens, a printed muṣḥaf spends two of the fifteen lines on
     the ornamental name band and the basmala before the first verse — which
     is exactly why the API reports Luqmān's first verse on line 3 of p411
     rather than line 1. Work out which lines those are. */
  function openingLines() {
    if (!surah.layout) return null;
    var first = surah.pages && surah.pages[0];
    var lines = surah.layout[String(first)];
    if (!lines) return null;
    var nums = Object.keys(lines).map(Number).sort(function (a, b) { return a - b; });
    if (!nums.length) return null;
    var firstVerseLine = nums[0];
    var free = firstVerseLine - 1;          /* lines the muṣḥaf left for the opening */
    var wantsBasmala = !!surah.bismillah;

    /* Two free lines is the usual case: name band, then basmala. But eighteen
       sūrahs open on line 2 — an-Nisāʾ, Yūnus, al-Ḥajj and the rest — leaving
       a single line for the whole opening. There both are set into that one
       line, stacked and reduced, so the fifteen-line grid still holds. */
    if (free <= 0) return null;
    if (free === 1 && wantsBasmala) {
        return { page: first, band: 1, bism: 0, tight: true };
    }
    var bism = wantsBasmala ? firstVerseLine - 1 : 0;
    var band = firstVerseLine - (wantsBasmala ? 2 : 1);
    return { page: first, band: band >= 1 ? band : 0, bism: bism >= 1 ? bism : 0, tight: false };
  }

  /* Forced two-page mode.
     The size that fits a column is a function of the column width, not of the
     reader's chosen size — roughly 18em of measure per line reads well in
     naskh. Compute that, cap it at the reader's size, and if the result would
     fall below the legibility floor, stack the pages instead. */
  var LINES_PER_PAGE = 15;    /* every muṣḥaf page, by construction */
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

  /* Fill each sheet.
     Every page box has the same proportion, so the text is scaled until the
     block fills its frame. For wrapped text the rendered height grows roughly
     with the square of the font size (bigger type ⇒ both taller lines and more
     of them), so sqrt(target/actual) converges in a couple of passes.
     Clamped, because a sūrah's closing page genuinely holds only a line or
     two and should be left part-empty, exactly as it is in print. */
  var FIT_MIN = 0.70, FIT_MAX = 1.30;

  /* A page font is drawn so that every full line spans the same measure.
     So: pick the font size that makes the widest line exactly fill the frame,
     then set the leading so fifteen lines exactly fill its height. The page
     then matches the printed original — filled without stretching any spaces,
     because there are no spaces to stretch. */
  function fitExactPages() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.mushaf__frame--exact'), function (frame) {
        /* clientWidth counts the padding, so sizing the type to it pushed the
           lines out into the margin until they touched the rule. Measure the
           content box instead, which is the printed text block. */
        var cs = getComputedStyle(frame);
        var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        var w = frame.clientWidth - padX;
        var h = frame.clientHeight - padY;
        if (w <= 0 || h <= 0) return;

        var REF = 40;                       /* measure at a known size */
        frame.style.setProperty('--exact-size', REF + 'px');
        frame.style.setProperty('--exact-line', '1');

        var widest = 0;
        Array.prototype.forEach.call(frame.children, function (row) {
          if (row.classList.contains('is-blank')) return;
          /* the band and basmala are set in other fonts — measuring them
             would skew the size chosen for the calligraphic lines */
          if (row.classList.contains('mushaf__line--band')) return;
          if (row.classList.contains('mushaf__line--bism')) return;
          /* the rows are flex containers, and scrollWidth under-reports the
             overflow of items that cannot shrink — so add the words up */
          var w = 0;
          Array.prototype.forEach.call(row.children, function (word) {
            w += word.getBoundingClientRect().width;
          });
          widest = Math.max(widest, w || row.scrollWidth);
        });
        if (!widest) return;

        var size = REF * (w / widest);
        frame.style.setProperty('--exact-size', size.toFixed(2) + 'px');
        frame.style.setProperty('--exact-line', (h / LINES_PER_PAGE / size).toFixed(4));
      });
  }

  function fitPages() {
    var frames = document.querySelectorAll('.mushaf__frame:not(.mushaf__frame--exact)');
    if (!frames.length) return;

    Array.prototype.forEach.call(frames, function (frame) {
      var page = frame.parentNode;
      var text = frame.querySelector('.mushaf__text');
      if (!text) return;

      page.style.setProperty('--fit', '1');
      for (var pass = 0; pass < 3; pass++) {
        var avail = frame.clientHeight -
                    (parseFloat(getComputedStyle(frame).paddingTop) || 0) * 2;
        var used = text.scrollHeight;
        if (!avail || !used) break;
        var cur = parseFloat(page.style.getPropertyValue('--fit')) || 1;
        var next = cur * Math.sqrt(avail / used);
        next = Math.max(FIT_MIN, Math.min(FIT_MAX, next));
        if (Math.abs(next - cur) < 0.01) break;
        page.style.setProperty('--fit', next.toFixed(3));
      }
    });
  }

  function layoutPages() { fitSpread(); fitPages(); fitExactPages(); }

  /* Measuring straight after appending can read a stale layout box, and the
     Qur'anic webfont changes metrics once it lands — so fit after layout has
     settled and again when the font is ready. */
  function scheduleFit() {
    requestAnimationFrame(function () { requestAnimationFrame(layoutPages); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layoutPages).catch(function () {});
    }
  }

  var fitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(layoutPages, 120);
  });
  window.addEventListener('orientationchange', scheduleFit);
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }
  function currentTheme() {
    var t = themeById(S.theme);
    if (t) return t;
    /* no choice made yet — fall back to the athkar day/night preference */
    var prev = read(THEKR_SET, {}).theme;
    var h = new Date().getHours();
    var dark = prev === 'night' || ((!prev || prev === 'auto') && !(h >= 5 && h < 18));
    return themeById(dark ? 'night' : 'paper');
  }
  function applyTheme() {
    var t = currentTheme();
    var root = document.documentElement;
    root.setAttribute('data-theme', t.base);
    root.setAttribute('data-palette', t.palette);
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content',
      t.base === 'night' ? '#0B1119' : (t.palette === 'blue' ? '#EEF4FA' : t.palette === 'mono' ? '#F4F4F4' : '#FAF6EF'));
  }

  /* ---------------- data ----------------
     Data ships as <script> files that assign to a global rather than JSON
     fetched with fetch(). Script tags are not subject to the file:// CORS
     block, so the reader also works when the page is opened straight from
     disk — which fetch() cannot do. */
  function loadScript(src, globalName) {
    return new Promise(function (resolve, reject) {
      if (window[globalName]) return resolve(window[globalName]);
      var el = document.createElement('script');
      el.src = src;
      el.onload = function () {
        if (window[globalName]) resolve(window[globalName]);
        else reject(new Error(src + ' loaded but ' + globalName + ' is missing'));
      };
      el.onerror = function () { reject(new Error('تعذّر تحميل ' + src)); };
      document.head.appendChild(el);
    });
  }

  function boot() {
    var q = new URLSearchParams(location.search);
    sid = parseInt(q.get('s'), 10);
    if (!(sid >= 1 && sid <= 114)) sid = 1;
    var jump = parseInt(q.get('a'), 10) || 0;

    applyTheme(); applySize(); applyMode(); applyOrnament();

    Promise.all([
      loadScript('assets/data/surahs.js', 'QURAN_SURAHS'),
      loadScript('assets/data/' + pad3(sid) + '.js', 'QURAN_SURAH')
    ])
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
    /* In the page views the basmala is printed on the sheet itself, so the
       standalone one would be a duplicate. */
    if (surah.bismillah && (S.mode === 'verse' || !surah.layout)) {
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

    /* The ornamental name: in the KFGQPC sūrah-names font each sūrah is a
       single glyph already set inside its printed frame. Its codepoint is
       U+E<ddd> where ddd is the sūrah number written in DECIMAL, not hex —
       so Luqmān (31) is U+E031, not U+E01F. */
    var h = document.createElement('h1');
    h.className = 'surah-head__name';
    var band = document.createElement('span');
    band.className = 'surah-head__band';
    band.setAttribute('aria-hidden', 'true');
    band.textContent = String.fromCharCode(parseInt('E' + pad3(surah.id), 16));
    var sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = 'سورة ' + surah.nameAr;
    h.appendChild(band);
    h.appendChild(sr);
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

    var p = document.createElement('p');
    p.className = 'ayah__ar';
    p.appendChild(document.createTextNode(v.ar + '\u00A0'));
    var num = document.createElement('button');
    num.type = 'button';
    num.className = 'ayah__num ayah__num--btn';
    num.textContent = '﴿' + ar(v.n) + '﴾';
    num.setAttribute('aria-label', 'تفسير الآية ' + v.n);
    num.addEventListener('click', function () { openSheet(v.n); });
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

    /* Marking is a category choice now, not a single toggle, so the button
       opens the verse sheet where the colours live rather than doing it here. */
    var bm = vbtn('', ICON.bookmark, 'العلامات');
    bm.addEventListener('click', function () { openSheet(v.n); });
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
    loadScript('assets/data/tafsir/' + pad3(sid) + '.js', 'QURAN_TAFSIR')
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
    /* In a printed muṣḥaf an open spread shows an odd page on the right and
       the following even page on the left — the illuminated opening pairs
       al-Fātiḥah (1) with the start of al-Baqarah (2). So a spread must begin
       on an odd page. If a sūrah opens on an even page that sheet belongs on
       the left of a spread whose right half is the previous sūrah, so it is
       shown on its own rather than mis-paired.
       صفحة mode never pairs at all. */
    var spreads = [];
    if (S.mode !== 'spread') {
      order.forEach(function (k) { spreads.push([k]); });
    } else {
      var i = 0;
      if (order.length && order[0] % 2 === 0) { spreads.push([order[0]]); i = 1; }
      for (; i < order.length; i += 2) spreads.push(order.slice(i, i + 2));
    }

    spreads.forEach(function (pair) {
      var spread = document.createElement('div');
      spread.className = 'mushaf__spread';
      spread.dataset.single = String(pair.length === 1);
      spread.dataset.pair = String(pair.length === 2);
      if (pair.length === 1) {
        /* odd pages fall on the right of a binding, even pages on the left */
        spread.dataset.side = (pair[0] % 2 === 1) ? 'right' : 'left';
      }
      pair.forEach(function (k) { spread.appendChild(buildPage(k, pages[k])); });
      wrap.appendChild(spread);
    });
    return wrap;

    function buildPage(k, list) {
      var page = document.createElement('div');
      page.className = 'mushaf__page';
      page.dataset.page = k;

      var frame = document.createElement('div');
      frame.className = 'mushaf__frame';

      var lines = (surah.layout || {})[String(k)];
      if (lines) {
        /* Real muṣḥaf page: fifteen fixed lines, each drawn with the page's
           own font. Lines belonging to a neighbouring sūrah stay empty so the
           sheet keeps its true height without borrowing another sūrah's text. */
        ensurePageFont(k);
        var opening = openingLines();
        frame.classList.add('mushaf__frame--exact');
        frame.style.fontFamily = '"QCF' + pad3(k) + '"';
        for (var ln = 1; ln <= LINES_PER_PAGE; ln++) {
          var row = document.createElement('div');
          row.className = 'mushaf__line';
          var words = lines[String(ln)];
          if (opening && opening.page === k && ln === opening.band) {
            row.classList.add('mushaf__line--band');
            /* The ornamental name band a printed muṣḥaf draws here is not
               rendered: the sūrah is already named in the header card above,
               and repeating it immediately before the basmala earned nothing.
               The line itself is kept — blank — so the sheet stays fifteen
               lines tall and still matches the printed page. */
            if (opening.tight) {
              /* Eighteen sūrahs open on line 2, leaving one free line for the
                 whole opening. With the band gone the basmala has that line to
                 itself instead of sharing it. */
              var stack = document.createElement('span');
              stack.className = 'opening opening--tight';
              var bs = document.createElement('span');
              bs.className = 'opening__bism';
              bs.textContent = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
              stack.appendChild(bs);
              row.appendChild(stack);
            } else {
              row.classList.add('is-blank');
              row.innerHTML = '&nbsp;';
            }
          } else if (opening && opening.page === k && ln === opening.bism) {
            row.classList.add('mushaf__line--bism');
            row.textContent = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
          } else if (!words || !words.length) {
            /* keeps the sheet fifteen lines tall while showing nothing —
               the neighbouring sūrah's lines stay blank in their real place */
            row.classList.add('is-blank');
            row.innerHTML = '&nbsp;';
          } else {
            words.forEach(function (w) {
              var sp = document.createElement('span');
              sp.className = 'w' + (w.e ? ' w--end' : '');
              sp.dataset.n = w.v;
              sp.textContent = w.g;
              if (w.e) {
                /* the ayah number opens the verse detail … */
                sp.setAttribute('role', 'button');
                sp.setAttribute('tabindex', '0');
                sp.setAttribute('aria-label', 'تفسير الآية ' + w.v);
                sp.addEventListener('click', function () { openSheet(w.v); });
                sp.addEventListener('keydown', function (e) {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(w.v); }
                });
              } else {
                /* … while any word of the verse plays it */
                sp.addEventListener('click', function () { togglePlay(w.v); });
              }
              row.appendChild(sp);
            });
          }
          frame.appendChild(row);
        }
      } else {
        /* Fallback for data built before glyph codes existed. */
        var p = document.createElement('p');
        p.className = 'mushaf__text';
        list.forEach(function (v) {
          var span = document.createElement('span');
          span.className = 'a';
          span.dataset.n = v.n;
          span.id = 'a' + v.n;
          span.textContent = v.ar + ' ﴿' + ar(v.n) + '﴾ ';
          span.addEventListener('click', function () { togglePlay(v.n); });
          p.appendChild(span);
        });
        frame.appendChild(p);
      }

      /* anchor the first appearance of each verse for deep links + scrolling */
      list.forEach(function (v) {
        if (document.getElementById('a' + v.n)) return;
        var hit = frame.querySelector('.w[data-n="' + v.n + '"]');
        if (hit && !hit.id) hit.id = 'a' + v.n;
      });

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
    Array.prototype.forEach.call(
      document.querySelectorAll('.mushaf__line .w[data-n="' + n + '"]'),
      function (w) { w.classList.add('is-playing'); });

    var card = document.querySelector('.ayah[data-n="' + n + '"]') ||
               document.querySelector('.mushaf__line .w[data-n="' + n + '"]') ||
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
    /* play() returns a promise in current browsers but undefined in older
       ones, so the rejection handler is attached only when there is something
       to attach it to. */
    var started = audio.play();
    if (started && typeof started.catch === 'function') {
      started.catch(function () {
        elPlayLabel.innerHTML = '<b>تعذّر تشغيل الصوت</b> — تحقّق من الاتصال';
      });
    }
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

  /* ---------------- verse sheet ----------------
     Tapping an ayah medallion opens this; tapping a word still plays. */
  var elSheet = $('#sheet'), elSheetBody = $('#sheet-body'),
      elSheetTitle = $('#sheet-title'), elSheetSub = $('#sheet-sub'),
      elSheetMed = $('#sheet-medallion');
  var sheetVerse = null, lastFocus = null;

  function verseByNumber(n) {
    for (var i = 0; i < surah.verses.length; i++) if (surah.verses[i].n === n) return surah.verses[i];
    return null;
  }

  function openSheet(n) {
    var v = verseByNumber(n);
    if (!v) return;
    sheetVerse = n;
    lastFocus = document.activeElement;

    elSheetMed.textContent = ar(n);
    elSheetTitle.textContent = 'سورة ' + surah.nameAr + ' · الآية ' + ar(n);
    elSheetSub.textContent = 'صفحة ' + ar(v.page || 0) + ' · جزء ' + ar(v.juz || 0) +
      (v.sajda ? ' · سجدة تلاوة' : '');

    elSheetBody.innerHTML = '';

    var arP = document.createElement('p');
    arP.className = 'sheet__ar';
    arP.textContent = v.ar;
    elSheetBody.appendChild(arP);

    elSheetBody.appendChild(sheetActions(v));

    if (v.tr) elSheetBody.appendChild(sheetSection('النطق', 'sheet__tr', v.tr));
    if (v.en) elSheetBody.appendChild(sheetSection('الترجمة', 'sheet__en', v.en));

    /* tafsir, with its own source picker */
    var tSec = document.createElement('div');
    tSec.className = 'sheet__sec';
    var tH = document.createElement('h3'); tH.textContent = 'التفسير'; tSec.appendChild(tH);
    var picker = document.createElement('div'); picker.className = 'sheet__srcs'; tSec.appendChild(picker);
    var tBox = document.createElement('div'); tBox.className = 'tafsir'; tSec.appendChild(tBox);
    elSheetBody.appendChild(tSec);
    loadTafsirInto(picker, tBox, n);

    /* word by word */
    if (v.w && v.w.length) {
      var wSec = document.createElement('div');
      wSec.className = 'sheet__sec';
      var wH = document.createElement('h3'); wH.textContent = 'معاني الكلمات'; wSec.appendChild(wH);
      var panel = document.createElement('div');
      fillWords(panel, v);
      wSec.appendChild(panel);
      elSheetBody.appendChild(wSec);
    }

    elSheet.hidden = false;
    requestAnimationFrame(function () { elSheet.setAttribute('data-open', 'true'); });
    elSheetBody.scrollTop = 0;
    $('#sheet-close').focus();
  }

  function sheetSection(title, cls, text) {
    var sec = document.createElement('div');
    sec.className = 'sheet__sec';
    var h = document.createElement('h3'); h.textContent = title; sec.appendChild(h);
    var p = document.createElement('p'); p.className = cls; p.textContent = text; sec.appendChild(p);
    return sec;
  }

  function sheetActions(v) {
    var bar = document.createElement('div');
    bar.className = 'sheet__actions';

    var play = vbtn('', ICON.play, 'استماع للآية', 'استماع');
    play.addEventListener('click', function () { togglePlay(v.n); });
    bar.appendChild(play);

    /* The single-colour bookmark button that used to sit here was replaced by
       the coloured-mark panel marks.js appends to the sheet body.

       The coloured-mark panel is appended by marks.js. Announcing the
       open sheet rather than building the panel inline keeps this file about
       rendering the muṣḥaf — the same arrangement as the session pill and the
       review surface. */
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('quran:sheet', {
        detail: { surah: sid, ayah: v.n, bar: bar }
      }));
    }, 0);

    var cp = vbtn('', ICON.copy, 'نسخ الآية', 'نسخ');
    cp.addEventListener('click', function () {
      var txt = v.ar + ' ﴿' + ar(v.n) + '﴾\n— سورة ' + surah.nameAr + ': ' + v.n +
                (v.en ? '\n\n' + v.en : '');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(toastCopied, function () {});
    });
    bar.appendChild(cp);
    return bar;
  }

  function loadTafsirInto(picker, box, n) {
    box.textContent = '…';
    var draw = function () {
      var srcs = tafsirData.sources || [];
      picker.innerHTML = '';
      srcs.forEach(function (src) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = src.name;
        b.setAttribute('aria-pressed', String(S.tafsir === src.key));
        b.addEventListener('click', function () {
          S.tafsir = src.key; write(SET_KEY, S);
          Array.prototype.forEach.call(picker.children, function (x) {
            x.setAttribute('aria-pressed', String(x === b));
          });
          paint();
          redrawOpenTafsirs();
        });
        picker.appendChild(b);
      });
      paint();
    };
    function paint() {
      var srcs = tafsirData.sources || [];
      var pick = null;
      for (var i = 0; i < srcs.length; i++) if (srcs[i].key === S.tafsir) pick = srcs[i];
      if (!pick) pick = srcs[0];
      box.innerHTML = '';
      box.dataset.lang = pick ? pick.lang : 'ar';
      var text = ((tafsirData.verses || {})[String(n)] || {})[pick && pick.key] || '';
      if (text) {
        text.split('\n\n').forEach(function (para) {
          var p = document.createElement('p'); p.textContent = para; box.appendChild(p);
        });
      } else {
        var p = document.createElement('p');
        p.textContent = 'لا يتوفر تفسير لهذه الآية من هذا المصدر.';
        box.appendChild(p);
      }
    }
    if (tafsirData) return draw();
    loadScript('assets/data/tafsir/' + pad3(sid) + '.js', 'QURAN_TAFSIR')
      .then(function (d) { tafsirData = d; draw(); })
      .catch(function () { box.textContent = 'تعذّر تحميل التفسير.'; });
  }

  function closeSheet() {
    elSheet.setAttribute('data-open', 'false');
    sheetVerse = null;
    setTimeout(function () { elSheet.hidden = true; }, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet-scrim').addEventListener('click', closeSheet);

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

    box.appendChild(toggle('تقليب الصفحات', 'اسحب أفقيًا، وتملأ الصفحة الشاشة', 'flip', function () {
      applyFlip();
      scheduleFit();
    }));

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

    /* Removing the frame changes the text block's width, so the calligraphy
       has to be re-fitted rather than just hidden. */
    box.appendChild(toggle('إطار الصفحة', 'الخط المزدوج حول نص كل صفحة', 'frame', function () {
      applyOrnament();
      scheduleFit();
    }));
    box.appendChild(toggle('زخرفة الخلفية', 'النقش الهندسي خلف الصفحات', 'pattern', applyOrnament));

    /* theme */
    var themeRow = row('السمة');
    var tc = document.createElement('div');
    tc.className = 'chips chips--wrap';
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.label;
      b.setAttribute('aria-pressed', String(currentTheme().id === t.id));
      b.addEventListener('click', function () {
        S.theme = t.id;
        write(SET_KEY, S);
        /* keep the athkar pages on a base they understand */
        try {
          var prev = read(THEKR_SET, {});
          prev.theme = t.base;
          write(THEKR_SET, prev);
        } catch (e) {}
        Array.prototype.forEach.call(tc.children, function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        applyTheme();
      });
      tc.appendChild(b);
    });
    themeRow.appendChild(tc);
    box.appendChild(themeRow);
  }

  elGear.addEventListener('click', function () {
    var open = elSettings.getAttribute('data-open') === 'true';
    elSettings.setAttribute('data-open', String(!open));
    elGear.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (sheetVerse != null) { closeSheet(); return; }
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
