import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { assertSolTransfer, connection, finalizedTransaction, startWindow } from "../../../packages/mobile-test/src/chain.ts";
import { Evaluation } from "./evaluation.mjs";
import {
  FAKE_WALLET,
  FAKE_WALLET_SHA,
  FIXTURE_AMOUNT,
  FIXTURE_RECIPIENT,
  MAX_APK_BYTES,
  RunnerFailure,
  sha256,
  signedReport,
  stableJson,
  validateJob,
} from "./protocol.mjs";

const screenshotBytes = 1024 * 1024;
const attachmentsBytes = 3 * screenshotBytes;
const allowedFault = /^[A-Z][A-Z0-9_]{2,55}$/;

function failureCode(error) {
  return typeof error?.code === "string" && allowedFault.test(error.code) ? error.code : "RUNNER_JOB";
}

async function stage(stream, file, expectedSha, signal) {
  const hash = createHash("sha256");
  let bytes = 0;
  await pipeline(stream, new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_APK_BYTES) return callback(new RunnerFailure("APK_SIZE"));
      hash.update(chunk);
      callback(null, chunk);
    },
  }), createWriteStream(file, { flags: "wx", mode: 0o600 }), { signal });
  if (bytes === 0 || hash.digest("hex") !== expectedSha) throw new RunnerFailure("APK_DIGEST");
}

function walletSpec(config, job) {
  if (!["wallet-transfer", "wallet-false-success"].includes(job.scenario)) return null;
  const configured = config.devnet
    ? { network: "devnet", recipient: config.devnet.recipient, lamports: FIXTURE_AMOUNT, payer: config.devnet.payer }
    : { network: "localnet", recipient: FIXTURE_RECIPIENT, lamports: FIXTURE_AMOUNT };
  const expected = job.expectedTransaction;
  if ((!config.localnet && !config.devnet) || (job.scenario === "wallet-transfer" && !expected) ||
      (expected && (expected.network !== configured.network || expected.recipient !== configured.recipient ||
        expected.lamports !== configured.lamports || (configured.payer && expected.payer !== configured.payer)))) {
    throw new RunnerFailure("FIXTURE_WALLET_POLICY");
  }
  return configured;
}

function chainVerifier(config, spec) {
  const network = spec.network === "devnet" ? { cluster: "devnet" } : { cluster: "localnet", genesis: config.localnet.genesis };
  const rpc = connection(network);
  return {
    start: () => startWindow(rpc, network),
    finalize: async (transaction, window, timeout, signal) => {
      let stop;
      const cancellation = new Promise((_, reject) => {
        stop = () => reject(signal.reason);
        signal.addEventListener("abort", stop, { once: true });
      });
      try {
        signal.throwIfAborted();
        const finalized = await Promise.race([finalizedTransaction(rpc, transaction.signature, timeout), cancellation]);
        return assertSolTransfer(finalized, transaction.signature, window.slot, {
          payer: transaction.payer, recipient: spec.recipient, lamports: String(spec.lamports),
        });
      } finally {
        signal.removeEventListener("abort", stop);
      }
    },
  };
}

async function waitForCallback(device, since, signal) {
  const end = Date.now() + 20_000;
  do {
    signal.throwIfAborted();
    const callback = await device.callback(since, signal);
    if (callback) return callback;
    await delay(600, undefined, { signal });
  } while (Date.now() < end);
  throw new RunnerFailure("CALLBACK_MISSING");
}

function startLeaseMonitor(api, job, shutdown) {
  const guard = new AbortController();
  const signal = AbortSignal.any([guard.signal, shutdown]);
  const watch = (async () => {
    try {
      while (!signal.aborted) {
        if (Date.now() >= Date.parse(job.expiresAt)) throw new RunnerFailure("LEASE_EXPIRED");
        const { status } = await api.status(job, signal);
        if (status !== "running") {
          throw new RunnerFailure(["stopping", "cancelled"].includes(status) ? "LEASE_CANCELLED" :
            status === "expired" ? "LEASE_EXPIRED" : "LEASE_UNAVAILABLE");
        }
        await delay(1250, undefined, { signal });
      }
    } catch (error) {
      if (!signal.aborted) guard.abort(error instanceof RunnerFailure ? error : new RunnerFailure("LEASE_UNAVAILABLE"));
    }
  })();
  const expires = setTimeout(() => guard.abort(new RunnerFailure("LEASE_EXPIRED")),
    Math.max(0, Date.parse(job.expiresAt) - Date.now()));
  return {
    signal,
    async stop() {
      clearTimeout(expires);
      guard.abort(new RunnerFailure("LEASE_MONITOR_STOPPED"));
      await watch;
    },
  };
}

