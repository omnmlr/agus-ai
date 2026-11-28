import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApi, MAX_APK_BYTES, readApk } from '../public/api.mjs';
import { devicesView, invitationReview, paymentView, runDetail } from '../public/views.mjs';
import { createWebServer } from '../scripts/serve.mjs';

async function start(server, context) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => { server.close(); server.closeAllConnections(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('APK encoding preserves bytes across chunks and computes the exact digest', async () => {
  const bytes = randomBytes(25 * 1024 + 2);
  const result = await readApk(new File([bytes], 'fixture.apk'));
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.apkBase64, bytes.toString('base64'));
  await assert.rejects(readApk(new File(['empty extension'], 'fixture.txt')), /non-empty .apk/);
  await assert.rejects(readApk({ size: MAX_APK_BYTES + 1, name: 'large.apk' }), /25 MiB/);
  await assert.rejects(readApk(new File([bytes], 'fixture.apk'), {}), /HTTPS or localhost/);
});

test('session requests and binary evidence stay same-origin', async () => {
  let request;
  const api = createApi(() => 'developer-token', async (...args) => {
    request = args;
    return new Response(Buffer.from('receipt'));
  });
  assert.equal(await (await api.download('/runs/example/evidence/example')).text(), 'receipt');
  assert.equal(request[0], '/api/v1/runs/example/evidence/example');
  assert.equal(request[1].headers.get('Authorization'), 'Bearer developer-token');
});

test('API failures report the control plane code and message', async () => {
  const api = createApi(() => null, async () => Response.json({ error: { code: 'bad_input', message: 'Invalid device' } }, { status: 400 }));
  await assert.rejects(api.post('/runs', {}), { name: 'ApiError', status: 400, code: 'bad_input', message: 'Invalid device' });
});

test('untrusted device, receipt and quote content is escaped', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const devices = devicesView([{ label: malicious, state: malicious, profile: { model: malicious } }]);
  const details = runDetail({ scenario: malicious, receipt: { evidence: [{ sha256: 'a'.repeat(64), label: malicious, url: 'javascript:alert(1)' }] } }, []);
  const payment = paymentView({ state: 'awaiting_funding', quote: { deposit: { wallet: malicious }, funding: { memo: malicious } } });
  for (const html of [devices, details, payment]) {
    assert.equal(html.includes(malicious), false);
    assert.match(html, /&lt;img/);
  }
  assert.doesNotMatch(details, /(?:href|src)="javascript:/);
});

test('private share acceptance requires review and an exact registered build', () => {
  const recipient = { id: 'recipient' };
  const invitation = { id: 'request', state: 'pending', kind: 'provider_share', recipient, requester: { id: 'provider' }, buildSha256: 'b'.repeat(64), packageName: 'app.agus.prototype', evidence: { screenshots: true }, payout: 'unpaid' };
  const match = { id: 'correct', name: 'Exact APK', sha256: invitation.buildSha256, packageName: invitation.packageName };
  const wrong = { ...match, id: 'wrong', name: 'Different APK', packageName: 'app.other.prototype' };
  assert.doesNotMatch(invitationReview(invitation, recipient, { builds: [match] }, false), /Accept invitation/);
  assert.doesNotMatch(invitationReview(invitation, { id: 'stranger' }, { builds: [match] }, true), /Accept invitation/);
  const reviewed = invitationReview({ ...invitation, state: 'reviewed' }, recipient, { builds: [match, wrong] }, true);
  assert.match(reviewed, /Exact APK/);
  assert.match(reviewed, /reviewedTerms/);
  assert.doesNotMatch(reviewed, /Different APK/);
});

test('stopping and unpaid work remain separate from terminal cleanup and Devnet payout', () => {
  const run = { id: 'run', state: 'stopping', scenario: 'app-launch', mode: 'scripted', allocation: 'private', stop: { requestedAt: '2026-11-26T15:00:00.000Z', acknowledgedAt: null } };
  assert.match(runDetail(run, []), /Waiting for the runner to confirm stop/);
  assert.doesNotMatch(runDetail(run, []), /Stop acknowledged/);
  assert.match(runDetail({ ...run, state: 'expired' }, []), /expired before stop and cleanup were confirmed/);
  assert.match(paymentView(null, null, run), /unpaid preview terms/);
  assert.doesNotMatch(paymentView(null, null, run), /Request quote/);
  assert.doesNotMatch(paymentView({ state: 'submitted_or_unknown', quote: {} }, null, run), /Request settlement/);
});

test('web serves both entry points and preserves scoped authorization and bytes in its proxy', async (context) => {
  const upstream = await start(createServer(async (request, response) => {
    const buffer = [];
    for await (const value of request) buffer.push(value);
    response.writeHead(200, { 'Content-Type': 'application/json', Connection: 'x-internal', 'X-Internal': 'hop-only' });
    response.end(JSON.stringify({ path: request.url, authorization: request.headers.authorization, body: Buffer.concat(buffer).toString() }));
  }), context);
  const origin = await start(createWebServer({ upstream, directory: new URL('../public/', import.meta.url) }), context);
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Test on devices./);
  const consoleResponse = await fetch(`${origin}/console.html`);
  assert.equal(consoleResponse.status, 200);
  assert.match(consoleResponse.headers.get('content-security-policy'), /img-src 'self' blob:/);
  assert.match(await consoleResponse.text(), /console\.mjs/);
  const module = await fetch(`${origin}/console.mjs`, { method: 'HEAD' });
  assert.match(module.headers.get('content-type'), /text\/javascript/);
  assert.equal(await module.text(), '');
  const proxied = await fetch(`${origin}/api/v1/builds?sample=1`, { method: 'POST', headers: { Authorization: 'Bearer example' }, body: 'APK' });
  assert.deepEqual(await proxied.json(), { path: '/api/v1/builds?sample=1', authorization: 'Bearer example', body: 'APK' });
  assert.equal(proxied.headers.get('x-internal'), null);
  const share = await fetch(`${origin}/invite/${'a'.repeat(43)}`, { redirect: 'manual' });
  assert.equal(share.status, 302);
  assert.equal(share.headers.get('location'), `/console.html#invite/${'a'.repeat(43)}`);
  assert.equal(share.headers.get('cache-control'), 'no-store');
  for (const [path, expected] of [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'],
    ['/docs/quickstart', 'From APK to test run'], ['/docs/api', 'Control-plane API']]) {
    const page = await fetch(origin + path);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(expected));
  }
  const missing = await fetch(`${origin}/package.json`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /This page is out of scope/);
});
