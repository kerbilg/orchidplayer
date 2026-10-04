import { createSettingsStore } from "./settings/settingsStore.js";
import { MpcClient } from "./services/mpcClient.js";
import { AlbumArtService } from "./services/albumArtService.js";
import { PlayerState } from "./state/playerState.js";
import { PlayerController } from "./controllers/playerController.js";
import { SearchController } from "./controllers/searchController.js";
import { VolumeController } from "./controllers/volumeController.js";
import { VolumeService } from "./services/volumeService.js";
import { SlintApp } from "./ui/slintApp.js";

export async function createApp() {
  const settings = createSettingsStore();
  const mpcClient = new MpcClient(settings);
  const playerState = new PlayerState();
  const albumArtService = new AlbumArtService(mpcClient);
  const playerController = new PlayerController(mpcClient, playerState, albumArtService);
  const searchController = new SearchController(mpcClient);
  const volumeService = new VolumeService();
  const volumeController = new VolumeController(volumeService, playerState);
  const ui = new SlintApp(playerController, playerState, settings, searchController, volumeController);

  // Nicht fatal: Ohne Verbindung startet die UI trotzdem, damit z. B. ein
  // falsch gespeicherter Host in den Einstellungen korrigiert werden kann.
  mpcClient.connect().catch((error) => console.error("MPD-Verbindung fehlgeschlagen:", error));
  playerController.start();
  volumeController.start();
  ui.bind();

  return {
    settings,
    mpcClient,
    playerState,
    playerController,
    searchController,
    volumeController,
    ui,
  };
}

export async function run() {
  const app = await createApp();
  app.mpcClient.play().catch(() => {});
  app.ui.show();
  await app.ui.run();
}
