import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest } from '../../services/control-plane/src/security.mjs';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';

const directory = resolve(process.argv[2]);
const action = process.argv[3];
const endpoint = 'http://127.0.0.1:18765/api/v1';
const testUser = { email: 'reviewer@example.invalid', password: 'DisposablePilotPassword123' };

async function request(method, path, token, body) {
  const response = await fetch(endpoint + path, {
    method, redirect: 'error',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw Error(path + ' returned ' + response.status + ' ' + value.error?.code);
  return value;
}

const apk = await readFile(resolve(directory, 'fixture.apk'));
const reviewed = { sha256: digest(apk), packageName: 'app.agus.preview.fixture',
  signerSha256: (await readFile(resolve(directory, 'fixture-signer.txt'), 'utf8')).trim() };

if (action === 'serve') {
  const data = resolve(directory, 'database');
  await mkdir(data, { recursive: true, mode: 0o700 });
  const app = await createControlPlane({ env: {
    AGUS_LOCAL_DATA_DIR: data, AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'disposable-local-fixture-only',
    AGUS_PRODUCT_PILOT: '1', AGUS_NATIVE_MANIFEST_PKCS8: (await readFile(resolve(directory, 'manifest.pkcs8'), 'utf8')).trim(),
    AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([reviewed]),
  } });
  app.server.listen(18765, '127.0.0.1');
  process.once('SIGTERM', () => app.server.close(() => app.store.close()));
} else if (action === 'seed') {
  const { token } = await request('POST', '/auth/register', null, {
    email: 'developer@example.invalid', password: 'DisposableBuilderPassword123',
  });
  const contributor = await request('POST', '/auth/register', null, testUser);
  await request('POST', '/me/qualifications/duplicate-onboarding-v1/submissions', contributor.token, {
    sequence: ['continue', 'review', 'continue'], expectedCode: 'single_continue', actualCode: 'multiple_continue',
    walletAnswer: 'finalized_effects', evidenceNote: 'Compare the reviewed onboarding action counter twice.',
  });
  const { project } = await request('POST', '/projects', token, { name: 'Onboarding preview' });
  const { build } = await request('POST', '/builds', token, {
    name: 'Pinned test build', sha256: reviewed.sha256, packageName: reviewed.packageName,
    projectId: project.id, apkBase64: apk.toString('base64'),
  });
  const task = { buildId: build.id, count: 1, maximumDurationSeconds: 180, testUnits: 5 };
  const { campaign } = await request('POST', '/campaigns', token, { projectId: project.id, title: 'Onboarding regression',
    objective: 'Compare a structured human finding with a deterministic cooperative run.',
    deadlineAt: Date.now() + 3_600_000, budgetTestUnits: 10, tasks: [
      { ...task, kind: 'human_test', runtimeClass: 'phone_human', title: 'Detect duplicate onboarding',
        instructions: 'Tap Continue, return to review, and tap Continue again. Record what differs.' },
      { ...task, kind: 'automated_test', runtimeClass: 'phone_cooperative', title: 'Cooperative onboarding check',
        instructions: 'Run the reviewed action sequence.' },
    ] });
  await request('POST', '/campaigns/' + campaign.id + '/launch', token, { expectedRevision: 1 });
  await writeFile(resolve(directory, 'seed.private.json'), JSON.stringify({ token, campaignId: campaign.id }), { mode: 0o600 });
} else if (action === 'review') {
  const { token, campaignId } = JSON.parse(await readFile(resolve(directory, 'seed.private.json'), 'utf8'));
  const path = '/campaigns/' + campaignId + '/report';
  const { report } = await request('GET', path, token);
  for (const assignment of report.assignments) {
    if (assignment.state !== 'submitted') throw Error(assignment.task.title + ' is ' + assignment.state);
    await request('POST', '/assignments/' + assignment.id + '/reviews', token, {
      attemptId: assignment.attempt.id, version: 1, decision: 'accept', reason: 'Completed the authorized preview workflow.',
    });
  }
  await request('POST', '/campaigns/' + campaignId + '/complete', token, { expectedRevision: 1 });
  const updated = (await request('GET', path, token)).report;
  if (updated.acceptedTestUnits !== 10 || updated.cells[0].failed !== 1 || updated.cells[1].passed !== 1) {
    throw Error('Unexpected campaign report');
  }
  const evidence = { cells: updated.cells, acceptedTestUnits: updated.acceptedTestUnits,
    scope: 'AOSP emulator, synthetic identities, nontransferable test units',
    evidence: updated.assignments.map(assignment => assignment.attempt.evidence) };
  await writeFile(resolve(directory, 'campaign-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
} else throw Error('Expected serve, seed or review');
