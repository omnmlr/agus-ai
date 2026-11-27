import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deviceMeasurements, parseUi } from "../../../packages/mobile-test/src/android.ts";
import { FAKE_WALLET, FIXTURE, RunnerFailure, packagePattern, sha256 } from "./protocol.mjs";

const exec = promisify(execFile);
const imageHeader = Buffer.from("89504e470d0a1a0a", "hex");
const batteryHealth = ["unknown", "unknown", "good", "overheat", "dead", "overvoltage", "failure", "cold"];
const thermalStatus = ["none", "light", "moderate", "severe", "critical", "emergency", "shutdown"];

function kibibytes(value) {
  if (!/^\d+$/.test(value)) return null;
  const bytes = Number(value) * 1024;
  return Number.isSafeInteger(bytes) ? bytes : null;
}

export class AndroidDevice {
  constructor(device, {
    adb = process.env.AGUS_ADB || "adb", aapt = process.env.AGUS_AAPT || "aapt", commandTimeoutMs = 8_000,
  } = {}) {
    this.device = device;
    this.adb = adb;
    this.aapt = aapt;
    this.commandTimeoutMs = commandTimeoutMs;
  }

  async command(args, signal, timeout = 8_000) {
    try {
      const { stdout } = await exec(this.adb, [
        "-H", "127.0.0.1", "-P", "5037", "-s", this.device.serial, ...args,
      ], { encoding: "buffer", maxBuffer: 10 * 1024 * 1024, timeout: Math.max(timeout, this.commandTimeoutMs), signal, windowsHide: true });
      return stdout;
    } catch {
      signal?.throwIfAborted();
      throw new RunnerFailure("ANDROID_COMMAND");
    }
  }

  async shell(args, signal, timeout) {
    const bytes = await this.command(["shell", ...args], signal, timeout);
    return bytes.toString("utf8").trim();
  }

  async profile(signal) {
    const collect = (args) => this.shell(args, signal).catch((error) => {
      signal?.throwIfAborted();
      if (error instanceof RunnerFailure) return "";
      throw error;
    });
    const [state, model, manufacturer, sdk, release, qemu, hardware, bootcomplete, currentUser] = await Promise.all([
      this.command(["get-state"], signal),
      collect(["getprop", "ro.product.model"]),
      collect(["getprop", "ro.product.manufacturer"]),
      collect(["getprop", "ro.build.version.sdk"]),
      collect(["getprop", "ro.build.version.release"]),
      collect(["getprop", "ro.kernel.qemu"]),
      collect(["getprop", "ro.boot.qemu"]),
      collect(["getprop", "sys.boot_completed"]),
      collect(["am", "get-current-user"]),
    ]);
    const emulator = qemu === "1" || hardware === "1" || this.device.serial.startsWith("emulator-");
    if (state.toString().trim() !== "device" || bootcomplete !== "1" || currentUser !== "0" ||
        emulator !== (this.device.kind === "emulator") || !/^\d{2}$/.test(sdk)) {
      throw new RunnerFailure("DEVICE_UNAVAILABLE");
    }
    const [battery, memory, storage, brand, thermal, wifi] = await Promise.all([
      collect(["dumpsys", "battery"]),
      collect(["cat", "/proc/meminfo"]),
      collect(["df", "-k", "/data"]),
      collect(["getprop", "ro.product.brand"]),
      collect(["dumpsys", "thermalservice"]),
      collect(["cat", "/sys/class/net/wlan0/operstate"]),
    ]);
    const healthCode = battery.match(/^\s*health: (\d+)\s*$/m)?.[1];
    const chargeCode = battery.match(/^\s*status: (\d+)\s*$/m)?.[1];
    const powered = /^\s*(?:AC|USB|Wireless|Dock) powered: true\s*$/m.test(battery);
    const thermalCode = thermal.match(/^\s*Thermal Status: (\d+)\s*$/m)?.[1];
    const deviceLabel = (value) => /^[a-zA-Z0-9 _./()-]{1,60}$/.test(value) ? value : null;
    return {
      kind: emulator ? "emulator" : "physical",
      measuredAt: new Date().toISOString(),
      source: emulator ? "emulated_android" : "runner_observed_android",
      manufacturer: deviceLabel(manufacturer),
      model: deviceLabel(model),
      androidVersion: /^[0-9.]{1,12}$/.test(release) ? release : null,
      apiLevel: Number(sdk),
      ...deviceMeasurements(battery, memory, storage, brand),
      memoryTotalBytes: kibibytes(memory.match(/^MemTotal:\s+(\d+) kB/m)?.[1]),
      dataTotalBytes: kibibytes(storage.split("\n").at(-1)?.trim().split(/\s+/)[1]),
      networkLatencyMs: null,
      throughputMbps: null,
      ...(batteryHealth[healthCode] ? { batteryHealth: batteryHealth[healthCode] } : {}),
      ...(thermalStatus[thermalCode] ? { thermalStatus: thermalStatus[thermalCode] } : {}),
      ...(["2", "3", "4", "5"].includes(chargeCode) ? { charging: chargeCode === "2" || (chargeCode === "5" && powered) } : {}),
      ...(["up", "down"].includes(wifi) ? { wifiConnected: wifi === "up" } : {}),
      hardwareAttested: false,
      seekerVerified: false,
    };
  }

