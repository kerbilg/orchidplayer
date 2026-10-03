import * as slint from "slint-ui";
import { getSetting, setSetting } from "./settings.js";
import { MPC } from 'mpc-js';

const mpc = new MPC();
await mpc.connectTCP(getSetting("mpd_host"), getSetting("mpd_port"));

mpc.playback.play();

const ui = slint.loadFile("ui/main.slint", {
    style: "fluent-light"
});
const app = new ui.MainWindow();

const callbackHandler = app.CallbackHandler;

callbackHandler.nextClicked = () => {
    mpc.playback.next();
}

callbackHandler.previousClicked = () => {
    mpc.playback.previous();
}

callbackHandler.playPauseClicked = async () => {
    mpc.status.status().then(status => {
        if (status.state === 'play') {
            return mpc.playback.pause();
        } else {
            return mpc.playback.play();
        }
    })
}

mpc.on('changed-player', () => {
    mpc.status.currentSong().then(song => {
        callbackHandler.currentTitle = song?.title ?? "";
        callbackHandler.currentArtist = song?.artist ?? "";
    }).catch(console.error);
});

app.show();

await slint.runEventLoop();