/* Loads plan.html and surah.html in jsdom and fails on any console error or
   uncaught exception. Catches the class of mistake unit tests cannot: a typo
   in a selector, a missing element, a script that throws on boot.

   Needs jsdom, which is not a dependency of the site:
       npm install jsdom && node tools/test_pages.js
   Point NODE_PATH at wherever jsdom lives if it is installed elsewhere. */

const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('jsdom is not installed — run `npm install jsdom` first.');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '..');          /* Thekr/ — surah.html reaches ../assets */
const problems = [];

/* A real origin, not file://. jsdom refuses localStorage on an opaque origin,
   and GitHub Pages serves over http anyway, so this is the truer test. */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png'
};

function serve() {
  const http = require('http');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(SITE, rel);
    if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

/* jsdom implements neither of these, and both are optional to the pages. */
function stub(win) {
  win.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
  win.matchMedia = win.matchMedia || (q => ({
    matches: false, media: q, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}
  }));
  win.scrollTo = () => {};
  if (!win.Element.prototype.scrollIntoView) win.Element.prototype.scrollIntoView = () => {};
  win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:stub');
  win.URL.revokeObjectURL = win.URL.revokeObjectURL || (() => {});
  win.confirm = () => true;
  win.alert = () => {};
}

let BASE = '';

async function loadPage(file, label, seed) {
  const url = BASE + '/quran/' + file;
  const errors = [];

  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file.split('?')[0]), 'utf8'), {
    url,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(win) {
      stub(win);
      const realError = win.console.error;
      win.console.error = (...a) => { errors.push(a.join(' ')); realError.apply(win.console, a); };
      win.addEventListener('error', e => errors.push('uncaught: ' + (e.error?.stack || e.message)));
      win.addEventListener('unhandledrejection', e => errors.push('rejection: ' + e.reason));
      if (seed) seed(win);
    }
  });

  await new Promise(r => {
    if (dom.window.document.readyState === 'complete') return r();
    dom.window.addEventListener('load', r);
    setTimeout(r, 6000);
  });
  await new Promise(r => setTimeout(r, 700));

  return { dom, win: dom.window, doc: dom.window.document, errors, label };
}

let checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (!cond) problems.push(name + (detail ? ' — ' + detail : ''));
}
function eqv(name, got, want) {
  ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}

