import assert from 'node:assert/strict';
import test from 'node:test';
import { apk, enroll, leaseProof, proof, review, safePolicy, startTestPilot } from '../test-support/pilot-fixtures.mjs';

test('30 fenced reservation/stop cycles reject old authority and require postcondition acknowledgement', async t => {
  const pilot = await startTestPilot(t);
  const developer = await pilot.register('auditor');
  const provider = await pilot.register('participant');
  const foreign = await pilot.register('foreign');
  const runtime = await enroll(pilot, provider);
  const as = (user, method, route, body, status) =>
    pilot.request(method, route, { credential: user.token, body, status });
  const { project } = await as(developer, 'POST', '/projects', { name: 'Stop acceptance' }, 201);
  const { build } = await as(developer, 'POST', '/builds', {
    name: 'Reviewed preview', projectId: project.id, packageName: review.packageName,
    sha256: review.sha256, apkBase64: apk.toString('base64'),
  }, 201);
  const task = { buildId: build.id, title: 'Stop and recover', count: 1, instructions: 'Check the authorized stop control.',
    runtimeClass: 'phone_cooperative', kind: 'automated_test', testUnits: 5, stopTestUnits: 2 };
  const runtimePath = '/runtime/installations/' + runtime.id;
  let sequence = 0;
  let priorGrant;
  for (let batch = 0; batch < 3; batch++) {
    const { campaign } = await as(developer, 'POST', '/campaigns', {
      projectId: project.id, title: 'Recovery cohort ' + batch, objective: 'Verify cleanup before reuse',
      deadlineAt: pilot.clock.now + 30 * 60_000, visibility: 'invited', contributorIds: [provider.user.id],
      budgetTestUnits: 50, tasks: Array.from({ length: 10 }, () => task),
    });
    await as(developer, 'POST', '/campaigns/' + campaign.id + '/launch', { expectedRevision: 1 });
    assert.equal((await as(foreign, 'GET', '/me/assignments')).assignments.length, 0);
    const offers = (await as(provider, 'GET', '/me/assignments')).assignments
      .filter(entry => entry.campaignId === campaign.id && entry.state === 'open');
    assert.equal(offers.length, 10);
    for (const [index, offer] of offers.entries()) {
      // Each explicit owner window has a new ID, while its sequence stays installation-wide.
      await pilot.request('POST', runtimePath + '/heartbeat', { credential: runtime.credential,
        body: proof(runtime.keys.privateKey, { v: 1, kind: 'heartbeat', installationId: runtime.id,
          sequence: ++sequence, windowId: 'audit-window-' + sequence, windowSeconds: 180, policy: safePolicy }) });
      const accept = { installationId: runtime.id, termsDigest: offer.termsDigest, consent: true };
      if (priorGrant) {
        await pilot.request('GET', '/runtime/leases/' + priorGrant.id + '/build', { credential: priorGrant.credential, status: 409 });
      }
      const { assignment } = await as(provider, 'POST', '/me/assignments/' + offer.id + '/accept', accept);
      const { lease } = await pilot.request('POST', runtimePath + '/claim', {
        credential: runtime.credential, body: { assignmentId: offer.id },
      });
      if (priorGrant) {
        const wrong = leaseProof(runtime, priorGrant, 'cleanup', { packageAbsent: true, installRestricted: true });
        await pilot.request('POST', '/runtime/leases/' + lease.id + '/cleanup',
          { credential: lease.credential, body: wrong, status: 403 });
      }
      const leasePath = '/runtime/leases/' + lease.id;
      if (index % 2 === 0) {
        if (index % 4 === 0) {
          const stop = leaseProof(runtime, lease, 'owner_stop', {});
          if (priorGrant) {
            await pilot.request('POST', leasePath + '/stop', { credential: lease.credential,
              body: leaseProof(runtime, priorGrant, 'owner_stop', {}), status: 403 });
          }
          await pilot.request('POST', leasePath + '/stop', { credential: runtime.credential, body: stop, status: 401 });
          const stopped = await pilot.request('POST', leasePath + '/stop', { credential: lease.credential, body: stop });
          assert.equal(stopped.lease.stop.reason, 'owner_stop');
          assert.deepEqual(await pilot.request('POST', leasePath + '/stop', { credential: lease.credential, body: stop }), stopped);
        } else await as(provider, 'POST', '/me/assignments/' + offer.id + '/stop', {});
      } else pilot.clock.now = lease.expiresAt;
      await pilot.request('GET', leasePath + '/build', { credential: lease.credential, status: 409 });
      await pilot.request('POST', leasePath + '/cleanup', { credential: lease.credential,
        body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: false, installRestricted: true }), status: 409 });
      const { installations } = await as(provider, 'GET', '/me/runtime-installations');
      assert.equal(installations[0].readiness, 'quarantined');
      await pilot.request('POST', leasePath + '/cleanup', { credential: lease.credential,
        body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: true, installRestricted: true }) });
      const reviewPath = '/assignments/' + offer.id + '/reviews';
      const partial = { decision: 'partial', version: 0, attemptId: assignment.attempt.id, reason: 'Verified cleanup and interruption' };
      await as(developer, 'POST', reviewPath, partial);
      await as(developer, 'POST', reviewPath, partial, 409);
      priorGrant = lease;
    }
    await as(developer, 'POST', '/campaigns/' + campaign.id + '/complete', { expectedRevision: 1 });
  }
  assert.equal((await as(provider, 'GET', '/me/campaign-earnings')).earnings.testUnits, 60);
});

