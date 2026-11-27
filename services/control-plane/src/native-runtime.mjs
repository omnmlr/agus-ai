import { randomUUID } from 'node:crypto';
import { digest, hex256, requireCondition, stableJson, string, token } from './security.mjs';
import {
  conflict, exact, fixtureComponent, integer, manifestEnvelope, missing, nativeClasses, own,
  p256PublicKey, qualifyingPolicy, sdkVersion, verifyNativeProof, workProfilePolicy,
} from './pilot-policy.mjs';

const minute = 60_000;
const authorityMs = 45_000;
const qualificationMs = 7 * 24 * 60 * minute;

export function startNativeEnrollment(state, user, input, now) {
  exact(input, ['runtimeClass', 'appVersion', 'policyVersion'], 'enrollment');
  requireCondition(nativeClasses.includes(input.runtimeClass) && input.policyVersion === workProfilePolicy,
    'Unsupported runtime or work-profile policy');
  const pending = Object.values(state.runtimeEnrollments);
  for (const entry of pending) {
    if (entry.expiresAt <= now || entry.ownerId === user.id) delete state.runtimeEnrollments[entry.id];
  }
  conflict(Object.values(state.runtimes).filter(entry => entry.ownerId === user.id && !entry.revokedAt).length < 8,
    'Revoke an old installation before adding another');
  const id = randomUUID();
  const binding = {
    v: 1, kind: 'enrollment', id, challenge: token(), runtimeClass: input.runtimeClass,
    appVersion: string(input.appVersion, 'appVersion', 32), policyVersion: workProfilePolicy,
  };
  state.runtimeEnrollments[id] = { id, ownerId: user.id, binding, expiresAt: now + 5 * minute };
  return { enrollment: { id, binding, expiresAt: state.runtimeEnrollments[id].expiresAt } };
}

export function completeNativeEnrollment(state, user, id, input, now) {
  exact(input, ['publicKey', 'proof'], 'enrollment proof');
  const enrollment = own(state.runtimeEnrollments, id);
  missing(enrollment?.ownerId === user.id, 'Enrollment');
  conflict(enrollment.expiresAt > now, 'Enrollment challenge expired', 'grant_expired');
  p256PublicKey(input.publicKey);
  const proof = verifyNativeProof(input.publicKey, input.proof);
  requireCondition(stableJson(proof.value) === stableJson(enrollment.binding), 'Wrong enrollment challenge', 'invalid_proof', 403);
  conflict(!Object.values(state.runtimes).some(entry => entry.publicKey === input.publicKey && !entry.revokedAt),
    'Key is already registered');
  const credential = token();
  const installation = {
    id, ownerId: user.id, runtimeClass: enrollment.binding.runtimeClass, appVersion: enrollment.binding.appVersion,
    policyVersion: workProfilePolicy, publicKey: input.publicKey,
    credentialHash: digest(credential), credentialExpiresAt: now + qualificationMs,
    createdAt: now, sequence: 0, fence: 0, readiness: 'pending', activeLeaseId: null, revokedAt: null,
  };
  state.runtimes[id] = installation;
  delete state.runtimeEnrollments[id];
  return { installation: publicInstallation(installation, now), credential };
}

export function publicInstallation(installation, now) {
  let readiness = installation.readiness;
  if (installation.revokedAt) readiness = 'revoked';
  else if (installation.activeLeaseId) readiness = 'quarantined';
  else if (readiness === 'ready' && (!(installation.lastSeenAt + authorityMs > now)
    || !(installation.windowExpiresAt > now) || installation.credentialExpiresAt <= now)) readiness = 'offline';
  return {
    id: installation.id, runtimeClass: installation.runtimeClass, policyVersion: installation.policyVersion,
    readiness, policy: installation.policy ?? null, lastSeenAt: installation.lastSeenAt ?? null,
    windowExpiresAt: installation.windowExpiresAt ?? null, activeLeaseId: installation.activeLeaseId,
    credentialExpiresAt: installation.credentialExpiresAt, provenance: 'installation_signed_preview_claim',
  };
}

