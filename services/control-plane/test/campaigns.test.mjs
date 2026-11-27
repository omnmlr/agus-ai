import assert from 'node:assert/strict';
import test from 'node:test';
import { apk, enroll, heartbeat, leaseProof, review, startTestPilot } from '../test-support/pilot-fixtures.mjs';

const answers = {
  sequence: ['continue', 'review', 'continue'], expectedCode: 'single_continue', actualCode: 'multiple_continue',
  evidenceNote: 'The fixture proceeds twice instead of once.', walletAnswer: 'finalized_effects',
};

async function setup(t, options) {
  const pilot = await startTestPilot(t, options);
  const developer = await pilot.register('buyer');
  const first = await pilot.register('reviewer-one');
  const second = await pilot.register('reviewer-two');
  const as = (person, method, path, body, status, key) =>
    pilot.request(method, path, { credential: person.token, body, status, key });
  const { project } = await as(developer, 'POST', '/projects', { name: 'Pilot' }, 201);
  const { build } = await as(developer, 'POST', '/builds', {
    name: 'Test-only release', projectId: project.id, packageName: review.packageName,
    sha256: review.sha256, apkBase64: apk.toString('base64'),
  }, 201);
  const human = { title: 'Reproduce duplicate action', instructions: 'Reproduce the action twice and report the difference.',
    kind: 'human_test', buildId: build.id, runtimeClass: 'phone_human', count: 2, testUnits: 5,
    trainingEligible: true };
  const draft = { projectId: project.id, title: 'Release assurance', objective: 'Find an onboarding defect',
    tasks: [human, { ...human, title: 'Launch on dedicated', kind: 'automated_test', runtimeClass: 'dedicated_runner',
      count: 1, testUnits: 0, trainingEligible: false }], deadlineAt: pilot.clock.now + 3_600_000, budgetTestUnits: 10 };
  const { campaign } = await as(developer, 'POST', '/campaigns', draft, 200, 'create-release');
  assert.equal((await as(developer, 'POST', '/campaigns', draft, 200, 'create-release')).campaign.id, campaign.id);
  await as(developer, 'POST', '/campaigns', { ...draft, title: 'Different intent' }, 409, 'create-release');
  const path = '/campaigns/' + campaign.id;
  await as(first, 'GET', path, undefined, 404);
  const edited = await as(developer, 'PATCH', path, { expectedRevision: 1, draft });
  assert.equal(edited.campaign.revision, 2);
  await as(developer, 'PATCH', path, { expectedRevision: 1, draft }, 409);
  await as(developer, 'POST', path + '/launch', { expectedRevision: 2 });
  await as(developer, 'PATCH', path, { expectedRevision: 2, draft }, 409);
  const { assignments: unqualified } = await as(first, 'GET', '/me/assignments');
  assert.equal(unqualified.length, 0);
  return { pilot, developer, first, second, as, path };
}

async function qualify(pilot, as, person) {
  const { exercise } = await as(person, 'GET', '/me/qualifications');
  const qualification = await as(person, 'POST', '/me/qualifications/' + exercise.version + '/submissions', answers);
  assert.deepEqual(qualification.skills, ['human_reproduction', 'wallet_fundamentals']);
  const runtime = await enroll(pilot, person, 'phone_human');
  await pilot.request('POST', '/runtime/installations/' + runtime.id + '/heartbeat',
    { credential: runtime.credential, body: heartbeat(runtime, 1) });
  return runtime;
}

async function executeHuman({ pilot, as, person, runtime, offer, accepted }) {
  const { lease } = await pilot.request('POST', '/runtime/installations/' + runtime.id + '/claim',
    { credential: runtime.credential, body: { assignmentId: offer.id } });
  const manifest = JSON.parse(Buffer.from(lease.manifest.payload, 'base64'));
  assert.deepEqual(manifest.actions, []);
  const body = { attemptId: accepted.attempt.id, expectedVersion: 0, steps: ['Tap Continue', 'Return to review', 'Tap Continue'],
    expected: 'One submission per session', actual: 'Two submissions were observed', result: 'failed', category: 'bug' };
  await as(person, 'POST', '/assignments/' + offer.id + '/submissions', body, 409);
  const prefix = '/runtime/leases/' + lease.id;
  await pilot.request('POST', prefix + '/report', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'report', { outcome: 'completed', observations: [] }) });
  await pilot.request('POST', prefix + '/cleanup', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: true, installRestricted: true }) });
  return { body, submitted: await as(person, 'POST', '/assignments/' + offer.id + '/submissions', body) };
}