test('preview flag refuses production and nonloopback configuration, and rejects deep JSON', async t => {
  const { pilotConfig } = await import('../src/pilot-policy.mjs');
  assert.throws(() => pilotConfig({ AGUS_PRODUCT_PILOT: '1', NODE_ENV: 'production' }), /local non-production/);
  assert.throws(() => pilotConfig({ AGUS_PRODUCT_PILOT: '1', HOST: '0.0.0.0' }), /local non-production/);
  const pilot = await startTestPilot(t);
  const person = await pilot.register('scope');
  let depth = {};
  for (let i = 0; i < 30; i++) depth = { value: depth };
  const result = await pilot.request('POST', '/campaigns',
    { credential: person.token, key: 'depth', body: depth, status: 400 });
  assert.equal(result.error.code, 'invalid_request');
});

test('pilot qualification appeal cannot self-approve or grant the wallet skill', async t => {
  const pilot = await startTestPilot(t);
  const candidate = await pilot.register('candidate');
  const reviewer = await pilot.register('reviewer');
  const outsider = await pilot.register('outsider');
  // Store-free role wiring is fixed at startup in deployed local previews.
  pilot.config.pilot.reviewerIds.add(reviewer.user.id);
  pilot.config.pilot.reviewerIds.add(candidate.user.id);
  const result = await pilot.request('POST', '/me/qualifications/duplicate-onboarding-v1/submissions',
    { credential: candidate.token, body: {
      sequence: ['continue'], expectedCode: 'single_continue', actualCode: 'single_continue',
      walletAnswer: 'finalized_effects', evidenceNote: 'The reproduction steps need to be reviewed.',
    } });
  assert.equal(result.current.status, 'remediation');
  await pilot.request('POST', '/me/qualifications/' + result.current.id + '/appeal',
    { credential: candidate.token, body: { reason: 'Please examine the reviewed exercise variant.' } });
  await pilot.request('GET', '/qualification-appeals', { credential: outsider.token, status: 404 });
  const path = '/qualification-appeals/' + result.current.id + '/review';
  const body = { decision: 'accept_reproduction', decisionReason: 'Human reviewer accepted the known bug order.' };
  await pilot.request('POST', path, { credential: candidate.token, body, status: 404 });
  await pilot.request('POST', path, { credential: reviewer.token, body });
  const current = await pilot.request('GET', '/me/qualifications', { credential: candidate.token });
  assert.deepEqual(current.skills, ['human_reproduction']);
});
