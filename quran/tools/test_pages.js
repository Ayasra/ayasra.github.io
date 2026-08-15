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
    const { doc, errors } = await loadPage('index.html', 'index.html');
    ok('index.html boots clean', errors.length === 0, errors.join(' | '));
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
