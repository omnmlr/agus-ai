// Bundle this entry beside the built site/ directory for a loopback-only review.
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWebServer } from '../../apps/web/scripts/serve.mjs';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';

const directory = await mkdtemp(join(tmpdir(), 'agus-orbital-review-'));
const password = randomBytes(16).toString('hex');
const registrationToken = randomBytes(24).toString('hex');
const email = 'review@orbital.test';
let control;
let web;

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}
async function close() {
  for (const server of [web, control?.server]) {
    if (server?.listening) {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    }
  }
  await rm(directory, { recursive: true, force: true });
}

try {
  control = await createControlPlane({ env: {
    AGUS_LOCAL_DATA_DIR: directory,
    AGUS_REGISTRATION_TOKEN: registrationToken,
    AGUS_PROVIDER_BOOTSTRAP_TOKEN: randomBytes(24).toString('hex'),
  } });
  const upstream = await listen(control.server);
  async function post(path, body, token) {
    const response = await fetch(upstream + '/api/v1/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Could not initialize the disposable review account: ' + path);
    return response.json();
  }
  const { token } = await post('auth/register', { email, password, registrationToken });
  await post('projects', { name: 'Orbital review workspace' }, token);

  web = createWebServer({ upstream, directory: new URL('./site/', import.meta.url), pages: null });
  const origin = await listen(web);
  console.log('Homepage  ' + origin + '/');
  console.log('Console   ' + origin + '/console.html');
  console.log('Email     ' + email);
  console.log('Password  ' + password);
  console.log('Press Ctrl+C to stop the review.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void close());
} catch (error) {
  await close();
  throw error;
}
