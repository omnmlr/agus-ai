import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  FAKE_WALLET_SHA,
  FIXTURE,
  RunnerFailure,
  packagePattern,
  publicKeyPattern,
  safeId,
  scenarios,
  shaPattern,
} from "./protocol.mjs";

export function parseConfig(raw, baseDirectory) {
  if (!raw || typeof raw.displayName !== "string" || !raw.displayName.trim() || raw.displayName.length > 80 ||
      typeof raw.stateDirectory !== "string" || !raw.stateDirectory ||
      !raw.device || raw.device.dedicated !== true ||
      typeof raw.device.id !== "string" || !safeId.test(raw.device.id) || !/^[a-zA-Z0-9]/.test(raw.device.id) ||
      typeof raw.device.serial !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.device.serial) ||
      !["emulator", "android-device"].includes(raw.device.kind) ||
      !Array.isArray(raw.approvedBuilds) || !raw.approvedBuilds.length || raw.approvedBuilds.length > 50 ||
      raw.approvedBuilds.some((build) => !build || !packagePattern.test(build.packageName) ||
        !shaPattern.test(build.sha256) || !Array.isArray(build.scenarios) || !build.scenarios.length ||
        build.scenarios.some((name) => !scenarios.includes(name) || (name !== "app-launch" && build.packageName !== FIXTURE))) ||
      (raw.allowedDeveloperEmails !== undefined && (!Array.isArray(raw.allowedDeveloperEmails) ||
        raw.allowedDeveloperEmails.length > 50 || raw.allowedDeveloperEmails.some((email) =>
          typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))) ||
      (raw.payoutWallet !== undefined && !publicKeyPattern.test(raw.payoutWallet)) ||
      (raw.planner !== undefined && !["remote", "local", "gemini"].includes(raw.planner))) {
    throw new RunnerFailure("CONFIG_INVALID");
  }
  const supportedScenarios = [...new Set(raw.approvedBuilds.flatMap((build) => build.scenarios))];
  if (supportedScenarios.some((name) => name !== "app-launch") && (
    !raw.wallet || typeof raw.wallet.apkPath !== "string" || !raw.wallet.apkPath ||
    raw.wallet.sha256 !== FAKE_WALLET_SHA
  )) throw new RunnerFailure("CONFIG_TEST_WALLET");
  if (supportedScenarios.some((name) => name !== "app-launch") &&
      (!raw.localnet || !publicKeyPattern.test(raw.localnet.genesis))) {
    throw new RunnerFailure("CONFIG_LOCALNET");
  }
  return {
    displayName: raw.displayName.trim(),
    stateDirectory: resolve(baseDirectory, raw.stateDirectory),
    device: raw.device,
    approvedBuilds: raw.approvedBuilds,
    supportedScenarios,
    allowedDeveloperEmails: [...new Set((raw.allowedDeveloperEmails ?? []).map((email) => email.trim().toLowerCase()))].sort(),
    payoutWallet: raw.payoutWallet,
    planner: raw.planner ?? "remote",
    walletPath: raw.wallet ? resolve(baseDirectory, raw.wallet.apkPath) : undefined,
    localnet: raw.localnet,
  };
}

export async function readConfig(path) {
  const absolutePath = resolve(path);
  const raw = (await readFile(absolutePath, "utf8")).replace(/^\uFEFF/, "");
  return parseConfig(JSON.parse(raw), dirname(absolutePath));
}
