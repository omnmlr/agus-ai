import assert from "node:assert/strict";
import { verify } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createControlPlane } from "../../control-plane/src/server.mjs";
import { parseConfig } from "../src/config.mjs";
import { emergencyStopFilename, makeApi, RunnerFailure, sha256, stableJson } from "../src/protocol.mjs";
import { runProvider } from "../src/runner.mjs";

const fixture = Buffer.concat([Buffer.from([80, 75, 3, 4]), Buffer.from("stub Android fixture bytes")]);
const screenshot = Buffer.from("89504e470d0a1a0a", "hex");
const packageName = "app.agus.synthetic";
const bootstrapToken = "test-only-enrollment-credential";

async function until(operation) {
  const deadline = Date.now() + 12_000;
  do {
    const result = await operation();
    if (result) return result;
    await delay(80);
  } while (Date.now() < deadline);
  throw new Error("Test did not reach expected control-plane state");
}

class SyntheticAndroid {
  installed = false;
  launched = false;
  scannedScreens = 0;
  cleanupCount = 0;

  async profile() {
    return { kind: "emulator", source: "simulated", model: "Synthetic test double", apiLevel: 35, measuredAt: new Date().toISOString() };
  }

  async present() { return this.installed; }
  async packageOf() { return packageName; }
  async install() { this.installed = true; }
  async launch() { this.launched = true; }
  async screenshot() { this.scannedScreens++; return screenshot; }
  async cleanup() { this.installed = false; this.cleanupCount++; }
}

