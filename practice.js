// Übungs-Börse für den Rundgang: dieselben Regeln wie die market_*-Funktionen in schema.sql,
// aber nur im Browser und mit zwei Übungs-Spielern, die von selbst antworten. Nichts davon landet in der Datenbank.
window.PracticeMarket = function PracticeMarket(me) {
  'use strict';

  const STEVE = { uuid: 'MHF_Steve', name: 'Steve (Übung)' };
  const ALEX = { uuid: 'MHF_Alex', name: 'Alex (Übung)' };
  const BOTS = [STEVE, ALEX];
  // fixed ids, the tour points at these entries
  const IDS = { elytra: 9001, obsidian: 9002, apples: 9003, sharpness: 9004, pearls: 9011, netherite: 9012 };

  const now = () => new Date().toISOString();
  const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
  const fail = (message) => { throw new Error(message); };
  const botFor = (uuid) => BOTS.find((b) => b.uuid === uuid) || null;

  let nextId = 20000;
  const listing = (id, kind, bot, title, category, quantity, price, priceType, urgency, description, age) => ({
    id, kind, uuid: bot.uuid, name: bot.name, title, category, quantity, price, price_type: priceType,
    urgency, description, status: 'open', created_at: minsAgo(age), updated_at: minsAgo(age)
  });
  const listings = [
    listing(IDS.elytra, 'sell', STEVE, 'Elytra', 'ruestung', 1, 20, 'fixed', 0, 'Aus der Endstadt, kaum benutzt.', 12),
    listing(IDS.obsidian, 'sell', ALEX, 'Obsidian', 'materialien', 64, 8, 'vb', 0, 'Frisch abgebaut. Preis verhandelbar.', 25),
    listing(IDS.apples, 'sell', STEVE, 'Goldene Äpfel', 'essen', 16, 10, 'fixed', 0, '', 90),
    listing(IDS.sharpness, 'sell', ALEX, 'Schärfe V', 'verzauberung', 1, null, 'vb', 0, 'Buch. Macht mir ein Angebot.', 300),
    listing(IDS.pearls, 'buy', STEVE, 'Enderperle', 'spezial', 16, 6, 'vb', 2, 'Für mein Endportal.', 18),
    listing(IDS.netherite, 'buy', ALEX, 'Netherite-Barren', 'erze', 2, 30, 'vb', 3, '', 60)
  ];
  const deals = [];
  const messages = [];
  const listeners = new Set();
  const timers = new Set();

  const active = (d) => d.status === 'open' || d.status === 'agreed';
  const listingOf = (d) => listings.find((l) => l.id === d.listing_id);
  const touch = (x) => { x.updated_at = now(); };
  const post = (deal, who, kind, price, body) => messages.push({
    id: nextId++, deal_id: deal.id, uuid: who ? who.uuid : null, name: who ? who.name : null,
    kind, price: price ?? null, body: body || '', created_at: now()
  });
  const checkPrice = (p) => {
    if (p == null || !Number.isInteger(p) || p < 0 || p > 100000) fail('Bitte einen Preis zwischen 0 und 100000 Diamanten angeben.');
  };
  const lockDeal = (id) => {
    const d = deals.find((x) => x.id === id);
    if (!d || (d.uuid !== me.uuid && listingOf(d).uuid !== me.uuid)) fail('Handel nicht gefunden.');
    return d;
  };
  const pending = () => deals.filter((d) => {
    const l = listingOf(d);
    return (d.uuid === me.uuid || l.uuid === me.uuid) && ((d.status === 'open' && d.last_by !== me.uuid) || d.status === 'agreed');
  }).length;

  function emit(event) {
    for (const listener of listeners) listener(event);
  }

  // user actions are reported after the call has returned, so the page can re-render first
  function report(type, l, extra) {
    later(() => emit({ type, listingId: l.id, kind: l.kind, ...extra }), 0);
  }

  function later(fn, ms) {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
    timers.add(timer);
  }

  function agree(d, l, by) {
    d.status = 'agreed'; touch(d);
    l.status = 'reserved'; touch(l);
    post(d, null, 'system', null, `${by.name} hat ${d.price} Diamanten angenommen. Trefft euch im Spiel zur Übergabe.`);
    for (const other of deals.filter((x) => x.listing_id === l.id && x.id !== d.id && x.status === 'open')) {
      post(other, null, 'system', null, 'Mit jemand anderem wurde ein Deal abgeschlossen.');
      other.status = 'declined'; touch(other);
    }
  }

  // ---------------------------------------------------------------- Übungs-Spieler

  // the player made an offer or counter-offer to a bot: accept if it is close enough, otherwise meet in the middle
  function botAnswers(dealId) {
    later(() => {
      const d = deals.find((x) => x.id === dealId);
      if (!d || d.status !== 'open' || d.last_by !== me.uuid) return;
      const l = listingOf(d);
      const bot = botFor(l.uuid === me.uuid ? d.uuid : l.uuid);
      if (!bot) return;
      const botSells = l.kind === 'sell' ? l.uuid === bot.uuid : d.uuid === bot.uuid;
      const wish = l.price ?? (botSells ? 12 : 8);
      const ok = botSells ? d.price >= wish * 0.9 : d.price <= wish * 1.1;
      const counted = messages.filter((m) => m.deal_id === d.id && m.kind === 'offer' && m.uuid === bot.uuid).length;
      if (ok || counted >= 1) {
        agree(d, l, bot);
        post(d, bot, 'text', null, 'Abgemacht! Wir sehen uns am Spawn.');
        emit({ type: 'bot', action: 'accept', listingId: l.id, kind: l.kind, bot: bot.name });
        return;
      }
      const price = botSells ? Math.ceil((d.price + wish) / 2) : Math.floor((d.price + wish) / 2);
      d.price = price; d.last_by = bot.uuid; touch(d);
      post(d, bot, 'offer', price);
      post(d, bot, 'text', null, botSells ? `Für ${price} kannst du es haben.` : `Ich zahle dir ${price}, passt das?`);
      emit({ type: 'bot', action: 'counter', listingId: l.id, kind: l.kind, bot: bot.name });
    }, 2600);
  }

  // a new entry of the player: Alex wants to buy, Steve can deliver
  function botReactsToListing(l) {
    later(() => {
      if (l.status !== 'open') return;
      const bot = l.kind === 'sell' ? ALEX : STEVE;
      const d = { id: nextId++, listing_id: l.id, uuid: bot.uuid, name: bot.name, status: 'open', price: null, last_by: bot.uuid, created_at: now(), updated_at: now() };
      deals.push(d);
      if (l.kind === 'sell' && l.price_type === 'fixed') {
        d.price = l.price;
        d.status = 'agreed';
        l.status = 'reserved'; touch(l);
        post(d, null, 'system', null, `${bot.name} kauft zum Festpreis von ${l.price} Diamanten. Trefft euch im Spiel zur Übergabe.`);
        post(d, bot, 'text', null, 'Gekauft! Wann kann ich es abholen?');
        emit({ type: 'bot', action: 'buy', listingId: l.id, kind: l.kind, bot: bot.name });
        return;
      }
      const base = l.price ?? 10;
      d.price = l.kind === 'sell' ? Math.max(1, Math.round(base * 0.8)) : base;
      post(d, bot, 'offer', d.price);
      post(d, bot, 'text', null, l.kind === 'sell' ? 'Würde ich nehmen, geht das?' : 'Hab ich da, kann ich dir bringen.');
      emit({ type: 'bot', action: 'offer', listingId: l.id, kind: l.kind, bot: bot.name });
    }, 3200);
  }

  function botSaysThanks(d) {
    const l = listingOf(d);
    const bot = botFor(l.uuid === me.uuid ? d.uuid : l.uuid);
    if (!bot) return;
    later(() => {
      if (d.status !== 'agreed') return;
      post(d, bot, 'text', null, 'Super, bis gleich im Spiel!');
      emit({ type: 'bot', action: 'message', listingId: l.id, kind: l.kind, bot: bot.name });
    }, 1500);
  }

  // ---------------------------------------------------------------- Funktionen wie in der Datenbank

  const handlers = {
    market_list: ({ p_kind }) => listings
      .filter((l) => l.kind === p_kind && (l.status === 'open' || l.status === 'reserved'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((l) => ({
        id: l.id, kind: l.kind, title: l.title, category: l.category, quantity: l.quantity, price: l.price,
        price_type: l.price_type, urgency: l.urgency, description: l.description, status: l.status,
        created_at: l.created_at, author: l.name, uuid: l.uuid, mine: l.uuid === me.uuid, can_remove: l.uuid === me.uuid,
        my_deal: (deals.find((d) => d.listing_id === l.id && d.uuid === me.uuid && active(d)) || {}).id ?? null,
        deal_count: deals.filter((d) => d.listing_id === l.id && active(d)).length
      })),

    market_create: (p) => {
      const title = (p.p_title || '').trim();
      const type = p.p_kind === 'buy' ? 'vb' : p.p_price_type;
      if (!['sell', 'buy'].includes(p.p_kind)) fail('Unbekannte Art von Eintrag.');
      if (title.length < 2 || title.length > 60) fail('Der Name des Items muss 2 bis 60 Zeichen lang sein.');
      if (!(window.MARKET_CATEGORIES || []).some(([id]) => id === p.p_category)) fail('Bitte eine Kategorie wählen.');
      if (!(p.p_quantity >= 1 && p.p_quantity <= 100000)) fail('Die Menge muss zwischen 1 und 100000 liegen.');
      if (!['fixed', 'vb'].includes(type)) fail('Bitte Festpreis oder VB wählen.');
      if (p.p_price != null && (p.p_price < 0 || p.p_price > 100000)) fail('Der Preis muss zwischen 0 und 100000 Diamanten liegen.');
      if (type === 'fixed' && p.p_price == null) fail('Bei Festpreis brauchst du einen Preis.');
      const l = {
        id: nextId++, kind: p.p_kind, uuid: me.uuid, name: me.name, title, category: p.p_category, quantity: p.p_quantity,
        price: p.p_price, price_type: type, urgency: p.p_kind === 'buy' ? Math.min(Math.max(p.p_urgency || 0, 0), 3) : 0,
        description: (p.p_description || '').trim(), status: 'open', created_at: now(), updated_at: now()
      };
      listings.push(l);
      report('market_create', l);
      botReactsToListing(l);
      return l.id;
    },

    market_close: ({ p_id }) => {
      const l = listings.find((x) => x.id === p_id);
      if (!l || !['open', 'reserved'].includes(l.status) || l.uuid !== me.uuid) fail('Eintrag nicht gefunden oder schon beendet.');
      l.status = 'closed'; touch(l);
      for (const d of deals.filter((x) => x.listing_id === l.id && active(x))) {
        post(d, null, 'system', null, `${me.name} hat den Eintrag zurückgezogen.`);
        d.status = 'cancelled'; touch(d);
      }
      report('market_close', l);
      return null;
    },

    market_buy: ({ p_listing_id }) => {
      const l = listings.find((x) => x.id === p_listing_id);
      if (!l || l.kind !== 'sell' || l.price_type !== 'fixed') fail('Angebot nicht gefunden.');
      if (l.uuid === me.uuid) fail('Das ist dein eigenes Angebot.');
      if (l.status !== 'open') fail('Zu spät: Das Angebot ist schon reserviert oder verkauft.');
      const d = { id: nextId++, listing_id: l.id, uuid: me.uuid, name: me.name, status: 'agreed', price: l.price, last_by: me.uuid, created_at: now(), updated_at: now() };
      deals.push(d);
      l.status = 'reserved'; touch(l);
      post(d, null, 'system', null, `${me.name} kauft zum Festpreis von ${l.price} Diamanten. Trefft euch im Spiel zur Übergabe.`);
      report('market_buy', l, { dealId: d.id });
      botSaysThanks(d);
      return d.id;
    },

    market_offer: ({ p_listing_id, p_price, p_body }) => {
      const l = listings.find((x) => x.id === p_listing_id);
      if (!l || l.price_type !== 'vb') fail('Eintrag nicht gefunden.');
      if (l.uuid === me.uuid) fail('Das ist dein eigener Eintrag.');
      if (l.status !== 'open') fail('Zu spät: Hier steht schon ein Deal.');
      checkPrice(p_price);
      if (deals.some((d) => d.listing_id === l.id && d.uuid === me.uuid && active(d))) fail('Du verhandelst hier schon. Schau unter Meine Deals.');
      const d = { id: nextId++, listing_id: l.id, uuid: me.uuid, name: me.name, status: 'open', price: p_price, last_by: me.uuid, created_at: now(), updated_at: now() };
      deals.push(d);
      post(d, me, 'offer', p_price);
      if ((p_body || '').trim()) post(d, me, 'text', null, p_body.trim());
      report('market_offer', l, { dealId: d.id });
      botAnswers(d.id);
      return d.id;
    },

    market_counter: ({ p_deal_id, p_price }) => {
      const d = lockDeal(p_deal_id);
      if (d.status !== 'open') fail('Hier wird nicht mehr verhandelt.');
      checkPrice(p_price);
      d.price = p_price; d.last_by = me.uuid; touch(d);
      post(d, me, 'offer', p_price);
      report('market_counter', listingOf(d), { dealId: d.id });
      botAnswers(d.id);
      return null;
    },

    market_accept: ({ p_deal_id }) => {
      const d = lockDeal(p_deal_id);
      const l = listingOf(d);
      if (d.status !== 'open' || l.status !== 'open') fail('Hier wird nicht mehr verhandelt.');
      if (d.last_by === me.uuid) fail('Das ist dein eigenes Angebot. Warte auf die Antwort der anderen Seite.');
      agree(d, l, me);
      report('market_accept', l, { dealId: d.id });
      botSaysThanks(d);
      return null;
    },

    market_decline: ({ p_deal_id }) => {
      const d = lockDeal(p_deal_id);
      if (d.status !== 'open') fail('Hier wird nicht mehr verhandelt.');
      d.status = 'declined'; touch(d);
      post(d, null, 'system', null, d.uuid === me.uuid ? `${me.name} hat die Verhandlung beendet.` : `${me.name} hat abgelehnt.`);
      report('market_decline', listingOf(d), { dealId: d.id });
      return null;
    },

    market_cancel: ({ p_deal_id }) => {
      const d = lockDeal(p_deal_id);
      if (d.status !== 'agreed') fail('Hier gibt es keinen offenen Deal.');
      d.status = 'cancelled'; touch(d);
      const l = listingOf(d);
      if (l.status === 'reserved') { l.status = 'open'; touch(l); }
      post(d, null, 'system', null, `${me.name} hat den Deal abgebrochen. Der Eintrag ist wieder offen.`);
      report('market_cancel', l, { dealId: d.id });
      return null;
    },

    market_done: ({ p_deal_id }) => {
      const d = lockDeal(p_deal_id);
      if (d.status !== 'agreed') fail('Hier gibt es keinen offenen Deal.');
      d.status = 'done'; touch(d);
      const l = listingOf(d);
      if (l.status === 'reserved') { l.status = 'done'; touch(l); }
      post(d, null, 'system', null, `${me.name} hat die Übergabe bestätigt. Deal erledigt.`);
      report('market_done', l, { dealId: d.id });
      return null;
    },

    market_message: ({ p_deal_id, p_body }) => {
      const body = (p_body || '').trim();
      if (body.length < 1 || body.length > 500) fail('Eine Nachricht muss 1 bis 500 Zeichen lang sein.');
      const d = lockDeal(p_deal_id);
      if (!active(d)) fail('Dieser Handel ist beendet.');
      post(d, me, 'text', null, body);
      report('market_message', listingOf(d), { dealId: d.id });
      return null;
    },

    market_mine: () => ({
      pending: pending(),
      deals: deals
        .filter((d) => d.uuid === me.uuid || listingOf(d).uuid === me.uuid)
        .sort((a, b) => (active(b) - active(a)) || b.updated_at.localeCompare(a.updated_at))
        .map((d) => {
          const l = listingOf(d);
          const own = l.uuid === me.uuid;
          return {
            id: d.id, status: d.status, price: d.price, created_at: d.created_at, updated_at: d.updated_at,
            i_own_listing: own, last_by_me: d.last_by === me.uuid,
            partner: own ? d.name : l.name, partner_uuid: own ? d.uuid : l.uuid,
            listing: { id: l.id, kind: l.kind, title: l.title, category: l.category, quantity: l.quantity, price: l.price, price_type: l.price_type, status: l.status },
            messages: messages.filter((m) => m.deal_id === d.id)
              .map((m) => ({ kind: m.kind, price: m.price, body: m.body, author: m.name, mine: m.uuid === me.uuid, created_at: m.created_at }))
          };
        }),
      listings: listings.filter((l) => l.uuid === me.uuid)
        .sort((a, b) => ((b.status === 'open' || b.status === 'reserved') - (a.status === 'open' || a.status === 'reserved')) || b.created_at.localeCompare(a.created_at))
        .map((l) => ({
          id: l.id, kind: l.kind, title: l.title, category: l.category, quantity: l.quantity, price: l.price, price_type: l.price_type,
          urgency: l.urgency, status: l.status, created_at: l.created_at, description: l.description,
          deal_count: deals.filter((d) => d.listing_id === l.id && active(d)).length
        }))
    })
  };

  return {
    ids: IDS,
    call(fn, params) {
      const handler = handlers[fn];
      if (!handler) fail('Im Übungsmodus nicht verfügbar.');
      return handler(params || {});
    },
    // the player's latest deal on an entry (for the tour)
    dealFor(listingId) {
      return deals.filter((d) => d.listing_id === listingId && (d.uuid === me.uuid || listingOf(d).uuid === me.uuid))
        .sort((a, b) => b.id - a.id)[0] || null;
    },
    lastByMe(deal) { return deal.last_by === me.uuid; },
    on(listener) { listeners.add(listener); },
    stop() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      listeners.clear();
    }
  };
};
