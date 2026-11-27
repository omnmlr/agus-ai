import assert from "node:assert/strict";
import { randomBytes, verify } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createControlPlane } from "../../control-plane/src/server.mjs";
import { AndroidDevice } from "../src/android.mjs";
import { parseConfig } from "../src/config.mjs";
import {
  FAKE_WALLET,
  FAKE_WALLET_SHA,
  FIXTURE,
  FIXTURE_AMOUNT,
  FIXTURE_RECIPIENT,
  makeApi,
  RunnerFailure,
  sha256,
  stableJson,
} from "../src/protocol.mjs";
import { runProvider } from "../src/runner.mjs";

const [serial, fixturePath, walletPath, outputDirectory] = process.argv.slice(2);
if (!serial || !fixturePath || !outputDirectory) {
  throw new Error("Usage: node --import tsx services/provider-runner/test/android-acceptance.mjs SERIAL FIXTURE_APK WALLET_APK_OR_DASH OUTPUT_DIR");
}
const planner = process.env.AGUS_ANDROID_ACCEPTANCE_GEMINI === "1" ? "gemini" : "remote";
if (planner === "gemini" && !process.env.AGUS_GEMINI_API_KEY) throw new Error("Configure AGUS_GEMINI_API_KEY for model-driven acceptance");
const commandTimeout = Number(process.env.AGUS_ANDROID_ACCEPTANCE_COMMAND_TIMEOUT_MS ?? 8_000);
if (!Number.isInteger(commandTimeout) || commandTimeout < 8_000 || commandTimeout > 60_000) {
  throw new Error("Use a dedicated Android acceptance command timeout from 8000 to 60000 ms");
}
const wallet = walletPath && walletPath !== "-";
const correctionFixture = process.env.AGUS_PRODUCT_CORRECTION_FIXTURE;
if (correctionFixture && (wallet || planner !== "remote" || serial !== "emulator-5554")) {
  throw new Error("Correction seeding requires the disposable relay-controlled AVD");
}
const scenario = wallet ? (process.env.AGUS_ANDROID_ACCEPTANCE_TRANSFER === "1" ? "wallet-transfer" : "wallet-connect") : "app-launch";
const expectedTransaction = scenario === "wallet-transfer" ? {
  network: "localnet", recipient: FIXTURE_RECIPIENT, lamports: FIXTURE_AMOUNT,
} : undefined;
const fixture = await readFile(fixturePath);
const digest = sha256(fixture);
const temporary = await mkdtemp(join(tmpdir(), "agus-live-android-"));
const control = new AbortController();
let server;
let store;
let provider;
let providerError;
let enrolledRunner;
const secret = () => randomBytes(32).toString("base64url");