  async packageOf(file, signal) {
    try {
      const { stdout } = await exec(this.aapt, ["dump", "badging", file], {
        encoding: "utf8", timeout: 12_000, maxBuffer: 1024 * 1024, signal, windowsHide: true,
      });
      const name = stdout.match(/^package: name='([^']+)' /m)?.[1];
      if (!name || !packagePattern.test(name)) throw new RunnerFailure("APK_MANIFEST");
      return name;
    } catch {
      signal?.throwIfAborted();
      throw new RunnerFailure("APK_MANIFEST");
    }
  }

  async present(packageName, signal) {
    const output = await this.shell(["pm", "list", "packages", "--user", "0", packageName], signal);
    if (output && output.split("\n").some((line) => !line.startsWith("package:"))) {
      throw new RunnerFailure("APK_PACKAGE_STATE");
    }
    return output.split("\n").includes("package:" + packageName);
  }

  async installedTestWalletDigest(signal) {
    const location = await this.shell(["pm", "path", "--user", "0", FAKE_WALLET], signal);
    const match = /^package:(\/data\/app\/(?:~~[\w+=-]+\/)?com\.solana\.mobilewalletadapter\.fakewallet-[\w+=-]+\/base\.apk)$/.exec(location);
    if (!match) throw new RunnerFailure("DEVNET_WALLET_NOT_PREPARED");
    const bytes = await this.command(["exec-out", "cat", match[1]], signal);
    return sha256(bytes);
  }

  async install(path, signal) {
    const result = (await this.command(["install", "--user", "0", path], signal, 75_000)).toString();
    if (!/^Success\s*$/m.test(result)) throw new RunnerFailure("APK_INSTALL");
  }

  async launch(packageName, signal) {
    const entries = await this.shell([
      "cmd", "package", "resolve-activity", "--brief", "-a", "android.intent.action.MAIN",
      "-c", "android.intent.category.LAUNCHER", packageName,
    ], signal);
    const component = entries.split("\n").at(-1);
    if (!component?.startsWith(packageName + "/") || !/^[A-Za-z0-9_.$]+\/[A-Za-z0-9_.$]+$/.test(component)) {
      throw new RunnerFailure("APP_LAUNCH");
    }
    const result = await this.shell(["am", "start", "-S", "-W", "-n", component], signal, 30_000);
    if (!/^Status: ok\s*$/m.test(result) || await this.focused(signal) !== packageName) {
      throw new RunnerFailure("APP_LAUNCH");
    }
  }

  async focused(signal) {
    const windows = await this.shell(["dumpsys", "window"], signal);
    return windows.match(/mCurrentFocus=Window\{[^\n]*\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$]+/)?.[1] ?? null;
  }

  async observe(approved, signal) {
    const focused = await this.focused(signal);
    if (!approved.has(focused)) return { focused: null, nodes: [] };
    const result = (await this.command(["exec-out", "uiautomator", "dump", "/dev/tty"], signal)).toString("utf8");
    const start = result.indexOf("<?xml");
    const end = result.lastIndexOf("</hierarchy>");
    if (start < 0 || end < start) throw new RunnerFailure("ANDROID_OBSERVATION");
    if (await this.focused(signal) !== focused) return { focused: null, nodes: [] };
    const nodes = parseUi(result.slice(start, end + "</hierarchy>".length), new Set([focused]));
    return { focused, nodes };
  }

  async tap(node, signal) {
    const [left, top, right, bottom] = node.bounds;
    if (!node.clickable || ![FAKE_WALLET, FIXTURE].includes(node.package) ||
        await this.focused(signal) !== node.package) throw new RunnerFailure("ACTION_SCOPE");
    await this.shell([
      "input", "tap", String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2)),
    ], signal);
  }

  async screenshot(approved, signal) {
    const focused = await this.focused(signal);
    if (!approved.has(focused)) throw new RunnerFailure("CAPTURE_SCOPE");
    const data = await this.command(["exec-out", "screencap", "-p"], signal);
    if (await this.focused(signal) !== focused || !data.subarray(0, 8).equals(imageHeader)) {
      throw new RunnerFailure("CAPTURE_SCOPE");
    }
    return data;
  }

  async timestamp(signal) {
    const value = await this.shell(["date", "+%s.%3N"], signal);
    if (!/^\d{10}\.\d{3}$/.test(value)) throw new RunnerFailure("ANDROID_TIME");
    return Number(value);
  }

  async callback(since, signal) {
    const pid = await this.shell(["pidof", FIXTURE], signal);
    if (!/^\d+$/.test(pid)) return null;
    const raw = await this.command([
      "logcat", "-t", "400", "-v", "threadtime", "-v", "epoch", "-v", "usec", "--pid=" + pid,
      "-s", "AGUS_TEST:I",
    ], signal);
    const events = raw.toString("utf8").split("\n").flatMap((line) => {
      const matched = line.match(/^\s*(\d+\.\d+)\s+\d+\s+\d+\s+I\s+AGUS_TEST\s*:\s*(\{.*\})\s*$/);
      return matched && Number(matched[1]) > since ? [matched[2]] : [];
    });
    if (events.length > 1) throw new RunnerFailure("CALLBACK_INVALID");
    if (!events.length) return null;
    try {
      const value = JSON.parse(events[0]);
      if (value.outcome === "failed" && ["NO_WALLET", "DECLINED", "ASSOCIATION", "PREPARE", "WALLET_ERROR"].includes(value.code)) {
        return { outcome: "failed", code: value.code };
      }
      if (value.outcome === "submitted" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.payer) &&
          /^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(value.signature)) {
        return { outcome: "submitted", payer: value.payer, signature: value.signature };
      }
    } catch { /* Invalid fixture output is reported with a fixed code. */ }
    throw new RunnerFailure("CALLBACK_INVALID");
  }

  async cleanup(packageName, signal) {
    if (!await this.present(packageName, signal)) return;
    await this.shell(["am", "force-stop", "--user", "0", packageName], signal);
    const result = await this.shell(["pm", "uninstall", "--user", "0", packageName], signal, 20_000);
    if (!/^Success\s*$/m.test(result) || await this.present(packageName, signal)) {
      throw new RunnerFailure("CLEANUP_FAILED");
    }
  }
}
