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
    token: null, me: null, filter: 'all', refreshTimer: null, pillAt: 0, openThreads: new Set(),
    market: { view: 'sell', q: '', cat: '', sort: 'new', type: 'all', formOpen: false }, marketPending: 0,
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

  function head(uuid, size) {
    return h('img', { src: `https://mc-heads.net/avatar/${encodeURIComponent(uuid)}/${size}`, alt: '', width: size, height: size, loading: 'lazy' });
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
    if (state.practice && fn.startsWith('market_')) {
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

  // ---------------------------------------------------------------- Kopfzeile

  function allowedPages() {
    if (!state.me) return [];
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
    const count = status.player_count || 0;
    pillStatus.replaceChildren(
      h('i', { class: 'dot ' + (status.online ? 'on' : 'off') }),
      status.online ? `Online · ${count} Spieler` : 'Offline');
  }

  async function route() {
    clearTimeout(state.refreshTimer);
    const seq = ++renderSeq;
    if (!state.me) {
      renderChrome(null);
      document.title = CONFIG.serverName || 'Server';
      const view = await renderLogin();
      if (seq === renderSeq) app.replaceChildren(view);
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
        tourAfterRender();
      }
    } catch (error) {
      if (seq !== renderSeq) return;
      if (error.sessionExpired) {
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
    const [s, githubLink] = await Promise.all([
      rpc('get_status', { p_token: state.token }),
      // false = could not check; then the start page simply leaves the hint out
      CONFIG.githubLogin === false ? false : rpc('my_github', { p_token: state.token }).catch(() => false)
    ]);
    updatePill(s);
    state.refreshTimer = setTimeout(() => { if (currentPage() === 'start' && !document.querySelector('input:focus, textarea:focus')) refresh(); }, 60000);

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

  // ---------------------------------------------------------------- Inventar

  // item pictures: rendered icons first, then the plain textures; without any picture the slot shows letters
  const ICON_URLS = [
    (id) => `https://mc.nerothe.com/img/1.21.8/minecraft_${id}.png`,
    (id) => `https://assets.mcasset.cloud/26.3/assets/minecraft/textures/item/${id}.png`,
    (id) => `https://assets.mcasset.cloud/26.3/assets/minecraft/textures/block/${id}.png`
  ];
  // German names from the market's item list; the first name wins
  const ITEM_NAMES = new Map(Object.entries(window.MARKET_ITEM_IDS || {}).map(([name, id]) => [id, name]).reverse());
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
    for (const [id, level] of item.ench || []) lines.push(`${ENCHANTS[id] || prettyId(id)} ${ROMAN[level] || level}`);
    if (item.max) lines.push(`Haltbarkeit ${item.max - item.dmg} / ${item.max}`);
    return lines;
  }

  function itemIcon(id) {
    const img = h('img', { alt: '', loading: 'lazy', draggable: 'false' });
    let step = 0;
    img.onerror = () => {
      step += 1;
      if (step < ICON_URLS.length) img.src = ICON_URLS[step](id);
      else img.replaceWith(h('span', { class: 'slot-text' }, prettyId(id).split(' ').map((word) => word.charAt(0)).join('').slice(0, 3)));
    };
    img.src = ICON_URLS[0](id);
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
    const githubLink = CONFIG.githubLogin === false ? null : await rpc('my_github', { p_token: state.token });
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
      pageHead('Konto', state.me.name, 'Dein Spieler und die Anmeldung mit GitHub.'),
      h('div', { class: 'grid' }, playerCard, githubCard(githubLink), tourCard));
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

  // price in diamonds; without a number it is only "VB"
  function priceTag(price) {
    if (price == null) return h('span', { class: 'price vb' }, h('b', {}, 'VB'));
    if (price === 0) return h('span', { class: 'price' }, h('b', {}, 'Gratis'));
    return h('span', { class: 'price', title: diamonds(price) }, h('b', {}, String(price)), icon('gem'));
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
      m.view === 'deals' ? [] : rpc('market_list', { p_token: state.token, p_kind: m.view }),
      rpc('market_mine', { p_token: state.token })
    ]);
    setMarketPending(mine.pending);

    const tabs = [['sell', 'Zu verkaufen'], ['buy', 'Gesucht'], ['deals', 'Meine Deals']];
    const tabBar = h('div', { class: 'filters', role: 'tablist' }, tabs.map(([key, label]) =>
      h('button', {
        class: m.view === key ? 'on' : null, role: 'tab', 'aria-selected': m.view === key ? 'true' : 'false',
        onclick: () => { m.view = key; m.formOpen = false; refresh(); }
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
    const price = priceInput({ id: 'mk-price' });
    const priceLabel = h('label', { for: 'mk-price' });
    const hint = h('p', { class: 'faint small' });
    const description = h('textarea', { id: 'mk-desc', maxlength: '500', placeholder: sell ? 'Verzauberungen, Zustand, wo ihr euch trefft …' : 'Was genau brauchst du? Bis wann?' });
    const urgency = sell ? null : h('select', { id: 'mk-urgency' }, URGENCY.map((label, i) => h('option', { value: String(i) }, label)));

    const typeButtons = sell ? [['fixed', 'Festpreis'], ['vb', 'VB']].map(([key, label]) =>
      h('button', { type: 'button', 'data-type': key, onclick: () => { priceType = key; syncType(); } }, label)) : [];
    const syncType = () => {
      for (const b of typeButtons) b.className = b.dataset.type === priceType ? 'on' : '';
      const fixed = priceType === 'fixed';
      price.input.required = fixed;
      price.input.placeholder = fixed ? 'Preis' : 'optional';
      priceLabel.textContent = !sell ? 'Was zahlst du ungefähr?' : fixed ? 'Festpreis in Diamanten' : 'Preisvorstellung';
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
        act(submit, async () => {
          // a name from the item list tells the trade chest in the game which item to count
          const known = ITEM_CATEGORY.get(title.value.trim().toLowerCase());
          await rpc('market_create', {
            p_token: state.token, p_kind: kind, p_title: title.value, p_category: category.value,
            p_quantity: Number(quantity.value), p_price: price.input.value === '' ? null : Number(price.input.value),
            p_price_type: priceType, p_urgency: urgency ? Number(urgency.value) : 0, p_description: description.value,
            p_item: known ? ITEM_IDS[known.name] || null : null
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
      h('div', {}, priceLabel, price.box),
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
        !sell && l.price != null ? h('span', { class: 'muted small' }, 'Bietet') : null,
        priceTag(l.price),
        l.price == null ? h('span', { class: 'muted small' }, 'Preis verhandelbar') : priceTypeBadge(l.price_type)),
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
          if (!confirm(`${amount(l.quantity, l.title)} für ${priceText(l.price)} von ${l.author} kaufen? Danach trefft ihr euch im Spiel zur Übergabe.`)) return;
          act(event.currentTarget, async () => {
            await rpc('market_buy', { p_token: state.token, p_listing_id: l.id });
            state.market.view = 'deals';
            window.scrollTo(0, 0);
          }, 'Gekauft! Der Deal steht unter „Meine Deals“.');
        }
      }, `Kaufen · ${priceText(l.price)}`));
    }

    // VB: price offer for an Angebot, delivery offer for a Suchanfrage
    const price = priceInput({ placeholder: 'Preis', value: l.price ?? '', 'aria-label': 'Dein Preis in Diamanten', required: true });
    const send = h('button', { class: 'btn gold', type: 'submit' }, l.kind === 'sell' ? 'Preis vorschlagen' : 'Ich kann liefern');
    return h('form', {
      class: 'listing-actions offer',
      onsubmit: (event) => {
        event.preventDefault();
        act(send, async () => {
          await rpc('market_offer', { p_token: state.token, p_listing_id: l.id, p_price: Number(price.input.value), p_body: null });
          state.market.view = 'deals';
          window.scrollTo(0, 0);
        }, 'Angebot geschickt. Weiter geht es unter „Meine Deals“.');
      }
    }, price.box, send, h('span', { class: 'spacer' }), remove);
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
        `Ware und Bezahlung liegen in der Handelstruhe. Hol dir im Spiel mit /handel ${giveGoods ? 'die Diamanten' : 'die Ware'} ab.`));
    }
    if (d.status !== 'agreed') {
      return h('div', { class: 'notice caution' }, h('i'), h('span', {}, h('b', {}, 'Handelstruhe: '),
        'Der Deal ist abgebrochen. Was du hineingelegt hast, nimmst du im Spiel mit /handel wieder raus.'));
    }
    const goods = e.auto ? `${e.goods} von ${e.goods_needed}`
      : e.confirmed ? 'freigegeben' : e.goods_stacks ? `${e.goods_stacks} Stapel, wartet auf Freigabe` : 'noch leer';
    const check = d.listing.item ? 'Die Ware zählt der Server automatisch.'
      : giveGoods ? `${d.partner} schaut sich deine Ware an und gibt sie frei.` : 'Du schaust dir die Ware an und gibst sie frei.';
    return h('div', { class: 'notice ok' }, h('i'), h('span', {},
      h('b', {}, `Deal über ${priceText(d.price)}. `),
      `Übergabe im Spiel mit /handel: Du legst ${giveGoods ? 'die Ware' : 'die Diamanten'} in die Handelstruhe. `,
      'Erst wenn beide Seiten vollständig sind, kann jeder die andere Seite nehmen. So kann niemand betrügen. ', check,
      e.inside ? h('span', { class: 'escrow-progress' }, `Ware: ${goods} · Bezahlung: ${e.paid || 0} von ${diamonds(d.price)}`) : null,
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
      h('div', { class: 'deal-title' }, h('h3', {}, amount(d.listing.quantity, d.listing.title)), h('p', { class: 'muted small' }, dealRole(d))),
      myTurn ? h('span', { class: 'badge caution' }, 'Du bist dran') : null,
      d.status === 'agreed' ? h('span', { class: 'badge ok' }, 'Übergabe offen') : null,
      d.escrow && d.escrow.locked && d.escrow.inside ? h('span', { class: 'badge ok' }, 'Abholen') : null,
      active ? null : h('span', { class: 'badge' + (d.status === 'done' ? ' ok' : '') }, DEAL_STATUS[d.status]));

    // Verhandlung (gold) -> Deal -> Uebergeben (smaragd)
    const reached = { open: 0, agreed: 1, done: 3 }[d.status];
    const steps = reached == null ? null : h('ol', { class: 'deal-steps' }, ['Verhandlung', 'Deal', 'Übergeben'].map((label, i) =>
      h('li', { class: (i === 0 ? 'talk' : 'deal') + (i < reached ? ' done' : i === reached ? ' now' : '') }, h('i'), label)));

    const summary = d.price == null ? null : h('div', { class: 'deal-sum' },
      h('span', {}, d.status === 'open' ? (d.last_by_me ? 'Dein letztes Angebot' : `Angebot von ${d.partner}`) : 'Vereinbart'),
      priceTag(d.price));

    const log = h('div', { class: 'deal-log' }, d.messages.map((msg) => {
      if (msg.kind === 'system') return h('p', { class: 'log-system' }, msg.body);
      const when = h('time', { datetime: msg.created_at }, ago(msg.created_at));
      if (msg.kind === 'offer') {
        return h('p', { class: 'log-offer' + (msg.mine ? ' mine' : '') },
          h('b', {}, msg.mine ? 'Du' : msg.author), msg.mine ? ' bietest ' : ' bietet ', h('span', { class: 'chip' }, priceText(msg.price)), when);
      }
      return h('p', { class: 'log-text' + (msg.mine ? ' mine' : '') }, h('b', {}, (msg.mine ? 'Du' : msg.author) + ': '), msg.body, when);
    }));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });

    const controls = [];
    if (d.status === 'open') {
      const counter = priceInput({ placeholder: 'Preis', 'aria-label': d.last_by_me ? 'Neuer Preis in Diamanten' : 'Gegenangebot in Diamanten', required: true });
      const counterButton = h('button', { class: 'btn gold', type: 'submit' }, d.last_by_me ? 'Neues Angebot' : 'Gegenangebot');
      controls.push(h('div', { class: 'deal-actions' },
        myTurn
          ? h('button', { class: 'btn emerald', onclick: (event) => act(event.currentTarget, call('market_accept'), 'Deal! Trefft euch im Spiel zur Übergabe.') },
            icon('check'), `Annehmen · ${priceText(d.price)}`)
          : h('span', { class: 'muted small' }, `Wartet auf ${d.partner} …`),
        h('form', {
          class: 'offer',
          onsubmit: (event) => {
            event.preventDefault();
            act(counterButton, () => rpc('market_counter', { p_token: state.token, p_deal_id: d.id, p_price: Number(counter.input.value) }), 'Angebot geschickt.');
          }
        }, counter.box, counterButton),
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
        h('span', { class: 'faint small' }, [priceText(l.price), l.kind === 'sell' && l.price_type === 'fixed' ? 'Festpreis' : 'VB', ago(l.created_at)].join(' · '))),
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
      pageHead('Server', 'Regeln & Infos', 'Diese Regeln akzeptierst du beim ersten Beitreten im Spiel.'),
      h('div', { class: 'grid' },
        h('div', { class: 'card thick' }, h('p', { class: 'eyebrow', style: 'margin-bottom:14px' }, 'Regeln'),
          h('ol', { class: 'rules' }, (CONFIG.rules || []).map((rule, index) => h('li', {}, h('b', { class: 'no' }, number(index)),
            typeof rule === 'string' ? h('span', {}, rule) : h('div', {}, h('strong', {}, rule.title), h('span', {}, rule.text)))))),
        h('div', { class: 'card thick' }, h('p', { class: 'eyebrow', style: 'margin-bottom:14px' }, 'Gut zu wissen'),
          h('ol', { class: 'rules' }, (CONFIG.info || []).map((line, index) => h('li', {}, h('b', { class: 'no' }, number(index)), h('span', {}, line)))))));
  }

  // ---------------------------------------------------------------- Admin

  async function renderAdmin() {
    const [server, appeals, inventories] = await Promise.all([
      rpc('admin_server', { p_token: state.token }),
      rpc('admin_list_appeals', { p_token: state.token }),
      rpc('admin_inventories', { p_token: state.token })
    ]);
    const pending = appeals.filter((a) => a.status === 'pending').length;
    const waiting = server.commands.some((c) => c.status === 'pending' || c.status === 'running');
    // answers from the server arrive within seconds; otherwise the values refresh every 20 s,
    // but not while an inventory is open (it would close again)
    state.refreshTimer = setTimeout(() => {
      if (currentPage() === 'admin' && !state.adminInventory && !document.querySelector('#app input:focus, #app textarea:focus, #app select:focus')) refresh();
    }, waiting ? 2500 : 20000);
    return h('div', {},
      pageHead('Admin', 'Server-Verwaltung', 'Befehle gehen über die Website an den Server, die Antwort der Konsole steht unten. Vorschläge und Abstimmungen bearbeitest du auf ihren Seiten.'),
      h('div', { class: 'grid' }, adminServerCard(server), adminCountdownCard()),
      adminPlayersCard(server, inventories),
      h('div', { class: 'grid', style: 'margin-top:16px' }, adminWorldCard(), adminPunishCard()),
      adminInventoryCard(inventories),
      adminConsoleCard(server),
      h('div', { class: 'row section-label' }, h('p', { class: 'eyebrow' }, 'Ban-Einsprüche'),
        h('span', { class: 'badge ' + (pending ? 'pending' : '') }, `${pending} offen`)),
      appeals.length ? appeals.map(appealAdminCard) : h('div', { class: 'empty' }, 'Keine Einsprüche.'));
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

  function uptime(minutes) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes / 60) % 24;
    return (days ? `${days} d ` : '') + (days || hours ? `${hours} h ` : '') + `${minutes % 60} min`;
  }

  function adminCountdownCard() {
    const kind = h('select', { 'aria-label': 'Art' }, h('option', { value: 'restartin' }, 'Neustart'), h('option', { value: 'shutdown' }, 'Stopp'));
    const when = h('input', { value: '5m', 'aria-label': 'Wann', placeholder: '5m' });
    const down = h('input', { value: '1m', 'aria-label': 'Wie lange offline', placeholder: '1m' });
    const reason = h('input', { maxlength: '120', placeholder: 'Grund, z. B. Plugin-Update', 'aria-label': 'Grund' });
    const start = h('button', { class: 'btn primary', type: 'submit' }, 'Countdown starten');
    const message = h('input', { maxlength: '200', placeholder: 'Nachricht an alle Spieler', 'aria-label': 'Nachricht an alle' });
    const send = h('button', { class: 'btn', type: 'submit' }, 'Senden');
    const durations = /^(\d+\s*(h|m|s)\s*)+$|^\d+$/i;
    return h('div', { class: 'card thick' },
      h('p', { class: 'eyebrow' }, 'Neustart und Stopp'),
      h('form', {
        class: 'admin-countdown',
        onsubmit: (event) => {
          event.preventDefault();
          if (!durations.test(when.value.trim()) || (down.value.trim() && !durations.test(down.value.trim()))) {
            toast('Zeiten bitte wie 90s, 5m, 1h oder 1h30m angeben.', 'error');
            return;
          }
          const command = [kind.value, when.value.trim(), down.value.trim(), reason.value.trim()].filter(Boolean).join(' ');
          if (confirm(`${kind.value === 'shutdown' ? 'Server stoppen' : 'Server neu starten'} in ${when.value.trim()}?`)) {
            sendCommand(start, command, 'Countdown gestartet.');
          }
        }
      },
      h('div', {}, h('label', {}, 'Art'), kind),
      h('div', {}, h('label', {}, 'Wann'), when),
      h('div', {}, h('label', {}, 'Wie lange offline'), down),
      h('div', { class: 'span-2' }, h('label', {}, 'Grund'), reason),
      h('div', { class: 'row span-2' }, start,
        h('button', { class: 'btn danger', type: 'button', onclick: (event) => sendCommand(event.currentTarget, 'countdown cancel', 'Abbrechen gesendet.') }, 'Countdown abbrechen'))),
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

  function adminInventoryCard(list) {
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
        body.replaceChildren(snap ? h('div', { style: 'margin-top:14px' }, h('div', { class: 'row' }, head(snap.uuid, 24), h('b', {}, snap.name)), inventoryView(snap))
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
    state.market = { ...state.market, view: 'sell', q: '', cat: '', formOpen: false };
    state.practice.on((event) => {
      if (event.type === 'bot' && BOT_NEWS[event.action]) toast(BOT_NEWS[event.action](event.bot), 'ok');
      if (!tourEvent(event)) refreshWhenIdle();
    });
  }

  function stopPractice() {
    if (!state.practice) return;
    state.practice.stop();
    state.practice = null;
    state.market = { ...state.market, view: 'sell', formOpen: false };
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
  const tour = { index: -1, card: null, offered: false, ctx: {} };
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
    inBoerse({ market: 'sell', target: '.market-tabs', title: 'Drei Bereiche',
      text: '„Zu verkaufen“ zeigt, was andere anbieten. „Gesucht“ sind Aufträge: Dinge, die jemand sucht. Unter „Meine Deals“ steht alles, woran du gerade handelst.' }),
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
      text: 'Die Regeln des Servers. Du hast sie beim Joinen bestätigt, hier kannst du sie jederzeit nachlesen.' },
    { page: 'einspruch', target: '.page-head', title: 'Einspruch',
      text: 'Falls du mal gebannt wirst: Im Bann-Bildschirm steht ein Code. Damit meldest du dich hier an und legst Einspruch ein.' },
    { page: 'konto', target: '.github-card', title: 'Dein Konto',
      text: 'Hierher kommst du über deinen Kopf oben rechts. Verknüpfst du GitHub, brauchst du keinen Code mehr aus dem Spiel. Und hier findest du diesen Rundgang wieder.' },
    { page: 'start', title: 'Fertig!',
      text: 'Das war alles. Im Spiel öffnet /web diese Seite, und /weblogin gibt dir einen Login-Code. Viel Spaß auf Fake Attack 3!' }
  ];

  function tourSeen() {
    try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return false; }
  }

  function markTourSeen() {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* then the offer simply comes back next time */ }
  }

  async function startTour() {
    if (!state.me || state.me.banned) return;
    tour.ctx = {};
    tour.index = 0;
    await showTourStep();
  }

  function endTour() {
    tour.index = -1;
    markTourSeen();
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
    while (tour.index < TOUR_STEPS.length && TOUR_STEPS[tour.index].skipIf && TOUR_STEPS[tour.index].skipIf()) {
      tour.index++;
    }
    if (tour.index < 0) return;
    if (tour.index >= TOUR_STEPS.length) {
      endTour();
      return;
    }
    const index = tour.index;
    const step = TOUR_STEPS[index];
    if (step.practice && !state.practice) startPractice();
    if (step.practice === false && state.practice) stopPractice();
    if (step.market) {
      state.market.view = step.market;
      state.market.formOpen = false;
    }
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
    const step = TOUR_STEPS[tour.index];
    if (!step.done || !step.done(event)) return false;
    if (step.remember) tour.ctx[step.remember] = event.listingId;
    tour.index++;
    setTimeout(showTourStep, step.wait ? 400 : 800);
    return true;
  }

  // after every render: mark the current target again, or offer the tour once per visit to everyone who has not seen it
  function tourAfterRender() {
    if (tour.index >= 0) {
      markTourTarget(TOUR_STEPS[tour.index]);
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
    const total = TOUR_STEPS.length;
    const last = tour.index === total - 1;
    const prev = TOUR_STEPS[tour.index - 1];
    // back only to plain explanations in the same mode; practice actions cannot be undone
    const canBack = prev && !prev.done && !!prev.practice === !!step.practice;
    const next = last
      ? h('button', { class: 'btn primary', onclick: endTour }, 'Fertig')
      : step.done
        ? h('button', { class: 'btn small ghost', onclick: () => goToStep(tour.index + 1) }, 'Überspringen')
        : h('button', { class: 'btn primary', onclick: () => goToStep(tour.index + 1) }, 'Weiter');
    coach(
      h('div', { class: 'coach-top' },
        h('span', { class: 'eyebrow' }, `Rundgang · ${tour.index + 1} von ${total}`),
        h('button', { class: 'coach-close', title: 'Rundgang beenden', 'aria-label': 'Rundgang beenden', onclick: endTour }, icon('close'))),
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
        if (me) state.me = me;
        else clearSession();
      } catch (error) {
        toast(error.message, 'error');
      }
    }
    await route();
  }

  init();
})();