export function authenticateRuntime(state, id, credential, now) {
  const installation = own(state.runtimes, id);
  requireCondition(installation && !installation.revokedAt && installation.credentialExpiresAt > now
    && credential && installation.credentialHash === digest(credential), 'Runtime credential is invalid', 'unauthorized', 401);
  return installation;
}

export function nativeHeartbeat(state, installation, proof, now) {
  const { value } = verifyNativeProof(installation.publicKey, proof);
  exact(value, ['v', 'kind', 'installationId', 'sequence', 'windowId', 'windowSeconds', 'policy'], 'runtime heartbeat');
  requireCondition(value.v === 1 && value.kind === 'heartbeat' && value.installationId === installation.id,
    'Heartbeat is bound to a different installation', 'invalid_proof', 403);
  conflict(integer(value.sequence, 1, Number.MAX_SAFE_INTEGER, 'heartbeat sequence') > installation.sequence,
    'Heartbeat sequence is stale', 'stale_sequence');
  const ready = qualifyingPolicy(value.policy);
  const seconds = integer(value.windowSeconds, 0, 900, 'authorization window');
  const windowId = string(value.windowId, 'authorization window ID', 80);
  installation.sequence = value.sequence;
  installation.lastSeenAt = now;
  installation.policy = value.policy;
  if (installation.windowId !== windowId) {
    // A signed, strictly sequenced local owner-window change retires the previous window.
    if (installation.activeLeaseId) stopNativeLease(state, installation.activeLeaseId, 'window_changed', now);
    installation.windowId = windowId;
    installation.windowExpiresAt = now + seconds * 1000;
  } else {
    installation.windowExpiresAt = Math.min(installation.windowExpiresAt, now + seconds * 1000);
  }
  installation.readiness = ready && seconds > 0 ? 'ready' : 'unavailable';
  if ((!ready || seconds === 0) && installation.activeLeaseId) {
    stopNativeLease(state, installation.activeLeaseId, 'unsafe_environment', now);
  }
  return { installation: publicInstallation(installation, now) };
}

export function stopNativeLease(state, id, reason, now) {
  const lease = own(state.nativeLeases, id);
  if (lease && ['active', 'cleanup_pending'].includes(lease.state)) {
    lease.state = 'stopping';
    lease.stop = { reason, requestedAt: now };
  }
}

export function revokeNativeInstallation(state, user, id, now) {
  const installation = own(state.runtimes, id);
  missing(installation?.ownerId === user.id, 'Installation');
  installation.revokedAt ??= now;
  if (installation.activeLeaseId) stopNativeLease(state, installation.activeLeaseId, 'owner_revoked', now);
  return { installation: publicInstallation(installation, now) };
}

