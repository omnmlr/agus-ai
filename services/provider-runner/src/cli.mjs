import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AndroidDevice } from "./android.mjs";
import { readConfig } from "./config.mjs";
import { emergencyStopFilename, makeApi, RunnerFailure } from "./protocol.mjs";
import { runProvider } from "./runner.mjs";

const [, , ...argv] = process.argv;
const once = argv.includes("--once");
const stop = argv.includes("--stop");
const reconcileOnly = argv.includes("--reconcile");
const positional = argv.filter((arg) => !["--once", "--stop", "--reconcile"].includes(arg));
if (positional.length !== 1 || (!stop && !process.env.AGUS_CONTROL_PLANE_URL) ||
    Number(once) + Number(stop) + Number(reconcileOnly) > 1) {
  console.error("Pass the runner configuration with at most one option (--once, --stop, --reconcile). Set AGUS_CONTROL_PLANE_URL when online.");
  process.exitCode = 1;
} else {
  const abort = new AbortController();
  const shutdown = () => abort.abort(new RunnerFailure("SHUTDOWN"));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  try {
    const config = await readConfig(positional[0]);
    const endpoint = process.env.AGUS_CONTROL_PLANE_URL;
    if (stop) {
      await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 });
      await writeFile(join(config.stateDirectory, emergencyStopFilename), "", { mode: 0o600, flag: "a" });
      console.log("Local emergency stop requested.");
    } else {
      await runProvider({
        api: makeApi(endpoint),
        config,
        endpoint,
        credential: {
          pairingCode: process.env.AGUS_PROVIDER_PAIRING_CODE,
          bootstrapToken: process.env.AGUS_PROVIDER_ENROLLMENT_TOKEN,
        },
        device: new AndroidDevice(config.device),
        signal: abort.signal,
        once,
        reconcileOnly,
      });
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      console.error("Provider stopped with " + (error instanceof RunnerFailure ? error.code : "CONFIG_OR_NETWORK"));
      process.exitCode = 1;
    }
  } finally {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
  }
}
