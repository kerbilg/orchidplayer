import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// WirePlumber (wpctl) ist der native PipeWire-Mixer; pactl ist der
// PulseAudio-Kompatibilitätsweg und funktioniert mit pipewire-pulse genauso.
const WPCTL_SINK = "@DEFAULT_AUDIO_SINK@";
const PACTL_SINK = "@DEFAULT_SINK@";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class VolumeService {
  constructor() {
    this.backend = null;
  }

  async exec(command, args) {
    const { stdout } = await execFileAsync(command, args, { timeout: 2000 });
    return stdout;
  }

  // Ermittelt einmalig, welcher Mixer verfügbar ist. wpctl wird bevorzugt,
  // weil es die PipeWire-Session direkt anspricht.
  async detectBackend() {
    if (this.backend) return this.backend;

    try {
      await this.exec("wpctl", ["get-volume", WPCTL_SINK]);
      this.backend = "wpctl";
      return this.backend;
    } catch {
      // wpctl nicht vorhanden/kein PipeWire -> pactl versuchen
    }

    try {
      await this.exec("pactl", ["get-sink-volume", PACTL_SINK]);
      this.backend = "pactl";
      return this.backend;
    } catch {
      // kein Mixer gefunden
    }

    throw new Error(
      "Keine PipeWire-Lautstärkesteuerung gefunden (wpctl oder pactl erforderlich)."
    );
  }

  async getVolume() {
    const backend = await this.detectBackend();

    if (backend === "wpctl") {
      const output = await this.exec("wpctl", ["get-volume", WPCTL_SINK]);
      const match = output.match(/Volume:\s*([\d.]+)/);
      return {
        volume: match ? clamp(Number(match[1]) * 100, 0, 100) : 0,
        muted: /\[MUTED\]/.test(output),
      };
    }

    const [volumeOut, muteOut] = await Promise.all([
      this.exec("pactl", ["get-sink-volume", PACTL_SINK]),
      this.exec("pactl", ["get-sink-mute", PACTL_SINK]),
    ]);
    const match = volumeOut.match(/(\d+)%/);
    return {
      volume: match ? clamp(Number(match[1]), 0, 100) : 0,
      muted: /Mute:\s*yes/i.test(muteOut),
    };
  }

  async setVolume(percent) {
    const backend = await this.detectBackend();
    const pct = clamp(Math.round(Number(percent) || 0), 0, 100);

    if (backend === "wpctl") {
      await this.exec("wpctl", ["set-volume", WPCTL_SINK, `${pct}%`]);
    } else {
      await this.exec("pactl", ["set-sink-volume", PACTL_SINK, `${pct}%`]);
    }
  }

  async toggleMute() {
    const backend = await this.detectBackend();

    if (backend === "wpctl") {
      await this.exec("wpctl", ["set-mute", WPCTL_SINK, "toggle"]);
    } else {
      await this.exec("pactl", ["set-sink-mute", PACTL_SINK, "toggle"]);
    }
  }
}
