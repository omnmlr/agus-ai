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
const wallet = walletPath && walletPath !== "-";
const scenario = wallet ? (process.env.AGUS_ANDROID_ACCEPTANCE_TRANSFER === "1" ? "wallet-transfer" : "wallet-connect") : "app-launch";
const expectedTransaction = scenario === "wallet-transfer" ? {
  network: "localnet", recipient: FIXTURE_RECIPIENT, lamports: Number(FIXTURE_AMOUNT),
} : undefined;
const fixture = await readFile(fixturePath);
const digest = sha256(fixture);
const temporary = await mkdtemp(join(tmpdir(), "agus-live-android-"));
const control = new AbortController();
let server;
let store;
let provider;
let providerError;
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
    planner: "remote",
    ...(wallet ? {
      wallet: { apkPath: resolve(walletPath), sha256: FAKE_WALLET_SHA },
      localnet: { genesis: process.env.AGUS_TEST_LOCAL_GENESIS },
    } : {}),
  }, temporary);
  const android = new AndroidDevice(config.device);
  assert.equal(await android.packageOf(resolve(fixturePath), control.signal), FIXTURE);
  assert.equal(await android.present(FIXTURE, control.signal), false, "Start with an uninstalled fixture on this dedicated device");
  if (wallet) {
    assert.equal(sha256(await readFile(walletPath)), FAKE_WALLET_SHA);
    assert.equal(await android.present(FAKE_WALLET, control.signal), false, "Start with an uninstalled Fake Wallet on this dedicated device");
  }
  ({ server, store } = await createControlPlane({
    env: {
      AGUS_LOCAL_DATA_DIR: join(temporary, "control"),
      AGUS_PROVIDER_BOOTSTRAP_TOKEN: secret(),
      AGUS_ALLOW_LEGACY_POOL: "0",
      ...(expectedTransaction ? { AGUS_LOCALNET_RPC_URL: "http://127.0.0.1:8899" } : {}),
    },
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
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
  provider = runProvider({
    api: makeApi(base), config, endpoint: base, credential: { pairingCode: pairing.code },
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
  await waitForRunning(privateRun.id);
  let finished = false;
  let photographed = false;
  for (let step = 0; step < 25 && !finished; step++) {
    const described = await agentAction(privateRun.id, "describe");
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

  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: true, mode: 0o700 });
  async function verifyCompleted(runId, source) {
    const run = await poll(source + " result", async () => {
      const current = await runState(runId);
      if (["failed", "cancelled", "expired", "unverified"].includes(current.state)) throw new Error(JSON.stringify(current));
      return current.state === "passed" ? current : null;
    });
    const { manifest, publicKeyPem, signature, manifestSha256 } = run.receipt;
    const canonical = Buffer.from(stableJson(manifest));
    assert.equal(run.acceptedWork.source, source);
    assert.equal(run.leaseState, "released");
    assert.equal(manifest.buildSha256, digest);
    assert.equal(manifestSha256, sha256(canonical));
    assert.equal(verify(null, canonical, publicKeyPem, Buffer.from(signature, "base64")), true);
    assert.equal(manifest.checks.find(({ id }) => id === "cleanup")?.passed, true);
    assert.equal(await android.present(FIXTURE, control.signal), false);
    if (wallet) assert.equal(await android.present(FAKE_WALLET, control.signal), false);
    const screenshot = run.receipt.evidence.find(({ kind, url }) => kind === "screenshot" && url);
    assert.ok(screenshot, "Approved screenshot attachment is missing");
    const response = await fetch(base + screenshot.url, {
      headers: { Authorization: "Bearer " + developer },
      signal: AbortSignal.timeout(15_000),
    });
    assert.ok(response.ok);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(sha256(png), screenshot.sha256);
    await writeFile(join(output, source + ".png"), png);
    await writeFile(join(output, source + ".json"), JSON.stringify({
      deviceProfile: device.profile, acceptedWork: run.acceptedWork,
      evaluationOutcome: run.evaluationOutcome, verification: run.verification, receipt: run.receipt,
    }, null, 2) + "\n");
    return run;
  }

  const completed = await verifyCompleted(privateRun.id, "private");
  assert.equal(completed.receipt.manifest.execution.planner, "remote");
  assert.ok(completed.receipt.manifest.execution.deviceActionCount >= (wallet ? 3 : 1));
  if (wallet) assert.equal(completed.receipt.manifest.checks.find(({ id }) => id === "wallet-authorized")?.passed, true);
  if (expectedTransaction) assert.equal(completed.verification.transaction.status, "verified");

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
  const marketplace = await verifyCompleted(marketplaceRun.id, "marketplace");
  assert.equal(marketplace.acceptedWork.payout.kind, "unpaid");
  console.log(JSON.stringify({
    result: "passed", source: device.profile.source, androidApi: device.profile.apiLevel,
    private: { runId: privateRun.id, scenario, outcome: completed.evaluationOutcome, actions: completed.receipt.manifest.execution.deviceActionCount },
    marketplace: { runId: marketplaceRun.id, outcome: marketplace.evaluationOutcome, payout: "unpaid" },
  }));
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
