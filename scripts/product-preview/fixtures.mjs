import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest } from '../../services/control-plane/src/security.mjs';
import { createControlPlane } from '../../services/control-plane/src/server.mjs';
import { verifyNativeReceipt } from '../../packages/developer-client/src/native-receipt.mjs';

const directory = resolve(process.argv[2]);
const action = process.argv[3];
const journey = process.env.AGUS_PREVIEW_JOURNEY ?? 'full';
if (!['full', 'safety', 'cooperative'].includes(journey)) throw Error('Unknown Android preview journey');
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
  const cases = [
    { ...task, kind: 'human_demonstration', runtimeClass: 'phone_human', title: 'Detect duplicate onboarding',
      trainingEligible: true, instructions: 'Tap Continue, return to review, and tap Continue again. Record what differs.' },
    { ...task, kind: 'automated_test', runtimeClass: 'phone_cooperative', title: 'Cooperative onboarding check',
      instructions: 'Run the reviewed action sequence.' },
    { ...task, kind: 'human_test', runtimeClass: 'phone_human', title: 'Owner interruption', stopTestUnits: 2,
      instructions: 'Stop the foreground assignment using the Android notification.' },
    { ...task, kind: 'human_test', runtimeClass: 'phone_human', title: 'Offline authority expiry', stopTestUnits: 2,
      instructions: 'Confirm the watchdog suspends the app when authority expires offline.' },
  ];
  const tasks = journey === 'safety' ? cases.slice(2) : journey === 'cooperative' ? [cases[1]] : cases;
  const { campaign } = await request('POST', '/campaigns', token, { projectId: project.id, title: 'Onboarding regression',
    objective: 'Verify signed evidence and safe cleanup for authorized Android testing.',
    deadlineAt: Date.now() + 3_600_000, budgetTestUnits: tasks.length * task.testUnits, tasks });
  await request('POST', '/campaigns/' + campaign.id + '/launch', token, { expectedRevision: 1 });
  await writeFile(resolve(directory, 'seed.private.json'), JSON.stringify({ token, campaignId: campaign.id }), { mode: 0o600 });
} else if (action === 'review') {
  const { token, campaignId } = JSON.parse(await readFile(resolve(directory, 'seed.private.json'), 'utf8'));
  const path = '/campaigns/' + campaignId + '/report';
  const { report } = await request('GET', path, token);
  const trustedKey = (await readFile(resolve(directory, 'manifest.public.b64'), 'utf8')).trim();
  for (const assignment of report.assignments) {
    const successful = ['human_demonstration', 'automated_test'].includes(assignment.task.kind);
    if (assignment.state !== (successful ? 'submitted' : 'interrupted')) {
      throw Error(assignment.task.title + ' is ' + assignment.state);
    }
    if (successful) {
      const evidence = await request('GET', '/assignments/' + assignment.id + '/receipt', token);
      const verified = verifyNativeReceipt(evidence.receipt, trustedKey);
      if (!verified.cleanupConfirmed || verified.buildSha256 !== reviewed.sha256
        || verified.assignmentId !== assignment.id || verified.attemptId !== assignment.attempt.id) {
        throw Error('Receipt did not verify against the built fixture, reviewed assignment and cleanup');
      }
      await writeFile(resolve(directory, assignment.task.runtimeClass + '-receipt.json'), JSON.stringify(evidence, null, 2) + '\n');
    }
    await request('POST', '/assignments/' + assignment.id + '/reviews', token, {
      attemptId: assignment.attempt.id, version: successful ? 1 : 0, decision: successful ? 'accept' : 'partial',
      reason: 'Completed the authorized preview workflow.',
    });
  }
  await request('POST', '/campaigns/' + campaignId + '/complete', token, { expectedRevision: 1 });
  const updated = (await request('GET', path, token)).report;
  const expected = { full: 14, safety: 4, cooperative: 5 }[journey];
  if (updated.acceptedTestUnits !== expected || (journey === 'full' && updated.cells[0].failed !== 1)
    || (journey !== 'safety' && updated.cells.find(cell => cell.runtimeClass === 'phone_cooperative')?.passed !== 1)) {
    throw Error('Unexpected campaign report');
  }
  const demo = updated.assignments.find(assignment => assignment.task.kind === 'human_demonstration');
  const rehearsal = { interrupted: updated.assignments.filter(item => item.state === 'partially_accepted').length };
  if (demo) {
    const consentPath = '/me/assignments/' + demo.id + '/training-consent';
    await request('PUT', consentPath, token, { termsDigest: demo.termsDigest, grant: true });
    const exportPath = '/campaigns/' + campaignId + '/exports';
    const prepared = (await request('POST', exportPath, token, { purpose: 'training', assignmentIds: [demo.id] })).export;
    const exported = (await request('GET', exportPath + '/' + prepared.id, token)).export;
    const actions = exported.data.rows[0].actions.map(action => action.action);
    if (actions.join(',') !== 'continue,review,continue') throw Error('Unexpected native demonstration actions');
    if (JSON.stringify(exported).includes('Duplicate submission observed')) throw Error('Narrative leaked into training export');
    const contributor = await request('POST', '/auth/login', null, testUser);
    await request('DELETE', consentPath, contributor.token);
    const denied = await fetch(endpoint + exportPath + '/' + prepared.id, { headers: { Authorization: 'Bearer ' + token } });
    if (denied.status !== 403) throw Error('Withdrawn export remained accessible');
    rehearsal.approvedHumanActions = actions;
    rehearsal.existingExportDeniedAfterWithdrawal = true;
  }
  const evidence = { cells: updated.cells, acceptedTestUnits: updated.acceptedTestUnits,
    scope: 'AOSP emulator, synthetic identities, nontransferable test units',
    evidence: updated.assignments.map(assignment => assignment.attempt.evidence),
    rehearsal };
  await writeFile(resolve(directory, 'campaign-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
} else throw Error('Expected serve, seed or review');