async function poll(label, operation, time = 90_000) {
  const deadline = Date.now() + time;
  do {
    if (providerError) throw providerError;
    const result = await operation();
    if (result) return result;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error("Timed out waiting for " + label);
}

try {
  const config = parseConfig({
    displayName: "Android acceptance runner",
    stateDirectory: "runner",
    device: { id: "acceptance-android", kind: serial.startsWith("emulator-") ? "emulator" : "android-device", serial, dedicated: true },
    approvedBuilds: [{ packageName: FIXTURE, sha256: digest, scenarios: [...new Set(["app-launch", scenario])] }],
    planner,
    ...(wallet ? {
      wallet: { apkPath: resolve(walletPath), sha256: FAKE_WALLET_SHA },
      localnet: { genesis: process.env.AGUS_TEST_LOCAL_GENESIS },
    } : {}),
  }, temporary);
  const android = new AndroidDevice(config.device, { commandTimeoutMs: commandTimeout });
  assert.equal(await android.packageOf(resolve(fixturePath), control.signal), FIXTURE);
  assert.equal(await android.present(FIXTURE, control.signal), false, "Start with an uninstalled fixture on this dedicated device");
  if (wallet) {
    assert.equal(sha256(await readFile(walletPath)), FAKE_WALLET_SHA);
    assert.equal(await android.present(FAKE_WALLET, control.signal), false, "Start with an uninstalled Fake Wallet on this dedicated device");
  }
  let base = "http://127.0.0.1:18765";
  if (!correctionFixture) {
    ({ server, store } = await createControlPlane({
      env: {
        AGUS_LOCAL_DATA_DIR: join(temporary, "control"),
        AGUS_PROVIDER_BOOTSTRAP_TOKEN: secret(),
        AGUS_ALLOW_LEGACY_POOL: "0",
        ...(expectedTransaction ? {
          AGUS_LOCALNET_RPC_URL: "http://127.0.0.1:8899",
          AGUS_LOCALNET_GENESIS_HASH: config.localnet.genesis,
        } : {}),
      },
    }));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = "http://127.0.0.1:" + server.address().port;
  }
  async function request(path, token, body, { method = body === undefined ? "GET" : "POST", status = [200, 201] } = {}) {
    const response = await fetch(base + "/api/v1" + path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    assert.ok(status.includes(response.status), method + " " + path + " returned " + JSON.stringify(payload));
    return payload;
  }
  const { token: developer } = await request("/auth/register", null, { email: "android-dev@example.test", password: secret() });
  const { token: owner } = await request("/auth/register", null, { email: "android-provider@example.test", password: secret() });
  const { pairing } = await request("/me/devices/pairings", owner, {});
  const providerApi = makeApi(base);
  provider = runProvider({
    api: {
      ...providerApi,
      async enroll(credential, input, signal) {
        const result = await providerApi.enroll(credential, input, signal);
        enrolledRunner = { id: result.providerId, publicKeyPem: input.publicKeyPem };
        return result;
      },
    },
    config, endpoint: base, credential: { pairingCode: pairing.code },
    device: android, signal: control.signal, lockDirectory: tmpdir(),
    log: (line) => process.stderr.write(line + "\n"),
  }).catch((error) => {
    if (!control.signal.aborted) providerError = error;
  });
  const device = await poll("Android pairing", async () => (await request("/me/devices", owner)).devices.find(({ readiness }) => readiness === "ready"));
  assert.ok(device.profile.apiLevel >= 33);
  assert.equal(device.profile.hardwareAttested, false);
  assert.equal(device.publicListing, false);
  assert.equal(device.autoMatch, false);
  assert.equal((await request("/devices", developer)).devices.length, 0);
  const { project } = await request("/projects", developer, { name: "Controlled Android acceptance" });
  const { build } = await request("/builds", developer, {
    projectId: project.id, name: "AGUS MWA fixture", packageName: FIXTURE, sha256: digest, apkBase64: fixture.toString("base64"),
  });
  const evidence = { screenshots: true, logs: wallet, trajectory: true };
  const { invitation, token: invitationToken } = await request("/invitations", developer, {
    kind: "developer_request", deviceId: device.id, projectId: project.id, buildId: build.id,
    scenario, mode: "agent", maximumDurationSeconds: 300, evidence, expectedTransaction,
  });
  await request("/invitations/review", developer, { token: invitationToken }, { status: [404] });
  await request("/invitations/review", owner, { token: invitationToken });
  const acceptInvitation = "/invitations/" + invitation.id + "/accept";
  const { run: privateRun } = await request(acceptInvitation, owner, {});
  await request(acceptInvitation, owner, {}, { status: [409] });

  async function runState(runId) {
    return (await request("/runs/" + runId, developer)).run;
  }
  async function waitForRunning(runId) {
    return poll("lease " + runId, async () => {
      const run = await runState(runId);
      if (["failed", "cancelled", "expired", "unverified"].includes(run.state)) throw new Error(JSON.stringify(run));
      return run.state === "running";
    });
  }
  async function agentAction(runId, type, args = {}) {
    const path = "/runs/" + runId + "/actions";
    const { action } = await request(path, developer, { type, args });
    return poll("action " + type, async () => {
      const { actions } = await request(path, developer);
      const observed = actions.find(({ id, state }) => id === action.id && state !== "queued");
      if (observed) return observed;
      const run = await runState(runId);
      if (["failed", "cancelled", "expired", "unverified"].includes(run.state)) throw new Error(JSON.stringify(run));
      return null;
    }, 15_000);
  }
  if (planner === "remote") {
    await waitForRunning(privateRun.id);
    let finished = false;
    let photographed = false;
    let previousPhase;
    for (let step = 0; step < 25 && !finished; step++) {
      const described = await agentAction(privateRun.id, "describe");
      const phase = described.observation?.phase ?? described.observation?.code ?? described.state;
      if (phase !== previousPhase) {
        console.log("Approved agent phase: " + phase);
        previousPhase = phase;
      }
      if (described.state === "failed") {
        await delay(600);
        continue;
      }
      if (wallet && !photographed && described.observation.phase === "approve-connection") {
        const captured = await agentAction(privateRun.id, "screenshot");
        photographed = captured.state === "completed";
      }
      const [allowed] = described.observation.actions;
      const result = await agentAction(privateRun.id, allowed.type, allowed.args);
      if (result.state === "failed" && ["launch", "tap"].includes(allowed.type)) {
        throw new Error("Android rejected described action " + JSON.stringify(result.observation));
      }
      finished = result.state === "completed" && allowed.type === "finish";
    }
    assert.equal(finished, true, "Agent did not complete the allowed Android work");
  }

  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: true, mode: 0o700 });
  assert.ok(enrolledRunner, "The acceptance runner must enroll before it can sign evidence");
  await writeFile(join(output, "runner-enrollment.pub.pem"), enrolledRunner.publicKeyPem);
  async function attachment(receipt, kind) {
    const evidence = receipt.evidence.find(item => item.kind === kind && item.url);
    assert.ok(evidence, "Approved " + kind + " attachment is missing");
    const response = await fetch(base + evidence.url, {
      headers: { Authorization: "Bearer " + developer },
      signal: AbortSignal.timeout(15_000),
    });
    assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(bytes), evidence.sha256);
    assert.ok(receipt.manifest.evidence.some(item => item.kind === kind && item.sha256 === evidence.sha256));
    return bytes;
  }
  async function verifyCompleted(started, source) {
    const run = await poll(source + " result", async () => {
      const current = await runState(started.id);
      if (["failed", "cancelled", "expired", "unverified"].includes(current.state)) throw new Error(JSON.stringify(current));
      return current.state === "passed" ? current : null;
    }, started.maximumDurationSeconds * 1_000 + 30_000);
    const { manifest, issuer, publicKeyPem, signature, manifestSha256 } = run.receipt;
    const canonical = Buffer.from(stableJson(manifest));
    assert.equal(run.acceptedWork.source, source);
    assert.equal(run.leaseState, "released");
    assert.equal(manifest.buildSha256, digest);
    assert.equal(manifestSha256, sha256(canonical));
    assert.equal(issuer, enrolledRunner.id);
    assert.equal(publicKeyPem.trim(), enrolledRunner.publicKeyPem.trim());
    assert.equal(verify(null, canonical, enrolledRunner.publicKeyPem, Buffer.from(signature, "base64")), true);
    assert.equal(manifest.checks.find(({ id }) => id === "cleanup")?.passed, true);
    assert.equal(await android.present(FIXTURE, control.signal), false);
    if (wallet) assert.equal(await android.present(FAKE_WALLET, control.signal), false);
    const png = await attachment(run.receipt, "screenshot");
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    await writeFile(join(output, source + ".png"), png);
    if (source === "private" && planner === "gemini") {
      const trajectory = await attachment(run.receipt, "trajectory");
      const actions = JSON.parse(trajectory);
      assert.equal(actions.length, manifest.execution.modelActionCount);
      assert.ok(actions.every(action => action.selectedBy === "gemini"));
      await writeFile(join(output, "gemini-trajectory.json"), trajectory);
    }
    await writeFile(join(output, source + ".json"), JSON.stringify({
      deviceProfile: device.profile, acceptedWork: run.acceptedWork,
      evaluationOutcome: run.evaluationOutcome, verification: run.verification, receipt: run.receipt,
    }, null, 2) + "\n");
    return run;
  }

  const completed = await verifyCompleted(privateRun, "private");
  assert.equal(completed.receipt.manifest.execution.planner, planner);
  if (planner === "gemini") assert.ok(completed.receipt.manifest.execution.modelActionCount >= 2);
  assert.ok(completed.receipt.manifest.execution.deviceActionCount >= (wallet ? 3 : 1));
  if (wallet) assert.equal(completed.receipt.manifest.checks.find(({ id }) => id === "wallet-authorized")?.passed, true);
  if (expectedTransaction) assert.equal(completed.verification.transaction.status, "verified");

  if (correctionFixture) {
    const { actions } = await request("/runs/" + completed.id + "/actions", developer);
    const actionIndex = actions.findIndex(action => action.type === "describe" && action.state === "completed");
    assert(actionIndex >= 0, "A completed relay action is required for correction");
    const reference = { runId: completed.id, actionIndex, actual: "describe", suggested: "launch",
      manifestSha256: completed.receipt.manifestSha256, deviceSource: device.profile.source };
    await writeFile(join(correctionFixture, "agent.private.json"), JSON.stringify({ developer, projectId: project.id, ...reference }), { mode: 0o600 });
    await writeFile(join(correctionFixture, "correction-reference.json"), JSON.stringify(reference, null, 2) + "\n");
  } else {
  await request("/me/devices/" + encodeURIComponent(device.id), owner, { publicListing: true, autoMatch: false }, { method: "PATCH" });
  const { run: marketplaceRun } = await request("/runs", developer, {
    projectId: project.id, buildId: build.id, deviceId: device.id, allocation: "marketplace",
    scenario: "app-launch", mode: "scripted", maximumDurationSeconds: 90, evidence,
  });
  await poll("compatible marketplace job", async () => {
    const { jobs } = await request("/marketplace/jobs?deviceId=" + encodeURIComponent(device.id), owner);
    return jobs.find(({ id }) => id === marketplaceRun.id);
  });
  assert.equal((await runState(marketplaceRun.id)).state, "queued", "Manual eligibility must not grant execution");
  const marketAccept = "/marketplace/jobs/" + marketplaceRun.id + "/accept";
  await request(marketAccept, owner, { deviceId: device.id });
  await request(marketAccept, owner, { deviceId: device.id }, { status: [409] });
  const marketplace = await verifyCompleted(marketplaceRun, "marketplace");
  assert.equal(marketplace.acceptedWork.payout.kind, "unpaid");
  console.log(JSON.stringify({
    result: "passed", source: device.profile.source, androidApi: device.profile.apiLevel,
    private: { runId: privateRun.id, scenario, outcome: completed.evaluationOutcome, actions: completed.receipt.manifest.execution.deviceActionCount },
    marketplace: { runId: marketplaceRun.id, outcome: marketplace.evaluationOutcome, payout: "unpaid" },
  }));
  }
} finally {
  control.abort(new RunnerFailure("ACCEPTANCE_COMPLETE"));
  await provider;
  if (server?.listening) {
    server.close();
    await once(server, "close");
  }
  if (store) await store.close();
  await rm(temporary, { recursive: true, force: true });
}