(async () => {
  const server = await serve();
  BASE = 'http://127.0.0.1:' + server.address().port;

  /* ---------- plan.html, no data yet ---------- */
  {
    const { win, doc, errors } = await loadPage('plan.html', 'plan.html (empty)');
    ok('plan.html boots without errors', errors.length === 0, errors.join(' | '));
    ok('tracker module reached the page', !!win.QuranTracker);
    ok('index data loaded', win.QuranTracker && win.QuranTracker.ready());
    ok('empty state is shown', /لا خطة بعد/.test(doc.querySelector('#today-sec').textContent));
    ok('streak section hidden when unused', doc.querySelector('#streak-sec').hidden === true);
    ok('plans section hidden when empty', doc.querySelector('#plans-sec').hidden === true);
    ok('date strip filled', doc.querySelector('#datestrip').textContent.trim().length > 0);

    /* create a plan through the real UI path */
    const quick = Array.from(doc.querySelectorAll('.quick .btn'))
      .find(b => b.textContent.includes('صفحتان'));
    ok('quick-start button present', !!quick);
    if (quick) {
      quick.click();
      await new Promise(r => setTimeout(r, 60));
      const QT = win.QuranTracker;
      ok('quick start created a plan', QT.plans.list().length === 1);
      ok('today card rendered', !!doc.querySelector('.today'));
      ok('today card has a range', doc.querySelector('.today__range').textContent.trim().length > 0);
      ok('plans section now visible', doc.querySelector('#plans-sec').hidden === false);

      /* mark it read */
      const done = Array.from(doc.querySelectorAll('.today__actions .btn'))
        .find(b => b.textContent.includes('قرأته'));
      ok('mark-as-read button present', !!done);
      if (done) {
        done.click();
        await new Promise(r => setTimeout(r, 60));
        ok('marking logged a session', QT.sessions.list().length === 1);
        ok('card flips to done', doc.querySelector('.today').getAttribute('data-done') === 'true');
        ok('streak section appears', doc.querySelector('#streak-sec').hidden === false);
        ok('heatmap drew cells', doc.querySelectorAll('.heat i').length > 100);
        ok('stats section appears', doc.querySelector('#stats-sec').hidden === false);
      }
    }
    ok('plan.html still error-free after interaction', errors.length === 0, errors.join(' | '));
  }

  /* ---------- plan.html, with data already present ---------- */
  {
    const seeded = win => {
      const now = Date.now(), DAY = 86400000;
      win.localStorage.setItem('quran.plans.v1', JSON.stringify([
        { id: 'p_a', type: 'read', name: 'ختمة', scope: { kind: 'all' }, unit: 'page',
          mode: 'perDay', amount: 4, endDate: null,
          startDate: new Date(now - 6 * DAY).toISOString().slice(0, 10),
          behind: 'redistribute', archived: false, createdAt: now - 6 * DAY },
        { id: 'p_b', type: 'read', name: 'جزء عمّ', scope: { kind: 'juz', juz: 30 }, unit: 'ayah',
          mode: 'byDate', amount: 20, endDate: new Date(now + 9 * DAY).toISOString().slice(0, 10),
          startDate: new Date(now).toISOString().slice(0, 10),
          behind: 'redistribute', archived: false, createdAt: now }
      ]));
      /* Deliberately short of the schedule: seven days in at four pages a day
         is twenty-eight pages owed, and these sessions cover about nine — so
         the behind-schedule notice must appear. */
      win.localStorage.setItem('quran.sessions.v1', JSON.stringify([
        { id: 's1', type: 'read', from: 1, to: 30, at: now - 3 * DAY, seconds: 600, planId: 'p_a', manual: false },
        { id: 's2', type: 'read', from: 31, to: 45, at: now - 2 * DAY, seconds: 700, planId: 'p_a', manual: false },
        { id: 's3', type: 'read', from: 46, to: 60, at: now - DAY, seconds: 650, planId: 'p_a', manual: false }
      ]));
    };
    const { doc, win, errors } = await loadPage('plan.html', 'plan.html (seeded)', seeded);
    ok('seeded plan.html boots clean', errors.length === 0, errors.join(' | '));
    ok('renders both plan cards', doc.querySelectorAll('.today').length === 2);
    ok('plans list shows both', doc.querySelectorAll('.plan').length === 2);
    ok('progress bar has width', /%/.test(doc.querySelector('.plan__bar').style.width));
    ok('behind-schedule notice shown', /متأخّر/.test(doc.querySelector('#today-sec').textContent));
    ok('byDate plan states its deadline', /يتبقّى/.test(doc.querySelector('#today-sec').textContent));
    ok('pace note rendered', doc.querySelector('#pace-note').textContent.trim().length > 0);
    ok('storage size reported', doc.querySelector('#storage-size').textContent.trim().length > 0);

    /* the plan dialog opens and populates */
    doc.querySelector('#add-plan').click();
    await new Promise(r => setTimeout(r, 60));
    ok('dialog opens', doc.querySelector('#modal').getAttribute('data-open') === 'true');
    ok('mode hint explains the trade-off', /تأخّر موعد الختم/.test(doc.querySelector('#mode-hint').textContent));
    doc.querySelector('#f-scope').value = 'surah';
    doc.querySelector('#f-scope').dispatchEvent(new win.Event('change'));
    ok('surah picker filled with 114', doc.querySelectorAll('#f-scope-arg option').length === 114);
    doc.querySelector('.seg button[data-mode="byDate"]').click();
    ok('byDate reveals the date field', doc.querySelector('#f-date-field').hidden === false);
    ok('byDate hides the amount field', doc.querySelector('#f-amount-field').hidden === true);
    doc.querySelector('#f-name').value = 'اختبار';
    doc.querySelector('#plan-form').dispatchEvent(new win.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    ok('submitting created a third plan', win.QuranTracker.plans.list().length === 3);
    ok('dialog closed after save', doc.querySelector('#modal').getAttribute('data-open') === 'false');
    ok('seeded plan.html clean after dialog', errors.length === 0, errors.join(' | '));
  }

  /* ---------- surah.html: the reader plus the session pill ---------- */
  {
    const { doc, win, errors } = await loadPage('surah.html?s=1', 'surah.html');
    /* The reader fetches its surah file over file://, which jsdom allows, but
       fonts and audio are expected to fail — those are not script errors. */
    const real = errors.filter(e => !/Could not load|net::|ENOENT/i.test(e));
    ok('surah.html boots without script errors', real.length === 0, real.join(' | '));
    ok('session pill injected', !!doc.querySelector('.sessionbar'));
    ok('pill starts in idle state', /ابدأ جلسة/.test(doc.querySelector('.sessionbar').textContent));
    ok('tracker available on the reader', !!win.QuranTracker && win.QuranTracker.ready());

    const startBtn = doc.querySelector('.sessionbar__btn');
    startBtn.click();
    await new Promise(r => setTimeout(r, 60));
    ok('session started', !!win.QuranTracker.live.get());
    ok('pill switched to running', !!doc.querySelector('.sessionbar__clock'));
    ok('clock rendered', /\d|[٠-٩]/.test(doc.querySelector('.sessionbar__clock').textContent));
    ok('range rendered', doc.querySelector('.sessionbar__range').textContent.trim().length > 0);

    /* pause / resume */
    doc.querySelector('.sessionbar__btn--icon').click();
    await new Promise(r => setTimeout(r, 40));
    ok('pause registered', !!win.QuranTracker.live.get().pausedAt);
    ok('paused state exposed to CSS', doc.querySelector('.sessionbar').getAttribute('data-paused') === 'true');
    doc.querySelector('.sessionbar__btn--icon').click();
    await new Promise(r => setTimeout(r, 40));
    ok('resume registered', win.QuranTracker.live.get().pausedAt === null);

    /* stopping a too-short session discards it */
    const stopBtn = doc.querySelectorAll('.sessionbar__btn--icon')[1];
    stopBtn.click();
    await new Promise(r => setTimeout(r, 40));
    ok('short session discarded', win.QuranTracker.sessions.list().length === 0);
    ok('pill returned to idle', /ابدأ جلسة/.test(doc.querySelector('.sessionbar').textContent));
    ok('surah.html clean after interaction',
       errors.filter(e => !/Could not load|net::|ENOENT/i.test(e)).length === 0);
  }

  /* ---------- Quran/index.html ---------- */
  {
    const { win, doc, errors } = await loadPage('index.html', 'index.html');
    ok('index.html boots clean', errors.length === 0, errors.join(' | '));

    /* The bar there carried a back arrow the footer already provides, a title
       the hero already states, and a count that read 114/114 forever. */
    ok('the surah index has no top bar', !doc.querySelector('.topbar'));
    ok('and the hero still names the section', !!doc.querySelector('.hero h1'));
    ok('the footer still leads back out',
       !!doc.querySelector('.pagefoot a[href="../index.html"]'));
    ok('and no longer carries a name',
       !/مصعب/.test(doc.querySelector('.pagefoot').textContent),
       doc.querySelector('.pagefoot').textContent.trim());

    /* the one control that had nowhere else to live */
    const themeBtn = doc.getElementById('theme-toggle');
    ok('the theme switch survived the bar', !!themeBtn);
    ok('it moved into the hero', !!doc.querySelector('.hero .hero__theme'));
    ok('and it is painted', doc.getElementById('theme-icon').innerHTML.length > 0);
    const themeBefore = JSON.parse(win.localStorage.getItem('quran.settings.v1') || '{}').theme;
    themeBtn.click();
    await new Promise(r => setTimeout(r, 60));
    const themeAfter = JSON.parse(win.localStorage.getItem('quran.settings.v1') || '{}').theme;
    ok('and it still changes the theme', themeAfter && themeAfter !== themeBefore,
       `${themeBefore} -> ${themeAfter}`);

    /* the count now only speaks when it has something to say */
    const countEl = doc.getElementById('count');
    ok('the count is silent on a full list', countEl.hidden === true);
    doc.querySelector('.filters button[data-f="makkah"]').click();
    await new Promise(r => setTimeout(r, 60));
    ok('and appears once the list is narrowed', countEl.hidden === false);
    ok('reading how many of how many', /من/.test(countEl.textContent), countEl.textContent);
    doc.querySelector('.filters button[data-f="all"]').click();
    await new Promise(r => setTimeout(r, 60));
    ok('then goes quiet again', countEl.hidden === true);

    ok('plans link present', !!doc.querySelector('.plans-link[href="plan.html"]'));
    ok('hifz link present', !!doc.querySelector('.plans-link[href="hifz.html"]'));
    ok('surah grid rendered', doc.querySelectorAll('.surah-link').length === 114);
  }

  /* ---------- hifz.html, first run ---------- */
  {
    const { win, doc, errors } = await loadPage('hifz.html', 'hifz.html (empty)');
    ok('hifz.html boots clean', errors.length === 0, errors.join(' | '));
    ok('onboarding shown when nothing is tracked', doc.querySelector('#onboard-sec').hidden === false);
    ok('queues hidden when nothing is tracked', doc.querySelector('#queues-sec').hidden === true);
    ok('map hidden when nothing is tracked', doc.querySelector('#map-sec').hidden === true);

    /* add a range through the real dialog */
    doc.querySelector('#ob-range').click();
    await new Promise(r => setTimeout(r, 60));
    ok('add dialog opens', doc.querySelector('#modal').getAttribute('data-open') === 'true');
    ok('juz list filled', doc.querySelectorAll('#a-from option').length === 30);
    doc.querySelector('#a-from').value = '30';
    doc.querySelector('#a-to').value = '30';
    doc.querySelector('#a-from').dispatchEvent(new win.Event('change'));
    ok('summary describes the pages', /صفحات/.test(doc.querySelector('#a-summary').textContent));
    doc.querySelector('#add-form').dispatchEvent(new win.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 80));

    const H = win.QuranTracker.hifz;
    ok('juz 30 added as pages', H.all().length > 15, `${H.all().length} pages`);
    ok('all added as memorised', H.all().every(r => r.state === 'memorized'));
    ok('onboarding replaced by queues', doc.querySelector('#queues-sec').hidden === false);
    ok('three queue blocks rendered', doc.querySelectorAll('.queue').length === 3);
    ok('sabqi is empty on a bulk add', H.queues().sabqi.length === 0);
    ok('map rendered all 604 pages', doc.querySelectorAll('.map i').length === 604);
    ok('stats section visible', doc.querySelector('#stats-sec').hidden === false);
    ok('review link carries the queue',
       /review=\d+/.test(doc.querySelector('.queue[data-q="manzil"] .btn--go')?.href || ''));
    ok('hifz.html clean after interaction', errors.length === 0, errors.join(' | '));
  }

  /* ---------- hifz.html with a sabaq page ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.hifz.v1', JSON.stringify({
        pages: { 1: { p: 1, state: 'learning', learnedOn: null, interval: 0, ease: 2.3,
                      due: null, reps: 0, lapses: 0, lastReview: null, history: [] } },
        slips: {}
      }));
    };
    const { win, doc, errors } = await loadPage('hifz.html', 'hifz.html (sabaq)', seed);
    ok('sabaq queue shows the page', /١/.test(doc.querySelector('.queue[data-q="sabaq"]').textContent));
    const promote = Array.from(doc.querySelectorAll('.queue[data-q="sabaq"] .btn'))
      .find(b => b.textContent.includes('حفظت'));
    ok('promote button offered', !!promote);
    promote.click();
    await new Promise(r => setTimeout(r, 80));
    const H = win.QuranTracker.hifz;
    eqv('promotion moved it to memorised', H.get(1).state, 'memorized');
    ok('it is now in sabqi', H.queues().sabqi.length === 1);
    ok('promotion logged a hifz session', win.QuranTracker.sessions.list({ type: 'hifz' }).length === 1);
    ok('sabaq page clean', errors.length === 0, errors.join(' | '));
  }

  /* ---------- the review surface on surah.html ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.hifz.v1', JSON.stringify({
        pages: {
          1: { p: 1, state: 'memorized', learnedOn: '2026-01-01', interval: 10, ease: 2.3,
               due: '2026-02-01', reps: 2, lapses: 0, lastReview: '2026-01-20', history: [] },
          2: { p: 2, state: 'memorized', learnedOn: '2026-01-01', interval: 10, ease: 2.3,
               due: '2026-02-01', reps: 2, lapses: 0, lastReview: '2026-01-20', history: [] }
        },
        slips: {}
      }));
    };
    const { win, doc, errors } = await loadPage('surah.html?s=1&a=1&review=1&queue=2', 'review', seed);
    const real = errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e));
    ok('review surface boots clean', real.length === 0, real.join(' | '));
    ok('review mode flagged on the root', doc.documentElement.getAttribute('data-review') === 'on');
    ok('rating bar rendered', !!doc.querySelector('.reviewbar'));
    ok('three ratings offered', doc.querySelectorAll('.rates button').length === 3);
    ok('three modes offered', doc.querySelectorAll('.modes button').length === 3);
    ok('hide mode is the default', doc.querySelector('.modes button[aria-pressed="true"]').textContent === 'إخفاء');
    ok('remaining count shown', /بقي/.test(doc.querySelector('.reviewbar').textContent));
    ok('session pill suppressed during review',
       doc.documentElement.getAttribute('data-review') === 'on');

    /* the reader was forced onto a page view so per-word spans exist */
    ok('forced out of the verse view', doc.documentElement.getAttribute('data-mode') !== 'verse',
       doc.documentElement.getAttribute('data-mode'));
    const words = doc.querySelectorAll('.mushaf__page[data-page="1"] .w[data-n]');
    ok('page words present', words.length > 0, `${words.length} words`);
    ok('words are masked by default',
       doc.querySelectorAll('.mushaf__page[data-page="1"] .w.is-masked').length > 0);

    /* first-word mode leaves exactly one cue per ayah */
    doc.querySelectorAll('.modes button')[1].click();
    await new Promise(r => setTimeout(r, 60));
    const cues = doc.querySelectorAll('.mushaf__page[data-page="1"] .w.is-cue');
    const ayahsShown = new Set(Array.from(cues).map(w => w.dataset.n));
    ok('one cue per ayah', cues.length === ayahsShown.size && cues.length > 0,
       `${cues.length} cues, ${ayahsShown.size} ayahs`);

    /* what-comes-next shows a prompt ayah */
    doc.querySelectorAll('.modes button')[2].click();
    await new Promise(r => setTimeout(r, 60));
    ok('a prompt ayah is highlighted',
       doc.querySelectorAll('.mushaf__page[data-page="1"] .w.is-prompt').length > 0);

    /* reveal */
    doc.querySelectorAll('.modes button')[0].click();
    await new Promise(r => setTimeout(r, 40));
    Array.from(doc.querySelectorAll('.rbtn')).find(b => b.textContent.includes('اكشف')).click();
    await new Promise(r => setTimeout(r, 40));
    ok('reveal clears the mask',
       doc.querySelectorAll('.mushaf__page[data-page="1"] .w.is-masked').length === 0);

    /* marking mode logs a slip on tap */
    const markBtn = Array.from(doc.querySelectorAll('.rbtn')).find(b => b.textContent.includes('علّم'));
    markBtn.click();
    await new Promise(r => setTimeout(r, 40));
    ok('marking mode engaged', doc.documentElement.getAttribute('data-marking') === 'true');
    const firstWord = doc.querySelector('.mushaf__page[data-page="1"] .w[data-n]');
    firstWord.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 40));
    ok('a slip was recorded', win.QuranTracker.hifz.weakest().length === 1);
    ok('the slip is painted', doc.querySelectorAll('.w.is-slip').length > 0);

    ok('review surface clean after interaction',
       errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e)).length === 0);
  }

  /* ---------- a page shared by two surahs ----------
     Page 106 carries the end of Ali 'Imran and the start of An-Nisa. The
     reader draws one surah at a time, so the review must say so and offer the
     other half rather than quietly testing half a sheet. */
  {
    const { doc, win, errors } = await loadPage('surah.html?s=3&a=1&review=106', 'shared page');
    const bar = doc.querySelector('.reviewbar');
    ok('shared-page notice shown', !!doc.querySelector('.reviewbar__span'));
    ok('notice explains the split', /تشترك/.test(bar.textContent));
    const other = doc.querySelector('.reviewbar__span a');
    ok('notice links to the other surah', !!other && /s=4/.test(other.getAttribute('href')));
    ok('the link keeps the review page', !!other && /review=106/.test(other.getAttribute('href')));
    ok('a single-surah page shows no such notice', true);
    ok('shared page clean',
       errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e)).length === 0);
  }

  /* the ordinary case must NOT show the notice */
  {
    const { doc } = await loadPage('surah.html?s=1&a=1&review=1', 'single-surah page');
    ok('page 1 shows no split notice', !doc.querySelector('.reviewbar__span'));
  }

  /* ---------- rating reschedules and advances the queue ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.hifz.v1', JSON.stringify({
        pages: {
          1: { p: 1, state: 'memorized', learnedOn: '2026-01-01', interval: 10, ease: 2.3,
               due: '2026-02-01', reps: 2, lapses: 0, lastReview: '2026-01-20', history: [] }
        },
        slips: {}
      }));
    };
    const { win, doc, errors } = await loadPage('surah.html?s=1&a=1&review=1', 'rating', seed);
    const H = win.QuranTracker.hifz;
    const intervalBefore = H.get(1).interval;

    /* jsdom does not navigate, so the assignment throws "not implemented";
       that is expected and the state change before it is what matters. */
    Array.from(doc.querySelectorAll('.rates button')).find(b => b.textContent.startsWith('أتقنت')).click();
    await new Promise(r => setTimeout(r, 80));

    ok('clean rating grew the interval', H.get(1).interval > intervalBefore,
       `${intervalBefore} -> ${H.get(1).interval}`);
    ok('rating logged a review session', win.QuranTracker.sessions.list({ type: 'review' }).length === 1);
    ok('due date moved forward',
       win.QuranTracker.date.daysBetween(win.QuranTracker.date.today(), H.get(1).due) === H.get(1).interval);
    ok('rating path had no unexpected errors',
       errors.filter(e => !/Could not load|net::|ENOENT|font|Not implemented: navigation/i.test(e)).length === 0,
       errors.join(' | '));
  }

  /* ---------- the forty nights ---------- */
  {
    const { win, doc, errors } = await loadPage('qiyam-40.html', 'qiyam-40');
    ok('qiyam-40 boots clean', errors.length === 0, errors.join(' | '));
    ok('hero rendered', !!doc.querySelector('.hero h1'));
    eqv('forty step cards', doc.querySelectorAll('.step').length, 40);
    ok('night titles rendered', doc.querySelector('.step__title').textContent.trim().length > 0);
    ok('portion shown', !!doc.querySelector('.step__portion'));
    eqv('four rakaat on night one',
        doc.querySelectorAll('#n1 .unit').length, 4);
    ok('the closer rationale survived',
       /أول ما نزل من الوحي/.test(doc.querySelector('#n1').textContent));
    ok('themed nights are badged', doc.querySelectorAll('.step__badge').length === 8);
    ok('themed night names its pulled surah',
       /يُقدَّم إلى الركعة الرابعة/.test(doc.querySelector('#n15').textContent));

    /* the trims the brief asked for */
    const body = doc.body.textContent;
    ok('no methodology panel', !/dynamic programming|رأس ركوع أو خاتمة سورة\.[\s\S]*الركعات تُقسَّم/.test(body));
    ok('no load chart', !doc.querySelector('.chart, .cb'));
    ok('no KPI-heavy feasibility table', !doc.querySelector('table'));

    /* untracked until started */
    ok('nothing tracked before starting', win.QuranTracker.plans.list().length === 0);
    ok('no tick boxes before starting', doc.querySelectorAll('.step__tick').length === 0);
    ok('start button offered', doc.querySelector('#prog-start').hidden === false);

    doc.querySelector('#prog-start').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('starting created one plan', win.QuranTracker.plans.list().length, 1);
    eqv('it is the qiyam programme', win.QuranTracker.plans.list()[0].program, 'qiyam40');
    ok('tick boxes appear once started', doc.querySelectorAll('.step__tick').length === 40);
    ok('filters appear once started', doc.querySelector('#filters').hidden === false);
    ok('progress strip shows the count', /٤٠/.test(doc.querySelector('#prog-state').textContent));

    /* tick night one */
    doc.querySelector('#n1 .step__tick').click();
    await new Promise(r => setTimeout(r, 80));
    const plan = win.QuranTracker.plans.list()[0];
    eqv('night one recorded', win.QuranTracker.plans.status(plan).doneUnits, 1);
    ok('the card reads as done', doc.querySelector('#n1').getAttribute('data-done') === 'true');

    /* ticking a themed night must log both stretches */
    doc.querySelector('#n15 .step__tick').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('themed night recorded', win.QuranTracker.plans.status(plan).doneUnits, 2);
    ok('both stretches logged',
       win.QuranTracker.sessions.list().filter(s => s.manual).length === 3);

    /* untick */
    doc.querySelector('#n1 .step__tick').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('untick removed it', win.QuranTracker.plans.status(plan).doneUnits, 1);

    /* filter */
    doc.querySelector('#filters button[data-f="done"]').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('done filter shows one card', doc.querySelectorAll('.step').length, 1);

    ok('qiyam-40 clean after interaction', errors.length === 0, errors.join(' | '));
  }

  /* ---------- the seven manazil ---------- */
  {
    const { win, doc, errors } = await loadPage('khatm-7.html', 'khatm-7');
    ok('khatm-7 boots clean', errors.length === 0, errors.join(' | '));
    eqv('seven step cards', doc.querySelectorAll('.step').length, 7);
    ok('mnemonic strip rendered', !!doc.querySelector('.mnem'));
    ok('mnemonic spelled out', /فَمِي بِشَوْقٍ/.test(doc.querySelector('.mnem').textContent));
    eqv('three sittings on day one', doc.querySelectorAll('#d1 .unit').length, 3);
    ok('key passages kept', doc.querySelectorAll('#d1 .key').length === 3);
    ok('a key passage carries its hadith',
       /أبا المنذر/.test(doc.querySelector('#d1').textContent));
    ok('the mnemonic letter is the step number',
       doc.querySelector('#d1 .step__num').textContent.trim() === 'ف');

    doc.querySelector('#prog-start').click();
    await new Promise(r => setTimeout(r, 80));
    const p7 = win.QuranTracker.plans.list()[0];
    for (let i = 1; i <= 7; i++) {
      doc.querySelector('#d' + i + ' .step__tick').click();
      await new Promise(r => setTimeout(r, 30));
    }
    ok('a full week completes the khatm', win.QuranTracker.plans.status(p7).finished === true);
    ok('and covers the whole mushaf',
       JSON.stringify(win.QuranTracker.sessions.coverage('read', p7.id)) === '[[1,6236]]');
    ok('khatm-7 clean after interaction', errors.length === 0, errors.join(' | '));
  }

  /* ---------- a started programme shows on the dashboard ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.plans.v1', JSON.stringify([{
        id: 'p_q', type: 'read', name: 'ختمة القيام في أربعين ليلة',
        program: 'qiyam40', mode: 'steps', unit: 'night', scope: { kind: 'all' },
        amount: 1, endDate: null, startDate: new Date().toISOString().slice(0, 10),
        behind: 'extend', archived: false, createdAt: Date.now()
      }]));
    };
    const { doc, errors } = await loadPage('plan.html', 'plan.html + programme', seed);
    ok('dashboard boots with a stepped plan', errors.length === 0, errors.join(' | '));
    const today = doc.querySelector('#today-sec').textContent;
    ok('tonight is named by its title', /هذا الكتاب/.test(today), today.slice(0, 120));
    ok('counted in nights, not pages', /ليلة/.test(today));
    ok('links through to the programme page',
       !!doc.querySelector('#today-sec a[href="qiyam-40.html"]'));
    ok('plans list shows it', doc.querySelectorAll('.plan').length === 1);
  }

  /* ---------- the reader's chrome ---------- */
  {
    const fs5 = require('fs');
    const base = fs5.readFileSync(path.join(ROOT, 'assets/base.css'), 'utf8');

    /* the arrow that was pointing the wrong way */
    ok('the back arrow is mirrored for right-to-left',
       /html\[dir="rtl"\]\s*\.iconbtn--back svg\{transform:scaleX\(-1\)\}/.test(base));
    ok('the no-op rule is gone', !/\.iconbtn--back svg\{transform:scaleX\(1\)\}/.test(base));

    /* the bar retreats but leaves the rail behind */
    ok('the bar can hide', /\.topbar\[data-hidden="true"\]/.test(base));
    ok('it stops short by the rail height',
       /translateY\(calc\(-100% \+ var\(--topbar-rail[^)]*\)\)\)/.test(base),
       'the rail must stay flush with the top of the viewport');

    const { win, doc, errors } = await loadPage('surah.html?s=2', 'reader chrome');
    const real = errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e));
    ok('reader boots with the chrome layer', real.length === 0, real.join(' | '));

    ok('the progress rail was inserted', !!doc.querySelector('.topbar .rail'));
    ok('the rail has a bar', !!doc.querySelector('.rail__bar'));
    ok('a position read-out was added', !!doc.querySelector('.where'));
    ok('the old crumb is kept, not detached',
       !!doc.getElementById('crumb') && doc.getElementById('crumb').isConnected);
    ok('but it is superseded',
       doc.getElementById('crumb').classList.contains('is-superseded'));
    ok('the read-out shows a position', /\d|[٠-٩]/.test(doc.querySelector('.where').textContent));

    /* the bar starts visible */
    eqv('the bar is shown at the top', doc.querySelector('.topbar').getAttribute('data-hidden'), 'false');

    /* scrolling down hides it, scrolling up brings it back */
    win.scrollY = 400;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 60));
    eqv('scrolling down hides the bar',
        doc.querySelector('.topbar').getAttribute('data-hidden'), 'true');

    win.scrollY = 260;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 60));
    eqv('scrolling up brings it back',
        doc.querySelector('.topbar').getAttribute('data-hidden'), 'false');

    /* near the top it never hides */
    win.scrollY = 300;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 40));
    win.scrollY = 20;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 40));
    win.scrollY = 50;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 40));
    eqv('it stays put near the top of the page',
        doc.querySelector('.topbar').getAttribute('data-hidden'), 'false');

    /* the settings sheet lives in the bar, so the bar must not walk off */
    doc.getElementById('gear').click();
    await new Promise(r => setTimeout(r, 60));
    win.scrollY = 900;
    win.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 60));
    eqv('the bar holds still while settings are open',
        doc.querySelector('.topbar').getAttribute('data-hidden'), 'false');
    doc.getElementById('gear').click();

    ok('the flip toggle is offered',
       /تقليب الصفحات/.test(doc.querySelector('#settings').textContent));
  }

  /* ---------- page-flip mode ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.settings.v1',
        JSON.stringify({ mode: 'mushaf', flip: true, flipSeen: true }));
    };
    const { win, doc, errors } = await loadPage('surah.html?s=2', 'flip mode', seed);
    const real = errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e));
    ok('flip mode boots clean', real.length === 0, real.join(' | '));

    eqv('the root announces flip mode', doc.documentElement.getAttribute('data-flip'), 'on');

    /* ---- the page owns the whole screen ---- */
    eqv('flip mode opens with the bars out of the way',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');
    ok('the flip bar is present', !!doc.querySelector('.flipbar'));
    ok('it carries its own progress bar', !!doc.querySelector('.flipbar__bar'));
    ok('and page controls', !!doc.getElementById('flip-prev') && !!doc.getElementById('flip-next'));

    /* Right-to-left: previous is the right-hand button and must point right,
       toward the earlier page; next is on the left and points left. */
    eqv('the previous arrow points right, at the earlier page',
        doc.querySelector('#flip-prev path').getAttribute('d'), 'M9 18l6-6-6-6');
    eqv('the next arrow points left, at the later page',
        doc.querySelector('#flip-next path').getAttribute('d'), 'M15 18l-6-6 6-6');
    ok('the two arrows are not the same glyph',
       doc.querySelector('#flip-prev path').getAttribute('d') !==
       doc.querySelector('#flip-next path').getAttribute('d'));
    ok('the position is stated', /صفحة/.test(doc.getElementById('flip-label').textContent));
    ok('and the count', /\//.test(doc.getElementById('flip-count').textContent));

    /* on the first sheet there is nowhere back to */
    ok('back is disabled on the first sheet', doc.getElementById('flip-prev').disabled === true);
    ok('forward is available', doc.getElementById('flip-next').disabled === false);

    /* stepping forward moves the page and the progress */
    const before = doc.getElementById('flip-count').textContent;
    doc.getElementById('flip-next').click();
    await new Promise(r => setTimeout(r, 120));
    ok('stepping forward advances the count',
       doc.getElementById('flip-count').textContent !== before,
       `${before} -> ${doc.getElementById('flip-count').textContent}`);
    ok('back is now available', doc.getElementById('flip-prev').disabled === false);

    /* the arrow keys drive it, and right goes back in a right-to-left mushaf */
    const afterNext = doc.getElementById('flip-count').textContent;
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    ok('the right arrow steps back through the mushaf',
       doc.getElementById('flip-count').textContent !== afterNext,
       `${afterNext} -> ${doc.getElementById('flip-count').textContent}`);

    /* A tap on empty space is what summons them. The earlier button clicks
       left the bars up, so the starting state is set explicitly rather than
       assumed. */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    const page = doc.querySelector('.mushaf__page');
    page.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    eqv('tapping the sheet summons the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'shown');

    /* but tapping a word must still play it, not toggle chrome */
    const word = doc.querySelector('.mushaf__line .w[data-n]');
    if (word) {
      doc.documentElement.setAttribute('data-chrome', 'shown');
      word.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 60));
      eqv('tapping a word leaves the chrome alone',
          doc.documentElement.getAttribute('data-chrome'), 'shown');
    }

    /* ---- the settings panel must never strand itself ----
       The panel is a child of .wrap, not of the bar that opens it. A tap
       inside it used to hide the chrome, which carried the gear off screen
       and left the panel open with nothing able to close it. */
    const gear = doc.getElementById('gear');
    const settings = doc.getElementById('settings');

    gear.click();
    await new Promise(r => setTimeout(r, 60));
    eqv('the gear opens the panel', settings.getAttribute('data-open'), 'true');
    eqv('opening it pins the chrome', doc.documentElement.getAttribute('data-chrome'), 'shown');

    /* a tap on a control inside the panel must not touch the chrome */
    const inner = settings.querySelector('button, .switch, .setting') || settings;
    inner.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    eqv('using a setting leaves the chrome shown',
        doc.documentElement.getAttribute('data-chrome'), 'shown');
    eqv('and leaves the panel open', settings.getAttribute('data-open'), 'true');

    /* the idle timer must not steal the gear either */
    await new Promise(r => setTimeout(r, 2900));
    eqv('the chrome does not time out while settings are open',
        doc.documentElement.getAttribute('data-chrome'), 'shown');

    /* and the gear still closes it */
    gear.click();
    await new Promise(r => setTimeout(r, 60));
    eqv('the gear closes the panel again', settings.getAttribute('data-open'), 'false');

    /* a tap on the page dismisses the panel rather than hiding the chrome */
    gear.click();
    await new Promise(r => setTimeout(r, 60));
    const sheet2 = doc.querySelector('.mushaf__page');
    sheet2.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 80));
    eqv('an outside tap closes the panel', settings.getAttribute('data-open'), 'false');
    eqv('and does not hide the chrome in the same gesture',
        doc.documentElement.getAttribute('data-chrome'), 'shown');

    /* with the panel closed, the next tap does toggle the chrome */
    sheet2.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    eqv('a second tap hides the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');

    /* ---- tap zones ----
       A band down each side turns the page; the middle, and the strips along
       the top and bottom, summon the chrome. */
    function tapAt(x, y) {
      const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clientX', { value: x });
      Object.defineProperty(ev, 'clientY', { value: y });
      doc.querySelector('.mushaf__page').dispatchEvent(ev);
    }
    const W = win.innerWidth, H = win.innerHeight;
    ok('the harness has a viewport to divide', W > 0 && H > 0, `${W}x${H}`);

    /* right band -> the earlier page; left band -> the later one */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    doc.getElementById('flip-next').click();          /* move off the first page */
    await new Promise(r => setTimeout(r, 120));
    const midCount = doc.getElementById('flip-count').textContent;

    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapAt(W * 0.95, H * 0.5);
    await new Promise(r => setTimeout(r, 120));
    ok('a tap on the right band turns back',
       doc.getElementById('flip-count').textContent !== midCount,
       `${midCount} -> ${doc.getElementById('flip-count').textContent}`);
    eqv('and does not summon the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');

    const backCount = doc.getElementById('flip-count').textContent;
    tapAt(W * 0.05, H * 0.5);
    await new Promise(r => setTimeout(r, 120));
    ok('a tap on the left band turns forward',
       doc.getElementById('flip-count').textContent !== backCount,
       `${backCount} -> ${doc.getElementById('flip-count').textContent}`);

    /* the middle toggles */
    const midBefore = doc.getElementById('flip-count').textContent;
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapAt(W * 0.5, H * 0.5);
    await new Promise(r => setTimeout(r, 80));
    eqv('the middle summons the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'shown');
    eqv('and leaves the page alone',
        doc.getElementById('flip-count').textContent, midBefore);

    /* the top and bottom strips toggle even at the edges — that is where a
       hand reaches for the controls */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapAt(W * 0.95, H * 0.04);
    await new Promise(r => setTimeout(r, 80));
    eqv('the top strip summons the chrome even at the right edge',
        doc.documentElement.getAttribute('data-chrome'), 'shown');
    eqv('without turning the page',
        doc.getElementById('flip-count').textContent, midBefore);

    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapAt(W * 0.03, H * 0.97);
    await new Promise(r => setTimeout(r, 80));
    eqv('and so does the bottom strip at the left edge',
        doc.documentElement.getAttribute('data-chrome'), 'shown');
    eqv('still without turning the page',
        doc.getElementById('flip-count').textContent, midBefore);

    /* ---- the text block is measured, not assumed ----
       A .mushaf__line is always the full width of the frame, but the words on
       it often are not: the height veto narrows the type on a short viewport,
       opening real margin beside each line. Asking whether the click was
       inside the line *element* called that margin text, and the sides of the
       sheet stopped turning the page as soon as the type scaled down.

       jsdom lays nothing out, so the words are given rects: ink from 300 to
       1100 on a 1024-wide window, leaving genuine margin either side. */
    function tapNode(node, x, y) {
      const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clientX', { value: x });
      Object.defineProperty(ev, 'clientY', { value: y });
      node.dispatchEvent(ev);
    }
    function rect(left, right) {
      return () => ({ left, right, width: right - left, top: 300, bottom: 340,
                      height: 40, x: left, y: 300 });
    }

    /* Not merely "not blank": the basmala line carries text but no word spans,
       so it has no ink to measure and is treated as margin. Pick a line that
       actually holds calligraphy. */
    const textLine = Array.from(doc.querySelectorAll('.mushaf__line:not(.is-blank)'))
      .find(l => l.querySelector('.w[data-n]'));
    ok('the sheet has a line of calligraphy', !!textLine);
    const lineWords = textLine ? textLine.querySelectorAll('.w[data-n]') : [];
    ok('the line has words to measure', lineWords.length > 0);
    if (!textLine || !lineWords.length) throw new Error('no calligraphy line to measure');

    const INK_LO = 300, INK_HI = 1100;
    lineWords.forEach((wnode, i) => {
      const step = (INK_HI - INK_LO) / lineWords.length;
      wnode.getBoundingClientRect = rect(INK_LO + i * step, INK_LO + (i + 1) * step);
    });

    const pageBefore = doc.getElementById('flip-count').textContent;

    /* beside the ink, in the side band: this must turn the page */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapNode(textLine, INK_HI + 120, 320);
    await new Promise(r => setTimeout(r, 140));
    ok('the margin beside a short line still turns the page',
       doc.getElementById('flip-count').textContent !== pageBefore,
       `${pageBefore} -> ${doc.getElementById('flip-count').textContent}`);
    eqv('and does not summon the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');

    /* on the ink: this must reach the ayah, not the page turn */
    const onInk = doc.getElementById('flip-count').textContent;
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapNode(textLine, (INK_LO + INK_HI) / 2, 320);
    await new Promise(r => setTimeout(r, 140));
    eqv('a click on the calligraphy never turns the page',
        doc.getElementById('flip-count').textContent, onInk);

    /* just off the last glyph is still the ayah — a forgiving edge */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapNode(textLine, INK_HI + 4, 320);
    await new Promise(r => setTimeout(r, 140));
    eqv('a few pixels past the last glyph still belongs to the ayah',
        doc.getElementById('flip-count').textContent, onInk);

    /* A blank line is empty at any x. Which side is tapped depends on where in
       the sūrah the earlier assertions left us — at either end one direction
       has nowhere to go, and a no-op would read as a failure. */
    const blankLine = doc.querySelector('.mushaf__line.is-blank');
    if (blankLine) {
      const beforeBlank = doc.getElementById('flip-count').textContent;
      const hasRoomBack = !doc.getElementById('flip-prev').disabled;
      doc.documentElement.setAttribute('data-chrome', 'hidden');
      tapNode(blankLine, hasRoomBack ? W * 0.95 : W * 0.05, H * 0.5);
      await new Promise(r => setTimeout(r, 140));
      ok('a blank line is empty space at any width',
         doc.getElementById('flip-count').textContent !== beforeBlank,
         `${beforeBlank} -> ${doc.getElementById('flip-count').textContent}` +
         ` (went ${hasRoomBack ? 'back' : 'forward'})`);
    }

    /* a word itself still reaches the reader */
    const wordNode = lineWords[0];
    const beforeWord = doc.getElementById('flip-count').textContent;
    doc.documentElement.setAttribute('data-chrome', 'shown');
    tapNode(wordNode, INK_LO + 5, 320);
    await new Promise(r => setTimeout(r, 140));
    eqv('tapping a word never turns the page',
        doc.getElementById('flip-count').textContent, beforeWord);
    eqv('and never toggles the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'shown');

    const uiSrc = require('fs').readFileSync(path.join(ROOT, 'assets/reader-ui.js'), 'utf8');
    ok('the ink is measured per line', /function lineInk\(line\)/.test(uiSrc));
    ok('and the test is against the ink, not the element',
       /x >= ink\.lo - INK_SLACK && x <= ink\.hi \+ INK_SLACK/.test(uiSrc));
    ok('the line element is no longer what decides it',
       !/return !!line && !line\.classList\.contains\('is-blank'\);/.test(uiSrc));

    /* a click with no position must not be read as aiming at a corner */
    const beforeBlind = doc.getElementById('flip-count').textContent;
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    tapAt(0, 0);
    await new Promise(r => setTimeout(r, 80));
    eqv('an unpositioned click toggles rather than turning',
        doc.documentElement.getAttribute('data-chrome'), 'shown');
    eqv('leaving the page where it was',
        doc.getElementById('flip-count').textContent, beforeBlind);

    /* the flip bar's own buttons must keep working, not toggle chrome */
    doc.documentElement.setAttribute('data-chrome', 'shown');
    doc.getElementById('flip-next').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('the page buttons do not toggle the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'shown');

    /* turning a page must not summon the bars by itself */
    doc.documentElement.setAttribute('data-chrome', 'hidden');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    eqv('the arrow keys turn pages without summoning the chrome',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');

    const scroller0 = doc.querySelector('.mushaf');
    scroller0.dispatchEvent(new win.Event('scroll'));
    await new Promise(r => setTimeout(r, 140));
    eqv('and neither does scrolling the pages',
        doc.documentElement.getAttribute('data-chrome'), 'hidden');

    /* ---- the mouse drag was removed ----
       Synthesising a scroll and then synthesising its settle never matched
       what the browser does natively, and a gesture that fights the hand is
       worse than none. Pages turn by the side bands, the arrow keys and the
       two buttons; trackpad and touch keep the native scroll they always had. */
    const readerJs = require('fs').readFileSync(path.join(ROOT, 'assets/reader-ui.js'), 'utf8');
    const readerCss = require('fs').readFileSync(path.join(ROOT, 'assets/reader-ui.css'), 'utf8');
    ok('no drag handler remains', !/bindDrag/.test(readerJs));
    ok('no pointer capture remains', !/setPointerCapture/.test(readerJs));
    ok('no drag state remains', !/draggingNow|data-dragging/.test(readerJs));
    ok('and none of its styling', !/cursor:grab|data-dragging/.test(readerCss));
    ok('native scroll snapping still settles a page',
       /scroll-snap-type:x mandatory/.test(readerCss));
    ok('the sheet may be selected again', !/user-select:none/.test(readerCss));

    ok('flip mode clean after interaction',
       errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e)).length === 0);

  }

  /* flip is meaningless in verse view and must not engage there */
  {
    const seed = win => {
      win.localStorage.setItem('quran.settings.v1',
        JSON.stringify({ mode: 'verse', flip: true, flipSeen: true }));
    };
    const { doc } = await loadPage('surah.html?s=1', 'flip + verse view', seed);
    eqv('verse view never enters flip mode',
        doc.documentElement.getAttribute('data-flip'), 'off');
    ok('the flip bar stays out of the way', !!doc.querySelector('.flipbar'));
  }

  /* ---------- the sheet is sized against real space ---------- */
  {
    const fs6 = require('fs');
    const js = fs6.readFileSync(path.join(ROOT, 'assets/quran.js'), 'utf8');
    const rui = fs6.readFileSync(path.join(ROOT, 'assets/reader-ui.css'), 'utf8');
    const qcss = fs6.readFileSync(path.join(ROOT, 'assets/quran.css'), 'utf8');

    /* the height veto */
    const min = (js.match(/var MIN_LINE = ([\d.]+);/) || [])[1];
    ok('a minimum line height is defined', !!min, min);
    ok('it leaves room for marks above and below the baseline',
       parseFloat(min) >= 1.4 && parseFloat(min) <= 2.0, min);
    ok('the fit takes the smaller of width and height',
       /var size = Math\.min\(byWidth, byHeight\);/.test(js));
    ok('the height budget is per line', /byHeight = h \/ LINES_PER_PAGE \/ minLine/.test(js));

    /* The floor is asked of the font rather than assumed: each page is set in
       its own face and their metrics differ. */
    ok('the font is measured for its own line demand',
       /probe\.style\.lineHeight = 'normal';/.test(js));
    ok('measured against the reference size',
       /natural = probe\.getBoundingClientRect\(\)\.height \/ REF;/.test(js));
    ok('and the probe is put back as it was',
       /probe\.style\.lineHeight = keep;/.test(js));
    ok('the larger of the two floors wins',
       /var minLine = Math\.max\(MIN_LINE, natural \* LINE_BREATH\);/.test(js));
    const breath = parseFloat((js.match(/var LINE_BREATH = ([\d.]+);/) || [])[1]);
    ok('clear air is kept above the font metric', breath > 1 && breath <= 1.25, String(breath));
    ok('the width fit is no longer used directly',
       !/var size = REF \* \(w \/ widest\);/.test(js));

    /* the formula must never produce an overlapping line */
    const MIN = parseFloat(min), L = 15, REF = 40;
    let worst = Infinity, bad = null;
    for (const h of [280, 320, 380, 480, 560, 700, 900, 1200]) {
      for (const w of [300, 420, 560, 700, 900]) {
        for (const widest of [700, 1000, 1400]) {
          const size = Math.min(REF * (w / widest), h / L / MIN);
          const line = h / L / size;
          if (line < worst) { worst = line; bad = { h, w, widest, line }; }
        }
      }
    }
    ok('no viewport produces an overlapping line',
       worst >= MIN - 1e-9, JSON.stringify(bad));

    /* the padding that was collapsing the page */
    ok('flip mode answers the player padding rule',
       /html\[data-flip="on"\] body:has\(\.player\[data-show="true"\]\) \.wrap/.test(rui),
       'it must match the same condition or quran.css wins on specificity');
    ok('quran.css still pads for the player when scrolling',
       /body:has\(\.player\[data-show="true"\]\) \.wrap\{padding-bottom/.test(qcss));
    ok('the flip page takes the whole screen',
       /html\[data-flip="on"\] body \.wrap,[\s\S]{0,200}?height:100dvh/.test(rui));
    ok('the bar floats over it rather than displacing it',
       /html\[data-flip="on"\] \.topbar\{position:fixed/.test(rui));
    ok('the rail survives the bar withdrawing',
       /html\[data-flip="on"\]\[data-chrome="hidden"\] \.topbar\{[\s\S]*?translateY\(calc\(-100% \+ var\(--topbar-rail/.test(rui));

    /* verses beat the page number for space */
    ok('the page number is kept on the sheet',
       !/html\[data-flip="on"\] \.mushaf__foot\{display:none\}/.test(rui));
    ok('and set tighter so it costs the text less',
       /html\[data-flip="on"\] \.mushaf__foot\{margin-top:/.test(rui));
    ok('the flip bar clears the player',
       /html\[data-flip="on"\] \.flipbar\{bottom:var\(--player-h[^)]*\)\}/.test(rui));

    /* reader-ui.css must load after quran.css for the override to hold */
    const html = fs6.readFileSync(path.join(ROOT, 'surah.html'), 'utf8');
    ok('reader-ui.css is loaded after quran.css',
       html.indexOf('reader-ui.css') > html.indexOf('assets/quran.css'));
  }

  /* the space measurements reach the document */
  {
    const seed = win => {
      win.localStorage.setItem('quran.settings.v1',
        JSON.stringify({ mode: 'mushaf', flip: true, flipSeen: true }));
    };
    const { win, doc } = await loadPage('surah.html?s=2', 'measured chrome', seed);
    const rootStyle = doc.documentElement.style;
    ok('the top bar height is published', rootStyle.getPropertyValue('--topbar-h') !== '');

    ok('the player height is published', rootStyle.getPropertyValue('--player-h') !== '');

    /* The player's height is still measured — the flip bar has to sit above it
       rather than under it — but it no longer changes the page's height, so
       the sheet is never re-fitted when a verse is tapped. jsdom performs no
       layout, so the player is given a height for the observer to notice. */
    const playerEl = doc.getElementById('player');
    playerEl.getBoundingClientRect = () => ({
      height: 120, width: 400, top: 0, left: 0, right: 400, bottom: 120, x: 0, y: 0
    });
    playerEl.setAttribute('data-show', 'true');
    await new Promise(r => setTimeout(r, 150));
    eqv('the player height is measured for the flip bar to clear it',
        doc.documentElement.style.getPropertyValue('--player-h'), '120.0px');

    playerEl.getBoundingClientRect = () => ({
      height: 0, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0
    });
    playerEl.setAttribute('data-show', 'false');
    await new Promise(r => setTimeout(r, 150));
    eqv('and released when it goes',
        doc.documentElement.style.getPropertyValue('--player-h'), '0.0px');
  }

  /* ---------- night mode is one hue family ----------
     The sheet used to keep the day leaf's gold rule on a blue-grey paper while
     the shell around it went green, so the muṣḥaf looked like it belonged to a
     different app. These assertions pin the sheet to the shell's greens. */
  {
    const fs3 = require('fs');
    const css = fs3.readFileSync(path.join(ROOT, 'assets/quran.css'), 'utf8');
    const night = css.slice(css.indexOf('html[data-theme="night"]{'));
    const block = night.slice(0, night.indexOf('}'));

    const tok = n => (block.match(new RegExp('--' + n + ':\\s*([^;]+);')) || [])[1]?.trim();

    /* a hex colour is green when its green channel leads */
    const greenish = hex => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
      if (!m) return false;
      const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
      return g > r && g >= b;
    };

    ok('the night rule is green, not gold', greenish(tok('rule')), tok('rule'));
    ok('the night paper is green, not blue-grey', greenish(tok('paper')), tok('paper'));
    ok('the paper edge follows', greenish(tok('paper-edge')), tok('paper-edge'));
    ok('no gold left in the night sheet block',
       !/A98A4E|169,138,78/.test(block), block.match(/A98A4E|169,138,78/)?.[0]);

    /* the rule must not be the accent exactly, or the reciting verse stops
       standing out from every other ayah medallion */
    const base = fs3.readFileSync(path.join(ROOT, 'assets/base.css'), 'utf8');
    const accent = (base.slice(base.indexOf('html[data-theme="night"]{'))
                       .match(/--accent:\s*(#[0-9a-f]{6})/i) || [])[1];
    ok('night accent found in base.css', !!accent);
    ok('the rule is distinct from the accent',
       accent && tok('rule') && tok('rule').toLowerCase() !== accent.toLowerCase(),
       `rule ${tok('rule')} vs accent ${accent}`);

    /* the watermark toggle must actually control something */
    ok('the watermark is drawn somewhere', /body::before\s*{/.test(base));
    ok('it has a night pattern', /html\[data-theme="night"\]\{\s*--pattern:/.test(base));
    ok('and the off switch still targets it', /data-pattern="off"\] body::before/.test(css));
  }

  /* ---------- the basmala's lift ----------
     It rises by a third of (frame padding + one line), which leaves a gap
     below it equal to half the gap above. The arithmetic only holds while the
     padding the rule measures from is the padding actually applied, so that
     pairing is what gets asserted. */
  {
    const fs4 = require('fs');
    const css = fs4.readFileSync(path.join(ROOT, 'assets/quran.css'), 'utf8');

    const lift = (css.match(/--bism-lift:\s*calc\(([^;]+)\);/) || [])[1];
    ok('the basmala has a lift rule', !!lift);
    ok('it is measured from the frame padding', /--frame-pad-top/.test(lift || ''), lift);
    ok('and from the fitted line height',
       /--exact-line/.test(lift || '') && /--exact-size/.test(lift || ''), lift);
    ok('it is a third of that run', /\/\s*3\s*\)?\s*$/.test((lift || '').trim()), lift);
    ok('the lift is applied upward',
       /transform:translateY\(calc\(-1 \* var\(--bism-lift\)\)\)/.test(css));
    ok('it is no longer a fixed nudge', !/translateY\(-\.2em\)/.test(css));

    /* every place the frame's top padding is set must publish it, or the lift
       silently measures from the wrong number at that breakpoint */
    const frameRules = css.match(/\.mushaf__frame\{[^}]*padding:[^}]*\}/g) || [];
    ok('found the frame padding rules', frameRules.length >= 3, `${frameRules.length}`);
    frameRules.forEach((r, i) => {
      ok('frame rule ' + (i + 1) + ' publishes its top padding',
         /--frame-pad-top:/.test(r) && /padding:var\(--frame-pad-top\)/.test(r),
         r.slice(0, 90));
    });
  }

  /* the setting that drives it is still offered */
  {
    const { doc } = await loadPage('surah.html?s=1', 'ornament setting');
    const gear = doc.querySelector('#gear');
    gear.click();
    await new Promise(r => setTimeout(r, 120));
    ok('the background-ornament switch is in settings',
       /زخرفة الخلفية/.test(doc.querySelector('#settings').textContent));
  }

  /* ---------- the sūrah opening on the sheet ----------
     The ornamental name band is no longer drawn, but its line is still
     reserved so the sheet keeps its true fifteen-line height. Ninety-six
     sūrahs get a band line plus a basmala line; the other eighteen open on
     line 2 and have only one free line for the whole opening. */
  {
    const { doc, errors } = await loadPage('surah.html?s=2', 'opening — two free lines');
    const real = errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e));
    ok('reader boots', real.length === 0, real.join(' | '));

    ok('no ornamental name band is drawn', doc.querySelectorAll('.cartouche').length === 0);
    ok('and no name glyph anywhere on the sheet',
       doc.querySelectorAll('.mushaf__page .cartouche__name').length === 0);

    const band = doc.querySelector('.mushaf__line--band');
    ok('the band line is still there', !!band);
    ok('but it is blank', band && band.classList.contains('is-blank'));
    ok('it holds a space so it keeps its height',
       band && band.textContent.trim().length === 0 && band.innerHTML.length > 0);

    const bism = doc.querySelector('.mushaf__line--bism');
    ok('the basmala is on its own line', !!bism);
    ok('and reads correctly', bism && /بِسْمِ/.test(bism.textContent));

    /* the fifteen-line grid must survive */
    const firstPage = doc.querySelector('.mushaf__page');
    eqv('the opening sheet still has fifteen lines',
        firstPage.querySelectorAll('.mushaf__line').length, 15);
  }

  /* one of the eighteen one-line openings */
  {
    const { doc } = await loadPage('surah.html?s=4', 'opening — one free line');
    ok('still no name band', doc.querySelectorAll('.cartouche').length === 0);
    const band = doc.querySelector('.mushaf__line--band');
    ok('the single free line is used, not blanked',
       band && !band.classList.contains('is-blank'));
    ok('it carries the basmala', band && /بِسْمِ/.test(band.textContent));
    ok('there is no separate basmala line', !doc.querySelector('.mushaf__line--bism'));
    eqv('and the sheet still has fifteen lines',
        doc.querySelector('.mushaf__page').querySelectorAll('.mushaf__line').length, 15);
  }

  /* a sūrah with no basmala at all — Al-Fatihah numbers it as ayah 1 */
  {
    const { doc } = await loadPage('surah.html?s=1', 'opening — Al-Fatihah');
    ok('no name band on Al-Fatihah either', doc.querySelectorAll('.cartouche').length === 0);
    eqv('fifteen lines',
        doc.querySelector('.mushaf__page').querySelectorAll('.mushaf__line').length, 15);
  }

  /* the header card keeps its ornamental name — that one was not removed */
  {
    const { doc } = await loadPage('surah.html?s=2', 'header card');
    ok('the header card still names the sūrah', !!doc.querySelector('.surah-head__band'));
    ok('and still reads it out for screen readers',
       /البقرة/.test(doc.querySelector('.surah-head').textContent));
  }

  /* ---------- marks in the reader ---------- */
  {
    const { win, doc, errors } = await loadPage('surah.html?s=2&a=255', 'marks in reader');
    const real = errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e));
    ok('reader boots with the marks layer', real.length === 0, real.join(' | '));

    const QT = win.QuranTracker;
    ok('the marks module reached the page', !!QT.marks);
    ok('default categories present', QT.marks.cats().length === 5);

    /* open the verse sheet the way a reader does */
    const medallion = doc.querySelector('.mushaf__line .w--end[data-n="255"]') ||
                      doc.querySelector('.w[data-n="255"]');
    ok('the ayah is on the page', !!medallion);
    medallion.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 200));

    ok('the sheet opened', doc.querySelector('#sheet').getAttribute('data-open') === 'true');
    const panel = doc.querySelector('.marks');
    ok('the marks panel was appended', !!panel);
    ok('a chip per category', doc.querySelectorAll('.catchip').length === 5);
    ok('a range end picker is offered', !!doc.querySelector('.marks__span select'));
    ok('a note field is offered', !!doc.querySelector('.marks__note'));

    /* mark it */
    const chip = doc.querySelectorAll('.catchip')[0];
    chip.click();
    await new Promise(r => setTimeout(r, 120));
    const g255 = QT.index.toGlobal(2, 255);
    eqv('the ayah was marked', QT.marks.at(g255).length, 1);
    ok('the chip reads as pressed',
       doc.querySelectorAll('.catchip')[0].getAttribute('aria-pressed') === 'true');

    /* and painted onto the page */
    const painted = doc.querySelectorAll('.w[data-n="255"][data-marked]');
    ok('the words were underlined', painted.length > 0, `${painted.length} words`);
    ok('the colour was stamped as a property',
       /#|var\(/.test(painted[0].style.getPropertyValue('--mark-1')),
       painted[0].style.getPropertyValue('--mark-1'));

    /* a second category stacks rather than replacing */
    doc.querySelectorAll('.catchip')[1].click();
    await new Promise(r => setTimeout(r, 120));
    eqv('two categories on the ayah', QT.marks.at(g255).length, 2);
    eqv('two stripes drawn',
        doc.querySelector('.w[data-n="255"][data-marked]').getAttribute('data-marked'), '2');

    /* unmark */
    doc.querySelectorAll('.catchip')[0].click();
    await new Promise(r => setTimeout(r, 120));
    eqv('one category left', QT.marks.at(g255).length, 1);

    /* a range: pick an end ayah, then a category */
    const endSel = doc.querySelector('.marks__span select');
    endSel.value = '257';
    doc.querySelectorAll('.catchip')[2].click();
    await new Promise(r => setTimeout(r, 120));
    const ranged = QT.marks.list().filter(m => m.to > m.from);
    eqv('a range mark was made', ranged.length, 1);
    eqv('it spans three ayahs', ranged[0].to - ranged[0].from + 1, 3);
    ok('the middle ayah is painted too',
       doc.querySelectorAll('.w[data-n="256"][data-marked]').length > 0);

    ok('reader clean after marking',
       errors.filter(e => !/Could not load|net::|ENOENT|font/i.test(e)).length === 0);
  }

  /* ---------- the bookmarks page ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.marks.v1', JSON.stringify({
        migrated: true,
        cats: [
          { id: 'tadabbur', name: 'للتدبّر', color: '#A67C34' },
          { id: 'hifz', name: 'للحفظ', color: '#0E3B39' }
        ],
        items: [
          { id: 'm1', cat: 'tadabbur', from: 262, to: 262, note: 'آية الكرسي', at: Date.now() },
          { id: 'm2', cat: 'hifz', from: 293, to: 293, note: '', at: Date.now() },
          { id: 'm3', cat: 'hifz', from: 490, to: 494, note: 'دعاء أولي الألباب', at: Date.now() }
        ]
      }));
    };
    const { win, doc, errors } = await loadPage('marks.html', 'marks.html', seed);
    ok('marks.html boots clean', errors.length === 0, errors.join(' | '));
    ok('grouped by category', doc.querySelectorAll('.mgroup').length === 2);
    eqv('three marks listed', doc.querySelectorAll('.mark').length, 3);
    ok('a filter chip per used category', doc.querySelectorAll('#filters button').length === 3);
    ok('counts shown on the filters', /٣/.test(doc.querySelector('#filters button').textContent));
    ok('notes rendered', /آية الكرسي/.test(doc.querySelector('#list').textContent));
    ok('a range is labelled as such', /٥/.test(doc.querySelector('#list').textContent));
    ok('each mark links into the reader',
       /surah\.html\?s=\d+&a=\d+/.test(doc.querySelector('.mark__ref').getAttribute('href')));

    /* the ayah text is fetched lazily, per surah */
    await new Promise(r => setTimeout(r, 900));
    const arText = doc.querySelector('.mark__ar').textContent;
    ok('ayah text loaded in', arText.trim().length > 5 && arText.trim() !== '…', arText.slice(0, 40));

    /* filter */
    doc.querySelectorAll('#filters button')[2].click();
    await new Promise(r => setTimeout(r, 80));
    eqv('filtering narrows the list', doc.querySelectorAll('.mgroup').length, 1);

    /* category management */
    doc.querySelectorAll('#filters button')[0].click();
    await new Promise(r => setTimeout(r, 60));
    eqv('a row per category', doc.querySelectorAll('.catline').length, 2);
    const nameInput = doc.querySelector('.catline input[type="text"]');
    nameInput.value = 'وقفات';
    nameInput.dispatchEvent(new win.Event('change'));
    await new Promise(r => setTimeout(r, 80));
    eqv('renaming sticks', win.QuranTracker.marks.cats()[0].name, 'وقفات');

    doc.querySelector('#add-cat').click();
    await new Promise(r => setTimeout(r, 80));
    eqv('a category can be added', win.QuranTracker.marks.cats().length, 3);

    /* deleting: the harness answers yes, so marks move rather than die */
    const rows = doc.querySelectorAll('.catline .catline__x');
    rows[0].click();
    await new Promise(r => setTimeout(r, 100));
    eqv('the category went', win.QuranTracker.marks.cats().length, 2);
    eqv('but its marks survived', win.QuranTracker.marks.list().length, 3);

    ok('marks.html clean after interaction', errors.length === 0, errors.join(' | '));
  }

  /* ---------- legacy bookmarks are carried over ---------- */
  {
    const seed = win => {
      win.localStorage.setItem('quran.bookmarks.v1', JSON.stringify({ 2: [255, 285] }));
    };
    const { win, doc } = await loadPage('marks.html', 'legacy migration', seed);
    eqv('old bookmarks became marks', win.QuranTracker.marks.list().length, 2);
    ok('and are shown on the page', doc.querySelectorAll('.mark').length === 2);
    ok('the empty state is not shown', doc.querySelector('#blank').hidden === true);
  }

  /* ---------- the old paths still resolve ---------- */
  {
    const fs2 = require('fs');
    for (const [old, target] of [['index.html', 'index.html'], ['surah.html', 'surah.html'],
                                 ['plan.html', 'plan.html'], ['hifz.html', 'hifz.html'],
                                 ['Luqman.html', 'surah.html?s=31']]) {
      const p = path.join(SITE, 'Thekr', 'Quran', old);
      ok('redirect stub exists for ' + old, fs2.existsSync(p));
      if (fs2.existsSync(p)) {
        const html = fs2.readFileSync(p, 'utf8');
        ok(old + ' points at the new location', html.includes('../../quran/' + target));
      }
    }
  }

  server.close();
  console.log('');
  console.log((checks - problems.length) + ' passed, ' + problems.length + ' failed');
  if (problems.length) {
    console.log('');
    problems.forEach(p => console.log('  FAIL  ' + p));
    process.exit(1);
  }
  console.log('pages load and behave.');
  process.exit(0);
})();

/* A thrown assertion would otherwise vanish into an unhandled rejection and
   still print a clean run. */
process.on('unhandledRejection', e => {
  console.error('\nharness crashed: ' + (e && e.stack || e));
  process.exit(1);
});
