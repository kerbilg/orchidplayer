import { run } from "./app.js";

// mpc-js erzeugt bei Verbindungsabbrüchen intern unhandled Rejections
// (cancel() auf bereits fehlerhafte Streams) – loggen statt abstürzen.
process.on("unhandledRejection", (reason) => {
  console.error("Unbehandelte Promise-Ablehnung:", reason);
});

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
