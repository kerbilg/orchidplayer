import { connect as connectTcpSocket } from "node:net";
import { MPC } from "mpc-js";

export class MpcClient {
  constructor(settings) {
    this.settings = settings;
    this.mpc = new MPC();
    this.socket = null;
    this.eventHandlers = new Map();
  }

  connect() {
    const host = this.settings.get("mpd_host") ?? "localhost";
    const port = this.settings.getNumber("mpd_port") ?? 6600;
    return this.connectWithTimeout(host, port);
  }

  reconnect() {
    this.forceDisconnect();
    // Frische Instanz, damit kein alter Verbindungszustand (Request-Queues,
    // ausstehende Reads) in die neue Verbindung hineinragt
    this.mpc = new MPC();
    for (const [event, handlers] of this.eventHandlers) {
      for (const handler of handlers) this.mpc.on(event, handler);
    }
    return this.connect();
  }

  // Trennt die Verbindung vollständig. mpc-js disconnect() wirft bei
  // ausstehendem Read (ERR_INVALID_STATE), daher den Socket selbst schließen.
  forceDisconnect() {
    this.socket?.destroy();
    this.socket = null;
    try {
      this.mpc.disconnect();
    } catch {
      // Verbindung ist trotzdem weg
    }
  }

  // mpc-js lässt das connect-Promise bei unerreichbarem Server ewig hängen,
  // daher Timeout und Fehlerereignisse selbst behandeln.
  connectWithTimeout(host, port, timeoutMs = 4000) {
    const socket = connectTcpSocket(port, host);
    this.socket = socket;

    let onSocketError;
    let onMpdError;
    let onSocketEnd;
    let timer;

    const failure = new Promise((_, reject) => {
      onSocketError = (err) => reject(err);
      onMpdError = (err) => reject(err instanceof Error ? err : new Error(String(err)));
      onSocketEnd = () => reject(new Error(`Verbindung zu ${host}:${port} unerwartet beendet`));
      timer = setTimeout(() => reject(new Error(`Keine Verbindung zu ${host}:${port} (Timeout)`)), timeoutMs);
      socket.once("error", onSocketError);
      this.mpc.once("socket-error", onMpdError);
      this.mpc.once("socket-end", onSocketEnd);
    });

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("error", onSocketError);
      this.mpc.off("socket-error", onMpdError);
      this.mpc.off("socket-end", onSocketEnd);
    };

    return Promise.race([this.mpc.connectSocket(socket), failure])
      .finally(cleanup)
      .catch((error) => {
        // halb-offene Verbindung aufräumen, damit ein erneuter Versuch möglich ist
        this.forceDisconnect();
        throw error;
      });
  }

  play() {
    return this.mpc.playback.play();
  }

  pause() {
    return this.mpc.playback.pause();
  }

  next() {
    return this.mpc.playback.next();
  }

  previous() {
    return this.mpc.playback.previous();
  }

  seek(position) {
    const seconds = Math.max(0, Number(position) || 0);
    return this.mpc.playback.seekCur(seconds, false);
  }

  async getStatus() {
    return this.mpc.status.status();
  }

  async getCurrentSong() {
    return this.mpc.status.currentSong();
  }

  getAlbumArt(uri) {
    return this.mpc.database.getAlbumArt(uri);
  }

  getPicture(uri) {
    return this.mpc.database.getPicture(uri);
  }

  search(query) {
    return this.mpc.database.search([["any", query]]);
  }

  addToQueue(uri) {
    return this.mpc.currentPlaylist.addId(uri);
  }

  playId(songId) {
    return this.mpc.playback.playId(songId);
  }

  listPlaylists() {
    return this.mpc.storedPlaylists.listPlaylists();
  }

  async loadPlaylist(name) {
    await this.mpc.currentPlaylist.clear();
    await this.mpc.storedPlaylists.load(name);
  }

  onChangedPlayer(handler) {
    const handlers = this.eventHandlers.get("changed-player") ?? [];
    handlers.push(handler);
    this.eventHandlers.set("changed-player", handlers);
    this.mpc.on("changed-player", handler);
  }
}
