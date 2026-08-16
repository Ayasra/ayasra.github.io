/* =========================================================================
   Reader chrome: where-you-are, a top bar that gets out of the way, and
   page-flip mode.

   Everything here reads the DOM quran.js produced and the `quran.settings.v1`
   it already owns. The reader itself only had to learn one thing — to publish
   a `flip` setting and mirror it onto the root element.
   ========================================================================= */
(function () {
  'use strict';

  var SET_KEY = 'quran.settings.v1';
  function readSet() { try { return JSON.parse(localStorage.getItem(SET_KEY) || '{}'); } catch (e) { return {}; } }

  var AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function ar(n) {
    return String(n).split('').map(function (c) { return AR[+c] != null ? AR[+c] : c; }).join('');
  }

  var root = document.documentElement;
  var topbar = document.querySelector('.topbar');
  var main = document.getElementById('main');
  if (!topbar || !main) return;

  var params = new URLSearchParams(location.search);
  var sid = parseInt(params.get('s'), 10);
  if (!(sid >= 1 && sid <= 114)) sid = 1;

  /* quran.js loads the sūrah index itself, and asynchronously, so this is
     asked for rather than cached. */
  function surahName(id) {
    var list = window.QURAN_SURAHS;
    if (!list || id < 1 || id > 114) return '';
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].nameAr;
    return '';
  }

  /* Leaving for a neighbouring sūrah. Going forward lands on its first sheet;
     going back lands on its last, so that reversing out of a sūrah puts you
     where you would have been had you read up to its end. */
  function gotoSurah(id, atEnd) {
    if (id < 1 || id > 114) return false;
    location.href = 'surah.html?s=' + id + (atEnd ? '&at=end' : '');
    return true;
  }

  /* ---------------- the rail in the top bar ---------------- */

  var rail = document.createElement('div');
  rail.className = 'rail';
  rail.innerHTML = '<div class="rail__bar" id="rail-bar"></div>';
  topbar.appendChild(rail);

  var railBar = rail.querySelector('.rail__bar');

  /* A compact read-out beside the sūrah name. #crumb is left in place and
     merely hidden: quran.js keeps a reference to that node and writes the
     English name into it on every render, so replacing it would leave the
     reader writing into a detached element. */
  var where = document.createElement('span');
  where.className = 'where';
  var crumb = document.getElementById('crumb');
  if (crumb && crumb.parentNode) {
    crumb.classList.add('is-superseded');
    crumb.parentNode.appendChild(where);
  }

  /* ---------------- the flip bar ---------------- */

  var flipbar = document.createElement('div');
  flipbar.className = 'flipbar';
  flipbar.innerHTML =
    '<div class="flipbar__inner">' +
      /* In a right-to-left row the first child sits on the right, and in a
         bound mus'haf the earlier page is the one to the right — so "previous"
         is on the right and points that way. Both chevrons were the wrong way
         round: each pointed across the bar rather than at the page it fetches. */
      '<button type="button" class="flipbar__btn" id="flip-prev" aria-label="الصفحة السابقة">' +
        '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>' +
      '<span class="flipbar__mid">' +
        '<span class="flipbar__where"><span id="flip-label"></span><b id="flip-count"></b></span>' +
        '<span class="flipbar__track"><span class="flipbar__bar" id="flip-bar"></span></span>' +
      '</span>' +
      '<button type="button" class="flipbar__btn" id="flip-next" aria-label="الصفحة التالية">' +
        '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
    '</div>';
  document.body.appendChild(flipbar);

  var hint = document.createElement('div');
  hint.className = 'fliphint';
  hint.innerHTML = '<span>انقر الحافة للتنقّل · انقر الوسط لإظهار الأدوات</span>';
  document.body.appendChild(hint);

  /* ---------------- what page are we on ----------------
     In flip mode the snapped sheet is the answer. While scrolling it is
     whichever sheet is nearest the middle of the viewport, which is what a
     reader would call "the page I am on". */

  var pages = [];          /* the .mushaf__page nodes, in order */
  var current = null;      /* page number */
  var surahPages = null;   /* [first, last] from the reader's own data */
  var onCover = false;     /* looking at the sūrah's header rather than a page */

  function collect() {
    pages = Array.prototype.slice.call(main.querySelectorAll('.mushaf__page[data-page]'));
    if (pages.length) {
      var nums = pages.map(function (p) { return +p.dataset.page; });
      surahPages = [Math.min.apply(null, nums), Math.max.apply(null, nums)];
    } else {
      surahPages = null;
    }
    if (!current && pages.length) current = +pages[0].dataset.page;
  }

  function nearestPage() {
    if (!pages.length) return null;
    var mid = window.innerHeight / 2;
    var best = null, bestD = Infinity;
    for (var i = 0; i < pages.length; i++) {
      var r = pages[i].getBoundingClientRect();
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = +pages[i].dataset.page; }
    }
    return best;
  }

  /* Verse view has no sheets, so progress there is how far down the text the
     reader has come — the same question, measured the only way available. */
  function scrollFraction() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return 1;
    return Math.min(1, Math.max(0, window.scrollY / h));
  }

  function paint() {
    var pct, label = '', count = '';

    if (onCover && surahPages) {
      /* The cover is not a page, so it reports none — but it is the beginning
         of the sūrah, so the rail sits at zero. */
      pct = 0;
      label = 'تعريف السورة';
      count = '—';
      where.innerHTML = '<b>—</b>';
    } else if (surahPages && current != null) {
      var total = surahPages[1] - surahPages[0] + 1;
      var idx = current - surahPages[0] + 1;
      pct = total > 1 ? (idx - 1) / (total - 1) : 1;
      label = 'صفحة ' + ar(current);
      count = ar(idx) + ' / ' + ar(total);
      where.innerHTML = '<b>' + ar(idx) + '</b>/' + ar(total);
    } else {
      pct = scrollFraction();
      label = '';
      count = ar(Math.round(pct * 100)) + '٪';
      where.innerHTML = '<b>' + count + '</b>';
    }

    var prev = document.getElementById('flip-prev');
    var next = document.getElementById('flip-next');
    if (prev && next && surahPages) {
      /* At the edge of a sūrah the buttons do not stop — they cross into the
         next one. They are only spent at the two ends of the muṣḥaf itself. */
      var atFirst = current <= surahPages[0];
      var atLast = current >= surahPages[1];

      /* A button is only spent when there is genuinely nowhere left to go.
         Back still has somewhere from the first page of al-Fātiḥah — the cover
         sits before it — so it is disabled only on the cover of the first
         sūrah, and forward only on the last page of the last. */
      var canBack = !atFirst || (!!coverEl() && !onCover) || sid > 1;
      var canFwd = onCover || !atLast || sid < 114;
      prev.disabled = !canBack;
      next.disabled = !canFwd;

      var before = surahName(sid - 1), after = surahName(sid + 1);
      prev.title = atFirst
        ? (before ? 'سورة ' + before : 'السورة السابقة')
        : 'الصفحة السابقة';
      next.title = atLast
        ? (after ? 'سورة ' + after : 'السورة التالية')
        : 'الصفحة التالية';
      prev.setAttribute('aria-label', prev.title);
      next.setAttribute('aria-label', next.title);

      /* and the bar says so plainly, since a chevron alone cannot */
      if (onCover) label = 'تعريف السورة';
      else if (atLast && after) label = 'آخر صفحة · التالية سورة ' + after;
      else if (atFirst && before) label = 'أول صفحة · السابقة سورة ' + before;
    }

    railBar.style.width = (pct * 100).toFixed(1) + '%';

    var fb = document.getElementById('flip-bar');
    if (fb) fb.style.width = (pct * 100).toFixed(1) + '%';
    var fl = document.getElementById('flip-label');
    if (fl) fl.textContent = label;
    var fc = document.getElementById('flip-count');
    if (fc) fc.textContent = count;
  }

  /* ---------------- the top bar getting out of the way ---------------- */

  var lastY = window.scrollY;
  var chromeTimer = null;
  /* Long enough to reach a control after summoning the bars. They were being
     dismissed at 2.6s, which is about the time it takes to move a hand. */
  var CHROME_LINGER = 4200;

  function onScroll() {
    var y = window.scrollY;
    var dy = y - lastY;

    /* Ignore the small jitter a momentum scroll leaves behind, and never hide
       while the reader is near the top — there is nothing to gain there. */
    if (Math.abs(dy) > 4 && !isFlip()) {
      if (dy > 0 && y > 80) topbar.setAttribute('data-hidden', 'true');
      else if (dy < 0) topbar.setAttribute('data-hidden', 'false');
      lastY = y;
    }

    if (!isFlip()) {
      current = nearestPage();
      paint();
    }
  }

  /* The settings sheet is inside the bar, so the bar must stay put while it
     is open or the controls walk off the screen under the reader's finger. */
  var settings = document.getElementById('settings');
  function settingsOpen() {
    return settings && settings.getAttribute('data-open') === 'true';
  }

  window.addEventListener('scroll', function () {
    if (settingsOpen()) { topbar.setAttribute('data-hidden', 'false'); lastY = window.scrollY; return; }
    onScroll();
  }, { passive: true });

  /* ---------------- flip mode ---------------- */

  function isFlip() { return root.getAttribute('data-flip') === 'on'; }

  function scroller() { return main.querySelector('.mushaf'); }

  /* The sūrah's header card — its name, its meaning, where it was revealed,
     how many ayahs — is a sibling of the sheets in the scrolling view. Flip
     mode used to hide it outright, which meant the reader arrived in the
     middle of a sūrah with nothing telling them which one.

     It becomes the sheet before the first page instead: swipe back from page
     one and there it is. Moving the node rather than duplicating it keeps a
     single copy, so the reader's own render owns its contents as it always
     did; when flip mode is turned off it goes back where it came from. */
  function mountCover() {
    var sc = scroller();
    var head = main.querySelector('.surah-head');
    if (!sc || !head) return;

    if (isFlip()) {
      if (head.parentNode && head.parentNode.classList.contains('mushaf__cover')) return;
      var cover = document.createElement('div');
      cover.className = 'mushaf__spread mushaf__cover';
      cover.dataset.cover = '1';
      sc.insertBefore(cover, sc.firstChild);
      cover.appendChild(head);
    } else {
      var old = main.querySelector('.mushaf__cover');
      if (!old) return;
      var card = old.querySelector('.surah-head');
      if (card) main.insertBefore(card, main.firstChild);
      old.remove();
    }
  }

  function coverEl() { return main.querySelector('.mushaf__cover'); }

  function spreadOf(pageNo) {
    var p = main.querySelector('.mushaf__page[data-page="' + pageNo + '"]');
    return p ? p.closest('.mushaf__spread') : null;
  }

  /* scrollIntoView with inline:'center' rather than scrollLeft arithmetic:
     right-to-left scroll offsets differ between engines — some measure from
     the right edge, some go negative — while bounding boxes do not. */
  function goTo(pageNo, smooth) {
    var sp = spreadOf(pageNo);
    if (!sp) return;
    try {
      sp.scrollIntoView({
        behavior: smooth === false ? 'auto' : 'smooth',
        inline: 'center', block: 'nearest'
      });
    } catch (e) { sp.scrollIntoView(); }
  }

  function step(dir) {
    if (!surahPages) return;
    /* In a spread the two sheets turn together, so a step moves a whole
       spread rather than a single page. The cover counts as one of them, so
       stepping back from the first page lands on it rather than leaving the
       sūrah outright. */
    var sp = onCover ? coverEl() : spreadOf(current);
    var all = Array.prototype.slice.call(main.querySelectorAll('.mushaf__spread'));
    var i = all.indexOf(sp);
    var to = all[i + dir];
    if (!to) {
      /* The sheets ran out. In the scrolling view the sūrah nav at the foot of
         the page carries the reader onward, but flip mode hides it — so the
         page controls have to, or the end of a sūrah is a dead end. */
      gotoSurah(sid + dir, dir < 0);
      return;
    }
    if (to.dataset.cover) {
      onCover = true;
      try { to.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
      catch (e) { to.scrollIntoView(); }
      paint();
      return;
    }
    var pg = to.querySelector('.mushaf__page[data-page]');
    if (pg) { onCover = false; current = +pg.dataset.page; goTo(current); paint(); }
  }

  function currentFromScroll() {
    var sc = scroller();
    if (!sc) return;
    var box = sc.getBoundingClientRect();
    var mid = box.left + box.width / 2;
    var all = main.querySelectorAll('.mushaf__spread');
    var best = null, bestD = Infinity;
    for (var i = 0; i < all.length; i++) {
      var r = all[i].getBoundingClientRect();
      var d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = all[i]; }
    }
    if (best) {
      onCover = !!best.dataset.cover;
      var pg = best.querySelector('.mushaf__page[data-page]');
      if (pg) current = +pg.dataset.page;
    }
  }

  function bindScroller() {
    var sc = scroller();
    if (!sc || sc.dataset.bound) return;
    sc.dataset.bound = '1';
    var t = null;
    /* Turning pages leaves the bars alone. The rail is always on screen and
       says where you are, so summoning the whole chrome on every swipe would
       be motion the reader did not ask for. */
    sc.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () { currentFromScroll(); paint(); }, 90);
    }, { passive: true });
  }

  /* Dragging the sheet with a mouse was tried and taken out again. Synthesising
     a scroll and then synthesising the settle after it never matched what the
     browser does natively for a trackpad, and a gesture that fights the hand is
     worse than no gesture. The mouse turns pages by the side bands, the arrow
     keys or the two buttons; trackpad and touch scroll this container natively
     and are better left to. */


  /* Chrome hides itself once the reader settles, and comes back on a tap that
     is not on a word — tapping a word plays it, and stealing that would be
     worse than any amount of chrome. */
  function showChrome(persist) {
    root.setAttribute('data-chrome', 'shown');
    clearTimeout(chromeTimer);
    /* An open settings panel pins the chrome regardless of what the caller
       asked for: the gear that closes it lives in the bar. */
    if (!persist && isFlip() && !settingsOpen()) {
      chromeTimer = setTimeout(function () {
        if (isFlip() && !settingsOpen()) root.setAttribute('data-chrome', 'hidden');
      }, CHROME_LINGER);
    }
  }

  /* Everything that carries its own controls. A tap inside any of these is
     meant for the control under the finger, never for the chrome — the
     settings panel especially, which is a child of .wrap rather than of the
     bar that opens it and so was not covered by naming the bars alone. */
  var CHROME_SAFE = '.topbar, .settings, .flipbar, .sheet, .player, .sessionbar,' +
                    ' .toast, .fliphint, .w, .a, a, button, input, select, textarea, label';

  function closeSettings() {
    if (!settings) return;
    settings.setAttribute('data-open', 'false');
    var gear = document.getElementById('gear');
    if (gear) gear.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- tap zones ----------------
     The empty margins of the sheet are divided the way an e-reader divides
     them: a band down each side turns the page, and everything else summons
     the chrome. Turning a page is the thing done most often, so it gets the
     part of the screen a thumb falls on without aiming.

     The top and bottom strips are excluded from the side bands and always
     toggle — that is where a hand reaches when it wants the controls, and
     turning a page there instead would be a small betrayal every time. */

  var ZONE_X = 0.22;   /* width of each side band, as a fraction of the screen */
  var ZONE_Y = 0.12;   /* top and bottom strips that always summon the chrome */

  /* The printed text block belongs to the reciter, and the side bands must not
     reach into it. Words and ayah markers are already excluded — the reader
     binds its own handlers to those — but the spaces *between* words are not:
     they belong to the line. And because the type is fitted so the widest line
     spans the frame, almost the whole width of almost every line is either a
     word or a gap between two. A band laid over that is a band laid over the
     ayah, which is why tapping near the text was turning the page.

     So a tap anywhere on a line of calligraphy is never a page turn. Blank
     lines are excluded from the exclusion: they carry no text and are exactly
     the empty space the bands were meant for. */
  /* How far the calligraphy on a line actually reaches, left to right.

     A .mushaf__line is always the full width of the frame, but the words on it
     often are not. When the height veto shrinks the type — a short viewport, a
     font asking for more leading — the lines narrow and real empty margin
     opens up beside them, inside the frame. Testing membership of the line
     *element* called that margin "text" and handed clicks there to the nearest
     word, which is why the sides of the sheet stopped turning the page as soon
     as the type was scaled down.

     So the question asked is where the ink ends, not where the box does. It is
     measured per line, because line lengths differ — the last line of a page is
     usually short, and the margin beside it is genuinely empty. */
  function lineInk(line) {
    var ws = line.querySelectorAll('.w[data-n], .a[data-n]');
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < ws.length; i++) {
      var r = ws[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;      /* not laid out */
      if (r.left < lo) lo = r.left;
      if (r.right > hi) hi = r.right;
    }
    return hi > lo ? { lo: lo, hi: hi } : null;
  }

  /* A forgiving edge, so a click just off the first or last glyph still counts
     as aimed at the ayah rather than at the margin. */
  var INK_SLACK = 10;

  function onText(t, x) {
    var line = t.closest && t.closest('.mushaf__line, .mushaf__text');
    if (!line || line.classList.contains('is-blank')) return false;
    var ink = lineInk(line);
    if (!ink) return false;
    return x >= ink.lo - INK_SLACK && x <= ink.hi + INK_SLACK;
  }

  /* Which ayah a click in the white space of a line belongs to. The words are
     set with gaps between them, and those gaps are part of the ayah as far as
     anyone reading is concerned — so the click is handed to the nearest word,
     which is where the reader's own recite and verse-sheet handlers live. */
  function nearestWord(line, x) {
    var ws = line.querySelectorAll('.w[data-n], .a[data-n]');
    var best = null, bestD = Infinity;
    for (var i = 0; i < ws.length; i++) {
      var r = ws[i].getBoundingClientRect();
      var d = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
      if (d < bestD) { bestD = d; best = ws[i]; }
    }
    return best;
  }

  function tapZone(x, y) {
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (!w || !h) return 'toggle';
    /* A click with no position — a keyboard activation, say — is not aimed at
       anything, so it must not be read as aiming at a corner. */
    if (x === 0 && y === 0) return 'toggle';
    if (y < h * ZONE_Y || y > h * (1 - ZONE_Y)) return 'toggle';
    /* Right-to-left: the earlier page lies to the right, the later to the
       left, as the leaves of a bound muṣḥaf do. */
    if (x < w * ZONE_X) return 'next';
    if (x > w * (1 - ZONE_X)) return 'prev';
    return 'toggle';
  }

  document.addEventListener('click', function (e) {
    if (!isFlip()) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(CHROME_SAFE)) return;

    /* With the settings open, a tap on the page dismisses the panel. Hiding
       the chrome here instead would carry the gear off the screen while the
       panel stayed behind — leaving it open with nothing left to close it. */
    if (settingsOpen()) { closeSettings(); return; }

    /* A word or an ayah marker never reaches here — the reader's own handlers
       have those, and CHROME_SAFE lets them through untouched.

       What is left of a text line is the gaps between words. Those were being
       treated as empty space, which is wrong twice over: they are not empty to
       anyone reading, and it meant clicking an ayah anywhere but exactly on a
       glyph did nothing but move the bars. The click is passed to the nearest
       word instead, so it recites — or opens the verse, if the marker was the
       nearest thing to it. */
    if (onText(e.target, e.clientX)) {
      var line = e.target.closest('.mushaf__line, .mushaf__text');
      var w = line && nearestWord(line, e.clientX);
      if (w) { w.click(); return; }
    }

    var zone = tapZone(e.clientX, e.clientY);
    if (zone === 'next') { step(1); return; }
    if (zone === 'prev') { step(-1); return; }

    if (root.getAttribute('data-chrome') === 'hidden') showChrome();
    else root.setAttribute('data-chrome', 'hidden');
  });

  /* Whatever opened the panel, the chrome stays put for as long as it is open,
     and the idle timer only resumes once it closes. */
  if (settings) {
    new MutationObserver(function () {
      if (settingsOpen()) showChrome(true);
      else if (isFlip()) showChrome();
    }).observe(settings, { attributes: true, attributeFilter: ['data-open'] });
  }

  document.getElementById('flip-prev').addEventListener('click', function () { showChrome(); step(-1); });
  document.getElementById('flip-next').addEventListener('click', function () { showChrome(); step(1); });

  /* Touching either bar restarts its clock, so it never disappears part-way
     through being used. */
  ['pointerdown', 'focusin'].forEach(function (evt) {
    flipbar.addEventListener(evt, function () { if (isFlip()) showChrome(); });
    topbar.addEventListener(evt, function () { if (isFlip()) showChrome(); });
  });

  document.addEventListener('keydown', function (e) {
    if (!isFlip()) return;
    if (/input|textarea|select/i.test(e.target.tagName || '')) return;
    /* Right-to-left: the right arrow goes back through the mus'haf. */
    if (e.key === 'ArrowRight') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(1); }
  });

  /* ---------------- reacting to the reader ---------------- */

  function sync() {
    collect();
    mountCover();
    if (isFlip()) {
      bindScroller();
      /* Arriving backwards out of the next sūrah: land on the last sheet, so
         reversing puts the reader where reading up to the end would have. */
      if (params.get('at') === 'end' && pages.length && !landed) {
        current = +pages[pages.length - 1].dataset.page;
        landed = true;
      }
      /* land on the page the reader was already looking at */
      if (current) goTo(current, false);
      /* Opens bare. The bars are summoned when wanted rather than shown and
         then taken away, which is one fewer thing moving as the page settles. */
      if (!settingsOpen()) root.setAttribute('data-chrome', 'hidden');
      var seen = readSet().flipSeen;
      if (!seen) {
        hint.setAttribute('data-show', 'true');
        setTimeout(function () { hint.setAttribute('data-show', 'false'); }, 3200);
        try {
          var s = readSet(); s.flipSeen = true;
          localStorage.setItem(SET_KEY, JSON.stringify(s));
        } catch (e) {}
      }
    } else {
      root.setAttribute('data-chrome', 'shown');
      topbar.setAttribute('data-hidden', 'false');
      current = nearestPage();
    }
    paint();
  }

  /* ---------------- how much room is actually free ----------------
     The reader fits the calligraphy to the box it is given, so that box has to
     be truthful. Measuring the chrome and publishing it means the sheet is
     sized against real space: turn on the recitation bar and the page is
     re-fitted a little smaller rather than being quietly clipped. */

  var player = document.getElementById('player');

  function measureChrome() {
    /* The bars overlay the page rather than displacing it, so none of this
       feeds the page's height any more — the sheet is always a full screen and
       never re-fits when a bar appears. Two things still need real numbers:
       where the settings panel hangs from, and how far the flip bar must sit
       above the recitation player so the two do not stack on each other. */
    var topH = topbar.getBoundingClientRect().height;
    var playerH = (player && player.getAttribute('data-show') === 'true')
      ? player.getBoundingClientRect().height : 0;

    root.style.setProperty('--topbar-h', topH.toFixed(1) + 'px');
    root.style.setProperty('--player-h', playerH.toFixed(1) + 'px');
  }

  if (player) {
    new MutationObserver(measureChrome)
      .observe(player, { attributes: true, attributeFilter: ['data-show'] });
  }

  var landed = false;      /* the ?at=end jump is honoured once, on arrival */
  var resync = null;
  new MutationObserver(function () {
    clearTimeout(resync);
    resync = setTimeout(function () { sync(); measureChrome(); }, 140);
  }).observe(main, { childList: true });

  /* flipping the setting rewrites the root attribute; follow it */
  new MutationObserver(function () { sync(); measureChrome(); })
    .observe(root, { attributes: true, attributeFilter: ['data-flip', 'data-mode'] });

  window.addEventListener('resize', function () {
    measureChrome();
    if (isFlip() && current) goTo(current, false);
    paint();
  });

  sync();
  measureChrome();
  setTimeout(function () { sync(); measureChrome(); }, 500);
})();