export async function executeJob({ api, config, identity, device, rawJob, shutdown, chainFactory = chainVerifier }) {
  const job = validateJob(rawJob);
  const report = {
    version: 1,
    runId: job.runId,
    leaseId: job.leaseId,
    challenge: job.challenge,
    buildSha256: job.build.sha256,
    scenario: job.scenario,
    mode: job.mode,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    outcome: "failed",
    checks: [],
    evidence: [],
    metrics: {
      actionCount: 0, invalidActions: 0, recoveryCount: 0, policyViolations: 0,
    },
    execution: {
      deviceActionCount: 0,
      planner: job.mode === "agent" ? config.planner : "scripted",
      testSpecSha256: sha256(stableJson({
        scenario: job.scenario,
        rulesVersion: 1,
        approvedPackage: job.build.packageName,
        walletDigest: job.scenario === "app-launch" ? null : FAKE_WALLET_SHA,
        expectedTransaction: job.expectedTransaction ?? null,
      })),
    },
  };
  const check = (id, passed, detail) => {
    if (!report.checks.some((entry) => entry.id === id)) report.checks.push({ id, passed, ...(detail ? { detail } : {}) });
  };
  const attachments = [];
  let attachmentBytes = 0;
  const evidenceAllowed = (kind) => {
    const permissions = job.evidence ?? { screenshots: true, logs: true, trajectory: false };
    return permissions[{ screenshot: "screenshots", log: "logs", trajectory: "trajectory" }[kind]] === true;
  };
  const collect = (kind, label, bytes) => {
    if (!evidenceAllowed(kind)) return null;
    const digest = sha256(bytes);
    const entry = { kind, sha256: digest, label };
    if (report.evidence.some(({ sha256: last }) => last === digest)) return entry;
    report.evidence.push(entry);
    if (bytes.length <= screenshotBytes && attachmentBytes + bytes.length <= attachmentsBytes) {
      attachments.push({ sha256: digest, dataBase64: bytes.toString("base64") });
      attachmentBytes += bytes.length;
    }
    return entry;
  };
  const lease = startLeaseMonitor(api, job, shutdown);
  const { signal } = lease;
  const toClean = [];
  let uncertainInstall = false;
  let staged;
  let evaluation;
  let status;
  try {
    const confirmed = await api.status(job, signal);
    if (confirmed.status !== "running") throw new RunnerFailure("LEASE_UNAVAILABLE");
    const { packageName, sha256: buildDigest } = job.build;
    if (!config.approvedBuilds.some((build) => build.packageName === packageName &&
        build.sha256 === buildDigest && build.scenarios.includes(job.scenario))) {
      throw new RunnerFailure("BUILD_NOT_APPROVED");
    }
    const spec = walletSpec(config, job);
    const verifier = spec && chainFactory(config, spec);
    const needsWallet = job.scenario !== "app-launch";
    const approvedPackages = new Set([packageName, ...(needsWallet ? [FAKE_WALLET] : [])]);
    for (const name of approvedPackages) {
      if (await device.present(name, signal)) throw new RunnerFailure("PREEXISTING_PACKAGE");
    }
    staged = await mkdtemp(join(config.stateDirectory, "job-"));
    const buildPath = join(staged, "target.apk");
    const response = await api.build(job, signal);
    if (!response.body || Number(response.headers.get("content-length")) > MAX_APK_BYTES) {
      await response.body?.cancel().catch(() => {});
      throw new RunnerFailure("APK_SIZE");
    }
    await stage(Readable.fromWeb(response.body), buildPath, buildDigest, signal);
    if (await device.packageOf(buildPath, signal) !== packageName) throw new RunnerFailure("APK_MANIFEST");
    check("approved-build", true);
    const install = async (name, path) => {
      signal.throwIfAborted();
      toClean.push(name);
      uncertainInstall = true;
      await device.install(path, signal);
      uncertainInstall = false;
    };
    if (needsWallet) {
      const walletPath = join(staged, "wallet.apk");
      await stage(createReadStream(config.walletPath), walletPath, FAKE_WALLET_SHA, signal);
      if (await device.packageOf(walletPath, signal) !== FAKE_WALLET) throw new RunnerFailure("APK_MANIFEST");
      await install(FAKE_WALLET, walletPath);
    }
    await install(packageName, buildPath);
    const window = verifier && await verifier.start(signal);
    const since = needsWallet ? await device.timestamp(signal) : 0;
    evaluation = new Evaluation({
      job, device, approvedPackages, collect, report, check, screenshotsAllowed: evidenceAllowed("screenshot"),
    });
    await evaluation.run({ api, planner: config.planner, signal });
    if (!evaluation.state.has("launched")) throw new RunnerFailure("APP_LAUNCH");
    if (needsWallet) {
      const authorized = evaluation.state.has("wallet-authorized");
      check("wallet-authorized", authorized, authorized ? undefined : "WALLET_AUTHORIZATION_MISSING");
      if (!authorized) throw new RunnerFailure("WALLET_AUTHORIZATION_MISSING");
    }
    if (spec) {
      if (!evaluation.state.has("submitted")) throw new RunnerFailure("WALLET_ACTION_MISSING");
      const transaction = await waitForCallback(device, since, signal);
      check("wallet-callback", transaction.outcome === "submitted", transaction.code);
      if (transaction.outcome !== "submitted") throw new RunnerFailure(transaction.code);
      if (spec.payer && transaction.payer !== spec.payer) throw new RunnerFailure("FIXTURE_WALLET_POLICY");
      report.transaction = {
        signature: transaction.signature, network: spec.network,
        recipient: spec.recipient, lamports: spec.lamports,
      };
      collect("log", "fixture-wallet-callback", Buffer.from(JSON.stringify(transaction)));
      try {
        const finalized = await verifier.finalize(transaction, window, job.scenario === "wallet-false-success" ? 10_000 : 45_000, signal);
        check("transaction-finalized", true);
        collect("log", "finalized-transfer", Buffer.from(JSON.stringify(finalized)));
      } catch (error) {
        check("transaction-finalized", false, failureCode(error));
        throw error;
      }
      if (job.scenario === "wallet-false-success") throw new RunnerFailure("NEGATIVE_CONTROL_FAILED");
    }
    signal.throwIfAborted();
    report.outcome = "completed";
  } catch (error) {
    const code = failureCode(signal.aborted ? signal.reason : error);
    check("workload", false, code);
    if (!report.checks.some(({ id }) => id === "approved-build")) check("approved-build", false, code);
  } finally {
    if (evaluation && !report.evidence.some(({ kind }) => kind === "trajectory")) {
      collect("trajectory", "evaluated-actions", Buffer.from(JSON.stringify(evaluation.trace)));
    }
    if (evaluation && !signal.aborted) await evaluation.capture(signal).catch(() => {});
    let cleaned = !uncertainInstall;
    for (const name of toClean.reverse()) {
      await device.cleanup(name, AbortSignal.timeout(24_000)).catch(() => { cleaned = false; });
    }
    if (staged) await rm(staged, { recursive: true, force: true }).catch(() => { cleaned = false; });
    check("cleanup", cleaned, cleaned ? undefined : "CLEANUP_UNCERTAIN");
    if (!cleaned || signal.aborted) report.outcome = "failed";
    status = signal.aborted ? failureCode(signal.reason) : null;
    await lease.stop();
  }
  report.finishedAt = new Date().toISOString();
  const cleaned = report.checks.find(({ id }) => id === "cleanup").passed;
  const envelope = { ...signedReport(report, identity.privateKeyPem), attachments };
  await writeFile(join(config.stateDirectory, "last-run.json"), JSON.stringify(envelope) + "\n", { mode: 0o600 });
  return { cleaned, status, envelope };
}