export function issueNativeLease(state, installation, assignment, task, build, pilot, now) {
  const review = pilot.reviewedBuilds.get(build.sha256);
  conflict(review?.packageName === build.packageName, 'Build lacks an operator-reviewed digest and signer', 'build_not_reviewed');
  conflict(publicInstallation(installation, now).readiness === 'ready' &&
    assignment.state === 'reserved' && assignment.installationId === installation.id &&
    assignment.attempt.contributorId === installation.ownerId && assignment.reservationExpiresAt > now,
  'Assignment or installation is unavailable', 'assignment_unavailable');
  const id = randomUUID();
  const fence = ++installation.fence;
  const deadline = Math.min(now + task.maximumDurationSeconds * 1000, installation.windowExpiresAt,
    installation.credentialExpiresAt, assignment.deadlineAt);
  conflict(deadline > now, 'Foreground authorization has expired', 'grant_expired');
  const credential = token();
  const manifest = {
    v: 1, type: 'agus.native.workload', audience: installation.id, assignmentId: assignment.id,
    installationKeySha256: digest(Buffer.from(installation.publicKey, 'base64')),
    attemptId: assignment.attempt.id, leaseId: id, fence, runtimeClass: installation.runtimeClass,
    campaignRevision: assignment.campaignRevision, actionContract: sdkVersion,
    taskKind: task.kind ?? 'automated_test',
    build: { id: build.id, ...review, component: review.packageName + fixtureComponent },
    actions: installation.runtimeClass === 'phone_cooperative' ? task.actions : [],
    observationSchema: 'fixture-result-v1', policyVersion: workProfilePolicy,
    issuedAt: now, deadline, ttlMs: authorityMs, challenge: token(),
    termsDigest: assignment.termsDigest, evidence: 'structured_only',
  };
  const envelope = manifestEnvelope(pilot, manifest);
  const lease = {
    id, fence, assignmentId: assignment.id, attemptId: assignment.attempt.id, installationId: installation.id,
    buildId: build.id, challenge: manifest.challenge, manifestDigest: envelope.sha256, manifest: envelope,
    allowedActions: manifest.actions, observeHuman: manifest.taskKind === 'human_demonstration',
    deadline, windowId: installation.windowId,
    credentialHash: digest(credential), state: 'active', expiresAt: Math.min(now + authorityMs, deadline),
    issuedAt: now, report: null, cleanup: null,
  };
  state.nativeLeases[id] = lease;
  installation.activeLeaseId = id;
  assignment.attempt.leaseId = id;
  assignment.state = 'active';
  return { lease: { id, credential, expiresAt: lease.expiresAt, serverNow: now, manifest: envelope } };
}

export function authenticateNativeLease(state, id, credential, now) {
  const lease = own(state.nativeLeases, id);
  requireCondition(lease && credential && lease.credentialHash === digest(credential) &&
    lease.deadline + 7 * 24 * 60 * minute > now,
  'Lease credential is invalid', 'unauthorized', 401);
  expireNativeLease(state, lease, now);
  return lease;
}

export function expireNativeLease(state, lease, now) {
  if (lease.state === 'active' && lease.expiresAt <= now) {
    stopNativeLease(state, lease.id, 'authority_expired', now);
  }
}

export function renewNativeLease(state, lease, now) {
  const installation = state.runtimes[lease.installationId];
  const assignment = state.assignments[lease.assignmentId];
  if (lease.state === 'active') {
    if (installation.revokedAt || installation.readiness !== 'ready' || installation.windowId !== lease.windowId
      || assignment.state !== 'active' || installation.lastSeenAt + authorityMs <= now ||
      installation.windowExpiresAt <= now || installation.credentialExpiresAt <= now) {
      stopNativeLease(state, lease.id, 'authorization_lost', now);
    } else {
      lease.expiresAt = Math.min(lease.deadline, now + authorityMs, installation.lastSeenAt + authorityMs,
        installation.windowExpiresAt, installation.credentialExpiresAt);
    }
  }
  return {
    lease: { state: lease.state, expiresAt: lease.expiresAt, serverNow: now, stop: lease.stop ?? null,
      cleanup: lease.cleanup ? 'confirmed' : lease.state === 'active' ? 'not_due' : 'pending' },
  };
}

function checkLeaseProof(state, lease, proof, kind, fields) {
  const installation = state.runtimes[lease.installationId];
  const result = verifyNativeProof(installation.publicKey, proof);
  const { value } = result;
  exact(value, ['v', 'kind', 'installationId', 'leaseId', 'challenge', 'fence', 'manifestSha256', ...fields], kind);
  requireCondition(value.v === 1 && value.kind === kind && value.installationId === installation.id
    && value.leaseId === lease.id && value.challenge === lease.challenge && value.fence === lease.fence
    && value.manifestSha256 === lease.manifestDigest, 'Proof does not bind current lease', 'invalid_proof', 403);
  return { ...result, installation };
}

