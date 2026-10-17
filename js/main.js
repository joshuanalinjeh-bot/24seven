/* =========================================================
   24 SEVEN Sound Hub — public site logic (VIEW ONLY)
   Reads media from localStorage 'portfolio_media'.
   There is no upload code on this page.
   ========================================================= */
(function () {
  'use strict';

  var MEDIA_KEY = 'portfolio_media';
  var SETTINGS_KEY = 'portfolio_settings';
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

  function toast(msg, isError) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- data ---------- */
  function getSettings() {
    var s = readJSON(SETTINGS_KEY, {});
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = (s && s[k] != null && s[k] !== '') ? s[k] : DEFAULTS[k]; });
    return out;
  }
  function getMedia() {
    var all = readJSON(MEDIA_KEY, []);
    if (!Array.isArray(all)) return [];
    return all.filter(function (m) { return m && m.isPublic !== false && Array.isArray(m.files); });
  }
  function byType(items, type) { return items.filter(function (m) { return m.type === type; }); }
  function countFiles(items) { return items.reduce(function (n, m) { return n + m.files.length; }, 0); }

  /* ---------- previews on the 3 cards ---------- */
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

  function renderCards(items) {
    var pics = byType(items, 'picture');
    var vids = byType(items, 'video');
    var music = byType(items, 'music');

    // Pictures: up to three thumbnails
    var pp = $('previewPictures');
    pp.textContent = '';
    var thumbs = [];
    pics.forEach(function (m) { m.files.forEach(function (f) { if (thumbs.length < 3 && isSafeData(f.data)) thumbs.push({ src: f.data, name: m.title }); }); });
    for (var i = 0; i < 3; i++) {
      pp.appendChild(thumbs[i] ? el('img', { src: thumbs[i].src, alt: thumbs[i].name || 'Picture', loading: 'lazy' }) : el('div', { class: 'ph' }));
    }
    $('metaPictures').textContent = countFiles(pics) + ' items • Photos';

    // Videos: first video as poster + play badge
    var pv = $('previewVideos');
    pv.textContent = '';
    var firstVideo = null;
    vids.some(function (m) { return m.files.some(function (f) { if (isSafeData(f.data)) { firstVideo = f; return true; } return false; }); });
    if (firstVideo) {
      var v = el('video', { src: firstVideo.data + '#t=0.6', preload: 'metadata', muted: '', playsinline: '' });
      v.muted = true;
      pv.appendChild(v);
    } else {
      pv.appendChild(el('div', { class: 'ph' }));
    }
    var badge = el('span', { class: 'play-badge', 'aria-hidden': 'true' });
    var tri = svgEl('svg', { viewBox: '0 0 24 24' });
    tri.appendChild(svgEl('path', { d: 'M8 5v14l11-7z' }));
    badge.appendChild(tri);
    pv.appendChild(badge);
    $('metaVideos').textContent = countFiles(vids) + ' items • Motion & Reels';

    // Music: cover (if any) + waveform
    var pm = $('previewMusic');
    pm.textContent = '';
    var cover = null;
    music.some(function (m) { if (isSafeData(m.cover)) { cover = m.cover; return true; } return false; });
    if (cover) pm.appendChild(el('img', { class: 'cover-art', src: cover, alt: '' }));
    pm.appendChild(waveSvg());
    $('metaMusic').textContent = countFiles(music) + ' tracks • Audio & Soundscapes';
  }

  function renderText() {
    var s = getSettings();
    $('heroTitle').textContent = s.heroTitle;
    $('heroSubtitle').textContent = s.heroSubtitle;
    $('statViews').textContent = s.views;
    $('statClients').textContent = s.clients;
    $('statDownloads').textContent = s.downloads;
  }

  /* ---------- modals ---------- */
  var openModals = [];
  function openModal(m) {
    m.hidden = false;
    openModals.push(m);
    document.body.classList.add('modal-open');
  }
  function closeModal(m) {
    m.hidden = true;
    openModals = openModals.filter(function (x) { return x !== m; });
    if (!openModals.length && $('lightbox').hidden) document.body.classList.remove('modal-open');
    var audios = m.querySelectorAll('audio, video');
    for (var i = 0; i < audios.length; i++) audios[i].pause();
  }
  function closeAllModals() { openModals.slice().forEach(closeModal); }

  document.addEventListener('click', function (e) {
    var modal = e.target.closest('.modal');
    if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
    else if (e.target.closest('[data-close]') && modal) closeModal(modal);
  });

  // Only one audio/video plays at a time
  document.addEventListener('play', function (e) {
    var media = document.querySelectorAll('#viewerBody audio, #viewerBody video');
    for (var i = 0; i < media.length; i++) if (media[i] !== e.target) media[i].pause();
  }, true);

  /* ---------- lightbox ---------- */
  var lb = { list: [], i: 0 };
  function showLightbox(list, index) {
    lb.list = list; lb.i = index;
    paintLightbox();
    $('lightbox').hidden = false;
    document.body.classList.add('modal-open');
  }
  function paintLightbox() {
    var cur = lb.list[lb.i];
    $('lbImg').src = cur.src;
    $('lbImg').alt = cur.title || '';
    $('lbCaption').textContent = (cur.title || '') + (lb.list.length > 1 ? '  (' + (lb.i + 1) + ' / ' + lb.list.length + ')' : '');
    var multi = lb.list.length > 1;
    $('lbPrev').hidden = !multi;
    $('lbNext').hidden = !multi;
  }
  function stepLightbox(d) { lb.i = (lb.i + d + lb.list.length) % lb.list.length; paintLightbox(); }
  function closeLightbox() {
    $('lightbox').hidden = true;
    $('lbImg').removeAttribute('src');
    if (!openModals.length) document.body.classList.remove('modal-open');
  }
  $('lbClose').addEventListener('click', closeLightbox);
  $('lbPrev').addEventListener('click', function () { stepLightbox(-1); });
  $('lbNext').addEventListener('click', function () { stepLightbox(1); });
  $('lightbox').addEventListener('click', function (e) { if (e.target === this) closeLightbox(); });

  document.addEventListener('keydown', function (e) {
    if (!$('lightbox').hidden) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft' && lb.list.length > 1) stepLightbox(-1);
      else if (e.key === 'ArrowRight' && lb.list.length > 1) stepLightbox(1);
      return;
    }
    if (e.key === 'Escape' && openModals.length) closeModal(openModals[openModals.length - 1]);
  });

  /* ---------- viewer (gallery / videos / music) ---------- */
  function emptyNote(text) { return el('p', { class: 'empty', text: text }); }

  function buildPictures(items) {
    var wrap = el('div');
    var pics = byType(items, 'picture');
    if (!countFiles(pics)) return emptyNote('No pictures have been published yet.');
    var all = [];
    pics.forEach(function (m) { m.files.forEach(function (f) { if (isSafeData(f.data)) all.push({ src: f.data, title: m.title }); }); });
    pics.forEach(function (m) {
      var group = el('div', { class: 'group' });
      var h = el('h3', { text: m.isAlbum ? (m.albumName || m.title) : m.title });
      if (m.isAlbum) h.appendChild(el('span', { class: 'tag', text: 'Album • ' + m.files.length + ' photos' }));
      group.appendChild(h);
      var grid = el('div', { class: 'grid' });
      m.files.forEach(function (f) {
        if (!isSafeData(f.data)) return;
        var btn = el('button', { type: 'button', class: 'tile', 'aria-label': 'Open ' + (f.name || m.title) }, [el('img', { src: f.data, alt: f.name || m.title, loading: 'lazy' })]);
        btn.addEventListener('click', function () {
          var idx = 0;
          for (var i = 0; i < all.length; i++) if (all[i].src === f.data) { idx = i; break; }
          showLightbox(all, idx);
        });
        grid.appendChild(btn);
      });
      group.appendChild(grid);
      wrap.appendChild(group);
    });
    return wrap;
  }

  function buildVideos(items) {
    var vids = byType(items, 'video');
    if (!countFiles(vids)) return emptyNote('No videos have been published yet.');
    var wrap = el('div');
    vids.forEach(function (m) {
      var group = el('div', { class: 'group' });
      var h = el('h3', { text: m.isAlbum ? (m.albumName || m.title) : m.title });
      if (m.isAlbum) h.appendChild(el('span', { class: 'tag', text: 'Collection • ' + m.files.length + ' videos' }));
      group.appendChild(h);
      var grid = el('div', { class: 'grid grid--video' });
      m.files.forEach(function (f) {
        if (!isSafeData(f.data)) return;
        var v = el('video', { src: f.data, controls: '', preload: 'metadata', playsinline: '' });
        grid.appendChild(el('div', { class: 'video-box' }, [v, el('p', { text: f.name || m.title })]));
      });
      group.appendChild(grid);
      wrap.appendChild(group);
    });
    return wrap;
  }

  function buildMusic(items) {
    var music = byType(items, 'music');
    if (!countFiles(music)) return emptyNote('No music has been published yet.');
    var wrap = el('div');
    music.forEach(function (m) {
      var cover;
      if (isSafeData(m.cover)) cover = el('img', { class: 'album-cover', src: m.cover, alt: 'Cover for ' + (m.albumName || m.title) });
      else {
        var s = svgEl('svg', { viewBox: '0 0 24 24' });
        s.appendChild(svgEl('path', { d: 'M9 18V6l10-2v12' }));
        s.appendChild(svgEl('circle', { cx: 6.5, cy: 18, r: 2.5 }));
        s.appendChild(svgEl('circle', { cx: 16.5, cy: 16, r: 2.5 }));
        cover = el('div', { class: 'album-cover' }, [s]);
      }
      var info = el('div');
      var h = el('h3', { text: m.isAlbum ? (m.albumName || m.title) : m.title });
      h.appendChild(el('span', { class: 'tag', text: m.isAlbum ? 'Album • ' + m.files.length + ' tracks' : 'Single' }));
      info.appendChild(h);
      m.files.forEach(function (f, i) {
        if (!isSafeData(f.data)) return;
        var t = el('div', { class: 'track' }, [
          el('p', { text: (m.isAlbum ? (i + 1) + '. ' : '') + (f.name || m.title) }),
          el('audio', { src: f.data, controls: '', preload: 'none' })
        ]);
        info.appendChild(t);
      });
      wrap.appendChild(el('div', { class: 'album-music' }, [cover, info]));
    });
    return wrap;
  }

  function openViewer(kind) {
    var items = getMedia();
    var titles = { pictures: 'Pictures', videos: 'Videos', music: 'Music' };
    $('viewerTitle').textContent = titles[kind];
    var body = $('viewerBody');
    body.textContent = '';
    body.appendChild(kind === 'pictures' ? buildPictures(items) : kind === 'videos' ? buildVideos(items) : buildMusic(items));
    openModal($('viewerModal'));
  }

  /* ---------- contact / about ---------- */
  function openInfo(kind) {
    var s = getSettings();
    var body = $('infoBody');
    body.textContent = '';
    if (kind === 'contact') {
      $('infoTitle').textContent = 'Contact';
      var list = el('ul', { class: 'info-list' });
      var rows = [['Email', s.email], ['Phone', s.phone], ['Location', s.location]].filter(function (r) { return r[1]; });
      if (!rows.length) body.appendChild(emptyNote('Contact details have not been added yet.'));
      else {
        rows.forEach(function (r) {
          var li = el('li');
          li.appendChild(el('small', { text: r[0] }));
          if (r[0] === 'Email') {
            var a = el('a', { href: 'mailto:' + r[1], text: r[1] });
            li.appendChild(a);
          } else li.appendChild(document.createTextNode(r[1]));
          list.appendChild(li);
        });
        body.appendChild(list);
      }
    } else {
      $('infoTitle').textContent = 'About';
      body.appendChild(el('p', { class: 'about-text', text: s.about }));
    }
    openModal($('infoModal'));
  }

  /* ---------- navigation ---------- */
  function setActive(name) {
    var items = document.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', items[i].getAttribute('data-nav') === name);
  }
  function go(name) {
    if (name === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); closeAllModals(); setActive('home'); return; }
    if (name === 'music') openViewer('music');
    else if (name === 'artwork') openViewer('pictures');
    else if (name === 'contact') openInfo('contact');
    else if (name === 'about') openInfo('about');
    if (name !== 'about') setActive(name);
  }
  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.getAttribute('data-nav')); return; }
    var open = e.target.closest('[data-open]');
    if (open) openViewer(open.getAttribute('data-open'));
  });
  // closing a modal returns the highlight to Home
  new MutationObserver(function () { if (!openModals.length) setActive('home'); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- admin login (logo button) ---------- */
  function hasAccount() {
    var a = readJSON('portfolio_admin_account', null);
    return !!(a && a.u && a.salt && a.hash);
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  // No account yet -> the modal creates the administrator account (once).
  function setLoginMode() {
    var create = !hasAccount();
    $('loginTitle').textContent = create ? 'Create administrator account' : 'Admin login';
    $('loginLead').textContent = create
      ? 'First-time setup. Choose a username, a password and your email. You can only do this once.'
      : 'Enter your administrator username and password.';
    $('loginConfirmField').hidden = !create;
    $('loginEmailField').hidden = !create;
    $('loginConfirm').required = create;
    $('loginEmail').required = create;
    $('loginSubmit').textContent = create ? 'Create account' : 'Sign in';
    $('loginPass').setAttribute('autocomplete', create ? 'new-password' : 'current-password');
  }
  // Clicking the logo ALWAYS asks for the username and password.
  $('logoBtn').addEventListener('click', function () {
    $('loginError').textContent = '';
    $('loginForm').reset();
    setLoginMode();
    openModal($('adminLoginModal'));
    setTimeout(function () { $('loginUser').focus(); }, 50);
  });
  // The account, password check, email alerts and email code all live in js/admin.js;
  // this page only hands the typed values over.
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('loginUser').value.trim();
    var p = $('loginPass').value;
    var create = !hasAccount();
    if (!u || !p) { $('loginError').textContent = 'Enter your username and password.'; return; }
    if (create) {
      if (u.length < 3) { $('loginError').textContent = 'Username must be at least 3 characters.'; return; }
      if (p.length < 6) { $('loginError').textContent = 'Password must be at least 6 characters.'; return; }
      if (p !== $('loginConfirm').value) { $('loginError').textContent = 'The two passwords do not match.'; return; }
      if (!validEmail($('loginEmail').value.trim())) { $('loginError').textContent = 'Enter a valid email address. Security alerts are sent there.'; return; }
    }
    try {
      sessionStorage.setItem('pending_admin_login', JSON.stringify({ mode: create ? 'create' : 'login', u: u, p: p, email: $('loginEmail').value.trim() }));
    } catch (err) { $('loginError').textContent = 'Your browser blocked storage; cannot continue.'; return; }
    window.location.href = 'admin.html';
  });

  /* ---------- hash links (admin nav links here) ---------- */
  function handleHash() {
    var h = (location.hash || '').replace('#', '');
    if (['music', 'artwork', 'contact', 'about'].indexOf(h) > -1) go(h);
  }

  /* ---------- init ---------- */
  $('year').textContent = new Date().getFullYear();
  renderText();
  renderCards(getMedia());
  handleHash();
  window.addEventListener('storage', function (e) {
    if (e.key === MEDIA_KEY || e.key === SETTINGS_KEY) { renderText(); renderCards(getMedia()); }
  });
})();
