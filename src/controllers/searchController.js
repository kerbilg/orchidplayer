const MAX_RESULTS = 100;

export class SearchController {
  constructor(mpcClient) {
    this.mpcClient = mpcClient;
    this.query = "";
    this.onQueryChanged = null;
    this.onSearchStatus = null;
    this.onSearchResults = null;
  }

  handleKey(key) {
    if (key === "backspace") {
      // Array.from, damit auch Emoji etc. als ganzes Zeichen gelöscht werden
      this.query = Array.from(this.query).slice(0, -1).join("");
      this.onQueryChanged?.(this.query);
      this.onSearchResults?.([]);
      return;
    }

    if (key === "enter") {
      void this.submit();
      return;
    }

    this.query += key;
    this.onQueryChanged?.(this.query);
    this.onSearchResults?.([]);
  }

  async submit() {
    const q = this.query.trim();
    if (!q) return;

    this.onSearchStatus?.(`Suche nach „${q}“ …`);
    try {
      const songs = await this.mpcClient.search(q);
      const capped = songs.length > MAX_RESULTS;
      const entries = songs.slice(0, MAX_RESULTS).map((song) => ({
        title: song.title ?? song.path,
        artist: song.artist ?? "",
        uri: song.path,
      }));

      this.onSearchResults?.(entries);
      if (songs.length === 0) {
        this.onSearchStatus?.(`Keine Treffer für „${q}“`);
      } else {
        this.onSearchStatus?.(capped
          ? `${songs.length} Treffer für „${q}“ (erste ${MAX_RESULTS})`
          : `${songs.length} Treffer für „${q}“`);
      }
    } catch (error) {
      console.error(error);
      this.onSearchResults?.([]);
      this.onSearchStatus?.("Suche fehlgeschlagen.");
    }
  }
}
