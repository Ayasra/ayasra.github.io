/* Drives an athkar page to completion and checks the tick that replaces the
   count. Regression guard for the descendant-selector bug: `.counter svg` also
   matched the tick nested in .counter__num, handing it the progress ring's
   absolute positioning and -90deg rotation.

       npm install jsdom && node tools/test_counter.js
*/

const fs = require('fs');
const path = require('path');
const http = require('http');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('jsdom is not installed — run `npm install jsdom`.'); process.exit(2); }

const SITE = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
               '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

let checks = 0; const problems = [];
function ok(name, cond, detail) {
  checks++;
  if (!cond) problems.push(name + (detail ? ' — ' + detail : ''));
}

function serve() {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(SITE, rel);
    if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('nope');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const errors = [];

  const dom = new JSDOM(fs.readFileSync(path.join(SITE, 'morning_evening.html'), 'utf8'), {
    url: base + '/morning_evening.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(win) {
      win.scrollTo = () => {};
      win.matchMedia = q => ({ matches: false, media: q, addListener(){}, removeListener(){},
                               addEventListener(){}, removeEventListener(){} });
      if (!win.Element.prototype.scrollIntoView) win.Element.prototype.scrollIntoView = () => {};
      win.addEventListener('error', e => errors.push(e.error?.stack || e.message));
    }
  });

  await new Promise(r => {
    if (dom.window.document.readyState === 'complete') return r();
    dom.window.addEventListener('load', r);
    setTimeout(r, 6000);
  });
  await new Promise(r => setTimeout(r, 600));

  const { window: win, window: { document: doc } } = dom;

  const card = doc.querySelector('.card');
  ok('a dhikr card rendered', !!card);
  ok('page booted without errors', errors.length === 0, errors.join(' | '));

  const counter = card.querySelector('.counter');
  const num = card.querySelector('.counter__num');
  const ring = counter.querySelector('svg');

  /* the selector split itself — the property the bug turned on */
  ok('the ring is a direct child of .counter', ring.matches('.counter > svg'));
  ok('the ring still carries its rotation',
     win.getComputedStyle(ring).transform.indexOf('rotate') !== -1 ||
     win.getComputedStyle(ring).transform === 'rotate(-90deg)',
     win.getComputedStyle(ring).transform);

  /* tap until the dhikr is finished */
  const tap = card.querySelector('.card__tap');
  ok('starts with a number, not a tick', /\d/.test(num.textContent));
  for (let i = 0; i < 40 && card.dataset.done !== 'true'; i++) {
    tap.click();
    await new Promise(r => setTimeout(r, 10));
  }
  ok('the dhikr completed', card.dataset.done === 'true');

  const tick = num.querySelector('svg');
  ok('a tick replaced the count', !!tick);

  if (tick) {
    /* This is the bug, stated as an assertion: the tick must NOT match the
       ring's selector, and must not inherit its positioning or rotation. */
    ok('the tick is not matched by the ring rule', !tick.matches('.counter > svg'));

    const cs = win.getComputedStyle(tick);
    ok('the tick is not absolutely positioned', cs.position !== 'absolute', cs.position);
    ok('the tick is not rotated',
       !cs.transform || cs.transform === 'none' || cs.transform.indexOf('rotate') === -1,
       cs.transform);
    ok('the tick is not stretched to the counter box',
       cs.width !== '100%' && cs.height !== '100%', cs.width + ' x ' + cs.height);
    ok('the tick has an explicit size', cs.width === '20px', cs.width);
    ok('the tick sits in a centring container',
       win.getComputedStyle(num).display === 'grid', win.getComputedStyle(num).display);
    ok('the tick is a block so it does not sit on the text baseline',
       cs.display === 'block', cs.display);
  }

  /* undo should put the number back */
  const undo = card.querySelector('[data-act="undo"]');
  if (undo) {
    undo.click();
    await new Promise(r => setTimeout(r, 40));
    ok('undo restores a number', /\d/.test(num.textContent));
    ok('and removes the tick', !num.querySelector('svg'));
  }

  ok('no errors after interaction', errors.length === 0, errors.join(' | '));

  server.close();
  console.log('');
  console.log((checks - problems.length) + ' passed, ' + problems.length + ' failed');
  if (problems.length) {
    console.log('');
    problems.forEach(p => console.log('  FAIL  ' + p));
    process.exit(1);
  }
  console.log('the completed-dhikr tick renders correctly.');
  process.exit(0);
})();

process.on('unhandledRejection', e => {
  console.error('\nharness crashed: ' + (e && e.stack || e));
  process.exit(1);
});
