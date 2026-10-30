(() => {
  'use strict';

  const CONFIG = window.PORTAL_CONFIG || {};
  const TOKEN_KEY = 'fa3-portal-token';
  const OAUTH_INTENT_KEY = 'fa3-oauth-intent';
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const userBox = document.getElementById('user');
  const toastBox = document.getElementById('toast');
  const pillStatus = document.getElementById('pill-status');

  const state = { token: null, me: null, filter: 'all', refreshTimer: null, pillAt: 0, openThreads: new Set() };
  let renderSeq = 0;

  const SUGGESTION_STATUS = { open: 'Offen', accepted: 'Angenommen', done: 'Umgesetzt', rejected: 'Abgelehnt' };
  const APPEAL_STATUS = { pending: 'Wird geprüft', accepted: 'Angenommen', rejected: 'Abgelehnt' };

  const PAGES = {
    start: { title: 'Start', short: 'Start', icon: 'home', render: renderStart },
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
    chat: '<path d="M4 5h16v11H10l-6 4z"/>'
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
    return h('div', { class: 'card' },
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
      h('a', { href: '#/' + page, class: page === active ? 'on' : null, 'aria-current': page === active ? 'page' : null },
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
    updatePill();
  }

  // status capsule top left: online/offline and player count, refreshed at most every 30 s
  async function updatePill(status) {
    if (!status) {
      if (Date.now() - state.pillAt < 30000) return;
      state.pillAt = Date.now();
      try { status = await rpc('get_status', { p_token: state.token }); } catch { return; }
    }
    state.pillAt = Date.now();
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
      if (seq === renderSeq) app.replaceChildren(view);
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
    const statusCard = h('div', { class: 'card' },
      h('div', { class: 'status-line' }, h('i', { class: 'dot ' + (s.online ? 'on' : 'off') }), s.online ? 'Online' : 'Offline'),
      s.online
        ? h('div', { class: 'figure' }, `${s.player_count} `, h('small', {}, `/ ${s.max_players} Spieler`))
        : h('p', { class: 'muted', style: 'margin-top:10px' }, 'Der Server ist gerade nicht erreichbar.'),
      s.online && players.length ? h('div', { class: 'players' }, players) : null,
      h('p', { class: 'faint small', style: 'margin-top:14px' }, [s.version ? `Minecraft ${s.version}` : null, s.updated_at ? `Stand ${formatDate(s.updated_at)}` : null].filter(Boolean).join(' · ')));

    const address = s.address && s.game_port ? `${s.address}:${s.game_port}` : null;
    const addressCard = h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Server-Adresse'),
      address
        ? h('div', { class: 'address' }, h('code', {}, address), h('button', { class: 'btn', onclick: () => copy(address) }, 'Kopieren'))
        : h('p', { class: 'muted', style: 'margin-top:10px' }, 'Erscheint, sobald der Server online ist.'),
      h('p', { class: 'faint small', style: 'margin-top:12px' }, 'Bitte nicht öffentlich teilen.'));

    const mapUrl = s.address && s.map_port ? `http://${s.address}:${s.map_port}/` : null;
    const mapCard = h('div', { class: 'card map-card' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Weltkarte'), h('h3', { style: 'margin-top:6px' }, '3D-Karte der Welt'),
        h('p', { class: 'muted small', style: 'margin-top:4px' }, 'Ohne Spielerstandorte. Läuft direkt auf dem Server.')),
      mapUrl
        ? h('div', { class: 'stack' },
          h('a', { class: 'btn primary', href: mapUrl, target: '_blank', rel: 'noopener' }, icon('map'), 'Karte öffnen'),
          h('p', { class: 'faint small' }, 'Im selben Heimnetz wie der Server? ',
            h('a', { href: `http://localhost:${s.map_port}/`, target: '_blank', rel: 'noopener' }, `localhost:${s.map_port}`)))
        : h('p', { class: 'faint small' }, 'Nur erreichbar, wenn der Server online ist.'));

    return h('div', {},
      pageHead('Übersicht', `Hallo, ${state.me.name}`),
      h('div', { class: 'grid' }, statusCard, addressCard, mapCard),
      h('div', { class: 'grid', style: 'margin-top:16px' },
        h('a', { class: 'card link-card', href: '#/vorschlaege' },
          h('h3', {}, 'Vorschläge'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Ideen für den Server einreichen und bewerten.')),
        h('a', { class: 'card link-card', href: '#/abstimmungen' },
          h('h3', {}, 'Abstimmungen'), h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Bei Server-Entscheidungen mitbestimmen.')),
        githubLink === null ? githubCard(null) : null));
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
    return h('div', {},
      pageHead('Konto', state.me.name, 'Dein Spieler und die Anmeldung mit GitHub.'),
      h('div', { class: 'grid' }, playerCard, githubCard(githubLink)));
  }

  // ---------------------------------------------------------------- Vorschlaege

  async function renderSuggestions() {
    const list = await rpc('list_suggestions', { p_token: state.token });

    const title = h('input', { maxlength: '80', placeholder: 'Kurzer Titel, z. B. „Shop-Viertel am Spawn“' });
    const body = h('textarea', { maxlength: '1500', placeholder: 'Beschreibe deine Idee (optional)' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Einreichen');
    const form = h('form', {
      class: 'card thick stack',
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
    const appeals = await rpc('admin_list_appeals', { p_token: state.token });
    const pending = appeals.filter((a) => a.status === 'pending').length;
    return h('div', {},
      pageHead('Admin', 'Ban-Einsprüche', 'Vorschläge bearbeitest du direkt bei den Vorschlägen, Abstimmungen startest du bei den Abstimmungen.',
        h('span', { class: 'badge ' + (pending ? 'pending' : '') }, `${pending} offen`)),
      appeals.length ? appeals.map(appealAdminCard) : h('div', { class: 'empty' }, 'Keine Einsprüche.'));
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

  // ---------------------------------------------------------------- Start

  async function init() {
    document.getElementById('brand-name').textContent = CONFIG.serverName || 'Server';
    document.title = CONFIG.serverName || 'Server';
    window.addEventListener('hashchange', route);
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
