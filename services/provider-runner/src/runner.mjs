import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { executeJob } from "./job.mjs";
import { emergencyStopFilename, RunnerFailure, safeId, sha256, stableJson, validateJob } from "./protocol.mjs";

function errorCode(error) {
  return error instanceof RunnerFailure ? error.code : "RUNNER_UNAVAILABLE";
}

async function readIdentity(path, endpoint, policyHash) {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    if (state.endpoint !== endpoint || state.policyHash !== policyHash ||
        typeof state.providerId !== "string" || !safeId.test(state.providerId) ||
        typeof state.token !== "string" || !state.token ||
        createPrivateKey(state.privateKeyPem).asymmetricKeyType !== "ed25519") {
      throw new RunnerFailure("IDENTITY_SCOPE");
    }
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof RunnerFailure) throw error;
    throw new RunnerFailure("IDENTITY_INVALID");
  }
}

function enrollmentScope(config) {
  return sha256(stableJson({
    allowedDeveloperEmails: config.allowedDeveloperEmails,
    payoutWallet: config.payoutWallet ?? null,
    deviceId: config.device.id,
  }));
}

async function enroll(api, config, endpoint, credential, profile, signal) {
  const path = join(config.stateDirectory, "identity.json");
  const policyHash = enrollmentScope(config);
  if (!credential.pairingCode && !credential.bootstrapToken) throw new RunnerFailure("PAIRING_CODE_REQUIRED");
  if (!credential.pairingCode && !config.allowedDeveloperEmails.length) throw new RunnerFailure("LEGACY_EMAIL_SCOPE_REQUIRED");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const result = await api.enroll(credential.pairingCode ?? credential.bootstrapToken, {
    displayName: config.displayName,
    publicKeyPem: publicKey,
    devices: [advertise(config, profile, true)],
    ...(!credential.pairingCode ? { allowedDeveloperEmails: config.allowedDeveloperEmails } : {}),
    ...(config.payoutWallet ? { payoutWallet: config.payoutWallet } : {}),
  }, signal);
  if (typeof result.token !== "string" || !result.token ||
      typeof result.providerId !== "string" || !safeId.test(result.providerId)) {
    throw new RunnerFailure("ENROLLMENT_RESPONSE");
  }
  const state = { endpoint, policyHash, providerId: result.providerId, token: result.token, privateKeyPem: privateKey };
  const pending = path + ".tmp";
  await writeFile(pending, JSON.stringify(state) + "\n", { mode: 0o600, flag: "wx" });
  await rename(pending, path);
  return state;
}

function advertise(config, profile, ready) {
  return {
    id: config.device.id,
    profile: { ...profile, walletNetwork: config.devnet ? "devnet" : config.localnet ? "localnet" : null },
    scenarios: config.supportedScenarios,
    dedicated: true,
    online: true,
    ready,
  };
}

async function finish(api, rawJob, result) {
  let lastError;
  const { status, cleaned, envelope } = result;
  const localEmergency = ["LOCAL_EMERGENCY_STOP", "SHUTDOWN"].includes(status);
  for (let index = 0; index < 3; index++) {
    try {
      if (index !== 0 || status) {
        const current = await api.status(rawJob);
        if (current.status === "completed") return;
        if (["stopping", "cancelled", "expired"].includes(current.status) || (localEmergency && current.status === "running")) {
          if (cleaned) await api.release(rawJob, { localEmergency });
          return;
        }
        if (current.status === "verifying") {
          await delay(1_000);
          continue;
        }
      }
      await api.report(rawJob, envelope);
      return;
    } catch (error) {
      lastError = error;
      await delay(750);
    }
  }
  throw lastError ?? new RunnerFailure("REPORT_PENDING");
}

async function acquireLock(path) {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST") throw new RunnerFailure("LOCAL_DEVICE_LOCKED");
    throw error;
  }
}

async function resumeReport(api, path) {
  let pending;
  try {
    pending = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw new RunnerFailure("REPORT_STATE_INVALID");
  }
  const job = validateJob(pending.job);
  const { result } = pending;
  if (!result?.cleaned || result.envelope?.runId !== job.runId || result.envelope?.leaseId !== job.leaseId) {
    throw new RunnerFailure("REPORT_STATE_INVALID");
  }
  await finish(api, job, result);
  await rm(path);
}

async function checkEmergencyStop(path, abort) {
  try {
    await access(path);
    abort.abort(new RunnerFailure("LOCAL_EMERGENCY_STOP"));
  } catch (error) {
    if (error.code !== "ENOENT") abort.abort(new RunnerFailure("LOCAL_EMERGENCY_STOP"));
  }
}

