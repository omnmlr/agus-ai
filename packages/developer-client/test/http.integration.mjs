import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAgusClient } from '../src/typed.mjs';
import { createControlPlane } from '../../../services/control-plane/src/server.mjs';

test('typed client accepts the actual API contract and switches to a refreshed session', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'agus-client-'));
  const app = await createControlPlane({
    env: { AGUS_LOCAL_DATA_DIR: directory, AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'fixture-bootstrap-authorization' },
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    await app.store.close();
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = 'http://127.0.0.1:' + app.server.address().port;
  let token;
  const client = createAgusClient({ baseUrl, getToken: () => token });
  assert.equal((await client.GET('/api/v1/projects')).error.error.code, 'unauthorized');
  const registration = await client.POST('/api/v1/auth/register', {
    body: { email: 'typed-client@example.com', password: 'synthetic-client-acceptance' },
  });
  assert.equal(registration.response.status, 200);
  assert.equal(registration.data.user.capabilities.developer, true);
  token = registration.data.token;
  const created = await client.POST('/api/v1/projects', { body: { name: 'Contract test' } });
  assert.equal(created.response.status, 201);
  assert.deepEqual((await client.GET('/api/v1/projects')).data.projects, [created.data.project]);
  const renewed = await client.POST('/api/v1/auth/refresh');
  assert.equal(renewed.response.status, 200);
  assert.equal((await client.GET('/api/v1/projects')).response.status, 401);
  token = renewed.data.token;
  assert.equal((await client.GET('/api/v1/projects')).response.status, 200);
});
