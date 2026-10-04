import * as slint from "slint-ui";
import { DEFAULT_SETTINGS, PATHS } from "../config/defaults.js";

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export class SlintApp {
  constructor(playerController, playerState, settings, searchController) {
    this.playerController = playerController;
    this.playerState = playerState;
    this.settings = settings;
    this.searchController = searchController;
    this.ui = slint.loadFile(PATHS.mainUi, { style: "fluent-light" });
    this.app = new this.ui.MainWindow();
    this.callbackHandler = this.app.CallbackHandler;
  }

  bind() {
    this.bindSettings();
    this.bindSearch();
    this.bindPlaylists();

    this.callbackHandler.nextClicked = () => {
      void this.playerController.next();
    };

    this.callbackHandler.seekRequested = (position) => {
      void this.playerController.seekTo(position);
    };

    this.callbackHandler.previousClicked = () => {
      void this.playerController.previous();
    };

    this.callbackHandler.playPauseClicked = () => {
      void this.playerController.togglePlayPause();
    };

    this.playerState.subscribe(({ currentTitle, currentArtist, albumArt, position, duration, playState }) => {
      this.callbackHandler.currentTitle = currentTitle;
      this.callbackHandler.currentArtist = currentArtist;
      this.callbackHandler.hasAlbumArt = albumArt != null;
      if (albumArt) {
        this.callbackHandler.albumArt = albumArt;
      }

      this.callbackHandler.playState = playState;
      this.callbackHandler.positionText = formatTime(position);
      this.callbackHandler.durationText = formatTime(duration);

      if (!this.callbackHandler.sliderDragging) {
        this.callbackHandler.sliderValue = position;
        this.callbackHandler.duration = duration > 0 ? duration : 100;
      }
    });
  }

  bindSettings() {
    this.callbackHandler.mpdHost = this.settings.get("mpd_host") ?? DEFAULT_SETTINGS.mpd_host;
    this.callbackHandler.mpdPort = String(this.settings.get("mpd_port") ?? DEFAULT_SETTINGS.mpd_port);
    this.callbackHandler.settingsStatus = "";
    this.callbackHandler.settingsFocus = "host";

    this.callbackHandler.saveSettings = (host, portText) => this.saveSettings(host, portText);

    this.callbackHandler.settingsKeyPressed = (key) => {
      const prop = this.callbackHandler.settingsFocus === "port" ? "mpdPort" : "mpdHost";
      let value = this.callbackHandler[prop] ?? "";

      if (key === "backspace") {
        // Array.from, damit auch Emoji etc. als ganzes Zeichen gelöscht werden
        value = Array.from(value).slice(0, -1).join("");
      } else if (key === "enter") {
        this.saveSettings(this.callbackHandler.mpdHost, this.callbackHandler.mpdPort);
        return;
      } else {
        value += key;
      }

      this.callbackHandler[prop] = value;
      this.callbackHandler.settingsStatus = "";
    };
  }

  saveSettings(host, portText) {
    const cleanHost = String(host ?? "").trim();
    const port = Number(String(portText ?? "").trim());

    if (!cleanHost) {
      this.callbackHandler.settingsStatus = "Ungültiger Host.";
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.callbackHandler.settingsStatus = "Ungültiger Port (1–65535).";
      return;
    }

    const connectionChanged =
      cleanHost !== (this.settings.get("mpd_host") ?? DEFAULT_SETTINGS.mpd_host) ||
      String(port) !== (this.settings.get("mpd_port") ?? String(DEFAULT_SETTINGS.mpd_port));

    this.settings.set("mpd_host", cleanHost);
    this.settings.set("mpd_port", String(port));
    this.callbackHandler.mpdHost = cleanHost;
    this.callbackHandler.mpdPort = String(port);

    if (!connectionChanged) {
      this.callbackHandler.settingsStatus = "Gespeichert.";
      return;
    }

    this.callbackHandler.settingsStatus = "Gespeichert – verbinde neu…";
    this.playerController.reconnect().then(
      () => {
        this.callbackHandler.settingsStatus = "Gespeichert – verbunden.";
      },
      (error) => {
        console.error(error);
        this.callbackHandler.settingsStatus = "Gespeichert – Verbindung fehlgeschlagen.";
      }
    );
  }

  bindSearch() {
    this.callbackHandler.searchQuery = this.searchController.query;
    this.callbackHandler.searchStatus = "";
    this.callbackHandler.searchResults = [];

    this.callbackHandler.oskKeyPressed = (key) => {
      this.searchController.handleKey(key);
    };

    this.callbackHandler.songSelected = (uri, title) => {
      this.callbackHandler.searchStatus = `Spiele „${title}“ …`;
      this.playerController.playSong(uri).then(
        () => {
          this.callbackHandler.searchStatus = "";
        },
        (error) => {
          console.error(error);
          this.callbackHandler.searchStatus = "Abspielen fehlgeschlagen.";
        }
      );
    };

    this.searchController.onQueryChanged = (query) => {
      this.callbackHandler.searchQuery = query;
      this.callbackHandler.searchStatus = "";
    };

    this.searchController.onSearchStatus = (status) => {
      this.callbackHandler.searchStatus = status;
    };

    this.searchController.onSearchResults = (results) => {
      this.callbackHandler.searchResults = results;
    };
  }

  bindPlaylists() {
    this.callbackHandler.playlists = [];

    this.callbackHandler.playlistsRefreshRequested = () => {
      void this.refreshPlaylists();
    };

    this.callbackHandler.playlistSelected = (name) => {
      this.playerController.playPlaylist(name).catch((error) => console.error(error));
    };
  }

  async refreshPlaylists() {
    try {
      this.callbackHandler.playlists = await this.playerController.getPlaylists();
    } catch (error) {
      console.error(error);
      this.callbackHandler.playlists = [];
    }
  }

  show() {
    this.app.show();
  }

  run() {
    return slint.runEventLoop();
  }
}
