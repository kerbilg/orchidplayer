import sharp from "sharp";

function isMissingArtError(error) {
  return error?.errorCode === 50 || String(error?.errorMessage ?? error?.message ?? "").includes("No file exists");
}

export class AlbumArtService {
  constructor(mpcClient) {
    this.mpcClient = mpcClient;
  }

  async loadForSong(song) {
    if (!song?.path) return null;

    let picture;
    try {
      picture = await this.mpcClient.getAlbumArt(song.path);
    } catch (error) {
      if (!isMissingArtError(error)) console.error(error);
    }

    if (!picture) {
      try {
        picture = await this.mpcClient.getPicture(song.path);
      } catch (error) {
        if (!isMissingArtError(error)) console.error(error);
      }
    }

    if (!picture?.data) return null;

    try {
      const { data, info } = await sharp(Buffer.from(picture.data))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return { data, width: info.width, height: info.height };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
