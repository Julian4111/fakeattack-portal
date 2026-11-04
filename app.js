(() => {
  'use strict';

  const CONFIG = window.PORTAL_CONFIG || {};
  const TOKEN_KEY = 'fa3-portal-token';
  const OAUTH_INTENT_KEY = 'fa3-oauth-intent';
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const userBox = document.getElementById('user');
  const topbar = document.querySelector('.topbar');
  const brandPill = document.querySelector('.status-pill');
  const toastBox = document.getElementById('toast');
  const pillStatus = document.getElementById('pill-status');

  const state = {
    token: null, me: null, filter: 'all', refreshTimer: null, renderedAt: 0, dirty: false, pillAt: 0, openThreads: new Set(),
    market: { view: 'sell', q: '', cat: '', sort: 'new', type: 'all', formOpen: false, shopEdit: null, shopView: null }, marketPending: 0,
    practice: null
  };
  let renderSeq = 0;

  const SUGGESTION_STATUS = { open: 'Offen', accepted: 'Angenommen', done: 'Umgesetzt', rejected: 'Abgelehnt' };
  const APPEAL_STATUS = { pending: 'Wird geprüft', accepted: 'Angenommen', rejected: 'Abgelehnt' };

  const PAGES = {
    start: { title: 'Start', short: 'Start', icon: 'home', render: renderStart },
    boerse: { title: 'Börse', short: 'Börse', icon: 'gem', render: renderMarket },
    inventar: { title: 'Inventar', short: 'Inventar', icon: 'chest', render: renderInventory },
    vorschlaege: { title: 'Vorschläge', short: 'Ideen', icon: 'idea', render: renderSuggestions },
    abstimmungen: { title: 'Abstimmungen', short: 'Umfragen', icon: 'poll', render: renderPolls },
    einspruch: { title: 'Einspruch', short: 'Einspruch', icon: 'shield', render: renderAppeal },
    regeln: { title: 'Regeln', short: 'Regeln', icon: 'book', render: renderRules },
    // in the nav only for players with a plot (and admins), see loadPlotCount
    plots: { title: 'Plots', short: 'Plots', icon: 'plot', render: renderPlots, hidden: true },
    admin: { title: 'Admin', short: 'Admin', icon: 'key', render: renderAdmin, admin: true },
    // not in the nav: opened from the player box top right
    konto: { title: 'Konto', short: 'Konto', render: renderAccount, hidden: true }
  };

  // fixed icon markup (no user data); 24-unit grid, drawn with the current text colour
  const ICONS = {
    home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.6 1.5 2.6V17h4v-.5c0-1 .6-1.9 1.5-2.6A6 6 0 0 0 12 3Z"/>',
    poll: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    shield: '<path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    book: '<path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/>',
    github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.4 4.4 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.5 2.6 5.5 2.9 5.5 2.9a4.4 4.4 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 9.3c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    chat: '<path d="M4 5h16v11H10l-6 4z"/>',
    gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20 8.5 9 11 4M12 20l3.5-11L13 4"/>',
    plot: '<path d="M5 20V8l2.5-3L10 8v12M14 20V8l2.5-3L19 8v12M3 11h18M3 16h18"/>',
    chest: '<path d="M4 9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4z"/><path d="M4 12h16M11 11h2v3h-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'
  };

  // ---------------------------------------------------------------- Hilfen

  // builds DOM nodes; text is always inserted as text, never as HTML
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key === 'value') el.value = value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  // eyebrow, big title, optional lead and something on the right (filters, counters)
  function pageHead(eyebrow, title, lead, aside) {
    return h('div', { class: 'page-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, eyebrow), h('h1', {}, title), lead ? h('p', { class: 'lead' }, lead) : null),
      aside || null);
  }

  function toast(message, kind) {
    toastBox.textContent = message;
    toastBox.className = 'toast show ' + (kind || '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastBox.className = 'toast ' + (kind || ''); }, 4200);
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  // player heads: Minotar shows the current skin; mc-heads.net keeps old skins for a long time, so only as fallback
  const HEAD_URLS = [
    (id, px) => `https://minotar.net/helm/${id}/${px}.png`,
    (id, px) => `https://mc-heads.net/avatar/${id}/${px}`
  ];
  const NO_PICTURE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  function head(uuid, size) {
    // as many pixels as the screen shows (sharp on phones too), in whole skin pixels of 8
    const px = Math.min(296, Math.ceil(size * (window.devicePixelRatio || 1) / 8) * 8);
    const id = encodeURIComponent(uuid);
    const img = h('img', { class: 'head', alt: '', width: size, height: size, loading: 'lazy', draggable: 'false' });
    let step = 0;
    // no service reachable: an empty square in the same place instead of a broken picture
    img.onerror = () => {
      step += 1;
      if (step < HEAD_URLS.length) img.src = HEAD_URLS[step](id, px);
      else { img.onerror = null; img.src = NO_PICTURE; img.classList.add('head-missing'); }
    };
    img.src = HEAD_URLS[0](id, px);
    return img;
  }

  function loadToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  function saveToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode: login only lasts for this tab */ }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert: ' + text, 'ok');
    } catch {
      toast('Kopieren nicht möglich – bitte markieren und kopieren.', 'error');
    }
  }

  // runs an action from a button, shows errors and reloads the page afterwards
  async function act(button, action, successMessage) {
    if (button) button.disabled = true;
    try {
      await action();
      if (successMessage) toast(successMessage, 'ok');
      await refresh();
    } catch (error) {
      handleError(error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  // the stage follows scrolling slightly (6 %), switched off for reduced motion
  function initStage() {
    const svg = document.querySelector('.stage svg');
    if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let queued = false;
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        svg.style.transform = `translateY(${-window.scrollY * 0.06}px)`;
        queued = false;
      });
    }, { passive: true });
  }

  // ---------------------------------------------------------------- Datenbank

  // githubToken: Supabase-Auth access token after a GitHub login; only link_github and github_login need it
  async function rpc(fn, params, githubToken) {
    // practice mode: the Börse runs in the browser with practice players, nothing reaches the database
    if (state.practice && (fn.startsWith('market_') || fn.startsWith('shop_'))) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return state.practice.call(fn, params);
    }
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      throw new Error('Die Website ist noch nicht mit der Datenbank verbunden (config.js).');
    }
    const headers = { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' };
    if (githubToken) headers.Authorization = 'Bearer ' + githubToken;
    else if (CONFIG.supabaseKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + CONFIG.supabaseKey;
    let response;
    try {
      response = await fetch(`${CONFIG.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify(params || {})
      });
    } catch {
      throw new Error('Keine Verbindung zur Datenbank. Bitte später nochmal versuchen.');
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const error = new Error((data && data.message) || `Fehler ${response.status}`);
      error.sessionExpired = error.message.startsWith('Bitte melde dich');
      error.webLocked = error.message.startsWith('Die Website ist gerade gesperrt');
      // the lock shows as a plain loading error, also on the login page (423 = locked)
      if (error.webLocked) error.message = LOCKED_TEXT;
      throw error;
    }
    return data;
  }

  function handleError(error) {
    if (error.sessionExpired) {
      clearSession();
      toast('Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.', 'error');
      route();
      return;
    }
    if (error.webLocked && state.me) {
      state.webLocked = true;
      route();
      return;
    }
    toast(error.message || String(error), 'error');
  }

  function clearSession() {
    state.token = null;
    state.me = null;
    saveToken(null);
    // a running tour or practice belongs to this player; it ends without counting as seen
    tour.index = -1;
    closeCoach();
    clearTourTarget();
    stopPractice();
  }

  async function login(code) {
    await startSession(await rpc('redeem_code', { p_code: code }));
  }

  async function startSession(result) {
    state.token = result.token;
    saveToken(result.token);
    delete result.token;
    state.me = result;
    state.pillAt = 0;
    toast(`Willkommen, ${result.name}!`, 'ok');
    location.hash = result.banned ? '#/einspruch' : '#/start';
    if (!result.banned) await Promise.all([loadTutorials(), loadPlotCount()]);
    await route();
  }

  // ---------------------------------------------------------------- GitHub

  // Supabase sends the browser to GitHub and back here with the tokens in the URL fragment
  function startGithub(intent) {
    try { sessionStorage.setItem(OAUTH_INTENT_KEY, intent); } catch { /* falls back to login */ }
    const back = window.location.origin + window.location.pathname;
    window.location.href = `${CONFIG.supabaseUrl.replace(/\/+$/, '')}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(back)}`;
  }

  async function finishGithub() {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (!fragment.has('access_token') && !fragment.has('error_description')) return false;
    let intent = 'login';
    try { intent = sessionStorage.getItem(OAUTH_INTENT_KEY) || 'login'; sessionStorage.removeItem(OAUTH_INTENT_KEY); } catch { /* default */ }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (fragment.has('error_description')) {
      toast('GitHub: ' + fragment.get('error_description'), 'error');
      return false;
    }
    const githubToken = fragment.get('access_token');
    try {
      if (intent === 'link' && state.token) {
        const result = await rpc('link_github', { p_token: state.token }, githubToken);
        const me = await rpc('session_info', { p_token: state.token });
        if (me) state.me = me;
        toast(`GitHub verknüpft${result.github_login ? ' mit @' + result.github_login : ''}. Ab jetzt kannst du dich damit anmelden.`, 'ok');
        location.hash = '#/konto';
        await route();
      } else {
        await startSession(await rpc('github_login', {}, githubToken));
      }
      return true;
    } catch (error) {
      toast(error.message, 'error');
      return false;
    }
  }

  function githubCard(link) {
    if (CONFIG.githubLogin === false) return null;
    return h('div', { class: 'card github-card' },
      h('p', { class: 'eyebrow' }, 'GitHub'),
      h('h3', { style: 'margin:6px 0 8px' }, link ? 'GitHub ist verknüpft' : 'GitHub verknüpfen'),
      link
        ? h('div', { class: 'stack' },
          h('p', { class: 'muted small' }, h('span', { class: 'badge ok' }, 'Verknüpft'), ` @${link.github_login || 'GitHub'} – du brauchst keinen Code aus dem Spiel mehr.`),
          link.linked_at ? h('p', { class: 'faint small' }, `Seit ${formatDate(link.linked_at)}`) : null,
          h('button', {
            class: 'btn small danger',
            onclick: (event) => { if (confirm('GitHub-Verknüpfung lösen?')) act(event.currentTarget, () => rpc('unlink_github', { p_token: state.token }), 'Verknüpfung gelöst.'); }
          }, 'Verknüpfung lösen'))
        : h('div', { class: 'stack' },
          h('p', { class: 'muted small' }, 'Einmal mit deinem Spieler verknüpfen, danach meldest du dich mit einem Klick an – ohne Code aus dem Spiel.'),
          h('button', { class: 'btn', onclick: () => startGithub('link') }, icon('github'), 'GitHub verknüpfen')));
  }

  async function logout() {
    try { await rpc('logout', { p_token: state.token }); } catch { /* token is dropped locally anyway */ }
    clearSession();
    location.hash = '';
    route();
  }

  // ---------------------------------------------------------------- Website gesperrt

  // an admin can lock the website for everyone else (admin page); players stay logged in and get back in afterwards.
  // Everyone else just sees a loading error, the word "gesperrt" appears only for admins.
  const lockedOut = () => Boolean(state.me && state.webLocked && !state.me.is_admin);
  const LOCKED_TEXT = 'Fehler beim Laden der Daten (Fehler 423). Bitte später noch einmal versuchen.';

  function lockedView() {
    return h('div', { class: 'card thick' },
      h('div', { class: 'notice alert' }, h('i'),
        h('span', {}, h('b', {}, 'Fehler beim Laden der Daten. '), 'Die Daten konnten nicht geladen werden (Fehler 423). Bitte später noch einmal versuchen.')),
      h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'btn small ghost', onclick: logout }, 'Abmelden')));
  }

  // every 30 s while locked: open again, logged out or still locked
  async function checkUnlocked() {
    if (!lockedOut()) return;
    let me;
    try { me = await rpc('session_info', { p_token: state.token }); } catch { me = undefined; }
    if (!lockedOut()) return;
    if (me === null) {
      clearSession();
      route();
    } else if (me && !me.web_locked) {
      state.me = me;
      state.webLocked = false;
      route();
    } else {
      state.refreshTimer = setTimeout(checkUnlocked, 30000);
    }
  }

  // ---------------------------------------------------------------- Kopfzeile

  function allowedPages() {
    if (!state.me || lockedOut()) return [];
    if (state.me.banned) return ['einspruch'];
    return Object.keys(PAGES).filter((page) => !PAGES[page].admin || state.me.is_admin);
  }

  function currentPage() {
    const match = location.hash.match(/^#\/([a-z]+)/);
    return match ? match[1] : null;
  }

  function renderChrome(active) {
    const pages = allowedPages();
    nav.hidden = pages.length === 0;
    nav.replaceChildren(...pages.filter((page) => !PAGES[page].hidden).map((page) =>
      h('a', { href: '#/' + page, title: PAGES[page].title, class: page === active ? 'on' : null, 'aria-current': page === active ? 'page' : null },
        icon(PAGES[page].icon), h('span', { class: 'long' }, PAGES[page].title), h('span', { class: 'short', 'aria-hidden': 'true' }, PAGES[page].short))));
    userBox.hidden = !state.me;
    if (state.me) {
      const player = [
        head(state.me.uuid, 30),
        h('span', { class: 'name' }, state.me.name),
        state.me.is_admin ? h('span', { class: 'badge guide' }, 'Admin') : null
      ];
      userBox.replaceChildren(
        pages.includes('konto')
          ? h('a', {
            class: 'user-link' + (active === 'konto' ? ' on' : ''), href: '#/konto', title: 'Konto und GitHub',
            'aria-label': `Konto von ${state.me.name}`, 'aria-current': active === 'konto' ? 'page' : null
          }, player)
          : h('span', { class: 'user-link' }, player),
        h('button', { class: 'btn small', onclick: logout, title: 'Abmelden', 'aria-label': 'Abmelden' }, icon('out')));
    }
    setMarketPending(state.marketPending);
    updatePill();
    fitTopbar();
  }

  // The top bar is one row: brand, menu, player. When the menu does not fit centred between the two,
  // these steps are switched on one after another (short names, no admin badge, no texts, icons only).
  const FIT_STEPS = ['fit-short', 'fit-tight', 'fit-slim', 'fit-icons'];

  function fitTopbar() {
    topbar.classList.remove(...FIT_STEPS);
    for (const step of FIT_STEPS) {
      if (topbarFits()) return;
      topbar.classList.add(step);
    }
  }

  function topbarFits() {
    // on phones the menu is a bar at the bottom of the screen
    if (nav.hidden || getComputedStyle(nav).position === 'fixed') return true;
    const style = getComputedStyle(topbar);
    const room = topbar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2 * parseFloat(style.columnGap);
    const side = Math.max(brandPill.scrollWidth, userBox.hidden ? 0 : userBox.scrollWidth);
    return nav.scrollWidth + 2 * side <= room;
  }

  // gold counter on the Boerse link: deals waiting for this player's answer or handover
  function setMarketPending(count) {
    state.marketPending = count || 0;
    const link = nav.querySelector('a[href="#/boerse"]');
    if (!link) return;
    let badge = link.querySelector('.nav-count');
    if (!state.marketPending) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = h('span', { class: 'nav-count', title: 'Deals, bei denen du dran bist' });
      link.append(badge);
    }
    badge.textContent = state.marketPending > 9 ? '9+' : String(state.marketPending);
    fitTopbar();
  }

  // status capsule top left: online/offline and player count, refreshed at most every 30 s
  async function updatePill(status) {
    if (!status) {
      if (Date.now() - state.pillAt < 30000) return;
      state.pillAt = Date.now();
      try { status = await rpc('get_status', { p_token: state.token }); } catch { return; }
    }
    state.pillAt = Date.now();
    if (status.market_pending != null && !state.practice) setMarketPending(status.market_pending);
    // an admin locked or unlocked the website: everyone else sees it at the latest with the next status
    if (state.me && !state.me.is_admin && status.web_locked != null && status.web_locked !== Boolean(state.webLocked)) {
      state.webLocked = status.web_locked;
      route();
    }
    const count = status.player_count || 0;
    pillStatus.replaceChildren(
      h('i', { class: 'dot ' + (status.online ? 'on' : 'off') }),
      status.online ? `Online · ${count} Spieler` : 'Offline');
  }

  // ---------------------------------------------------------------- Von selbst aktualisieren

  // how often each page loads its data again (ms); pages not listed stay as they are
  const AUTO_REFRESH = { start: 30000, boerse: 20000, inventar: 30000, vorschlaege: 60000, abstimmungen: 30000, einspruch: 60000, admin: 20000, konto: 60000 };

  // nothing is re-rendered under the player's hands: no focused or edited field, nothing opened or selected
  function idle() {
    return document.visibilityState === 'visible' && !state.dirty && tour.index < 0 && !state.practice && !state.market.formOpen && !state.market.shopEdit
      && !(currentPage() === 'admin' && state.adminInventory)
      && !document.querySelector('#app input:focus, #app textarea:focus, #app select:focus, #app details[open], #app .slot.on, #app dialog[open]');
  }

  function autoRefresh(page) {
    if (currentPage() !== page) return;
    if (!idle()) {
      state.refreshTimer = setTimeout(() => autoRefresh(page), 5000);
      return;
    }
    refresh();
  }

  // typing marks the page as edited until the next render; search and filters are kept in state anyway
  app.addEventListener('input', (event) => {
    if (!event.target.closest('.search, .market-tools')) state.dirty = true;
  });

  // back in the tab after a while: show fresh data right away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.me) return;
    checkVersion();
    const page = currentPage();
    if (AUTO_REFRESH[page] && Date.now() - state.renderedAt > 15000) autoRefresh(page);
  });

  // ---------------------------------------------------------------- Neue Version der Website

  // GitHub Pages sends an ETag per file; when one of them changes, a new version is online
  const VERSION_FILES = ['index.html', 'app.js', 'style.css', 'config.js', 'items.js', 'practice.js'];
  let versionStamp = null;

  async function checkVersion() {
    if (document.visibilityState !== 'visible') return;
    let stamp;
    try {
      const heads = await Promise.all(VERSION_FILES.map((file) => fetch(file, { method: 'HEAD', cache: 'no-store' })));
      stamp = heads.map((r) => (r.ok ? r.headers.get('etag') || r.headers.get('last-modified') || '' : '')).join('|');
    } catch {
      return; // offline, next time
    }
    if (versionStamp == null) {
      versionStamp = stamp;
    } else if (stamp !== versionStamp) {
      versionStamp = stamp;
      updateWebsite();
    }
  }

  async function updateWebsite() {
    // fresh copies into the browser cache first, otherwise the reload could still use the old files
    await Promise.all(VERSION_FILES.map((file) => fetch(file, { cache: 'reload' }).catch(() => null)));
    if (!state.me || idle()) {
      location.reload();
      return;
    }
    if (document.querySelector('.update-bar')) return;
    document.body.append(h('div', { class: 'update-bar', role: 'status' },
      h('span', {}, 'Die Website wurde aktualisiert.'),
      h('button', { class: 'btn small primary', onclick: () => location.reload() }, 'Neu laden')));
  }

  checkVersion();
  setInterval(checkVersion, 5 * 60 * 1000);

  async function route() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    state.dirty = false;
    const seq = ++renderSeq;
    if (!state.me) {
      renderChrome(null);
      document.title = CONFIG.serverName || 'Server';
      const view = await renderLogin();
      if (seq === renderSeq) app.replaceChildren(view);
      return;
    }
    if (lockedOut()) {
      renderChrome(null);
      document.title = `Fehler · ${CONFIG.serverName}`;
      app.replaceChildren(lockedView());
      state.refreshTimer = setTimeout(checkUnlocked, 30000);
      return;
    }
    let page = currentPage();
    const pages = allowedPages();
    if (!pages.includes(page)) {
      page = pages[0];
      history.replaceState(null, '', '#/' + page);
    }
    renderChrome(page);
    document.title = `${PAGES[page].title} · ${CONFIG.serverName}`;
    try {
      const view = await PAGES[page].render();
      if (seq === renderSeq) {
        app.replaceChildren(view);
        state.renderedAt = Date.now();
        // a page can set its own timer while rendering (the admin page polls faster while commands run)
        if (!state.refreshTimer && AUTO_REFRESH[page]) state.refreshTimer = setTimeout(() => autoRefresh(page), AUTO_REFRESH[page]);
        tourAfterRender();
      }
    } catch (error) {
      if (seq !== renderSeq) return;
      if (error.sessionExpired || error.webLocked) {
        handleError(error);
        return;
      }
      app.replaceChildren(h('div', { class: 'card thick' },
        h('div', { class: 'notice alert' }, h('i'), h('span', {}, h('b', {}, 'Das hat nicht geklappt. '), error.message)),
        h('button', { class: 'btn', style: 'margin-top:14px', onclick: route }, 'Nochmal versuchen')));
    }
  }

  async function refresh() {
    const y = window.scrollY;
    await route();
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- Anmeldung

  async function renderLogin(prefill) {
    const input = h('input', {
      class: 'code-input', maxlength: '9', placeholder: 'ABCD-EFGH', autocomplete: 'one-time-code',
      'aria-label': 'Login-Code', value: prefill || ''
    });
    input.addEventListener('input', () => {
      const raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      input.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
    });
    const button = h('button', { class: 'btn primary', type: 'submit', style: 'width:100%' }, 'Anmelden');
    const form = h('form', {
      class: 'card thick',
      onsubmit: async (event) => {
        event.preventDefault();
        button.disabled = true;
        try { await login(input.value); } catch (error) { toast(error.message, 'error'); } finally { button.disabled = false; }
      }
    },
    h('div', { class: 'stack' }, h('label', {}, 'Login-Code aus dem Spiel'), input, button),
    CONFIG.githubLogin === false ? null : [
      h('div', { class: 'divider' }, 'oder'),
      h('button', { class: 'btn', type: 'button', style: 'width:100%', onclick: () => startGithub('login') }, icon('github'), 'Mit GitHub anmelden'),
      h('p', { class: 'faint small', style: 'margin-top:8px;text-align:center' }, 'Vorher einmal mit Code anmelden und unter „Konto“ (oben rechts auf deinen Kopf klicken) GitHub verknüpfen.')
    ]);

    return h('section', { class: 'login' },
      h('div', { class: 'login-head' },
        h('span', { class: 'mark', 'aria-hidden': 'true' }, h('small', {}, '3'), h('b', {}, 'FA')),
        h('div', {}, h('p', { class: 'eyebrow' }, 'Minecraft-Server'), h('h1', {}, CONFIG.serverName))),
      h('p', { class: 'muted', style: 'margin-bottom:18px' }, 'Vorschläge, Abstimmungen, Weltkarte und Ban-Einsprüche.'),
      form,
      h('div', { class: 'card' },
        h('p', { class: 'eyebrow', style: 'margin-bottom:12px' }, 'So bekommst du deinen Code'),
        h('ol', { class: 'steps' },
          h('li', {}, h('b', { class: 'no' }, '01'), h('span', {}, 'Auf den Server joinen.')),
          h('li', {}, h('b', { class: 'no' }, '02'), h('span', {}, 'Im Chat ', h('span', { class: 'kbd' }, '/weblogin'), ' eingeben.')),
          h('li', {}, h('b', { class: 'no' }, '03'), h('span', {}, 'Code hier eintragen – oder im Chat draufklicken.'))),
        h('p', { class: 'faint small', style: 'margin-top:14px' }, 'Gebannt? Dein Code steht im Bann-Bildschirm, wenn du versuchst zu joinen.')));
  }

  // ---------------------------------------------------------------- Start

  async function renderStart() {
    const [s, githubLink, board] = await Promise.all([
      rpc('get_status', { p_token: state.token }),
      // false = could not check; then the start page simply leaves the hint out
      CONFIG.githubLogin === false ? false : rpc('my_github', { p_token: state.token }).catch(() => false),
      rpc('get_leaderboard', { p_token: state.token }).catch(() => null)
    ]);
    updatePill(s);
    const players = (s.players || []).map((p) => h('span', { class: 'player' }, head(p.uuid, 20), p.name));
    const statusCard = h('div', { class: 'card status-card' },
      h('div', { class: 'status-line' }, h('i', { class: 'dot ' + (s.online ? 'on' : 'off') }), s.online ? 'Online' : 'Offline'),
      s.online
        ? h('div', { class: 'figure' }, `${s.player_count} `, h('small', {}, `/ ${s.max_players} Spieler`))
        : h('p', { class: 'muted', style: 'margin-top:10px' }, 'Der Server ist gerade nicht erreichbar.'),
      s.online && players.length ? h('div', { class: 'players' }, players) : null,
      h('p', { class: 'faint small', style: 'margin-top:14px' }, [s.version ? `Minecraft ${s.version}` : null, s.updated_at ? `Stand ${formatDate(s.updated_at)}` : null].filter(Boolean).join(' · ')));

    const address = s.address && s.game_port ? `${s.address}:${s.game_port}` : null;
    const lanHost = CONFIG.lanHost || 'localhost';
    const lanAddress = s.game_port ? `${lanHost}:${s.game_port}` : null;
    const addressCard = h('div', { class: 'card address-card' },
      h('p', { class: 'eyebrow' }, 'Server-Adresse'),
      address
        ? h('div', { class: 'address' }, h('code', {}, address), h('button', { class: 'btn', onclick: () => copy(address) }, 'Kopieren'))
        : h('p', { class: 'muted', style: 'margin-top:10px' }, 'Erscheint, sobald der Server online ist.'),
      lanAddress ? h('p', { class: 'faint small', style: 'margin-top:12px' }, 'Im selben Heimnetz wie der Server: ',
        h('a', { href: '#', onclick: (event) => { event.preventDefault(); copy(lanAddress); } }, lanAddress)) : null,
      h('p', { class: 'faint small', style: 'margin-top:6px' }, 'Bitte nicht öffentlich teilen.'));

    const mapUrl = s.address && s.map_port ? `http://${s.address}:${s.map_port}/` : null;
    const mapCard = h('div', { class: 'card map-card' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Weltkarte'), h('h3', { style: 'margin-top:6px' }, '3D-Karte der Welt'),
        h('p', { class: 'muted small', style: 'margin-top:4px' }, 'Ohne Spielerstandorte. Läuft direkt auf dem Server.')),
      mapUrl
        ? h('div', { class: 'stack' },
          h('a', { class: 'btn primary', href: mapUrl, target: '_blank', rel: 'noopener' }, icon('map'), 'Karte öffnen'),
          h('p', { class: 'faint small' }, 'Im selben Heimnetz wie der Server? ',
            h('a', { href: `http://${lanHost}:${s.map_port}/`, target: '_blank', rel: 'noopener' }, `${lanHost}:${s.map_port}`)))
        : h('p', { class: 'faint small' }, 'Nur erreichbar, wenn der Server online ist.'));

    return h('div', {},
      pageHead('Übersicht', `Hallo, ${state.me.name}`),
      h('div', { class: 'grid' }, statusCard, addressCard, mapCard),
      board && board.players ? leaderboard(board) : null,
      h('div', { class: 'grid', style: 'margin-top:16px' },
        h('a', { class: 'card link-card', href: '#/boerse' },
          h('h3', {}, 'Börse'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Items kaufen, verkaufen und bestellen.')),
        h('a', { class: 'card link-card', href: '#/inventar' },
          h('h3', {}, 'Inventar'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Inventar, Endertruhe, Shulkerkisten und Rucksäcke ansehen.')),
        h('a', { class: 'card link-card', href: '#/vorschlaege' },
          h('h3', {}, 'Vorschläge'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Ideen für den Server einreichen und bewerten.')),
        h('a', { class: 'card link-card', href: '#/abstimmungen' },
          h('h3', {}, 'Abstimmungen'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Bei Server-Entscheidungen mitbestimmen.')),
        h('a', { class: 'card link-card tour-link', href: '#/start', onclick: (event) => { event.preventDefault(); startTour(); } },
          h('h3', {}, 'Rundgang'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Alle Funktionen in ein paar Minuten, mit Übungs-Börse.')),
        githubLink === null ? githubCard(null) : null));
  }

  // ---------------------------------------------------------------- Bestenliste

  const number = (n) => new Intl.NumberFormat('de-DE').format(n);

  // play time from minutes: "45 Min.", "4,5 Std.", "263 Std."
  function playTime(minutes) {
    if (minutes < 60) return `${minutes} Min.`;
    const hours = minutes / 60;
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: hours < 10 ? 1 : 0 }).format(hours)} Std.`;
  }

  // distance from metres (1 block = 1 m): "850 m", "4,2 km", "263 km"
  function distance(metres) {
    if (metres < 1000) return `${number(metres)} m`;
    const km = metres / 1000;
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
  }

  // value and unit apart, so the number can be big and the unit small
  const splitUnit = (text) => { const cut = text.lastIndexOf(' '); return [text.slice(0, cut), text.slice(cut + 1)]; };
  const splitTime = (minutes) => splitUnit(playTime(minutes));
  const splitDistance = (metres) => splitUnit(distance(metres));
  const counted = (one, many) => (n) => [number(n), n === 1 ? one : many];

  // The categories, each with its own colour (always shown with its title). Colours in this fixed order are
  // checked against the dark background and for colour blindness; keep the order when adding or moving one.
  // The palette has eight colours: every category after the eighth gets the neutral grey, never a made-up colour.
  // mixedUnits: the unit changes with the value (Min./Std., m/km), so short lists show it too.
  const STAT_CATEGORIES = [
    { key: 'minutes', label: 'Spielzeit', top: 'Meiste Spielzeit', color: '#3987e5', format: splitTime, mixedUnits: true },
    { key: 'deaths', label: 'Tode', top: 'Meiste Tode', color: '#d95926', format: counted('Tod', 'Tode') },
    { key: 'monster_kills', label: 'Monsterkills', top: 'Meiste Monsterkills', color: '#199e70', format: counted('Monster', 'Monster') },
    { key: 'mob_kills', label: 'Mobkills (alle)', top: 'Meiste Mobkills', color: '#c98500', format: counted('Mob', 'Mobs') },
    { key: 'player_kills', label: 'Spielerkills', top: 'Meiste Spielerkills', color: '#d55181', format: counted('Spieler', 'Spieler') },
    { key: 'mined', label: 'Blöcke abgebaut', top: 'Meiste Blöcke abgebaut', color: '#008300', format: counted('Block', 'Blöcke') },
    { key: 'placed', label: 'Blöcke platziert', top: 'Meiste Blöcke platziert', color: '#9085e9', format: counted('Block', 'Blöcke') },
    { key: 'tnt', label: 'TNT gesprengt', top: 'Meistes TNT gesprengt', color: '#e66767', format: counted('TNT', 'TNT') },
    { key: 'distance', label: 'Distanz gereist', top: 'Am weitesten gereist', color: '#8A9099', format: splitDistance, mixedUnits: true },
    { key: 'trades', label: 'Dorfbewohner-Handel', top: 'Meiste Dorfbewohner-Handel', color: '#8A9099', format: counted('Handel', 'Handel') },
    { key: 'diamonds', label: 'Diamanterz abgebaut', top: 'Meiste Diamanterze abgebaut', color: '#8A9099', format: counted('Erz', 'Erze') },
    { key: 'totems', label: 'Totems ausgelöst', top: 'Meiste Totems ausgelöst', color: '#8A9099', format: counted('Totem', 'Totems') },
    { key: 'ancient_debris', label: 'Ancient Debris abgebaut', top: 'Meiste Ancient Debris abgebaut', color: '#8A9099', format: counted('Ancient Debris', 'Ancient Debris') },
    { key: 'advancements', label: 'Fortschritte', top: 'Meiste Fortschritte', color: '#8A9099', format: counted('Fortschritt', 'Fortschritte') },
    // the current experience level (it drops on death)
    { key: 'level', label: 'Level', top: 'Höchstes Level', color: '#8A9099', format: (n) => [number(n), 'Level'] }
  ];

  const smallValue = (cat, value) => {
    const [shown, unit] = cat.format(value);
    return h('span', { class: 'board-small', title: `${shown} ${unit}` }, cat.mixedUnits ? `${shown} ${unit}` : shown);
  };

  const boardValue = ([value, unit], extra) => h('b', { class: 'board-value' + (extra || '') }, value, h('small', {}, ` ${unit}`));
  const toned = (cat, cls, ...children) => h('div', { class: cls, style: `--tone:${cat.color}` }, ...children);

  function leaderboard(board) {
    const top = board.top || {};
    const totals = board.totals || {};
    const players = board.players || 0;
    // the whole server first: one figure per category
    const server = h('div', { class: 'card thick board-totals' },
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, 'Server gesamt'), h('span', { class: 'spacer' }),
        h('span', { class: 'faint small' }, `${number(players)} Spieler${board.updated_at ? ` · Stand ${ago(board.updated_at)}` : ''}`)),
      h('div', { class: 'board-figures' }, STAT_CATEGORIES.map((cat) => toned(cat, 'board-figure',
        h('span', { class: 'board-title' }, h('i'), cat.label), boardValue(cat.format(totals[cat.key] || 0))))));
    const tiles = STAT_CATEGORIES.map((cat) => {
      const [first, ...rest] = top[cat.key] || [];
      return toned(cat, 'card thick board-tile',
        h('p', { class: 'eyebrow board-title' }, h('i'), cat.top),
        first
          ? h('div', { class: 'board-first' }, head(first.uuid, 40),
            h('div', {}, boardValue(cat.format(first.value)), h('span', { class: 'board-name' }, first.name)))
          : h('p', { class: 'faint small' }, cat.key === 'tnt' || cat.key === 'ancient_debris' ? 'Wird ab jetzt gezählt.' : 'Noch keine Werte.'),
        rest.length ? h('ol', { class: 'board-rest' }, rest.map((entry) =>
          h('li', {}, head(entry.uuid, 18), h('span', { class: 'board-name' }, entry.name), h('span', { class: 'spacer' }),
            smallValue(cat, entry.value)))) : null,
        first ? h('button', { class: 'btn small ghost board-more', onclick: () => showStatList(cat) }, 'Mehr') : null);
    });
    return h('div', { class: 'board' },
      h('p', { class: 'eyebrow section-label' }, 'Bestenliste'),
      server,
      h('div', { class: 'grid board-grid' }, tiles));
  }

  // "Mehr": every player of one category, best first, your own row marked. Lives in #app, so the page waits
  // with refreshing while it is open and it goes away with the page.
  async function showStatList(cat) {
    const list = h('ol', { class: 'board-list' }, h('li', { class: 'faint small' }, 'Lädt …'));
    const dialog = h('dialog', { class: 'board-dialog', 'aria-label': cat.top,
      onclose: () => dialog.remove(),
      // a click outside the box lands on the dialog itself
      onclick: (event) => { if (event.target === dialog) dialog.close(); } },
      toned(cat, 'card thick board-dialog-box',
        h('div', { class: 'row' }, h('p', { class: 'eyebrow board-title' }, h('i'), cat.top), h('span', { class: 'spacer' }),
          h('button', { class: 'coach-close', 'aria-label': 'Schließen', onclick: () => dialog.close() }, icon('close'))),
        list));
    app.append(dialog);
    dialog.showModal();
    try {
      const players = await rpc('get_stat_list', { p_token: state.token, p_key: cat.key });
      list.replaceChildren(...players.map((entry) =>
        h('li', { class: entry.uuid === state.me.uuid ? 'me' : null },
          h('span', { class: 'board-rank' }, entry.rank ? `${entry.rank}.` : '–'), head(entry.uuid, 20),
          h('span', { class: 'board-name' }, entry.name), h('span', { class: 'spacer' }),
          entry.value ? smallValue(cat, entry.value) : h('span', { class: 'board-small faint' }, '–'))));
      if (!players.length) list.replaceChildren(h('li', { class: 'faint small' }, 'Noch keine Werte.'));
    } catch (error) {
      dialog.close();
      handleError(error);
    }
  }

  // the profile: your own values and your place in every category
  function myStatsCard(mine) {
    if (!mine) {
      return h('div', { class: 'card thick' }, h('p', { class: 'eyebrow' }, 'Deine Statistiken'),
        h('p', { class: 'muted small', style: 'margin-top:10px' }, 'Noch keine Werte. Sie erscheinen, nachdem du auf dem Server warst (spätestens nach 10 Minuten).'));
    }
    const data = mine.data || {};
    const ranks = mine.ranks || {};
    return h('div', { class: 'card thick my-stats' },
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, 'Deine Statistiken'), h('span', { class: 'spacer' }),
        mine.updated_at ? h('span', { class: 'faint small' }, `Stand ${ago(mine.updated_at)}`) : null),
      h('div', { class: 'board-figures' }, STAT_CATEGORIES.map((cat) => toned(cat, 'board-figure',
        h('span', { class: 'board-title' }, h('i'), cat.label),
        boardValue(cat.format(data[cat.key] || 0)),
        h('span', { class: 'faint small' }, data[cat.key] ? `Platz ${ranks[cat.key]} von ${mine.players}` : '–')))));
  }

  // ---------------------------------------------------------------- Inventar

  // item pictures: rendered icons first, then the plain textures; without any picture the slot shows letters
  const ICON_URLS = [
    (id) => `https://mc.nerothe.com/img/1.21.8/minecraft_${id}.png`,
    (id) => `https://assets.mcasset.cloud/26.3/assets/minecraft/textures/item/${id}.png`,
    (id) => `https://assets.mcasset.cloud/26.3/assets/minecraft/textures/block/${id}.png`
  ];
  // German names from the market's item list; the first name wins
  const ITEM_NAMES = new Map(Object.entries({ ...(window.PRICE_ITEM_IDS || {}), ...(window.MARKET_ITEM_IDS || {}) })
    .map(([name, id]) => [id, name]).reverse());
  const ENCHANTS = {
    protection: 'Schutz', fire_protection: 'Feuerschutz', blast_protection: 'Explosionsschutz', projectile_protection: 'Schusssicher',
    feather_falling: 'Federfall', respiration: 'Atmung', aqua_affinity: 'Wasseraffinität', thorns: 'Dornen', depth_strider: 'Wasserläufer',
    frost_walker: 'Eisläufer', soul_speed: 'Seelenläufer', swift_sneak: 'Huschen', sharpness: 'Schärfe', smite: 'Bann',
    bane_of_arthropods: 'Nemesis der Gliederfüßer', knockback: 'Rückstoß', fire_aspect: 'Verbrennung', looting: 'Plünderung',
    sweeping_edge: 'Schwungkraft', efficiency: 'Effizienz', silk_touch: 'Behutsamkeit', unbreaking: 'Haltbarkeit', fortune: 'Glück',
    power: 'Stärke', punch: 'Schlag', flame: 'Flamme', infinity: 'Unendlichkeit', luck_of_the_sea: 'Glück des Meeres', lure: 'Köder',
    loyalty: 'Treue', impaling: 'Harpune', riptide: 'Sog', channeling: 'Entladung', multishot: 'Mehrfachschuss', quick_charge: 'Schnellladen',
    piercing: 'Durchschuss', density: 'Dichte', breach: 'Durchbruch', wind_burst: 'Windstoß', mending: 'Reparatur',
    binding_curse: 'Fluch der Bindung', vanishing_curse: 'Fluch des Verschwindens'
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const CONTAINERS = { shulker: 'Shulkerkiste', backpack: 'Rucksack', bundle: 'Bündel' };

  const prettyId = (id) => String(id).split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const itemName = (item) => item.name || ITEM_NAMES.get(item.id)
    || (String(item.id).endsWith('shulker_box') ? 'Shulkerkiste' : item.id === 'bundle' ? 'Bündel' : prettyId(item.id));
  // a backpack is leather to the game; it looks like a bundle (yellow, green, purple by size)
  const iconId = (item) => item.kind === 'backpack' ? ({ 27: 'green_bundle', 54: 'purple_bundle' })[item.slots] || 'bundle' : item.id;

  function itemLines(item) {
    const lines = [];
    if (item.kind) lines.push(CONTAINERS[item.kind] + (item.items ? ` · ${item.items.length} Stapel drin` : ''));
    if (item.potion) lines.push('Trank: ' + prettyId(item.potion));
    for (const [id, level] of item.ench || []) lines.push(`${ENCHANTS[id] || (window.ENCHANT_NAMES || {})[id] || prettyId(id)} ${ROMAN[level] || level}`);
    if (item.max) lines.push(`Haltbarkeit ${item.max - item.dmg} / ${item.max}`);
    return lines;
  }

  // the picture of a variant is the plain item's: "enchanted_book_sharpness_5", "ominous_bottle_3", "potion_strong_strength" …
  function variantBase(id) {
    const text = String(id);
    if (text.startsWith('enchanted_book_')) return 'enchanted_book';
    if (/^ominous_bottle_[1-5]$/.test(text)) return 'ominous_bottle';
    if (/^firework_rocket_[1-3]$/.test(text)) return 'firework_rocket';
    if (text.startsWith('goat_horn_')) return 'goat_horn';
    for (const form of ['lingering_potion', 'splash_potion', 'tipped_arrow', 'potion']) if (text.startsWith(form + '_')) return form;
    return text;
  }

  function itemIcon(id) {
    const file = variantBase(id);
    const img = h('img', { alt: '', loading: 'lazy', draggable: 'false' });
    let step = 0;
    img.onerror = () => {
      step += 1;
      if (step < ICON_URLS.length) img.src = ICON_URLS[step](file);
      else img.replaceWith(h('span', { class: 'slot-text' }, prettyId(file).split(' ').map((word) => word.charAt(0)).join('').slice(0, 3)));
    };
    img.src = ICON_URLS[0](file);
    return img;
  }

  function slotEl(item, open) {
    if (!item) return h('span', { class: 'slot' });
    const tip = [itemName(item) + (item.n > 1 ? ` × ${item.n}` : ''), ...itemLines(item)].join('\n');
    const el = h('button', {
      type: 'button', title: tip, 'aria-label': tip,
      class: 'slot filled' + (item.items ? ' box' : '') + (item.ench ? ' ench' : ''),
      onclick: () => open(item, el)
    },
    itemIcon(iconId(item)),
    item.n > 1 ? h('b', { class: 'count' }, item.n) : null,
    item.max ? h('i', { class: 'dur', style: `--dur:${Math.max(0, (item.max - item.dmg) / item.max).toFixed(2)}` }) : null);
    return el;
  }

  function slotGrid(items, from, count, open) {
    const bySlot = new Map((items || []).map((item) => [item.s, item]));
    const grid = h('div', { class: 'inv-grid' });
    for (let slot = from; slot < from + count; slot++) grid.append(slotEl(bySlot.get(slot), open));
    return grid;
  }

  // one highlighted slot per area; a second click on it closes the details again
  function selectable(area, show) {
    return (item, el) => {
      const again = el.classList.contains('on');
      area().querySelectorAll('.slot.on').forEach((slot) => slot.classList.remove('on'));
      if (!again) el.classList.add('on');
      show(again ? null : item);
    };
  }

  // details of a clicked item; boxes, backpacks and bundles also show what lies inside (and so on, one level deeper)
  function itemDetail(item) {
    const inner = h('div');
    let box;
    const open = selectable(() => box, (child) => inner.replaceChildren(...(child ? [itemDetail(child)] : [])));
    const size = item.kind === 'bundle' ? Math.max(9, Math.ceil((item.items || []).length / 9) * 9) : item.slots || 27;
    box = h('div', { class: 'inv-detail' },
      h('div', { class: 'inv-detail-head' }, h('span', { class: 'slot filled' }, itemIcon(iconId(item))),
        h('div', {}, h('b', {}, itemName(item) + (item.n > 1 ? ` × ${item.n}` : '')),
          ...itemLines(item).map((line) => h('span', { class: 'faint small' }, line)))),
      item.kind ? ((item.items || []).length ? slotGrid(item.items, 0, size, open) : h('p', { class: 'faint small' }, 'Leer.')) : null,
      inner);
    return box;
  }

  function inventoryView(snap) {
    const data = snap.data || {};
    const s = data.stats || {};
    const inv = data.inv || [];
    const bySlot = new Map(inv.map((item) => [item.s, item]));
    const detail = h('div');
    let area;
    const open = selectable(() => area, (item) => {
      detail.replaceChildren(...(item ? [h('div', { class: 'card thick' }, itemDetail(item))] : []));
      if (item) requestAnimationFrame(() => detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    });
    const section = (title, grid) => h('div', { class: 'inv-section' }, h('p', { class: 'eyebrow' }, title), grid);
    const stats = [
      s.health != null ? `Leben ${s.health} / ${s.max_health}` : null, s.food != null ? `Hunger ${s.food} / 20` : null,
      s.level != null ? `Level ${s.level}` : null, GAMEMODES[s.gamemode],
      s.world ? `${WORLDS[s.world] || s.world} ${s.x} / ${s.y} / ${s.z}` : null
    ].filter(Boolean).join(' · ');
    area = h('div', { class: 'inv' },
      h('p', { class: 'faint small inv-meta' }, `${stats}${stats ? ' · ' : ''}Stand ${ago(snap.updated_at)}`),
      h('div', { class: 'inv-cols' },
        h('div', { class: 'card thick' },
          section('Rüstung und zweite Hand', h('div', { class: 'inv-grid' }, [39, 38, 37, 36, 40].map((slot) => slotEl(bySlot.get(slot), open)))),
          section('Inventar', slotGrid(inv, 9, 27, open)),
          section('Schnellleiste', slotGrid(inv, 0, 9, open))),
        h('div', { class: 'card thick' },
          section('Endertruhe', slotGrid(data.ender, 0, 27, open)),
          h('p', { class: 'faint small', style: 'margin-top:14px' }, 'Klick auf ein Item zeigt Verzauberungen und Haltbarkeit. Bei Shulkerkisten, Rucksäcken und Bündeln siehst du, was drin liegt.'))),
      detail);
    return area;
  }

  async function renderInventory() {
    const snap = await rpc('my_inventory', { p_token: state.token });
    return h('div', {},
      pageHead('Dein Spieler', 'Inventar', 'Inventar und Endertruhe, auch was in deinen Shulkerkisten und Rucksäcken liegt. Solange du online bist, wird es jede Minute aktualisiert.'),
      snap ? inventoryView(snap) : h('div', { class: 'empty' }, 'Noch nichts da. Sobald du auf dem Server bist, erscheint hier nach spätestens einer Minute dein Inventar.'));
  }

  // ---------------------------------------------------------------- Konto

  async function renderAccount() {
    const [githubLink, mine] = await Promise.all([
      CONFIG.githubLogin === false ? null : rpc('my_github', { p_token: state.token }),
      rpc('my_stats', { p_token: state.token }).catch(() => undefined)
    ]);
    const playerCard = h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Minecraft'),
      h('div', { class: 'profile' },
        head(state.me.uuid, 48),
        h('div', {},
          h('h3', {}, state.me.name, state.me.is_admin ? [' ', h('span', { class: 'badge guide' }, 'Admin')] : null),
          h('p', { class: 'muted small', style: 'margin-top:4px' }, 'Mit diesem Spieler bist du angemeldet.'))),
      h('button', { class: 'btn', style: 'margin-top:16px', onclick: logout }, icon('out'), 'Abmelden'));
    const tourCard = h('div', { class: 'card tour-card' },
      h('p', { class: 'eyebrow' }, 'Hilfe'),
      h('h3', { style: 'margin:6px 0 8px' }, 'Rundgang'),
      h('p', { class: 'muted small' }, 'Alle Funktionen der Website Schritt für Schritt. In der Börse übst du mit Übungs-Spielern.'),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: startTour }, icon('guide'), 'Rundgang starten'));
    return h('div', {},
      pageHead('Konto', state.me.name, 'Dein Spieler, deine Statistiken und die Anmeldung mit GitHub.'),
      h('div', { class: 'grid' }, playerCard, githubCard(githubLink), tourCard),
      // undefined: the statistics could not be loaded at all, so the card is left out
      mine === undefined ? null : h('div', { style: 'margin-top:16px' }, myStatsCard(mine)));
  }

  // ---------------------------------------------------------------- Boerse

  // Three colours with a fixed meaning here: Diamant = price, Gold = negotiation (VB), Smaragd = deal
  const URGENCY = ['Kein Stress', 'Diese Woche', 'Heute oder morgen', 'Dringend'];
  const DEAL_STATUS = { open: 'Verhandlung', agreed: 'Deal', done: 'Erledigt', declined: 'Beendet', cancelled: 'Abgebrochen' };
  const LISTING_STATUS = { open: 'Offen', reserved: 'Reserviert', done: 'Erledigt', closed: 'Zurückgezogen' };
  const MARKET_CATEGORIES = window.MARKET_CATEGORIES || [['sonstiges', 'Sonstiges']];
  const CATEGORY_NAMES = Object.fromEntries(MARKET_CATEGORIES);
  const ITEM_IDS = window.MARKET_ITEM_IDS || {};
  const ITEM_CATEGORY = new Map();
  for (const [cat, names] of Object.entries(window.MARKET_ITEMS || {})) {
    for (const name of names) ITEM_CATEGORY.set(name.toLowerCase(), { cat, name });
  }

  function ago(iso) {
    const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    if (minutes < 24 * 60) return `vor ${Math.round(minutes / 60)} Std.`;
    const days = Math.round(minutes / (24 * 60));
    return days < 7 ? `vor ${days} Tag${days === 1 ? '' : 'en'}` : formatDate(iso);
  }

  function amount(quantity, title) { return quantity > 1 ? `${quantity}× ${title}` : title; }
  function diamonds(n) { return `${n} Diamant${n === 1 ? '' : 'en'}`; }
  function priceText(n) { return n == null ? 'VB' : n === 0 ? 'gratis' : diamonds(n); }

  // items a price can be paid in (besides diamonds): every item of the market list and a few more
  const PRICE_CHOICES = new Map(Object.entries({ ...ITEM_IDS, ...(window.PRICE_ITEM_IDS || {}) })
    .filter(([, id]) => id !== 'diamond' && id !== 'diamond_block')
    .map(([name, id]) => [name.toLowerCase(), { name, id }]));

  // 192 -> "3 Stacks", 200 -> "3 Stacks + 8", 32 -> "32"
  function stackText(n) {
    if (n < 64) return String(n);
    const stacks = Math.floor(n / 64);
    return `${stacks} Stack${stacks === 1 ? '' : 's'}${n % 64 ? ` + ${n % 64}` : ''}`;
  }

  const priceItemText = (entry) => `${stackText(entry.amount)} ${itemName({ id: entry.item })}`;

  // the whole price as text: "32 Diamanten + 3 Stacks Redstoneblock"
  function priceLabel(price, items) {
    const parts = [];
    if (price > 0 || (price === 0 && !(items || []).length)) parts.push(priceText(price));
    for (const entry of items || []) parts.push(priceItemText(entry));
    return parts.length ? parts.join(' + ') : 'VB';
  }

  // price in diamonds, plus items with their pictures; without anything it is only "VB"
  function priceTag(price, items) {
    const list = items || [];
    const gems = price == null && !list.length ? h('span', { class: 'price vb' }, h('b', {}, 'VB'))
      : price === 0 && !list.length ? h('span', { class: 'price' }, h('b', {}, 'Gratis'))
        : price > 0 ? h('span', { class: 'price', title: diamonds(price) }, h('b', {}, String(price)), icon('gem')) : null;
    if (!list.length) return gems;
    return h('span', { class: 'price-set', title: priceLabel(price, list) }, gems,
      list.map((entry) => h('span', { class: 'price-item' }, itemIcon(entry.item), h('b', {}, stackText(entry.amount)),
        h('span', {}, itemName({ id: entry.item })))));
  }

  let priceEditorCount = 0;

  // diamonds plus up to five items ("3 Stacks Redstoneblock"); read() gives {price, items} or null after a message
  function priceEditor({ id, price, items, placeholder, label }) {
    const listId = `price-items-${++priceEditorCount}`;
    const gems = priceInput({ id, placeholder: placeholder || 'Diamanten', value: price ?? '', 'aria-label': label || 'Preis in Diamanten' });
    const rows = h('div', { class: 'price-rows' });
    const add = h('button', { type: 'button', class: 'btn small ghost' }, icon('plus'), 'Item als Preis');
    const datalist = h('datalist', { id: listId }, [...PRICE_CHOICES.values()].map((choice) => h('option', { value: choice.name })));
    const addRow = (entry) => {
      const name = h('input', { list: listId, placeholder: 'Item, z. B. Redstoneblock', 'aria-label': 'Item', autocomplete: 'off',
        value: entry ? itemName({ id: entry.item }) : '' });
      const stacks = entry && entry.amount >= 64 && entry.amount % 64 === 0;
      const count = h('input', { inputmode: 'decimal', placeholder: 'Menge', 'aria-label': 'Menge',
        value: entry ? String(stacks ? entry.amount / 64 : entry.amount) : '' });
      const unit = h('select', { 'aria-label': 'Einheit' }, h('option', { value: '1', selected: !stacks }, 'Stück'),
        h('option', { value: '64', selected: stacks }, 'Stacks'));
      const row = h('div', { class: 'price-row' }, name, count, unit,
        h('button', { type: 'button', class: 'btn small ghost', 'aria-label': 'Item entfernen', onclick: () => { row.remove(); sync(); } }, icon('close')));
      row.read = () => {
        const choice = PRICE_CHOICES.get(name.value.trim().toLowerCase());
        const n = Number(count.value.replace(',', '.')) * Number(unit.value);
        if (!name.value.trim() && !count.value.trim()) return undefined;
        if (!choice) throw new Error(`„${name.value.trim() || '?'}“ kenne ich nicht. Bitte ein Item aus der Liste wählen.`);
        if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error(`Bitte eine ganze Menge für ${choice.name} angeben.`);
        return { item: choice.id, amount: n };
      };
      rows.append(row);
      sync();
      return row;
    };
    const sync = () => { add.hidden = rows.children.length >= 5; };
    add.addEventListener('click', () => addRow().querySelector('input').focus());
    for (const entry of items || []) addRow(entry);
    return {
      el: h('div', { class: 'price-editor' }, gems.box, rows, add, datalist),
      gems: gems.input,
      read: () => {
        try {
          const list = [...rows.children].map((row) => row.read()).filter(Boolean);
          const value = gems.input.value === '' ? null : Number(gems.input.value);
          if (value != null && (!Number.isInteger(value) || value < 0 || value > 100000)) throw new Error('Diamanten: eine ganze Zahl von 0 bis 100000.');
          return { price: value, items: list.length ? list : null };
        } catch (error) {
          toast(error.message, 'error');
          return null;
        }
      }
    };
  }

  function priceTypeBadge(type) {
    return h('span', { class: 'badge ' + (type === 'fixed' ? 'set' : 'caution') }, type === 'fixed' ? 'Festpreis' : 'VB');
  }

  function priceInput(attrs) {
    const input = h('input', { type: 'number', min: '0', max: '100000', step: '1', inputmode: 'numeric', ...attrs });
    return { input, box: h('div', { class: 'offer-input' }, input, icon('gem')) };
  }

  async function renderMarket() {
    const m = state.market;
    const [list, mine] = await Promise.all([
      m.view === 'deals' || m.view === 'shops' ? [] : rpc('market_list', { p_token: state.token, p_kind: m.view }),
      rpc('market_mine', { p_token: state.token })
    ]);
    setMarketPending(mine.pending);

    const tabs = [['sell', 'Zu verkaufen'], ['shops', 'Shops'], ['buy', 'Gesucht'], ['deals', 'Meine Deals']];
    const tabBar = h('div', { class: 'filters', role: 'tablist' }, tabs.map(([key, label]) =>
      h('button', {
        class: m.view === key ? 'on' : null, role: 'tab', 'aria-selected': m.view === key ? 'true' : 'false',
        onclick: () => { m.view = key; m.formOpen = false; m.shopEdit = null; m.shopView = null; refresh(); }
      }, label, key === 'deals' && mine.pending ? h('span', { class: 'nav-count' }, mine.pending) : null)));

    const lead = 'Kaufen, verkaufen und bestellen. Bezahlt wird in Diamanten, übergeben im Spiel.';
    const practiceBanner = state.practice ? h('div', { class: 'notice guide practice-banner' }, h('i'),
      h('span', {}, h('b', {}, 'Übungsmodus. '), 'Steve und Alex sind Übungs-Spieler und antworten von selbst. Nichts hier ist echt, alles verschwindet am Ende.'),
      tour.index < 0 ? h('button', { class: 'btn small', onclick: () => { stopPractice(); refresh(); } }, 'Übung beenden') : null) : null;
    const tabsRow = h('div', { class: 'market-tabs' }, tabBar,
      state.practice ? null : h('button', { class: 'btn small ghost', onclick: () => { startPractice(); refresh(); } }, 'Erst mal üben'));
    if (m.view === 'deals') {
      return h('div', {}, pageHead('Item-Börse', 'Börse', lead), practiceBanner, tabsRow, marketDeals(mine));
    }
    if (m.view === 'shops') return renderShops(lead, practiceBanner, tabsRow);
    const form = listingForm(m.view);
    const toggle = h('button', {
      class: 'btn diamond', 'aria-expanded': m.formOpen ? 'true' : 'false',
      onclick: () => {
        m.formOpen = !m.formOpen;
        form.el.hidden = !m.formOpen;
        toggle.setAttribute('aria-expanded', m.formOpen ? 'true' : 'false');
        if (m.formOpen) form.focus();
      }
    }, icon('plus'), m.view === 'sell' ? 'Etwas verkaufen' : 'Etwas suchen');
    return h('div', {},
      pageHead('Item-Börse', 'Börse', lead, toggle),
      practiceBanner,
      tabsRow,
      form.el,
      marketBoard(list, m.view));
  }

  function listingForm(kind) {
    const m = state.market;
    const sell = kind === 'sell';
    let priceType = sell ? 'fixed' : 'vb';

    const title = h('input', { id: 'mk-title', maxlength: '60', list: 'market-items', autocomplete: 'off', required: true, placeholder: sell ? 'z. B. Elytra' : 'z. B. Obsidian' });
    const category = h('select', { id: 'mk-cat', required: true },
      h('option', { value: '' }, 'Bitte wählen'), MARKET_CATEGORIES.map(([id, label]) => h('option', { value: id }, label)));
    // known items fill in their category
    title.addEventListener('change', () => {
      const hit = ITEM_CATEGORY.get(title.value.trim().toLowerCase());
      if (hit) category.value = hit.cat;
    });
    const quantity = h('input', { id: 'mk-qty', type: 'number', min: '1', max: '100000', step: '1', value: '1', required: true, inputmode: 'numeric' });
    const price = priceEditor({ id: 'mk-price' });
    const priceHeading = h('label', { for: 'mk-price' });
    const hint = h('p', { class: 'faint small' });
    const description = h('textarea', { id: 'mk-desc', maxlength: '500', placeholder: sell ? 'Verzauberungen, Zustand, wo ihr euch trefft …' : 'Was genau brauchst du? Bis wann?' });
    const urgency = sell ? null : h('select', { id: 'mk-urgency' }, URGENCY.map((label, i) => h('option', { value: String(i) }, label)));

    const typeButtons = sell ? [['fixed', 'Festpreis'], ['vb', 'VB']].map(([key, label]) =>
      h('button', { type: 'button', 'data-type': key, onclick: () => { priceType = key; syncType(); } }, label)) : [];
    const syncType = () => {
      for (const b of typeButtons) b.className = b.dataset.type === priceType ? 'on' : '';
      const fixed = priceType === 'fixed';
      price.gems.placeholder = fixed ? 'Diamanten' : 'optional';
      priceHeading.textContent = !sell ? 'Was zahlst du ungefähr? Diamanten und/oder Items' : fixed ? 'Festpreis: Diamanten und/oder Items' : 'Preisvorstellung';
      hint.textContent = !sell
        ? 'Suchanfragen sind immer VB: Wer liefern kann, schickt dir ein Angebot und ihr verhandelt.'
        : fixed ? 'Wer kauft, bekommt den Deal sofort. Danach trefft ihr euch im Spiel.'
          : 'Käufer schicken dir Preisvorschläge, du nimmst an, lehnst ab oder machst ein Gegenangebot.';
    };
    syncType();

    const submit = h('button', { class: 'btn diamond', type: 'submit' }, sell ? 'Angebot einstellen' : 'Suchanfrage einstellen');
    const datalist = h('datalist', { id: 'market-items' }, [...ITEM_CATEGORY.values()].map((item) => h('option', { value: item.name })));
    const el = h('form', {
      class: 'card thick market-form', hidden: !m.formOpen,
      onsubmit: (event) => {
        event.preventDefault();
        const offer = price.read();
        if (!offer) return;
        if (priceType === 'fixed' && offer.price == null && !offer.items) {
          toast('Bei Festpreis brauchst du einen Preis: Diamanten, Items oder beides.', 'error');
          return;
        }
        act(submit, async () => {
          // a name from the item list tells the trade chest in the game which item to count
          const known = ITEM_CATEGORY.get(title.value.trim().toLowerCase());
          await rpc('market_create', {
            p_token: state.token, p_kind: kind, p_title: title.value, p_category: category.value,
            p_quantity: Number(quantity.value), p_price: offer.price,
            p_price_type: priceType, p_urgency: urgency ? Number(urgency.value) : 0, p_description: description.value,
            p_item: known ? ITEM_IDS[known.name] || null : null, p_price_items: offer.items
          });
          m.formOpen = false;
        }, sell ? 'Dein Angebot ist online.' : 'Deine Suchanfrage ist online.');
      }
    },
    h('h3', {}, sell ? 'Neues Angebot' : 'Neue Suchanfrage'),
    h('div', { class: 'form-grid' },
      h('div', { class: 'span-2' }, h('label', { for: 'mk-title' }, 'Item'), title, datalist),
      h('div', {}, h('label', { for: 'mk-cat' }, 'Kategorie'), category),
      h('div', {}, h('label', { for: 'mk-qty' }, 'Menge'), quantity),
      sell
        ? h('div', {}, h('label', {}, 'Preisart'), h('div', { class: 'filters', role: 'group', 'aria-label': 'Preisart' }, typeButtons))
        : h('div', {}, h('label', { for: 'mk-urgency' }, 'Wie dringend?'), urgency),
      h('div', { class: 'span-2' }, priceHeading, price.el),
      h('div', { class: 'span-2' }, h('label', { for: 'mk-desc' }, 'Beschreibung (optional)'), description)),
    hint,
    h('div', { class: 'row' }, submit));
    return { el, focus: () => title.focus() };
  }

  function marketBoard(list, kind) {
    const m = state.market;
    if (kind === 'sell' && m.sort === 'urgent') m.sort = 'new';
    const grid = h('div', { class: 'grid market-grid' });
    const count = h('p', { class: 'faint small market-count' });
    const draw = () => {
      const q = m.q.trim().toLowerCase();
      let shown = list.filter((l) =>
        (!q || [l.title, l.description, l.author].some((text) => (text || '').toLowerCase().includes(q))) &&
        (!m.cat || l.category === m.cat) &&
        (kind === 'buy' || m.type === 'all' || l.price_type === m.type));
      if (m.sort === 'cheap') shown = [...shown].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      if (m.sort === 'expensive') shown = [...shown].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      if (m.sort === 'urgent') shown = [...shown].sort((a, b) => b.urgency - a.urgency);
      const noun = kind === 'sell' ? ['Angebot', 'Angebote'] : ['Suchanfrage', 'Suchanfragen'];
      count.textContent = shown.length === list.length ? `${list.length} ${noun[list.length === 1 ? 0 : 1]}` : `${shown.length} von ${list.length}`;
      grid.replaceChildren(...(shown.length ? shown.map(listingCard) : [h('div', { class: 'empty' },
        list.length ? 'Nichts gefunden. Probier andere Filter.'
          : kind === 'sell' ? 'Noch keine Angebote. Stell das erste ein!' : 'Noch keine Suchanfragen. Was brauchst du?')]));
    };

    const search = h('input', {
      class: 'search', type: 'search', value: m.q, 'aria-label': 'Suchen',
      placeholder: 'Item oder Spieler suchen …',
      oninput: () => { m.q = search.value; draw(); }
    });
    const select = (key, label, options) => {
      const el = h('select', { 'aria-label': label, onchange: () => { m[key] = el.value; draw(); } },
        options.map(([value, text]) => h('option', { value, selected: m[key] === value }, text)));
      return el;
    };
    const sorts = [['new', 'Neueste zuerst'], ['cheap', 'Preis aufsteigend'], ['expensive', 'Preis absteigend']];
    if (kind === 'buy') sorts.push(['urgent', 'Dringendste zuerst']);
    const tools = h('div', { class: 'market-tools' + (kind === 'buy' ? ' three' : '') },
      search,
      select('cat', 'Kategorie', [['', 'Alle Kategorien'], ...MARKET_CATEGORIES]),
      select('sort', 'Sortierung', sorts),
      kind === 'sell' ? select('type', 'Preisart', [['all', 'Festpreis und VB'], ['fixed', 'Nur Festpreis'], ['vb', 'Nur VB']]) : null);
    draw();
    return h('div', {}, tools, count, grid);
  }

  function listingCard(l) {
    const sell = l.kind === 'sell';
    const reserved = l.status === 'reserved';
    return h('article', { class: 'card thick listing' + (reserved ? ' reserved' : ''), 'data-listing': l.id },
      h('div', { class: 'listing-top' },
        h('span', { class: 'eyebrow' }, CATEGORY_NAMES[l.category] || 'Sonstiges'),
        !sell && l.urgency > 0 ? h('span', { class: 'badge' + (l.urgency === 3 ? ' urgent' : '') }, URGENCY[l.urgency]) : null,
        h('span', { class: 'spacer' }),
        h('span', { class: 'faint small' }, ago(l.created_at))),
      h('h3', {}, sell ? amount(l.quantity, l.title) : `Suche ${amount(l.quantity, l.title)}`),
      h('div', { class: 'price-row' },
        !sell && (l.price != null || l.price_items) ? h('span', { class: 'muted small' }, 'Bietet') : null,
        priceTag(l.price, l.price_items),
        l.price == null && !l.price_items ? h('span', { class: 'muted small' }, 'Preis verhandelbar') : priceTypeBadge(l.price_type)),
      l.description ? h('p', { class: 'listing-text' }, l.description) : null,
      h('div', { class: 'listing-foot' },
        h('span', { class: 'who' }, head(l.uuid, 20), l.mine ? 'Du' : l.author),
        h('span', { class: 'spacer' }),
        reserved ? h('span', { class: 'badge ok' }, 'Reserviert')
          : l.deal_count ? h('span', { class: 'faint small' }, `${l.deal_count} verhandel${l.deal_count === 1 ? 't' : 'n'}`) : null),
      listingActions(l));
  }

  function listingActions(l) {
    const toDeals = () => { state.market.view = 'deals'; refresh(); window.scrollTo(0, 0); };
    const remove = l.can_remove ? h('button', {
      class: 'btn small ghost warn',
      onclick: (event) => {
        if (!confirm(l.mine ? 'Eintrag zurückziehen? Laufende Verhandlungen werden beendet.' : 'Eintrag als Admin entfernen?')) return;
        act(event.currentTarget, () => rpc('market_close', { p_token: state.token, p_id: l.id }), l.mine ? 'Zurückgezogen.' : 'Entfernt.');
      }
    }, l.mine ? 'Zurückziehen' : 'Entfernen') : null;
    const bar = (...children) => h('div', { class: 'listing-actions' }, ...children, h('span', { class: 'spacer' }), remove);

    if (l.mine) return bar(l.deal_count ? h('button', { class: 'btn small', onclick: toDeals }, 'Zu deinen Deals') : h('span', { class: 'faint small' }, 'Dein Eintrag'));
    if (l.my_deal) return bar(h('button', { class: 'btn small', onclick: toDeals }, 'Du verhandelst schon · Zum Deal'));
    if (l.status !== 'open') return remove ? bar() : null;

    if (l.kind === 'sell' && l.price_type === 'fixed') {
      return bar(h('button', {
        class: 'btn emerald',
        onclick: (event) => {
          if (!confirm(`${amount(l.quantity, l.title)} für ${priceLabel(l.price, l.price_items)} von ${l.author} kaufen? Danach trefft ihr euch im Spiel zur Übergabe.`)) return;
          act(event.currentTarget, async () => {
            await rpc('market_buy', { p_token: state.token, p_listing_id: l.id });
            state.market.view = 'deals';
            window.scrollTo(0, 0);
          }, 'Gekauft! Der Deal steht unter „Meine Deals“.');
        }
      }, l.price_items ? 'Kaufen' : `Kaufen · ${priceText(l.price)}`));
    }

    // VB: price offer for an Angebot, delivery offer for a Suchanfrage; starts with the asked price
    const price = priceEditor({ price: l.price, items: l.price_items, label: 'Dein Preis in Diamanten' });
    const send = h('button', { class: 'btn gold', type: 'submit' }, l.kind === 'sell' ? 'Preis vorschlagen' : 'Ich kann liefern');
    return h('form', {
      class: 'listing-actions offer',
      onsubmit: (event) => {
        event.preventDefault();
        const offer = price.read();
        if (!offer) return;
        if (offer.price == null && !offer.items) {
          toast('Bitte einen Preis angeben: Diamanten, Items oder beides.', 'error');
          return;
        }
        act(send, async () => {
          await rpc('market_offer', { p_token: state.token, p_listing_id: l.id, p_price: offer.price, p_body: null, p_price_items: offer.items });
          state.market.view = 'deals';
          window.scrollTo(0, 0);
        }, 'Angebot geschickt. Weiter geht es unter „Meine Deals“.');
      }
    }, price.el, send, h('span', { class: 'spacer' }), remove);
  }

  function marketDeals(mine) {
    // a secured deal stays up top until both sides have taken their things out of the trade chest
    const running = (d) => d.status === 'open' || d.status === 'agreed' || !!(d.escrow && d.escrow.inside);
    const active = mine.deals.filter(running);
    const past = mine.deals.filter((d) => !running(d));
    return h('div', {},
      h('p', { class: 'eyebrow section-label' }, 'Laufende Deals'),
      active.length ? active.map(dealCard) : h('div', { class: 'empty' }, 'Gerade keine laufenden Deals. Schau bei „Zu verkaufen“ oder „Gesucht“ vorbei.'),
      h('p', { class: 'eyebrow section-label' }, 'Deine Einträge'),
      mine.listings.length ? h('div', { class: 'card thick my-listings' }, mine.listings.map(myListingRow)) : h('div', { class: 'empty' }, 'Du hast noch nichts eingestellt.'),
      past.length ? [h('p', { class: 'eyebrow section-label' }, 'Beendet (letzte 14 Tage)'), ...past.map(dealCard)] : null);
  }

  // the trade chest in the game (/handel); the server reports here how full it is
  function escrowNotice(d) {
    const e = d.escrow || {};
    const giveGoods = (d.listing.kind === 'sell') === d.i_own_listing;
    if (e.locked) {
      return h('div', { class: 'notice ok' }, h('i'), h('span', {}, h('b', {}, 'Gesichert! '),
        `Ware und Bezahlung liegen in der Handelstruhe. Hol dir im Spiel mit /handel ${giveGoods ? 'die Bezahlung' : 'die Ware'} ab.`));
    }
    if (d.status !== 'agreed') {
      return h('div', { class: 'notice caution' }, h('i'), h('span', {}, h('b', {}, 'Handelstruhe: '),
        'Der Deal ist abgebrochen. Was du hineingelegt hast, nimmst du im Spiel mit /handel wieder raus.'));
    }
    // a shop purchase filled from the shop's stock: only the payment is missing
    if (e.from_shop) {
      return h('div', { class: 'notice ok' }, h('i'), h('span', {},
        h('b', {}, `Deal über ${priceLabel(d.price, d.price_items)}. `),
        giveGoods
          ? 'Die Ware kam von selbst aus dem Lager deines Shops. Sobald bezahlt ist, liegt die Bezahlung in der Kasse (/handel → dein Shop).'
          : 'Die Ware liegt schon in der Handelstruhe. Leg im Spiel mit /handel die Bezahlung rein, dann nimmst du sie mit.'));
    }
    const goods = e.auto ? `${e.goods} von ${e.goods_needed}`
      : e.confirmed ? 'freigegeben' : e.goods_stacks ? `${e.goods_stacks} Stapel, wartet auf Freigabe` : 'noch leer';
    const check = d.listing.item ? 'Die Ware zählt der Server automatisch.'
      : giveGoods ? `${d.partner} schaut sich deine Ware an und gibt sie frei.` : 'Du schaust dir die Ware an und gibst sie frei.';
    // what of the payment is inside: diamonds and every price item
    const paid = [d.price > 0 || !d.price_items ? `${e.paid || 0} von ${diamonds(d.price || 0)}` : null,
      ...(e.pay_items || []).map((p) => `${p.have} von ${stackText(p.need)} ${itemName({ id: p.item })}`)].filter(Boolean).join(', ');
    return h('div', { class: 'notice ok' }, h('i'), h('span', {},
      h('b', {}, `Deal über ${priceLabel(d.price, d.price_items)}. `),
      `Übergabe im Spiel mit /handel: Du legst ${giveGoods ? 'die Ware' : 'die Bezahlung'} in die Handelstruhe. `,
      'Erst wenn beide Seiten vollständig sind, kann jeder die andere Seite nehmen. So kann niemand betrügen. ', check,
      e.inside ? h('span', { class: 'escrow-progress' }, `Ware: ${goods} · Bezahlung: ${paid}`) : null,
      e.too_big ? h('span', { class: 'escrow-progress' }, 'Zu groß für eine Handelstruhe: Tauscht direkt und bestätigt dann die Übergabe.') : null));
  }

  function dealRole(d) {
    if (d.listing.kind === 'sell') return d.i_own_listing ? `Du verkaufst an ${d.partner}` : `Du kaufst von ${d.partner}`;
    return d.i_own_listing ? `${d.partner} liefert dir` : `Du lieferst an ${d.partner}`;
  }

  function dealCard(d) {
    const active = d.status === 'open' || d.status === 'agreed';
    const myTurn = d.status === 'open' && !d.last_by_me;
    const call = (fn) => () => rpc(fn, { p_token: state.token, p_deal_id: d.id });

    const top = h('div', { class: 'deal-head' },
      head(d.partner_uuid, 32),
      h('div', { class: 'deal-title' }, h('h3', {}, amount(d.listing.quantity, d.listing.title)),
        h('p', { class: 'muted small' }, dealRole(d) + (d.listing.shop ? ` · Shop „${d.listing.shop}“` : ''))),
      myTurn ? h('span', { class: 'badge caution' }, 'Du bist dran') : null,
      d.status === 'agreed' ? h('span', { class: 'badge ok' }, 'Übergabe offen') : null,
      d.escrow && d.escrow.locked && d.escrow.inside ? h('span', { class: 'badge ok' }, 'Abholen') : null,
      active ? null : h('span', { class: 'badge' + (d.status === 'done' ? ' ok' : '') }, DEAL_STATUS[d.status]));

    // Verhandlung (gold) -> Deal -> Uebergeben (smaragd)
    const reached = { open: 0, agreed: 1, done: 3 }[d.status];
    const steps = reached == null ? null : h('ol', { class: 'deal-steps' }, ['Verhandlung', 'Deal', 'Übergeben'].map((label, i) =>
      h('li', { class: (i === 0 ? 'talk' : 'deal') + (i < reached ? ' done' : i === reached ? ' now' : '') }, h('i'), label)));

    const summary = d.price == null && !d.price_items ? null : h('div', { class: 'deal-sum' },
      h('span', {}, d.status === 'open' ? (d.last_by_me ? 'Dein letztes Angebot' : `Angebot von ${d.partner}`) : 'Vereinbart'),
      priceTag(d.price, d.price_items));

    const log = h('div', { class: 'deal-log' }, d.messages.map((msg) => {
      if (msg.kind === 'system') return h('p', { class: 'log-system' }, msg.body);
      const when = h('time', { datetime: msg.created_at }, ago(msg.created_at));
      if (msg.kind === 'offer') {
        return h('p', { class: 'log-offer' + (msg.mine ? ' mine' : '') },
          h('b', {}, msg.mine ? 'Du' : msg.author), msg.mine ? ' bietest ' : ' bietet ', h('span', { class: 'chip' }, priceLabel(msg.price, msg.price_items)), when);
      }
      return h('p', { class: 'log-text' + (msg.mine ? ' mine' : '') }, h('b', {}, (msg.mine ? 'Du' : msg.author) + ': '), msg.body, when);
    }));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });

    const controls = [];
    if (d.status === 'open') {
      const counter = priceEditor({ label: d.last_by_me ? 'Neuer Preis in Diamanten' : 'Gegenangebot in Diamanten' });
      const counterButton = h('button', { class: 'btn gold', type: 'submit' }, d.last_by_me ? 'Neues Angebot' : 'Gegenangebot');
      controls.push(h('div', { class: 'deal-actions' },
        myTurn
          ? h('button', {
            class: 'btn emerald', title: priceLabel(d.price, d.price_items),
            onclick: (event) => act(event.currentTarget, call('market_accept'), 'Deal! Trefft euch im Spiel zur Übergabe.')
          }, icon('check'), d.price_items ? 'Annehmen' : `Annehmen · ${priceText(d.price)}`)
          : h('span', { class: 'muted small' }, `Wartet auf ${d.partner} …`),
        h('form', {
          class: 'offer',
          onsubmit: (event) => {
            event.preventDefault();
            const offer = counter.read();
            if (!offer) return;
            if (offer.price == null && !offer.items) {
              toast('Bitte einen Preis angeben: Diamanten, Items oder beides.', 'error');
              return;
            }
            act(counterButton, () => rpc('market_counter', { p_token: state.token, p_deal_id: d.id, p_price: offer.price, p_price_items: offer.items }),
              'Angebot geschickt.');
          }
        }, counter.el, counterButton),
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn small ghost warn',
          onclick: (event) => {
            if (confirm(d.i_own_listing ? `Angebot von ${d.partner} ablehnen?` : 'Verhandlung beenden?')) {
              act(event.currentTarget, call('market_decline'), d.i_own_listing ? 'Abgelehnt.' : 'Verhandlung beendet.');
            }
          }
        }, d.i_own_listing ? 'Ablehnen' : 'Zurückziehen')));
    }
    if (d.status === 'agreed') {
      controls.push(escrowNotice(d));
      controls.push(h('div', { class: 'deal-actions' },
        d.escrow && d.escrow.inside ? null : h('button', {
          class: 'btn emerald', title: 'Nur wenn ihr ohne Handelstruhe direkt im Spiel getauscht habt',
          onclick: (event) => {
            if (confirm('Habt ihr direkt im Spiel getauscht, ohne Handelstruhe? Danach ist der Deal erledigt.')) act(event.currentTarget, call('market_done'), 'Erledigt. Danke fürs Handeln!');
          }
        }, icon('check'), 'Übergabe bestätigen'),
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn small ghost warn',
          onclick: (event) => {
            if (confirm('Deal wirklich abbrechen? Der Eintrag ist danach wieder offen.')) act(event.currentTarget, call('market_cancel'), 'Deal abgebrochen.');
          }
        }, 'Deal abbrechen')));
    }
    if (d.status !== 'agreed' && d.escrow && d.escrow.inside) controls.push(escrowNotice(d));
    if (active) {
      const text = h('input', { maxlength: '500', placeholder: `Nachricht an ${d.partner} …`, 'aria-label': 'Nachricht' });
      const sendButton = h('button', { class: 'btn', type: 'submit' }, 'Senden');
      controls.push(h('form', {
        class: 'deal-chat',
        onsubmit: (event) => {
          event.preventDefault();
          if (!text.value.trim()) return;
          act(sendButton, () => rpc('market_message', { p_token: state.token, p_deal_id: d.id, p_body: text.value }));
        }
      }, text, sendButton));
    }

    return h('article', { class: 'card thick deal' + (myTurn ? ' my-turn' : '') + (active ? '' : ' finished'), 'data-deal-listing': d.listing.id },
      top, steps, summary, log, controls);
  }

  function myListingRow(l) {
    const active = l.status === 'open' || l.status === 'reserved';
    return h('div', { class: 'my-row' },
      h('span', { class: 'badge' + (l.kind === 'sell' ? ' set' : '') }, l.kind === 'sell' ? 'Angebot' : 'Suchanfrage'),
      h('div', { class: 'my-row-main' },
        h('b', {}, amount(l.quantity, l.title)),
        h('span', { class: 'faint small' }, [priceLabel(l.price, l.price_items), l.kind === 'sell' && l.price_type === 'fixed' ? 'Festpreis' : 'VB', ago(l.created_at)].join(' · '))),
      l.deal_count && active ? h('span', { class: 'faint small' }, `${l.deal_count} im Gespräch`) : null,
      h('span', { class: 'badge' + (l.status === 'reserved' || l.status === 'done' ? ' ok' : '') }, LISTING_STATUS[l.status]),
      active ? h('button', {
        class: 'btn small ghost warn',
        onclick: (event) => {
          if (confirm('Eintrag zurückziehen? Laufende Verhandlungen werden beendet.')) {
            act(event.currentTarget, () => rpc('market_close', { p_token: state.token, p_id: l.id }), 'Zurückgezogen.');
          }
        }
      }, 'Zurückziehen') : null);
  }

  // ---------------------------------------------------------------- Shops (Karteikarten auf der Börse)

  // tab colours of the index cards, same list as market_shops.color in the database
  const SHOP_COLORS = [['rot', 'Rot'], ['orange', 'Orange'], ['gelb', 'Gelb'], ['gruen', 'Grün'], ['tuerkis', 'Türkis'],
    ['blau', 'Blau'], ['lila', 'Lila'], ['pink', 'Pink']];
  const SHOP_MAX = 3;
  const SHOP_PRODUCTS_MAX = 12;
  // PostgREST answers like this until the shop functions are in the database
  const missingFunction = (error) => /could not find the function|schema cache/i.test(error && error.message || '');

  async function renderShops(lead, practiceBanner, tabsRow) {
    const m = state.market;
    let list;
    try {
      list = await rpc('shop_list', { p_token: state.token });
    } catch (error) {
      if (!missingFunction(error)) throw error;
      return h('div', {}, pageHead('Item-Börse', 'Börse', lead), practiceBanner, tabsRow,
        h('div', { class: 'notice caution' }, h('i'), h('span', {}, h('b', {}, 'Die Shops werden gerade eingerichtet. '),
          'Schau in ein paar Minuten nochmal vorbei.')));
    }
    const mine = list.filter((shop) => shop.mine);
    const editing = m.shopEdit === 'new' ? null : list.find((shop) => shop.id === m.shopEdit && shop.mine);
    if (m.shopEdit !== 'new' && !editing) m.shopEdit = null;
    // the owner's overview of one shop, like /handel in the game
    let overview = null;
    if (m.shopView && !m.shopEdit) {
      try {
        overview = shopOverview(await rpc('shop_overview', { p_token: state.token, p_shop_id: m.shopView }));
      } catch (error) {
        if (!missingFunction(error)) {
          m.shopView = null;
          throw error;
        }
        overview = h('div', { class: 'notice caution' }, h('i'), h('span', {}, h('b', {}, 'Die Übersicht wird gerade eingerichtet. '),
          'Schau in ein paar Minuten nochmal vorbei.'));
      }
    }
    const open = mine.length < SHOP_MAX ? h('button', {
      class: 'btn diamond', onclick: () => { m.shopEdit = 'new'; refresh(); }
    }, icon('plus'), 'Shop eröffnen') : null;

    const board = h('div', { class: 'shop-board' });
    const count = h('p', { class: 'faint small market-count' });
    const draw = () => {
      const q = m.q.trim().toLowerCase();
      const shown = list.filter((shop) => !q || [shop.name, shop.slogan, shop.owner, ...shop.products.map((p) => p.title)]
        .some((text) => (text || '').toLowerCase().includes(q)));
      count.textContent = shown.length === list.length ? `${list.length} Shop${list.length === 1 ? '' : 's'}` : `${shown.length} von ${list.length}`;
      board.replaceChildren(...(shown.length ? shown.map(shopCard) : [h('div', { class: 'empty' },
        list.length ? 'Kein Shop passt. Probier ein anderes Wort.' : 'Noch keine Shops. Eröffne den ersten!')]));
    };
    const search = h('input', {
      class: 'search', type: 'search', value: m.q, 'aria-label': 'Shops durchsuchen',
      placeholder: 'Shop, Item oder Spieler suchen …', oninput: () => { m.q = search.value; draw(); }
    });
    draw();
    return h('div', {},
      pageHead('Item-Börse', 'Börse', lead, open),
      practiceBanner,
      tabsRow,
      m.shopEdit ? shopEditor(editing) : overview,
      h('div', { class: 'market-tools one' }, search),
      count,
      board);
  }

  // price on the card: diamonds and items, small and in ink
  function shopPrice(p) {
    const parts = [];
    if (p.price > 0 || !(p.price_items || []).length) {
      parts.push(p.price === 0 ? h('b', {}, 'gratis') : h('span', { class: 'shop-gems' }, h('b', {}, String(p.price)), icon('gem')));
    }
    for (const entry of p.price_items || []) parts.push(h('span', { class: 'shop-pay' }, itemIcon(entry.item), h('b', {}, stackText(entry.amount))));
    return h('span', { class: 'shop-price', title: priceLabel(p.price, p.price_items) }, parts);
  }

  function shopCard(shop) {
    const paused = shop.status !== 'open';
    const toDeals = () => { state.market.view = 'deals'; refresh(); window.scrollTo(0, 0); };
    const line = (p) => {
      // with a stock in the game: how often it can still be bought (null: handed over by hand)
      const soldOut = p.stock === 0;
      const stockNote = p.stock == null ? null
        : h('span', { class: 'shop-note' + (soldOut ? ' out' : ''), title: 'Liegt im Lager des Shops, wird automatisch übergeben' },
          soldOut ? 'ausverkauft' : `noch ${p.stock}×`);
      let action = null;
      if (shop.mine) {
        action = p.deal_count ? h('span', { class: 'shop-note' }, `${p.deal_count} offen`) : null;
      } else if (p.my_deal) {
        action = h('button', { class: 'shop-btn', onclick: toDeals, title: 'Du hast das gekauft, die Übergabe läuft' }, 'Zum Deal');
      } else {
        action = h('button', {
          class: 'shop-btn', disabled: paused || soldOut, title: paused ? 'Der Shop hat gerade geschlossen' : soldOut ? 'Gerade nichts im Lager' : null,
          onclick: (event) => {
            if (!confirm(`${amount(p.quantity, p.title)} für ${priceLabel(p.price, p.price_items)} im Shop „${shop.name}“ von ${shop.owner} kaufen? `
              + 'Danach legt ihr im Spiel mit /handel Ware und Bezahlung in die Handelstruhe.')) return;
            act(event.currentTarget, async () => {
              await rpc('market_buy', { p_token: state.token, p_listing_id: p.id });
              state.market.view = 'deals';
              window.scrollTo(0, 0);
            }, 'Gekauft! Der Deal steht unter „Meine Deals“.');
          }
        }, 'Kaufen');
      }
      return h('li', { class: 'shop-line', 'data-listing': p.id },
        p.item ? itemIcon(p.item) : h('i', { class: 'shop-bullet' }),
        h('span', { class: 'shop-item' }, amount(p.quantity, p.title)),
        h('span', { class: 'shop-leader', 'aria-hidden': 'true' }),
        h('span', { class: 'shop-buyline' }, stockNote, shopPrice(p), action));
    };
    const own = shop.mine ? h('div', { class: 'shop-own' },
      h('button', { class: 'shop-btn', onclick: () => { state.market.shopView = shop.id; state.market.shopEdit = null; refresh(); window.scrollTo(0, 0); } }, 'Übersicht'),
      h('button', { class: 'shop-btn', onclick: () => { state.market.shopEdit = shop.id; state.market.shopView = null; refresh(); window.scrollTo(0, 0); } }, 'Bearbeiten'),
      h('button', {
        class: 'shop-btn',
        onclick: (event) => act(event.currentTarget, () => rpc('shop_set_status', { p_token: state.token, p_id: shop.id, p_status: paused ? 'open' : 'paused' }),
          paused ? 'Dein Shop ist wieder geöffnet.' : 'Pausiert: Niemand kann kaufen, laufende Übergaben gehen weiter.')
      }, paused ? 'Öffnen' : 'Pausieren')) : null;
    const remove = !shop.mine && shop.can_remove ? h('button', {
      class: 'shop-btn warn',
      onclick: (event) => {
        if (confirm(`Shop „${shop.name}“ von ${shop.owner} als Admin entfernen? Laufende Käufe werden abgebrochen.`)) {
          act(event.currentTarget, () => rpc('shop_set_status', { p_token: state.token, p_id: shop.id, p_status: 'closed' }), 'Shop entfernt.');
        }
      }
    }, 'Entfernen') : null;
    return h('article', { class: `shop-card c-${shop.color}` + (paused ? ' paused' : ''), 'data-shop': shop.id },
      h('div', { class: 'shop-tab' }, shop.icon ? itemIcon(shop.icon) : null, h('span', {}, shop.name)),
      h('div', { class: 'shop-paper' },
        paused ? h('span', { class: 'shop-stamp' }, 'Geschlossen') : null,
        h('p', { class: 'shop-slogan' }, shop.slogan || 'Shop von ' + shop.owner),
        h('ul', { class: 'shop-lines' }, shop.products.length ? shop.products.map(line)
          : h('li', { class: 'shop-line shop-blank' }, shop.mine ? 'Noch leer: unter „Bearbeiten“ Produkte eintragen.' : 'Noch keine Produkte.')),
        h('div', { class: 'shop-foot' },
          head(shop.uuid, 20), h('span', {}, shop.mine ? 'Dein Shop' : shop.owner),
          h('span', { class: 'spacer' }),
          shop.sold ? h('span', { class: 'shop-note' }, `${shop.sold}× verkauft`) : null,
          remove),
        own));
  }

  // the owner's overview of a shop: what /handel shows in the game (stock, till, chests, purchases that wait),
  // plus who bought how much. info comes from the server (null until it has reported), the rest from the database.
  function shopOverview(o) {
    const m = state.market;
    const info = o.info || null;
    const close = h('button', { class: 'btn small ghost', type: 'button', onclick: () => { m.shopView = null; refresh(); } }, 'Schließen');
    const section = (title, ...body) => h('section', { class: 'ov-box' }, h('p', { class: 'eyebrow section-label' }, title), ...body);
    const row = (pic, main, side, sub) => h('div', { class: 'ov-row' },
      pic ? h('span', { class: 'shop-row-icon' }, pic) : null,
      h('div', { class: 'my-row-main' }, h('b', {}, main), sub ? h('span', { class: 'faint small' }, sub) : null),
      side != null ? h('span', { class: 'ov-side' }, side) : null);
    const empty = (text) => h('p', { class: 'faint small' }, text);
    const many = (n) => (n >= 64 ? stackText(n) : null);
    const full = info && info.limit && info.stacks >= info.limit;

    let stock;
    if (info) {
      const kinds = info.kinds || [];
      stock = section('Lager',
        kinds.length ? h('div', {}, kinds.map((k) => row(itemIcon(k.item), itemName({ id: k.item }), number(k.amount), many(k.amount))))
          : empty('Leer.'),
        h('p', { class: 'faint small' + (full ? ' warn-text' : '') }, info.limit
          ? `${number(info.stacks)} von ${number(info.limit)} Stacks belegt${full ? ' – voll, der Rest bleibt in den Kisten.' : ''}`
          : `${number(info.stacks)} Stacks belegt, Platz ohne Grenze`));
    } else if (o.stock && Object.keys(o.stock).length) {
      stock = section('Lager', h('div', {}, Object.entries(o.stock).map(([id, n]) => row(itemIcon(id), itemName({ id }), number(n), many(n)))));
    } else {
      stock = section('Lager', empty('Noch nichts drin. Leg Ware im Spiel hinein: /handel → dein Shop.'));
    }

    const tillList = info ? info.till || [] : null;
    const till = section('Kasse',
      tillList == null ? empty('Kommt, sobald der Server den Shop gemeldet hat.')
        : tillList.length ? h('div', {}, tillList.map((t) => row(itemIcon(t.item), itemName({ id: t.item }), number(t.amount))),
          h('p', { class: 'faint small' }, 'Abholen im Spiel: /handel → dein Shop → Kasse.'))
          : empty('Leer. Hier landet die Bezahlung für jeden Verkauf.'));

    const products = section('Produkte', o.products.length ? h('div', {}, o.products.map((p) => row(p.item ? itemIcon(p.item) : null,
      amount(p.quantity, p.title), p.in_stock == null ? null : `${number(p.in_stock)} im Lager`,
      [priceLabel(p.price, p.price_items), p.in_stock == null ? 'Übergabe von Hand' : `${number(Math.floor(p.in_stock / p.quantity))}× kaufbar`,
        `${number(p.sold)}× verkauft`, p.open ? `${p.open} offen` : null].filter(Boolean).join(' · '))))
      : empty('Noch keine Produkte.'));

    const chestList = info ? info.chests || [] : [];
    // the switch for the linked chests; o.pull is missing until the database knows it
    const paused = o.pull === false;
    const pullSwitch = o.pull == null ? null : h('div', { class: 'ov-switch' + (paused ? ' off' : '') },
      h('span', { class: 'ov-switch-text' }, h('b', {}, paused ? 'Aufnahme pausiert' : 'Aufnahme läuft'),
        h('span', { class: 'faint small' }, paused ? 'Der Shop lässt die Kisten in Ruhe.' : 'Der Shop zieht alles, was er verkauft, aus den Kisten.')),
      h('button', {
        class: 'btn small' + (paused ? ' emerald' : ' ghost'), type: 'button',
        onclick: (event) => act(event.currentTarget, () => rpc('shop_set_pull', { p_token: state.token, p_shop_id: o.id, p_on: paused }),
          paused ? 'Die Kisten werden wieder ins Lager gezogen.' : 'Pausiert: Die Kisten bleiben, wie sie sind.')
      }, paused ? 'Einschalten' : 'Pausieren'));
    const chests = section('Verknüpfte Kisten', pullSwitch, chestList.length ? h('div', {}, chestList.map((c) => row(itemIcon('chest'),
      `${c.x} ${c.y} ${c.z}`, c.loaded ? (c.waiting ? `${number(c.waiting)} drin` : 'leer') : 'nicht geladen',
      paused ? 'Pausiert: bleibt, wie sie ist.'
        : !c.loaded ? 'Niemand in der Nähe: sie wird geleert, sobald jemand dort ist.'
          : c.waiting ? (full ? 'Bleibt drin, das Lager ist voll.' : 'Kommt beim nächsten Abgleich ins Lager.') : 'Alles ist im Lager.')))
      : empty(info ? 'Keine. Im Spiel: /handel → dein Shop → Trichter, dann die Kiste anklicken.' : 'Kommt, sobald der Server den Shop gemeldet hat.'));

    const orderState = (d) => {
      const e = d.escrow;
      if (d.status === 'open') return 'angefragt';
      if (!e) return 'wartet auf den Server';
      if (e.paid) return 'bezahlt, wird abgeschlossen';
      if (e.goods_needed != null && e.goods >= e.goods_needed) return `Ware liegt bereit, ${d.buyer} muss noch bezahlen`;
      return e.auto ? 'wartet auf Ware: im Lager ist nicht genug' : 'wartet auf Ware von dir (von Hand in die Truhe)';
    };
    const orders = section(`Offene Bestellungen (${o.orders.length})`, o.orders.length
      ? h('div', {}, o.orders.map((d) => row(head(d.uuid, 24), `${d.buyer}: ${amount(d.quantity, d.title)}`, priceLabel(d.price, d.price_items),
        `${orderState(d)} · ${ago(d.created_at)}`)))
      : empty('Keine. Jede neue Bestellung wird automatisch aus dem Lager gefüllt.'));

    const buyers = section(`Wer hat gekauft (${o.buyers.length})`, o.buyers.length
      ? h('div', {}, o.buyers.map((b) => row(head(b.uuid, 24), b.name, `${number(b.purchases)}× gekauft`,
        [b.items.map((i) => `${number(i.amount)}× ${i.title}`).join(', '), b.diamonds ? `${diamonds(b.diamonds)} bezahlt` : null,
          `zuletzt ${ago(b.last)}`].filter(Boolean).join(' · '))))
      : empty('Noch niemand.'));

    const sales = section('Letzte Verkäufe', o.sales.length
      ? h('div', {}, o.sales.map((s) => row(head(s.uuid, 24), `${s.buyer}: ${amount(s.quantity, s.title)}`, priceLabel(s.price, s.price_items), ago(s.at))))
      : empty('Noch keine.'));

    const t = o.totals || {};
    const totals = h('div', { class: 'ov-totals' },
      h('span', {}, h('b', {}, number(t.purchases || 0)), t.purchases === 1 ? ' Verkauf' : ' Verkäufe'),
      h('span', {}, h('b', {}, number(t.buyers || 0)), ` Käufer`),
      h('span', {}, h('b', {}, number(t.items || 0)), ' Items verkauft'),
      h('span', {}, h('b', {}, number(t.diamonds || 0)), ' Diamanten eingenommen'),
      info ? h('span', {}, h('b', {}, number(info.waiting_pay || 0)), ' warten auf Bezahlung') : null,
      info ? h('span', {}, h('b', {}, number(info.waiting_goods || 0)), ' warten auf Ware') : null);

    return h('div', { class: 'card thick market-form shop-overview' },
      h('div', { class: 'row' }, h('h3', {}, `„${o.name}“ – Übersicht`), h('span', { class: 'spacer' }), close),
      h('p', { class: 'faint small' }, o.info_at ? `Stand aus dem Spiel: ${ago(o.info_at)} – aktualisiert sich von selbst.`
        : 'Der Server hat diesen Shop noch nicht gemeldet; Lager und Kasse erscheinen nach dem nächsten Abgleich.'),
      totals,
      h('div', { class: 'ov-grid' }, stock, till, products, chests),
      orders, buyers, sales);
  }

  // opening a shop (shop = null) or editing one: name, text, colour, picture and the products
  function shopEditor(shop) {
    const m = state.market;
    let color = shop ? shop.color : 'blau';
    const name = h('input', { id: 'shop-name', maxlength: '40', required: true, value: shop ? shop.name : '', placeholder: 'z. B. Raketenshop' });
    const slogan = h('input', { id: 'shop-slogan', maxlength: '160', value: shop ? shop.slogan : '', placeholder: 'z. B. Flugdauer 3, immer auf Lager' });
    const iconInput = h('input', { id: 'shop-icon', list: 'shop-items', autocomplete: 'off', placeholder: 'z. B. Feuerwerksrakete',
      value: shop && shop.icon ? itemName({ id: shop.icon }) : '' });
    // only real Minecraft items (with their variant): the stock and the linked chests fill those by themselves
    const items = h('datalist', { id: 'shop-items' }, [...ITEM_CATEGORY.values()].filter((item) => ITEM_IDS[item.name])
      .map((item) => h('option', { value: item.name })));
    const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Farbe des Reiters' });
    const syncColor = () => {
      for (const b of swatches.children) {
        b.classList.toggle('on', b.dataset.color === color);
        b.setAttribute('aria-checked', b.dataset.color === color ? 'true' : 'false');
      }
    };
    for (const [key, label] of SHOP_COLORS) {
      swatches.append(h('button', { type: 'button', class: `swatch c-${key}`, role: 'radio', 'data-color': key, title: label, 'aria-label': label,
        onclick: () => { color = key; syncColor(); } }));
    }
    syncColor();
    const itemId = (text) => {
      const known = ITEM_CATEGORY.get(text.trim().toLowerCase());
      return known ? ITEM_IDS[known.name] || null : null;
    };
    const save = h('button', { class: 'btn diamond', type: 'submit' }, shop ? 'Speichern' : 'Shop eröffnen');
    const close = h('button', { class: 'btn small ghost', type: 'button', onclick: () => { m.shopEdit = null; refresh(); } }, shop ? 'Fertig' : 'Abbrechen');
    const settings = h('form', {
      onsubmit: (event) => {
        event.preventDefault();
        if (iconInput.value.trim() && !itemId(iconInput.value)) {
          toast(`„${iconInput.value.trim()}“ kenne ich nicht. Bitte ein Item aus der Liste wählen oder leer lassen.`, 'error');
          return;
        }
        act(save, async () => {
          const id = await rpc('shop_save', { p_token: state.token, p_id: shop ? shop.id : null, p_name: name.value, p_slogan: slogan.value,
            p_color: color, p_icon: itemId(iconInput.value) });
          // a new shop stays open in the editor, so the products come right after
          m.shopEdit = id;
        }, shop ? 'Gespeichert.' : 'Dein Shop ist offen. Jetzt noch Produkte eintragen!');
      }
    },
    h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'shop-name' }, 'Name des Shops'), name),
      h('div', {}, h('label', { for: 'shop-icon' }, 'Bild auf dem Reiter (optional)'), iconInput, items),
      h('div', { class: 'span-2' }, h('label', { for: 'shop-slogan' }, 'Kurzer Text (optional)'), slogan),
      h('div', { class: 'span-2' }, h('label', {}, 'Farbe'), swatches)),
    h('div', { class: 'row shop-editor-row' }, save, h('span', { class: 'spacer' }), close));

    if (!shop) {
      return h('div', { class: 'card thick market-form shop-editor' }, h('h3', {}, 'Neuer Shop'),
        h('p', { class: 'faint small' }, `Bis zu ${SHOP_MAX} Shops mit je ${SHOP_PRODUCTS_MAX} Produkten. Jedes Produkt kann man immer wieder kaufen, `
          + 'die Übergabe läuft wie bei jedem Deal über die Handelstruhe (/handel).'), settings);
    }

    const productRows = shop.products.map((p) => h('div', { class: 'my-row' },
      p.item ? h('span', { class: 'shop-row-icon' }, itemIcon(p.item)) : null,
      h('div', { class: 'my-row-main' }, h('b', {}, amount(p.quantity, p.title)), h('span', { class: 'faint small' }, priceLabel(p.price, p.price_items)),
        p.item ? null : h('span', { class: 'small warn-text' }, 'Kein Item aus der Liste: Lager und Kiste füllen das nicht. Entfernen und neu eintragen.')),
      p.deal_count ? h('span', { class: 'faint small' }, `${p.deal_count} offen`) : null,
      h('button', {
        class: 'btn small ghost warn',
        onclick: (event) => {
          if (confirm(`${amount(p.quantity, p.title)} aus dem Shop nehmen?${p.deal_count ? ' Laufende Käufe werden abgebrochen.' : ''}`)) {
            act(event.currentTarget, () => rpc('market_close', { p_token: state.token, p_id: p.id }), 'Aus dem Shop genommen.');
          }
        }
      }, 'Entfernen')));

    const title = h('input', { id: 'shop-product', maxlength: '60', list: 'shop-items', autocomplete: 'off', required: true, placeholder: 'z. B. Feuerwerksrakete (Flugdauer 3)' });
    const quantity = h('input', { id: 'shop-qty', type: 'number', min: '1', max: '100000', step: '1', value: '1', required: true, inputmode: 'numeric' });
    const price = priceEditor({ id: 'shop-price' });
    const add = h('button', { class: 'btn emerald', type: 'submit', disabled: shop.products.length >= SHOP_PRODUCTS_MAX }, icon('plus'), 'Ins Regal');
    const productForm = h('form', {
      onsubmit: (event) => {
        event.preventDefault();
        const offer = price.read();
        if (!offer) return;
        if (offer.price == null && !offer.items) {
          toast('Bitte einen Preis angeben: Diamanten, Items oder beides.', 'error');
          return;
        }
        const known = ITEM_CATEGORY.get(title.value.trim().toLowerCase());
        if (!known || !ITEM_IDS[known.name]) {
          toast(`„${title.value.trim()}“ ist kein Item aus der Liste. Wähl eins aus (z. B. „Feuerwerksrakete (Flugdauer 3)“), `
            + 'nur dann füllen Lager und verknüpfte Kiste die Bestellungen.', 'error');
          return;
        }
        act(add, () => rpc('shop_add_product', {
          p_token: state.token, p_shop_id: shop.id, p_title: title.value, p_quantity: Number(quantity.value),
          p_price: offer.price, p_price_items: offer.items, p_item: known ? ITEM_IDS[known.name] || null : null,
          p_category: known ? known.cat : null
        }), 'Ist im Shop.');
      }
    },
    h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'shop-product' }, 'Item'), title),
      h('div', {}, h('label', { for: 'shop-qty' }, 'Menge pro Kauf'), quantity),
      h('div', { class: 'span-2' }, h('label', { for: 'shop-price' }, 'Preis: Diamanten und/oder Items'), price.el)),
    h('p', { class: 'faint small' }, 'Wer kauft, bekommt genau diese Menge zu diesem Preis. Leg die Ware vorher im Spiel ins Lager '
      + '(/handel → dein Shop): Dann füllt der Server jede Bestellung von selbst und die Bezahlung landet in der Kasse. '
      + 'Das geht für Items aus der Liste.'),
    h('div', { class: 'row' }, add));

    return h('div', { class: 'card thick market-form shop-editor' },
      h('h3', {}, `„${shop.name}“ bearbeiten`),
      settings,
      h('p', { class: 'eyebrow section-label' }, `Produkte (${shop.products.length} von ${SHOP_PRODUCTS_MAX})`),
      productRows.length ? h('div', { class: 'my-listings' }, productRows) : h('p', { class: 'faint small' }, 'Noch keine Produkte.'),
      shop.products.length < SHOP_PRODUCTS_MAX ? productForm : null,
      h('div', { class: 'row shop-editor-row' },
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn small ghost warn',
          onclick: (event) => {
            if (confirm(`„${shop.name}“ für immer schließen? Alle Produkte verschwinden und laufende Käufe werden abgebrochen.`)) {
              act(event.currentTarget, async () => {
                await rpc('shop_set_status', { p_token: state.token, p_id: shop.id, p_status: 'closed' });
                m.shopEdit = null;
              }, 'Shop geschlossen.');
            }
          }
        }, 'Shop schließen')));
  }

  // ---------------------------------------------------------------- Plots

  const PLOT_ACTIONS = [['break', 'abgebaut'], ['place', 'gebaut'], ['harvest', 'geerntet'], ['take', 'aus Kisten genommen'],
    ['put', 'in Kisten gelegt'], ['kill', 'Tiere/Mobs getötet'], ['bucket', 'Eimer benutzt']];
  const PLOT_ACTION_LABEL = Object.fromEntries(PLOT_ACTIONS);
  const secondsAgo = (at) => ago(new Date(at * 1000).toISOString());

  // the plot link in the nav: only for players who own or share a plot, and for admins
  async function loadPlotCount() {
    try {
      const plots = await rpc('my_plots', { p_token: state.token });
      PAGES.plots.hidden = !(plots.length || (state.me && state.me.is_admin));
    } catch {
      PAGES.plots.hidden = true;
    }
  }

  async function renderPlots() {
    const lead = 'Deine Plots und wer dort in den letzten Tagen etwas gemacht hat. Plots steckt der Admin ab, '
      + 'wer was darf, stellst du im Spiel mit /plot ein.';
    let plots;
    try {
      plots = await rpc('my_plots', { p_token: state.token });
    } catch (error) {
      if (!missingFunction(error)) throw error;
      return h('div', {}, pageHead('Grundstücke', 'Plots', lead),
        h('div', { class: 'notice caution' }, h('i'), h('span', {}, h('b', {}, 'Die Plots werden gerade eingerichtet. '), 'Schau später nochmal vorbei.')));
    }
    PAGES.plots.hidden = !(plots.length || state.me.is_admin);
    const mine = plots.filter((p) => p.mine);
    const others = plots.filter((p) => !p.mine);
    return h('div', {},
      pageHead('Grundstücke', 'Plots', lead),
      plots.length ? null : h('div', { class: 'empty' }, 'Du hast noch keinen Plot. Plots, zum Beispiel für Farmen, vergibt der Admin: frag Julian im Spiel.'),
      mine.length ? h('div', { class: 'plot-list' }, mine.map(plotCard)) : null,
      others.length ? h('p', { class: 'eyebrow section-label' }, state.me.is_admin ? 'Alle anderen Plots' : 'Hier bist du Mitglied') : null,
      others.length ? h('div', { class: 'plot-list' }, others.map(plotCard)) : null);
  }

  function plotCard(p) {
    const width = p.max_x - p.min_x + 1;
    const length = p.max_z - p.min_z + 1;
    const members = (p.members || []).length
      ? h('div', { class: 'plot-members' }, p.members.map((m) => h('span', { class: 'plot-member' }, head(m.uuid, 18), m.name)))
      : h('span', { class: 'faint small' }, 'Keine Mitglieder');
    const a = p.activity;
    let activity = null;
    if (a) {
      const players = a.players || [];
      const summary = (counts) => PLOT_ACTIONS.filter(([key]) => counts[key]).map(([key, label]) => `${number(counts[key])} ${label}`).join(' · ');
      activity = h('div', { class: 'plot-activity' },
        h('p', { class: 'eyebrow section-label' }, `Wer war hier? Letzte ${a.days || 7} Tage`),
        players.length ? h('div', {}, players.map((x) => h('div', { class: 'ov-row' + (x.member ? '' : ' plot-outsider') },
          h('span', { class: 'shop-row-icon' }, head(x.uuid, 24)),
          h('div', { class: 'my-row-main' }, h('b', {}, x.name),
            h('span', { class: 'faint small' }, summary(x.counts || {}) || 'nur kleine Dinge')),
          h('span', { class: 'ov-side' }, h('span', { class: 'badge ' + (x.owner ? 'set' : x.member ? '' : 'pending') },
            x.owner ? 'Besitzer' : x.member ? 'Mitglied' : 'kein Mitglied'),
            h('span', { class: 'faint small plot-when' }, secondsAgo(x.last))))))
          : h('p', { class: 'faint small' }, 'In dieser Zeit hat hier niemand etwas abgebaut, gebaut oder geerntet.'),
        (a.recent || []).length ? h('div', {},
          h('p', { class: 'eyebrow section-label' }, 'Zuletzt von Nicht-Mitgliedern'),
          a.recent.map((e) => h('div', { class: 'ov-row' },
            e.what ? h('span', { class: 'shop-row-icon' }, itemIcon(e.what)) : null,
            h('div', { class: 'my-row-main' }, h('b', {}, `${e.name}: ${PLOT_ACTION_LABEL[e.action] || e.action}${e.what ? ` (${itemName({ id: e.what })})` : ''}`),
              h('span', { class: 'faint small' }, `bei ${e.x} ${e.y} ${e.z}`)),
            h('span', { class: 'ov-side faint small' }, secondsAgo(e.at)))))
          : null,
        h('p', { class: 'faint small' }, `Aus dem Prism-Protokoll des Servers (Stand: ${p.activity_at ? ago(p.activity_at) : 'unbekannt'}). `
          + 'Wurde etwas zerstört, kann der Admin es zurücksetzen.'));
    } else if (!p.mine) {
      activity = h('p', { class: 'faint small' }, state.me.is_admin ? 'Noch keine Aktivität gemeldet.' : 'Du bist Mitglied in diesem Plot.');
    }
    return h('article', { class: 'card thick plot-card' },
      h('div', { class: 'row' }, h('h3', {}, p.name), h('span', { class: 'spacer' }),
        p.mine ? null : h('span', { class: 'faint small' }, `von ${p.owner}`)),
      h('p', { class: 'faint small' }, `${p.world === 'world1_nether' ? 'Nether' : p.world === 'world1_the_end' ? 'End' : 'Oberwelt'} · `
        + `${p.min_x} ${p.min_z} bis ${p.max_x} ${p.max_z} · ${number(width)} × ${number(length)} Blöcke`),
      h('div', { class: 'row plot-member-row' }, h('span', { class: 'faint small' }, 'Mitglieder:'), members),
      activity);
  }

  // ---------------------------------------------------------------- Vorschlaege

  async function renderSuggestions() {
    const list = await rpc('list_suggestions', { p_token: state.token });

    const title = h('input', { maxlength: '80', placeholder: 'Kurzer Titel, z. B. „Shop-Viertel am Spawn“' });
    const body = h('textarea', { maxlength: '1500', placeholder: 'Beschreibe deine Idee (optional)' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Einreichen');
    const form = h('form', {
      class: 'card thick stack suggestion-form',
      onsubmit: (event) => {
        event.preventDefault();
        act(submit, () => rpc('create_suggestion', { p_token: state.token, p_title: title.value, p_body: body.value }), 'Danke für deinen Vorschlag!');
      }
    }, h('h3', {}, 'Neuer Vorschlag'), h('div', {}, h('label', {}, 'Titel'), title), h('div', {}, h('label', {}, 'Beschreibung'), body),
      h('div', { class: 'row' }, submit, h('span', { class: 'faint small' }, 'Höchstens 5 pro Tag.')));

    const filters = [['all', 'Alle'], ['open', 'Offen'], ['accepted', 'Angenommen'], ['done', 'Umgesetzt'], ['rejected', 'Abgelehnt']];
    const filterBar = h('div', { class: 'filters', role: 'tablist' }, filters.map(([key, label]) => {
      const count = key === 'all' ? list.length : list.filter((s) => s.status === key).length;
      return h('button', {
        class: state.filter === key ? 'on' : null, role: 'tab', 'aria-selected': state.filter === key ? 'true' : 'false',
        onclick: () => { state.filter = key; refresh(); }
      }, label, h('span', { class: 'mono' }, count));
    }));

    const shown = list.filter((s) => state.filter === 'all' || s.status === state.filter);
    return h('div', {},
      pageHead('Mitbestimmen', 'Vorschläge', 'Ideen für den Server. Jeder kann einmal dafür oder dagegen stimmen.'),
      form,
      h('div', { style: 'margin:22px 0 14px' }, filterBar),
      shown.length ? shown.map(suggestionCard) : h('div', { class: 'empty' }, 'Noch keine Vorschläge in dieser Ansicht.'));
  }

  function suggestionCard(s) {
    const vote = (value) => (event) => {
      const next = s.my_vote === value ? 0 : value;
      act(event.currentTarget, () => rpc('vote_suggestion', { p_token: state.token, p_id: s.id, p_value: next }));
    };
    return h('article', { class: 'card thick suggestion' },
      h('div', { class: 'vote' },
        h('button', { class: 'up' + (s.my_vote === 1 ? ' active' : ''), title: 'Dafür', 'aria-label': 'Dafür', 'aria-pressed': s.my_vote === 1 ? 'true' : 'false', onclick: vote(1) }, icon('up')),
        h('span', { class: 'score', title: `${s.up} dafür, ${s.down} dagegen` }, s.score > 0 ? `+${s.score}` : s.score),
        h('button', { class: 'down' + (s.my_vote === -1 ? ' active' : ''), title: 'Dagegen', 'aria-label': 'Dagegen', 'aria-pressed': s.my_vote === -1 ? 'true' : 'false', onclick: vote(-1) }, icon('down'))),
      h('div', {},
        h('div', { class: 'row' }, h('h3', {}, s.title), h('span', { class: 'badge ' + s.status }, SUGGESTION_STATUS[s.status])),
        h('div', { class: 'meta' }, `von ${s.author} · ${formatDate(s.created_at)} · ${s.up} dafür, ${s.down} dagegen`),
        s.body ? h('div', { class: 'body' }, s.body) : null,
        s.admin_note ? h('div', { class: 'admin-note' }, h('strong', {}, 'Admin: '), s.admin_note) : null,
        threadSection(s),
        state.me.is_admin ? suggestionAdminTools(s) : null));
  }

  // ---------------------------------------------------------------- Antworten (Forum)

  function answersLabel(count) {
    return count === 0 ? 'Antworten' : `${count} Antwort${count === 1 ? '' : 'en'}`;
  }

  // collapsed by default; open threads stay open when the page reloads after a vote or a new answer
  function threadSection(s) {
    const open = state.openThreads.has(s.id);
    const label = h('span', {}, answersLabel(s.comment_count || 0));
    const thread = h('div', { class: 'thread', hidden: !open });
    const toggle = h('button', {
      class: 'btn small', 'aria-expanded': open ? 'true' : 'false',
      onclick: () => {
        const nowOpen = !state.openThreads.has(s.id);
        if (nowOpen) state.openThreads.add(s.id);
        else state.openThreads.delete(s.id);
        thread.hidden = !nowOpen;
        toggle.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        if (nowOpen) loadThread(s, thread, label);
      }
    }, icon('chat'), label);
    if (open) loadThread(s, thread, label);
    return h('div', {}, h('div', { class: 'thread-bar' }, toggle), thread);
  }

  async function loadThread(s, thread, label) {
    if (!thread.hasChildNodes()) thread.append(h('p', { class: 'faint small' }, 'Antworten werden geladen …'));
    let comments;
    try {
      comments = await rpc('list_comments', { p_token: state.token, p_suggestion_id: s.id });
    } catch (error) {
      handleError(error);
      return;
    }
    label.textContent = answersLabel(comments.filter((c) => !c.deleted).length);
    const children = new Map();
    for (const c of comments) {
      const key = c.parent_id == null ? 0 : c.parent_id;
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(c);
    }
    const reload = () => loadThread(s, thread, label);
    const roots = (children.get(0) || []).map((c) => commentNode(s, c, 0, children, reload)).filter(Boolean);
    thread.replaceChildren(
      replyForm(s.id, null, reload, 'Antwort auf den Vorschlag schreiben …'),
      roots.length ? h('div', { class: 'comments' }, roots) : h('p', { class: 'faint small', style: 'margin-top:12px' }, 'Noch keine Antworten. Schreib die erste!'));
  }

  // replies below a comment are indented up to three levels, deeper ones continue on the third level
  function commentNode(s, c, depth, children, reload) {
    const kids = (children.get(c.id) || []).map((k) => commentNode(s, k, depth + 1, children, reload)).filter(Boolean);
    if (c.deleted && kids.length === 0) return null;
    const slot = h('div', { class: 'reply-slot' });
    const remove = async (event) => {
      const button = event.currentTarget;
      if (!confirm('Antwort löschen?')) return;
      button.disabled = true;
      try {
        await rpc('delete_comment', { p_token: state.token, p_id: c.id });
        toast('Antwort gelöscht.', 'ok');
        reload();
      } catch (error) {
        handleError(error);
        button.disabled = false;
      }
    };
    const reply = () => {
      slot.replaceChildren(replyForm(s.id, c.id, reload, `Antwort an ${c.author} …`, () => slot.replaceChildren()));
      slot.querySelector('textarea').focus();
    };
    return h('div', { class: 'comment' },
      h('div', { class: 'comment-head' },
        c.deleted ? null : [head(c.uuid, 20), h('b', {}, c.author), c.author_is_admin ? h('span', { class: 'badge guide' }, 'Admin') : null],
        h('span', { class: 'faint' }, formatDate(c.created_at))),
      c.deleted
        ? h('p', { class: 'comment-body faint' }, 'Diese Antwort wurde gelöscht.')
        : h('div', { class: 'comment-body' }, c.body),
      c.deleted ? null : h('div', { class: 'comment-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: reply }, 'Antworten'),
        c.can_delete ? h('button', { class: 'btn ghost warn', type: 'button', onclick: remove }, 'Löschen') : null),
      slot,
      kids.length ? h('div', { class: 'replies' + (depth >= 2 ? ' flat' : '') }, kids) : null);
  }

  function replyForm(suggestionId, parentId, reload, placeholder, onCancel) {
    const text = h('textarea', { maxlength: '1000', placeholder, rows: '3' });
    const send = h('button', { class: 'btn small primary', type: 'submit' }, 'Senden');
    const form = h('form', {
      class: 'reply-form',
      onsubmit: async (event) => {
        event.preventDefault();
        send.disabled = true;
        try {
          await rpc('create_comment', { p_token: state.token, p_suggestion_id: suggestionId, p_parent_id: parentId, p_body: text.value });
          toast('Antwort gesendet.', 'ok');
          reload();
        } catch (error) {
          handleError(error);
          send.disabled = false;
        }
      }
    },
    text,
    h('div', { class: 'row' }, send,
      onCancel ? h('button', { class: 'btn small ghost', type: 'button', onclick: onCancel }, 'Abbrechen') : null,
      h('span', { class: 'faint small' }, 'Strg + Enter sendet')));
    text.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
    });
    return form;
  }

  function suggestionAdminTools(s) {
    const status = h('select', { 'aria-label': 'Status' },
      Object.entries(SUGGESTION_STATUS).map(([key, label]) => {
        const option = h('option', { value: key }, label);
        option.selected = key === s.status;
        return option;
      }));
    const note = h('input', { maxlength: '500', placeholder: 'Antwort an alle (optional)', value: s.admin_note || '' });
    return h('div', { class: 'admin-tools' }, status, note,
      h('button', {
        class: 'btn small primary',
        onclick: (event) => act(event.currentTarget, () => rpc('admin_set_suggestion_status',
          { p_token: state.token, p_id: s.id, p_status: status.value, p_note: note.value }), 'Gespeichert.')
      }, 'Speichern'),
      h('button', {
        class: 'btn small danger',
        onclick: (event) => {
          if (confirm(`Vorschlag „${s.title}“ wirklich löschen?`)) {
            act(event.currentTarget, () => rpc('admin_delete_suggestion', { p_token: state.token, p_id: s.id }), 'Gelöscht.');
          }
        }
      }, 'Löschen'));
  }

  // ---------------------------------------------------------------- Abstimmungen

  async function renderPolls() {
    const polls = await rpc('list_polls', { p_token: state.token });
    return h('div', {},
      pageHead('Mitbestimmen', 'Abstimmungen', 'Server-Entscheidungen. Deine Stimme kannst du ändern, solange die Abstimmung läuft.'),
      state.me.is_admin ? pollCreateForm() : null,
      polls.length ? polls.map(pollCard) : h('div', { class: 'empty' }, 'Gerade läuft keine Abstimmung.'));
  }

  function pollCard(p) {
    const total = p.total || 0;
    const options = p.options.map((label, index) => {
      const count = p.counts ? p.counts[index] : 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return h('button', {
        class: 'option' + (p.my_vote === index ? ' mine' : ''),
        disabled: !p.open,
        'aria-pressed': p.my_vote === index ? 'true' : 'false',
        onclick: (event) => act(event.currentTarget, () => rpc('vote_poll', { p_token: state.token, p_poll_id: p.id, p_option: index }), 'Stimme gespeichert.')
      },
      h('span', { class: 'fill', style: `width:${pct}%` }),
      h('span', { class: 'label' }, h('span', {}, label), h('span', { class: 'pct' }, `${count} · ${pct} %`)));
    });
    const meta = [`von ${p.created_by}`, formatDate(p.created_at), `${total} Stimme${total === 1 ? '' : 'n'}`];
    if (p.closes_at) meta.push((p.open ? 'endet ' : 'endete ') + formatDate(p.closes_at));
    return h('article', { class: 'card thick' },
      h('div', { class: 'row' }, h('h3', {}, p.question), h('span', { class: 'badge ' + (p.open ? 'ok' : '') }, p.open ? 'Läuft' : 'Beendet'),
        p.my_vote != null ? h('span', { class: 'badge set' }, 'Abgestimmt') : null),
      h('div', { class: 'faint small', style: 'margin:4px 0 6px' }, meta.join(' · ')),
      options,
      state.me.is_admin ? h('div', { class: 'row', style: 'margin-top:14px' },
        p.open ? h('button', { class: 'btn small', onclick: (event) => act(event.currentTarget, () => rpc('admin_close_poll', { p_token: state.token, p_id: p.id }), 'Abstimmung beendet.') }, 'Beenden') : null,
        h('button', {
          class: 'btn small danger',
          onclick: (event) => { if (confirm('Abstimmung wirklich löschen?')) act(event.currentTarget, () => rpc('admin_delete_poll', { p_token: state.token, p_id: p.id }), 'Gelöscht.'); }
        }, 'Löschen')) : null);
  }

  function pollCreateForm() {
    const question = h('input', { maxlength: '200', placeholder: 'z. B. Soll das End nächstes Wochenende geöffnet werden?' });
    const options = h('textarea', { placeholder: 'Ja\nNein\nEgal', style: 'min-height:90px' });
    const closes = h('input', { type: 'datetime-local' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Abstimmung starten');
    return h('details', { class: 'card thick' },
      h('summary', {}, h('span', {}, h('span', { class: 'badge guide', style: 'margin-right:10px' }, 'Admin'), 'Neue Abstimmung')),
      h('form', {
        class: 'stack', style: 'margin-top:14px',
        onsubmit: (event) => {
          event.preventDefault();
          const list = options.value.split('\n').map((line) => line.trim()).filter(Boolean);
          const closesAt = closes.value ? new Date(closes.value).toISOString() : null;
          act(submit, () => rpc('admin_create_poll', { p_token: state.token, p_question: question.value, p_options: list, p_closes_at: closesAt }), 'Abstimmung gestartet.');
        }
      },
      h('div', {}, h('label', {}, 'Frage'), question),
      h('div', {}, h('label', {}, 'Antworten – eine pro Zeile, 2 bis 10'), options),
      h('div', {}, h('label', {}, 'Endet am (optional)'), closes),
      submit));
  }

  // ---------------------------------------------------------------- Einspruch

  async function renderAppeal() {
    if (!state.me.banned) {
      return h('div', {},
        pageHead('Bann', 'Einspruch'),
        h('div', { class: 'card thick' },
          h('div', { class: 'notice ok' }, h('i'), h('span', {}, h('b', {}, 'Du bist nicht gebannt. '), 'Hier gibt es für dich nichts zu tun.')),
          h('p', { class: 'muted small', style: 'margin-top:14px' }, 'So funktioniert ein Einspruch: Wer gebannt ist, sieht beim Join-Versuch im Bann-Bildschirm einen Code. ' +
            'Damit meldet man sich hier an und schreibt den Einspruch. Wird er angenommen, wird man automatisch entbannt.')));
    }
    const appeals = await rpc('my_appeals', { p_token: state.token });
    const hasPending = appeals.some((a) => a.status === 'pending');

    const message = h('textarea', { maxlength: '2000', placeholder: 'Erkläre in Ruhe, was passiert ist und warum du entbannt werden solltest (mindestens 20 Zeichen).' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Einspruch absenden');
    const form = h('form', {
      class: 'card thick stack',
      onsubmit: (event) => {
        event.preventDefault();
        act(submit, () => rpc('create_appeal', { p_token: state.token, p_message: message.value }), 'Einspruch abgeschickt.');
      }
    }, h('h3', {}, 'Einspruch schreiben'), message, submit);

    return h('div', {},
      pageHead('Bann', 'Einspruch', 'Ein Admin liest jeden Einspruch. Wird er angenommen, wirst du automatisch entbannt.'),
      h('div', { class: 'card thick' },
        h('p', { class: 'eyebrow', style: 'margin-bottom:10px' }, 'Dein Bann'),
        state.me.ban_reason ? h('div', { class: 'quote' }, state.me.ban_reason) : h('p', { class: 'muted' }, 'Kein Grund angegeben.')),
      hasPending ? null : form,
      appeals.map((a) => h('article', { class: 'card thick' },
        h('div', { class: 'row' }, h('h3', {}, `Einspruch vom ${formatDate(a.created_at)}`), h('span', { class: 'badge ' + a.status }, APPEAL_STATUS[a.status])),
        h('div', { class: 'quote', style: 'margin-top:12px' }, a.message),
        a.admin_response ? h('div', { class: 'admin-note' }, h('strong', {}, 'Antwort: '), a.admin_response) : null,
        a.status === 'accepted' ? h('div', { class: 'notice ok', style: 'margin-top:12px' }, h('i'), h('span', {}, 'Du wirst automatisch entbannt, sobald der Server online ist.')) : null)));
  }

  // ---------------------------------------------------------------- Regeln

  async function renderRules() {
    const number = (index) => String(index + 1).padStart(2, '0');
    return h('div', {},
      pageHead('Server', 'Regeln & Infos', 'Diese Regeln akzeptierst du beim Beitreten im Spiel, nach jeder Änderung neu.'),
      h('div', { class: 'grid' },
        h('div', { class: 'card thick' }, h('p', { class: 'eyebrow', style: 'margin-bottom:14px' }, 'Regeln'),
          h('ol', { class: 'rules' }, (CONFIG.rules || []).map((rule, index) => h('li', {}, h('b', { class: 'no' }, number(index)),
            typeof rule === 'string' ? h('span', {}, rule) : h('div', {}, h('strong', {}, rule.title), h('span', {}, rule.text)))))),
        h('div', { class: 'card thick' }, h('p', { class: 'eyebrow', style: 'margin-bottom:14px' }, 'Gut zu wissen'),
          h('ol', { class: 'rules' }, (CONFIG.info || []).map((line, index) => h('li', {}, h('b', { class: 'no' }, number(index)), h('span', {}, line)))))));
  }

  // ---------------------------------------------------------------- Admin

  async function renderAdmin() {
    const [server, appeals, inventories, spawners, loginSpots, schema] = await Promise.all([
      rpc('admin_server', { p_token: state.token }),
      rpc('admin_list_appeals', { p_token: state.token }),
      rpc('admin_inventories', { p_token: state.token }),
      // null until their SQL is in the database; the rest of the page works without it
      rpc('admin_spawners', { p_token: state.token }).catch(() => null),
      rpc('admin_login_spawns', { p_token: state.token }).catch(() => null),
      // the number of the newest SQL change in the database (0 before 001)
      rpc('schema_version', {}).catch(() => 0)
    ]);
    const pending = appeals.filter((a) => a.status === 'pending').length;
    const waiting = server.commands.some((c) => c.status === 'pending' || c.status === 'running');
    // answers from the server arrive within seconds; otherwise the values refresh every 20 s,
    // but not while an inventory is open (it would close again, see idle)
    state.refreshTimer = setTimeout(() => autoRefresh('admin'), waiting ? 2500 : AUTO_REFRESH.admin);
    return h('div', {},
      pageHead('Admin', 'Server-Verwaltung', 'Befehle gehen über die Website an den Server, die Antwort der Konsole steht unten. Vorschläge und Abstimmungen bearbeitest du auf ihren Seiten.'),
      h('div', { class: 'grid' }, adminServerCard(server), adminCountdownCard()),
      adminRestartCard(server, Number(schema) || 0),
      adminAccessCard(server),
      adminPlayersCard(server, inventories),
      h('div', { class: 'grid', style: 'margin-top:16px' }, adminWorldCard(), adminPunishCard()),
      adminSpawnerCard(spawners),
      adminInventoryCard(inventories, loginSpots),
      adminConsoleCard(server),
      h('div', { class: 'row section-label' }, h('p', { class: 'eyebrow' }, 'Ban-Einsprüche'),
        h('span', { class: 'badge ' + (pending ? 'pending' : '') }, `${pending} offen`)),
      appeals.length ? appeals.map(appealAdminCard) : h('div', { class: 'empty' }, 'Keine Einsprüche.'));
  }

  // the SQL changes (supabase/migrations) this website needs
  const SCHEMA_NEEDED = 3;
  const clock = (iso) => {
    const d = new Date(iso);
    const today = d.toDateString() === new Date().toDateString();
    return (today ? '' : d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ')
      + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  };

  // what waits for the next restart: plugin updates, new plugins, server.properties, missing SQL; and the last backup
  function adminRestartCard(server, schema) {
    const r = (server.details || {}).restart;
    const need = Math.max(SCHEMA_NEEDED, r ? r.schema_needed || 0 : 0);
    const rows = [];
    const row = (iconName, main, sub, tone) => h('div', { class: 'ov-row' + (tone ? ' ' + tone : '') },
      h('span', { class: 'restart-icon' }, icon(iconName)),
      h('div', { class: 'my-row-main' }, h('b', {}, main), sub ? h('span', { class: 'faint small' }, sub) : null));
    if (schema < need) {
      rows.push(row('key', `SQL fehlt: Nr. ${String(schema + 1).padStart(3, '0')}${need > schema + 1 ? ` bis ${String(need).padStart(3, '0')}` : ''}`,
        'Auf dem PC tools\\sql-offen.ps1 starten: das fehlende SQL kommt in die Zwischenablage, dann im Supabase-SQL-Editor ausführen. Das geht sofort, ohne Neustart.',
        'warn'));
    }
    if (r) {
      for (const u of r.updates || []) {
        rows.push(row('up', `${u.name}: ${u.running ? u.running + ' → ' : ''}${u.version}`, `Update liegt bereit (${u.file}), hochgeladen ${ago(u.since)}`));
      }
      for (const p of r.new_plugins || []) {
        rows.push(row('plus', `${p.name} ${p.version}`, `neues Plugin, startet mit dem Neustart (hochgeladen ${ago(p.since)})`));
      }
      if (r.properties_changed) rows.push(row('book', 'server.properties geändert', 'wird erst beim Neustart neu gelesen'));
    }
    const b = r && r.backup;
    const backup = b ? h('p', { class: 'small' + (b.ok ? ' faint' : ' warn-text') }, b.ok
      ? `Letztes Backup ${b.at ? ago(b.at) : ''}: ${number(b.size_mb)} MB, ${number(b.regions)} Regionsdateien, vollständig. ${b.count} Backups liegen bereit.`
      : `Backup-Problem: ${b.error || 'unbekannt'}${b.name ? ` (${b.name})` : ''}`) : null;
    // once a night every file of the newest backup is read and its checksum compared
    const d = r && r.backup_deep;
    const deep = d ? h('p', { class: 'small' + (d.ok ? ' faint' : ' warn-text') }, d.ok
      ? `Gründlich geprüft ${ago(d.checked_at)}: ${d.name}, alle ${number(d.files)} Dateien lesbar und unbeschädigt (${number(d.mb)} MB in ${d.seconds} s).`
      : `Gründliche Prüfung ${ago(d.checked_at)}: ${d.name} ist beschädigt (${d.error}).`) : null;
    return h('div', { class: 'card thick restart-card', style: 'margin-top:16px' },
      h('div', { class: 'row' }, h('h3', {}, 'Wartet auf den Neustart'), h('span', { class: 'spacer' }),
        r && r.next_restart ? h('span', { class: 'badge' }, `automatisch ${clock(r.next_restart)}`) : null),
      !r ? h('p', { class: 'faint small' }, 'Der Server meldet das ab WebPortal 1.26.') : null,
      rows.length ? h('div', {}, rows) : r ? h('p', { class: 'faint small' }, 'Nichts. Alles, was auf dem Server liegt, läuft schon.') : null,
      backup, deep);
  }

  // queue a console command for the server; it picks it up within a few seconds
  function sendCommand(button, command, success) {
    return act(button, () => rpc('admin_command', { p_token: state.token, p_command: command }), success || 'Befehl gesendet.');
  }

  const validName = (name) => /^[A-Za-z0-9_]{1,16}$/.test(name);
  const GAMEMODES = { survival: 'Überleben', creative: 'Kreativ', adventure: 'Abenteuer', spectator: 'Zuschauer' };
  const WORLDS = { normal: 'Oberwelt', nether: 'Nether', the_end: 'End' };

  function adminServerCard(server) {
    const d = server.details || {};
    const tps = Array.isArray(d.tps) ? d.tps[0] : null;
    const tpsClass = tps == null ? '' : tps >= 18 ? 'ok' : tps >= 15 ? 'caution' : 'alert';
    const ram = d.ram_max_mb ? Math.round((d.ram_used_mb / d.ram_max_mb) * 100) : null;
    return h('div', { class: 'card thick' },
      h('div', { class: 'status-line' }, h('i', { class: 'dot ' + (server.online ? 'on' : 'off') }), server.online ? 'Online' : 'Offline'),
      h('div', { class: 'admin-stats' },
        h('div', {}, h('p', { class: 'eyebrow' }, 'TPS'), h('b', { class: 'stat ' + tpsClass }, tps == null ? '–' : tps.toFixed(1)),
          h('span', { class: 'faint small' }, d.mspt != null ? `${d.mspt} ms pro Tick` : 'noch keine Werte')),
        h('div', {}, h('p', { class: 'eyebrow' }, 'Arbeitsspeicher'), h('b', { class: 'stat' }, ram == null ? '–' : `${ram} %`),
          h('span', { class: 'faint small' }, d.ram_max_mb ? `${(d.ram_used_mb / 1024).toFixed(1)} von ${(d.ram_max_mb / 1024).toFixed(1)} GB` : ''))),
      ram == null ? null : h('div', { class: 'meter' }, h('i', { class: ram > 85 ? 'alert' : ram > 70 ? 'caution' : '', style: `width:${ram}%` })),
      d.uptime_min == null ? null : h('p', { class: 'faint small', style: 'margin-top:12px' },
        `Läuft seit ${uptime(d.uptime_min)} · ${d.chunks} Chunks · ${d.entities} Entities`),
      h('p', { class: 'faint small', style: 'margin-top:4px' },
        [server.version ? `Minecraft ${server.version}` : null, server.updated_at ? `Stand ${formatDate(server.updated_at)}` : null].filter(Boolean).join(' · ')));
  }

  // lock the website for everyone but the admins, or open it again; logged-in players get a "locked" page meanwhile
  function adminAccessCard(server) {
    const locked = Boolean(server.web_locked);
    const toggle = (event) => act(event.currentTarget, () => rpc('admin_set_web_lock', { p_token: state.token, p_locked: !locked }),
      locked ? 'Die Website ist wieder für alle offen.' : 'Die Website ist jetzt für alle außer Admins gesperrt.');
    return h('div', { class: 'card thick', style: 'margin-top:16px' },
      h('div', { class: 'row' },
        h('div', { class: 'stack', style: 'gap:4px' },
          h('p', { class: 'eyebrow' }, 'Website-Zugang'),
          h('div', { class: 'status-line' }, h('i', { class: 'dot ' + (locked ? 'off' : 'on') }),
            locked ? 'Gesperrt: nur Admins kommen hinein' : 'Offen für alle Spieler')),
        h('span', { class: 'spacer' }),
        locked
          ? h('button', { class: 'btn primary', onclick: toggle }, 'Für alle entsperren')
          : h('button', { class: 'btn danger', onclick: toggle }, 'Für alle sperren')));
  }

  function uptime(minutes) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes / 60) % 24;
    return (days ? `${days} d ` : '') + (days || hours ? `${hours} h ` : '') + `${minutes % 60} min`;
  }

  // 90s, 5m, 1h30m or plain minutes, as ServerCountdown reads them
  const COUNTDOWN_DURATION = /^(\d+(h|m|s))+$|^\d+$/i;

  function durationSeconds(text) {
    if (/^\d+$/.test(text)) return Number(text) * 60;
    let total = 0;
    for (const [, amount, unit] of text.toLowerCase().matchAll(/(\d+)(h|m|s)/g)) total += Number(amount) * { h: 3600, m: 60, s: 1 }[unit];
    return total;
  }

  const nextFullHour = (plus) => `${String((new Date().getHours() + 1 + (plus || 0)) % 24).padStart(2, '0')}:00`;

  // a time as a duration ("in 5m") or a clock time ("um 18:30"); the downtime can also stay open
  function timeField(label, options) {
    let mode = options.modes[0];
    const duration = h('input', { value: options.duration, placeholder: options.placeholder, 'aria-label': `${label}: Dauer` });
    const clock = h('input', { type: 'time', value: options.clock, 'aria-label': `${label}: Uhrzeit` });
    const box = h('div', { class: 'time-input' });
    // switching counts as editing, so the page does not refresh it away
    const buttons = options.modes.map((key) => h('button', { type: 'button', 'data-mode': key, onclick: () => { mode = key; state.dirty = true; sync(); } }, options.labels[key]));
    const sync = () => {
      for (const button of buttons) button.className = button.dataset.mode === mode ? 'on' : '';
      box.replaceChildren(mode === 'dauer' ? duration : mode === 'uhrzeit' ? clock : h('p', { class: 'faint small' }, options.openText));
    };
    sync();
    return {
      el: h('div', {}, h('label', {}, label), h('div', { class: 'filters time-modes', role: 'group', 'aria-label': label }, buttons), box),
      mode: () => mode,
      // the part of the command: "5m", "18:30", "" when left open, null when it is not valid
      read: () => {
        if (mode === 'offen') return '';
        if (mode === 'uhrzeit') return /^\d{2}:\d{2}$/.test(clock.value) ? clock.value : null;
        const value = duration.value.replace(/\s+/g, '');
        return COUNTDOWN_DURATION.test(value) && durationSeconds(value) > 0 && durationSeconds(value) <= 86400 ? value : null;
      }
    };
  }

  function adminCountdownCard() {
    const kind = h('select', { 'aria-label': 'Art' }, h('option', { value: 'restartin' }, 'Neustart'), h('option', { value: 'shutdown' }, 'Stopp'));
    const when = timeField('Wann', {
      modes: ['dauer', 'uhrzeit'], labels: { dauer: 'In …', uhrzeit: 'Um …' }, duration: '5m', placeholder: 'z. B. 5m, 2h', clock: nextFullHour()
    });
    const down = timeField('Wie lange offline', {
      modes: ['dauer', 'uhrzeit', 'offen'], labels: { dauer: 'Ca. …', uhrzeit: 'Bis …', offen: 'Offen' },
      duration: '1m', placeholder: 'z. B. 10m, 2h', clock: nextFullHour(1), openText: 'Wird in den Ansagen nicht genannt.'
    });
    const reason = h('input', { maxlength: '120', placeholder: 'Grund, z. B. Plugin-Update', 'aria-label': 'Grund' });
    const silent = h('input', { type: 'checkbox' });
    const start = h('button', { class: 'btn primary', type: 'submit' }, 'Countdown starten');
    const message = h('input', { maxlength: '200', placeholder: 'Nachricht an alle Spieler', 'aria-label': 'Nachricht an alle' });
    const send = h('button', { class: 'btn', type: 'submit' }, 'Senden');
    return h('div', { class: 'card thick' },
      h('p', { class: 'eyebrow' }, 'Neustart und Stopp'),
      h('form', {
        class: 'admin-countdown',
        onsubmit: (event) => {
          event.preventDefault();
          const at = when.read();
          const back = down.read();
          if (at == null) {
            toast('Wann: eine Dauer wie 5m oder 2h (höchstens 24h) oder eine Uhrzeit.', 'error');
            return;
          }
          if (back == null) {
            toast('Wie lange offline: eine Dauer wie 10m oder 2h, eine Uhrzeit oder „Offen“.', 'error');
            return;
          }
          // "still" goes right after the time: ServerCountdown then announces nothing before the last minute
          const command = [kind.value, at, silent.checked ? 'still' : null, back, reason.value.trim()].filter(Boolean).join(' ');
          const what = kind.value === 'shutdown' ? 'Server stoppen' : 'Server neu starten';
          if (confirm(`${what} ${when.mode() === 'uhrzeit' ? `um ${at} Uhr` : `in ${at}`}${silent.checked ? ', still (Countdown erst in der letzten Minute)' : ''}?`)) {
            sendCommand(start, command, 'Gesendet. Die Antwort steht unten in der Konsole.');
          }
        }
      },
      h('div', {}, h('label', {}, 'Art'), kind),
      when.el,
      down.el,
      h('div', {}, h('label', {}, 'Grund'), reason),
      h('label', { class: 'login-spot-check span-2' }, silent, 'Still: vorher keine Ansage, der Countdown erscheint erst in der letzten Minute'),
      h('p', { class: 'faint small span-2' }, 'Bis eine Stunde voraus startet der Countdown sofort. Später wird es geplant (bis 24 Stunden), ' +
        'der Countdown beginnt dann eine Stunde vorher und übersteht auch einen Neustart. Still geplant erfährt niemand davon bis zur letzten Minute.'),
      h('div', { class: 'row span-2', style: 'flex-wrap:wrap;gap:8px' }, start,
        h('button', { class: 'btn danger', type: 'button', onclick: (event) => sendCommand(event.currentTarget, 'countdown cancel', 'Abbrechen gesendet.') },
          'Countdown abbrechen'),
        h('button', { class: 'btn small ghost', type: 'button', onclick: (event) => sendCommand(event.currentTarget, 'countdown status') }, 'Was ist geplant?'))),
      h('form', {
        class: 'admin-inline', style: 'margin-top:16px',
        onsubmit: (event) => {
          event.preventDefault();
          if (message.value.trim()) sendCommand(send, 'msg ' + message.value.trim(), 'Nachricht gesendet.');
        }
      }, message, send));
  }

  const ask = (question) => {
    const answer = prompt(question);
    return answer == null ? null : answer.trim();
  };
  // AdvancedBan: 30m, 6h, 7d, 1mo
  const PUNISH_TIME = /^\d+(s|m|h|d|mo)$/i;

  // the punishments of the game menu, run through AdvancedBan; reason (and duration) are asked first
  function punish(button, what, name, label, timed) {
    if (!validName(name)) return;
    let time = '';
    if (timed) {
      time = ask(`${label} für ${name}: wie lange? z. B. 30m, 6h, 7d${what === 'tempmute' ? ' (leer = dauerhaft)' : ''}`);
      if (time == null) return;
      if (what === 'tempmute' && !time) what = 'mute';
      else if (!PUNISH_TIME.test(time)) {
        toast('Die Dauer bitte wie 30m, 6h, 7d oder 1mo angeben.', 'error');
        return;
      }
    }
    const why = ask(`${label} für ${name}: Grund?`);
    if (!why) return;
    if ((what === 'ban' || what === 'tempban') && !confirm(`${name} wirklich ${what === 'ban' ? 'dauerhaft' : 'für ' + time} bannen?`)) return;
    sendCommand(button, [what, name, time, why].filter(Boolean).join(' '), `${label}: ${name}`);
  }

  // everything from the player menu in the game; the less common things are in the "Mehr" list
  const PLAYER_ACTIONS = [
    ['Spielmodus', [['gm:survival', 'Überleben'], ['gm:creative', 'Kreativ'], ['gm:adventure', 'Abenteuer'], ['gm:spectator', 'Zuschauer']]],
    ['Hilfe', [['fly:an', 'Fliegen an'], ['fly:aus', 'Fliegen aus'], ['zumspawn', 'Zum Spawn schicken']]],
    ['Strafen', [['history', 'Strafen-Verlauf'], ['warn', 'Verwarnen …'], ['tempmute', 'Stummschalten …'], ['unmute', 'Stummschaltung aufheben'],
      ['kick', 'Kicken …'], ['tempban', 'Zeitweise bannen …'], ['ban', 'Dauerhaft bannen …']]]
  ];

  function playerAction(select, name) {
    const [action, arg] = select.value.split(':');
    select.value = '';
    if (!action || !validName(name)) return;
    if (action === 'gm') sendCommand(select, `gamemode ${arg} ${name}`, `${name}: ${GAMEMODES[arg]}`);
    else if (action === 'fly') sendCommand(select, `fly ${name} ${arg}`, `${name}: Fliegen ${arg}`);
    else if (action === 'zumspawn' || action === 'history' || action === 'unmute') sendCommand(select, `${action} ${name}`);
    else if (action === 'warn') punish(select, 'warn', name, 'Verwarnung');
    else if (action === 'tempmute') punish(select, 'tempmute', name, 'Stummschaltung', true);
    else if (action === 'kick') punish(select, 'kick', name, 'Kick');
    else if (action === 'tempban') punish(select, 'tempban', name, 'Zeitbann', true);
    else if (action === 'ban') punish(select, 'ban', name, 'Bann');
  }

  function adminPlayersCard(server, inventories) {
    const details = (server.details && server.details.players) || [];
    const players = server.online ? (details.length ? details : server.players) : [];
    const known = new Set(inventories.map((p) => p.uuid));
    return h('div', { class: 'card thick', style: 'margin-top:16px' },
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, `Spieler online · ${players.length}`)),
      players.length ? h('div', { class: 'admin-players' }, players.map((p) => {
        const more = h('select', { class: 'admin-more', 'aria-label': `Weitere Aktionen für ${p.name}`, onchange: () => playerAction(more, p.name) },
          h('option', { value: '' }, 'Mehr …'),
          PLAYER_ACTIONS.map(([group, options]) => h('optgroup', { label: group }, options.map(([value, label]) => h('option', { value }, label)))));
        return h('div', { class: 'admin-player' },
          h('span', { class: 'who' }, head(p.uuid, 24), h('b', {}, p.name)),
          h('span', { class: 'faint small' }, [p.ping != null ? `${p.ping} ms` : null, GAMEMODES[p.gamemode], WORLDS[p.world], p.health != null ? `${p.health} ♥` : null].filter(Boolean).join(' · ')),
          h('span', { class: 'spacer' }),
          known.has(p.uuid) ? h('button', { class: 'btn small', onclick: () => showAdminInventory(p.uuid) }, 'Inventar') : null,
          h('button', { class: 'btn small', onclick: (event) => sendCommand(event.currentTarget, `heal ${p.name}`, `${p.name} wird geheilt.`) }, 'Heilen'),
          h('button', { class: 'btn small', onclick: (event) => sendCommand(event.currentTarget, `feed ${p.name}`, `${p.name} wird gefüttert.`) }, 'Füttern'),
          h('button', {
            class: 'btn small', onclick: (event) => {
              const text = ask(`Nachricht an ${p.name}:`);
              if (text && validName(p.name)) sendCommand(event.currentTarget, `pmsg ${p.name} ${text}`, 'Nachricht gesendet.');
            }
          }, 'Nachricht'),
          more);
      }))
        : h('p', { class: 'muted small', style: 'margin-top:10px' }, server.online ? 'Gerade ist niemand online.' : 'Der Server ist offline.'));
  }

  function adminWorldCard() {
    const row = (items) => h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:wrap;gap:6px' },
      items.map(([label, command, done]) => h('button', { class: 'btn small', onclick: (event) => sendCommand(event.currentTarget, command, done) }, label)));
    return h('div', { class: 'card thick' },
      h('p', { class: 'eyebrow' }, 'Welt'),
      h('p', { class: 'faint small', style: 'margin-top:10px' }, 'Uhrzeit in der Oberwelt'),
      row([['Morgen', 'zeit morgen', 'Es wird Morgen.'], ['Mittag', 'zeit mittag', 'Es wird Mittag.'], ['Nacht', 'zeit nacht', 'Es wird Nacht.'], ['Mitternacht', 'zeit mitternacht', 'Es wird Mitternacht.']]),
      h('p', { class: 'faint small', style: 'margin-top:12px' }, 'Wetter'),
      row([['Klar', 'wetter klar', 'Wetter: klar.'], ['Regen', 'wetter regen', 'Wetter: Regen.'], ['Gewitter', 'wetter gewitter', 'Wetter: Gewitter.']]),
      h('p', { class: 'faint small', style: 'margin-top:12px' }, 'Server'),
      h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:wrap;gap:6px' },
        h('button', {
          class: 'btn small', onclick: (event) => { if (confirm('Alle herumliegenden Items entfernen?')) sendCommand(event.currentTarget, 'bodenitems', 'Boden-Items werden entfernt.'); }
        }, 'Boden-Items entfernen'),
        h('button', { class: 'btn small', onclick: (event) => sendCommand(event.currentTarget, 'countdown status') }, 'Countdown-Status')));
  }

  // also for players who are offline
  function adminPunishCard() {
    const name = h('input', { placeholder: 'Spielername', 'aria-label': 'Spielername', maxlength: '16' });
    const check = () => {
      const value = name.value.trim();
      if (validName(value)) return value;
      toast('Bitte einen gültigen Spielernamen eingeben.', 'error');
      return null;
    };
    const action = (label, run, cls) => h('button', { class: 'btn small' + (cls ? ' ' + cls : ''), type: 'button', onclick: (event) => { const n = check(); if (n) run(event.currentTarget, n); } }, label);
    return h('div', { class: 'card thick' },
      h('p', { class: 'eyebrow' }, 'Strafen'),
      h('p', { class: 'faint small', style: 'margin-top:10px' }, 'Geht auch, wenn der Spieler offline ist.'),
      h('div', { class: 'admin-inline', style: 'margin-top:8px' }, name),
      h('div', { class: 'row', style: 'margin-top:8px;flex-wrap:wrap;gap:6px' },
        action('Entbannen', (b, n) => sendCommand(b, `unban ${n}`, `${n} wird entbannt.`)),
        action('Stummschaltung aufheben', (b, n) => sendCommand(b, `unmute ${n}`)),
        action('Verlauf', (b, n) => sendCommand(b, `history ${n}`)),
        action('Bannen …', (b, n) => punish(b, 'ban', n, 'Bann'), 'danger')),
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn small ghost', onclick: (event) => sendCommand(event.currentTarget, 'banlist') }, 'Bann-Liste anzeigen')));
  }

  // the mobs a spawner may make, same list as portal.spawner_mobs() in the database
  const SPAWNER_MOBS = {
    creeper: 'Creeper', zombie: 'Zombie', skeleton: 'Skelett', spider: 'Spinne', cave_spider: 'Höhlenspinne', enderman: 'Enderman',
    witch: 'Hexe', slime: 'Schleim', magma_cube: 'Magmawürfel', blaze: 'Lohe', husk: 'Wüstenzombie', stray: 'Eiswanderer',
    drowned: 'Ertrunkener', zombified_piglin: 'Zombifizierter Piglin', iron_golem: 'Eisengolem', cow: 'Kuh', sheep: 'Schaf',
    pig: 'Schwein', chicken: 'Huhn', rabbit: 'Kaninchen'
  };
  const SPAWNER_WORLDS = { overworld: 'Oberwelt', the_nether: 'Nether', the_end: 'End' };

  // mobs at fixed points while a player is around; the server picks up changes within 15 seconds
  function adminSpawnerCard(spawners) {
    const card = h('div', { class: 'card thick', style: 'margin-top:16px' });
    const list = h('div', { class: 'spawners' });
    card.append(
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, 'Mob-Spawner'), h('span', { class: 'spacer' }),
        spawners ? h('button', { class: 'btn small', onclick: () => { list.querySelector('.faint')?.remove(); list.prepend(spawnerEditor(null)); } }, 'Neuer Spawner') : null),
      h('p', { class: 'faint small', style: 'margin-top:10px' },
        'An festen Punkten erscheint alle paar Sekunden ein Mob, solange ein Spieler im Umkreis ist – ohne Meldung im Chat. Änderungen kommen innerhalb von 15 Sekunden auf dem Server an.'));
    if (!spawners) {
      card.append(h('div', { class: 'notice caution', style: 'margin-top:12px' }, h('i'), h('span', {}, 'Noch nicht eingerichtet: Das SQL für die Mob-Spawner fehlt in Supabase.')));
      return card;
    }
    list.append(...(spawners.length ? spawners.map((s) => spawnerEditor(s)) : [h('p', { class: 'faint small', style: 'margin-top:10px' }, 'Noch keine Spawner.')]));
    card.append(list);
    return card;
  }

  // one spawner: the line shows what it does, opening it shows the form; null makes a new one (already open)
  function spawnerEditor(spawner) {
    const s = spawner || { name: '', enabled: true, dimension: 'overworld', points: [], mob: 'creeper', interval_seconds: 15, radius: 48, max_mobs: 25 };
    const field = (label, control, wide) => h('div', { class: wide ? 'span-2' : null }, h('label', {}, label), control);
    const number = (value, min, max) => h('input', { type: 'number', value: String(value), min: String(min), max: String(max), inputmode: 'numeric' });
    const name = h('input', { value: s.name, maxlength: '40', placeholder: 'z. B. Creeperfarm' });
    const mob = h('select', {}, Object.entries(SPAWNER_MOBS).map(([id, label]) => h('option', { value: id, selected: id === s.mob }, label)));
    const world = h('select', {}, Object.entries(SPAWNER_WORLDS).map(([id, label]) => h('option', { value: id, selected: id === s.dimension }, label)));
    const points = h('textarea', { class: 'mono', rows: '4', placeholder: '-596 213 -533\n-583 219 -523' }, s.points.map((p) => p.join(' ')).join('\n'));
    const interval = number(s.interval_seconds, 1, 3600);
    const radius = number(s.radius, 8, 128);
    const max = number(s.max_mobs, 1, 100);
    const save = (event) => {
      // "x y z" per line; the comma form from the F3 screen ("-596, 213, -533") works too
      const parsed = points.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[\s,;]+/).map(Number));
      if (!parsed.length || parsed.some((p) => p.length !== 3 || p.some((n) => !Number.isInteger(n)))) {
        toast('Punkte bitte als x y z in ganzen Zahlen, eine Zeile pro Punkt.', 'error');
        return;
      }
      act(event.currentTarget, () => rpc('admin_save_spawner', {
        p_token: state.token, p_id: spawner ? spawner.id : null, p_name: name.value, p_enabled: s.enabled, p_dimension: world.value,
        p_points: parsed, p_mob: mob.value, p_interval: Number(interval.value), p_radius: Number(radius.value), p_max: Number(max.value)
      }), 'Gespeichert. Der Server übernimmt es in spätestens 15 Sekunden.');
    };
    const toggle = (event) => {
      // the button sits in the summary: it must not open or close the form
      event.preventDefault();
      act(event.currentTarget, () => rpc('admin_set_spawner_enabled', { p_token: state.token, p_id: spawner.id, p_enabled: !s.enabled }),
        s.enabled ? `${s.name} ist aus.` : `${s.name} ist an.`);
    };
    const remove = (event) => {
      if (confirm(`Spawner „${s.name}“ löschen?`)) act(event.currentTarget, () => rpc('admin_delete_spawner', { p_token: state.token, p_id: spawner.id }), 'Spawner gelöscht.');
    };
    // with a chunk loader the farm also runs while nobody is near
    const unattended = (event) => act(event.currentTarget,
      () => rpc('admin_set_spawner_unattended', { p_token: state.token, p_id: spawner.id, p_on: !s.without_players }),
      s.without_players ? `${s.name} spawnt wieder nur, wenn jemand in der Nähe ist.` : `${s.name} spawnt jetzt auch ohne Spieler, solange der Chunk geladen ist.`);
    const summary = spawner
      ? h('summary', {},
        h('div', { class: 'status-line' }, h('i', { class: 'dot ' + (s.enabled ? 'on' : 'off') }), h('b', {}, s.name)),
        h('span', { class: 'faint small' }, [SPAWNER_MOBS[s.mob] || s.mob, `${s.points.length} ${s.points.length === 1 ? 'Punkt' : 'Punkte'}`,
          `alle ${s.interval_seconds} s`, `Umkreis ${s.radius}`, `höchstens ${s.max_mobs}`, SPAWNER_WORLDS[s.dimension],
          s.without_players ? 'auch ohne Spieler' : null].filter(Boolean).join(' · ')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small' + (s.enabled ? ' danger' : ' primary'), type: 'button', onclick: toggle }, s.enabled ? 'Ausschalten' : 'Einschalten'))
      : h('summary', {}, h('b', {}, 'Neuer Spawner'));
    return h('details', { class: 'spawner', open: !spawner },
      summary,
      h('div', { class: 'form-grid' },
        field('Name', name), field('Mob', mob),
        field('Punkte (x y z, eine Zeile pro Punkt)', points, true),
        field('Alle … Sekunden (an jedem Punkt ein Mob)', interval), field('Welt', world),
        field('Umkreis: nur wenn ein Spieler so nah ist (Blöcke)', radius), field('Höchstens so viele Mobs im Umkreis', max),
        spawner ? h('div', { class: 'span-2 row' },
          h('button', { class: 'btn small' + (s.without_players ? ' primary' : ''), type: 'button', onclick: unattended, 'aria-pressed': s.without_players ? 'true' : 'false' },
            s.without_players ? 'Auch ohne Spieler: an' : 'Auch ohne Spieler: aus'),
          h('span', { class: 'faint small' }, 'An: spawnt, sobald der Chunk geladen ist (Chunk-Loader), auch wenn niemand in der Nähe ist. Die Mobs bleiben dann, bis die Farm sie erledigt.')) : null,
        h('div', { class: 'row span-2' },
          h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Speichern'),
          spawner ? h('button', { class: 'btn danger', type: 'button', onclick: remove }, 'Löschen') : null)));
  }

  // which player's inventory is open; kept while the page refreshes
  function showAdminInventory(uuid) {
    state.adminInventory = uuid;
    const select = document.querySelector('#admin-inventory select');
    if (select) {
      select.value = uuid;
      select.dispatchEvent(new Event('change'));
      document.getElementById('admin-inventory').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // the world names of the inventory snapshot (Bukkit) as the database writes them
  const DIMENSION_OF = { normal: 'overworld', nether: 'the_nether', the_end: 'the_end' };

  // where the player turns up the next time they join, or right away when online; starts at their last known spot
  function loginSpotForm(snap, pending) {
    const s = (snap.data && snap.data.stats) || {};
    const start = pending || { dimension: DIMENSION_OF[s.world] || 'overworld', x: s.x, y: s.y, z: s.z, surface: false };
    const world = h('select', { 'aria-label': 'Welt' },
      Object.entries(SPAWNER_WORLDS).map(([id, label]) => h('option', { value: id, selected: id === start.dimension }, label)));
    const coord = (value, label) => h('input', { type: 'number', class: 'mono', value: value == null ? '' : String(value), 'aria-label': label, placeholder: label });
    const x = coord(start.x, 'x');
    const y = coord(start.y, 'y');
    const z = coord(start.z, 'z');
    const surface = h('input', { type: 'checkbox', checked: Boolean(start.surface) });
    const set = (event) => {
      const values = [x, y, z].map((input) => Number(input.value));
      if ([x, y, z].some((input) => input.value.trim() === '') || values.some((v) => !Number.isInteger(v))) {
        toast('Bitte x, y und z als ganze Zahlen angeben.', 'error');
        return;
      }
      act(event.currentTarget, () => rpc('admin_set_login_spawn', {
        p_token: state.token, p_uuid: snap.uuid, p_name: snap.name, p_dimension: world.value,
        p_x: values[0], p_y: values[1], p_z: values[2], p_surface: surface.checked
      }), `Gesetzt. Ist ${snap.name} online, wird er in wenigen Sekunden versetzt, sonst beim nächsten Betreten.`);
    };
    const clear = (event) => act(event.currentTarget, () => rpc('admin_clear_login_spawn', { p_token: state.token, p_uuid: snap.uuid }), 'Login-Ort zurückgenommen.');
    return h('div', { class: 'card thick login-spot' },
      h('p', { class: 'eyebrow' }, 'Login-Ort'),
      pending
        ? h('div', { class: 'notice caution', style: 'margin-top:10px' }, h('i'), h('span', {}, h('b', {}, 'Wartet: '),
          `${SPAWNER_WORLDS[pending.dimension]} ${pending.x} ${pending.surface ? '(Oberfläche)' : pending.y} ${pending.z}, gesetzt von ${pending.created_by}. Kommt, sobald ${snap.name} online ist.`))
        : h('p', { class: 'faint small', style: 'margin-top:8px' },
          `Hier erscheint ${snap.name} beim nächsten Betreten, und wer online ist, wird gleich versetzt. Vorausgefüllt mit dem letzten Standort.`),
      h('div', { class: 'login-spot-fields' }, world, x, y, z),
      h('label', { class: 'login-spot-check' }, surface, 'Auf die Oberfläche: auf den höchsten Block an dieser Stelle'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary small', type: 'button', onclick: set }, 'Login-Ort setzen'),
        pending ? h('button', { class: 'btn small ghost', type: 'button', onclick: clear }, 'Zurücknehmen') : null));
  }

  function adminInventoryCard(list, loginSpots) {
    const body = h('div');
    const select = h('select', { class: 'admin-pick', 'aria-label': 'Spieler' }, h('option', { value: '' }, 'Spieler wählen …'),
      list.map((p) => h('option', { value: p.uuid, selected: state.adminInventory === p.uuid }, `${p.name} · ${ago(p.updated_at)}`)));
    const load = async (uuid) => {
      state.adminInventory = uuid || null;
      if (!uuid) {
        body.replaceChildren();
        return;
      }
      body.replaceChildren(h('p', { class: 'faint small', style: 'margin-top:14px' }, 'Lädt …'));
      try {
        const snap = await rpc('admin_inventory', { p_token: state.token, p_uuid: uuid });
        if (state.adminInventory !== uuid) return;
        body.replaceChildren(snap ? h('div', { style: 'margin-top:14px' }, h('div', { class: 'row' }, head(snap.uuid, 24), h('b', {}, snap.name)),
          loginSpots ? loginSpotForm(snap, loginSpots.find((l) => l.mc_uuid === snap.uuid)) : null, inventoryView(snap))
          : h('p', { class: 'muted small', style: 'margin-top:14px' }, 'Für diesen Spieler ist noch kein Inventar gespeichert.'));
      } catch (error) {
        handleError(error);
      }
    };
    select.addEventListener('change', () => load(select.value));
    if (state.adminInventory) load(state.adminInventory);
    return h('div', { class: 'card thick', id: 'admin-inventory', style: 'margin-top:16px' },
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, h('p', { class: 'eyebrow' }, 'Inventare'), h('span', { class: 'spacer' }), select,
        h('button', { class: 'btn small ghost', onclick: () => { select.value = ''; load(null); } }, 'Schließen')),
      h('p', { class: 'faint small', style: 'margin-top:6px' },
        `Inventar, Endertruhe, Shulkerkisten und Rucksäcke von ${list.length} Spielern. Wer online ist, wird jede Minute aktualisiert, sonst gilt der Stand beim Verlassen. Solange eins offen ist, lädt die Seite nicht von selbst neu.`),
      body);
  }

  const COMMAND_STATUS = { pending: ['Wartet', 'caution'], running: ['Läuft', 'caution'], done: ['Fertig', 'ok'], failed: ['Fehler', 'alert'] };

  function adminConsoleCard(server) {
    const input = h('input', { class: 'mono', placeholder: 'Befehl ohne /, z. B. list oder weather clear', 'aria-label': 'Konsolenbefehl', maxlength: '256' });
    const run = h('button', { class: 'btn primary', type: 'submit' }, 'Ausführen');
    return h('div', { class: 'card thick', style: 'margin-top:16px' },
      h('p', { class: 'eyebrow', style: 'margin-bottom:10px' }, 'Konsole'),
      h('form', {
        class: 'admin-inline',
        onsubmit: (event) => {
          event.preventDefault();
          if (input.value.trim()) sendCommand(run, input.value.trim());
        }
      }, input, run),
      h('p', { class: 'faint small', style: 'margin-top:8px' }, 'Rechte vergeben (op, lp) und hartes Stoppen gehen aus Sicherheitsgründen nur in der echten Konsole.'),
      server.commands.length ? h('div', { class: 'admin-log' }, server.commands.map((c) => {
        const [label, tone] = COMMAND_STATUS[c.status] || [c.status, ''];
        return h('div', { class: 'admin-log-entry' },
          h('div', { class: 'row' }, h('code', {}, c.command), h('span', { class: 'badge ' + tone }, label),
            h('span', { class: 'spacer' }), h('span', { class: 'faint small' }, `${c.admin} · ${ago(c.created_at)}`)),
          c.result ? h('pre', {}, c.result) : null);
      })) : h('p', { class: 'muted small', style: 'margin-top:12px' }, 'Noch keine Befehle.'));
  }

  function appealAdminCard(a) {
    const response = h('textarea', { maxlength: '1000', placeholder: 'Antwort an den Spieler (optional)', style: 'min-height:70px' });
    const decide = (accept) => (event) => {
      const text = accept ? `${a.name} entbannen?` : `Einspruch von ${a.name} ablehnen?`;
      if (confirm(text)) {
        act(event.currentTarget, () => rpc('admin_decide_appeal', { p_token: state.token, p_id: a.id, p_accept: accept, p_response: response.value }),
          accept ? 'Angenommen – wird beim nächsten Server-Abgleich entbannt.' : 'Abgelehnt.');
      }
    };
    return h('article', { class: 'card thick' },
      h('div', { class: 'row' }, h('span', { class: 'player' }, head(a.uuid, 20), a.name), h('span', { class: 'badge ' + a.status }, APPEAL_STATUS[a.status]),
        h('span', { class: 'spacer' }), h('span', { class: 'faint small' }, formatDate(a.created_at))),
      a.ban_reason ? h('div', { style: 'margin-top:14px' }, h('p', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Bann-Bildschirm'), h('div', { class: 'quote' }, a.ban_reason)) : null,
      h('div', { style: 'margin-top:14px' }, h('p', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Einspruch'), h('div', { class: 'quote' }, a.message)),
      a.status === 'pending'
        ? h('div', { class: 'stack', style: 'margin-top:14px' }, response,
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onclick: decide(true) }, 'Annehmen & entbannen'),
            h('button', { class: 'btn danger', onclick: decide(false) }, 'Ablehnen')))
        : h('p', { class: 'faint small', style: 'margin-top:14px' },
          `Entschieden von ${a.decided_by || '?'} am ${formatDate(a.decided_at)}` + (a.status === 'accepted' ? (a.unban_done ? ' · entbannt' : ' · Entbannung wartet auf den Server') : ''),
          a.admin_response ? h('span', {}, h('br'), 'Antwort: ' + a.admin_response) : null));
  }

  // ---------------------------------------------------------------- Übungs-Börse

  const BOT_NEWS = {
    accept: (bot) => `${bot} hat angenommen.`,
    counter: (bot) => `${bot} macht ein Gegenangebot.`,
    offer: (bot) => `${bot} hat dir ein Angebot geschickt.`,
    buy: (bot) => `${bot} hat gekauft.`
  };

  function startPractice() {
    stopPractice();
    if (!window.PracticeMarket || !state.me) return;
    state.practice = window.PracticeMarket({ uuid: state.me.uuid, name: state.me.name });
    state.market = { ...state.market, view: 'sell', q: '', cat: '', formOpen: false, shopEdit: null, shopView: null };
    state.practice.on((event) => {
      if (event.type === 'bot' && BOT_NEWS[event.action]) toast(BOT_NEWS[event.action](event.bot), 'ok');
      if (!tourEvent(event)) refreshWhenIdle();
    });
  }

  function stopPractice() {
    if (!state.practice) return;
    state.practice.stop();
    state.practice = null;
    state.market = { ...state.market, view: 'sell', formOpen: false, shopEdit: null, shopView: null };
    state.pillAt = 0;
    setMarketPending(0);
    if (state.token) updatePill();
  }

  // the practice players answer while you might be typing: re-render only when no field has focus
  let idleTimer = null;
  function refreshWhenIdle() {
    clearTimeout(idleTimer);
    if (currentPage() !== 'boerse') return;
    const focused = document.activeElement;
    if ((focused && focused.matches('#app input, #app textarea, #app select')) || state.market.formOpen) {
      idleTimer = setTimeout(refreshWhenIdle, 800);
      return;
    }
    refresh();
  }

  // ---------------------------------------------------------------- Rundgang

  const TOUR_KEY = 'fa3-tour-done';
  // steps: the running tour (TOUR_STEPS or SHOP_TOUR_STEPS); forced: no closing, no skipping, back to its page
  const tour = { index: -1, card: null, offered: false, ctx: {}, steps: [], forced: false, key: TOUR_KEY, label: 'Rundgang' };
  const practiceDeal = (listingId) => (state.practice && listingId ? state.practice.dealFor(listingId) : null);
  // a practice player has answered once the deal no longer waits on him
  const answered = (listingId) => {
    const d = practiceDeal(listingId);
    return !!d && !(d.status === 'open' && state.practice.lastByMe(d));
  };
  const inBoerse = (step) => ({ page: 'boerse', practice: true, ...step });
  const decided = (listingId) => (e) => e.listingId === listingId() && (e.type === 'market_accept' || (e.type === 'bot' && e.action === 'accept'));

  // done(event) moves task and wait steps on; skipIf() jumps over steps that already happened
  const TOUR_STEPS = [
    { page: 'start', target: '.status-card', title: 'Server-Status',
      text: 'Hier siehst du, ob der Server läuft und wer gerade online ist. Die kleine Anzeige oben links zeigt das auf jeder Seite.' },
    { page: 'start', target: '.address-card', title: 'Server-Adresse',
      text: 'Mit dieser Adresse verbindest du dich im Spiel. Bitte nicht öffentlich teilen.' },
    { page: 'start', target: '.map-card', title: 'Weltkarte',
      text: 'Eine 3D-Karte der Welt, direkt vom Server. Spielerstandorte sind ausgeblendet.' },
    { page: 'start', target: '#nav a[href="#/boerse"]', title: 'Die Börse',
      text: 'Hier kaufst, verkaufst und bestellst du Items. Bezahlt wird in Diamanten, übergeben im Spiel. Gleich übst du das mit zwei Übungs-Spielern.' },
    inBoerse({ market: 'sell', target: '.practice-banner', title: 'Übungsmodus',
      text: 'Steve und Alex sind nicht echt. Sie antworten von selbst, und nichts von dem, was du jetzt machst, sehen andere Spieler.' }),
    inBoerse({ market: 'sell', target: '.market-tabs', title: 'Vier Bereiche',
      text: '„Zu verkaufen“ zeigt, was andere anbieten. „Shops“ sind Läden mit festen Preisen. „Gesucht“ sind Aufträge: Dinge, die jemand sucht. Unter „Meine Deals“ steht alles, woran du gerade handelst.' }),
    inBoerse({ market: 'sell', target: '[data-listing="9001"]', title: 'Kaufen zum Festpreis',
      text: 'Türkis ist der Preis in Diamanten. „Festpreis“ heißt: Wer zuerst kauft, hat den Deal sofort.',
      task: 'Kauf Steves Elytra: Klick auf „Kaufen“ und bestätige.',
      done: (e) => e.type === 'market_buy' && e.listingId === 9001 }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9001"]', title: 'Der Deal steht',
      text: 'Grün heißt: Deal. Getauscht wird im Spiel in der Handelstruhe: Gib /handel ein, du legst die Diamanten rein und Steve die Elytra. Erst wenn beides drin ist, nimmt sich jeder die andere Seite. So kann niemand betrügen. Unten könnt ihr euch schreiben.' }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9001"] .deal-actions .btn.emerald', title: 'Übergabe bestätigen',
      text: 'Mit der Handelstruhe ist der Deal danach von selbst erledigt. Habt ihr direkt im Spiel getauscht, bestätigt einer von euch hier die Übergabe.',
      task: 'Klick auf „Übergabe bestätigen“.',
      done: (e) => e.type === 'market_done' && e.listingId === 9001 }),
    inBoerse({ market: 'sell', target: '[data-listing="9002"]', title: 'Verhandeln mit VB',
      text: 'Gold heißt VB, also Verhandlungsbasis. Du schlägst einen Preis vor, und ihr handelt hin und her, bis ihr euch einig seid.',
      task: 'Schlag Alex einen Preis für das Obsidian vor, zum Beispiel 6 Diamanten.',
      done: (e) => e.type === 'market_offer' && e.listingId === 9002 }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9002"]', title: 'Alex überlegt …',
      text: 'Dein Angebot ist raus. Alex antwortet gleich: Entweder nimmt er an, oder er macht ein Gegenangebot.',
      wait: true, done: (e) => e.type === 'bot' && e.listingId === 9002, skipIf: () => answered(9002) }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9002"]', title: 'Du bist dran',
      text: 'Alex will etwas mehr. Gold markiert Deals, bei denen du dran bist. Du kannst annehmen, wieder etwas bieten oder ablehnen.',
      task: 'Nimm Alex’ Gegenangebot an.',
      done: decided(() => 9002), skipIf: () => practiceDeal(9002)?.status !== 'open' }),
    inBoerse({ market: 'buy', target: '.page-head .btn.diamond', title: 'Auftrag aufgeben',
      text: 'Du brauchst etwas? Gib eine Suchanfrage auf. Andere sehen sie unter „Gesucht“ und bieten an, es dir zu liefern. Suchanfragen sind immer VB.',
      task: 'Klick auf „Etwas suchen“, wähl ein Item (zum Beispiel Diamantblock), Menge und Preis und stell die Suchanfrage ein.',
      done: (e) => e.type === 'market_create' && e.kind === 'buy', remember: 'buyListing' }),
    inBoerse({ market: 'deals', target: '.my-listings', title: 'Warte auf Angebote',
      text: 'Deine Suchanfrage steht jetzt unter „Deine Einträge“. Steve hat sie schon gesehen …',
      wait: true, done: (e) => e.type === 'bot' && e.listingId === tour.ctx.buyListing, skipIf: () => !!practiceDeal(tour.ctx.buyListing) }),
    inBoerse({ market: 'deals', target: () => `[data-deal-listing="${tour.ctx.buyListing}"]`, title: 'Steve kann liefern',
      text: 'Steve bietet dir an, die Items zu bringen, und nennt seinen Preis.',
      task: 'Nimm Steves Angebot an.',
      done: decided(() => tour.ctx.buyListing), skipIf: () => practiceDeal(tour.ctx.buyListing)?.status !== 'open' }),
    inBoerse({ market: 'buy', target: '[data-listing="9011"]', title: 'Auftrag annehmen',
      text: 'Andersrum geht es auch: Steve sucht Enderperlen. Wenn du welche hast, bietest du an, sie zu liefern. Das ist dann dein Auftrag.',
      task: 'Klick bei den Enderperlen auf „Ich kann liefern“. Der Preis ist schon eingetragen.',
      done: (e) => e.type === 'market_offer' && e.listingId === 9011 }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9011"]', title: 'Steve antwortet …',
      text: 'Steve schaut sich dein Angebot an.',
      wait: true, done: (e) => e.type === 'bot' && e.listingId === 9011, skipIf: () => answered(9011) }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9011"]', title: 'Auftrag angenommen',
      text: 'Steve ist einverstanden. Jetzt legst du die Enderperlen in die Handelstruhe (/handel) und Steve die Diamanten. Sobald beides drin ist, nimmt sich jeder die andere Seite.' }),
    inBoerse({ market: 'sell', target: '.page-head .btn.diamond', title: 'Selbst verkaufen',
      text: 'Zum Schluss verkaufst du selbst etwas. Bei Festpreis bekommt es der Erste, der kauft. Bei VB schicken dir Käufer Preisvorschläge.',
      task: 'Klick auf „Etwas verkaufen“ und stell ein Angebot ein.',
      done: (e) => e.type === 'market_create' && e.kind === 'sell', remember: 'sellListing' }),
    inBoerse({ market: 'deals', target: '.my-listings', title: 'Ein Käufer meldet sich …',
      text: 'Dein Angebot ist online. Alex hat es gerade entdeckt …',
      wait: true, done: (e) => e.type === 'bot' && e.listingId === tour.ctx.sellListing, skipIf: () => !!practiceDeal(tour.ctx.sellListing) }),
    inBoerse({ market: 'deals', target: () => `[data-deal-listing="${tour.ctx.sellListing}"]`, title: 'Alex will kaufen',
      text: 'Bei Festpreis hat Alex direkt gekauft, bei VB schlägt er dir einen Preis vor. Du entscheidest: annehmen, Gegenangebot oder ablehnen. Die goldene Zahl oben im Menü zeigt, wie viele Deals auf dich warten.' }),
    { page: 'boerse', practice: false, market: 'sell', target: '.market-tabs', title: 'Übung vorbei',
      text: 'Jetzt siehst du wieder die echte Börse: Was du hier einstellst, sehen alle Spieler. Mit „Erst mal üben“ kannst du jederzeit nochmal üben.' },
    { page: 'vorschlaege', target: '.suggestion-form', title: 'Vorschläge',
      text: 'Du hast eine Idee für den Server? Schreib sie hier rein. Die Admins sehen alle Vorschläge und markieren, was angenommen oder umgesetzt ist.' },
    { page: 'vorschlaege', target: '.suggestion', title: 'Abstimmen und mitreden',
      text: 'Mit den Pfeilen stimmst du für oder gegen einen Vorschlag. Unter „Antworten“ diskutierst du wie in einem Forum mit.' },
    { page: 'abstimmungen', target: '.option', title: 'Abstimmungen',
      text: 'Bei Server-Entscheidungen stimmst du hier ab. Ein Klick auf eine Antwort reicht, und solange die Abstimmung läuft, kannst du sie ändern.' },
    { page: 'regeln', target: '.rules', title: 'Regeln',
      text: 'Die Regeln des Servers. Du bestätigst sie beim Joinen (nach jeder Änderung neu), hier kannst du sie jederzeit nachlesen.' },
    { page: 'einspruch', target: '.page-head', title: 'Einspruch',
      text: 'Falls du mal gebannt wirst: Im Bann-Bildschirm steht ein Code. Damit meldest du dich hier an und legst Einspruch ein.' },
    { page: 'konto', target: '.github-card', title: 'Dein Konto',
      text: 'Hierher kommst du über deinen Kopf oben rechts. Verknüpfst du GitHub, brauchst du keinen Code mehr aus dem Spiel. Und hier findest du diesen Rundgang wieder.' },
    { page: 'start', title: 'Fertig!',
      text: 'Das war alles. Im Spiel öffnet /web diese Seite, und /weblogin gibt dir einen Login-Code. Viel Spaß auf Fake Attack 3!' }
  ];

  // the shop tutorial: everyone goes through it once, in the practice Börse, and cannot skip it
  const inShops = (step) => ({ page: 'boerse', practice: true, market: 'shops', ...step });
  const SHOP_TOUR_STEPS = [
    inShops({ target: '.practice-banner', title: 'Neu: Shops',
      text: 'Die Börse hat jetzt Shops: Karteikarten mit festen Preisen, bei denen man immer wieder kaufen kann. Wir zeigen dir das kurz im Übungsmodus. Steve und Alex sind nicht echt, und nichts davon sehen andere Spieler.' }),
    inShops({ target: '[data-shop="9101"]', title: 'Ein Shop',
      text: 'Jede Zeile ist ein Produkt mit festem Preis. „noch 10×“ heißt: So oft liegt es noch im Lager des Shops im Spiel. Ist nichts mehr da, steht dort „ausverkauft“.' }),
    inShops({ target: '[data-listing="9111"]', title: 'Im Shop kaufen',
      text: 'Kaufen geht ohne Verhandeln: Klick, bestätigen, fertig.',
      task: 'Kauf bei Steve 64 Raketen: Klick auf „Kaufen“ und bestätige.',
      done: (e) => e.type === 'market_buy' && e.listingId === 9111 }),
    inBoerse({ market: 'deals', target: '[data-deal-listing="9111"]', title: 'Die Ware kommt aus dem Lager',
      text: 'Steve muss dafür nicht online sein: Der Server legt die Raketen aus seinem Lager selbst in die Handelstruhe. Du gibst im Spiel /handel ein, legst die Diamanten dazu und nimmst dir die Raketen.' }),
    inShops({ target: '.page-head .btn.diamond', title: 'Dein eigener Shop',
      text: 'Jeder kann bis zu 3 Shops eröffnen, mit je 12 Produkten.',
      task: 'Klick auf „Shop eröffnen“, gib deinem Shop einen Namen und klick unten nochmal auf „Shop eröffnen“.',
      done: (e) => e.type === 'shop_save' && e.created, remember: 'shop', rememberKey: 'shopId' }),
    inShops({ target: '.shop-editor', title: 'Produkte eintragen',
      text: 'Wähl ein Item aus der Liste, zum Beispiel „Feuerwerksrakete (Flugdauer 3)“, wie viel man pro Kauf bekommt und den Preis.',
      task: 'Trag ein Produkt ein und klick auf „Ins Regal“.',
      done: (e) => e.type === 'shop_add_product' && e.shopId === tour.ctx.shop }),
    inShops({ target: () => `[data-shop="${tour.ctx.shop}"]`, title: 'Das Lager im Spiel', enter: () => { state.market.shopEdit = null; },
      text: 'Im Spiel öffnest du mit /handel dein Shop-Fenster. Dort legst du die Ware ins Lager, und jede Bestellung füllt der Server von selbst. '
        + 'Mit dem Trichter verknüpfst du eine Kiste, zum Beispiel an deiner Farm: Der Shop zieht dann alles, was er verkauft, von selbst daraus. '
        + 'Für die Übung ist dein Lager schon gefüllt.' }),
    inShops({ target: () => `[data-shop="${tour.ctx.shop}"]`, title: 'Alex kauft …',
      text: 'Alex hat deinen Shop gerade entdeckt …',
      wait: true, done: (e) => e.type === 'bot' && e.action === 'paid' && e.shopId === tour.ctx.shop,
      skipIf: () => !!state.practice && state.practice.shopSold(tour.ctx.shop) }),
    inShops({ target: () => `[data-shop="${tour.ctx.shop}"] .shop-own .shop-btn`, title: 'Verkauft!',
      text: 'Alex hat gekauft und bezahlt. Die Ware kam aus deinem Lager, die Diamanten liegen jetzt in der Kasse deines Shops.',
      task: 'Klick bei deinem Shop auf „Übersicht“.',
      done: (e) => e.type === 'shop_overview' && e.shopId === tour.ctx.shop }),
    inShops({ target: '.shop-overview', title: 'Alles im Blick',
      text: 'Hier siehst du dasselbe wie im Spiel unter /handel: was im Lager liegt, was in der Kasse ist, deine verknüpften Kisten, offene Bestellungen, und wer wie viel gekauft hat.' }),
    { page: 'boerse', practice: false, market: 'shops', target: '.market-tabs', title: 'Geschafft!',
      text: 'Das war die Übung, jetzt siehst du wieder die echten Shops. Was du hier einstellst, sehen alle Spieler. Viel Erfolg mit deinem eigenen Shop!' }
  ];
  const shopTourKey = () => `fa3-shop-tour-done:${state.me ? state.me.uuid : ''}`;

  // the database remembers finished tutorials per account (my_tutorials), the browser as well: so the shop
  // tutorial does not come again on the phone; without the database (before its SQL) only the browser counts
  const tutorialName = (key) => (key === TOUR_KEY ? 'rundgang' : key.startsWith('fa3-shop-tour-done') ? 'shops' : null);

  async function loadTutorials() {
    try {
      state.tutorials = await rpc('my_tutorials', { p_token: state.token });
    } catch {
      state.tutorials = null;
      return;
    }
    // finished in this browser before the database knew: tell it now
    for (const key of [TOUR_KEY, shopTourKey()]) {
      const name = tutorialName(key);
      let local = false;
      try { local = localStorage.getItem(key) === '1'; } catch { /* no storage */ }
      if (local && name && !state.tutorials.includes(name)) {
        state.tutorials.push(name);
        rpc('tutorial_done', { p_token: state.token, p_name: name }).catch(() => {});
      }
    }
  }

  function tourSeen(key = TOUR_KEY) {
    const name = tutorialName(key);
    if (name && Array.isArray(state.tutorials) && state.tutorials.includes(name)) return true;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  }

  function markTourSeen(key = TOUR_KEY) {
    try { localStorage.setItem(key, '1'); } catch { /* then the offer simply comes back next time */ }
    const name = tutorialName(key);
    if (name && state.token) {
      if (Array.isArray(state.tutorials) && !state.tutorials.includes(name)) state.tutorials.push(name);
      rpc('tutorial_done', { p_token: state.token, p_name: name }).catch(() => {});
    }
  }

  async function startTour() {
    if (!state.me || state.me.banned) return;
    Object.assign(tour, { steps: TOUR_STEPS, forced: false, key: TOUR_KEY, label: 'Rundgang', ctx: {}, index: 0 });
    await showTourStep();
  }

  async function startShopTour() {
    if (!state.me || state.me.banned || tour.index >= 0) return;
    closeCoach();
    // the general tour is not offered on top of it in this visit
    tour.offered = true;
    Object.assign(tour, { steps: SHOP_TOUR_STEPS, forced: true, key: shopTourKey(), label: 'Shop-Tutorial', ctx: {}, index: 0 });
    await showTourStep();
  }

  function endTour() {
    tour.index = -1;
    markTourSeen(tour.key);
    tour.forced = false;
    closeCoach();
    clearTourTarget();
    if (state.practice) {
      stopPractice();
      if (currentPage() === 'boerse') refresh();
    }
  }

  function goToStep(index) {
    tour.index = index;
    showTourStep();
  }

  async function showTourStep() {
    while (tour.index < tour.steps.length && tour.steps[tour.index].skipIf && tour.steps[tour.index].skipIf()) {
      tour.index++;
    }
    if (tour.index < 0) return;
    if (tour.index >= tour.steps.length) {
      endTour();
      return;
    }
    const index = tour.index;
    const step = tour.steps[index];
    if (step.practice && !state.practice) startPractice();
    if (step.practice === false && state.practice) stopPractice();
    if (step.market) {
      state.market.view = step.market;
      state.market.formOpen = false;
    }
    if (step.enter) step.enter();
    if (currentPage() !== step.page) history.pushState(null, '', '#/' + step.page);
    renderCoach(step);
    await route();
    if (tour.index !== index) return;
    const target = document.querySelector('.tour-target');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(placeCoach, 650);
  }

  // keep the guide card off the highlighted element: bottom right, or bottom left if that covers less of it
  function placeCoach() {
    const card = tour.card;
    const target = document.querySelector('.tour-target');
    if (!card) return;
    card.classList.remove('coach-left');
    if (!target || window.innerWidth <= 860) return;
    const covered = () => {
      const c = card.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      return Math.max(0, Math.min(c.right, t.right) - Math.max(c.left, t.left))
        * Math.max(0, Math.min(c.bottom, t.bottom) - Math.max(c.top, t.top));
    };
    const right = covered();
    if (!right) return;
    card.classList.add('coach-left');
    if (covered() >= right) card.classList.remove('coach-left');
  }

  // practice events finish task and wait steps; true when the tour re-renders the page itself
  function tourEvent(event) {
    if (tour.index < 0) return false;
    const step = tour.steps[tour.index];
    if (!step.done || !step.done(event)) return false;
    if (step.remember) tour.ctx[step.remember] = event[step.rememberKey || 'listingId'];
    tour.index++;
    setTimeout(showTourStep, step.wait ? 400 : 800);
    return true;
  }

  // after every render: mark the current target again, or offer the tour once per visit to everyone who has not seen it
  function tourAfterRender() {
    if (tour.index >= 0) {
      const step = tour.steps[tour.index];
      // a tour you cannot skip brings you back when you click somewhere else
      if (tour.forced && step && currentPage() !== step.page) {
        setTimeout(() => goToStep(tour.index), 0);
        return;
      }
      markTourTarget(step);
      return;
    }
    if (state.me && !state.me.banned && !tourSeen(shopTourKey())) {
      setTimeout(startShopTour, 500);
      return;
    }
    if (!tour.offered && state.me && !state.me.banned && !tourSeen()) {
      tour.offered = true;
      setTimeout(offerTour, 700);
    }
  }

  function markTourTarget(step) {
    clearTourTarget();
    if (!step.target || currentPage() !== step.page) return;
    const selector = typeof step.target === 'function' ? step.target() : step.target;
    const el = selector ? document.querySelector(selector) : null;
    if (el) el.classList.add('tour-target');
    placeCoach();
  }

  function clearTourTarget() {
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
  }

  function closeCoach() {
    if (tour.card) tour.card.remove();
    tour.card = null;
  }

  function coach(...children) {
    closeCoach();
    tour.card = h('aside', { class: 'coach glass thick', role: 'dialog', 'aria-label': 'Rundgang', 'aria-live': 'polite' }, ...children);
    document.body.append(tour.card);
  }

  function renderCoach(step) {
    const total = tour.steps.length;
    const last = tour.index === total - 1;
    const prev = tour.steps[tour.index - 1];
    // back only to plain explanations in the same mode; practice actions cannot be undone
    const canBack = prev && !prev.done && !!prev.practice === !!step.practice;
    // in a tour you cannot skip, a task has to be done and waiting has no button
    const next = last
      ? h('button', { class: 'btn primary', onclick: endTour }, 'Fertig')
      : step.done
        ? tour.forced ? null : h('button', { class: 'btn small ghost', onclick: () => goToStep(tour.index + 1) }, 'Überspringen')
        : h('button', { class: 'btn primary', onclick: () => goToStep(tour.index + 1) }, 'Weiter');
    coach(
      h('div', { class: 'coach-top' },
        h('span', { class: 'eyebrow' }, `${tour.label} · ${tour.index + 1} von ${total}`),
        tour.forced ? null : h('button', { class: 'coach-close', title: 'Rundgang beenden', 'aria-label': 'Rundgang beenden', onclick: endTour }, icon('close'))),
      h('div', { class: 'coach-progress' }, h('i', { style: `width:${Math.round(((tour.index + 1) / total) * 100)}%` })),
      h('h3', {}, step.title),
      h('p', { class: 'coach-text' }, step.text),
      step.task ? h('div', { class: 'coach-task' }, h('b', {}, 'Deine Aufgabe'), h('span', {}, step.task)) : null,
      step.wait ? h('div', { class: 'coach-wait' }, h('i'), 'Einen Moment …') : null,
      h('div', { class: 'coach-actions' },
        canBack ? h('button', { class: 'btn small ghost', onclick: () => goToStep(tour.index - 1) }, 'Zurück') : null,
        h('span', { class: 'spacer' }),
        next));
  }

  function offerTour() {
    if (tour.index >= 0 || tour.card || !state.me || state.me.banned || tourSeen()) return;
    coach(
      h('div', { class: 'coach-top' },
        h('span', { class: 'eyebrow' }, 'Rundgang'),
        h('button', { class: 'coach-close', title: 'Später', 'aria-label': 'Später', onclick: closeCoach }, icon('close'))),
      h('h3', {}, 'Kennst du schon alles?'),
      h('p', { class: 'coach-text' }, 'Der Rundgang zeigt dir in ein paar Minuten alle Funktionen der Website. In der Börse übst du Kaufen, Verkaufen und Aufträge mit zwei Übungs-Spielern.'),
      h('div', { class: 'coach-actions' },
        h('button', { class: 'btn small ghost', onclick: () => { markTourSeen(); closeCoach(); } }, 'Nicht mehr zeigen'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small', onclick: closeCoach }, 'Später'),
        h('button', { class: 'btn primary', onclick: startTour }, 'Los geht’s')));
  }

  // ---------------------------------------------------------------- Start

  async function init() {
    document.getElementById('brand-name').textContent = CONFIG.serverName || 'Server';
    document.title = CONFIG.serverName || 'Server';
    window.addEventListener('hashchange', route);
    // refit when the bar changes width (window size, zoom); the steps only change its content, not its width
    let fitTimer = null;
    const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitTopbar, 60); };
    if (window.ResizeObserver) new ResizeObserver(refit).observe(topbar);
    else window.addEventListener('resize', refit);
    // the web fonts change the widths once they have loaded
    if (document.fonts) document.fonts.ready.then(fitTopbar);
    initStage();

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      url.searchParams.delete('code');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    state.token = loadToken();
    if (await finishGithub()) return;
    if (code) {
      try {
        await login(code);
        return;
      } catch (error) {
        toast(error.message, 'error');
      }
    }
    if (state.token) {
      try {
        const me = await rpc('session_info', { p_token: state.token });
        if (me) {
          state.me = me;
          state.webLocked = Boolean(me.web_locked);
          if (!me.banned) await Promise.all([loadTutorials(), loadPlotCount()]);
        } else {
          clearSession();
        }
      } catch (error) {
        toast(error.message, 'error');
      }
    }
    await route();
  }

  init();
})();
