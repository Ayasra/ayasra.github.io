/* =========================================================================
   Sync — the same store, on more than one device.

   The hard part is not here. Reconciling two divergent copies lives in
   tracker.js, was written and tested before any of this existed, and this file
   only moves bytes between that merge and somewhere durable.

   ---------------------------------------------------------------------
   Shape on the wire
   ---------------------------------------------------------------------
   Two pieces, because they grow differently.

     state    plans, memorised pages, marks, categories, preferences, the
              graves, where you stopped reading. Bounded — a few hundred
              kilobytes at the very most — so it is one document, rewritten
              whole whenever any of it changes.

     chunks   the session log, cut into calendar months. It only ever grows,
              and a decade of daily reading would outgrow a single document.
              A month that has passed can never change again, so it is written
              once and then only ever read. Only the current month, and any
              older month a delete has touched, are ever written again.

   ---------------------------------------------------------------------
   The adapter
   ---------------------------------------------------------------------
   Everything vendor-specific is behind one small interface, so Firestore is an
   implementation rather than an assumption — and so the whole engine can be
   driven by an in-memory stand-in in the harness, where no network exists.

     init()                  -> Promise
     onUser(cb)              -> unsubscribe;  cb(user|null)
     signIn() / signOut()    -> Promise
     pull(uid, since)        -> Promise<{ state, chunks }>
     push(uid, payload)      -> Promise
     watch(uid, cb)          -> unsubscribe;  cb() when the remote changed
   ========================================================================= */
