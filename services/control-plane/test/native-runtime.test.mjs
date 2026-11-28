import assert from 'node:assert/strict';
import { verify } from 'node:crypto';
import test from 'node:test';
import { apk, enroll, heartbeat, leaseProof, review, safePolicy, startTestPilot } from '../test-support/pilot-fixtures.mjs';
import { pilotConfig, reviewedWorkload } from '../src/pilot-policy.mjs';

test('native pilot defaults off, runtime credentials are purpose-bound and enrollment is single-use', async t => {
  const disabled = await startTestPilot(t, { env: { AGUS_PRODUCT_PILOT: '0' } });
  await disabled.request('GET', '/me/runtime-installations', { status: 503 });
  const pilot = await startTestPilot(t);
  const person = await pilot.register('person');
  const stranger = await pilot.register('stranger');
  const runtime = await enroll(pilot, person);
  await pilot.request('POST', runtime.path, { credential: person.token, body: runtime.body, status: 404 });
  await pilot.request('GET', '/auth/me', { credential: runtime.credential, status: 401 });
  const path = '/runtime/installations/' + runtime.id + '/heartbeat';
  await pilot.request('POST', path, { credential: person.token, body: heartbeat(runtime, 1), status: 401 });
  const first = await pilot.request('POST', path, { credential: runtime.credential, body: heartbeat(runtime, 1) });
  assert.equal(first.installation.readiness, 'ready');
  assert.equal(Object.hasOwn(first.installation, 'credentialHash'), false);
  await pilot.request('POST', path, { credential: runtime.credential, body: heartbeat(runtime, 1), status: 409 });
  assert.equal((await pilot.request('GET', '/me/runtime-installations',
    { credential: stranger.token })).installations.length, 0);
  await pilot.request('DELETE', '/me/runtime-installations/' + runtime.id, { credential: stranger.token, status: 404 });
  const unsafe = await pilot.request('POST', path, { credential: runtime.credential,
    body: heartbeat(runtime, 2, { ...safePolicy, thermalStatus: 4 }) });
  assert.equal(unsafe.installation.readiness, 'unavailable');
});

