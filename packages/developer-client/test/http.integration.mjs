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

test('hosted stdio MCP queues, reads and stops an authorized API run', async (t) => {
  const { createHash, generateKeyPairSync } = await import('node:crypto');
  const { fileURLToPath } = await import('node:url');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const directory = await mkdtemp(join(tmpdir(), 'agus-mcp-'));
  const app = await createControlPlane({
    env: {
      AGUS_LOCAL_DATA_DIR: directory, AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'fixture-bootstrap-authorization',
      AGUS_PRODUCT_PILOT: '1', AGUS_NATIVE_MANIFEST_PKCS8: generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      }).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    },
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  let token;
  const api = createAgusClient({ baseUrl: origin, getToken: () => token });
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const mcp = new Client({ name: 'integration-test', version: '0.1.0' });
  t.after(async () => {
    await mcp.close();
    await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    await app.store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const registration = await api.POST('/api/v1/auth/register', {
    body: { email: 'mcp-client@example.com', password: 'synthetic-client-acceptance' },
  });
  token = registration.data.token;
  const { data: { project } } = await api.POST('/api/v1/projects', { body: { name: 'MCP fixture' } });
  const apk = Buffer.from([80, 75, 3, 4, 0, 0, 0, 0]);
  const { data: { build } } = await api.POST('/api/v1/builds', { body: {
    projectId: project.id, name: 'MCP fixture bytes', packageName: 'app.agus.testfixture',
    sha256: createHash('sha256').update(apk).digest('hex'), apkBase64: apk.toString('base64'),
  } });
  await mcp.connect(new StdioClientTransport({
    command: process.execPath, args: [cli, 'mcp'],
    env: { AGUS_API_URL: origin, AGUS_API_TOKEN: token },
  }));
  async function call(name, args) {
    const result = await mcp.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    return result.structuredContent;
  }
  assert.deepEqual(await call('list_devices', {}), { devices: [] });
  const queued = await call('start_run', { projectId: project.id, buildId: build.id, scenario: 'app-launch', mode: 'scripted' });
  assert.equal(queued.run.state, 'queued');
  const input = { runId: queued.run.id };
  assert.equal((await call('get_run', input)).run.buildId, build.id);
  assert.equal((await call('cancel_run', input)).run.state, 'cancelled');
  assert.deepEqual((await call('list_run_events', input)).events.map(event => event.type), ['run.queued', 'run.cancelled']);

  const owner = await api.POST('/api/v1/auth/register', {
    body: { email: 'mcp-provider@example.com', password: 'synthetic-provider-acceptance' },
  });
  const ownerApi = createAgusClient({ baseUrl: origin, getToken: () => owner.data.token });
  const { data: { pairing } } = await ownerApi.POST('/api/v1/me/devices/pairings');
  const { publicKey } = generateKeyPairSync('ed25519');
  const enrollment = await fetch(origin + '/api/v1/provider/enroll', {
    method: 'POST', headers: { authorization: 'Bearer ' + pairing.code, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Synthetic provider', publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
      devices: [{ id: 'private', dedicated: true, profile: { kind: 'emulator' }, scenarios: ['app-launch'] }] }),
  });
  assert.equal(enrollment.status, 200);
  const { providerId } = await enrollment.json();
  const privateInput = { projectId: project.id, buildId: build.id, deviceId: providerId + ':private',
    scenario: 'app-launch', mode: 'agent', idempotencyKey: 'test-mcp-private' };
  const requested = await call('request_private_device', privateInput);
  assert.equal(requested.token, undefined);
  assert.equal(requested.invitation.state, 'pending');
  assert.equal((await call('request_private_device', privateInput)).invitation.id, requested.invitation.id);
  const { data: { invitations } } = await ownerApi.GET('/api/v1/invitations');
  assert.equal(invitations[0].id, requested.invitation.id);
  assert.equal((await call('list_runs', {})).runs.length, 1);
  const draft = { projectId: project.id, title: 'Dedicated release coverage', objective: 'Check the approved launch scenario',
    deadlineAt: Date.now() + 3_600_000, tasks: [{
      title: 'Launch on the dedicated fixture', buildId: build.id, count: 1, instructions: 'Observe the reviewed launch result',
      runtimeClass: 'dedicated_runner', kind: 'automated_test',
    }] };
  const { campaign } = await call('create_campaign_draft', { draft, idempotencyKey: 'mixed-client-check' });
  assert.equal((await call('list_campaigns', {})).campaigns[0].id, campaign.id);
  assert.equal((await call('get_campaign_report', { campaignId: campaign.id })).report.cells[0].missing, 1);
  const published = await api.POST('/api/v1/campaigns/{campaignId}/launch', {
    params: { path: { campaignId: campaign.id } }, body: { expectedRevision: 1 },
  });
  assert.equal(published.data.campaign.state, 'active');
  const report = await api.GET('/api/v1/campaigns/{campaignId}/report', { params: { path: { campaignId: campaign.id } } });
  assert.equal(report.data.report.assignments[0].run.buildId, build.id);
});
