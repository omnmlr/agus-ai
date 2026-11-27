import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createControlPlane } from '../src/server.mjs';
import { stableJson } from '../src/security.mjs';

const bootstrap = 'synthetic-only-provider-bootstrap';
const password = 'integration-synthetic-passphrase';
const packageName = 'app.agus.synthetic';
const apk = Buffer.from([80, 75, 3, 4, 1, 22, 44, 73]);
const apkSha = createHash('sha256').update(apk).digest('hex');
const allowlist = [{ sha256: apkSha, packageName }];
const recipient = 'EMtq5F54UxgEwYx1bmZpRJXNodBPPqjFekwQZNjpzH3w';
const transactionSignature = '4'.repeat(87);
const baseScenarios = ['app-launch', 'wallet-connect', 'wallet-transfer', 'wallet-false-success'];

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agus-control-test-'));
  let clock = Date.parse('2026-11-26T16:00:00Z');
  const { server, store } = await createControlPlane({
    env: {
      AGUS_LOCAL_DATA_DIR: directory, AGUS_PROVIDER_BOOTSTRAP_TOKEN: bootstrap, AGUS_ALLOW_LEGACY_POOL: '0',
      AGUS_LEASE_MS: '20000',
    },
    overrides: { now: () => clock, ...overrides },
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const origin = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await store.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function request(path, { method, token, body, status = 200, binary } = {}) {
    const response = await fetch(origin + '/api/v1' + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = binary && response.ok ? Buffer.from(await response.arrayBuffer()) : await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    return value;
  }
  const account = (name) => request('/auth/register', { body: { email: name + '@example.test', password } });
  async function workload(account) {
    const { project } = await request('/projects', { token: account.token, body: { name: 'Synthetic app' }, status: 201 });
    const { build } = await request('/builds', {
      token: account.token, status: 201,
      body: { projectId: project.id, name: 'test fixture', apkBase64: apk.toString('base64'), sha256: apkSha, packageName },
    });
    return { projectId: project.id, buildId: build.id };
  }
  function device(id, { ready = true, online = true } = {}) {
    return {
      id, profile: {
        kind: 'android-device', model: 'Dedicated test model', measuredAt: new Date(clock).toISOString(),
        androidVersion: '15', apiLevel: 35, charging: true, wifiConnected: false, imei: 'Never expose',
      },
      scenarios: baseScenarios, dedicated: true, online, ready,
    };
  }
  async function pair(owner, id) {
    const { pairing } = await request('/me/devices/pairings', { token: owner.token, body: {}, status: 201 });
    const keys = generateKeyPairSync('ed25519');
    const input = {
      displayName: 'Dedicated test runner',
      publicKeyPem: keys.publicKey.export({ format: 'pem', type: 'spki' }),
      devices: [device(id)],
    };
    const runner = await request('/provider/enroll', { token: pairing.code, body: input });
    return { ...runner, keys, pairing, input, localId: id, id: runner.providerId + ':' + id };
  }
  const report = (job, checks = ['approved-build', 'app-launched', 'cleanup']) => ({
    version: 1, runId: job.runId, leaseId: job.leaseId, challenge: job.challenge,
    buildSha256: job.build.sha256, scenario: job.scenario, mode: job.mode,
    startedAt: new Date(clock).toISOString(), finishedAt: new Date(clock).toISOString(),
    outcome: 'completed', checks: checks.map((id) => ({ id, passed: true })), evidence: [],
  });
  const signed = (runner, job, report) => ({
    runId: job.runId, leaseId: job.leaseId, report,
    signature: sign(null, Buffer.from(stableJson(report)), runner.keys.privateKey).toString('base64'),
  });
  const claim = (runner) => request('/provider/claim', {
    token: runner.token, body: { deviceId: runner.localId, approvedBuilds: allowlist },
  });
  return { request, account, workload, pair, claim, device, report, signed, advance: (value) => { clock += value; }, now: () => clock };
}

const privateRequest = (workload, deviceId) => ({
  ...workload, kind: 'developer_request', deviceId, scenario: 'app-launch', mode: 'scripted',
  maximumDurationSeconds: 20, evidence: { screenshots: false, logs: true, trajectory: false },
});

test('owner device, targeted invite, offline grant, exclusive claim, and stop ACK', async (t) => {
  const f = await fixture(t);
  const owner = await f.account('owner');
  const developer = await f.account('developer');
  const outsider = await f.account('outsider');
  const worker = await f.pair(owner, 'dedicated-a');
  const app = await f.workload(developer);

  const { devices: owned } = await f.request('/me/devices', { token: owner.token });
  assert.equal(owned[0].id, worker.id);
  assert.equal(owned[0].profile.imei, undefined);
  assert.equal(owned[0].profile.hardwareAttested, false);
  assert.equal(owned[0].publicListing, false);
  assert.equal(owned[0].autoMatch, false);
  assert.deepEqual((await f.request('/devices', { token: developer.token })).devices, []);
  assert.deepEqual((await f.request('/me/devices', { token: outsider.token })).devices, []);
  await f.request('/me/devices/' + worker.id, { token: outsider.token, status: 404 });
  await f.request('/provider/enroll', { token: worker.pairing.code, body: worker.input, status: 401 });
  await f.request('/provider/heartbeat', { token: worker.token, body: { devices: [f.device('other')] }, status: 403 });
  await f.request('/provider/heartbeat', { token: worker.token, body: { devices: [] } });

  const { invitation, token } = await f.request('/invitations', {
    token: developer.token, body: privateRequest(app, worker.id), status: 201,
  });
  const inviteRoute = '/invitations/' + invitation.id;
  await f.request('/invitations/review', { token: outsider.token, body: { token }, status: 404 });
  await f.request(inviteRoute + '/accept', { token: owner.token, body: {}, status: 409 });
  await f.request('/invitations/review', { token: owner.token, body: { token } });
  const accepted = await f.request(inviteRoute + '/accept', { token: owner.token, body: {} });
  assert.equal(accepted.run.state, 'queued');
  assert.equal(accepted.run.acceptedWork.payout.kind, 'unpaid');
  await f.request(inviteRoute + '/accept', { token: owner.token, body: {}, status: 409 });
  assert.equal((await f.claim(worker)).job, null);
  await f.request('/provider/heartbeat', { token: worker.token, body: { devices: [f.device(worker.localId)] } });
  const attempts = await Promise.all([f.claim(worker), f.claim(worker)]);
  const [job] = attempts.map(({ job }) => job).filter(Boolean);
  assert.equal(attempts.filter(({ job }) => job).length, 1);
  assert.equal(job.runId, accepted.run.id);
  assert.deepEqual(job.evidence, { screenshots: false, logs: true, trajectory: false });
  await f.request(job.build.url.slice(7), { token: worker.token, status: 401 });
  const artifact = await f.request(job.build.url.slice(7), { token: job.leaseToken, binary: true });
  assert.deepEqual(artifact, apk);

  const session = '/me/sessions/' + job.runId;
  await f.request(session, { token: outsider.token, status: 404 });
  const { run: stopping } = await f.request(session + '/stop', { token: owner.token, method: 'POST' });
  assert.equal(stopping.state, 'stopping');
  assert.equal(stopping.stop.acknowledgedAt, null);
  assert.equal((await f.request('/provider/leases/' + job.leaseId, { token: job.leaseToken })).status, 'stopping');
  assert.equal((await f.claim(worker)).job, null);
  const cleanup = '/provider/leases/' + job.leaseId + '/release';
  await f.request(cleanup, { token: worker.token, body: { cleaned: true }, status: 401 });
  await f.request(cleanup, { token: job.leaseToken, body: { cleaned: true } });
  await f.request(cleanup, { token: job.leaseToken, body: { cleaned: true } });
  const stopped = (await f.request(session, { token: owner.token })).run;
  assert.equal(stopped.state, 'cancelled');
  assert.ok(stopped.stop.acknowledgedAt);
  const { events } = await f.request(session + '/events?after=3', { token: owner.token });
  assert.equal(events.filter(({ type }) => type === 'device.cleaned').length, 1);
  assert.ok(events.every(({ id }) => id > 3));
  assert.equal((await f.request('/me/notifications', { token: owner.token })).notifications.some(
    ({ type }) => type === 'invitation.received',
  ), true);
});

test('provider share binds exact APK and target, supports revocation and expiry', async (t) => {
  const f = await fixture(t);
  const owner = await f.account('share-owner');
  const developer = await f.account('share-developer');
  const { id: deviceId } = await f.pair(owner, 'share-device');
  const app = await f.workload(developer);
  const input = {
    kind: 'provider_share', deviceId, targetUserId: developer.user.id, packageName,
    buildSha256: apkSha, scenario: 'app-launch', mode: 'scripted', maximumDurationSeconds: 20,
    evidence: { screenshots: false, logs: false, trajectory: false },
  };

  const bad = await f.request('/invitations', {
    token: owner.token, status: 201, body: { ...input, buildSha256: '1'.repeat(64) },
  });
  await f.request('/invitations/review', { token: developer.token, body: { token: bad.token } });
  const mismatch = await f.request('/invitations/' + bad.invitation.id + '/accept', {
    token: developer.token, body: app, status: 409,
  });
  assert.equal(mismatch.error.code, 'invitation_mismatch');

  const valid = await f.request('/invitations', { token: owner.token, status: 201, body: input });
  const inviteRoute = '/invitations/' + valid.invitation.id;
  await f.request('/invitations/review', { token: developer.token, body: { token: valid.token } });
  const { run } = await f.request(inviteRoute + '/accept', { token: developer.token, body: app });
  await f.request(inviteRoute + '/revoke', { token: owner.token, method: 'POST' });
  assert.equal((await f.request('/runs/' + run.id, { token: developer.token })).run.state, 'cancelled');

  const expiring = await f.request('/invitations', { token: owner.token, status: 201, body: input });
  f.advance(24 * 60 * 60_000 + 1);
  const session = await f.request('/auth/login', { body: { email: developer.user.email, password } });
  const expired = await f.request('/invitations/review', {
    token: session.token, body: { token: expiring.token }, status: 409,
  });
  assert.equal(expired.error.code, 'invitation_expired');
});

test('manual marketplace acceptance reserves one device and keeps test outcomes separate', async (t) => {
  const f = await fixture(t);
  const one = await f.account('market-owner-one');
  const two = await f.account('market-owner-two');
  const developer = await f.account('market-developer');
  const a = await f.pair(one, 'market-a');
  const b = await f.pair(two, 'market-b');
  const app = await f.workload(developer);
  for (const [owner, device] of [[one, a], [two, b]]) {
    await f.request('/me/devices/' + device.id, {
      method: 'PATCH', token: owner.token, body: { publicListing: true, autoMatch: false },
    });
  }
  const { run } = await f.request('/runs', {
    token: developer.token, status: 201, body: { ...app, allocation: 'marketplace', scenario: 'app-launch', mode: 'scripted' },
  });
  assert.equal((await f.claim(a)).job, null);
  assert.equal((await f.request('/marketplace/jobs?deviceId=' + a.id, { token: one.token })).jobs[0].quote.kind, 'unpaid');
  const accepted = await f.request('/marketplace/jobs/' + run.id + '/accept', {
    token: one.token, body: { deviceId: a.id },
  });
  assert.equal(accepted.run.state, 'reserved');
  await f.request('/marketplace/jobs/' + run.id + '/accept', { token: two.token, body: { deviceId: b.id }, status: 409 });
  assert.equal((await f.claim(b)).job, null);
  const { job } = await f.claim(a);
  const report = f.report(job);
  report.checks.find(({ id }) => id === 'app-launched').passed = false;
  const checked = await f.request('/provider/report', { token: job.leaseToken, body: f.signed(a, job, report) });
  assert.equal(checked.run.executionState, 'completed');
  assert.equal(checked.run.evaluationOutcome, 'failed');
  assert.equal(checked.run.state, 'failed');
  assert.equal(checked.run.reportSeal, 'sealed');
  assert.equal(checked.run.acceptedWork.source, 'marketplace');
  assert.equal(checked.run.leaseState, 'released');
  assert.deepEqual(await f.request('/provider/report', { token: job.leaseToken, body: f.signed(a, job, report) }), checked);
  await f.request('/me/devices/' + a.id, { token: one.token, method: 'DELETE' });
  await f.request('/provider/heartbeat', { token: a.token, body: { devices: [f.device(a.localId)] }, status: 401 });
  assert.equal((await f.request('/devices', { token: developer.token })).devices.some(({ id }) => id === a.id), false);
});

test('lease expires with unconfirmed stop; later authentic cleanup acknowledges it', async (t) => {
  const f = await fixture(t);
  const owner = await f.account('timeout-owner');
  const developer = await f.account('timeout-developer');
  const runner = await f.pair(owner, 'timeout');
  const app = await f.workload(developer);
  const { invitation } = await f.request('/invitations', {
    token: developer.token, body: privateRequest(app, runner.id), status: 201,
  });
  const invite = '/invitations/' + invitation.id;
  await f.request(invite + '/review', { token: owner.token, method: 'POST' });
  await f.request(invite + '/accept', { token: owner.token, body: {} });
  const { job } = await f.claim(runner);
  await f.request('/runs/' + job.runId + '/cancel', { token: developer.token, method: 'POST' });
  f.advance(21_000);
  const expired = (await f.request('/runs/' + job.runId, { token: developer.token })).run;
  assert.equal(expired.state, 'expired');
  assert.equal(expired.stop.acknowledgedAt, null);
  await f.request('/provider/leases/' + job.leaseId + '/release', {
    token: job.leaseToken, body: { cleaned: true },
  });
  const confirmed = (await f.request('/runs/' + job.runId, { token: developer.token })).run;
  assert.equal(confirmed.state, 'expired');
  assert.ok(confirmed.stop.acknowledgedAt);
});

test('run-bound signature, consent, and independent finalized transfer replay checks', async (t) => {
  let f;
  let count = 0;
  f = await fixture(t, {
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      if (body.method === 'getGenesisHash') {
        return Response.json({ result: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' });
      }
      assert.equal(body.method, 'getTransaction');
      assert.equal(body.params[1].commitment, 'finalized');
      assert.equal(body.params[0], transactionSignature);
      count++;
      return Response.json({
        result: {
          blockTime: Math.floor(f.now() / 1000), slot: 99, meta: { err: null }, transaction: {
            signatures: [transactionSignature],
            message: { instructions: [{ program: 'system', parsed: {
              type: 'transfer', info: { destination: recipient, lamports: 1_000_000 },
            } }] },
          },
        },
      });
    },
  });
  const owner = await f.account('wallet-owner');
  const developer = await f.account('wallet-developer');
  const runner = await f.pair(owner, 'wallet');
  const app = await f.workload(developer);
  async function next() {
    const { invitation } = await f.request('/invitations', {
      token: developer.token, status: 201, body: {
        ...privateRequest(app, runner.id), scenario: 'wallet-transfer',
        expectedTransaction: { network: 'devnet', recipient, lamports: 1_000_000 },
      },
    });
    const path = '/invitations/' + invitation.id;
    await f.request(path + '/review', { token: owner.token, method: 'POST' });
    await f.request(path + '/accept', { token: owner.token, body: {} });
    await f.request('/provider/heartbeat', { token: runner.token, body: { devices: [f.device(runner.localId)] } });
    const { job } = await f.claim(runner);
    return job;
  }
  const job = await next();
  const manifest = f.report(job, ['approved-build', 'app-launched', 'wallet-authorized', 'cleanup']);
  manifest.transaction = { signature: transactionSignature, network: 'devnet' };
  const envelope = f.signed(runner, job, manifest);
  await f.request('/provider/report', { token: job.leaseToken, status: 409, body: {
    ...envelope, report: { ...manifest, challenge: 'fake' },
  } });
  await f.request('/provider/report', { token: job.leaseToken, status: 400, body: {
    ...envelope, report: { ...manifest, outcome: 'failed' },
  } });
  const secretManifest = { ...manifest, evidence: [{ kind: 'screenshot', sha256: '1'.repeat(64) }] };
  await f.request('/provider/report', { token: job.leaseToken, status: 403, body: f.signed(runner, job, secretManifest) });
  const passed = await f.request('/provider/report', { token: job.leaseToken, body: envelope });
  assert.equal(passed.run.state, 'passed');
  assert.equal(passed.run.verification.transaction.status, 'verified');

  const replayJob = await next();
  const replay = f.report(replayJob, ['approved-build', 'app-launched', 'wallet-authorized', 'cleanup']);
  replay.transaction = manifest.transaction;
  const duplicate = await f.request('/provider/report', {
    token: replayJob.leaseToken, body: f.signed(runner, replayJob, replay),
  });
  assert.equal(duplicate.run.state, 'failed');
  assert.equal(duplicate.run.verification.transaction.status, 'signature_reused');
  assert.equal(count, 2);
});