test('private preview restricts publishers, accounts and existing runtime credentials', async t => {
  const pilot = await startTestPilot(t);
  const member = await pilot.register('member');
  const developmentRuntime = await enroll(pilot, member);
  const env = {
    NODE_ENV: 'production', AGUS_DATABASE_URL: 'postgresql://preview.invalid/agus_ai',
    AGUS_PUBLIC_ORIGIN: 'https://agusai.grindcity.app',
    AGUS_PRODUCT_PILOT: 'private-preview', AGUS_PILOT_MEMBER_IDS: member.user.id,
    AGUS_NATIVE_MANIFEST_PKCS8: pilot.manifestKeys.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
  assert.throws(() => pilotConfig({ ...env, AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([review]) }));
  pilot.config.pilot = pilotConfig({ ...env, AGUS_NATIVE_REVIEWED_BUILDS: JSON.stringify([{ ...review, publisherId: member.user.id }]) });
  assert.ok(reviewedWorkload(pilot.config.pilot, review, member.user.id));
  // The preview is live when this public account registers, but registration grants no runtime authority.
  const outsider = await pilot.register('outsider');
  assert.ok(outsider.token);
  assert.equal(reviewedWorkload(pilot.config.pilot, review, outsider.user.id), null);
  const denied = await pilot.request('GET', '/me/runtime-installations', { credential: outsider.token, status: 403 });
  assert.equal(denied.error.code, 'pilot_access_required');
  const route = runtime => '/runtime/installations/' + runtime.id + '/heartbeat';
  await pilot.request('POST', route(developmentRuntime), {
    credential: developmentRuntime.credential, body: heartbeat(developmentRuntime, 1), status: 404,
  });
  const hostedRuntime = await enroll(pilot, member);
  await pilot.request('POST', route(hostedRuntime), { credential: hostedRuntime.credential, body: heartbeat(hostedRuntime, 1) });
  pilot.config.pilot.memberIds.delete(member.user.id);
  await pilot.request('POST', route(hostedRuntime), { credential: hostedRuntime.credential, body: heartbeat(hostedRuntime, 2), status: 404 });
});

test('lease signs reviewed scope, fences tampering and expiry, and quarantines until signed cleanup', async t => {
  const pilot = await startTestPilot(t);
  const person = await pilot.register('provider');
  const runtime = await enroll(pilot, person);
  const other = await enroll(pilot, person);
  await pilot.request('POST', '/runtime/installations/' + runtime.id + '/heartbeat',
    { credential: runtime.credential, body: heartbeat(runtime, 1) });
  // Seed the assignment reservation for this transport test. Campaign reservations are tested through HTTP separately.
  await pilot.store.transaction(async (state, addArtifact) => {
    await addArtifact('fixture', apk);
    state.builds.fixture = { id: 'fixture', artifactId: 'fixture', ...review };
    state.campaigns.campaign = { state: 'active', revisions: [{ tasks: [{ buildId: 'fixture', maximumDurationSeconds: 120,
      actions: ['describe', 'advance'] }] }] };
    state.assignments.assignment = { id: 'assignment', campaignId: 'campaign', taskIndex: 0,
      campaignRevision: 1, termsDigest: 'b'.repeat(64), state: 'reserved', installationId: runtime.id,
      reservationExpiresAt: pilot.clock.now + 60_000, deadlineAt: pilot.clock.now + 180_000,
      attempt: { id: 'attempt', contributorId: person.user.id } };
  });
  const claim = '/runtime/installations/' + runtime.id + '/claim';
  const input = { credential: runtime.credential, body: { assignmentId: 'assignment' } };
  const { lease } = await pilot.request('POST', claim, input);
  const bytes = Buffer.from(lease.manifest.payload, 'base64');
  assert.equal(verify('sha256', bytes, pilot.manifestKeys.publicKey, Buffer.from(lease.manifest.signature, 'base64')), true);
  assert.equal(JSON.parse(bytes).build.signerSha256, review.signerSha256);
  await pilot.request('POST', claim, { ...input, status: 409 });
  const prefix = '/runtime/leases/' + lease.id;
  await pilot.request('GET', prefix + '/build', { credential: runtime.credential, status: 401 });
  assert.deepEqual(await pilot.request('GET', prefix + '/build', { credential: lease.credential }), apk);
  const report = { outcome: 'completed', observations: [{ action: 'describe', result: 'ready' },
    { action: 'advance', result: 'advanced' }] };
  await pilot.request('POST', prefix + '/report', { credential: lease.credential,
    body: leaseProof(other, lease, 'report', report), status: 403 });
  await pilot.request('POST', prefix + '/report', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'report', { ...report, observations: [{ action: 'shell', result: 'ready' }] }),
    status: 400 });
  pilot.clock.now = lease.expiresAt;
  await pilot.request('GET', prefix + '/build', { credential: lease.credential, status: 409 });
  const status = await pilot.request('GET', prefix, { credential: lease.credential });
  assert.equal(status.lease.stop.reason, 'authority_expired');
  await pilot.request('DELETE', '/me/runtime-installations/' + runtime.id, { credential: person.token });
  await pilot.request('POST', prefix + '/cleanup', { credential: lease.credential,
    body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: false, installRestricted: true }), status: 409 });
  const cleanup = { credential: lease.credential,
    body: leaseProof(runtime, lease, 'cleanup', { packageAbsent: true, installRestricted: true }) };
  assert.deepEqual(await pilot.request('POST', prefix + '/cleanup', cleanup),
    await pilot.request('POST', prefix + '/cleanup', cleanup));
  assert.equal(await pilot.store.transaction(state => state.assignments.assignment.state), 'interrupted');
});
