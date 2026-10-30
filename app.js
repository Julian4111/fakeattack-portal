(() => {
  'use strict';

  const CONFIG = window.PORTAL_CONFIG || {};
  const TOKEN_KEY = 'fa3-portal-token';
  const OAUTH_INTENT_KEY = 'fa3-oauth-intent';
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const userBox = document.getElementById('user');
  const toastBox = document.getElementById('toast');

  const state = { token: null, me: null, filter: 'all', refreshTimer: null };
  let renderSeq = 0;

  const SUGGESTION_STATUS = { open: 'Offen', accepted: 'Angenommen', done: 'Umgesetzt', rejected: 'Abgelehnt' };
  const APPEAL_STATUS = { pending: 'Wird geprüft', accepted: 'Angenommen', rejected: 'Abgelehnt' };

  const PAGES = {
    start: { title: 'Start', render: renderStart },
    vorschlaege: { title: 'Vorschläge', render: renderSuggestions },
    abstimmungen: { title: 'Abstimmungen', render: renderPolls },
    einspruch: { title: 'Einspruch', render: renderAppeal },
    regeln: { title: 'Regeln & Infos', render: renderRules },
    admin: { title: 'Admin', render: renderAdmin, admin: true }
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

  function toast(message, kind) {
    toastBox.textContent = message;
    toastBox.className = 'toast show ' + (kind || '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastBox.className = 'toast'; }, 4200);
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
      toast('Kopieren nicht möglich - bitte markieren und kopieren.', 'error');
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
        location.hash = '#/start';
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
      h('h3', {}, 'Anmelden mit GitHub'),
      link
        ? h('div', { class: 'stack' },
          h('p', { class: 'muted', style: 'margin:0' }, `Verknüpft mit @${link.github_login || 'GitHub'} – du kannst dich ohne Code aus dem Spiel anmelden.`),
          h('button', {
            class: 'btn small danger',
            onclick: (event) => { if (confirm('GitHub-Verknüpfung lösen?')) act(event.currentTarget, () => rpc('unlink_github', { p_token: state.token }), 'Verknüpfung gelöst.'); }
          }, 'Verknüpfung lösen'))
        : h('div', { class: 'stack' },
          h('p', { class: 'muted', style: 'margin:0' }, 'Verknüpfe einmal dein GitHub-Konto, dann brauchst du beim nächsten Mal keinen Code aus dem Spiel.'),
          h('button', { class: 'btn', onclick: () => startGithub('link') }, 'GitHub verknüpfen')));
  }

  async function logout() {
    try { await rpc('logout', { p_token: state.token }); } catch { /* token is dropped locally anyway */ }
    clearSession();
    location.hash = '';
    route();
  }

  // ---------------------------------------------------------------- Navigation

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
    nav.replaceChildren(...pages.map((page) =>
      h('a', { href: '#/' + page, class: page === active ? 'active' : null }, PAGES[page].title)));
    userBox.hidden = !state.me;
    if (state.me) {
      userBox.replaceChildren(...[
        head(state.me.uuid, 28),
        h('span', {}, state.me.name),
        state.me.is_admin ? h('span', { class: 'badge done' }, 'Admin') : null,
        h('button', { class: 'btn small', onclick: logout }, 'Abmelden')
      ].filter(Boolean));
    }
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
      app.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Das hat nicht geklappt'), h('p', { class: 'muted' }, error.message),
        h('button', { class: 'btn', onclick: route }, 'Nochmal versuchen')));
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
    const button = h('button', { class: 'btn primary', type: 'submit' }, 'Anmelden');
    const form = h('form', {
      class: 'card stack',
      onsubmit: async (event) => {
        event.preventDefault();
        button.disabled = true;
        try { await login(input.value); } catch (error) { toast(error.message, 'error'); } finally { button.disabled = false; }
      }
    },
    h('label', {}, 'Login-Code'), input, button,
    CONFIG.githubLogin === false ? null : h('div', { class: 'stack', style: 'margin-top:14px;padding-top:14px;border-top:1px solid var(--border)' },
      h('button', { class: 'btn', type: 'button', onclick: () => startGithub('login') }, 'Mit GitHub anmelden'),
      h('p', { class: 'muted small', style: 'margin:0' }, 'Klappt, sobald du dein GitHub-Konto einmal mit deinem Spieler verknüpft hast.')));

    const status = h('p', { class: 'muted small' }, 'Serverstatus wird geladen …');
    rpc('get_status', { p_token: null }).then((s) => {
      status.textContent = s.online ? `Server online · ${s.player_count} Spieler` : 'Server gerade offline';
    }).catch(() => { status.textContent = ''; });

    return h('section', { class: 'login' },
      h('h1', {}, CONFIG.serverName),
      h('p', { class: 'muted' }, 'Portal für Vorschläge, Abstimmungen und Ban-Einsprüche.'),
      form,
      h('div', { class: 'card' },
        h('h3', {}, 'So bekommst du deinen Code'),
        h('ol', {},
          h('li', {}, 'Auf den Server joinen.'),
          h('li', {}, 'Im Chat ', h('span', { class: 'kbd' }, '/weblogin'), ' eingeben.'),
          h('li', {}, 'Den Code hier eintragen – oder im Chat einfach draufklicken.')),
        h('p', { class: 'muted small' }, 'Gebannt? Dann steht dein Code direkt im Bann-Bildschirm, wenn du versuchst zu joinen.')),
      status);
  }

  // ---------------------------------------------------------------- Start

  async function renderStart() {
    const [s, githubLink] = await Promise.all([
      rpc('get_status', { p_token: state.token }),
      CONFIG.githubLogin === false ? null : rpc('my_github', { p_token: state.token }).catch(() => null)
    ]);
    state.refreshTimer = setTimeout(() => { if (currentPage() === 'start' && !document.querySelector('input:focus, textarea:focus')) refresh(); }, 60000);

    const players = (s.players || []).map((p) => h('span', { class: 'player' }, head(p.uuid, 20), p.name));
    const statusCard = h('div', { class: 'card' },
      h('div', { class: 'status-line' }, h('span', { class: 'dot ' + (s.online ? 'on' : 'off') }), s.online ? 'Online' : 'Offline'),
      h('p', { class: 'muted', style: 'margin:6px 0 0' },
        s.online ? `${s.player_count} von ${s.max_players} Spielern online` : 'Der Server ist gerade nicht erreichbar.',
        s.version ? ` · Minecraft ${s.version}` : ''),
      s.online && players.length ? h('div', { class: 'players' }, players) : null,
      s.updated_at ? h('p', { class: 'muted small', style: 'margin:12px 0 0' }, 'Stand: ' + formatDate(s.updated_at)) : null);

    const address = s.address && s.game_port ? `${s.address}:${s.game_port}` : null;
    const addressCard = h('div', { class: 'card' },
      h('h3', {}, 'Server-Adresse'),
      address
        ? h('div', { class: 'address' }, h('code', {}, address), h('button', { class: 'btn', onclick: () => copy(address) }, 'Kopieren'))
        : h('p', { class: 'muted' }, 'Die Adresse wird angezeigt, sobald der Server online ist.'),
      h('p', { class: 'muted small', style: 'margin:10px 0 0' }, 'Nur für Spieler auf der Whitelist. Bitte nicht öffentlich teilen.'));

    const mapUrl = s.address && s.map_port ? `http://${s.address}:${s.map_port}/` : null;
    const mapCard = h('div', { class: 'card map-card' },
      h('div', {}, h('h3', {}, 'Weltkarte'), h('p', { class: 'muted' }, '3D-Karte der Welt – ohne Spielerstandorte. Läuft direkt auf dem Server.')),
      mapUrl
        ? h('div', { class: 'stack' },
          h('a', { class: 'btn primary', href: mapUrl, target: '_blank', rel: 'noopener' }, 'Karte öffnen ↗'),
          h('p', { class: 'muted small', style: 'margin:0' }, 'Im selben Heimnetz wie der Server? Dann ',
            h('a', { href: `http://localhost:${s.map_port}/`, target: '_blank', rel: 'noopener' }, `localhost:${s.map_port}`), ' nutzen.'))
        : h('p', { class: 'muted small' }, 'Die Karte ist nur erreichbar, wenn der Server online ist.'));

    return h('div', {},
      h('div', { class: 'section-head' }, h('h1', {}, `Hallo, ${state.me.name}!`)),
      h('div', { class: 'grid' }, statusCard, addressCard, mapCard),
      h('div', { class: 'grid', style: 'margin-top:18px' },
        h('a', { class: 'card', href: '#/vorschlaege', style: 'text-decoration:none;color:inherit' },
          h('h3', {}, 'Vorschläge →'), h('p', { class: 'muted', style: 'margin:0' }, 'Ideen für den Server einreichen und abstimmen.')),
        h('a', { class: 'card', href: '#/abstimmungen', style: 'text-decoration:none;color:inherit' },
          h('h3', {}, 'Abstimmungen →'), h('p', { class: 'muted', style: 'margin:0' }, 'Bei Server-Entscheidungen mitbestimmen.')),
        githubCard(githubLink)));
  }

  // ---------------------------------------------------------------- Vorschlaege

  async function renderSuggestions() {
    const list = await rpc('list_suggestions', { p_token: state.token });

    const title = h('input', { maxlength: '80', placeholder: 'Kurzer Titel, z. B. „Shop-Viertel am Spawn“' });
    const body = h('textarea', { maxlength: '1500', placeholder: 'Beschreibe deine Idee (optional)' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Vorschlag einreichen');
    const form = h('form', {
      class: 'card stack',
      onsubmit: (event) => {
        event.preventDefault();
        act(submit, () => rpc('create_suggestion', { p_token: state.token, p_title: title.value, p_body: body.value }), 'Danke für deinen Vorschlag!');
      }
    }, h('h2', {}, 'Neuer Vorschlag'), h('div', {}, h('label', {}, 'Titel'), title), h('div', {}, h('label', {}, 'Beschreibung'), body),
      h('div', { class: 'row' }, submit, h('span', { class: 'muted small' }, 'Max. 5 Vorschläge pro Tag.')));

    const filters = [['all', 'Alle'], ['open', 'Offen'], ['accepted', 'Angenommen'], ['done', 'Umgesetzt'], ['rejected', 'Abgelehnt']];
    const filterBar = h('div', { class: 'row' }, filters.map(([key, label]) => {
      const count = key === 'all' ? list.length : list.filter((s) => s.status === key).length;
      return h('button', {
        class: 'btn small' + (state.filter === key ? ' primary' : ''),
        onclick: () => { state.filter = key; refresh(); }
      }, `${label} (${count})`);
    }));

    const shown = list.filter((s) => state.filter === 'all' || s.status === state.filter);
    return h('div', {},
      h('div', { class: 'section-head' }, h('h1', {}, 'Vorschläge'), filterBar),
      form,
      shown.length ? shown.map(suggestionCard) : h('div', { class: 'empty' }, 'Noch keine Vorschläge in dieser Ansicht.'));
  }

  function suggestionCard(s) {
    const vote = (value) => (event) => {
      const next = s.my_vote === value ? 0 : value;
      act(event.currentTarget, () => rpc('vote_suggestion', { p_token: state.token, p_id: s.id, p_value: next }));
    };
    const card = h('article', { class: 'card suggestion' },
      h('div', { class: 'vote' },
        h('button', { class: 'up' + (s.my_vote === 1 ? ' active' : ''), title: 'Dafür', 'aria-label': 'Dafür', onclick: vote(1) }, '▲'),
        h('span', { class: 'score', title: `${s.up} dafür, ${s.down} dagegen` }, s.score),
        h('button', { class: 'down' + (s.my_vote === -1 ? ' active' : ''), title: 'Dagegen', 'aria-label': 'Dagegen', onclick: vote(-1) }, '▼')),
      h('div', {},
        h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, s.title), h('span', { class: 'badge ' + s.status }, SUGGESTION_STATUS[s.status])),
        h('div', { class: 'meta' }, `von ${s.author} · ${formatDate(s.created_at)} · ${s.up} dafür, ${s.down} dagegen`),
        s.body ? h('div', { class: 'body' }, s.body) : null,
        s.admin_note ? h('div', { class: 'admin-note' }, h('strong', {}, 'Admin: '), s.admin_note) : null,
        state.me.is_admin ? suggestionAdminTools(s) : null));
    return card;
  }

  function suggestionAdminTools(s) {
    const status = h('select', { 'aria-label': 'Status' },
      Object.entries(SUGGESTION_STATUS).map(([key, label]) => {
        const option = h('option', { value: key }, label);
        option.selected = key === s.status;
        return option;
      }));
    const note = h('input', { maxlength: '500', placeholder: 'Antwort / Notiz (optional)', value: s.admin_note || '' });
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
      h('div', { class: 'section-head' }, h('h1', {}, 'Abstimmungen')),
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
        onclick: (event) => act(event.currentTarget, () => rpc('vote_poll', { p_token: state.token, p_poll_id: p.id, p_option: index }), 'Stimme gespeichert.')
      },
      h('span', { class: 'fill', style: `width:${pct}%` }),
      h('span', { class: 'label' }, h('span', {}, (p.my_vote === index ? '✔ ' : '') + label), h('span', { class: 'pct' }, `${count} · ${pct}%`)));
    });
    const meta = [`von ${p.created_by}`, formatDate(p.created_at), `${total} Stimme${total === 1 ? '' : 'n'}`];
    if (p.closes_at) meta.push((p.open ? 'endet ' : 'endete ') + formatDate(p.closes_at));
    return h('article', { class: 'card' },
      h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, p.question), h('span', { class: 'badge ' + (p.open ? 'accepted' : 'closed') }, p.open ? 'Läuft' : 'Beendet')),
      h('div', { class: 'muted small' }, meta.join(' · ')),
      options,
      p.open ? h('p', { class: 'muted small', style: 'margin:10px 0 0' }, 'Du kannst deine Stimme ändern, solange die Abstimmung läuft.') : null,
      state.me.is_admin ? h('div', { class: 'row', style: 'margin-top:12px' },
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
    return h('details', { class: 'card' },
      h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Neue Abstimmung (Admin)'),
      h('form', {
        class: 'stack', style: 'margin-top:12px',
        onsubmit: (event) => {
          event.preventDefault();
          const list = options.value.split('\n').map((line) => line.trim()).filter(Boolean);
          const closesAt = closes.value ? new Date(closes.value).toISOString() : null;
          act(submit, () => rpc('admin_create_poll', { p_token: state.token, p_question: question.value, p_options: list, p_closes_at: closesAt }), 'Abstimmung gestartet.');
        }
      },
      h('div', {}, h('label', {}, 'Frage'), question),
      h('div', {}, h('label', {}, 'Antworten (eine pro Zeile, 2–10)'), options),
      h('div', {}, h('label', {}, 'Endet am (optional)'), closes),
      submit));
  }

  // ---------------------------------------------------------------- Einspruch

  async function renderAppeal() {
    if (!state.me.banned) {
      return h('div', {},
        h('div', { class: 'section-head' }, h('h1', {}, 'Ban-Einspruch')),
        h('div', { class: 'card' },
          h('p', {}, 'Du bist nicht gebannt – hier gibt es für dich nichts zu tun.'),
          h('p', { class: 'muted', style: 'margin:0' }, 'So funktioniert ein Einspruch: Wer gebannt ist, sieht beim Join-Versuch im Bann-Bildschirm einen Code. ' +
            'Mit diesem Code meldet man sich hier an und kann den Einspruch schreiben. Wird er angenommen, wird man automatisch entbannt.')));
    }
    const appeals = await rpc('my_appeals', { p_token: state.token });
    const hasPending = appeals.some((a) => a.status === 'pending');

    const message = h('textarea', { maxlength: '2000', placeholder: 'Erkläre in Ruhe, was passiert ist und warum du entbannt werden solltest (mind. 20 Zeichen).' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Einspruch absenden');
    const form = h('form', {
      class: 'card stack',
      onsubmit: (event) => {
        event.preventDefault();
        act(submit, () => rpc('create_appeal', { p_token: state.token, p_message: message.value }), 'Einspruch abgeschickt.');
      }
    }, h('h2', {}, 'Einspruch schreiben'), message, submit);

    return h('div', {},
      h('div', { class: 'section-head' }, h('h1', {}, 'Ban-Einspruch')),
      h('div', { class: 'card' },
        h('h3', {}, 'Dein Bann'),
        state.me.ban_reason ? h('div', { class: 'quote' }, state.me.ban_reason) : h('p', { class: 'muted' }, 'Kein Grund angegeben.')),
      hasPending ? null : form,
      appeals.map((a) => h('article', { class: 'card' },
        h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, `Einspruch vom ${formatDate(a.created_at)}`), h('span', { class: 'badge ' + a.status }, APPEAL_STATUS[a.status])),
        h('div', { class: 'quote', style: 'margin-top:10px' }, a.message),
        a.admin_response ? h('div', { class: 'admin-note' }, h('strong', {}, 'Antwort: '), a.admin_response) : null,
        a.status === 'accepted' ? h('p', { class: 'muted small', style: 'margin:10px 0 0' }, 'Du wirst automatisch entbannt, sobald der Server online ist.') : null)));
  }

  // ---------------------------------------------------------------- Regeln

  async function renderRules() {
    return h('div', {},
      h('div', { class: 'section-head' }, h('h1', {}, 'Regeln & Infos')),
      h('div', { class: 'grid' },
        h('div', { class: 'card' }, h('h2', {}, 'Regeln'), h('ol', { class: 'plain' }, (CONFIG.rules || []).map((rule) =>
          typeof rule === 'string' ? h('li', {}, rule) : h('li', {}, h('strong', {}, rule.title), h('br'), rule.text)))),
        h('div', { class: 'card' }, h('h2', {}, 'Gut zu wissen'), h('ul', { class: 'plain' }, (CONFIG.info || []).map((line) => h('li', {}, line))))));
  }

  // ---------------------------------------------------------------- Admin

  async function renderAdmin() {
    const appeals = await rpc('admin_list_appeals', { p_token: state.token });
    const pending = appeals.filter((a) => a.status === 'pending').length;
    return h('div', {},
      h('div', { class: 'section-head' }, h('h1', {}, 'Admin'), h('span', { class: 'muted' }, `${pending} offene Einsprüche`)),
      h('p', { class: 'muted' }, 'Vorschläge bearbeitest du direkt unter „Vorschläge“, Abstimmungen startest du unter „Abstimmungen“.'),
      h('h2', {}, 'Ban-Einsprüche'),
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
    return h('article', { class: 'card' },
      h('div', { class: 'row' }, head(a.uuid, 24), h('h3', { style: 'margin:0' }, a.name), h('span', { class: 'badge ' + a.status }, APPEAL_STATUS[a.status]),
        h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, formatDate(a.created_at))),
      a.ban_reason ? h('div', { style: 'margin-top:12px' }, h('div', { class: 'muted small' }, 'Bann-Bildschirm'), h('div', { class: 'quote' }, a.ban_reason)) : null,
      h('div', { style: 'margin-top:12px' }, h('div', { class: 'muted small' }, 'Einspruch'), h('div', { class: 'quote' }, a.message)),
      a.status === 'pending'
        ? h('div', { class: 'stack', style: 'margin-top:12px' }, response,
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onclick: decide(true) }, 'Annehmen & entbannen'),
            h('button', { class: 'btn danger', onclick: decide(false) }, 'Ablehnen')))
        : h('p', { class: 'muted small', style: 'margin:12px 0 0' },
          `Entschieden von ${a.decided_by || '?'} am ${formatDate(a.decided_at)}` + (a.status === 'accepted' ? (a.unban_done ? ' · entbannt' : ' · Entbannung wartet auf den Server') : ''),
          a.admin_response ? h('span', {}, h('br'), 'Antwort: ' + a.admin_response) : null));
  }

  // ---------------------------------------------------------------- Start

  async function init() {
    document.getElementById('brand-name').textContent = CONFIG.serverName || 'Server';
    document.title = CONFIG.serverName || 'Server';
    window.addEventListener('hashchange', route);

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