async function harness(t, { servedBytes = fixture, approvedBytes = servedBytes, planner = "remote" } = {}) {
  const temporary = await mkdtemp(join(tmpdir(), "agus-provider-test-"));
  const { server, store } = await createControlPlane({
    env: { AGUS_LOCAL_DATA_DIR: join(temporary, "control"), AGUS_PROVIDER_BOOTSTRAP_TOKEN: bootstrapToken },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await once(server, "close");
    await store.close();
    await rm(temporary, { recursive: true, force: true });
  });
  const endpoint = "http://127.0.0.1:" + server.address().port;
  const config = parseConfig({
    displayName: "Synthetic provider integration test",
    stateDirectory: ".data",
    device: { id: "synthetic-emulator", kind: "emulator", serial: "emulator-synthetic", dedicated: true },
    allowedDeveloperEmails: ["fixture@example.com"],
    approvedBuilds: [{ packageName, sha256: sha256(approvedBytes), scenarios: ["app-launch"] }],
    planner,
  }, temporary);
  const root = endpoint + "/api/v1";
  async function request(path, token, body, statuses = [200, 201]) {
    const reply = await fetch(root + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const received = await reply.json();
    assert.ok(statuses.includes(reply.status), JSON.stringify(received));
    return received;
  }
  const email = "fixture@example.com";
  const { token } = await request("/auth/register", null, { email, password: "placeholder-long-test-password" });
  const { project } = await request("/projects", token, { name: "Synthetic contract test" });
  const { build } = await request("/builds", token, {
    projectId: project.id,
    name: "Synthetic APK stub",
    packageName,
    sha256: sha256(servedBytes),
    apkBase64: servedBytes.toString("base64"),
  });
  const device = new SyntheticAndroid();
  const api = makeApi(endpoint);
  const abort = new AbortController();
  const provider = (overrides = {}) => runProvider({
    api,
    config,
    endpoint,
    credential: { bootstrapToken },
    device,
    signal: abort.signal,
    once: true,
    log: () => {},
    lockDirectory: temporary,
    ...overrides,
  });
  const run = (mode, fields = {}) => request("/runs", token, {
    projectId: project.id, buildId: build.id, scenario: "app-launch", mode, ...fields,
  });
  return { api, abort, build, config, device, endpoint, project, provider, request, run, token };
}

test("real control plane verifies an external agent relay and signed synthetic evidence", async (t) => {
  const subject = await harness(t);
  const { run } = await subject.run("agent");
  const lease = subject.provider();
  const result = lease.then(() => null, (error) => error);
  const current = () => subject.request("/runs/" + run.id, subject.token);
  await until(async () => (await current()).run.state === "running");
  const act = async (type, args = {}) => {
    const { action } = await subject.request("/runs/" + run.id + "/actions", subject.token, { type, args });
    return until(async () => {
      const { actions } = await subject.request("/runs/" + run.id + "/actions", subject.token);
      return actions.find(({ id, state }) => id === action.id && state !== "queued");
    });
  };
  const first = await act("describe");
  assert.deepEqual(first.observation.actions, [{ type: "launch", args: {} }]);
  const denied = await act("tap", { target: "open-settings" });
  assert.equal(denied.state, "failed");
  assert.equal(denied.observation.code, "ACTION_SCOPE");
  assert.equal((await act("launch")).state, "completed");
  assert.equal((await act("finish")).state, "completed");
  assert.equal(await result, null);
  const complete = (await current()).run;
  assert.equal(complete.state, "passed");
  assert.equal(complete.receipt.manifest.execution.planner, "remote");
  assert.equal(complete.receipt.manifest.metrics.policyViolations, 1);
  assert.equal(subject.device.cleanupCount, 1);
  assert.equal(subject.device.installed, false);
  const receipt = complete.receipt;
  assert.equal(verify(null, Buffer.from(stableJson(receipt.manifest)), receipt.publicKeyPem, Buffer.from(receipt.signature, "base64")), true);
  const tampered = { ...receipt.manifest, buildSha256: "0".repeat(64) };
  assert.equal(verify(null, Buffer.from(stableJson(tampered)), receipt.publicKeyPem, Buffer.from(receipt.signature, "base64")), false);
  const evidence = receipt.evidence.find(({ kind }) => kind === "screenshot");
  const image = await fetch(subject.endpoint + evidence.url, { headers: { Authorization: "Bearer " + subject.token } });
  assert.equal(image.status, 200);
  assert.equal(sha256(Buffer.from(await image.arrayBuffer())), evidence.sha256);
});

test("control-plane stop is acknowledged after synthetic Android cleanup", async (t) => {
  const subject = await harness(t);
  const { run } = await subject.run("agent");
  const result = subject.provider().then(() => null, (error) => error);
  await until(() => subject.device.installed);
  const { run: requested } = await subject.request("/runs/" + run.id + "/cancel", subject.token, {});
  assert.equal(requested.state, "stopping");
  assert.equal(await result, null);
  assert.equal(subject.device.installed, false);
  const { run: terminal } = await subject.request("/runs/" + run.id, subject.token);
  assert.equal(terminal.state, "cancelled");
  assert.ok(terminal.stop.acknowledgedAt);
});

test("local emergency stop cleans immediately and reconciles a network failure without rerun", async (t) => {
  const subject = await harness(t);
  const { run } = await subject.run("agent");
  let connected = true;
  const api = {
    ...subject.api,
    status(...args) {
      if (!connected) throw new RunnerFailure("OFFLINE");
      return subject.api.status(...args);
    },
  };
  const result = subject.provider({ api }).then(() => null, (error) => error);
  await until(() => subject.device.installed);
  await writeFile(join(subject.config.stateDirectory, emergencyStopFilename), "");
  connected = false;
  const failure = await result;
  assert.equal(failure.code, "OFFLINE");
  assert.equal(subject.device.installed, false);
  const pending = JSON.parse(await readFile(join(subject.config.stateDirectory, "pending-report.json"), "utf8"));
  assert.equal(pending.job.runId, run.id);
  assert.equal(pending.result.status, "LOCAL_EMERGENCY_STOP");
  connected = true;
  await subject.provider({ api, reconcileOnly: true });
  await assert.rejects(readFile(join(subject.config.stateDirectory, "pending-report.json")), { code: "ENOENT" });
  const { run: terminal } = await subject.request("/runs/" + run.id, subject.token);
  assert.equal(terminal.state, "cancelled");
  assert.ok(terminal.stop.acknowledgedAt);
  assert.equal(subject.device.cleanupCount, 1);
});

test("a one-time paired device runs a reviewed private workload with no evidence when consent is off", async (t) => {
  const subject = await harness(t);
  const { token: owner } = await subject.request("/auth/register", null, {
    email: "provider@example.com", password: "placeholder-provider-password",
  });
  const { pairing } = await subject.request("/me/devices/pairings", owner, {});
  const execution = subject.provider({
    once: false, credential: { pairingCode: pairing.code },
  }).then(() => null, (error) => error);
  t.after(() => subject.abort.abort(new RunnerFailure("TEST_COMPLETE")));
  const paired = await until(async () => (await subject.request("/me/devices", owner)).devices[0]);
  assert.equal(paired.publicListing, false);
  assert.equal(paired.autoMatch, false);
  assert.equal((await subject.request("/devices", subject.token)).devices.length, 0);
  const { invitation, token } = await subject.request("/invitations", subject.token, {
    kind: "developer_request",
    deviceId: paired.id,
    projectId: subject.project.id,
    buildId: subject.build.id,
    scenario: "app-launch",
    mode: "scripted",
    maximumDurationSeconds: 60,
    evidence: { screenshots: false, logs: false, trajectory: false },
  });
  assert.equal((await subject.request("/invitations/review", subject.token, { token }, [404])).error.code, "not_found");
  await subject.request("/invitations/review", owner, { token });
  const accept = "/invitations/" + invitation.id + "/accept";
  const { run } = await subject.request(accept, owner, {});
  assert.equal((await subject.request(accept, owner, {}, [409])).error.code, "invitation_conflict");
  const completed = await until(async () => {
    const { run: current } = await subject.request("/runs/" + run.id, subject.token);
    return current.state === "passed" ? current : null;
  });
  assert.equal(completed.acceptedWork.source, "private");
  assert.equal(completed.acceptedWork.payout.kind, "unpaid");
  assert.deepEqual(completed.receipt.evidence, []);
  assert.equal(subject.device.scannedScreens, 0);
  assert.equal(subject.device.cleanupCount, 1);
  subject.abort.abort(new RunnerFailure("TEST_COMPLETE"));
  const finish = await execution;
  assert.ok(!finish || finish.name === "AbortError" || finish.code === "TEST_COMPLETE");
});

test("runner refuses altered APK bytes delivered after lease allocation", async (t) => {
  const subject = await harness(t);
  const { run } = await subject.run("scripted");
  const api = { ...subject.api, async build() { return new Response(Buffer.from("altered artifact")); } };
  await subject.provider({ api });
  const { run: failed } = await subject.request("/runs/" + run.id, subject.token);
  assert.equal(failed.state, "failed");
  assert.equal(failed.receipt.manifest.checks.find(({ id }) => id === "approved-build").detail, "APK_DIGEST");
  assert.equal(subject.device.installed, false);
  assert.equal(subject.device.launched, false);
  assert.equal(subject.device.cleanupCount, 0);
});
