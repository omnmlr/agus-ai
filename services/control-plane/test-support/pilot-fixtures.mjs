import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createControlPlane } from '../src/server.mjs';
import { digest, stableJson } from '../src/security.mjs';

export const apk = Buffer.from([80, 75, 3, 4, 1, 1, 1, 1]);
export const review = { sha256: digest(apk), packageName: 'app.agus.preview.fixture', signerSha256: 'a'.repeat(64) };
export const safePolicy = {
  managed: true, profileOwner: true, crossProfileCopyBlocked: true, installerRestricted: true, unlocked: true,
  foreground: true, apiLevel: 35, charging: false, batteryPercent: 90, availableStorageMiB: 800,
  thermalStatus: 0, abi: 'x86_64',
};

export async function startTestPilot(t, { env = {}, databaseUrl } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agus-product-test-'));
  const manifestKeys = generateKeyPairSync('ed25519');
  const clock = { now: Date.now() };
  const options = {
    env: {
      AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'disposable-control-plane-test-token', AGUS_LOCAL_DATA_DIR: directory,
      AGUS_PRODUCT_PILOT: '1', AGUS_NATIVE_MANIFEST_PKCS8: manifestKeys.privateKey.export({
        format: 'der', type: 'pkcs8',
      }).toString('base64'),
      AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([review]),
      ...(databaseUrl ? { AGUS_DATABASE_URL: databaseUrl } : {}),
      ...env,
    },
    overrides: { now: () => clock.now },
  };
  let app;
  let url;

  async function start() {
    app = await createControlPlane(options);
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    url = 'http://127.0.0.1:' + app.server.address().port;
  }
  async function close() {
    await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    await app.store.close();
  }
  await start();
  t.after(async () => {
    await close();
    await rm(directory, { recursive: true, force: true });
  });
  async function request(method, route, { credential, body, status = 200, key } = {}) {
    const response = await fetch(url + '/api/v1' + route, {
      method,
      headers: {
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...(credential ? { Authorization: 'Bearer ' + credential } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = response.headers.get('content-type')?.includes('json')
      ? await response.json() : Buffer.from(await response.arrayBuffer());
    if (Array.isArray(status)) {
      assert(status.includes(response.status), JSON.stringify(result));
      return { status: response.status, result };
    }
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  async function register(label) {
    return request('POST', '/auth/register', {
      body: { email: label + '-' + crypto.randomUUID() + '@example.invalid', password: 'disposable test only' },
    });
  }
  return { request, register, get store() { return app.store; }, clock, manifestKeys, async restart() {
    await close();
    await start();
  } };
}

export function proof(key, value) {
  const bytes = Buffer.from(stableJson(value));
  return { payload: bytes.toString('base64'), signature: sign('sha256', bytes, key).toString('base64') };
}

export async function enroll(pilot, person, runtimeClass = 'phone_cooperative') {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const { enrollment } = await pilot.request('POST', '/me/runtime-enrollments', { credential: person.token,
    body: { runtimeClass, appVersion: '1', policyVersion: 'managed-profile-v1' } });
  const body = { publicKey, proof: proof(keys.privateKey, enrollment.binding) };
  const path = '/me/runtime-enrollments/' + enrollment.id + '/complete';
  const { installation, credential } = await pilot.request('POST', path, { credential: person.token, body });
  return { keys, credential, id: installation.id, path, body };
}

export const heartbeat = (runtime, sequence, policy = safePolicy, windowSeconds = 180) => proof(runtime.keys.privateKey, {
  v: 1, kind: 'heartbeat', installationId: runtime.id, sequence, windowId: 'fixture-window', windowSeconds, policy,
});

export function leaseProof(runtime, grant, kind, fields) {
  const manifest = JSON.parse(Buffer.from(grant.manifest.payload, 'base64').toString());
  return proof(runtime.keys.privateKey, {
    v: 1, kind, installationId: runtime.id, leaseId: grant.id, challenge: manifest.challenge,
    fence: manifest.fence, manifestSha256: grant.manifest.sha256, ...fields,
  });
}
