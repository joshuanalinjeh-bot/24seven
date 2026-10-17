/* =========================================================
   24 SEVEN Sound Hub — admin logic
   - Verifies the admin login (username/password)
   - Multi-file uploads: pictures, videos, music, albums
   - Library (show/hide, cover photos, delete) and site settings
   Data is saved in localStorage 'portfolio_media'.
   ========================================================= */
(function () {
  'use strict';

  var MEDIA_KEY = 'portfolio_media';
  var SETTINGS_KEY = 'portfolio_settings';
  var ACCOUNT_KEY = 'portfolio_admin_account'; // { u, salt, hash } — created once, no default password
  var MAX_BYTES = 100 * 1024 * 1024; // 100MB per file
  var STORAGE_BUDGET_MB = 5;         // typical localStorage limit

  var DEFAULTS = {
    heroTitle: 'Graphic Designer Portfolio',
    heroSubtitle: 'Curated creative works — exploring photography, motion, and sound. Designed for clients, crafted with detail.',
    views: '12.4k', clients: '36', downloads: '1.8k',
    email: '', phone: '', location: '',
    about: 'Graphic designer working across photography, motion and sound.'
  };

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'class') n.className = props[k];
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function svgEl(name, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function isSafeData(src) { return typeof src === 'string' && /^data:(image|video|audio)\//.test(src); }
  function fmtSize(b) {
    if (b < 1024) return b + 'B';
    if (b < 1048576) return (b / 1024).toFixed(0) + 'KB';
    return (b / 1048576).toFixed(1) + 'MB';
  }
  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function toast(msg, isError) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 4200);
  }
  function isQuota(err) {
    return err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
  }

  /* ---------- data ---------- */
  function loadMedia() { var m = readJSON(MEDIA_KEY, []); return Array.isArray(m) ? m : []; }
  function saveMedia(arr) {
    try { localStorage.setItem(MEDIA_KEY, JSON.stringify(arr)); return true; }
    catch (err) {
      toast(isQuota(err)
        ? 'Browser storage is full (localStorage holds about 5MB). Delete items or use smaller files.'
        : 'Could not save: ' + err.message, true);
      return false;
    }
  }
  function getSettings() {
    var s = readJSON(SETTINGS_KEY, {});
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = (s && s[k] != null && s[k] !== '') ? s[k] : DEFAULTS[k]; });
    return out;
  }
  /* ---------- admin account (stored as a salted hash, never the password) ---------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var pow = Math.pow, maxWord = pow(2, 32), result = '', i, j;
    var words = [], hash = [], k = [], primeCounter = 0, isComposite = {};
    ascii = unescape(encodeURIComponent(ascii)); // UTF-8
    var bitLen = ascii.length * 8;
    for (var cand = 2; primeCounter < 64; cand++) {
      if (!isComposite[cand]) {
        for (i = 0; i < 313; i += cand) isComposite[i] = cand;
        hash[primeCounter] = (pow(cand, 0.5) * maxWord) | 0;
        k[primeCounter++] = (pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10)) | 0));
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
  }
  function slowHash(salt, pass) {
    var h = pass;
    for (var i = 0; i < 2000; i++) h = sha256(salt + ':' + h);
    return h;
  }
  function randomSalt() {
    var a = new Uint8Array(12);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
  }
  function getAccount() {
    var a = readJSON(ACCOUNT_KEY, null);
    return (a && a.u && a.salt && a.hash) ? a : null;
  }
  function hasAccount() { return !!getAccount(); }
  function normUser(u) { return String(u || '').trim().toLowerCase(); }
  // Creates the one admin account. Refuses if one already exists.
  function createAccount(u, p) {
    if (hasAccount()) return 'An administrator account already exists. Please log in.';
    u = normUser(u);
    if (u.length < 3) return 'Username must be at least 3 characters.';
    if (!p || p.length < 6) return 'Password must be at least 6 characters.';
    var salt = randomSalt();
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ u: u, salt: salt, hash: slowHash(salt, p) })); }
    catch (err) { return 'Could not save the account: ' + err.message; }
    return '';
  }
  function checkLogin(u, p) {
    var a = getAccount();
    return !!a && normUser(u) === a.u && slowHash(a.salt, p) === a.hash;
  }
  function countFiles(items, type) {
    return items.filter(function (m) { return m.type === type && Array.isArray(m.files); })
      .reduce(function (n, m) { return n + m.files.length; }, 0);
  }

  /* =======================================================
     AUTH
     ======================================================= */
  function showApp() {
    $('adminLoginModal').hidden = true;
    $('adminApp').hidden = false;
    initApp();
  }
  /* ---------- email alerts + confirmation codes (EmailJS) ---------- */
  var SECURITY_KEY = 'portfolio_security';   // { serviceId, templateId, publicKey, requireCode, tested }
  var GUARD_KEY = 'portfolio_login_guard';   // { fails, lockUntil, lastAlert }
  var LOG_KEY = 'portfolio_security_log';
  var MAX_FAILS = 5, LOCK_MIN = 15, CODE_TTL_MIN = 10, CODE_TRIES = 5;

  function getSec() {
    var s = readJSON(SECURITY_KEY, {});
    return { serviceId: s.serviceId || '', templateId: s.templateId || '', publicKey: s.publicKey || '', requireCode: !!s.requireCode, tested: !!s.tested };
  }
  function saveSec(s) { try { localStorage.setItem(SECURITY_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function adminEmail() { return String((readJSON(SETTINGS_KEY, {}) || {}).email || '').trim(); }
  function emailConfigured() { var s = getSec(); return !!(s.serviceId && s.templateId && s.publicKey && adminEmail()); }
  function needsCode() { var s = getSec(); return s.requireCode && s.tested && emailConfigured(); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function maskEmail(e) { var p = String(e).split('@'); return p.length < 2 ? e : p[0].charAt(0) + '***@' + p[1]; }

  // Sends one email through EmailJS (the browser cannot send email by itself).
  function sendEmailWith(cfg, to, subject, message, extra) {
    if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) return Promise.reject(new Error('EmailJS is not set up yet.'));
    if (!to) return Promise.reject(new Error('No email address saved in Contact & About.'));
    var params = { to_email: to, subject: subject, message: message, site: '24 SEVEN Sound Hub' };
    Object.keys(extra || {}).forEach(function (k) { params[k] = extra[k]; });
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey, template_params: params })
    }).then(function (r) {
      return r.text().then(function (t) { if (!r.ok) throw new Error(t || ('HTTP ' + r.status)); return true; });
    });
  }
  function sendEmail(subject, message, extra) { return sendEmailWith(getSec(), adminEmail(), subject, message, extra); }

  /* ---------- failed-attempt guard + security log ---------- */
  function getGuard() { var g = readJSON(GUARD_KEY, {}); return { fails: g.fails || 0, lockUntil: g.lockUntil || 0, lastAlert: g.lastAlert || 0 }; }
  function saveGuard(g) { try { localStorage.setItem(GUARD_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ } }
  function lockedMinutes() { var left = getGuard().lockUntil - Date.now(); return left > 0 ? Math.ceil(left / 60000) : 0; }
  function logEvent(type, user) {
    var l = readJSON(LOG_KEY, []);
    if (!Array.isArray(l)) l = [];
    l.unshift({ t: new Date().toISOString(), type: type, user: String(user || '').slice(0, 40) });
    try { localStorage.setItem(LOG_KEY, JSON.stringify(l.slice(0, 50))); } catch (e) { /* ignore */ }
  }
  // Records a failed attempt, locks after too many, and emails the admin. Returns true when now locked.
  function recordFailure(user, kind) {
    var g = getGuard(), locked = false, now = Date.now();
    g.fails += 1;
    if (g.fails >= MAX_FAILS) { g.lockUntil = now + LOCK_MIN * 60000; g.fails = 0; locked = true; }
    var alertNow = emailConfigured() && now - g.lastAlert > 120000; // at most one email every 2 minutes
    if (alertNow) g.lastAlert = now;
    saveGuard(g);
    logEvent(locked ? 'locked' : kind, user);
    if (alertNow) {
      var what = kind === 'code_failed' ? 'entered a wrong email confirmation code' : 'tried to log in with the username "' + String(user).slice(0, 40) + '"';
      sendEmail('Security alert: failed admin login on 24 SEVEN Sound Hub',
        'Someone ' + what + ' on ' + new Date().toLocaleString() + '.' +
        (locked ? ' The login is now locked for ' + LOCK_MIN + ' minutes.' : '') +
        ' If this was not you, change your password in Website settings after you log in.').catch(function () { /* alert is best-effort */ });
    }
    return locked;
  }

  /* ---------- login screen (create / login / email code) ---------- */
  var authStage = 'login', pendingCode = null, pendingUser = '', authBusy = false;

  function setStage(stage) {
    authStage = stage;
    var create = stage === 'create', code = stage === 'code';
    $('loginTitle').textContent = create ? 'Create administrator account' : code ? 'Confirm it is you' : 'Admin login';
    $('loginLead').textContent = create
      ? 'First-time setup. Choose a username, a password and your email. You can only do this once.'
      : code ? 'Enter the 6-digit code we emailed to ' + maskEmail(adminEmail()) + '.'
      : 'Enter your administrator username and password.';
    $('loginUserField').hidden = code;
    $('loginPassField').hidden = code;
    $('loginEmailField').hidden = !create;
    $('loginConfirmField').hidden = !create;
    $('loginCodeField').hidden = !code;
    $('loginCodeActions').hidden = !code;
    $('loginUser').required = !code;
    $('loginPass').required = !code;
    $('loginEmail').required = create;
    $('loginConfirm').required = create;
    $('loginCode').required = code;
    $('loginSubmit').textContent = create ? 'Create account' : code ? 'Verify' : 'Sign in';
    $('loginPass').setAttribute('autocomplete', create ? 'new-password' : 'current-password');
  }
  function showLogin(msg) {
    $('adminApp').hidden = true;
    $('adminLoginModal').hidden = false;
    pendingCode = null;
    setStage(hasAccount() ? 'login' : 'create');
    $('loginError').textContent = msg || '';
    setTimeout(function () { $((authStage === 'create' || authStage === 'login') ? 'loginUser' : 'loginCode').focus(); }, 50);
  }
  function finishLogin(user) {
    var g = getGuard(); g.fails = 0; saveGuard(g);
    logEvent('login', user);
    sessionStorage.setItem('isAdmin', 'true'); // only this tab, only until logout/close
    $('loginForm').reset();
    pendingCode = null;
    showApp();
  }
  function createWithEmail(u, p, email) {
    if (!validEmail(email || '')) return 'Enter a valid email address. Security alerts are sent there.';
    var err = createAccount(u, p);
    if (err) return err;
    var raw = readJSON(SETTINGS_KEY, {}) || {};
    raw.email = email.trim();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(raw)); } catch (e) { /* ignore */ }
    return '';
  }

  function randomCode() {
    var n;
    if (window.crypto && window.crypto.getRandomValues) { var a = new Uint32Array(1); window.crypto.getRandomValues(a); n = a[0] % 900000; }
    else n = Math.floor(Math.random() * 900000);
    return String(100000 + n);
  }
  function startCode(user) {
    var code = randomCode();
    var salt = randomSalt();
    authBusy = true;
    $('loginSubmit').disabled = true;
    $('loginError').textContent = 'Sending your confirmation code…';
    sendEmail('Your 24 SEVEN admin confirmation code',
      'Your confirmation code is ' + code + '. It expires in ' + CODE_TTL_MIN + ' minutes. If you did not just log in, someone knows your password: log in and change it.',
      { code: code })
      .then(function () {
        pendingCode = { salt: salt, hash: sha256(salt + ':' + code), exp: Date.now() + CODE_TTL_MIN * 60000, tries: 0 };
        pendingUser = user;
        setStage('code');
        $('loginCode').value = '';
        $('loginError').textContent = '';
        setTimeout(function () { $('loginCode').focus(); }, 50);
      })
      .catch(function (err) {
        // Fail closed: no email means no access.
        $('loginError').textContent = 'Could not send the confirmation code (' + (err && err.message ? String(err.message).slice(0, 120) : 'network error') + '). Check your connection and try again.';
      })
      .then(function () { authBusy = false; $('loginSubmit').disabled = false; });
  }
  function verifyCode() {
    var entered = $('loginCode').value.trim();
    if (!pendingCode) { showLogin('Start again: enter your username and password.'); return; }
    if (Date.now() > pendingCode.exp) { showLogin('That code expired. Log in again to get a new one.'); return; }
    if (sha256(pendingCode.salt + ':' + entered) === pendingCode.hash) { finishLogin(pendingUser); return; }
    pendingCode.tries += 1;
    var locked = recordFailure(pendingUser, 'code_failed');
    if (locked || pendingCode.tries >= CODE_TRIES) {
      showLogin(locked ? 'Too many failed attempts. Locked for ' + LOCK_MIN + ' minutes.' : 'Too many wrong codes. Log in again.');
      return;
    }
    $('loginError').textContent = 'Wrong code. Try again.';
    $('loginCode').value = '';
  }
  function processLogin(u, p) {
    var mins = lockedMinutes();
    if (mins) { $('loginError').textContent = 'Too many failed attempts. Try again in ' + mins + ' minute' + (mins > 1 ? 's' : '') + '.'; return; }
    if (!checkLogin(u, p)) {
      var locked = recordFailure(u, 'failed');
      $('loginError').textContent = locked ? 'Too many failed attempts. Locked for ' + LOCK_MIN + ' minutes.' : 'Wrong username or password.';
      $('loginPass').value = '';
      return;
    }
    if (needsCode()) startCode(normUser(u));
    else finishLogin(normUser(u));
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (authBusy) return;
    if (authStage === 'code') { verifyCode(); return; }
    var u = $('loginUser').value.trim();
    var p = $('loginPass').value;
    if (authStage === 'create' || !hasAccount()) {
      if (p !== $('loginConfirm').value) { $('loginError').textContent = 'The two passwords do not match.'; return; }
      var err = createWithEmail(u, p, $('loginEmail').value);
      if (err) { $('loginError').textContent = err; return; }
      finishLogin(normUser(u));
      toast('Administrator account created. Log in with it any time.');
      return;
    }
    processLogin(u, p);
  });
  $('loginResend').addEventListener('click', function () { if (!authBusy && pendingUser) startCode(pendingUser); });
  $('loginBack').addEventListener('click', function () { showLogin(''); });

  function boot() {
    localStorage.removeItem('isAdmin'); // old versions kept a permanent flag; login is now per session
    var pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem('pending_admin_login'));
      sessionStorage.removeItem('pending_admin_login');
    } catch (e) { pending = null; }

    if (pending && pending.u != null) {
      if (!hasAccount() && pending.mode === 'create') {
        var err = createWithEmail(pending.u, pending.p, pending.email);
        if (err) { showLogin(err); return; }
        finishLogin(normUser(pending.u));
        toast('Administrator account created. Log in with it any time.');
        return;
      }
      showLogin('');
      if (hasAccount()) processLogin(pending.u, pending.p);
      return;
    }
    if (sessionStorage.getItem('isAdmin') === 'true' && hasAccount()) { showApp(); return; }
    sessionStorage.removeItem('isAdmin');
    showLogin('');
  }

  /* =======================================================
     APP (only runs after a successful login)
     ======================================================= */
  var inited = false;
  var state = { files: [], type: 'picture', albumTouched: false, busy: false, filter: 'all', coverTarget: null };

  var ACCEPT = { picture: 'image/*', video: 'video/*', music: 'audio/*' };
  var EXT = {
    picture: /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i,
    video: /\.(mp4|webm|mov|m4v|ogv)$/i,
    music: /\.(mp3|wav|ogg|m4a|aac|flac)$/i
  };
  var TYPE_LABEL = { picture: 'Pictures', video: 'Videos', music: 'Music' };

  function detectType(f) {
    if (f.type) {
      if (f.type.indexOf('image/') === 0) return 'picture';
      if (f.type.indexOf('video/') === 0) return 'video';
      if (f.type.indexOf('audio/') === 0) return 'music';
    }
    for (var t in EXT) if (EXT[t].test(f.name)) return t;
    return null;
  }

  function initApp() {
    if (inited) return;
    inited = true;
    bindUpload();
    bindLibrary();
    bindSettings();
    $('logoutBtn').addEventListener('click', function () {
      sessionStorage.removeItem('isAdmin');
      window.location.href = 'index.html';
    });
    fillSettingsForm();
    refreshAll();
  }

  function refreshAll() {
    renderOverview();
    renderRecent();
    renderLibrary();
    renderStorage();
  }

  /* ---------- upload: selection ---------- */
  function bindUpload() {
    var input = $('fileInput');
    input.multiple = true; // admin can pick any number of files

    input.addEventListener('change', function () {
      addFiles(input.files);
      input.value = '';
    });

    var zone = $('dropZone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
    });
    ['dragleave', 'dragend'].forEach(function (ev) {
      zone.addEventListener(ev, function () { zone.classList.remove('drag'); });
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('drag');
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    // Dropping outside the zone should not make the browser open the file
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    $('mediaTypes').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b) return;
      setType(b.getAttribute('data-type'));
    });

    $('albumToggle').addEventListener('change', function () {
      state.albumTouched = true;
      updateAlbumUI();
    });

    $('uploadBtn').addEventListener('click', upload);
    $('fileChips').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      state.files.splice(parseInt(b.getAttribute('data-i'), 10), 1);
      autoAlbum();
      renderChips();
    });
    setType('picture');
  }

  function setType(type) {
    state.type = type;
    var btns = document.querySelectorAll('#mediaTypes .seg-btn');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-type') === type;
      btns[i].classList.toggle('active', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    $('fileInput').accept = ACCEPT[type];
    var before = state.files.length;
    state.files = state.files.filter(function (f) { return detectType(f) === type; });
    if (state.files.length < before) toast('Removed files that are not ' + TYPE_LABEL[type].toLowerCase() + '.');
    autoAlbum();
    renderChips();
  }

  function autoAlbum() {
    if (!state.albumTouched) $('albumToggle').checked = state.type !== 'video' && state.files.length > 1;
    updateAlbumUI();
  }

  function updateAlbumUI() {
    var isAlbum = $('albumToggle').checked;
    $('albumField').hidden = !isAlbum;
    $('coverField').hidden = !(isAlbum || state.type === 'music');
  }

  function addFiles(list) {
    var incoming = Array.prototype.slice.call(list || []);
    if (!incoming.length) return;

    // First selection decides the media type automatically
    if (!state.files.length) {
      var d = detectType(incoming[0]);
      if (d && d !== state.type) setType(d);
    }
    var wrongType = 0, tooBig = 0;
    incoming.forEach(function (f) {
      if (detectType(f) !== state.type) { wrongType++; return; }
      if (f.size > MAX_BYTES) { tooBig++; return; }
      var dup = state.files.some(function (x) { return x.name === f.name && x.size === f.size && x.lastModified === f.lastModified; });
      if (!dup) state.files.push(f);
    });
    if (wrongType) toast(wrongType + ' file(s) skipped — they are not ' + TYPE_LABEL[state.type].toLowerCase() + '. Switch Media Type to add them.', true);
    if (tooBig) toast(tooBig + ' file(s) skipped — over the 100MB limit.', true);
    autoAlbum();
    renderChips();
  }

  function renderChips() {
    var box = $('fileChips');
    box.textContent = '';
    state.files.forEach(function (f, i) {
      var b = el('button', { type: 'button', 'data-i': String(i), 'aria-label': 'Remove ' + f.name, text: '×' });
      box.appendChild(el('div', { class: 'chip' }, [el('span', { text: f.name + ' • ' + fmtSize(f.size) }), b]));
    });
    var sum = $('fileSummary');
    if (state.files.length) {
      var total = state.files.reduce(function (n, f) { return n + f.size; }, 0);
      sum.textContent = state.files.length + ' file' + (state.files.length > 1 ? 's' : '') + ' selected • ' + fmtSize(total);
      sum.hidden = false;
    } else sum.hidden = true;
  }

  /* ---------- upload: processing ---------- */
  function readDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      r.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Not a readable image')); };
      img.src = src;
    });
  }
  function scaleImage(img, max, mime, quality) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(mime, quality);
  }

  // Large photos are scaled down so many of them fit in browser storage.
  function processFile(file) {
    return readDataURL(file).then(function (data) {
      var base = { name: file.name, type: file.type, size: file.size, data: data };
      if (detectType(file) !== 'picture' || /gif|svg/i.test(file.type) || file.size < 400 * 1024) return base;
      return loadImage(data).then(function (img) {
        var out = scaleImage(img, 1600, 'image/webp', 0.82);
        if (out.indexOf('data:image/webp') !== 0) out = scaleImage(img, 1600, 'image/jpeg', 0.82);
        if (out.length >= data.length) return base;
        base.data = out;
        base.type = out.substring(5, out.indexOf(';'));
        base.size = Math.round(out.length * 0.75);
        return base;
      }).catch(function () { return base; });
    });
  }
  function makeCover(file) {
    return readDataURL(file).then(function (data) {
      return loadImage(data).then(function (img) { return scaleImage(img, 600, 'image/jpeg', 0.8); });
    });
  }

  function newId() { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function stripExt(n) { return n.replace(/\.[^.]+$/, ''); }

  function upload() {
    if (state.busy) return;
    if (!state.files.length) { toast('Choose at least one file first.', true); return; }

    var isAlbum = $('albumToggle').checked;
    var albumName = $('albumName').value.trim();
    if (isAlbum && !albumName) {
      toast('Enter an album name for this album.', true);
      $('albumName').focus();
      return;
    }
    var title = $('uploadTitle').value.trim();
    var category = $('uploadCategory').value;
    var isPublic = $('publicToggle').checked;
    var type = state.type;
    var files = state.files.slice();
    var coverFile = ($('uploadCover').files && $('uploadCover').files[0]) || null;

    state.busy = true;
    var btn = $('uploadBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    var prog = $('uploadProgress');
    prog.max = files.length;
    prog.value = 0;
    prog.hidden = false;

    var processed = [];
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return processFile(f).then(function (p) { processed.push(p); prog.value = processed.length; });
      });
    });

    chain.then(function () {
      return coverFile ? makeCover(coverFile).catch(function () { return ''; }) : '';
    }).then(function (cover) {
      var now = new Date().toISOString();
      var created = [];
      if (isAlbum) {
        created.push({
          id: newId(), title: title || albumName, category: category, type: type,
          isAlbum: true, albumName: albumName, files: processed, cover: cover || '',
          date: now, isPublic: isPublic
        });
      } else {
        processed.forEach(function (p, i) {
          created.push({
            id: newId(),
            title: processed.length > 1 ? (title ? title + ' ' + (i + 1) : stripExt(p.name)) : (title || stripExt(p.name)),
            category: category, type: type, isAlbum: false, albumName: '', files: [p],
            cover: cover || '', date: now, isPublic: isPublic
          });
        });
      }
      var all = created.reverse().concat(loadMedia());
      if (!saveMedia(all)) return; // storage full: keep the selection so nothing is lost

      state.files = [];
      state.albumTouched = false;
      $('uploadTitle').value = '';
      $('albumName').value = '';
      $('uploadCover').value = '';
      $('albumToggle').checked = false;
      autoAlbum();
      renderChips();
      refreshAll();
      var n = processed.length;
      toast(isAlbum
        ? 'Album "' + albumName + '" uploaded (' + n + ' file' + (n > 1 ? 's' : '') + ').'
        : n + ' ' + (n > 1 ? 'items' : 'item') + ' uploaded to 24 SEVEN.');
    }).catch(function (err) {
      toast('Upload failed: ' + (err && err.message ? err.message : 'unknown error'), true);
    }).then(function () {
      state.busy = false;
      btn.disabled = false;
      btn.textContent = 'upload to 24seven';
      prog.hidden = true;
    });
  }

  /* ---------- overview cards ---------- */
  function waveSvg() {
    var s = svgEl('svg', { viewBox: '0 0 300 90', class: 'wave', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    s.appendChild(svgEl('line', { x1: 0, y1: 45, x2: 300, y2: 45, class: 'dots' }));
    var heights = [6, 10, 18, 30, 14, 40, 26, 54, 34, 62, 40, 70, 48, 78, 56, 64, 38, 72, 44, 58, 30, 66, 36, 50, 24, 42, 16, 30, 10, 18, 8, 12];
    heights.forEach(function (h, i) {
      var x = 18 + i * 8.6;
      s.appendChild(svgEl('line', { x1: x, x2: x, y1: 45 - h / 2, y2: 45 + h / 2 }));
    });
    return s;
  }

  function renderOverview() {
    var items = loadMedia();
    var st = getSettings();
    $('heroTitle').textContent = st.heroTitle;
    $('heroSubtitle').textContent = st.heroSubtitle;
    $('statViews').textContent = st.views;
    $('statClients').textContent = st.clients;
    $('statDownloads').textContent = st.downloads;

    var pp = $('previewPictures');
    pp.textContent = '';
    var thumbs = [];
    items.forEach(function (m) {
      if (m.type !== 'picture' || !Array.isArray(m.files)) return;
      m.files.forEach(function (f) { if (thumbs.length < 3 && isSafeData(f.data)) thumbs.push(f.data); });
    });
    for (var i = 0; i < 3; i++) pp.appendChild(thumbs[i] ? el('img', { src: thumbs[i], alt: '' }) : el('div', { class: 'ph' }));
    $('metaPictures').textContent = countFiles(items, 'picture') + ' items • Photos';

    var pv = $('previewVideos');
    pv.textContent = '';
    var vsrc = null;
    items.some(function (m) {
      if (m.type !== 'video' || !Array.isArray(m.files)) return false;
      return m.files.some(function (f) { if (isSafeData(f.data)) { vsrc = f.data; return true; } return false; });
    });
    if (vsrc) { var v = el('video', { src: vsrc + '#t=0.6', preload: 'metadata', playsinline: '' }); v.muted = true; pv.appendChild(v); }
    else pv.appendChild(el('div', { class: 'ph' }));
    var badge = el('span', { class: 'play-badge', 'aria-hidden': 'true' });
    var tri = svgEl('svg', { viewBox: '0 0 24 24' });
    tri.appendChild(svgEl('path', { d: 'M8 5v14l11-7z' }));
    badge.appendChild(tri);
    pv.appendChild(badge);
    $('metaVideos').textContent = countFiles(items, 'video') + ' items • Motion & Reels';

    var pm = $('previewMusic');
    pm.textContent = '';
    var cover = null;
    items.some(function (m) { if (m.type === 'music' && isSafeData(m.cover)) { cover = m.cover; return true; } return false; });
    if (cover) pm.appendChild(el('img', { class: 'cover-art', src: cover, alt: '' }));
    pm.appendChild(waveSvg());
    $('metaMusic').textContent = countFiles(items, 'music') + ' tracks • Audio & Soundscapes';
  }

  /* ---------- recent uploads ---------- */
  function iconFor(type) {
    var s = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    if (type === 'music') {
      s.appendChild(svgEl('path', { d: 'M9 18V6l10-2v12' }));
      s.appendChild(svgEl('circle', { cx: 6.5, cy: 18, r: 2.5 }));
      s.appendChild(svgEl('circle', { cx: 16.5, cy: 16, r: 2.5 }));
    } else if (type === 'video') {
      s.appendChild(svgEl('path', { d: 'M8 5v14l11-7z' }));
    } else {
      s.appendChild(svgEl('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3 }));
      s.appendChild(svgEl('path', { d: 'm4 18 5-5 4 4 3-3 4 4' }));
    }
    return s;
  }
  function thumbFor(m, cls) {
    var src = isSafeData(m.cover) ? m.cover
      : (m.type === 'picture' && m.files && m.files[0] && isSafeData(m.files[0].data)) ? m.files[0].data : null;
    if (src) return el('img', { class: cls, src: src, alt: '' });
    return el('div', { class: cls }, [iconFor(m.type)]);
  }
  function totalSize(m) { return (m.files || []).reduce(function (n, f) { return n + (f.size || 0); }, 0); }
  function unit(m) { return m.type === 'music' ? 'tracks' : m.type === 'video' ? 'videos' : 'photos'; }

  function renderRecent() {
    var list = $('recentList');
    list.textContent = '';
    var items = loadMedia().slice(0, 4);
    if (!items.length) { list.appendChild(el('li', { class: 'empty', text: 'No uploads yet.' })); return; }
    items.forEach(function (m) {
      var name = m.isAlbum ? (m.albumName || m.title) : ((m.files && m.files[0] && m.files[0].name) || m.title);
      var line = m.isAlbum ? 'Album • ' + m.files.length + ' ' + unit(m) : fmtSize(totalSize(m));
      var meta = el('span');
      meta.appendChild(document.createTextNode(line + ' • ' + timeAgo(m.date) + ' • '));
      meta.appendChild(el('span', { class: 'live' + (m.isPublic === false ? ' off' : ''), text: m.isPublic === false ? 'Private' : 'Live' }));
      list.appendChild(el('li', { class: 'recent-item' }, [thumbFor(m, 'thumb-sm'), el('div', { class: 'recent-text' }, [el('b', { text: name }), meta])]));
    });
  }

  function renderStorage() {
    var raw = localStorage.getItem(MEDIA_KEY) || '';
    var mb = raw.length / 1048576;
    $('storageNote').textContent = 'Storage used: ' + mb.toFixed(1) + ' MB of about ' + STORAGE_BUDGET_MB + ' MB';
  }

  /* ---------- library ---------- */
  function bindLibrary() {
    $('libFilter').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (b) setFilter(b.getAttribute('data-filter'));
    });
    document.addEventListener('click', function (e) {
      var f = e.target.closest('.card-link[data-filter]');
      if (f) { setFilter(f.getAttribute('data-filter')); $('library').scrollIntoView({ behavior: 'smooth' }); }
    });

    $('libList').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      var act = b.getAttribute('data-act');
      var all = loadMedia();
      var item = all.filter(function (m) { return m.id === id; })[0];
      if (!item) return;

      if (act === 'toggle') {
        item.isPublic = item.isPublic === false;
        if (saveMedia(all)) { refreshAll(); toast(item.isPublic ? 'Now visible on the public site.' : 'Hidden from the public site.'); }
      } else if (act === 'delete') {
        if (!window.confirm('Delete "' + item.title + '"? This cannot be undone.')) return;
        if (saveMedia(all.filter(function (m) { return m.id !== id; }))) { refreshAll(); toast('Deleted.'); }
      } else if (act === 'cover') {
        state.coverTarget = id;
        $('coverInput').click();
      }
    });

    $('coverInput').addEventListener('change', function () {
      var file = this.files && this.files[0];
      var id = state.coverTarget;
      this.value = '';
      if (!file || !id) return;
      makeCover(file).then(function (data) {
        var all = loadMedia();
        var item = all.filter(function (m) { return m.id === id; })[0];
        if (!item) return;
        item.cover = data;
        if (saveMedia(all)) { refreshAll(); toast('Cover photo updated.'); }
      }).catch(function () { toast('That file is not a readable image.', true); });
    });
  }

  function setFilter(f) {
    state.filter = f;
    var btns = document.querySelectorAll('#libFilter .seg-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-filter') === f);
    renderLibrary();
  }

  function renderLibrary() {
    var box = $('libList');
    box.textContent = '';
    var items = loadMedia().filter(function (m) { return state.filter === 'all' || m.type === state.filter; });
    if (!items.length) { box.appendChild(el('p', { class: 'empty', text: 'Nothing here yet. Upload something using the panel.' })); return; }
    items.forEach(function (m) {
      var count = (m.files || []).length;
      var desc = TYPE_LABEL[m.type] + ' • ' + (m.isAlbum ? 'Album • ' + count + ' ' + unit(m) : fmtSize(totalSize(m))) +
        ' • ' + (m.category || '') + ' • ' + (m.isPublic === false ? 'Private' : 'Public');
      var actions = el('div', { class: 'lib-actions' });
      if (m.type === 'music' || m.isAlbum) actions.appendChild(el('button', { type: 'button', class: 'btn btn-sm', 'data-act': 'cover', 'data-id': m.id, text: m.cover ? 'Change cover' : 'Add cover' }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-sm', 'data-act': 'toggle', 'data-id': m.id, text: m.isPublic === false ? 'Make public' : 'Make private' }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-sm btn-danger', 'data-act': 'delete', 'data-id': m.id, text: 'Delete' }));
      box.appendChild(el('div', { class: 'lib-item' }, [
        thumbFor(m, 'thumb-sm'),
        el('div', { class: 'lib-info' }, [el('b', { text: m.isAlbum ? (m.albumName || m.title) : m.title }), el('span', { text: desc })]),
        actions
      ]));
    });
  }

  /* ---------- settings ---------- */
  function fillSettingsForm() {
    var s = getSettings();
    var raw = readJSON(SETTINGS_KEY, {});
    $('setHeroTitle').value = s.heroTitle;
    $('setHeroSubtitle').value = s.heroSubtitle;
    $('setViews').value = s.views;
    $('setClients').value = s.clients;
    $('setDownloads').value = s.downloads;
    $('setEmail').value = raw.email || '';
    $('setPhone').value = raw.phone || '';
    $('setLocation').value = raw.location || '';
    $('setAbout').value = raw.about || '';
    $('setUser').value = (getAccount() || {}).u || '';
    var sec = getSec();
    $('setSvc').value = sec.serviceId;
    $('setTpl').value = sec.templateId;
    $('setKey').value = sec.publicKey;
    $('setRequireCode').checked = sec.requireCode && sec.tested;
    $('emailStatus').textContent = sec.tested ? 'Email test passed. Confirmation codes and alerts can be sent.' : 'Not tested yet.';
    renderSecurityLog();
    $('setPass').value = '';
  }

  var LOG_TEXT = { failed: 'Wrong username or password', code_failed: 'Wrong email code', locked: 'Locked after repeated failures', login: 'Successful login' };
  function renderSecurityLog() {
    var list = $('secLog');
    list.textContent = '';
    var l = readJSON(LOG_KEY, []);
    if (!Array.isArray(l) || !l.length) { list.appendChild(el('li', { class: 'empty', text: 'No activity yet.' })); return; }
    l.slice(0, 20).forEach(function (ev) {
      var who = ev.user ? ' • "' + ev.user + '"' : '';
      list.appendChild(el('li', { class: 'log-item' + (ev.type === 'login' ? '' : ' bad') }, [
        el('b', { text: LOG_TEXT[ev.type] || ev.type }),
        el('span', { text: new Date(ev.t).toLocaleString() + who })
      ]));
    });
  }

  function persistSettings(silent) {
    // Settings can only be changed from this page, and this page only runs for a signed-in admin.
    if (sessionStorage.getItem('isAdmin') !== 'true') { showLogin('Please sign in again.'); return false; }

    var user = normUser($('setUser').value);
    var pass = $('setPass').value;
    var email = $('setEmail').value.trim();
    if (user.length < 3) { toast('Username must be at least 3 characters.', true); return false; }
    if (pass && pass.length < 6) { toast('Use at least 6 characters for the new password.', true); return false; }
    if (email && !validEmail(email)) { toast('That email address does not look right.', true); return false; }

    var prev = readJSON(SETTINGS_KEY, {}) || {};
    var oldSec = getSec();
    var cfg = { serviceId: $('setSvc').value.trim(), templateId: $('setTpl').value.trim(), publicKey: $('setKey').value.trim() };
    var changed = cfg.serviceId !== oldSec.serviceId || cfg.templateId !== oldSec.templateId || cfg.publicKey !== oldSec.publicKey || email !== String(prev.email || '');
    var tested = changed ? false : oldSec.tested;
    var wantCode = $('setRequireCode').checked;
    var note = '';
    if (wantCode && !tested) { wantCode = false; $('setRequireCode').checked = false; note = ' Email confirmation stays off until a test email succeeds.'; }

    var next = {
      heroTitle: $('setHeroTitle').value.trim(),
      heroSubtitle: $('setHeroSubtitle').value.trim(),
      views: $('setViews').value.trim(),
      clients: $('setClients').value.trim(),
      downloads: $('setDownloads').value.trim(),
      email: email,
      phone: $('setPhone').value.trim(),
      location: $('setLocation').value.trim(),
      about: $('setAbout').value.trim()
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      saveSec({ serviceId: cfg.serviceId, templateId: cfg.templateId, publicKey: cfg.publicKey, requireCode: wantCode, tested: tested });
      var c = getAccount();
      if (c && (user !== c.u || pass)) {
        var salt = pass ? randomSalt() : c.salt;
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ u: user, salt: salt, hash: pass ? slowHash(salt, pass) : c.hash }));
      }
    } catch (err) {
      toast('Could not save settings: ' + err.message, true);
      return false;
    }
    $('setPass').value = '';
    $('emailStatus').textContent = tested ? 'Email test passed. Confirmation codes and alerts can be sent.' : 'Not tested yet. Send a test email.';
    renderOverview();
    if (!silent) toast('Settings saved.' + note);
    return true;
  }

  function bindSettings() {
    $('settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      persistSettings(false);
    });

    $('testEmailBtn').addEventListener('click', function () {
      if (!persistSettings(true)) return;
      var btn = this;
      btn.disabled = true;
      $('emailStatus').textContent = 'Sending test email…';
      sendEmail('24 SEVEN Sound Hub: test email', 'This is a test. If you can read it, security alerts and confirmation codes will reach this address.', { code: '000000' })
        .then(function () {
          var sec = getSec(); sec.tested = true; saveSec(sec);
          $('emailStatus').textContent = 'Test email sent to ' + maskEmail(adminEmail()) + '. Check your inbox and spam folder. If it arrived, you can turn on the confirmation code.';
        })
        .catch(function (err) {
          var sec = getSec(); sec.tested = false; sec.requireCode = false; saveSec(sec);
          $('setRequireCode').checked = false;
          $('emailStatus').textContent = 'Test failed: ' + (err && err.message ? String(err.message).slice(0, 160) : 'network error');
        })
        .then(function () { btn.disabled = false; });
    });

    $('clearLogBtn').addEventListener('click', function () {
      localStorage.removeItem(LOG_KEY);
      renderSecurityLog();
    });
  }
  boot();
})();
