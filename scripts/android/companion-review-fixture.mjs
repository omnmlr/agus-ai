import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';

// This control plane only binds to loopback on the ephemeral visual review runner.
const origin = 'http://127.0.0.1:18768';
const password = 'CompanionReviewOnly123';
const email = 'reviewer@example.invalid';
const [mode, directory, fixtureApk] = process.argv.slice(2);

async function request(route, token, body) {
  const response = await fetch(origin + '/api/v1' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Error(route + ': ' + result.error?.code);
  return result;
}

if (mode === 'serve') {
  const outboundFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url !== 'https://api.resend.com/emails') return outboundFetch(url, options);
    const message = JSON.parse(options.body);
    const code = /\b[0-9]{6}\b/.exec(message.text);
    if (!code || message.to[0] !== email) return new Response(null, { status: 400 });
    await writeFile(resolve(directory, 'review-otp.txt'), code[0], { mode: 0o600 });
    return new Response(null, { status: 200 });
  };
  const { server } = await createControlPlane({
    env: {
      AGUS_LOCAL_DATA_DIR: resolve(directory), AGUS_HEARTBEAT_MS: '600000',
      AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'disposable-companion-review-bootstrap',
      AGUS_RESEND_API_KEY: 'disposable-intercepted-review-key',
      AGUS_AUTH_FROM_EMAIL: 'review@example.invalid',
      AGUS_EMAIL_OTP_SECRET: 'disposable-companion-review-otp-secret',
    },
  });
  server.prependListener('request', (incoming, outgoing) => {
    const path = new URL(incoming.url, origin).pathname;
    if (['/api/v1/me/devices/pairings', '/api/v1/auth/email/start', '/api/v1/auth/email/verify'].includes(path)) {
      outgoing.once('finish', () => console.log(incoming.method, path, outgoing.statusCode));
    }
  });
  server.listen(18768, '127.0.0.1');
} else if (mode === 'register') {
  await request('/auth/register', null, { email, password });
} else if (mode === 'seed') {
  const owner = await request('/auth/login', null, { email, password });
  const developer = await request('/auth/register', null, { email: 'developer@example.invalid', password });
  const { pairing } = await request('/me/devices/pairings', owner.token, {});
  const { publicKey } = generateKeyPairSync('ed25519');
  const device = {
    id: 'review-target', dedicated: true, ready: true, online: true, scenarios: ['app-launch'],
    profile: {
      kind: 'adb-emulator', model: 'Android review emulator', manufacturer: 'AOSP',
      androidVersion: '15', apiLevel: 35, measuredAt: new Date().toISOString(),
      memoryAvailableBytes: 3 * 1024 ** 3, dataAvailableBytes: 5 * 1024 ** 3,
      dataTotalBytes: 8 * 1024 ** 3, batteryPercent: 82,
    },
  };
  const runner = await request('/provider/enroll', pairing.code, {
    displayName: 'Android review emulator', publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }),
    devices: [device],
  });
  const { project } = await request('/projects', developer.token, { name: 'Companion review fixture' });
  const apk = await readFile(fixtureApk);
  const packageName = 'app.agus.testfixture';
  const sha256 = createHash('sha256').update(apk).digest('hex');
  const { build } = await request('/builds', developer.token, {
    projectId: project.id, name: 'Android acceptance fixture', apkBase64: apk.toString('base64'), sha256, packageName,
  });
  await request('/invitations', developer.token, {
    kind: 'developer_request', projectId: project.id, buildId: build.id, deviceId: runner.providerId + ':' + device.id,
    scenario: 'app-launch', mode: 'scripted', maximumDurationSeconds: 60,
    evidence: { screenshots: false, logs: true, trajectory: false },
  });
} else {
  throw Error('Choose serve, register, or seed');
}
