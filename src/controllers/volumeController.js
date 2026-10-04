export class VolumeController {
  constructor(volumeService, playerState) {
    this.volumeService = volumeService;
    this.playerState = playerState;
    this.pendingVolume = null;
    this.unavailableLogged = false;
  }

  start() {
    this.pollTimer = setInterval(() => void this.refreshVolume(), 2000);
    return this.refreshVolume();
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async refreshVolume() {
    try {
      const { volume, muted } = await this.volumeService.getVolume();
      // Während der Nutzer den Regler zieht, keine Fremdwerte dazwischenfunken
      if (this.pendingVolume === null) {
        this.playerState.updateVolume({ volume, muted });
      }
    } catch (error) {
      // Nur einmal melden, sonst flutet das 2-Sekunden-Polling das Log,
      // wenn gar kein PipeWire-Mixer vorhanden ist (z. B. unter macOS).
      if (!this.unavailableLogged) {
        this.unavailableLogged = true;
        console.error("Lautstärkesteuerung nicht verfügbar:", error.message);
      }
    }
  }

  async setVolume(percent) {
    const pct = Math.min(100, Math.max(0, Number(percent) || 0));
    this.pendingVolume = pct;
    this.playerState.updateVolume({ volume: pct });
    try {
      await this.volumeService.setVolume(pct);
    } catch (error) {
      console.error(error);
    } finally {
      this.pendingVolume = null;
    }
  }

  async toggleMute() {
    try {
      await this.volumeService.toggleMute();
    } catch (error) {
      console.error(error);
    } finally {
      await this.refreshVolume();
    }
  }
}
