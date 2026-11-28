import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';
import { digest } from '../../services/control-plane/src/security.mjs';
import { createWebServer } from '../../apps/web/scripts/serve.mjs';
import { enroll, heartbeat, leaseProof } from '../../services/control-plane/test-support/pilot-fixtures.mjs';
import { verifyNativeReceipt } from '../../packages/developer-client/src/native-receipt.mjs';

const directory = await mkdtemp(join(tmpdir(), 'agus-browser-'));
const captures = process.env.AGUS_BROWSER_SCREENSHOTS;
if (captures) await mkdir(captures, { recursive: true });
const registrationToken = 'disposable-browser-registration-token';
const artifact = Buffer.from([80, 75, 3, 4, 1, 0, 0, 0]);
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const config = {
  AGUS_LOCAL_DATA_DIR: join(directory, 'state'), AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'disposable-preview-test-only',
  AGUS_REGISTRATION_TOKEN: registrationToken, AGUS_PRODUCT_PILOT: '1', AGUS_NATIVE_MANIFEST_PKCS8: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([{
    sha256: digest(artifact), packageName: 'app.agus.preview.fixture', signerSha256: 'f'.repeat(64),
  }]),
};
// This isolated chain double never broadcasts. It exercises quote rendering and
// the production control plane's refusal to clear an unconfirmed transfer.
const localChain = {
  network: { cluster: 'localnet', mint: 'So11111111111111111111111111111111111111112', decimals: 6 },
  depositWallet: '11111111111111111111111111111111',
  quoteWindow: () => 100,
  tokenAccount: owner => owner,
  verifyFunding: () => {
    const error = new Error('The fixture has no finalized funding transfer.');
    error.statusCode = 409;
    error.code = 'funding_not_finalized';
    throw error;
  },
};
const control = await createControlPlane({ env: config, overrides: { campaignChain: localChain } });
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
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 940, deviceScaleFactor: 1, mobile: false });
  const capture = async (name, selector) => {
    if (!captures) return;
    await run('document.fonts.ready.then(() => window.scrollTo(0, 0))');
    if (selector) await run(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`);
    const { data } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    await writeFile(join(captures, name + '.jpg'), Buffer.from(data, 'base64'));
  };
  const wait = predicate => until(() => run(predicate), 'Browser did not reach: ' + predicate);
  const fill = (selector, value) => run(`document.querySelector(${JSON.stringify(selector)}).value = ${JSON.stringify(value)}`);
  const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await cdp('Page.navigate', { url: origin + '/console.html' });
  await wait("document.querySelector('#auth-form')");
  await capture('auth-desktop');
  await cdp('Page.navigate', { url: origin + '/invite/' + 'a'.repeat(43) });
  await wait("location.hash.startsWith('#invite/') && document.querySelector('#auth-form')");
  assert.equal(await run("document.body.innerText.includes('received this private invitation')"), true);
  await cdp('Page.navigate', { url: origin + '/console.html' });
  await wait("document.querySelector('#auth-form') && !location.hash");
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await capture('auth-mobile');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 940, deviceScaleFactor: 1, mobile: false });
  await click('#google-start-form button');
  await wait("document.querySelector('#notice [role=alert]')");
  await capture('auth-unavailable');
  await click('[data-action=toggle-auth]');
  await fill('#auth-form [name=email]', 'buyer@example.invalid');
  await fill('#auth-form [name=password]', 'disposable-browser-password');
  await click('#auth-form button[type=submit]');
  await wait("document.querySelector('#notice [role=alert]')?.textContent.includes('Registration token')");
  await fill('#auth-form [name=registrationToken]', registrationToken);
  await click('#auth-form button[type=submit]');
  await wait("document.querySelector('#project-form')");
  await capture('console-onboarding');
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
  evidence.push('Unavailable Google entry, denied uninvited signup, invited registration, project creation and APK upload passed');
  await capture('console-overview');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  assert.equal(await run('document.documentElement.scrollWidth - document.documentElement.clientWidth'), 0);
  await capture('console-mobile');
  await click('#console-menu');
  assert.equal(await run("document.querySelector('#console-menu').getAttribute('aria-expanded')"), 'true');
  await capture('console-drawer');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait("document.querySelector('#console-menu').getAttribute('aria-expanded') === 'false'");
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 940, deviceScaleFactor: 1, mobile: false });
  await click('a[href="#campaigns"]');
  await wait("document.querySelector('#campaign-form')");
  await capture('campaign-creation');
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
  await fill('#campaign-form [name=objective]', 'Reproduce onboarding behavior and review structured findings');
  await click('#campaign-form button[type=submit]');
  await wait("document.body.innerText.includes('Revision 2')");
  await capture('campaign-draft');
  await run("const theme = document.querySelector('[data-theme-control]'); theme.value = 'dark'; theme.dispatchEvent(new Event('change', { bubbles: true }))");
  await capture('campaign-draft-dark');
  await run("const themeReset = document.querySelector('[data-theme-control]'); themeReset.value = 'light'; themeReset.dispatchEvent(new Event('change', { bubbles: true }))");
  await click('[data-operation=launch]');
  await wait("document.querySelector('[data-operation=pause]')");
  assert.equal(await run("document.body.innerText.includes('0/1 measured')"), true);
  assert.equal(await run("document.body.innerText.includes('Open dedicated run')"), true);
  await click('[data-operation=pause]');
  await wait("document.querySelector('[data-operation=resume]')");
  await click('[data-operation=resume]');
  await wait("document.querySelector('[data-operation=pause]')");
  evidence.push('Mixed campaign draft, saved revision, publish, coverage, dedicated link, pause and resume passed');
  const campaignHash = await run('location.hash');
  await click('a[href="#runs"]');
  await wait("document.querySelector('#run-form')");
  await wait("document.querySelector('#run-form [name=buildId]')?.options.length > 1");
  await run("document.querySelector('#run-form [name=buildId]').selectedIndex = 1");
  const countRuns = () => run("fetch('/api/v1/runs',{headers:{Authorization:'Bearer '+JSON.parse(sessionStorage.getItem('agus-console-session')).token}}).then(response=>response.json()).then(result=>result.runs.length)");
  const startingRuns = await countRuns();
  let droppedResponse = false;
  const dropOnce = async ({ data }) => {
    const { method, params } = JSON.parse(data);
    if (method !== 'Fetch.requestPaused') return;
    try {
      if (!droppedResponse && params.request.method === 'POST' && params.responseStatusCode === 201) {
        droppedResponse = true;
        await cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' });
      } else {
        await cdp('Fetch.continueRequest', { requestId: params.requestId });
      }
    } catch { /* A disabled interception detaches any paused request. */ }
  };
  socket.addEventListener('message', dropOnce);
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/runs', requestStage: 'Response' }] });
  await click('#run-form button[type=submit]');
  await wait("document.querySelector('#notice [role=alert]')?.textContent.includes('result is unknown')");
  await cdp('Fetch.disable');
  socket.removeEventListener('message', dropOnce);
  assert.equal(droppedResponse, true);
  assert.equal(await countRuns(), startingRuns + 1);
  await click('#run-form button[type=submit]');
  await wait("document.querySelector('#run-detail')?.innerText.includes('Queued')");
  assert.equal(await countRuns(), startingRuns + 1);
  evidence.push('Retry after a dropped successful create response reused its idempotency key and kept one run');
  await wait("document.querySelector('#payment-detail')?.innerText.includes('unpaid preview terms')");
  const queuedHash = await run('location.hash');
  await capture('test-run-detail');
  await fill('#run-search', 'no-matching-fixture');
  await run("document.querySelector('#run-search').dispatchEvent(new InputEvent('input', { bubbles: true }))");
  await wait("document.querySelector('#run-history')?.innerText.includes('No runs match')");
  const cancel = click('[data-action=cancel-run]');
  await delay(180);
  await cdp('Page.handleJavaScriptDialog', { accept: true });
  await cancel;
  await wait("document.querySelector('#run-detail')?.innerText.includes('Cancelled')");
  await cdp('Page.reload');
  await wait("document.querySelector('#run-detail')?.innerText.includes('Cancelled')");
  evidence.push('Queued a run, filtered history, inspected unpaid terms, cancelled, and reloaded the tab successfully');
  await run(`location.hash = ${JSON.stringify(campaignHash)}`);
  await wait("document.querySelector('[data-operation=pause]')");
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
    email: 'browser-test-contributor@example.invalid', password: 'disposable-browser-password', registrationToken,
  } });
  const foreignRun = await fetch(api + '/api/v1/runs/' + queuedHash.split('/').at(-1), {
    headers: { Authorization: 'Bearer ' + contributor.token },
  });
  assert.equal(foreignRun.status, 404);
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
  await capture('findings-and-evidence', 'section.panel:has([data-action=campaign-receipt])');
  evidence.push('Developer browser reviewed a separately submitted software-signed fixture finding and recorded test compensation');
  await cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  await click('[data-action=campaign-receipt]');
  const receipt = await until(async () => JSON.parse(await readFile(join(directory, 'agus-native-receipt.json'), 'utf8')),
    'Browser did not download the signed campaign receipt');
  const trustedKey = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const verified = verifyNativeReceipt(receipt, trustedKey);
  assert.equal(verified.assignmentId, offer.id);
  assert.equal(verified.buildSha256, digest(artifact));
  assert.equal(verified.cleanupConfirmed, true);
  evidence.push('Downloaded receipt verified independently with the pinned manifest key');
  await click('[data-action=download-campaign-report]');
  const report = await until(async () => JSON.parse(await readFile(join(directory, 'agus-campaign-report.json'), 'utf8')),
    'Browser did not download the campaign report');
  assert.equal(report.acceptedTestUnits, 5);
  // The separate test account is authorized as the independent quote reviewer.
  const buyer = JSON.parse(await run("sessionStorage.getItem('agus-console-session')"));
  control.config.pilot.reviewerIds.add(contributor.user.id);
  await control.store.transaction(state => {
    state.users[buyer.user.id].payoutWallet = 'SysvarRent111111111111111111111111111111111';
    state.users[buyer.user.id].payoutWalletVerifiedAt = new Date().toISOString();
  });
  await click('a[href="#campaigns"]');
  await wait("document.querySelector('#campaign-form')");
  await fill('#campaign-form [name=title]', 'Localnet funding quote fixture');
  await fill('#campaign-form [name=objective]', 'Check the pending and unavailable funding states.');
  await fill('#campaign-form [name=deadline]', new Date(Date.now() + 3_900_000).toISOString().slice(0, 16));
  await fill('[name=taskTitle]', 'Quote-only coverage');
  await fill('[name=instructions]', 'Use the approved fixture in the disposable local lab.');
  await fill('[name=amountAtoms]', '1000000');
  await click('#campaign-form button[type=submit]');
  await wait("document.querySelector('[data-action=campaign-funding-quote]')");
  const quote = click('[data-action=campaign-funding-quote]');
  await delay(180);
  await cdp('Page.handleJavaScriptDialog', { accept: true });
  await quote;
  await wait("document.querySelector('[data-form=campaign-funding-verify]')");
  await capture('funding-quote', 'section.panel:has([data-form=campaign-funding-verify])');
  assert.equal(await run("Boolean(document.querySelector('[data-operation=launch]'))"), false);
  await fill('[data-form=campaign-funding-verify] [name=signature]', '3'.repeat(64));
  await click('[data-form=campaign-funding-verify] button[type=submit]');
  await wait("document.querySelector('#notice [role=alert]')?.textContent.includes('no finalized')");
  await capture('funding-unconfirmed');
  assert.equal(await run("Boolean(document.querySelector('[data-operation=launch]'))"), false);
  evidence.push('Browser displayed a locked Localnet fixture quote and kept publication blocked after unconfirmed funding');

  await run(`sessionStorage.setItem('agus-console-session', ${JSON.stringify(JSON.stringify({ ...buyer, expiresAt: new Date().toISOString() }))})`);
  await run("history.replaceState(null, '', '#settings')");
  await cdp('Page.reload');
  await wait("document.querySelector('#profile-form')");
  const rotatedToken = JSON.parse(await run("sessionStorage.getItem('agus-console-session')")).token;
  assert.notEqual(rotatedToken, buyer.token);
  const revoked = await fetch(api + '/api/v1/projects', { headers: { Authorization: 'Bearer ' + buyer.token } });
  assert.equal(revoked.status, 401);
  await fill('#profile-form [name=displayName]', 'Browser QA');
  await click('#profile-form button[type=submit]');
  await wait("document.querySelector('#notice')?.innerText.includes('Profile saved')");
  await click('#preferences-form [name=campaignUpdates]');
  await click('#preferences-form button[type=submit]');
  await wait("document.querySelector('#notice')?.innerText.includes('Notification preferences saved')");
  assert.equal((await request('GET', '/me/notifications/preferences', { credential: rotatedToken })).preferences.campaignUpdates, false);
  await run("const theme = document.querySelector('[data-theme-control]'); theme.value = 'dark'; theme.dispatchEvent(new Event('change', { bubbles: true }))");
  await wait("document.documentElement.dataset.theme === 'dark'");
  await capture('settings-dark');
  await cdp('Page.reload');
  await wait("document.documentElement.dataset.theme === 'dark' && document.querySelector('#preferences-form')");
  await run("const lightTheme = document.querySelector('[data-theme-control]'); lightTheme.value = 'light'; lightTheme.dispatchEvent(new Event('change', { bubbles: true }))");
  await wait("document.documentElement.dataset.theme === 'light'");
  await capture('settings-light');
  await click('a[href="#inbox"]');
  await wait("document.querySelector('#screen h1')?.textContent === 'Inbox'");
  evidence.push('Tenant isolation, session rotation and invalidation, profile and inbox preferences passed');
  await click('[data-action=sign-out]');
  await wait("document.querySelector('#auth-form')");
  assert.equal((await fetch(api + '/api/v1/projects', { headers: { Authorization: 'Bearer ' + rotatedToken } })).status, 401);
  evidence.push('Sign-out revoked the active session and returned to authentication');
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