export async function runProvider({
  api, config, endpoint, credential, device, signal: shutdown, once = false, reconcileOnly = false,
  log = console.log, execute = executeJob, lockDirectory = tmpdir(),
}) {
  const normalizedEndpoint = new URL(endpoint).origin;
  const key = sha256(config.device.serial).slice(0, 20);
  const deviceLock = join(lockDirectory, "agus-test-" + (process.getuid?.() ?? "user") + "-" + key + ".lock");
  const stateLock = join(config.stateDirectory, "active.lock");
  const pending = join(config.stateDirectory, "pending-report.json");
  const emergencyPath = join(config.stateDirectory, emergencyStopFilename);
  const emergency = new AbortController();
  const signal = AbortSignal.any([shutdown, emergency.signal]);
  let checkTimer;
  let holdLocks = false;
  let identity;
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 });
  await acquireLock(deviceLock);
  let ownsStateLock = false;
  try {
    await acquireLock(stateLock);
    ownsStateLock = true;
    identity = await readIdentity(join(config.stateDirectory, "identity.json"), normalizedEndpoint, enrollmentScope(config));
    if (identity) await resumeReport(api, pending);
    if (reconcileOnly) return;
    await checkEmergencyStop(emergencyPath, emergency);
    signal.throwIfAborted();
    checkTimer = setInterval(() => { void checkEmergencyStop(emergencyPath, emergency); }, 300);
    checkTimer.unref();
    const initial = await device.profile(signal);
    identity ??= await enroll(api, config, normalizedEndpoint, credential ?? {}, initial, signal);
    log("Provider enrolled for device " + config.device.id);
    let profile = initial;
    let profiledAt = Date.now();
    do {
      if (Date.now() - profiledAt > 6_000) {
        profile = await device.profile(signal).catch(() => null);
        profiledAt = Date.now();
      }
      signal.throwIfAborted();
      await api.heartbeat(identity.token, profile ? [advertise(config, profile, true)] : [], signal);
      if (!profile) {
        if (once) throw new RunnerFailure("DEVICE_UNAVAILABLE");
        await delay(2_000, undefined, { signal });
        continue;
      }
      const { job } = await api.claim(identity.token, config.device.id, config.approvedBuilds, signal);
      if (job) {
        holdLocks = true;
        const stopHeartbeat = new AbortController();
        const heartbeatSignal = AbortSignal.any([signal, stopHeartbeat.signal]);
        const heartbeat = (async () => {
          while (!heartbeatSignal.aborted) {
            await delay(6_000, undefined, { signal: heartbeatSignal });
            await api.heartbeat(identity.token, [advertise(config, profile, false)], heartbeatSignal);
          }
        })().catch((error) => {
          if (!heartbeatSignal.aborted) log("Active heartbeat failed with " + errorCode(error));
        });
        let outcome;
        try {
          outcome = await execute({ api, config, identity, device, rawJob: job, shutdown: signal });
        } finally {
          stopHeartbeat.abort();
          await heartbeat;
        }
        await checkEmergencyStop(emergencyPath, emergency);
        if (emergency.signal.aborted) outcome.status = "LOCAL_EMERGENCY_STOP";
        if (!outcome.cleaned) {
          await api.heartbeat(identity.token, [], undefined).catch(() => {});
          await finish(api, job, outcome).catch(() => {});
          throw new RunnerFailure("DEVICE_QUARANTINED");
        }
        await writeFile(pending + ".tmp", JSON.stringify({ job, result: outcome }) + "\n", { mode: 0o600 });
        await rename(pending + ".tmp", pending);
        holdLocks = false;
        for (;;) {
          try {
            await resumeReport(api, pending);
            break;
          } catch (error) {
            if (once || signal.aborted) throw error;
            log("Waiting to reconcile the cleaned lease after " + errorCode(error));
            await delay(5_000, undefined, { signal });
          }
        }
        log("Execution finished with " + outcome.envelope.report.outcome);
        if (signal.aborted) break;
        profile = await device.profile(signal).catch(() => null);
        profiledAt = Date.now();
        await api.heartbeat(identity.token, profile ? [advertise(config, profile, true)] : [], signal);
      }
      if (!once) await delay(2_000, undefined, { signal });
    } while (!once && !signal.aborted);
  } finally {
    clearInterval(checkTimer);
    if (identity) await api.heartbeat(identity.token, [], undefined).catch(() => {});
    if (!holdLocks) {
      if (ownsStateLock) await rm(stateLock, { recursive: true, force: true });
      await rm(deviceLock, { recursive: true, force: true });
    }
  }
}
