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
      '<button type="button" class="flipbar__btn" id="flip-prev" aria-label="الصفحة السابقة">' +
        '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<span class="flipbar__mid">' +
        '<span class="flipbar__where"><span id="flip-label"></span><b id="flip-count"></b></span>' +
        '<span class="flipbar__track"><span class="flipbar__bar" id="flip-bar"></span></span>' +
      '</span>' +
      '<button type="button" class="flipbar__btn" id="flip-next" aria-label="الصفحة التالية">' +
        '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>' +
    '</div>';
  document.body.appendChild(flipbar);

  var hint = document.createElement('div');
  hint.className = 'fliphint';
  hint.innerHTML = '<span>اسحب أفقيًا لتقليب الصفحات</span>';
  document.body.appendChild(hint);

  /* ---------------- what page are we on ----------------
     In flip mode the snapped sheet is the answer. While scrolling it is
     whichever sheet is nearest the middle of the viewport, which is what a
     reader would call "the page I am on". */

  var pages = [];          /* the .mushaf__page nodes, in order */
  var current = null;      /* page number */
  var surahPages = null;   /* [first, last] from the reader's own data */

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

    if (surahPages && current != null) {
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

    railBar.style.width = (pct * 100).toFixed(1) + '%';

    var fb = document.getElementById('flip-bar');
    if (fb) fb.style.width = (pct * 100).toFixed(1) + '%';
    var fl = document.getElementById('flip-label');
    if (fl) fl.textContent = label;
    var fc = document.getElementById('flip-count');
    if (fc) fc.textContent = count;

    var prev = document.getElementById('flip-prev');
    var next = document.getElementById('flip-next');
    if (prev && next && surahPages) {
      prev.disabled = current <= surahPages[0];
      next.disabled = current >= surahPages[1];
    }
  }

  /* ---------------- the top bar getting out of the way ---------------- */

  var lastY = window.scrollY;
  var chromeTimer = null;

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
       spread rather than a single page. */
    var sp = spreadOf(current);
    var all = Array.prototype.slice.call(main.querySelectorAll('.mushaf__spread'));
    var i = all.indexOf(sp);
    var to = all[i + dir];
    if (!to) return;
    var pg = to.querySelector('.mushaf__page[data-page]');
    if (pg) { current = +pg.dataset.page; goTo(current); paint(); }
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
      var pg = best.querySelector('.mushaf__page[data-page]');
      if (pg) current = +pg.dataset.page;
    }
  }

  function bindScroller() {
    var sc = scroller();
    if (!sc || sc.dataset.bound) return;
    sc.dataset.bound = '1';
    var t = null;
    sc.addEventListener('scroll', function () {
      showChrome();
      clearTimeout(t);
      t = setTimeout(function () { currentFromScroll(); paint(); }, 90);
    }, { passive: true });
  }

  /* Chrome hides itself once the reader settles, and comes back on a tap that
     is not on a word — tapping a word plays it, and stealing that would be
     worse than any amount of chrome. */
  function showChrome(persist) {
    root.setAttribute('data-chrome', 'shown');
    clearTimeout(chromeTimer);
    if (!persist && isFlip()) {
      chromeTimer = setTimeout(function () {
        if (isFlip() && !settingsOpen()) root.setAttribute('data-chrome', 'hidden');
      }, 2600);
    }
  }

  document.addEventListener('click', function (e) {
    if (!isFlip()) return;
    var t = e.target;
    if (t.closest && (t.closest('.w') || t.closest('.a') || t.closest('.flipbar') ||
                      t.closest('.topbar') || t.closest('.sheet') || t.closest('.player'))) return;
    if (root.getAttribute('data-chrome') === 'hidden') showChrome();
    else root.setAttribute('data-chrome', 'hidden');
  });

  document.getElementById('flip-prev').addEventListener('click', function () { showChrome(); step(-1); });
  document.getElementById('flip-next').addEventListener('click', function () { showChrome(); step(1); });

  document.addEventListener('keydown', function (e) {
    if (!isFlip()) return;
    if (/input|textarea|select/i.test(e.target.tagName || '')) return;
    /* Right-to-left: the right arrow goes back through the mus'haf. */
    if (e.key === 'ArrowRight') { e.preventDefault(); showChrome(); step(-1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showChrome(); step(1); }
  });

  /* ---------------- reacting to the reader ---------------- */

  function sync() {
    collect();
    if (isFlip()) {
      bindScroller();
      /* land on the page the reader was already looking at */
      if (current) goTo(current, false);
      showChrome();
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

  var resync = null;
  new MutationObserver(function () {
    clearTimeout(resync);
    resync = setTimeout(sync, 140);
  }).observe(main, { childList: true });

  /* flipping the setting rewrites the root attribute; follow it */
  new MutationObserver(function () { sync(); })
    .observe(root, { attributes: true, attributeFilter: ['data-flip', 'data-mode'] });

  window.addEventListener('resize', function () {
    if (isFlip() && current) goTo(current, false);
    paint();
  });

  sync();
  setTimeout(sync, 500);
})();
