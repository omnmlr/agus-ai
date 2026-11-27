import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';
import { digest } from '../../services/control-plane/src/security.mjs';
import { createWebServer } from '../../apps/web/scripts/serve.mjs';
import { enroll, heartbeat, leaseProof } from '../../services/control-plane/test-support/pilot-fixtures.mjs';

const directory = await mkdtemp(join(tmpdir(), 'agus-browser-'));
const artifact = Buffer.from([80, 75, 3, 4, 1, 0, 0, 0]);
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const config = {
  AGUS_LOCAL_DATA_DIR: join(directory, 'state'), AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'disposable-preview-test-only',
  AGUS_PRODUCT_PILOT: '1', AGUS_NATIVE_MANIFEST_PKCS8: key.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([{
    sha256: digest(artifact), packageName: 'app.agus.preview.fixture', signerSha256: 'f'.repeat(64),
  }]),
};
const control = await createControlPlane({ env: config });
const listen = async server => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
};
const api = await listen(control.server);
const web = createWebServer({ upstream: api, directory: new URL('../../apps/web/public/', import.meta.url) });
const origin = await listen(web);
const browser = spawn(process.env.CHROMIUM ?? 'chromium', [
  '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=0', '--user-data-dir=' + join(directory, 'browser'), 'about:blank',
], { stdio: 'ignore', env: { ...process.env, TZ: 'UTC' } });
const evidence = [];
let socket;

async function until(action, reason) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const result = await action();
      if (result) return result;
    } catch { /* The browser may be starting or navigating. */ }
    await delay(100);
  }
  throw new Error(reason);
}

