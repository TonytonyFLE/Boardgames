/* Rotom Clue — réseau.
   Deux modes :
   - 'online' : PeerJS (WebRTC), chaque joueur sur son appareil.
   - 'local'  : BroadcastChannel, pour tester avec plusieurs onglets du même navigateur. */
(function () {
  const PREFIX = 'rotomclue-v1-';
  const PEER_OPTS = { debug: 1 };

  class HostNet {
    constructor(code, mode, onMsg, onClose) {
      this.code = code; this.mode = mode; this.onMsg = onMsg; this.onClose = onClose;
      this.conns = new Map();
    }
    start() {
      if (this.mode === 'local') {
        this.bc = new BroadcastChannel(PREFIX + this.code);
        this.bc.onmessage = (e) => {
          const d = e.data;
          if (d && d.to === 'host') this.onMsg(d.from, d.msg);
        };
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        this.peer = new Peer(PREFIX + this.code, PEER_OPTS);
        this.peer.on('open', () => resolve());
        this.peer.on('error', (err) => {
          if (err.type === 'unavailable-id') reject(new Error('Ce code de partie est déjà utilisé.'));
          else if (!this._opened) reject(err);
          console.warn('peer error', err);
        });
        this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) {} });
        this.peer.on('connection', (conn) => {
          conn.on('open', () => { this.conns.set(conn.peer, conn); });
          conn.on('data', (d) => this.onMsg(conn.peer, d));
          conn.on('close', () => { this.conns.delete(conn.peer); this.onClose(conn.peer); });
          conn.on('error', () => {});
        });
      });
    }
    send(cid, msg) {
      if (this.mode === 'local') { this.bc.postMessage({ to: cid, msg }); return; }
      const c = this.conns.get(cid);
      if (c && c.open) { try { c.send(msg); } catch (e) { console.warn(e); } }
    }
  }

  class ClientNet {
    constructor(code, mode, onMsg, onStatus) {
      this.code = code; this.mode = mode; this.onMsg = onMsg; this.onStatus = onStatus;
      this.queue = [];
    }
    start() {
      if (this.mode === 'local') {
        this.cid = 'tab-' + Math.random().toString(36).slice(2, 10);
        this.bc = new BroadcastChannel(PREFIX + this.code);
        this.bc.onmessage = (e) => {
          const d = e.data;
          if (d && d.to === this.cid) this.onMsg(d.msg);
        };
        this.onStatus('connected');
        return;
      }
      this.onStatus('connecting');
      this.peer = new Peer(PEER_OPTS);
      this.peer.on('open', () => this._connect());
      this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) {} });
      this.peer.on('error', (err) => {
        console.warn('peer error', err);
        if (err.type === 'peer-unavailable') { this.onStatus('nohost'); this._retry(); }
      });
    }
    _connect() {
      const conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      conn.on('open', () => {
        this.onStatus('connected');
        const q = this.queue; this.queue = [];
        q.forEach((m) => conn.send(m));
      });
      conn.on('data', (d) => this.onMsg(d));
      conn.on('close', () => { this.onStatus('connecting'); this._retry(); });
      conn.on('error', () => {});
    }
    _retry() {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) {} }
          this._connect();
        }
      }, 2500);
    }
    send(msg) {
      if (this.mode === 'local') { this.bc.postMessage({ to: 'host', from: this.cid, msg }); return; }
      if (this.conn && this.conn.open) this.conn.send(msg);
      else this.queue.push(msg);
    }
  }

  // Connexion directe pour le joueur qui héberge (même page que l'hôte)
  class LoopNet {
    constructor(host) { this.host = host; this.cid = 'self'; }
    start() { this.onStatus && this.onStatus('connected'); }
    send(msg) { setTimeout(() => this.host.handle(this.cid, msg), 0); }
  }

  window.RCNet = { HostNet, ClientNet, LoopNet };
})();
