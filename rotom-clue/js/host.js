/* Rotom Clue — moteur de jeu (tourne uniquement chez l'hôte).
   L'hôte connaît tout ; chaque joueur ne reçoit que ce qu'il a le droit de voir. */
(function () {
  const C = window.RC, GEO = window.RC_GEO;
  const rotomName = (k) => (C.ROTOMS.find((r) => r.key === k) || {}).name || k;
  const itemName = (k) => (C.ITEMS.find((r) => r.key === k) || {}).name || k;
  const roomName = (k) => (C.ROOMS.find((r) => r.key === k) || {}).name || k;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const rid = () => Math.random().toString(36).slice(2, 10);

  function cardName(id) {
    const [t, k] = id.split(':');
    if (t === 'r') return rotomName(k);
    if (t === 'i') return itemName(k);
    if (t === 'm') return roomName(k);
    if (t === 'g') { const n = parseInt(k, 10); return `${C.GHOSTS[n].name} (${n})`; }
    return id;
  }
  const ghostNum = (id) => parseInt(id.split(':')[1], 10);

  function roomAt(x, y) {
    for (const r of C.ROOMS) {
      const g = GEO[r.key]['1'];
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return r.key;
    }
    return null;
  }
  function roomCenter(room) {
    const g = GEO[room]['1'];
    return [g.x + g.w / 2, g.y + g.h / 2];
  }
  const SLOT = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-2, -1]];

  class Host {
    constructor(code, net, saved) {
      this.net = net;
      this.cids = new Map(); // cid -> playerId
      this.s = saved || {
        code, phase: 'lobby', seq: 0, hostId: null,
        players: [], order: [], turn: 0, rolled: false, dice: null, suggested: false,
        tokens: {}, roomVar: {}, roomGhosts: {}, peebboof: null, suggestion: null,
        log: [], winner: null,
      };
      if (saved) this.s.players.forEach((p) => (p.connected = false));
    }

    // ---------- outils ----------
    P(id) { return this.s.players.find((p) => p.id === id); }
    log(text, kind) { this.s.log.push({ n: ++this.s.seq, text, kind: kind || 'info' }); if (this.s.log.length > 300) this.s.log.shift(); }
    priv(p, text, card, kind) {
      p.inbox = p.inbox || [];
      p.inbox.push({ n: ++this.s.seq, text, card: card || null, kind: kind || 'info' });
      if (p.inbox.length > 80) p.inbox.shift();
    }
    current() { return this.P(this.s.order[this.s.turn]); }
    save() {
      try { localStorage.setItem('rc-host-' + this.s.code, JSON.stringify(this.s)); localStorage.setItem('rc-last-host', JSON.stringify(this.s.code)); } catch (e) {}
    }
    sendTo(cid, msg) {
      if (cid === 'self') { this.selfClient && this.selfClient.receive(msg); return; }
      this.net.send(cid, msg);
    }
    broadcast() {
      this.save();
      for (const [cid, pid] of this.cids) this.sendTo(cid, { t: 'state', state: this.view(pid) });
    }
    error(cid, text) { this.sendTo(cid, { t: 'error', text }); }

    view(pid) {
      const s = this.s, me = this.P(pid);
      const pub = {
        code: s.code, phase: s.phase, hostId: s.hostId,
        players: s.players.map((p) => ({
          id: p.id, name: p.name, rotom: p.rotom, connected: !!p.connected,
          handCount: p.hand.length, ghostCount: p.ghostHand.length,
          active: p.active.map((a) => ({ id: a.id, tokens: a.tokens })),
          eliminated: !!p.eliminated, room: p.room || null,
        })),
        order: s.order, turn: s.turn, rolled: s.rolled, dice: s.dice, suggested: s.suggested,
        tokens: s.tokens, roomVar: s.roomVar,
        roomGhostCount: Object.fromEntries(Object.entries(s.roomGhosts).map(([k, v]) => [k, v.length])),
        suggestion: s.suggestion && {
          by: s.suggestion.by, rotom: s.suggestion.rotom, item: s.suggestion.item, room: s.suggestion.room,
          current: s.suggestion.current, done: s.suggestion.done, shownBy: s.suggestion.shownBy,
        },
        log: s.log.slice(-120), winner: s.winner,
        peebboof: s.phase === 'ended' ? s.peebboof : null,
      };
      const priv = me ? {
        id: me.id, hand: me.hand, ghostHand: me.ghostHand, inbox: (me.inbox || []).slice(-40),
        refute: null,
      } : null;
      if (me && s.suggestion && !s.suggestion.done && s.suggestion.current === me.id) {
        const sg = s.suggestion;
        priv.refute = { by: sg.by, options: me.hand.filter((c) => c === 'r:' + sg.rotom || c === 'i:' + sg.item || c === 'm:' + sg.room) };
      }
      return { pub, priv };
    }

    // ---------- messages ----------
    handle(cid, msg) {
      try {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'hello') return this.hello(cid, msg);
        const pid = this.cids.get(cid);
        const p = pid && this.P(pid);
        if (!p) return this.error(cid, 'Tu n\'es pas (encore) dans la partie.');
        if (msg.t === 'act') {
          const res = this.act(p, msg.a || {});
          if (typeof res === 'string') this.error(cid, res);
          this.broadcast();
        }
      } catch (e) {
        console.error(e);
        this.error(cid, 'Erreur : ' + e.message);
      }
    }

    disconnect(cid) {
      const pid = this.cids.get(cid);
      this.cids.delete(cid);
      const p = pid && this.P(pid);
      if (p && ![...this.cids.values()].includes(pid)) { p.connected = false; this.broadcast(); }
    }

    hello(cid, msg) {
      const s = this.s;
      let p = msg.token && s.players.find((x) => x.token === msg.token);
      if (!p) {
        if (s.phase !== 'lobby') return this.error(cid, 'La partie a déjà commencé.');
        if (s.players.length >= C.MAX_PLAYERS) return this.error(cid, 'La partie est complète (6 joueurs).');
        const name = String(msg.name || 'Joueur').trim().slice(0, 18) || 'Joueur';
        p = { id: rid(), token: msg.token || rid(), name, rotom: null, hand: [], ghostHand: [], active: [], inbox: [] };
        const free = C.ROTOMS.map((r) => r.key).filter((k) => !s.players.some((x) => x.rotom === k));
        p.rotom = msg.rotom && free.includes(msg.rotom) ? msg.rotom : free[0];
        s.players.push(p);
        if (cid === 'self') s.hostId = p.id;
        this.log(`${p.name} rejoint la partie.`);
      }
      for (const [c, id] of this.cids) if (id === p.id && c !== cid) this.cids.delete(c);
      this.cids.set(cid, p.id);
      p.connected = true;
      this.sendTo(cid, { t: 'welcome', id: p.id, token: p.token });
      this.broadcast();
    }

    // ---------- actions ----------
    act(p, a) {
      const s = this.s;
      const isHost = p.id === s.hostId;
      const cur = s.phase === 'playing' && this.current();
      const myTurn = cur && cur.id === p.id;

      switch (a.type) {
        case 'name': {
          p.name = String(a.name || '').trim().slice(0, 18) || p.name; return;
        }
        case 'pickRotom': {
          if (s.phase !== 'lobby') return 'Trop tard pour changer de Rotom.';
          if (s.players.some((x) => x !== p && x.rotom === a.rotom)) return 'Ce Rotom est déjà pris.';
          if (!C.ROTOMS.some((r) => r.key === a.rotom)) return;
          p.rotom = a.rotom; return;
        }
        case 'kick': {
          if (!isHost || s.phase !== 'lobby') return;
          s.players = s.players.filter((x) => x.id !== a.id || x.id === s.hostId); return;
        }
        case 'start': {
          if (!isHost) return 'Seul l\'hôte peut lancer la partie.';
          if (s.phase !== 'lobby') return;
          if (s.players.length < C.MIN_PLAYERS) return `Il faut au moins ${C.MIN_PLAYERS} joueurs.`;
          return this.startGame();
        }
        case 'restart': {
          if (!isHost) return;
          s.phase = 'lobby'; s.winner = null; s.suggestion = null; s.peebboof = null;
          s.players.forEach((x) => { x.hand = []; x.ghostHand = []; x.active = []; x.eliminated = false; x.room = null; x.inbox = []; });
          this.log('Retour au salon pour une nouvelle partie.');
          return;
        }
      }
      if (s.phase !== 'playing') return 'La partie n\'est pas en cours.';

      switch (a.type) {
        case 'roll': {
          if (!myTurn) return 'Ce n\'est pas ton tour.';
          if (s.rolled) return 'Tu as déjà lancé les dés ce tour-ci.';
          const dice = Array.from({ length: C.DICE }, () => 1 + Math.floor(Math.random() * 6));
          const sum = dice.reduce((x, y) => x + y, 0);
          s.dice = { values: dice, sum, by: p.id }; s.rolled = true;
          this.log(`🎲 ${p.name} lance les dés : ${dice.join(' + ')} = ${sum}`, 'dice');
          this.triggerGhosts(sum, p);
          return;
        }
        case 'move': {
          const tok = String(a.tok || '');
          if (!(tok in s.tokens)) return;
          const own = tok === 'r:' + p.rotom;
          if (!isHost && !(own && myTurn)) return own ? 'Attends ton tour pour te déplacer.' : 'Tu ne peux déplacer que ton propre pion.';
          const x = Math.min(0.99, Math.max(0.01, +a.x)), y = Math.min(0.99, Math.max(0.01, +a.y));
          if (!isFinite(x) || !isFinite(y)) return;
          const before = roomAt(s.tokens[tok].x, s.tokens[tok].y);
          s.tokens[tok] = { x, y };
          const after = roomAt(x, y);
          const owner = s.players.find((q) => 'r:' + q.rotom === tok);
          if (owner) owner.room = after;
          if (owner && owner === p && after && after !== before) this.enterRoom(p, after);
          return;
        }
        case 'passage': {
          if (!myTurn) return 'Ce n\'est pas ton tour.';
          if (s.rolled) return 'Tu as déjà lancé les dés : le passage secret n\'est plus possible ce tour-ci.';
          const from = p.room, ps = from && C.PASSAGES[from];
          if (!ps) return 'Il n\'y a pas de passage secret ici.';
          if (s.roomVar[from] !== ps.openIn) return 'L\'entrée du passage secret est fermée.';
          this.placeInRoom('r:' + p.rotom, ps.to);
          p.room = ps.to; s.rolled = true;
          this.log(`🚪 ${p.name} emprunte le passage secret : ${roomName(from)} → ${roomName(ps.to)}`);
          this.enterRoom(p, ps.to);
          return;
        }
        case 'suggest': {
          if (!myTurn) return 'Ce n\'est pas ton tour.';
          if (p.eliminated) return 'Tu es éliminé : tu ne peux plus faire de suggestion.';
          if (s.suggested) return 'Tu as déjà fait une suggestion ce tour-ci.';
          const room = p.room;
          if (!room) return 'Ton pion doit être dans une pièce pour faire une suggestion.';
          if (!C.ROTOMS.some((r) => r.key === a.rotom) || !C.ITEMS.some((r) => r.key === a.item)) return 'Choisis un Rotom et un objet.';
          s.suggested = true;
          this.placeInRoom('r:' + a.rotom, room);
          this.placeInRoom('i:' + a.item, room);
          const moved = s.players.find((q) => q.rotom === a.rotom);
          if (moved) moved.room = room;
          this.log(`🔎 ${p.name} suggère : ${rotomName(a.rotom)} dans ${roomName(room)} avec ${itemName(a.item)}`, 'suggest');
          const i = s.order.indexOf(p.id);
          const queue = [];
          for (let k = 1; k < s.order.length; k++) queue.push(s.order[(i + k) % s.order.length]);
          s.suggestion = { by: p.id, rotom: a.rotom, item: a.item, room, queue, current: null, done: false, shownBy: null };
          this.advanceSuggestion();
          return;
        }
        case 'refute': {
          const sg = s.suggestion;
          if (!sg || sg.done || sg.current !== p.id) return 'Aucune suggestion à réfuter.';
          const ok = [ 'r:' + sg.rotom, 'i:' + sg.item, 'm:' + sg.room ];
          if (!ok.includes(a.card) || !p.hand.includes(a.card)) return 'Cette carte ne correspond pas à la suggestion.';
          const by = this.P(sg.by);
          sg.done = true; sg.shownBy = p.id; sg.current = null;
          this.priv(by, `${p.name} t'a montré : ${cardName(a.card)}`, a.card, 'shown');
          this.priv(p, `Tu as montré ${cardName(a.card)} à ${by.name}`, a.card);
          this.log(`🃏 ${p.name} montre une carte à ${by.name}.`, 'suggest');
          return;
        }
        case 'accuse': {
          if (!myTurn) return 'Tu ne peux accuser que pendant ton tour.';
          if (p.eliminated) return 'Tu as déjà fait ton accusation.';
          const pb = s.peebboof;
          const okAcc = a.rotom === pb.rotom && a.item === pb.item && a.room === pb.room;
          this.log(`⚖️ ${p.name} accuse : ${rotomName(a.rotom)} dans ${roomName(a.room)} avec ${itemName(a.item)}…`, 'accuse');
          if (okAcc) {
            s.phase = 'ended'; s.winner = p.id;
            this.log(`🏆 ${p.name} a résolu l'affaire ! C'était ${rotomName(pb.rotom)} dans ${roomName(pb.room)} avec ${itemName(pb.item)}.`, 'win');
          } else {
            p.eliminated = true;
            this.priv(p, `Raté… Le Peebboof contenait : ${rotomName(pb.rotom)}, ${itemName(pb.item)}, ${roomName(pb.room)}. Tu restes en jeu pour réfuter les suggestions des autres.`, null, 'shown');
            this.log(`❌ ${p.name} s'est trompé et ne peut plus gagner.`, 'accuse');
            const alive = s.players.filter((q) => !q.eliminated);
            if (alive.length === 0) {
              s.phase = 'ended'; s.winner = null;
              this.log(`Personne n'a trouvé ! C'était ${rotomName(pb.rotom)} dans ${roomName(pb.room)} avec ${itemName(pb.item)}.`, 'win');
            } else this.nextTurn();
          }
          return;
        }
        case 'endTurn': {
          if (!myTurn && !isHost) return 'Ce n\'est pas ton tour.';
          if (s.suggestion && !s.suggestion.done) return 'Attends la fin de la réfutation.';
          this.nextTurn();
          return;
        }
        // ----- actions libres liées aux cartes fantômes -----
        case 'ghostToken': {
          const owner = this.P(a.owner);
          const card = owner && owner.active.find((x) => x.id === a.id);
          if (!card) return;
          card.tokens = Math.max(0, card.tokens + (a.delta > 0 ? 1 : -1));
          this.log(`👻 ${p.name} ${a.delta > 0 ? 'ajoute' : 'retire'} un jeton fantôme sur ${cardName(card.id)} de ${owner.name} (${card.tokens}).`, 'ghost');
          return;
        }
        case 'ghostReturn': {
          const owner = this.P(a.owner);
          if (!owner || (owner !== p && !isHost)) return 'Seul le propriétaire peut reprendre cette carte.';
          const i = owner.active.findIndex((x) => x.id === a.id);
          if (i < 0) return;
          const [card] = owner.active.splice(i, 1);
          owner.ghostHand.push(card.id);
          this.log(`👻 ${cardName(card.id)} retourne dans la main de ${owner.name}.`, 'ghost');
          return;
        }
        case 'peek': {
          const t = this.P(a.target);
          if (!t || t === p) return 'Choisis un autre joueur.';
          const pool = t.hand.concat(t.ghostHand);
          if (!pool.length) return `${t.name} n'a aucune carte en main.`;
          const card = pool[Math.floor(Math.random() * pool.length)];
          this.priv(p, `Tu regardes une carte au hasard chez ${t.name} : ${cardName(card)}`, card, 'shown');
          this.priv(t, `${p.name} a regardé une de tes cartes au hasard : ${cardName(card)}`, card);
          this.log(`👀 ${p.name} regarde une carte au hasard dans la main de ${t.name}.`, 'ghost');
          return;
        }
        case 'give': {
          const t = this.P(a.to);
          if (!t || t === p) return 'Choisis un autre joueur.';
          const card = String(a.card || '');
          let zone = null;
          if (p.hand.includes(card)) zone = 'hand';
          else if (p.ghostHand.includes(card)) zone = 'ghostHand';
          else if (p.active.some((x) => x.id === card)) zone = 'active';
          if (!zone) return 'Tu n\'as pas cette carte.';
          if (zone === 'active') {
            const c = p.active.find((x) => x.id === card);
            if (c.tokens > 0 && ghostNum(card) !== 4) return 'Cette carte a encore des jetons fantômes.';
            p.active = p.active.filter((x) => x.id !== card); t.ghostHand.push(card);
          } else {
            p[zone] = p[zone].filter((x) => x !== card); t[zone].push(card);
          }
          const isGhost = card.startsWith('g:');
          this.priv(t, `${p.name} te donne : ${cardName(card)}`, card, 'shown');
          this.log(`🤝 ${p.name} donne ${isGhost ? 'la carte ' + cardName(card) : 'une carte'} à ${t.name}.`, 'ghost');
          return;
        }
        case 'drawGhost': {
          if (!C.ROOMS.some((r) => r.key === a.room)) return;
          if (!s.roomGhosts[a.room].length) return 'Il n\'y a plus de carte fantôme dans cette pièce.';
          this.drawGhost(p, a.room);
          return;
        }
        case 'toggleDoors': {
          if (!C.ROOMS.some((r) => r.key === a.room)) return;
          s.roomVar[a.room] = s.roomVar[a.room] === 1 ? 2 : 1;
          this.log(`🚪 ${p.name} bascule les portes de ${roomName(a.room)}.`, 'ghost');
          return;
        }
        case 'skip': {
          if (!isHost) return;
          this.log(`L'hôte passe le tour de ${cur.name}.`);
          if (s.suggestion && !s.suggestion.done) { s.suggestion.done = true; s.suggestion.current = null; }
          this.nextTurn();
          return;
        }
      }
      return 'Action inconnue.';
    }

    // ---------- logique ----------
    startGame() {
      const s = this.s;
      const R = C.ROTOMS.map((r) => 'r:' + r.key), I = C.ITEMS.map((r) => 'i:' + r.key), M = C.ROOMS.map((r) => 'm:' + r.key);
      shuffle(R); shuffle(I); shuffle(M);
      s.peebboof = { rotom: R.pop().slice(2), item: I.pop().slice(2), room: M.pop().slice(2) };
      // ordre de jeu : celui qui joue Rotom Heat commence, puis dans l'ordre d'arrivée
      const ids = s.players.map((p) => p.id);
      const hi = s.players.findIndex((p) => p.rotom === 'heat');
      s.order = hi > 0 ? ids.slice(hi).concat(ids.slice(0, hi)) : ids;
      s.players.forEach((p) => { p.hand = []; p.ghostHand = []; p.active = []; p.eliminated = false; p.room = null; p.inbox = []; });
      const deck = shuffle(R.concat(I, M));
      deck.forEach((c, i) => this.P(s.order[i % s.order.length]).hand.push(c));
      // paquet fantôme
      let ghosts = Object.keys(C.GHOSTS).map((n) => 'g:' + n);
      let dup = C.GHOST_DUPLICATES;
      if (dup === 'random') dup = [shuffle(Object.keys(C.GHOSTS))[0]];
      (dup || []).forEach((n, k) => ghosts.push('g:' + n + '#' + (k + 2)));
      shuffle(ghosts);
      s.roomGhosts = {};
      const rooms = shuffle(C.ROOMS.map((r) => r.key));
      rooms.forEach((r) => (s.roomGhosts[r] = []));
      ghosts.forEach((g, i) => s.roomGhosts[rooms[i % rooms.length]].push(g));
      // portes / passages
      s.roomVar = {};
      C.ROOMS.forEach((r) => (s.roomVar[r.key] = Math.random() < 0.5 ? 1 : 2));
      // pions
      s.tokens = {};
      C.ROTOMS.forEach((r) => (s.tokens['r:' + r.key] = { x: r.start[0], y: r.start[1] }));
      const itemRooms = shuffle(C.ROOMS.map((r) => r.key));
      C.ITEMS.forEach((it, i) => this.placeInRoom('i:' + it.key, itemRooms[i]));
      s.phase = 'playing'; s.turn = 0; s.rolled = false; s.suggested = false; s.dice = null; s.suggestion = null; s.winner = null;
      this.log('🌀 La partie commence ! Les cartes sont distribuées, le Peebboof est scellé.', 'start');
      this.log(`C'est au tour de ${this.current().name}.`, 'turn');
    }

    placeInRoom(tok, room) {
      const s = this.s;
      const [cx, cy] = roomCenter(room);
      const taken = Object.entries(s.tokens).filter(([k, v]) => k !== tok && roomAt(v.x, v.y) === room).length;
      const [dx, dy] = SLOT[taken % SLOT.length];
      s.tokens[tok] = { x: cx + dx * 0.04, y: cy + dy * 0.04 };
    }

    enterRoom(p, room) {
      this.log(`🚪 ${p.name} entre dans ${roomName(room)}.`);
      if (this.s.roomGhosts[room] && this.s.roomGhosts[room].length) this.drawGhost(p, room);
    }

    drawGhost(p, room) {
      const card = this.s.roomGhosts[room].pop();
      p.ghostHand.push(card);
      this.log(`👻 ${p.name} pioche une carte fantôme dans ${roomName(room)} (il en reste ${this.s.roomGhosts[room].length}).`, 'ghost');
      this.priv(p, `Tu as pioché : ${cardName(card)}`, card, 'shown');
    }

    triggerGhosts(sum, roller) {
      for (const p of this.s.players) {
        for (const a of p.active) {
          if (ghostNum(a.id) === sum) {
            a.tokens += 1;
            this.log(`👻 ${cardName(a.id)} de ${p.name} reçoit un jeton fantôme (${a.tokens}).`, 'ghost');
          }
        }
        const wake = p.ghostHand.filter((c) => ghostNum(c) === sum);
        for (const c of wake) {
          p.ghostHand.splice(p.ghostHand.indexOf(c), 1);
          p.active.push({ id: c, tokens: 1 });
          this.log(`👻 ${p.name} révèle ${cardName(c)} ! « ${C.GHOSTS[sum].text} »`, 'ghostwake');
        }
      }
    }

    advanceSuggestion() {
      const s = this.s, sg = s.suggestion;
      while (sg.queue.length) {
        const pid = sg.queue.shift();
        const q = this.P(pid);
        const has = q.hand.some((c) => c === 'r:' + sg.rotom || c === 'i:' + sg.item || c === 'm:' + sg.room);
        if (has) { sg.current = pid; this.log(`… ${q.name} peut réfuter et choisit une carte à montrer.`, 'suggest'); return; }
        this.log(`… ${q.name} ne peut pas réfuter.`, 'suggest');
      }
      sg.done = true; sg.current = null;
      this.log('Personne ne peut réfuter cette suggestion !', 'suggest');
    }

    nextTurn() {
      const s = this.s;
      if (s.phase !== 'playing') return;
      const n = s.order.length;
      for (let k = 1; k <= n; k++) {
        const i = (s.turn + k) % n;
        if (!this.P(s.order[i]).eliminated) { s.turn = i; break; }
      }
      s.rolled = false; s.suggested = false; s.dice = null; s.suggestion = null;
      this.log(`C'est au tour de ${this.current().name}.`, 'turn');
    }
  }

  window.RCHost = { Host, cardName, roomAt, rotomName, itemName, roomName, ghostNum };
})();
