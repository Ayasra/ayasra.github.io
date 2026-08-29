/* =========================================================================
   The Firestore adapter — one implementation of the interface sync.js
   describes, and the only file in the section that knows Firebase exists.

   Loaded lazily and never touched unless a reader actually opts into sync, so
   the app costs exactly what it always did for everyone else. That is why the
   modules are imported inside init() rather than at the top of the file.

   Layout, per signed-in reader:

     users/{uid}/store/state          one document: plans, hifz, marks, graves
     users/{uid}/store/months/{YYYY-MM}   the session log, a month per document

   A past month can never change, so after the first sync only the current one
   is ever written.
   ========================================================================= */
(function (root) {
  'use strict';

  function cfgOK(c) {
    return !!(c && c.apiKey && c.projectId && c.appId);
  }

  var mod = {};          /* the Firebase functions, once imported */
  var app = null, auth = null, db = null;

  function base(v) { return 'https://www.gstatic.com/firebasejs/' + v + '/'; }

  var Adapter = {
    name: 'firestore',

    available: function () { return cfgOK(root.QURAN_FIREBASE); },

    init: function () {
      var cfg = root.QURAN_FIREBASE;
      if (!cfgOK(cfg)) {
        return Promise.reject(new Error('Firebase is not configured — see assets/sync-config.js'));
      }
      var v = root.QURAN_FIREBASE_SDK || '10.12.5';

      return Promise.all([
        import(base(v) + 'firebase-app.js'),
        import(base(v) + 'firebase-auth.js'),
        import(base(v) + 'firebase-firestore.js')
      ]).then(function (m) {
        mod.app = m[0]; mod.auth = m[1]; mod.fs = m[2];

        app = mod.app.initializeApp(cfg);
        auth = mod.auth.getAuth(app);

        /* Firestore keeps its own local copy and replays writes made offline
           when a connection returns. That is most of what this app needs, and
           the main reason for choosing it: reading happens on a phone, often
           with no signal, and a queue written by hand is the layer most likely
           to lose somebody's records. */
        try {
          db = mod.fs.initializeFirestore(app, {
            localCache: mod.fs.persistentLocalCache({
              tabManager: mod.fs.persistentMultipleTabManager()
            })
          });
        } catch (e) {
          /* Private browsing, or several tabs on an engine that will not share
             the cache. Sync still works; it just holds nothing locally. */
          db = mod.fs.getFirestore(app);
        }
      });
    },

    onUser: function (cb) {
      return mod.auth.onAuthStateChanged(auth, function (u) {
        cb(u ? { id: u.uid, name: u.displayName || '', email: u.email || '' } : null);
      });
    },

    signIn: function () {
      var provider = new mod.auth.GoogleAuthProvider();
      /* A popup keeps the reader on the page they were on. Some in-app
         browsers refuse it, so a redirect is the fallback rather than a dead
         button. */
      return mod.auth.signInWithPopup(auth, provider).catch(function (e) {
        var code = e && e.code || '';
        if (/popup-blocked|popup-closed|operation-not-supported/.test(code)) {
          return mod.auth.signInWithRedirect(auth, provider);
        }
        throw e;
      });
    },

    signOut: function () { return mod.auth.signOut(auth); },

    /* ---- documents ---- */

    stateRef: function (uid) {
      return mod.fs.doc(db, 'users', uid, 'store', 'state');
    },
    monthsRef: function (uid) {
      return mod.fs.collection(db, 'users', uid, 'store', 'state', 'months');
    },

    pull: function (uid) {
      return Promise.all([
        mod.fs.getDoc(Adapter.stateRef(uid)),
        mod.fs.getDocs(Adapter.monthsRef(uid))
      ]).then(function (r) {
        var state = r[0].exists() ? r[0].data() : null;
        var chunks = {};
        r[1].forEach(function (d) {
          var v = d.data();
          chunks[d.id] = Array.isArray(v.sessions) ? v.sessions : [];
        });
        return { state: state, chunks: chunks };
      });
    },

    push: function (uid, payload) {
      var writes = [];
      if (payload.state) {
        writes.push(mod.fs.setDoc(Adapter.stateRef(uid), payload.state));
      }
      var chunks = payload.chunks || {};
      for (var k in chunks) {
        if (!Object.prototype.hasOwnProperty.call(chunks, k)) continue;
        writes.push(mod.fs.setDoc(
          mod.fs.doc(db, 'users', uid, 'store', 'state', 'months', k),
          { sessions: chunks[k], at: Date.now() }
        ));
      }
      return Promise.all(writes);
    },

    /* Watching the state document alone is enough to know something moved:
       every push writes it, because the graves and the record stamps live
       there and any change touches one of them. */
    watch: function (uid, cb) {
      return mod.fs.onSnapshot(Adapter.stateRef(uid), function (snap) {
        /* Ignore the echo of our own write coming back from the server. */
        if (snap.metadata && snap.metadata.hasPendingWrites) return;
        cb();
      }, function () { /* transient; the next pull will catch up */ });
    }
  };

  root.QuranSyncFirestore = Adapter;
}(typeof window !== 'undefined' ? window : this));
