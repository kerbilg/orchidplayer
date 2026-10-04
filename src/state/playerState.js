export class PlayerState {
  constructor() {
    this.currentTitle = "";
    this.currentArtist = "";
    this.albumArt = null;
    this.position = 0;
    this.duration = 0;
    this.playState = "";
    this.listeners = new Set();
  }

  setCurrentSong(song) {
    this.updateMetadata(song);
    this.albumArt = null;
    this.position = 0;
    this.duration = song?.duration ?? 0;
    this.emit();
  }

  updateProgress(progress) {
    this.position = Number(progress?.position) || 0;
    this.duration = Number(progress?.duration) || this.duration || 0;
    this.playState = progress?.state ?? this.playState;
    this.emit();
  }

  updateMetadata(song) {
    this.currentTitle = song?.title ?? "";
    this.currentArtist = song?.artist ?? "";
    this.emit();
  }

  setAlbumArt(albumArt) {
    this.albumArt = albumArt;
    this.emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      listener({
        currentTitle: this.currentTitle,
        currentArtist: this.currentArtist,
        albumArt: this.albumArt,
        position: this.position,
        duration: this.duration,
        playState: this.playState,
      });
    }
  }
}