test('campaign reservation, native human submission, revision, review and earnings are tenant-scoped and atomic', async t => {
  const { pilot, developer, first, second, as, path } = await setup(t);
  const one = await qualify(pilot, as, first);
  const two = await qualify(pilot, as, second);
  const { assignments: offers } = await as(first, 'GET', '/me/assignments');
  assert.equal(offers.length, 2);
  const [a, b] = offers;
  const route = '/me/assignments/' + a.id + '/accept';
  await as(first, 'POST', route, { termsDigest: a.termsDigest, installationId: two.id, consent: true }, 409);
  const results = await Promise.all([[first, one], [second, two]].map(([person, runtime]) =>
    pilot.request('POST', route, { credential: person.token,
      body: { termsDigest: a.termsDigest, installationId: runtime.id, consent: true }, status: [200, 404] })));
  const winnerIndex = results.findIndex(result => result.status === 200);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  const [winner, runtime, loser, loserRuntime] = winnerIndex === 0 ? [first, one, second, two] : [second, two, first, one];
  const { body } = await executeHuman({ pilot, as, person: winner, runtime, offer: a,
    accepted: results[winnerIndex].result.assignment });
  const reviewBody = { attemptId: body.attemptId, version: 1, decision: 'revise', reason: 'Add the review-screen transition' };
  await as(winner, 'POST', '/assignments/' + a.id + '/reviews', reviewBody, 404);
  await as(developer, 'POST', '/assignments/' + a.id + '/reviews', reviewBody);
  await as(winner, 'POST', '/assignments/' + a.id + '/submissions', { ...body, expectedVersion: 1 });
  const approval = { ...reviewBody, version: 2, decision: 'accept' };
  const approvals = await Promise.all([0, 1].map(() => pilot.request('POST', '/assignments/' + a.id + '/reviews',
    { credential: developer.token, body: approval, status: [200, 409] })));
  assert.equal(approvals.filter(result => result.status === 200).length, 1);
  assert.equal((await as(winner, 'GET', '/me/campaign-earnings')).earnings.testUnits, 5);
  const { assignment: accepted } = await as(loser, 'POST', '/me/assignments/' + b.id + '/accept',
    { termsDigest: b.termsDigest, installationId: loserRuntime.id, consent: true });
  const finished = await executeHuman({ pilot, as, person: loser, runtime: loserRuntime, offer: b, accepted });
  await as(developer, 'POST', '/assignments/' + b.id + '/reviews',
    { ...approval, attemptId: finished.body.attemptId, version: 1 });
  const { report } = await as(developer, 'GET', path + '/report');
  assert.deepEqual(report.cells.map(cell => [cell.planned, cell.accepted, cell.failed, cell.missing]), [[2, 2, 2, 0], [1, 0, 0, 1]]);
  assert.equal(report.acceptedTestUnits, 10);
  assert.equal(report.reservedTestUnits, 0);
  await as(first, 'GET', path + '/report', undefined, 404);
});

const databaseUrl = process.env.AGUS_TEST_PRODUCT_DATABASE_URL;
test('Postgres preserves campaign data and serializes competing claims across service restart', { skip: !databaseUrl }, async t => {
  const { pilot, developer, first, as, path } = await setup(t, { databaseUrl });
  const runtime = await qualify(pilot, as, first);
  const [offer] = (await as(first, 'GET', '/me/assignments')).assignments
    .filter(row => row.campaignId === path.split('/').at(-1));
  const { assignment } = await as(first, 'POST', '/me/assignments/' + offer.id + '/accept',
    { termsDigest: offer.termsDigest, installationId: runtime.id, consent: true });
  await pilot.restart();
  const claim = () => pilot.request('POST', '/runtime/installations/' + runtime.id + '/claim',
    { credential: runtime.credential, body: { assignmentId: offer.id }, status: [200, 409] });
  assert.deepEqual((await Promise.all([claim(), claim()])).map(value => value.status).sort(), [200, 409]);
  const { report } = await as(developer, 'GET', path + '/report');
  assert.equal(report.assignments.find(row => row.id === offer.id).attempt.id, assignment.attempt.id);
});

test('redacted export requires both purpose grants, rejects foreign access and invalidates withdrawn packages', async t => {
  const { pilot, developer, first, second, as, path } = await setup(t);
  const runtime = await qualify(pilot, as, first);
  const [offer] = (await as(first, 'GET', '/me/assignments')).assignments
    .filter(row => row.campaignId === path.split('/').at(-1));
  const { assignment } = await as(first, 'POST', '/me/assignments/' + offer.id + '/accept',
    { termsDigest: offer.termsDigest, installationId: runtime.id, consent: true });
  const executed = await executeHuman({ pilot, as, person: first, runtime, offer, accepted: assignment });
  await as(developer, 'POST', '/assignments/' + offer.id + '/reviews',
    { attemptId: executed.body.attemptId, version: 1, decision: 'accept', reason: 'Scoped proof' });
  const routes = path + '/exports';
  const body = { purpose: 'training', assignmentIds: [offer.id] };
  const agreement = '/me/assignments/' + offer.id + '/training-consent';
  await as(developer, 'POST', routes, body, 403);
  await as(second, 'PUT', agreement, { termsDigest: offer.termsDigest, grant: true }, 404);
  await as(developer, 'PUT', agreement, { termsDigest: offer.termsDigest, grant: true });
  await as(developer, 'POST', routes, body, 403);
  await as(first, 'PUT', agreement, { termsDigest: offer.termsDigest, grant: true });
  const { export: output } = await as(developer, 'POST', routes, body);
  await as(first, 'GET', routes + '/' + output.id, undefined, 404);
  const delivered = (await as(developer, 'GET', routes + '/' + output.id)).export;
  assert.equal(delivered.sha256, output.sha256);
  assert.equal(delivered.data.rows[0].result, 'failed');
  assert.doesNotMatch(JSON.stringify(delivered), /Tap Continue|Two submissions|@example|attemptId/);
  await as(first, 'DELETE', agreement);
  await as(developer, 'GET', routes + '/' + output.id, undefined, 403);
  await as(first, 'PUT', agreement, { termsDigest: offer.termsDigest, grant: true });
  await as(developer, 'GET', routes + '/' + output.id, undefined, 403);
  pilot.clock.now += 32 * 86_400_000;
  const renewed = await pilot.request('POST', '/auth/login',
    { body: { email: developer.user.email, password: 'disposable test only' } });
  const { report } = await as(renewed, 'GET', path + '/report');
  assert.equal(report.cells[0].failed, 1);
  assert.deepEqual(report.assignments[0].attempt.submissions, []);
  const stored = await pilot.store.transaction(state => state.assignments[offer.id].attempt.submissions[0]);
  assert.equal(stored.evidence, undefined);
  assert.deepEqual(stored.finding, { category: 'bug', result: 'failed' });
  await as(renewed, 'GET', '/assignments/' + offer.id + '/receipt', undefined, 404);
});