try {
  const port = await until(async () => (await readFile(join(directory, 'browser/DevToolsActivePort'), 'utf8')).split('\n')[0],
    'Chromium DevTools did not start');
  const [target] = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const answer = JSON.parse(data);
    const entry = pending.get(answer.id);
    if (!entry) return;
    pending.delete(answer.id);
    if (answer.error) entry.reject(new Error(answer.error.message));
    else entry.resolve(answer.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const answer = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? 'Browser evaluation failed');
    return answer.result.value;
  };
  const wait = predicate => until(() => run(predicate), 'Browser did not reach: ' + predicate);
  const fill = (selector, value) => run(`document.querySelector(${JSON.stringify(selector)}).value = ${JSON.stringify(value)}`);
  const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await cdp('Page.navigate', { url: origin + '/console.html' });
  await wait("document.querySelector('#auth-form')");
  await click('[data-action=toggle-auth]');
  await fill('[name=email]', 'buyer@example.invalid');
  await fill('[name=password]', 'disposable-browser-password');
  await click('#auth-form button[type=submit]');
  await wait("document.querySelector('#project-form')");
  await fill('#project-form [name=name]', 'Browser project');
  await click('#project-form button[type=submit]');
  await wait("document.querySelector('#build-form')");
  const apk = join(directory, 'browser-fixture.apk');
  await writeFile(apk, artifact);
  const { root: doc } = await cdp('DOM.getDocument');
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: doc.nodeId, selector: '#build-form input[type=file]' });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [apk] });
  await fill('#build-form [name=name]', 'Browser fixture');
  await fill('#build-form [name=packageName]', 'app.agus.preview.fixture');
  await click('#build-form button[type=submit]');
  await wait("document.body.innerText.includes('Build registered.')");
  evidence.push('Real registration, project creation and browser-computed APK upload passed');
  await click('a[href="#campaigns"]');
  await wait("document.querySelector('#campaign-form')");
  await fill('#campaign-form [name=title]', 'Browser onboarding campaign');
  await fill('#campaign-form [name=objective]', 'Reproduce onboarding behavior');
  await fill('#campaign-form [name=deadline]', new Date(Date.now() + 3_600_000).toISOString().slice(0, 16));
  await fill('[name=taskTitle]', 'Attended onboarding');
  await fill('[name=instructions]', 'Try the reviewed app and report structured results.');
  await fill('[name=testUnits]', '5');
  await fill('[name=budget]', '5');
  await click('[data-action=add-campaign-task]');
  await fill('[data-campaign-task]:last-child [name=lane]', 'dedicated_runner:automated_test');
  await fill('[data-campaign-task]:last-child [name=taskTitle]', 'Dedicated coverage');
  await fill('[data-campaign-task]:last-child [name=instructions]', 'Open the approved release build.');
  await click('#campaign-form button[type=submit]');
  await wait("document.querySelector('[data-operation=launch]')");
  await click('[data-operation=launch]');
  await wait("document.querySelector('[data-operation=pause]')");
  assert.equal(await run("document.body.innerText.includes('0/1 measured')"), true);
  assert.equal(await run("document.body.innerText.includes('Open dedicated run')"), true);
  await click('[data-operation=pause]');
  await wait("document.querySelector('[data-operation=resume]')");
  await click('[data-operation=resume]');
  await wait("document.querySelector('[data-operation=pause]')");
  evidence.push('Mixed campaign draft, publish, coverage, dedicated link, pause and resume passed');
  const request = async (method, route, { credential, body } = {}) => {
    const response = await fetch(api + '/api/v1' + route, { method,
      headers: { ...(credential && { Authorization: 'Bearer ' + credential }),
        ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined });
    const value = await response.json();
    assert(response.ok, JSON.stringify(value));
    return value;
  };
  const contributor = await request('POST', '/auth/register', { body: {
    email: 'browser-test-contributor@example.invalid', password: 'disposable-browser-password',
  } });
  await request('POST', '/me/qualifications/duplicate-onboarding-v1/submissions', { credential: contributor.token,
    body: { sequence: ['continue', 'review', 'continue'], expectedCode: 'single_continue', actualCode: 'multiple_continue',
      walletAnswer: 'skip', evidenceNote: 'One expected action and two observed actions.' } });
  const runtime = await enroll({ request }, contributor, 'phone_human');
  await request('POST', '/runtime/installations/' + runtime.id + '/heartbeat', {
    credential: runtime.credential, body: heartbeat(runtime, 1) });
  const { assignments: [offer] } = await request('GET', '/me/assignments', { credential: contributor.token });
  const { assignment } = await request('POST', '/me/assignments/' + offer.id + '/accept', {
    credential: contributor.token, body: { termsDigest: offer.termsDigest, installationId: runtime.id, consent: true } });
  const { lease } = await request('POST', '/runtime/installations/' + runtime.id + '/claim', {
    credential: runtime.credential, body: { assignmentId: offer.id } });
  const leasePath = '/runtime/leases/' + lease.id;
  await request('POST', leasePath + '/report', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'report', { outcome: 'completed', observations: [] }) });
  await request('POST', leasePath + '/cleanup', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: true, installRestricted: true }) });
  await request('POST', '/assignments/' + offer.id + '/submissions', { credential: contributor.token, body: {
    attemptId: assignment.attempt.id, expectedVersion: 0, steps: ['Continue', 'Return to review', 'Continue'],
    expected: 'One submission', actual: 'Two submissions', category: 'bug', result: 'failed',
  } });
  await click('[data-action=retry]');
  await wait("document.querySelector('form[data-form=campaign-review]')");
  await fill('form[data-form=campaign-review] [name=reason]', 'Exact steps and outcomes supplied for triage.');
  await click('form[data-form=campaign-review] button[type=submit]');
  await wait("document.body.innerText.includes('1 accepted, 1 failed')");
  assert.equal(await run("document.body.innerText.includes('5 accepted and 0 reserved')"), true);
  evidence.push('Developer browser reviewed a separately submitted software-signed fixture finding and recorded test compensation');
  await click('[data-action=sign-out]');
  await wait("document.querySelector('#auth-form')");
  evidence.push('Sign-out returned to authentication');
  console.log(JSON.stringify({ provenance: 'Chromium and real local API with synthetic APK bytes', evidence }, null, 2));
} finally {
  socket?.close();
  if (browser.exitCode === null) {
    browser.kill();
    await once(browser, 'exit');
  }
  web.closeAllConnections();
  control.server.closeAllConnections();
  await Promise.all([new Promise(resolve => web.close(resolve)), new Promise(resolve => control.server.close(resolve))]);
  await control.store.close();
  await rm(directory, { recursive: true, force: true });
}
