import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createNeonHandler } from './adapter.mjs';
import { neonRuntimeEnv } from './bindings.mjs';

const origin = 'https://example.invalid';
const bytes = Buffer.from('<h1>Dashboard</h1>');

test('proxies API uploads and transports streamed events without buffering the response', async t => {
  let startups = 0;
  const server = createServer(async (request, response) => {
    const { url, headers } = request;
    if (url === '/api/v1/stream?after=2') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('id: 3\ndata: open\n\n');
    } else {
      let size = 0;
      for await (const chunk of request) size += chunk.byteLength;
      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ size, authorization: headers.authorization, forwarded: headers['x-forwarded-for'] }));
    }
  });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const { fetch } = createNeonHandler({
    assets: new Map([['/index.html', { type: 'text/html; charset=utf-8', bytes }]]),
    createService: async () => { startups++; return { server, store: { close() {} } }; },
  });

  const site = await fetch(new Request(origin));
  assert.equal(await site.text(), bytes.toString());
  assert.equal(startups, 0);
  const head = await fetch(new Request(origin, { method: 'HEAD' }));
  assert.equal(head.headers.get('content-length'), String(bytes.length));
  assert.equal(head.body, null);

  const [upload, sse] = await Promise.all([
    fetch(new Request(`${origin}/api/v1/upload`, {
      method: 'POST', body: Buffer.alloc(72_000),
      headers: { Authorization: 'Bearer fixture', 'X-Forwarded-For': 'spoofed' },
    })),
    fetch(new Request(`${origin}/api/v1/stream?after=2`, { signal: AbortSignal.timeout(2000) })),
  ]);
  assert.equal(startups, 1);
  assert.equal(upload.status, 201);
  assert.deepEqual(await upload.json(), { size: 72_000, authorization: 'Bearer fixture' });
  assert.equal(sse.headers.get('content-type'), 'text/event-stream');
  assert.equal(sse.headers.get('transfer-encoding'), null);
  const stream = sse.body.getReader();
  assert.equal(Buffer.from((await stream.read()).value).toString(), 'id: 3\ndata: open\n\n');
  await stream.cancel();
});

test('requires explicit least-privilege bindings instead of using injected owner credentials', () => {
  const url = 'postgresql://agus_ai_runtime:fixture@local.invalid/agus_ai?sslmode=verify-full';
  const env = {
    AGUS_DATABASE_URL: url, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url,
    AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'fixture-enrollment-token-032chars', NEON_BRANCH_ID: 'br-fixture',
  };
  assert.equal(neonRuntimeEnv(env).AGUS_DATABASE_URL, url);
  assert.equal(neonRuntimeEnv(env).DATABASE_URL, undefined);
  assert.throws(() => neonRuntimeEnv({ ...env, DATABASE_URL: 'owner' }), /Override both/);
  assert.throws(() => neonRuntimeEnv({ ...env, DATABASE_URL_UNPOOLED: undefined }), /Override both/);
  assert.throws(() => neonRuntimeEnv({ ...env, AGUS_SETTLEMENT_ENABLED: '1' }), /mounted Devnet keypair/);
});
