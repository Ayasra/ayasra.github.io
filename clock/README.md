# Desk Clock — ayasra.com/clock

A quiet, low-power desk clock with up to six timers, made for an old iPad (the 9.7″ iPad Pro tops out at iPadOS 16). Seven-segment digits (or a thin type face), one ink colour on black, a red night mode, and it runs fully offline once installed.

It is unlisted: nothing on the site links here, and `noindex` keeps it out of search results. Anyone with the link can still open it.

No build step and no dependencies: plain HTML, CSS and JavaScript modules.

## Put it on the iPad

1. In Safari, open **ayasra.com/clock**. The page moves itself to HTTPS, which offline support needs (the site itself doesn't force it — Cloudflare's "Always Use HTTPS" would fix that everywhere).
2. Share → **Add to Home Screen**. The Home Screen copy opens full screen and keeps its own settings, separate from Safari.
3. From then on it starts without a network.

Settings, timers and recent timers are saved on the device (localStorage under `clock.state.v1`), so each device keeps its own. Nothing is sent anywhere, and no cookies are used.

## Set up the iPad as a clock

- **Settings → Display & Brightness → Auto-Lock → Never.** Required. Home Screen web apps on iPadOS 16 can't keep the screen on by themselves, and a sleeping iPad can't ring a timer.
- **Settings → Accessibility → Display & Text Size → Auto-Brightness → On.** The backlight is by far the biggest power draw; this dims it when the room is dark.
- Optional: **Guided Access** (Settings → Accessibility) locks the iPad to the clock — triple-click the Home button to start it, and set its Display Auto-Lock to Never as well.
- Optional: once installed, Wi-Fi off or Airplane Mode saves a little more. The clock keeps time without a network (expect a few seconds of drift a week).
- Battery: an old iPad left on the charger sits at 100% around the clock, which ages the battery. If you can, charge it a few hours a day with a plug timer, and watch for any swelling.

## Using it

- **Tap anywhere** to show or hide the controls: ＋ new timer, full screen (in Safari only), and settings. They hide themselves after a few seconds.
- **Tap a timer** to start, pause or resume it. While the controls are showing, each timer also has ↺ reset and × remove.
- **When a timer finishes** it chimes for two minutes and flashes, counting the time since it ended. Tap anywhere to silence it; it resets, ready to run again.
- **New timer**: type the duration microwave-style (1 3 0 = 1 min 30 s) or pick a preset. The label is optional. Recent timers come back as one-tap chips, with their label and priority.
- **Normal or Priority**: chosen when you create a timer. Nothing on the clock says which is which — priority timers get their own row right under the clock, with large, full-brightness digits, while normal timers sit smaller and a step dimmer below them. However many there are, the clock stays clearly the largest, and priority timers clearly larger than normal ones.
- **Settings**: segment or type face, 12/24 h, seconds, five colours, night mode (off, on, or automatic between set hours), and three alert sounds (each plays when you pick it).

## Why it uses so little power

- With seconds off (the default) the page wakes **once a minute**. With seconds on or a timer running, it wakes once a second — exactly on the second, with every timer sharing that one heartbeat.
- Each wake-up changes only the segments that changed (usually a single SVG path). Nothing animates in between, so the GPU has nothing to do, and nothing runs at all while the screen is off.
- Alert sounds are synthesised on the spot, and the audio hardware is put back to sleep after each one.
- Once installed it makes no network requests until it is reopened.
- The face drifts a few pixels every three minutes, so static digits never burn into the LCD.

One honest caveat: the iPad's LCD has a backlight, so a black screen doesn't save energy the way it does on OLED. Brightness is what counts, hence Auto-Brightness and night mode.

## Working on it

```bash
cd clock
python3 tools/serve.py      # serve on this Mac and the local network, no caching
node --test                 # unit tests (Node 22.12+; no package.json needed)
node tools/make-icons.mjs   # redraw the icons (needs rsvg-convert: brew install librsvg)
```

**Deploying** is the same as the rest of the site: commit and push to `main`, and GitHub Pages publishes it. Unlike the Quran and Thekr workers, `sw.js` revalidates files with the server on every online launch, so there's no cache version to bump — an open clock picks up changes the next time it's reloaded. Only when adding a new file: list it in `ASSETS` in `sw.js` (a test checks this).

The origin is shared with the other apps, so the clock keeps to its own names: caches start with `clock-` (and the worker only ever deletes those), and the storage key is `clock.state.v1`.

| Path | What it does |
| --- | --- |
| `index.html`, `css/app.css` | Page and styles. Targets Safari 15.4+, so no CSS nesting or container queries. |
| `js/main.js` | State, input, and the heartbeat that schedules every tick. |
| `js/timers.js` | Timer state machine: pure functions, second-aligned end times. |
| `js/glyphs.js`, `js/readout.js` | Seven-segment geometry and the digit readouts for both faces. |
| `js/view.js`, `js/layout.js` | Clock and timer rendering; sizing as a pure function of the screen. |
| `js/sheets.js` | The new-timer and settings panels. |
| `js/sound.js` | Web Audio alert sounds. |
| `js/store.js` | Validated localStorage persistence. |
| `js/theme.js`, `js/device.js`, `js/icons.js` | Colours, wake lock and full screen, line icons. |
| `sw.js`, `manifest.webmanifest` | Offline cache and Home Screen install, scoped to `/clock/`. |
| `tools/` | Local server, icon generator, and the tests. |