(function (root) {
  'use strict';

  var QT = root.QuranTracker;
  if (!QT) return;

  var PUSH_DEBOUNCE = 1500;   /* ms of quiet before a local change is sent */
  var SIG_KEY = 'quran.sync.v1';

  /* ---------------- what we know about the remote ----------------
     Kept locally so a second run does not re-send months that have not moved.
     Signatures only — never the data itself. */

  function meta() {
    try { return JSON.parse(localStorage.getItem(SIG_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveMeta(m) {
    try { localStorage.setItem(SIG_KEY, JSON.stringify(m)); } catch (e) {}
  }

  /* Cheap, stable, and enough to answer "has this month changed since I last
     sent it". Not a security hash and not trying to be. */
  function signature(list) {
    var ids = list.map(function (x) { return x.id; }).sort().join(',');
    var h = 5381;
    for (var i = 0; i < ids.length; i++) h = ((h * 33) ^ ids.charCodeAt(i)) >>> 0;
    return list.length + ':' + h.toString(36);
  }

  /* ---------------- the local snapshot, cut for the wire ---------------- */

  function monthOf(ms) {
    var d = new Date(ms || Date.now());
    return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
  }

  function chunkSessions(sessions) {
    var out = {};
    for (var i = 0; i < sessions.length; i++) {
      var k = monthOf(sessions[i].at);
      (out[k] || (out[k] = [])).push(sessions[i]);
    }
    return out;
  }

  /* Everything except the session log — the part that fits in one document. */
  function localState() {
    var dump = QT.io.export();
    var d = dump.data || {};
    delete d.sessions;
    return { format: dump.format, version: dump.version, data: d, at: Date.now() };
  }

  function localChunks() {
    return chunkSessions(QT.sessions.list());
  }

  /* ---------------- applying what came back ----------------
     Reassembled into the same document shape an export produces, then handed
     to the merge, which is the only thing that decides what wins. */

  function applyRemote(remote) {
    if (!remote) return;
    var sessions = [];
    var chunks = remote.chunks || {};
    for (var k in chunks) {
      if (!Object.prototype.hasOwnProperty.call(chunks, k)) continue;
      var list = chunks[k];
      if (Array.isArray(list)) sessions = sessions.concat(list);
    }

    var doc = remote.state && remote.state.data
      ? { format: 'quran-tracker', version: 1, data: remote.state.data }
      : { format: 'quran-tracker', version: 1, data: {} };
    doc.data.sessions = sessions;

    /* Merge, never replace. The whole point of the previous pass. */
    QT.io.import(doc, 'merge');
  }

  /* ---------------- the engine ---------------- */

  var adapter = null;
  var user = null;
  var status = 'off';          /* off | ready | signed-in | syncing | error */
  var lastError = null;
  var lastSyncAt = 0;
  var pushTimer = null;
  var unwatch = null;
  var unchange = null;
  var busy = false;
  var pending = false;
  var listeners = [];

  function setStatus(s, err) {
    status = s;
    lastError = err || null;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](Sync.state()); } catch (e) {}
    }
  }

  function schedulePush() {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { Sync.push(); }, PUSH_DEBOUNCE);
  }

  var Sync = {
    /* ---- wiring ---- */

    configure: function (a) {
      adapter = a;
      return adapter.init().then(function () {
        setStatus('ready');
        if (unwatch) { unwatch(); unwatch = null; }
        adapter.onUser(function (u) {
          user = u;
          if (u) {
            setStatus('signed-in');
            Sync.start();
          } else {
            Sync.stop();
            setStatus('ready');
          }
        });
      }).catch(function (e) {
        setStatus('error', e && e.message || String(e));
        throw e;
      });
    },

    state: function () {
      return {
        status: status,
        configured: !!adapter,
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
        lastSyncAt: lastSyncAt,
        error: lastError
      };
    },

    onState: function (cb) {
      listeners.push(cb);
      try { cb(Sync.state()); } catch (e) {}
      return function () {
        var i = listeners.indexOf(cb);
        if (i !== -1) listeners.splice(i, 1);
      };
    },

    signIn: function () {
      if (!adapter) return Promise.reject(new Error('sync is not configured'));
      return adapter.signIn().catch(function (e) {
        setStatus('error', e && e.message || String(e));
        throw e;
      });
    },

    signOut: function () {
      if (!adapter) return Promise.resolve();
      return adapter.signOut();
    },

    /* ---- the loop ---- */

    start: function () {
      if (!adapter || !user) return Promise.resolve();

      /* Local edits are pushed after a pause, so a burst of writes — marking
         five ayahs in a row — becomes one write rather than five. */
      if (!unchange) unchange = QT.onChange(function () { schedulePush(); });

      /* And the remote tells us when it moved, rather than being polled. */
      if (!unwatch && adapter.watch) {
        unwatch = adapter.watch(user.id, function () { Sync.pull(); });
      }
      return Sync.sync();
    },

    stop: function () {
      clearTimeout(pushTimer);
      if (unchange) { unchange(); unchange = null; }
      if (unwatch) { unwatch(); unwatch = null; }
    },

    /* Pull, then push: adopt whatever is out there before offering ours, so a
       first sign-in on a second device gains the history rather than
       overwriting it. */
    sync: function () {
      return Sync.pull().then(function () { return Sync.push(true); });
    },

    pull: function () {
      if (!adapter || !user) return Promise.resolve(false);
      setStatus('syncing');
      return adapter.pull(user.id).then(function (remote) {
        applyRemote(remote);
        lastSyncAt = Date.now();
        setStatus('signed-in');
        return true;
      }).catch(function (e) {
        setStatus('error', e && e.message || String(e));
        return false;
      });
    },

    push: function (force) {
      if (!adapter || !user) return Promise.resolve(false);

      /* One push at a time. Anything that arrives while one is in flight sets
         a flag and is sent immediately after, so nothing is dropped and
         nothing races. */
      if (busy) { pending = true; return Promise.resolve(false); }
      busy = true;
      setStatus('syncing');

      var m = meta();
      var sigs = m.chunks || {};
      var chunks = localChunks();
      var send = {};
      var nextSigs = {};

      for (var k in chunks) {
        if (!Object.prototype.hasOwnProperty.call(chunks, k)) continue;
        var sig = signature(chunks[k]);
        nextSigs[k] = sig;
        /* A month that has not moved since it was last sent is not sent again.
           Past months never move, so after the first sync this is one write. */
        if (force || sigs[k] !== sig) send[k] = chunks[k];
      }

      var payload = { state: localState(), chunks: send };

      return adapter.push(user.id, payload).then(function () {
        m.chunks = nextSigs;
        m.at = Date.now();
        saveMeta(m);
        lastSyncAt = m.at;
        setStatus('signed-in');
        return true;
      }).catch(function (e) {
        setStatus('error', e && e.message || String(e));
        return false;
      }).then(function (okv) {
        busy = false;
        if (pending) { pending = false; schedulePush(); }
        return okv;
      });
    },

    /* exposed for the harness */
    _internal: {
      chunkSessions: chunkSessions,
      signature: signature,
      monthOf: monthOf,
      localState: localState,
      applyRemote: applyRemote,
      meta: meta
    }
  };

  root.QuranSync = Sync;
}(typeof window !== 'undefined' ? window : this));