export function receiveNativeStop(state, lease, input, now) {
  checkLeaseProof(state, lease, input, 'owner_stop', []);
  if (lease.state === 'active') stopNativeLease(state, lease.id, 'owner_stop', now);
  return renewNativeLease(state, lease, now);
}

export function receiveNativeReport(state, lease, input, now) {
  const { value, sha256 } = checkLeaseProof(state, lease, input, 'report', ['outcome', 'observations']);
  if (lease.report) {
    conflict(lease.report.sha256 === sha256, 'A different report already exists');
    return { report: lease.report };
  }
  conflict(lease.state === 'active', 'Lease has no report authority', 'grant_expired');
  requireCondition(['completed', 'failed'].includes(value.outcome), 'Unknown runtime outcome');
  const maximum = lease.observeHuman ? 20 : lease.allowedActions.length;
  requireCondition(Array.isArray(value.observations) && value.observations.length <= maximum,
    'Observations exceed the reviewed action budget');
  let previousOffset = 0;
  for (const [index, observation] of value.observations.entries()) {
    exact(observation, lease.observeHuman ? ['action', 'result', 'offsetMs'] : ['action', 'result'], 'observation');
    if (lease.observeHuman) {
      integer(observation.offsetMs, previousOffset, lease.deadline - lease.issuedAt, 'observation time');
      previousOffset = observation.offsetMs;
      requireCondition((observation.action === 'continue' && observation.result === 'advanced')
        || (observation.action === 'review' && observation.result === 'ready'), 'Human step is out of scope');
    } else {
      requireCondition(observation.action === lease.allowedActions[index] &&
        ['advanced', 'blocked', 'ready'].includes(observation.result), 'Observation is out of scope');
    }
  }
  const assignment = state.assignments[lease.assignmentId];
  conflict(assignment.state === 'active' && assignment.attempt.id === lease.attemptId, 'Attempt is no longer current');
  const evaluation = lease.allowedActions.length === 0 ? 'unverified'
    : value.outcome === 'completed' && value.observations.length === lease.allowedActions.length
      && value.observations.every(({ action, result }) => result === (action === 'advance' ? 'advanced' : 'ready'))
      ? 'passed' : 'failed';
  lease.report = { sha256, receivedAt: now, proof: input, outcome: value.outcome, observations: value.observations,
    evaluation, provenance: 'installation_signed_preview_claim' };
  lease.state = 'cleanup_pending';
  assignment.state = 'cleanup_pending';
  return { report: lease.report };
}

export function receiveNativeCleanup(state, lease, input, now) {
  const { value, sha256, installation } = checkLeaseProof(state, lease, input, 'cleanup', ['packageAbsent', 'installRestricted']);
  if (lease.cleanup) {
    conflict(lease.cleanup.sha256 === sha256, 'A different cleanup acknowledgement already exists');
    return { cleanup: lease.cleanup };
  }
  requireCondition(value.packageAbsent === true && value.installRestricted === true,
    'Cleanup is unconfirmed. Installation remains unavailable.', 'cleanup_unconfirmed', 409);
  const assignment = state.assignments[lease.assignmentId];
  conflict(assignment.attempt.id === lease.attemptId && installation.activeLeaseId === lease.id, 'Cleanup is stale');
  lease.cleanup = { sha256, confirmedAt: now, proof: input, provenance: 'installation_signed_preview_claim' };
  lease.state = 'released';
  installation.activeLeaseId = null;
  installation.readiness = 'pending';
  if (['active', 'cleanup_pending', 'stopping'].includes(assignment.state)) {
    assignment.state = lease.report && !lease.stop ? 'awaiting_submission' : 'interrupted';
  }
  return { cleanup: lease.cleanup };
}

export function nativeBuildForLease(state, lease) {
  conflict(lease.state === 'active', 'Artifact grant expired', 'grant_expired');
  const build = own(state.builds, lease.buildId);
  missing(build && hex256(build.sha256), 'Build');
  return build;
}
