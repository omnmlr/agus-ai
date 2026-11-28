import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const url = process.env.AGUS_DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('The Function smoke test requires a disposable local PostgreSQL database.');
}
const file = resolve(process.argv[2] ?? 'deploy/neon/dist/index.mjs');
const { default: app } = await import(pathToFileURL(file));
const origin = 'https://function-fixture.invalid';

function call(path, { method = 'GET', body, token, accept = 'application/json' } = {}) {
  const headers = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  return app.fetch(new Request(`${origin}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000),
  }));
}

async function json(path, options, status = 200) {
  const response = await call(path, options);
  const data = await response.json();
  assert.equal(response.status, status, data.error?.message ?? path);
  return data;
}

try {
  const home = await (await call('/')).text();
  assert.match(home, /console\.html/);
  assert.match(home, /data-replay/);
  assert.match((await call('/console.html')).headers.get('content-type'), /text\/html/);
  for (const path of ['/privacy', '/terms', '/docs', '/docs/api', '/robots.txt', '/sitemap.xml', '/assets/oauth-logo.png']) {
    assert.equal((await call(path, { method: 'HEAD' })).status, 200, path);
  }
  for (const path of ['/orbital.css', '/orbital-motion.mjs', '/replay.mjs', '/assets/orbital-stage.webp', '/assets/orbital-stage-mobile.webp']) {
    const response = await call(path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 1_000, path);
  }
  assert.equal((await call('/not-a-page')).status, 404);
  assert.deepEqual(await json('/health'), { ok: true, persistence: 'postgres' });
  await json('/api/v1/projects', undefined, 401);
  const email = `smoke-${randomUUID()}@example.invalid`;
  const password = 'disposable-fixture-password';
  const registrationToken = process.env.AGUS_REGISTRATION_TOKEN;
  const { token } = await json('/api/v1/auth/register', { method: 'POST', body: { email, password, registrationToken } });
  const { project } = await json('/api/v1/projects', { method: 'POST', token, body: { name: 'Smoke fixture' } }, 201);
  const { token: secondToken } = await json('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  assert.equal((await json('/api/v1/projects', { token: secondToken })).projects[0].id, project.id);
  const apkBytes = Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(80_000)]);
  const { build } = await json('/api/v1/builds', {
    method: 'POST', token,
    body: { projectId: project.id, name: 'fixture.apk', packageName: 'test.agus.fixture',
      sha256: createHash('sha256').update(apkBytes).digest('hex'), apkBase64: apkBytes.toString('base64') },
  }, 201);
  assert.equal(build.projectId, project.id);
  console.log('Function bundle passed same-origin dashboard, PostgreSQL TLS, auth, project and 80 KB uploaded fixture smoke.');
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
