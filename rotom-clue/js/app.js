/* Rotom Clue — interface joueur */
(function () {
  const C = window.RC, GEO = window.RC_GEO, H = window.RCHost;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = 'assets/';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };

  const cardSrc = (id) => {
    const [t, k] = id.split(':');
    if (t === 'r') return A + 'card_rotom_' + k + '.webp';
    if (t === 'i') return A + 'card_item_' + k + '.webp';
    if (t === 'm') return A + 'card_room_' + k + '.webp';
    if (t === 'g') return A + 'card_ghost_' + parseInt(k, 10) + '.webp';
    return A + 'card_back.webp';
  };
  const tokSrc = (k) => A + 'tok_' + k + '.webp';
  const rotomColor = (k) => (C.ROTOMS.find((r) => r.key === k) || {}).color || '#fff';

  // ---------------- état client ----------------
  let net = null, host = null, code = null, mode = 'online';
  let me = null, token = null;
  let S = null; // { pub, priv }
  let seenLog = 0, seenInbox = 0, firstState = true;
  let tab = 'hand', modalKind = null;
  let dragging = null;
  let noteTool = 'x';

  const client = {
    send: null,
    receive(msg) {
      if (msg.t === 'welcome') {
        me = msg.id; token = msg.token;
        store.sset('rc-tok-' + code, token);
        if (host) store.set('rc-hosttok-' + code, token);
      } else if (msg.t === 'state') {
        S = msg.state; render();
      } else if (msg.t === 'error') {
        toast(msg.text, true);
      }
    },
  };
  const act = (a) => client.send({ t: 'act', a });

  function setStatus(st) {
    const dot = $('#net-dot');
    if (dot) dot.classList.toggle('ok', st === 'connected');
    if (st === 'nohost' && !S) $('#home-msg').textContent = 'Partie introuvable… nouvel essai en cours (vérifie le code).';
  }

  // ---------------- accueil ----------------
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const genCode = () => Array.from({ length: 4 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

  function initHome() {
    const params = new URLSearchParams(location.search);
    $('#in-name').value = store.get('rc-name', '');
    if (params.get('join')) $('#in-code').value = params.get('join').toUpperCase();
    if (params.get('local')) $('#in-local').checked = true;
    const last = store.get('rc-last-host', null);
    const saved = last && store.get('rc-host-' + last, null);
    if (saved && saved.phase === 'playing') {
      const b = $('#btn-resume');
      b.textContent = `Reprendre ma partie ${last} (hôte)`;
      b.classList.remove('hidden');
      b.onclick = () => startHost(last, saved);
    }
    $('#btn-create').onclick = () => startHost(null, null);
    $('#btn-join').onclick = () => startJoin();
    $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') startJoin(); });
    if (params.get('join')) $('#in-name').focus();
  }
  function readName() {
    const n = $('#in-name').value.trim();
    if (!n) { $('#home-msg').textContent = 'Entre d\'abord ton pseudo.'; $('#in-name').focus(); return null; }
    store.set('rc-name', n);
    return n;
  }

  async function startHost(resumeCode, saved) {
    const name = readName(); if (!name) return;
    mode = $('#in-local').checked ? 'local' : 'online';
    if (mode === 'online' && !window.Peer) { $('#home-msg').textContent = 'La librairie réseau n\'a pas pu se charger.'; return; }
    $('#home-msg').textContent = 'Création de la partie…';
    for (let attempt = 0; attempt < 4; attempt++) {
      code = resumeCode || genCode();
      net = new RCNet.HostNet(code, mode, (cid, m) => host.handle(cid, m), (cid) => host.disconnect(cid));
      try { await net.start(); break; } catch (e) {
        if (resumeCode) { $('#home-msg').textContent = 'Impossible de reprendre : ' + e.message; return; }
        if (attempt === 3) { $('#home-msg').textContent = 'Connexion impossible : ' + (e.message || e.type); return; }
      }
    }
    host = new H.Host(code, net, saved);
    host.selfClient = client;
    const loop = new RCNet.LoopNet(host);
    client.send = (m) => loop.send(m);
    token = saved ? store.get('rc-hosttok-' + code, null) : null;
    client.send({ t: 'hello', name, token });
    enterGameUI();
  }

  function startJoin() {
    const name = readName(); if (!name) return;
    const c = $('#in-code').value.trim().toUpperCase();
    if (c.length < 4) { $('#home-msg').textContent = 'Entre le code de la partie.'; return; }
    mode = $('#in-local').checked ? 'local' : 'online';
    if (mode === 'online' && !window.Peer) { $('#home-msg').textContent = 'La librairie réseau n\'a pas pu se charger.'; return; }
    code = c;
    $('#home-msg').textContent = 'Connexion…';
    net = new RCNet.ClientNet(code, mode, (m) => client.receive(m), setStatus);
    client.send = (m) => net.send(m);
    net.start();
    token = store.sget('rc-tok-' + code);
    client.send({ t: 'hello', name, token });
    enterGameUI();
  }

  function enterGameUI() {
    history.replaceState(null, '', location.pathname + '?join=' + code + (mode === 'local' ? '&local=1' : ''));
    $('#game-code').textContent = code;
    if (host) setStatus('connected');
  }

  // ---------------- rendu général ----------------
  function show(id) { ['home', 'lobby', 'game'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id)); }

  function render() {
    if (!S) return;
    const { pub } = S;
    if (pub.phase === 'lobby') { show('lobby'); renderLobby(); closeModal('refute'); }
    else { show('game'); renderGame(); }
    notifyNew();
  }

  function meP() { return S.pub.players.find((p) => p.id === me); }
  const PN = (id) => (S.pub.players.find((p) => p.id === id) || {}).name || '?';

  // ---------------- salon ----------------
  function renderLobby() {
    const { pub } = S;
    $('#lobby-code').textContent = pub.code;
    const link = location.origin + location.pathname + '?join=' + pub.code + (mode === 'local' ? '&local=1' : '');
    $('#lobby-link').textContent = link;
    $('#btn-copy').onclick = () => copy(link);
    const mine = meP();
    $('#rotom-pick').innerHTML = C.ROTOMS.map((r) => {
      const owner = pub.players.find((p) => p.rotom === r.key);
      const cls = owner ? (owner.id === me ? 'mine' : 'taken') : '';
      return `<button data-r="${r.key}" class="${cls}" title="${esc(r.name)}"><img src="${tokSrc(r.key)}" alt=""><span class="who">${owner ? esc(owner.name) : esc(r.name.replace('Rotom ', ''))}</span></button>`;
    }).join('');
    $$('#rotom-pick button').forEach((b) => (b.onclick = () => act({ type: 'pickRotom', rotom: b.dataset.r })));
    $('#lobby-count').textContent = `(${pub.players.length}/${C.MAX_PLAYERS})`;
    const isHost = me === pub.hostId;
    $('#lobby-players').innerHTML = pub.players.map((p) => `
      <li><img src="${p.rotom ? tokSrc(p.rotom) : A + 'ghost_token.webp'}" alt="">
      <span class="nm">${esc(p.name)}${p.id === me ? ' (toi)' : ''}</span>
      ${p.id === pub.hostId ? '<span class="tag">hôte</span>' : ''}
      ${!p.connected ? '<span class="tag">déconnecté</span>' : ''}
      ${isHost && p.id !== me ? `<button class="btn tiny ghost" data-kick="${p.id}">retirer</button>` : ''}</li>`).join('');
    $$('[data-kick]').forEach((b) => (b.onclick = () => act({ type: 'kick', id: b.dataset.kick })));
    $('#btn-start').classList.toggle('hidden', !isHost);
    $('#lobby-wait').classList.toggle('hidden', isHost);
    $('#btn-start').disabled = pub.players.length < C.MIN_PLAYERS;
    $('#btn-start').textContent = pub.players.length < C.MIN_PLAYERS ? `En attente de joueurs (min. ${C.MIN_PLAYERS})` : 'Lancer la partie';
    $('#btn-start').onclick = () => act({ type: 'start' });
    if (!mine) return;
  }

  // ---------------- jeu ----------------
  function renderGame() {
    renderBoard();
    renderTurn();
    renderTab();
    const pr = S.priv && S.priv.refute;
    if (pr && pr.options.length) openRefute(pr);
    else closeModal('refute');
    if (S.pub.phase === 'ended' && modalKind !== 'end' && !renderGame._endShown) { renderGame._endShown = true; openEnd(); }
    if (S.pub.phase !== 'ended') renderGame._endShown = false;
  }

  // ----- plateau -----
  let boardBuilt = false;
  function buildBoard() {
    const rooms = $('#rooms');
    rooms.innerHTML = '';
    C.ROOMS.forEach((r) => {
      [1, 2].forEach((v) => {
        const g = GEO[r.key][v];
        const img = document.createElement('img');
        img.src = A + g.src; img.dataset.room = r.key; img.dataset.v = v; img.alt = '';
        Object.assign(img.style, { left: g.x * 100 + '%', top: g.y * 100 + '%', width: g.w * 100 + '%', height: g.h * 100 + '%' });
        rooms.appendChild(img);
      });
      const g = GEO[r.key][1];
      const b = document.createElement('div');
      b.className = 'room-ghosts'; b.dataset.room = r.key;
      Object.assign(b.style, { left: (g.x + g.w - 0.012) * 100 + '%', top: (g.y + 0.012) * 100 + '%' });
      rooms.appendChild(b);
    });
    const pb = $('#peebboof'), P = C.PEEBBOOF;
    Object.assign(pb.style, { left: P.x * 100 + '%', top: P.y * 100 + '%', width: P.w * 100 + '%', height: P.h * 100 + '%' });
    pb.onclick = () => openAccuse();
    boardBuilt = true;
  }

  function renderBoard() {
    if (!boardBuilt) buildBoard();
    const { pub } = S;
    $$('#rooms > img').forEach((img) => { img.style.display = pub.roomVar[img.dataset.room] === +img.dataset.v ? '' : 'none'; });
    $$('#rooms .room-ghosts').forEach((b) => {
      const n = pub.roomGhostCount[b.dataset.room] || 0;
      b.style.display = n ? '' : 'none';
      b.innerHTML = `<img src="${A}ghost_token.webp" alt="">${n}`;
    });
    const wrap = $('#tokens');
    const cur = pub.players.find((p) => p.id === pub.order[pub.turn]);
    const isHost = me === pub.hostId;
    for (const [k, pos] of Object.entries(pub.tokens)) {
      let el = wrap.querySelector(`[data-tok="${k}"]`);
      const [t, key] = k.split(':');
      if (!el) {
        el = document.createElement('div');
        el.className = 'tok' + (t === 'i' ? ' item' : '');
        el.dataset.tok = k;
        el.innerHTML = `<img src="${t === 'i' ? A + 'itok_' + key + '.webp' : tokSrc(key)}" alt="">`;
        wrap.appendChild(el);
        el.addEventListener('pointerdown', (e) => startDrag(e, el));
      }
      const owner = t === 'r' && pub.players.find((p) => p.rotom === key);
      el.classList.toggle('npc', t === 'r' && !owner);
      el.classList.toggle('turn', !!(owner && cur && owner.id === cur.id && pub.phase === 'playing'));
      el.style.setProperty('--tc', t === 'r' ? rotomColor(key) : '#fff');
      let nm = el.querySelector('.nm');
      if (owner) { if (!nm) { nm = document.createElement('span'); nm.className = 'nm'; el.appendChild(nm); } nm.textContent = owner.name; }
      else if (nm) nm.remove();
      const can = pub.phase === 'playing' && (isHost || (owner && owner.id === me && cur && cur.id === me));
      el.classList.toggle('can', !!can);
      el.title = t === 'r' ? H.rotomName(key) + (owner ? ' — ' + owner.name : '') : H.itemName(key);
      if (dragging !== el) { el.style.left = pos.x * 100 + '%'; el.style.top = pos.y * 100 + '%'; }
    }
  }

  function startDrag(e, el) {
    if (!el.classList.contains('can')) return;
    e.preventDefault();
    const board = $('#board');
    dragging = el;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = board.getBoundingClientRect();
      const x = Math.min(0.99, Math.max(0.01, (ev.clientX - r.left) / r.width));
      const y = Math.min(0.99, Math.max(0.01, (ev.clientY - r.top) / r.height));
      el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%';
      el._pos = [x, y];
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      dragging = null;
      if (el._pos) { act({ type: 'move', tok: el.dataset.tok, x: el._pos[0], y: el._pos[1] }); el._pos = null; }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ----- tour -----
  function renderTurn() {
    const { pub } = S;
    const box = $('#turnbox');
    if (pub.phase === 'ended') {
      const w = pub.players.find((p) => p.id === pub.winner);
      box.innerHTML = `<div class="turn-who me">${w ? '🏆 ' + esc(w.name) + ' a gagné !' : 'Partie terminée'}</div>
        <div class="hint">Solution : ${esc(H.rotomName(pub.peebboof.rotom))} · ${esc(H.itemName(pub.peebboof.item))} · ${esc(H.roomName(pub.peebboof.room))}</div>
        <div class="actions"><button class="btn small" id="b-sol">Voir la solution</button>${me === pub.hostId ? '<button class="btn small ghost" id="b-again">Nouvelle partie</button>' : ''}</div>`;
      $('#b-sol').onclick = openEnd;
      if ($('#b-again')) $('#b-again').onclick = () => act({ type: 'restart' });
      return;
    }
    const cur = pub.players.find((p) => p.id === pub.order[pub.turn]);
    const mine = cur && cur.id === me;
    const meNow = meP();
    let h = `<div class="turn-who ${mine ? 'me' : ''}"><img src="${tokSrc(cur.rotom)}" alt="">${mine ? 'À toi de jouer !' : 'Tour de ' + esc(cur.name)}</div>`;
    if (pub.dice) {
      h += `<div class="dice">${pub.dice.values.map((v) => `<span class="die">${v}</span>`).join('')} = <b>${pub.dice.sum}</b>
        <span class="hint">${mine ? 'déplace ton pion de ' + pub.dice.sum + ' cases (glisse-le sur le plateau)' : ''}</span></div>`;
    }
    const sg = pub.suggestion;
    if (sg) {
      h += `<div class="sugbox">🔎 <b>${esc(PN(sg.by))}</b> suggère <b>${esc(H.rotomName(sg.rotom))}</b> dans <b>${esc(H.roomName(sg.room))}</b> avec <b>${esc(H.itemName(sg.item))}</b><br>`;
      if (!sg.done) h += `⏳ ${esc(PN(sg.current))} choisit une carte à montrer…`;
      else h += sg.shownBy ? `✔ ${esc(PN(sg.shownBy))} a montré une carte à ${esc(PN(sg.by))}.` : '✖ Personne n\'a pu réfuter !';
      h += '</div>';
    }
    if (mine) {
      const room = meNow.room;
      const ps = room && C.PASSAGES[room];
      const passOpen = ps && pub.roomVar[room] === ps.openIn;
      h += `<div class="actions">
        <button class="btn" id="b-roll" ${pub.rolled ? 'disabled' : ''}>🎲 Lancer les dés</button>
        ${passOpen && !pub.rolled ? `<button class="btn" id="b-pass">🚪 Passage → ${esc(H.roomName(ps.to))}</button>` : ''}
        <button class="btn" id="b-sug" ${!room || pub.suggested || meNow.eliminated ? 'disabled' : ''}>🔎 Suggérer${room ? ' (' + esc(H.roomName(room)) + ')' : ''}</button>
        <button class="btn danger" id="b-acc" ${meNow.eliminated ? 'disabled' : ''}>⚖️ Accuser</button>
        <button class="btn ghost" id="b-end" ${sg && !sg.done ? 'disabled' : ''}>Fin du tour ➜</button></div>`;
      if (!room) h += '<div class="hint">Entre dans une pièce pour pouvoir faire une suggestion. Le Peebboof (au centre) sert à accuser.</div>';
    } else if (me === pub.hostId) {
      h += `<div class="actions"><button class="btn small ghost" id="b-skip">Passer le tour de ${esc(cur.name)} (hôte)</button></div>`;
    }
    h += `<div class="actions"><button class="btn small ghost" id="b-fx">👻 Effets des cartes fantômes…</button></div>`;
    box.innerHTML = h;
    const on = (id, f) => { const b = $('#' + id); if (b) b.onclick = f; };
    on('b-roll', () => act({ type: 'roll' }));
    on('b-pass', () => act({ type: 'passage' }));
    on('b-sug', openSuggest);
    on('b-acc', openAccuse);
    on('b-end', () => act({ type: 'endTurn' }));
    on('b-skip', () => confirmBox('Passer le tour ?', `Le tour de ${esc(cur.name)} sera terminé.`, () => act({ type: 'skip' })));
    on('b-fx', openEffects);
  }

  // ----- onglets -----
  $$('.tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderTab(); }));
  function renderTab() {
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    ['hand', 'notes', 'players', 'log'].forEach((t) => $('#pane-' + t).classList.toggle('hidden', t !== tab));
    if (tab === 'hand') renderHand();
    if (tab === 'notes') renderNotes();
    if (tab === 'players') renderPlayers();
    if (tab === 'log') renderLog();
  }

  const cardBtn = (id, extra = '') => `<button class="card ${extra}" data-card="${id}"><img src="${cardSrc(id)}" alt="${esc(H.cardName(id))}" title="${esc(H.cardName(id))}"></button>`;
  function bindZoom(root) { $$('[data-card]', root).forEach((b) => { if (!b.onclick) b.onclick = () => zoom(b.dataset.card); }); }

  function renderHand() {
    const pane = $('#pane-hand');
    const p = S.priv || { hand: [], ghostHand: [] };
    const mp = meP();
    const order = (id) => ['r', 'i', 'm'].indexOf(id[0]);
    const hand = [...p.hand].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    pane.innerHTML = `
      <h4>Mes cartes indices (${hand.length})</h4>
      <div class="cards">${hand.map((c) => cardBtn(c)).join('') || '<span class="empty">Aucune</span>'}</div>
      <p class="hint">Ces cartes ne peuvent PAS être dans le Peebboof : coche-les dans tes notes.</p>
      <h4>Mes cartes fantômes cachées (${p.ghostHand.length})</h4>
      <div class="cards">${p.ghostHand.map((c) => cardBtn(c)).join('') || '<span class="empty">Aucune — tu en pioches en entrant dans une pièce.</span>'}</div>
      <p class="hint">Quand quelqu'un lance le numéro d'une de tes cartes fantômes, elle se révèle automatiquement.</p>
      ${mp && mp.active.length ? `<h4>Mes fantômes actifs</h4>${activeGhosts(mp)}` : ''}`;
    bindZoom(pane); bindGhostBtns(pane);
  }

  function activeGhosts(p) {
    return `<div class="act-ghosts">${p.active.map((a) => `
      <div class="ag">${cardBtn(a.id)}
        <div class="gt"><img src="${A}ghost_token.webp" alt="">× ${a.tokens}</div>
        <div class="row"><button class="btn tiny ghost" data-gt="${p.id}|${a.id}|1">+</button><button class="btn tiny ghost" data-gt="${p.id}|${a.id}|-1">−</button>
        ${p.id === me || me === S.pub.hostId ? `<button class="btn tiny ghost" data-gr="${p.id}|${a.id}" title="Effet résolu : reprendre en main">↩</button>` : ''}</div>
      </div>`).join('')}</div>`;
  }
  function bindGhostBtns(root) {
    $$('[data-gt]', root).forEach((b) => (b.onclick = () => { const [owner, id, d] = b.dataset.gt.split('|'); act({ type: 'ghostToken', owner, id, delta: +d }); }));
    $$('[data-gr]', root).forEach((b) => (b.onclick = () => { const [owner, id] = b.dataset.gr.split('|'); act({ type: 'ghostReturn', owner, id }); }));
  }

  function renderPlayers() {
    const pane = $('#pane-players');
    const { pub } = S;
    const cur = pub.order[pub.turn];
    pane.innerHTML = `<div class="plist">${pub.order.map((id) => pub.players.find((p) => p.id === id)).map((p) => `
      <div class="prow ${p.id === cur ? 'turn' : ''} ${p.eliminated ? 'elim' : ''}">
        <div class="phead"><img src="${tokSrc(p.rotom)}" alt="">
          <span class="nm">${esc(p.name)}${p.id === me ? ' (toi)' : ''} ${p.id === pub.hostId ? '<span class="tag">hôte</span>' : ''}
          ${p.eliminated ? '<span class="tag">éliminé</span>' : ''} ${!p.connected ? '<span class="tag">hors ligne</span>' : ''}</span>
          <span class="cnt">${p.handCount} cartes<br>${p.ghostCount} fantôme${p.ghostCount > 1 ? 's' : ''} caché${p.ghostCount > 1 ? 's' : ''}</span>
        </div>
        ${p.active.length ? activeGhosts(p) : ''}
      </div>`).join('')}</div>
      <p class="hint">Les fantômes actifs sont visibles par tous. « + / − » ajoute ou retire un jeton fantôme, « ↩ » remet la carte dans la main de son propriétaire une fois l'effet résolu.</p>`;
    bindZoom(pane); bindGhostBtns(pane);
  }

  function renderLog() {
    const pane = $('#pane-log');
    const items = S.pub.log.map((l) => ({ n: l.n, html: `<div class="k-${l.kind}">${esc(l.text)}</div>` }))
      .concat(((S.priv && S.priv.inbox) || []).map((l) => ({ n: l.n, html: `<div class="priv">🔒 ${esc(l.text)}</div>` })));
    items.sort((a, b) => b.n - a.n);
    pane.innerHTML = `<div class="log">${items.map((i) => i.html).join('')}</div>`;
  }

  // ----- notes (fiche de l'enquêteur) -----
  const NB = { W: 1291, H: 2576, crop: 0.3067446, cols: [[438, 592], [598, 752], [760, 914], [920, 1074], [1082, 1236]], head: [836, 900],
    secs: [{ t: 'r', y: [932, 1275], keys: C.ROTOMS.map((r) => r.key) }, { t: 'i', y: [1403, 1845], keys: C.ITEMS.map((r) => r.key) }, { t: 'm', y: [1972, 2462], keys: C.ROOMS.map((r) => r.key) }] };
  const fx = (x) => (x / NB.W) * 100;
  const fy = (y) => ((y / NB.H - NB.crop) / (1 - NB.crop)) * 100;
  const notesKey = () => 'rc-notes-' + code + '-' + me;
  function renderNotes() {
    const wrap = $('#notes');
    const notes = store.get(notesKey(), {});
    const others = [];
    const i = S.pub.order.indexOf(me);
    for (let k = 1; k < S.pub.order.length; k++) others.push(S.pub.players.find((p) => p.id === S.pub.order[(i + k) % S.pub.order.length]));
    const tools = [['x', 'mark_x'], ['check', 'mark_check'], ['q', 'mark_q']];
    let h = `<div class="ntool">${tools.map(([k, img]) => `<button data-tool="${k}" class="${noteTool === k ? 'on' : ''}"><img src="${A}${img}.webp" alt="${k}"></button>`).join('')}
      <button data-tool="erase" class="txt ${noteTool === 'erase' ? 'on' : ''}">Gomme</button></div>`;
    h += `<div class="notes-sheet"><img class="nb" src="${A}notes.webp" alt="Fiche de notes" draggable="false">`;
    NB.cols.forEach(([x0, x1], c) => {
      const o = others[c];
      h += `<div class="nhead" style="left:${fx(x0)}%;width:${fx(x1) - fx(x0)}%;top:${fy(NB.head[0])}%;height:${fy(NB.head[1]) - fy(NB.head[0])}%">${o ? esc(o.name) : ''}</div>`;
    });
    NB.secs.forEach((sec) => {
      const rh = (sec.y[1] - sec.y[0]) / sec.keys.length;
      sec.keys.forEach((k, r) => {
        NB.cols.forEach(([x0, x1], c) => {
          const id = sec.t + ':' + k + ':' + c;
          const v = notes[id];
          const y0 = sec.y[0] + r * rh;
          h += `<button class="ncell" data-n="${id}" style="left:${fx(x0)}%;width:${fx(x1) - fx(x0)}%;top:${fy(y0)}%;height:${fy(y0 + rh) - fy(y0)}%">${v ? `<img src="${A}mark_${v}.webp" alt="">` : ''}</button>`;
        });
      });
    });
    h += '</div><p class="hint">Les colonnes correspondent aux autres joueurs, dans l\'ordre du tour. Tes notes restent sur ton appareil.</p>';
    wrap.innerHTML = h;
    $$('[data-tool]', wrap).forEach((b) => (b.onclick = () => { noteTool = b.dataset.tool; renderNotes(); }));
    $$('.ncell', wrap).forEach((b) => (b.onclick = () => {
      const n = store.get(notesKey(), {});
      const id = b.dataset.n;
      if (noteTool === 'erase' || n[id] === noteTool) delete n[id]; else n[id] = noteTool;
      store.set(notesKey(), n);
      b.innerHTML = n[id] ? `<img src="${A}mark_${n[id]}.webp" alt="">` : '';
    }));
  }

  // ---------------- fenêtres ----------------
  function openModal(kind, html, bind) {
    modalKind = kind;
    $('#modal-box').innerHTML = html;
    $('#modal').classList.remove('hidden');
    if (bind) bind($('#modal-box'));
  }
  function closeModal(kind) {
    if (kind && modalKind !== kind) return;
    modalKind = null;
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && modalKind !== 'refute') closeModal(); });

  function zoom(id) {
    openModal('zoom', `<img class="big-card" src="${cardSrc(id)}" alt=""><div class="modal-row"><button class="btn ghost" data-close>Fermer</button></div>`,
      (r) => ($('[data-close]', r).onclick = () => closeModal()));
  }

  function confirmBox(title, text, ok) {
    openModal('confirm', `<h2>${title}</h2><p>${text}</p><div class="modal-row"><button class="btn ghost" data-no>Annuler</button><button class="btn" data-yes>Confirmer</button></div>`,
      (r) => { $('[data-no]', r).onclick = () => closeModal(); $('[data-yes]', r).onclick = () => { closeModal(); ok(); }; });
  }

  function picker(groups, title, intro, okLabel, onOk, danger) {
    const sel = {};
    const html = `<h2>${title}</h2><p class="hint">${intro}</p>` + groups.map((g) => `
      <h4 style="margin:4px 0;font-family:var(--fell);font-weight:400;color:var(--accent);font-size:19px">${g.label}</h4>
      <div class="cards" data-g="${g.key}">${g.ids.map((id) => `<button class="card" data-pick="${id}"><img src="${cardSrc(id)}" alt="${esc(H.cardName(id))}"></button>`).join('')}</div>`).join('') +
      `<div class="modal-row"><button class="btn ghost" data-no>Annuler</button><button class="btn ${danger ? 'danger' : ''}" data-yes disabled>${okLabel}</button></div>`;
    openModal('picker', html, (r) => {
      const refresh = () => { $('[data-yes]', r).disabled = groups.some((g) => !sel[g.key]); };
      $$('[data-g]', r).forEach((grp) => $$('[data-pick]', grp).forEach((b) => (b.onclick = () => {
        sel[grp.dataset.g] = b.dataset.pick.split(':')[1];
        $$('[data-pick]', grp).forEach((x) => x.classList.toggle('sel', x === b));
        refresh();
      })));
      $('[data-no]', r).onclick = () => closeModal();
      $('[data-yes]', r).onclick = () => { closeModal(); onOk(sel); };
    });
  }

  function openSuggest() {
    const room = meP().room;
    picker([
      { key: 'rotom', label: 'Quel Rotom ?', ids: C.ROTOMS.map((r) => 'r:' + r.key) },
      { key: 'item', label: 'Avec quel objet ?', ids: C.ITEMS.map((r) => 'i:' + r.key) },
    ], 'Suggestion', `Dans la pièce où tu te trouves : <b>${esc(H.roomName(room))}</b>. Le Rotom et l'objet suggérés seront déplacés ici.`, 'Suggérer', (s) => act({ type: 'suggest', rotom: s.rotom, item: s.item }));
  }

  function openAccuse() {
    if (S.pub.phase !== 'playing') return;
    const cur = S.pub.order[S.pub.turn];
    if (cur !== me) { toast('Tu ne peux accuser que pendant ton tour.', true); return; }
    if (meP().eliminated) { toast('Tu as déjà fait ton accusation.', true); return; }
    picker([
      { key: 'rotom', label: 'Le Rotom', ids: C.ROTOMS.map((r) => 'r:' + r.key) },
      { key: 'item', label: 'L\'objet', ids: C.ITEMS.map((r) => 'i:' + r.key) },
      { key: 'room', label: 'La pièce', ids: C.ROOMS.map((r) => 'm:' + r.key) },
    ], '⚖️ Accusation', 'Tu ouvres le Peebboof. <b>Attention : une seule accusation par partie.</b> Si tu te trompes, tu ne peux plus gagner (tu continues seulement à réfuter).', 'Accuser !',
    (s) => act({ type: 'accuse', rotom: s.rotom, item: s.item, room: s.room }), true);
  }

  function openRefute(pr) {
    if (modalKind === 'refute') return;
    const sg = S.pub.suggestion;
    openModal('refute', `<h2>Réfuter la suggestion</h2>
      <p><b>${esc(PN(pr.by))}</b> suggère <b>${esc(H.rotomName(sg.rotom))}</b> dans <b>${esc(H.roomName(sg.room))}</b> avec <b>${esc(H.itemName(sg.item))}</b>.</p>
      <p class="hint">Tu as au moins une de ces cartes : choisis celle que tu montres (en secret) à ${esc(PN(pr.by))}.</p>
      <div class="cards">${pr.options.map((id) => `<button class="card" data-show="${id}"><img src="${cardSrc(id)}" alt=""></button>`).join('')}</div>`,
    (r) => $$('[data-show]', r).forEach((b) => (b.onclick = () => { closeModal('refute'); act({ type: 'refute', card: b.dataset.show }); })));
  }

  function openEnd() {
    const pb = S.pub.peebboof; if (!pb) return;
    const w = S.pub.players.find((p) => p.id === S.pub.winner);
    openModal('end', `<h2>${w ? '🏆 ' + esc(w.name) + ' a résolu l\'affaire !' : 'Affaire non résolue…'}</h2>
      <p class="hint">Le contenu du Peebboof :</p>
      <div class="cards">${['r:' + pb.rotom, 'i:' + pb.item, 'm:' + pb.room].map((id) => cardBtn(id)).join('')}</div>
      <div class="modal-row"><button class="btn" data-close>Fermer</button></div>`, (r) => ($('[data-close]', r).onclick = () => closeModal()));
  }

  function openEffects() {
    const { pub } = S;
    const others = pub.players.filter((p) => p.id !== me);
    const p = S.priv || { hand: [], ghostHand: [] };
    const myAct = (meP() || { active: [] }).active.map((a) => a.id);
    const mine = p.hand.concat(p.ghostHand, myAct);
    let giveSel = null;
    openModal('fx', `<h2>👻 Effets des cartes fantômes</h2>
      <p class="hint">Ces actions servent quand une carte fantôme le demande. Elles sont toutes annoncées dans le journal.</p>
      <h4>👀 Regarder une carte au hasard chez…</h4><p class="hint">Duskull (3), Sableye (10)</p>
      <div class="choice">${others.map((o) => `<button class="btn small" data-peek="${o.id}">${esc(o.name)}</button>`).join('')}</div>
      <h4>🤝 Donner une carte</h4><p class="hint">Drifloon (4) : donne-la, puis l'autre joueur te rend une carte de son choix avec ce même bouton.</p>
      <div class="cards" id="fx-give">${mine.map((id) => `<button class="card" data-g="${id}"><img src="${cardSrc(id)}" alt=""></button>`).join('') || '<span class="empty">Aucune carte.</span>'}</div>
      <div class="choice" id="fx-to">${others.map((o) => `<button class="btn small" data-to="${o.id}" disabled>à ${esc(o.name)}</button>`).join('')}</div>
      <h4>👻 Piocher une carte fantôme dans…</h4><p class="hint">Dusknoir (11)</p>
      <div class="choice">${C.ROOMS.map((r) => `<button class="btn small" data-draw="${r.key}" ${pub.roomGhostCount[r.key] ? '' : 'disabled'}>${esc(r.name)} (${pub.roomGhostCount[r.key] || 0})</button>`).join('')}</div>
      <h4>🚪 Basculer les portes de…</h4><p class="hint">Misdreavus (9)</p>
      <div class="choice">${C.ROOMS.map((r) => `<button class="btn small ghost" data-door="${r.key}">${esc(r.name)}</button>`).join('')}</div>
      <div class="modal-row"><button class="btn ghost" data-close>Fermer</button></div>`, (r) => {
      $('[data-close]', r).onclick = () => closeModal();
      $$('[data-peek]', r).forEach((b) => (b.onclick = () => { closeModal(); act({ type: 'peek', target: b.dataset.peek }); }));
      $$('[data-draw]', r).forEach((b) => (b.onclick = () => { closeModal(); act({ type: 'drawGhost', room: b.dataset.draw }); }));
      $$('[data-door]', r).forEach((b) => (b.onclick = () => { act({ type: 'toggleDoors', room: b.dataset.door }); toast('Portes basculées : ' + H.roomName(b.dataset.door)); }));
      $$('[data-g]', r).forEach((b) => (b.onclick = () => {
        giveSel = b.dataset.g;
        $$('[data-g]', r).forEach((x) => x.classList.toggle('sel', x === b));
        $$('[data-to]', r).forEach((x) => (x.disabled = false));
      }));
      $$('[data-to]', r).forEach((b) => (b.onclick = () => {
        if (!giveSel) return;
        const to = b.dataset.to, card = giveSel;
        confirmBox('Donner une carte ?', `Donner <b>${esc(H.cardName(card))}</b> à <b>${esc(PN(to))}</b> ?`, () => act({ type: 'give', to, card }));
      }));
    });
  }

  // ---------------- notifications ----------------
  function notifyNew() {
    const { pub, priv } = S;
    const lastLog = pub.log.length ? pub.log[pub.log.length - 1].n : 0;
    const inbox = (priv && priv.inbox) || [];
    const lastIn = inbox.length ? inbox[inbox.length - 1].n : 0;
    if (firstState) { firstState = false; seenLog = lastLog; seenInbox = lastIn; return; }
    pub.log.filter((l) => l.n > seenLog && ['dice', 'ghostwake', 'suggest', 'accuse', 'win', 'turn'].includes(l.kind)).slice(-3)
      .forEach((l) => toast(l.text));
    seenLog = Math.max(seenLog, lastLog);
    const fresh = inbox.filter((l) => l.n > seenInbox);
    seenInbox = Math.max(seenInbox, lastIn);
    const shown = fresh.filter((l) => l.kind === 'shown' && l.card);
    fresh.filter((l) => !(l.kind === 'shown' && l.card)).forEach((l) => toast('🔒 ' + l.text));
    if (shown.length && modalKind !== 'refute') {
      const l = shown[shown.length - 1];
      openModal('secret', `<h2>🔒 Rien que pour toi</h2><p>${esc(l.text)}</p><img class="big-card" src="${cardSrc(l.card)}" alt="">
        <div class="modal-row"><button class="btn" data-close>J'ai vu</button></div>`, (r) => ($('[data-close]', r).onclick = () => closeModal()));
    } else shown.forEach((l) => toast('🔒 ' + l.text));
    if (tab === 'log') renderLog();
  }

  function toast(text, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), err ? 4500 : 3800);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }

  function copy(text) {
    const done = () => toast('Lien copié !');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copie impossible — sélectionne le lien à la main.', true); }
      ta.remove();
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (host && S && S.pub.phase === 'playing') { e.preventDefault(); e.returnValue = ''; }
  });

  if (new URLSearchParams(location.search).get('debug')) window.__rc = () => ({ host, S });
  initHome();
})();
