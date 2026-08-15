/* =========================================================================
   Tracker — the shared state layer behind reading, memorisation, review and
   tafsir study.

   Loaded by plan.html (the dashboard) and by surah.html (the session bar).
   Depends on assets/data/index.js and assets/data/surahs.js, both of which
   ship as <script> files assigning a global, so this works over file:// too.

   ---------------------------------------------------------------------
   The one idea
   ---------------------------------------------------------------------
   Everything the app tracks is a *range of ayahs* plus a timestamp. Reading,
   hifz, murajaah and tafsir differ only in the `type` on the record and the
   scheduling rules layered on top. So there is exactly one write path — the
   session log — and every number shown anywhere is derived from it.

   That has one consequence worth stating plainly: plans do not carry a
   progress counter. A counter drifts the moment you read out of order, log a
   session twice, or delete one. Instead a plan's progress is recomputed from
   the log each time it is asked for. Slower, and it does not matter at this
   scale — a decade of daily sessions is a few thousand intervals.

   Ranges are held as global ayah numbers, 1..6236. See tools/build_index.py
   for why.
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---------------- storage ----------------
     Same read/write shape as quran.js so the two agree about what a corrupt
     value means: fall back to the default rather than throw. Safari in private
     mode throws on setItem, hence the write guard. */

  var K = {
    sessions: 'quran.sessions.v1',
    plans:    'quran.plans.v1',
    active:   'quran.active.v1',
    hifz:     'quran.hifz.v1',
    notes:    'quran.notes.v1',
    marks:    'quran.marks.v1',
    prefs:    'quran.tracker.v1'
  };

  function read(k, d) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : d; }
    catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      /* Quota. The caller decides what to do; the dashboard surfaces it. */
      if (root.console) console.warn('tracker: could not save ' + k, e);
      return false;
    }
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- dates ----------------
     All day keys are local-time 'YYYY-MM-DD'. Deliberately not UTC: a session
     at 1am should belong to the day the reader thinks it is, and a streak that
     breaks because of a timezone offset is worse than useless. */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function dayKey(ms) {
    var d = ms == null ? new Date() : new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function today() { return dayKey(); }

  function keyToDate(key) {
    var p = String(key).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(key, n) {
    var d = keyToDate(key);
    d.setDate(d.getDate() + n);
    return dayKey(d.getTime());
  }
  /* Difference in whole days. Computed on the date parts only, so daylight
     saving shifts cannot round a 23- or 25-hour day to the wrong side. */
  function daysBetween(a, b) {
    var x = keyToDate(a), y = keyToDate(b);
    return Math.round((y - x) / 86400000);
  }

  /* ---------------- position index ---------------- */

  var IDX = null, META = null, byId = {};

  function requireIndex() {
    if (!IDX) throw new Error('tracker: assets/data/index.js has not loaded');
  }

  /* Largest i in [lo,hi] with arr[i] <= v. The arrays are non-decreasing and
     1-based with a sentinel at the end, both guaranteed by build_index.py. */
  function upperSlot(arr, v, lo, hi) {
    var best = lo;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= v) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  var Index = {
    get total() { requireIndex(); return IDX.totalAyahs; },
    get pages() { requireIndex(); return IDX.totalPages; },
    get juz()   { requireIndex(); return IDX.totalJuz; },

    clamp: function (g) {
      requireIndex();
      return Math.max(1, Math.min(IDX.totalAyahs, Math.round(g) || 1));
    },

    /* (surah, ayah) -> 1..6236 */
    toGlobal: function (surah, ayah) {
      requireIndex();
      var s = Math.max(1, Math.min(114, surah | 0));
      var start = IDX.surahStart[s];
      var len = IDX.surahStart[s + 1] - start;
      var a = Math.max(1, Math.min(len, (ayah | 0) || 1));
      return start + a - 1;
    },

    /* 1..6236 -> {surah, ayah} */
    fromGlobal: function (g) {
      requireIndex();
      g = Index.clamp(g);
      var s = upperSlot(IDX.surahStart, g, 1, 114);
      return { surah: s, ayah: g - IDX.surahStart[s] + 1 };
    },

    pageOf: function (g) {
      requireIndex();
      return upperSlot(IDX.pageStart, Index.clamp(g), 1, IDX.totalPages);
    },
    juzOf: function (g) {
      requireIndex();
      return upperSlot(IDX.juzStart, Index.clamp(g), 1, IDX.totalJuz);
    },

    surahRange: function (s) {
      requireIndex();
      s = Math.max(1, Math.min(114, s | 0));
      return [IDX.surahStart[s], IDX.surahStart[s + 1] - 1];
    },
    pageRange: function (p) {
      requireIndex();
      p = Math.max(1, Math.min(IDX.totalPages, p | 0));
      return [IDX.pageStart[p], IDX.pageStart[p + 1] - 1];
    },
    juzRange: function (j) {
      requireIndex();
      j = Math.max(1, Math.min(IDX.totalJuz, j | 0));
      return [IDX.juzStart[j], IDX.juzStart[j + 1] - 1];
    },

    /* Whole mushaf. */
    all: function () { requireIndex(); return [1, IDX.totalAyahs]; },

    /* The reader loads surahs.js itself, asynchronously, so on that page the
       metadata may still be missing when this module first runs. Re-reading
       the global on a miss is cheaper than making every caller wait. */
    surahName: function (s) {
      var m = byId[s];
      if (!m && root.QURAN_SURAHS && root.QURAN_SURAHS !== META) { init(); m = byId[s]; }
      return m ? m.nameAr : ('سورة ' + ar(s));
    },

    /* 'البقرة ٢٥٥' */
    label: function (g) {
      var p = Index.fromGlobal(g);
      return Index.surahName(p.surah) + ' ' + ar(p.ayah);
    },

    /* Human range: collapses to one side when both ends share a surah. */
    rangeLabel: function (from, to) {
      var a = Index.fromGlobal(from), b = Index.fromGlobal(to);
      if (a.surah === b.surah) {
        return a.ayah === b.ayah
          ? Index.surahName(a.surah) + ' ' + ar(a.ayah)
          : Index.surahName(a.surah) + ' ' + ar(a.ayah) + '–' + ar(b.ayah);
      }
      return Index.surahName(a.surah) + ' ' + ar(a.ayah) +
             ' ← ' + Index.surahName(b.surah) + ' ' + ar(b.ayah);
    },

    /* Link straight into the reader at a position. */
    href: function (g) {
      var p = Index.fromGlobal(g);
      return 'surah.html?s=' + p.surah + '&a=' + p.ayah;
    }
  };

  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  function ar(n) {
    return String(n).split('').map(function (c) {
      return AR_DIGITS[+c] != null ? AR_DIGITS[+c] : c;
    }).join('');
  }

  /* ---------------- interval algebra ----------------
     Sessions overlap constantly — you re-read, you revise, you start a page
     over. Counting "how much have I covered" therefore means unioning
     intervals, never summing lengths. */

  function normalize(ranges) {
    if (!ranges.length) return [];
    var xs = ranges.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = [xs[0].slice()];
    for (var i = 1; i < xs.length; i++) {
      var cur = xs[i], last = out[out.length - 1];
      /* +1 so [1,5] and [6,9] fuse — they are adjacent, not overlapping */
      if (cur[0] <= last[1] + 1) { if (cur[1] > last[1]) last[1] = cur[1]; }
      else out.push(cur.slice());
    }
    return out;
  }

  function clipTo(merged, from, to) {
    var out = [];
    for (var i = 0; i < merged.length; i++) {
      var a = Math.max(merged[i][0], from), b = Math.min(merged[i][1], to);
      if (a <= b) out.push([a, b]);
    }
    return out;
  }

  function measure(merged) {
    var n = 0;
    for (var i = 0; i < merged.length; i++) n += merged[i][1] - merged[i][0] + 1;
    return n;
  }

  /* First ayah in [from,to] that no interval covers, or null when complete.
     This is what a plan uses as "where you are" — resilient to reading out of
     order, because it finds the first *hole*, not the furthest point reached. */
  function firstGap(merged, from, to) {
    var at = from;
    for (var i = 0; i < merged.length; i++) {
      if (merged[i][1] < at) continue;
      if (merged[i][0] > at) break;
      at = merged[i][1] + 1;
      if (at > to) return null;
    }
    return at > to ? null : at;
  }

  /* ---------------- sessions ---------------- */

  var TYPES = ['read', 'hifz', 'review', 'tafsir'];

  var Sessions = {
    list: function (filter) {
      var all = read(K.sessions, []);
      if (!filter) return all;
      return all.filter(function (s) {
        if (filter.type && s.type !== filter.type) return false;
        if (filter.planId && s.planId !== filter.planId) return false;
        if (filter.since && s.at < filter.since) return false;
        return true;
      });
    },

    /* One session. `from`/`to` are global ayah numbers; `seconds` is active
       time and may be 0 for a portion marked done by hand. */
    add: function (rec) {
      var all = read(K.sessions, []);
      var from = Index.clamp(rec.from);
      var to = Index.clamp(rec.to == null ? rec.from : rec.to);
      if (to < from) { var t = from; from = to; to = t; }

      var s = {
        id: uid('s_'),
        type: TYPES.indexOf(rec.type) === -1 ? 'read' : rec.type,
        from: from,
        to: to,
        at: rec.at || Date.now(),
        seconds: Math.max(0, Math.round(rec.seconds || 0)),
        planId: rec.planId || null,
        manual: !!rec.manual,
        note: rec.note || null
      };
      all.push(s);
      write(K.sessions, all);
      return s;
    },

    remove: function (id) {
      var all = read(K.sessions, []).filter(function (s) { return s.id !== id; });
      write(K.sessions, all);
    },

    /* Merged coverage for a type, optionally limited to one plan.
       `beforeDay` drops anything logged on or after that day key — which is how
       a plan works out what it had assigned before today's reading began. */
    coverage: function (type, planId, beforeDay) {
      var rs = [];
      var all = read(K.sessions, []);
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if (type && s.type !== type) continue;
        if (planId && s.planId !== planId) continue;
        if (beforeDay && dayKey(s.at) >= beforeDay) continue;
        rs.push([s.from, s.to]);
      }
      return normalize(rs);
    },

    /* Day keys -> total seconds and ayahs, for the heatmap. */
    byDay: function (type) {
      var out = {};
      var all = read(K.sessions, []);
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if (type && s.type !== type) continue;
        var k = dayKey(s.at);
        if (!out[k]) out[k] = { seconds: 0, ayahs: 0, count: 0 };
        out[k].seconds += s.seconds;
        out[k].ayahs += s.to - s.from + 1;
        out[k].count += 1;
      }
      return out;
    }
  };

  /* ---------------- live session ----------------
     Kept in localStorage rather than memory so it survives navigating from one
     surah to the next mid-session, which is the normal case. */

  var Live = {
    get: function () { return read(K.active, null); },

    start: function (type, fromGlobal) {
      var a = {
        type: type || 'read',
        from: Index.clamp(fromGlobal),
        to: Index.clamp(fromGlobal),
        startedAt: Date.now(),
        accumMs: 0,
        pausedAt: null
      };
      write(K.active, a);
      return a;
    },

    /* Called as the reader scrolls, to widen the range covered. */
    mark: function (g) {
      var a = Live.get();
      if (!a) return null;
      g = Index.clamp(g);
      if (g < a.from) a.from = g;
      if (g > a.to) a.to = g;
      write(K.active, a);
      return a;
    },

    pause: function () {
      var a = Live.get();
      if (!a || a.pausedAt) return a;
      a.accumMs += Date.now() - a.startedAt;
      a.pausedAt = Date.now();
      write(K.active, a);
      return a;
    },

    resume: function () {
      var a = Live.get();
      if (!a || !a.pausedAt) return a;
      a.startedAt = Date.now();
      a.pausedAt = null;
      write(K.active, a);
      return a;
    },

    elapsedMs: function () {
      var a = Live.get();
      if (!a) return 0;
      return a.accumMs + (a.pausedAt ? 0 : Date.now() - a.startedAt);
    },

    /* Commit to the log. Sessions under 10s are dropped — those are misclicks,
       and they would poison the pace estimate. */
    stop: function (planId) {
      var a = Live.get();
      if (!a) return null;
      var ms = Live.elapsedMs();
      try { localStorage.removeItem(K.active); } catch (e) {}
      if (ms < 10000) return null;
      return Sessions.add({
        type: a.type, from: a.from, to: a.to,
        seconds: Math.round(ms / 1000), planId: planId || null
      });
    },

    cancel: function () { try { localStorage.removeItem(K.active); } catch (e) {} }
  };

  /* ---------------- plans ---------------- */

  /* A scope is what the plan covers. Stored as a kind plus arguments so it can
     be relabelled later without recomputing stored ayah numbers. */
  function scopeRange(scope) {
    if (!scope) return Index.all();
    switch (scope.kind) {
      case 'surah': return Index.surahRange(scope.surah);
      case 'juz':   return Index.juzRange(scope.juz);
      case 'range': return [Index.clamp(scope.from), Index.clamp(scope.to)];
      default:      return Index.all();
    }
  }

  function scopeLabel(scope) {
    if (!scope || scope.kind === 'all') return 'المصحف كامل';
    if (scope.kind === 'surah') return 'سورة ' + Index.surahName(scope.surah);
    if (scope.kind === 'juz') return 'الجزء ' + ar(scope.juz);
    var r = scopeRange(scope);
    return Index.rangeLabel(r[0], r[1]);
  }

  /* ---------------- programmes ----------------
     A programme is a fixed, ordered division of the muṣḥaf that someone else
     designed — the forty nights of qiyam, the seven manazil of the Companions.
     Unlike a plan you configure, its portions are given: the boundaries carry
     reasoning (a ruku' edge, the head of a sūrah) that must not be recomputed.

     The steps live in assets/data/programs.js and are read from there rather
     than copied into the saved plan. Forty-eight kilobytes of night titles has
     no business in localStorage, and a plan that carried its own copy could
     drift from the file after an update. */

  function programOf(plan) {
    var all = root.QURAN_PROGRAMS;
    return (plan && plan.program && all && all[plan.program]) || null;
  }

  function programSteps(plan) {
    var p = programOf(plan);
    return p && p.steps ? p.steps : [];
  }

  /* Steps hold ranges as plain pairs; normalise defensively so a hand-edited
     data file cannot produce an unsorted step. */
  function stepRanges(step) {
    return normalize((step && step.r ? step.r : []).map(function (r) {
      return [Index.clamp(r[0]), Index.clamp(r[1])];
    }));
  }

  function stepComplete(step, covered) {
    var rs = stepRanges(step);
    for (var i = 0; i < rs.length; i++) {
      if (measure(clipTo(covered, rs[i][0], rs[i][1])) < rs[i][1] - rs[i][0] + 1) return false;
    }
    return rs.length > 0;
  }

  var Plans = {
    list: function (includeArchived) {
      var all = read(K.plans, []);
      return includeArchived ? all : all.filter(function (p) { return !p.archived; });
    },

    get: function (id) {
      var all = read(K.plans, []);
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },

    create: function (spec) {
      var all = read(K.plans, []);
      var p = {
        id: uid('p_'),
        type: spec.type || 'read',
        name: spec.name || 'خطة قراءة',
        scope: spec.scope || { kind: 'all' },
        unit: spec.unit === 'ayah' ? 'ayah' : 'page',
        /* 'perDay' fixes the daily portion and lets the end date move.
           'byDate' fixes the end date and lets the portion move. */
        mode: spec.mode === 'byDate' ? 'byDate' : 'perDay',
        amount: Math.max(1, spec.amount || 4),
        endDate: spec.endDate || null,
        startDate: spec.startDate || today(),
        /* How to absorb a missed day. 'redistribute' spreads the shortfall
           over the days that remain; 'extend' keeps the daily portion and
           moves the finish line. */
        behind: spec.behind === 'extend' ? 'extend' : 'redistribute',
        archived: false,
        createdAt: Date.now()
      };
      all.push(p);
      write(K.plans, all);
      return p;
    },

    update: function (id, patch) {
      var all = read(K.plans, []);
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) {
          for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) all[i][k] = patch[k];
          write(K.plans, all);
          return all[i];
        }
      }
      return null;
    },

    remove: function (id) {
      write(K.plans, read(K.plans, []).filter(function (p) { return p.id !== id; }));
    },

    /* Everything the dashboard needs about one plan, derived fresh. */
    status: function (plan) {
      requireIndex();
      if (plan.mode === 'steps') return Plans.stepStatus(plan);
      var r = scopeRange(plan.scope);
      var from = r[0], to = r[1];
      var covered = clipTo(Sessions.coverage(plan.type, plan.id), from, to);

      var totalAyahs = to - from + 1;
      var doneAyahs = measure(covered);
      var cursor = firstGap(covered, from, to);
      var finished = cursor === null;

      var perPage = plan.unit === 'page';
      var totalUnits = perPage ? (Index.pageOf(to) - Index.pageOf(from) + 1) : totalAyahs;
      var doneUnits = perPage
        ? (finished ? totalUnits : Index.pageOf(cursor) - Index.pageOf(from))
        : doneAyahs;
      var leftUnits = Math.max(0, totalUnits - doneUnits);

      var day = today();
      var daysIn = Math.max(0, daysBetween(plan.startDate, day)) + 1;

      /* The portion for today. byDate plans always re-divide what is left over
         the days that remain, so falling behind self-corrects. perDay plans
         hold the portion steady unless the reader asked for redistribution. */
      var perDay = plan.amount;
      var daysLeft = null;

      if (plan.mode === 'byDate' && plan.endDate) {
        daysLeft = Math.max(1, daysBetween(day, plan.endDate) + 1);
        perDay = Math.max(1, Math.ceil(leftUnits / daysLeft));
      } else if (plan.behind === 'redistribute' && plan.endDate) {
        daysLeft = Math.max(1, daysBetween(day, plan.endDate) + 1);
        perDay = Math.max(1, Math.ceil(leftUnits / daysLeft));
      }

      /* Owed by the end of today if every day since the start had been kept. */
      var expectedUnits = Math.min(totalUnits, plan.amount * daysIn);
      var debtUnits = plan.mode === 'byDate' ? 0 : Math.max(0, expectedUnits - doneUnits);

      /* Today's assignment is anchored to where the plan stood when the day
         began, not to the live cursor. Recomputing it from the live cursor
         would slide the portion forward the moment any of it was read, so it
         could never be reported as done. Anchoring also means reading ahead
         still counts: tomorrow those sessions are "before today" and the
         anchor jumps past them. */
      var dayAnchor = firstGap(
        clipTo(Sessions.coverage(plan.type, plan.id, day), from, to), from, to);

      var todayFrom = null, todayTo = null, todayDone = false;
      if (finished) {
        /* Nothing left in the scope at all — including anything finished
           earlier today, which is why this is checked before the anchor. */
        todayDone = true;
      } else if (dayAnchor !== null) {
        todayFrom = dayAnchor;
        if (perPage) {
          var startPage = Index.pageOf(dayAnchor);
          var endPage = Math.min(Index.pageOf(to), startPage + perDay - 1);
          todayTo = Math.min(to, Index.pageRange(endPage)[1]);
        } else {
          todayTo = Math.min(to, dayAnchor + perDay - 1);
        }
        /* Judged on the portion itself, so a two-minute dip into the text does
           not tick the box. */
        todayDone = measure(clipTo(covered, todayFrom, todayTo)) >= (todayTo - todayFrom + 1);
      } else {
        /* Nothing left to assign — the plan was already complete this morning. */
        todayDone = true;
      }

      var projectedEnd = null;
      if (!finished && perDay > 0) {
        projectedEnd = addDays(day, Math.max(0, Math.ceil(leftUnits / perDay) - 1));
      }

      return {
        plan: plan,
        scopeFrom: from, scopeTo: to,
        scopeLabel: scopeLabel(plan.scope),
        unit: plan.unit,
        totalUnits: totalUnits, doneUnits: doneUnits, leftUnits: leftUnits,
        pct: totalUnits ? Math.min(100, Math.round(doneUnits / totalUnits * 100)) : 0,
        cursor: cursor, finished: finished,
        perDay: perDay, daysIn: daysIn, daysLeft: daysLeft,
        debtUnits: debtUnits,
        todayFrom: todayFrom, todayTo: todayTo, todayDone: todayDone,
        /* Where "continue reading" should go — past anything already read
           today, unlike todayFrom which is pinned to this morning. */
        nextFrom: cursor,
        projectedEnd: projectedEnd,
        coverage: covered
      };
    },

    /* A programme's progress is measured in whole steps. A night is done or it
       is not — half of night nineteen is not a unit anyone thinks in. */
    stepStatus: function (plan) {
      requireIndex();
      var prog = programOf(plan);
      var steps = programSteps(plan);
      var day = today();
      var covered = Sessions.coverage(plan.type, plan.id);

      var doneCount = 0, cursorStep = null;
      for (var i = 0; i < steps.length; i++) {
        if (stepComplete(steps[i], covered)) doneCount++;
        else if (cursorStep === null) cursorStep = i;
      }
      var finished = cursorStep === null && steps.length > 0;

      /* Anchored to where the programme stood this morning, exactly as a
         configured plan is — so finishing tonight's portion ticks tonight's
         box instead of silently promoting tomorrow's. */
      var priorCovered = Sessions.coverage(plan.type, plan.id, day);
      var anchor = null;
      for (var j = 0; j < steps.length; j++) {
        if (!stepComplete(steps[j], priorCovered)) { anchor = j; break; }
      }

      var step = null, ranges = [], todayDone = false;
      if (!finished && anchor !== null) {
        step = steps[anchor];
        ranges = stepRanges(step);
        todayDone = stepComplete(step, covered);
      } else if (finished) {
        todayDone = true;
      }

      var totalAyahs = 0, doneAyahs = 0;
      for (var k = 0; k < steps.length; k++) {
        var rs = stepRanges(steps[k]);
        for (var m = 0; m < rs.length; m++) {
          totalAyahs += rs[m][1] - rs[m][0] + 1;
          doneAyahs += measure(clipTo(covered, rs[m][0], rs[m][1]));
        }
      }

      var left = steps.length - doneCount;
      var daysIn = Math.max(0, daysBetween(plan.startDate, day)) + 1;

      return {
        plan: plan,
        program: prog,
        steps: steps,
        stepIndex: anchor,
        step: step,
        nextIndex: cursorStep,
        unit: plan.unit || (prog && prog.unit) || 'day',
        scopeLabel: prog ? prog.name : 'برنامج',
        totalUnits: steps.length, doneUnits: doneCount, leftUnits: left,
        pct: totalAyahs ? Math.min(100, Math.round(doneAyahs / totalAyahs * 100)) : 0,
        finished: finished,
        perDay: 1, daysIn: daysIn, daysLeft: left,
        debtUnits: Math.max(0, Math.min(steps.length, daysIn) - doneCount),
        todayRanges: ranges,
        todayFrom: ranges.length ? ranges[0][0] : null,
        todayTo: ranges.length ? ranges[ranges.length - 1][1] : null,
        todayDone: todayDone,
        nextFrom: cursorStep !== null && steps[cursorStep]
          ? stepRanges(steps[cursorStep])[0][0] : null,
        projectedEnd: finished ? null : addDays(day, Math.max(0, left - 1)),
        coverage: covered
      };
    },

    /* Log the whole of today's portion without having timed it. */
    markTodayDone: function (plan) {
      var st = Plans.status(plan);
      if (st.finished) return null;

      /* A themed night is two disjoint stretches — the night's own passage and
         the sūrah pulled forward into the fourth rak'ah. Both are logged, or
         the night never reads as complete. */
      if (st.todayRanges && st.todayRanges.length) {
        var out = null;
        for (var i = 0; i < st.todayRanges.length; i++) {
          out = Sessions.add({
            type: plan.type, from: st.todayRanges[i][0], to: st.todayRanges[i][1],
            seconds: 0, planId: plan.id, manual: true
          });
        }
        return out;
      }

      if (st.todayFrom == null) return null;
      return Sessions.add({
        type: plan.type, from: st.todayFrom, to: st.todayTo,
        seconds: 0, planId: plan.id, manual: true
      });
    },

    /* Start a programme. Only one live copy of each is allowed — two half-done
       forty-night khatmas sharing a session log would each corrupt the other's
       progress. */
    startProgram: function (key, name) {
      var all = root.QURAN_PROGRAMS;
      var prog = all && all[key];
      if (!prog) throw new Error('unknown programme: ' + key);

      var existing = Plans.list().filter(function (p) { return p.program === key; })[0];
      if (existing) return existing;

      var plans = read(K.plans, []);
      var p = {
        id: uid('p_'),
        type: 'read',
        name: name || prog.name,
        program: key,
        mode: 'steps',
        unit: prog.unit || 'day',
        scope: { kind: 'all' },
        amount: 1,
        endDate: null,
        startDate: today(),
        behind: 'extend',
        archived: false,
        createdAt: Date.now()
      };
      plans.push(p);
      write(K.plans, plans);
      return p;
    },

    /* Mark one step of a programme complete — used by the programme pages,
       where the reader ticks a night rather than timing a session. */
    completeStep: function (plan, index) {
      var steps = programSteps(plan);
      var step = steps[index];
      if (!step) return null;
      var rs = stepRanges(step);
      var out = null;
      for (var i = 0; i < rs.length; i++) {
        out = Sessions.add({
          type: plan.type, from: rs[i][0], to: rs[i][1],
          seconds: 0, planId: plan.id, manual: true
        });
      }
      return out;
    },

    /* Undo a step: drop this plan's manual sessions that lie inside it. Timed
       sessions are left alone — those record something that actually happened. */
    clearStep: function (plan, index) {
      var steps = programSteps(plan);
      var step = steps[index];
      if (!step) return 0;
      var rs = stepRanges(step);
      var all = read(K.sessions, []);
      var keep = [], dropped = 0;
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        var inside = s.planId === plan.id && s.manual && rs.some(function (r) {
          return s.from >= r[0] && s.to <= r[1];
        });
        if (inside) dropped++; else keep.push(s);
      }
      if (dropped) write(K.sessions, keep);
      return dropped;
    },

    stepRanges: stepRanges,
    stepComplete: stepComplete,
    programSteps: programSteps
  };

  /* ---------------- hifz ----------------
     The unit is the muṣḥaf page: it is what huffāẓ count in, and per-ayah
     scheduling would produce a review queue nobody could face. Ayahs still
     matter, but only where they earn it — as the slips that mark a page shaky.

     Three queues, and they are not three views of one algorithm:

       sabaq   الجديد — the page being learned right now. No schedule; it is
                        due until you say it is memorised.
       sabqi   القريب — memorised within the last SABQI_DAYS. Due EVERY day,
                        regardless of what any interval would say. Spaced
                        repetition is calibrated for consolidated memory, and
                        a four-day-old page is not that yet. Letting an
                        algorithm defer it is how new hifz is lost.
       manzil  البعيد — everything older, on spaced repetition. This is where
                        an algorithm earns its keep: it spends your review time
                        on the pages that are actually decaying.

     A page therefore graduates by the calendar, not by performance — but a
     page you rate نسيت during sabqi falls back to sabaq, because forgetting it
     means it was never really memorised. */

  var DEFAULT_PREFS = {
    sabqiDays: 7,
    /* Six months between recitations of a page is too long for hifz whatever
       a general-purpose SRS curve says, so intervals are capped. Raise it and
       the daily manzil load falls, at the cost of more forgetting. */
    maxInterval: 60,
    /* Ease bounds, borrowed from SM-2 but tightened: Qur'anic pages are far
       more uniform in difficulty than arbitrary flashcards. */
    minEase: 1.3,
    maxEase: 2.8,
    startEase: 2.3
  };

  var RATINGS = ['forgot', 'shaky', 'clean'];

  function hifzStore() {
    var s = read(K.hifz, null);
    if (!s || typeof s !== 'object') s = {};
    if (!s.pages || typeof s.pages !== 'object') s.pages = {};
    if (!s.slips || typeof s.slips !== 'object') s.slips = {};
    return s;
  }
  function saveHifz(s) { return write(K.hifz, s); }

  function prefs() {
    var p = read(K.prefs, {});
    var out = {};
    for (var k in DEFAULT_PREFS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, k)) {
        out[k] = p[k] != null ? p[k] : DEFAULT_PREFS[k];
      }
    }
    return out;
  }

  function blankPage(p, state, learnedOn) {
    return {
      p: p,
      state: state || 'learning',
      learnedOn: learnedOn || null,
      interval: 0,
      ease: prefs().startEase,
      due: null,
      reps: 0,
      lapses: 0,
      lastReview: null,
      history: []
    };
  }

  /* Which queue a page belongs to right now. Pure function of the record and
     the date, so nothing has to be migrated when a day rolls over. */
  function queueOf(rec, day) {
    if (!rec || rec.state === 'learning') return 'sabaq';
    var age = daysBetween(rec.learnedOn || day, day);
    return age < prefs().sabqiDays ? 'sabqi' : 'manzil';
  }

  function isDue(rec, day) {
    var q = queueOf(rec, day);
    if (q !== 'manzil') return true;              /* sabaq and sabqi are daily */
    if (!rec.due) return true;                    /* never scheduled — review it */
    return daysBetween(rec.due, day) >= 0;        /* due today or overdue */
  }

  /* SM-2, adapted. Returns the mutated record. */
  function reschedule(rec, rating, day) {
    var P = prefs();
    var q = queueOf(rec, day);

    if (q === 'sabqi' && rating === 'forgot') {
      /* Not consolidated after all — back to sabaq rather than onto a curve. */
      rec.state = 'learning';
      rec.learnedOn = null;
      rec.interval = 0;
      rec.due = null;
      rec.reps = 0;
      rec.lapses++;
      return rec;
    }

    if (q !== 'manzil') {
      /* Daily queues keep no interval; the rating only records how it went and
         feeds the slip decay below. */
      if (rating === 'forgot') rec.lapses++;
      return rec;
    }

    if (rating === 'forgot') {
      rec.interval = 1;
      rec.ease = Math.max(P.minEase, rec.ease - 0.20);
      rec.reps = 0;
      rec.lapses++;
    } else if (rating === 'shaky') {
      /* Grows, but barely — a stumble means the interval was already too long. */
      rec.interval = Math.max(1, Math.round((rec.interval || 1) * 1.2));
      rec.ease = Math.max(P.minEase, rec.ease - 0.10);
    } else {
      rec.interval = rec.reps === 0 ? 3 : Math.round((rec.interval || 1) * rec.ease);
      rec.ease = Math.min(P.maxEase, rec.ease + 0.05);
      rec.reps++;
    }

    rec.interval = Math.max(1, Math.min(P.maxInterval, rec.interval));
    rec.due = addDays(day, rec.interval);
    return rec;
  }

  var Hifz = {
    prefs: prefs,
    setPrefs: function (patch) {
      var p = read(K.prefs, {});
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) p[k] = patch[k];
      write(K.prefs, p);
      return prefs();
    },

    all: function () {
      var s = hifzStore(), out = [];
      for (var k in s.pages) if (Object.prototype.hasOwnProperty.call(s.pages, k)) out.push(s.pages[k]);
      out.sort(function (a, b) { return a.p - b.p; });
      return out;
    },

    get: function (p) { return hifzStore().pages[String(p)] || null; },

    /* Begin learning a page — it lands in sabaq. */
    add: function (p) {
      requireIndex();
      p = Math.max(1, Math.min(IDX.totalPages, p | 0));
      var s = hifzStore();
      if (!s.pages[String(p)]) s.pages[String(p)] = blankPage(p, 'learning', null);
      saveHifz(s);
      return s.pages[String(p)];
    },

    /* Bulk entry for someone who arrives with hifz already done — tapping two
       hundred pages one at a time is not a reasonable way to start. */
    addRange: function (fromPage, toPage, opts) {
      requireIndex();
      opts = opts || {};
      var s = hifzStore();
      var a = Math.max(1, Math.min(IDX.totalPages, fromPage | 0));
      var b = Math.max(1, Math.min(IDX.totalPages, toPage | 0));
      if (b < a) { var t = a; a = b; b = t; }
      var day = today();
      /* Dated far enough back that they land in manzil rather than flooding
         sabqi with two hundred pages all due tomorrow. */
      var learned = opts.learnedOn || addDays(day, -(prefs().sabqiDays + 1));
      var n = 0;
      for (var p = a; p <= b; p++) {
        if (s.pages[String(p)] && !opts.overwrite) continue;
        var rec = blankPage(p, opts.memorized === false ? 'learning' : 'memorized',
                            opts.memorized === false ? null : learned);
        if (rec.state === 'memorized') {
          /* Spread first reviews over the coming days instead of stacking them
             on one date — otherwise day one of using the app is unusable. */
          rec.interval = 1 + (n % 7);
          rec.due = addDays(day, n % 7);
        }
        s.pages[String(p)] = rec;
        n++;
      }
      saveHifz(s);
      return n;
    },

    remove: function (p) {
      var s = hifzStore();
      delete s.pages[String(p)];
      saveHifz(s);
    },

    /* sabaq -> sabqi. Logs a hifz session for the page's ayahs. */
    promote: function (p) {
      var s = hifzStore();
      var rec = s.pages[String(p)];
      if (!rec) rec = s.pages[String(p)] = blankPage(p, 'learning', null);
      rec.state = 'memorized';
      rec.learnedOn = today();
      rec.due = addDays(rec.learnedOn, 1);
      rec.interval = 1;
      saveHifz(s);

      var r = Index.pageRange(p);
      Sessions.add({ type: 'hifz', from: r[0], to: r[1], seconds: 0, manual: true });
      return rec;
    },

    /* Record a review. `seconds` is optional; a review with no timing still
       counts toward the streak, it just does not feed the pace estimate. */
    rate: function (p, rating, seconds) {
      if (RATINGS.indexOf(rating) === -1) throw new Error('unknown rating: ' + rating);
      var day = today();
      var s = hifzStore();
      var rec = s.pages[String(p)];
      if (!rec) return null;

      var wasQueue = queueOf(rec, day);
      reschedule(rec, rating, day);
      rec.lastReview = day;
      rec.history.push({ d: day, r: rating });
      if (rec.history.length > 12) rec.history = rec.history.slice(-12);

      /* A clean recitation is evidence the page's known weak spots have
         settled, so its slips fade rather than accumulating for ever. */
      if (rating === 'clean') {
        var r = Index.pageRange(p);
        for (var key in s.slips) {
          if (!Object.prototype.hasOwnProperty.call(s.slips, key)) continue;
          var g = +key;
          if (g < r[0] || g > r[1]) continue;
          s.slips[key].n -= 1;
          if (s.slips[key].n <= 0) delete s.slips[key];
        }
      }
      saveHifz(s);

      var range = Index.pageRange(p);
      Sessions.add({
        type: 'review', from: range[0], to: range[1],
        seconds: seconds || 0, manual: !seconds
      });
      return { page: rec, from: wasQueue };
    },

    /* The three queues, plus what is scheduled but not yet due. */
    queues: function (day) {
      day = day || today();
      var out = { sabaq: [], sabqi: [], manzil: [], later: [] };
      Hifz.all().forEach(function (rec) {
        var q = queueOf(rec, day);
        if (q === 'manzil' && !isDue(rec, day)) { out.later.push(rec); return; }
        out[q].push(rec);
      });
      /* Most overdue first — the pages closest to being lost come first. */
      out.manzil.sort(function (a, b) {
        var da = a.due ? daysBetween(a.due, day) : 9999;
        var db = b.due ? daysBetween(b.due, day) : 9999;
        return db - da;
      });
      out.later.sort(function (a, b) { return (a.due || '').localeCompare(b.due || ''); });
      return out;
    },

    /* ---- ayah-level slips ---- */

    slip: function (g) {
      var s = hifzStore();
      g = Index.clamp(g);
      var k = String(g);
      if (!s.slips[k]) s.slips[k] = { n: 0, last: 0 };
      s.slips[k].n++;
      s.slips[k].last = Date.now();
      saveHifz(s);
      return s.slips[k];
    },

    clearSlip: function (g) {
      var s = hifzStore();
      delete s.slips[String(g)];
      saveHifz(s);
    },

    slipsOn: function (p) {
      var r = Index.pageRange(p), s = hifzStore(), out = [];
      for (var k in s.slips) {
        if (!Object.prototype.hasOwnProperty.call(s.slips, k)) continue;
        var g = +k;
        if (g >= r[0] && g <= r[1]) out.push({ g: g, n: s.slips[k].n, last: s.slips[k].last });
      }
      return out.sort(function (a, b) { return a.g - b.g; });
    },

    /* Ranked by how often you slip and how recently. A page you stumbled on
       twice last week outranks one you stumbled on three times a year ago. */
    weakest: function (limit) {
      var s = hifzStore(), now = Date.now(), out = [];
      for (var k in s.slips) {
        if (!Object.prototype.hasOwnProperty.call(s.slips, k)) continue;
        var v = s.slips[k];
        var ageDays = (now - (v.last || now)) / 86400000;
        out.push({
          g: +k,
          n: v.n,
          last: v.last,
          /* halves every 30 days */
          score: v.n * Math.pow(0.5, ageDays / 30)
        });
      }
      out.sort(function (a, b) { return b.score - a.score; });
      return out.slice(0, limit || 20);
    },

    /* ---- overview ---- */

    stats: function (day) {
      requireIndex();
      day = day || today();
      var all = Hifz.all();
      var memorized = 0, learning = 0, due = 0, lapses = 0;
      all.forEach(function (rec) {
        if (rec.state === 'memorized') memorized++; else learning++;
        if (isDue(rec, day)) due++;
        lapses += rec.lapses || 0;
      });
      return {
        tracked: all.length,
        memorized: memorized,
        learning: learning,
        dueToday: due,
        lapses: lapses,
        totalPages: IDX.totalPages,
        pct: Math.round(memorized / IDX.totalPages * 100),
        /* Juz equivalent, which is how people actually describe their hifz. */
        juz: Math.round(memorized / (IDX.totalPages / IDX.totalJuz) * 10) / 10
      };
    },

    /* One entry per muṣḥaf page for the coverage map. `heat` is 0..1, where 1
       means "reviewed just now" and 0 means "overdue by a full interval". */
    coverage: function (day) {
      requireIndex();
      day = day || today();
      var s = hifzStore(), out = [];
      for (var p = 1; p <= IDX.totalPages; p++) {
        var rec = s.pages[String(p)];
        if (!rec) { out.push({ p: p, state: 'none', heat: 0, due: null }); continue; }
        var q = queueOf(rec, day);
        var heat = 1;
        if (rec.lastReview) {
          var since = daysBetween(rec.lastReview, day);
          var span = Math.max(1, rec.interval || 1);
          heat = Math.max(0, Math.min(1, 1 - since / (span * 2)));
        } else if (rec.state === 'memorized') {
          heat = 0.5;
        }
        out.push({ p: p, state: rec.state, queue: q, heat: heat, due: rec.due,
                   overdue: rec.due ? Math.max(0, daysBetween(rec.due, day)) : 0 });
      }
      return out;
    },

    /* What a page's ayah range is, in one call, so callers do not each have to
       remember that hifz is page-indexed and sessions are ayah-indexed. */
    rangeOf: function (p) { return Index.pageRange(p); },

    ratings: RATINGS
  };

  /* ---------------- marks ----------------
     Coloured bookmarks. A mark is a range — one ayah is just a range of one —
     belonging to a category, optionally carrying a note.

     Categories are data, not constants. A fixed list never fits everyone and a
     bare colour is undecipherable months later, so the app ships a working set
     and lets the reader rename, recolour, add and delete. Deleting a category
     therefore has to say what happens to its marks; see removeCat. */

  var DEFAULT_CATS = [
    { id: 'tadabbur', name: 'للتدبّر',      color: '#A67C34' },
    { id: 'hifz',     name: 'للحفظ',        color: '#0E3B39' },
    { id: 'dua',      name: 'دعاء',         color: '#5A6BC0' },
    { id: 'question', name: 'سؤال',         color: '#7A3F1D' },
    { id: 'slip',     name: 'موضع تعثّر',   color: '#B4413B' }
  ];

  function marksStore() {
    var s = read(K.marks, null);
    if (!s || typeof s !== 'object') s = {};
    if (!Array.isArray(s.cats) || !s.cats.length) {
      s.cats = DEFAULT_CATS.map(function (c) { return { id: c.id, name: c.name, color: c.color }; });
    }
    if (!Array.isArray(s.items)) s.items = [];
    return s;
  }
  function saveMarks(s) { return write(K.marks, s); }

  /* The reader shipped with a plain {surah: [ayah]} bookmark map. Those are
     real bookmarks somebody made, so they are carried over into the new model
     the first time this runs rather than being dropped on the floor. The old
     key is left in place — untouched, in case anything else still reads it. */
  function migrateBookmarks(s) {
    if (s.migrated) return false;
    s.migrated = true;
    var old = read('quran.bookmarks.v1', null);
    if (!old || typeof old !== 'object') return false;

    var moved = 0;
    for (var sid in old) {
      if (!Object.prototype.hasOwnProperty.call(old, sid)) continue;
      var list = old[sid];
      if (!Array.isArray(list)) continue;
      for (var i = 0; i < list.length; i++) {
        var g = Index.toGlobal(+sid, list[i]);
        s.items.push({
          id: uid('m_'), cat: 'tadabbur', from: g, to: g,
          note: '', at: Date.now(), legacy: true
        });
        moved++;
      }
    }
    return moved;
  }

  var Marks = {
    /* ---- categories ---- */

    cats: function () { return marksStore().cats; },

    cat: function (id) {
      var cs = marksStore().cats;
      for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
      return null;
    },

    addCat: function (name, color) {
      var s = marksStore();
      var c = {
        id: uid('c_'),
        name: (name || '').trim() || 'تصنيف',
        color: color || '#0E3B39'
      };
      s.cats.push(c);
      saveMarks(s);
      return c;
    },

    updateCat: function (id, patch) {
      var s = marksStore();
      for (var i = 0; i < s.cats.length; i++) {
        if (s.cats[i].id !== id) continue;
        if (patch.name != null) s.cats[i].name = String(patch.name).trim() || s.cats[i].name;
        if (patch.color != null) s.cats[i].color = patch.color;
        saveMarks(s);
        return s.cats[i];
      }
      return null;
    },

    /* `moveTo` names the category the orphaned marks join. Passing nothing
       deletes them with the category, which is destructive enough that the UI
       asks first. The last category cannot be removed — a mark with nowhere to
       belong is not representable. */
    removeCat: function (id, moveTo) {
      var s = marksStore();
      if (s.cats.length <= 1) return false;
      s.cats = s.cats.filter(function (c) { return c.id !== id; });
      if (moveTo) {
        s.items.forEach(function (m) { if (m.cat === id) m.cat = moveTo; });
      } else {
        s.items = s.items.filter(function (m) { return m.cat !== id; });
      }
      saveMarks(s);
      return true;
    },

    /* ---- marks ---- */

    list: function (filter) {
      var s = marksStore();
      var out = s.items;
      if (filter && filter.cat) {
        out = out.filter(function (m) { return m.cat === filter.cat; });
      }
      if (filter && filter.surah) {
        var r = Index.surahRange(filter.surah);
        out = out.filter(function (m) { return m.to >= r[0] && m.from <= r[1]; });
      }
      return out.slice().sort(function (a, b) { return a.from - b.from || a.to - b.to; });
    },

    get: function (id) {
      var items = marksStore().items;
      for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
      return null;
    },

    add: function (spec) {
      requireIndex();
      var s = marksStore();
      var from = Index.clamp(spec.from);
      var to = Index.clamp(spec.to == null ? spec.from : spec.to);
      if (to < from) { var t = from; from = to; to = t; }

      var cat = spec.cat && Marks.cat(spec.cat) ? spec.cat : s.cats[0].id;

      /* Marking the same span in the same category twice is a mis-tap, not an
         intention — the existing one is returned so the caller can treat the
         gesture as idempotent. */
      for (var i = 0; i < s.items.length; i++) {
        var m = s.items[i];
        if (m.cat === cat && m.from === from && m.to === to) return m;
      }

      var rec = {
        id: uid('m_'), cat: cat, from: from, to: to,
        note: spec.note || '', at: Date.now()
      };
      s.items.push(rec);
      saveMarks(s);
      return rec;
    },

    update: function (id, patch) {
      var s = marksStore();
      for (var i = 0; i < s.items.length; i++) {
        if (s.items[i].id !== id) continue;
        if (patch.cat != null && Marks.cat(patch.cat)) s.items[i].cat = patch.cat;
        if (patch.note != null) s.items[i].note = String(patch.note);
        if (patch.from != null) s.items[i].from = Index.clamp(patch.from);
        if (patch.to != null) s.items[i].to = Index.clamp(patch.to);
        if (s.items[i].to < s.items[i].from) {
          var t = s.items[i].from; s.items[i].from = s.items[i].to; s.items[i].to = t;
        }
        saveMarks(s);
        return s.items[i];
      }
      return null;
    },

    remove: function (id) {
      var s = marksStore();
      var before = s.items.length;
      s.items = s.items.filter(function (m) { return m.id !== id; });
      if (s.items.length !== before) saveMarks(s);
      return before - s.items.length;
    },

    /* Toggle a single-ayah mark in one category — what a tap on a chip does. */
    toggle: function (g, cat) {
      var s = marksStore();
      g = Index.clamp(g);
      for (var i = 0; i < s.items.length; i++) {
        var m = s.items[i];
        if (m.cat === cat && m.from === g && m.to === g) {
          s.items.splice(i, 1);
          saveMarks(s);
          return null;
        }
      }
      return Marks.add({ cat: cat, from: g, to: g });
    },

    /* ---- lookup ---- */

    at: function (g) {
      g = Index.clamp(g);
      return marksStore().items.filter(function (m) { return g >= m.from && g <= m.to; });
    },

    inRange: function (from, to) {
      return marksStore().items
        .filter(function (m) { return m.to >= from && m.from <= to; })
        .sort(function (a, b) { return a.from - b.from; });
    },

    onPage: function (p) {
      var r = Index.pageRange(p);
      return Marks.inRange(r[0], r[1]);
    },

    /* ayah index -> the categories covering it, for painting a page in one
       pass instead of asking per ayah */
    mapOver: function (from, to) {
      var out = {};
      Marks.inRange(from, to).forEach(function (m) {
        for (var g = Math.max(m.from, from); g <= Math.min(m.to, to); g++) {
          if (!out[g]) out[g] = [];
          if (out[g].indexOf(m.cat) === -1) out[g].push(m.cat);
        }
      });
      return out;
    },

    counts: function () {
      var out = {};
      marksStore().items.forEach(function (m) { out[m.cat] = (out[m.cat] || 0) + 1; });
      return out;
    },

    /* Runs once, on first read of the new store. */
    migrate: function () {
      var s = marksStore();
      var n = migrateBookmarks(s);
      if (n !== false) saveMarks(s);
      return n;
    },

    defaults: DEFAULT_CATS
  };

  /* ---------------- stats ---------------- */

  var Stats = {
    /* Consecutive days ending today, or ending yesterday when today has not
       been read yet — so the streak is not "broken" at midnight while the day
       is still open. */
    streak: function (type) {
      var days = Sessions.byDay(type);
      var cur = today();
      if (!days[cur]) {
        cur = addDays(cur, -1);
        if (!days[cur]) return 0;
      }
      var n = 0;
      while (days[cur]) { n++; cur = addDays(cur, -1); }
      return n;
    },

    longestStreak: function (type) {
      var keys = Object.keys(Sessions.byDay(type)).sort();
      var best = 0, run = 0, prev = null;
      for (var i = 0; i < keys.length; i++) {
        run = (prev && daysBetween(prev, keys[i]) === 1) ? run + 1 : 1;
        if (run > best) best = run;
        prev = keys[i];
      }
      return best;
    },

    /* Last `n` days, oldest first — what the heatmap renders. */
    heatmap: function (n, type) {
      var days = Sessions.byDay(type);
      var out = [];
      var k = addDays(today(), -(n - 1));
      for (var i = 0; i < n; i++) {
        out.push({ day: k, data: days[k] || null });
        k = addDays(k, 1);
      }
      return out;
    },

    /* Ayahs per minute, from timed sessions only, most recent first. Returns
       null until there is enough evidence to be worth showing. */
    pace: function (type, sample) {
      var all = read(K.sessions, [])
        .filter(function (s) { return (!type || s.type === type) && s.seconds > 30; })
        .sort(function (a, b) { return b.at - a.at; })
        .slice(0, sample || 20);
      if (all.length < 3) return null;
      var ayahs = 0, secs = 0;
      for (var i = 0; i < all.length; i++) {
        ayahs += all[i].to - all[i].from + 1;
        secs += all[i].seconds;
      }
      if (!secs) return null;
      return { ayahsPerMin: ayahs / (secs / 60), samples: all.length };
    },

    /* Minutes a range would take at the reader's own measured pace. */
    estimateMinutes: function (from, to, type) {
      var p = Stats.pace(type);
      if (!p || !p.ayahsPerMin) return null;
      return (to - from + 1) / p.ayahsPerMin;
    },

    totals: function (type) {
      var all = read(K.sessions, []).filter(function (s) { return !type || s.type === type; });
      var secs = 0;
      for (var i = 0; i < all.length; i++) secs += all[i].seconds;
      var cov = Sessions.coverage(type);
      return {
        sessions: all.length,
        seconds: secs,
        ayahsCovered: measure(cov),
        pctOfQuran: IDX ? Math.round(measure(cov) / IDX.totalAyahs * 100) : 0
      };
    }
  };

  /* ---------------- export / import ----------------
     localStorage is per-browser and one "clear site data" from wiping. With no
     server behind it, an export button is the whole backup story — and the
     migration path if this ever moves to a real database. */

  var IO = {
    export: function () {
      var out = { format: 'quran-tracker', version: 1, exportedAt: new Date().toISOString(), data: {} };
      for (var name in K) {
        if (!Object.prototype.hasOwnProperty.call(K, name)) continue;
        var v = read(K[name], null);
        if (v !== null) out.data[name] = v;
      }
      /* The reader's own keys ride along — a backup that loses your bookmarks
         is not a backup. */
      out.data.bookmarks = read('quran.bookmarks.v1', null);
      out.data.settings = read('quran.settings.v1', null);
      out.data.last = read('quran.last.v1', null);
      return out;
    },

    filename: function () {
      return 'quran-tracker-' + today() + '.json';
    },

    /* mode 'replace' overwrites; 'merge' unions sessions and plans by id, which
       is what you want when two devices have both been used. */
    import: function (obj, mode) {
      if (!obj || obj.format !== 'quran-tracker') throw new Error('ملف غير معروف');
      var d = obj.data || {};
      var replace = mode !== 'merge';

      if (replace) {
        for (var name in K) {
          if (!Object.prototype.hasOwnProperty.call(K, name)) continue;
          if (d[name] != null) write(K[name], d[name]);
        }
      } else {
        if (d.sessions) write(K.sessions, mergeById(read(K.sessions, []), d.sessions));
        if (d.plans)    write(K.plans,    mergeById(read(K.plans, []),    d.plans));
        if (d.hifz)     write(K.hifz,     Object.assign({}, d.hifz, read(K.hifz, {})));
        if (d.notes)    write(K.notes,    mergeById(read(K.notes, []),    d.notes));
      }

      if (d.bookmarks) write('quran.bookmarks.v1', d.bookmarks);
      if (d.settings && replace) write('quran.settings.v1', d.settings);
      if (d.last) write('quran.last.v1', d.last);
      return true;
    },

    /* Rough bytes used by this app's keys. localStorage caps around 5MB and
       gives no warning before it throws, so the dashboard watches this. */
    bytes: function () {
      var n = 0;
      var keys = ['quran.bookmarks.v1', 'quran.settings.v1', 'quran.last.v1'];
      for (var name in K) if (Object.prototype.hasOwnProperty.call(K, name)) keys.push(K[name]);
      for (var i = 0; i < keys.length; i++) {
        try { var v = localStorage.getItem(keys[i]); if (v) n += v.length * 2; } catch (e) {}
      }
      return n;
    },

    clear: function () {
      for (var name in K) {
        if (!Object.prototype.hasOwnProperty.call(K, name)) continue;
        try { localStorage.removeItem(K[name]); } catch (e) {}
      }
    }
  };

  function mergeById(mine, theirs) {
    var seen = {};
    var out = [];
    var push = function (x) { if (x && x.id && !seen[x.id]) { seen[x.id] = 1; out.push(x); } };
    mine.forEach(push);
    theirs.forEach(push);
    return out;
  }

  /* ---------------- formatting helpers ----------------
     Shared so the dashboard and the reader's session bar phrase things the
     same way. */

  var Fmt = {
    ar: ar,

    duration: function (seconds) {
      var m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
      if (m >= 60) {
        var h = Math.floor(m / 60);
        return ar(h) + ' س ' + ar(m % 60) + ' د';
      }
      if (m) return ar(m) + ' د ' + ar(s) + ' ث';
      return ar(s) + ' ث';
    },

    clock: function (ms) {
      var t = Math.floor(ms / 1000);
      var m = Math.floor(t / 60), s = t % 60;
      return ar(pad2(m)) + ':' + ar(pad2(s));
    },

    units: function (n, unit) {
      if (unit === 'page') return ar(n) + (n === 1 ? ' صفحة' : ' صفحات');
      return ar(n) + ' آية';
    },

    /* '١٤ أغسطس' — month names spelled the way the rest of the site does. */
    dayLabel: function (key) {
      var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      var d = keyToDate(key);
      return ar(d.getDate()) + ' ' + MONTHS[d.getMonth()];
    },

    relativeDay: function (key) {
      var n = daysBetween(today(), key);
      if (n === 0) return 'اليوم';
      if (n === 1) return 'غداً';
      if (n === -1) return 'أمس';
      if (n > 0) return 'بعد ' + ar(n) + ' يوماً';
      return 'قبل ' + ar(-n) + ' يوماً';
    }
  };

  /* ---------------- boot ---------------- */

  function init() {
    IDX = root.QURAN_INDEX || null;
    META = root.QURAN_SURAHS || null;
    byId = {};
    if (META) for (var i = 0; i < META.length; i++) byId[META[i].id] = META[i];
    return !!IDX;
  }

  /* The legacy bookmark map is folded in on first load rather than behind a
     button nobody would press. */
  function initMarks() { try { Marks.migrate(); } catch (e) {} }

  root.QuranTracker = {
    init: init,
    ready: function () { return !!IDX; },
    keys: K,
    index: Index,
    sessions: Sessions,
    live: Live,
    plans: Plans,
    hifz: Hifz,
    marks: Marks,
    stats: Stats,
    io: IO,
    fmt: Fmt,
    date: { today: today, dayKey: dayKey, addDays: addDays, daysBetween: daysBetween },
    /* exposed for the test harness */
    _internal: { normalize: normalize, clipTo: clipTo, measure: measure, firstGap: firstGap,
                 scopeRange: scopeRange, scopeLabel: scopeLabel,
                 queueOf: queueOf, isDue: isDue, reschedule: reschedule,
                 blankPage: blankPage, DEFAULT_PREFS: DEFAULT_PREFS }
  };

  if (init()) initMarks();

}(typeof window !== 'undefined' ? window : this));
