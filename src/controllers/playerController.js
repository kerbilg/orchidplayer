export class PlayerController {
  constructor(mpcClient, playerState, albumArtService) {
    this.mpcClient = mpcClient;
    this.playerState = playerState;
    this.albumArtService = albumArtService;
    this.artRequestId = 0;
    this.currentSongKey = null;
  }

  start() {
    this.mpcClient.onChangedPlayer(() => void this.refreshPlayback());
    this.pollTimer = setInterval(() => void this.refreshPlayback(), 1000);
    return this.refreshPlayback();
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async reconnect() {
    this.stop();
    try {
      await this.mpcClient.reconnect();
      // Song-Key zurücksetzen, damit Metadaten und Cover vom neuen Server geladen werden
      this.currentSongKey = null;
    } finally {
      // Polling auch nach einem Fehlschlag fortsetzen, damit die App
      // wieder anspringt, sobald ein Server erreichbar ist
      this.pollTimer = setInterval(() => void this.refreshPlayback(), 1000);
    }
    return this.refreshPlayback();
  }

  async next() {
    return this.mpcClient.next();
  }

  async previous() {
    return this.mpcClient.previous();
  }

  async togglePlayPause() {
    const status = await this.mpcClient.getStatus();
    if (status.state === "play") {
      return this.mpcClient.pause();
    }
    return this.mpcClient.play();
  }

  async seekTo(position) {
    try {
      await this.mpcClient.seek(position);
      this.playerState.updateProgress({
        position,
        duration: this.playerState.duration,
        state: this.playerState.playState,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async getPlaylists() {
    const playlists = await this.mpcClient.listPlaylists();
    return playlists
      .map((playlist) => ({ name: playlist.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async playPlaylist(name) {
    await this.mpcClient.loadPlaylist(name);
    await this.mpcClient.play();
    return this.refreshPlayback();
  }

  async playSong(uri) {
    const songId = await this.mpcClient.addToQueue(uri);
    await this.mpcClient.playId(songId);
    return this.refreshPlayback();
  }

  async refreshPlayback() {
    try {
      const [song, status] = await Promise.all([
        this.mpcClient.getCurrentSong(),
        this.mpcClient.getStatus(),
      ]);
      const songKey = song?.path ?? (song?.id != null
        ? String(song.id)
        : `${song?.artist ?? ""}|${song?.album ?? ""}|${song?.title ?? ""}`);
      const songChanged = songKey !== this.currentSongKey;
      this.currentSongKey = songKey;

      if (songChanged) {
        this.playerState.setCurrentSong(song);
        void this.refreshAlbumArt(song);
      } else {
        this.playerState.updateMetadata(song);
      }

      this.playerState.updateProgress({
        position: status?.elapsed ?? 0,
        duration: status?.duration ?? song?.duration ?? 0,
        state: status?.state ?? "",
      });
    } catch (error) {
      console.error(error);
    }
  }

  async refreshAlbumArt(song) {
    const requestId = ++this.artRequestId;
    try {
      const albumArt = await this.albumArtService.loadForSong(song);
      if (requestId === this.artRequestId) {
        this.playerState.setAlbumArt(albumArt);
      }
    } catch (error) {
      console.error(error);
      if (requestId === this.artRequestId) {
        this.playerState.setAlbumArt(null);
      }
    }
  }
}
