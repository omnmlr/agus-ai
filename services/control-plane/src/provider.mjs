import { randomUUID } from 'node:crypto';
import {
  applyHeartbeats, authLease, authProvider, developerEmails, deviceEntries, emit,
  expireLeases, leaseReported, payoutWallet, publicRun, releaseDevice, releaseReservation, requestStop, safeObservation,
  timestamp, uuid, validPackage,
} from './domain.mjs';
import {
  array, decodeBase64, digest, equalSecret, hex256, object, publicKey, requireCondition,
  stableJson, string, token, validSignature,
} from './security.mjs';
import { validateManifest, verifyOutcome } from './verification.mjs';
import { claimAllowed, consumePairing, expireInvitations, expireMarketplace, recordMarketAcceptance } from './access.mjs';

const MiB = 1024 * 1024;

export async function enrollProvider({ store, config, credential, input }) {
  const legacy = equalSecret(credential, config.providerBootstrapToken);
  const displayName = string(input.displayName, 'provider display name', 100);
  const publicKeyPem = publicKey(input.publicKeyPem);
  const devices = deviceEntries(input.devices);
  const providerToken = token();
  const provider = {
    id: randomUUID(), displayName, publicKeyPem, tokenHash: digest(providerToken),
    allowedDeveloperEmails: developerEmails(input.allowedDeveloperEmails),
    payoutWallet: payoutWallet(input.payoutWallet), createdAt: config.now(),
  };
  return store.transaction((state) => {
    const ownerId = legacy ? null : consumePairing(state, credential, config.now());
    if (ownerId) {
      requireCondition(devices.length === 1, 'Pairing is scoped to one dedicated device');
      provider.ownerId = ownerId;
      provider.localDeviceId = devices[0].localId;
      provider.payoutWallet = null;
    }

    requireCondition(!Object.values(state.providers).some((entry) => entry.publicKeyPem === publicKeyPem && !entry.revokedAt),
      'Runner key is already enrolled', 'provider_exists', 409);
    state.providers[provider.id] = provider;
    applyHeartbeats(state, provider, devices, config.now());
    return { providerId: provider.id, token: providerToken };
  });
}

export async function heartbeat({ store, config, credential, input }) {
  return store.transaction((state) => {
    const provider = authProvider(state, credential);
    const entries = deviceEntries(input.devices);
    requireCondition(!provider.localDeviceId || entries.every(({ localId }) => localId === provider.localDeviceId),
      'Heartbeat is outside the paired device scope', 'forbidden', 403);
    const now = config.now();
    expireLeases(state, now);
    applyHeartbeats(state, provider, entries, now);
    return { ok: true };
  });
}

function approvedBuilds(value) {
  if (value === undefined) return null;
  return array(value, 'approvedBuilds', 50).map((entry) => {
    const build = object(entry, 'approved build');
    requireCondition(hex256(build.sha256) && validPackage(build.packageName)
      && (build.scenarios === undefined || (Array.isArray(build.scenarios) && build.scenarios.length <= 4
        && build.scenarios.every((value) => typeof value === 'string' && value.length <= 40))),
    'Invalid approved build');
    return build;
  });
}

export async function claim({ store, config, credential, input }) {
  const localId = string(input.deviceId, 'device id', 120);
  const whitelist = approvedBuilds(input.approvedBuilds);
  const now = config.now();
  return store.transaction((state) => {
    const provider = authProvider(state, credential);
    requireCondition(!provider.ownerId || whitelist?.length, 'Paired runner requires an explicit local APK allowlist');
    expireLeases(state, now);
    expireInvitations(state, now);
    expireMarketplace(state, now);
    const device = state.devices[localId] ?? state.devices[`${provider.id}:${localId}`];
    requireCondition(device?.providerId === provider.id,
      'Runner device not found', 'not_found', 404);
    const run = Object.values(state.runs).filter((entry) => {
      const build = state.builds[entry.buildId];
      return build && claimAllowed(state, entry, device, config, now)
        && (!whitelist || whitelist.some(({ sha256, packageName, scenarios }) => (
          sha256 === build.sha256 && packageName === build.packageName && (!scenarios || scenarios.includes(entry.scenario))
        )));
    }).sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
    if (!run) return { job: null };

    if (run.state === 'reserved') releaseReservation(state, run);
    if (run.allocation === 'marketplace' && !run.acceptedWork) recordMarketAcceptance(state, device, run, now, 'automatic');
    const build = state.builds[run.buildId];
    const leaseToken = token();
    const lease = {
      id: randomUUID(), runId: run.id, deviceId: device.id, providerId: provider.id,
      status: 'running', tokenHash: digest(leaseToken), challenge: token(),
      createdAt: now, expiresAt: now + (run.maximumDurationSeconds ?? config.leaseMs / 1000) * 1000,
    };
    state.leases[lease.id] = lease;
    device.activeLeaseId = lease.id;
    device.ready = false;
    run.deviceId = device.id;
    run.leaseId = lease.id;
    run.assignedProviderId = provider.id;
    run.assignedPayoutWallet = run.paymentTerms?.providerWallet ?? provider.payoutWallet;
    run.state = 'running';
    run.executionState = 'running';
    run.leaseState = 'running';
    run.startedAt = timestamp(now);
    emit(state, run, 'run.running', { deviceId: device.id, expiresAt: timestamp(lease.expiresAt) }, now);
    return {
      job: {
        runId: run.id, leaseId: lease.id, leaseToken, expiresAt: timestamp(lease.expiresAt),
        scenario: run.scenario, mode: run.mode, challenge: lease.challenge, expectedPackage: build.packageName,
        expectedTransaction: run.expectedTransaction,
        ...(run.evidence ? { evidence: run.evidence, consentVersion: run.consentVersion } : {}),
        build: {
          id: build.id, sha256: build.sha256, packageName: build.packageName,
          url: `/api/v1/provider/leases/${lease.id}/build`,
        },
      },
    };
  });
}

export function leaseData({ store, config, credential, leaseId, operation }) {
  return store.transaction((state) => {
    const lease = authLease(state, leaseId, credential);
    const now = config.now();
    expireLeases(state, now);
    return operation(state, lease, state.runs[lease.runId], now);
  });
}

export function leaseStatus(args) {
  return leaseData({
    ...args, operation: (state, lease) => ({ status: lease.status, expiresAt: timestamp(lease.expiresAt) }),
  });
}

export function buildForLease(args) {
  return leaseData({
    ...args, operation: (state, lease, run) => {
      requireCondition(lease.status === 'running', 'Lease does not permit downloads', 'lease_conflict', 409);
      return state.builds[run.buildId];
    },
  });
}

export function acknowledgeCleanup({ input, ...args }) {
  requireCondition(input.cleaned === true && (input.reason === undefined || input.reason === 'local_emergency'),
    'Confirmed runner cleanup is required');
  return leaseData({
    ...args, operation: (state, lease, run, now) => {
      if (input.reason === 'local_emergency' && lease.status === 'running') requestStop(state, run, 'runner_local', now);
      requireCondition(['stopping', 'cancelled', 'expired'].includes(lease.status),
        'Lease is not stopping or expired', 'lease_conflict', 409);
      if (!lease.cleanedAt) {
        lease.cleanedAt = now;
        releaseDevice(state, lease, now);
        if (run.stop) run.stop.acknowledgedAt = timestamp(now);
        if (lease.status === 'stopping') {
          lease.status = 'cancelled';
          run.state = 'cancelled';
          run.executionState = 'cancelled';
          run.leaseState = 'released';
          run.finishedAt = timestamp(now);
          emit(state, run, 'run.cancelled', { deviceId: lease.deviceId, acknowledged: true }, now);
        }
        emit(state, run, 'device.cleaned', { deviceId: lease.deviceId }, now);
      }
      return { ok: true };
    },
  });
}

function actionState(state, lease, run) {
  requireCondition(lease.status === 'running' && run.mode === 'agent',
    'Lease is not accepting agent actions', 'lease_conflict', 409);
  return state.actions[run.id] ?? [];
}

export function pendingActions(args) {
  return leaseData({
    ...args, operation: (state, lease, run) => ({
      actions: actionState(state, lease, run).filter(({ state }) => state === 'queued'),
    }),
  });
}

export function recordAction({ actionId, input, ...args }) {
  requireCondition(uuid(actionId) && ['completed', 'failed'].includes(input.outcome), 'Invalid agent action result');
  const observation = safeObservation(input.observation);
  return leaseData({
    ...args, operation: (state, lease, run, now) => {
      const action = actionState(state, lease, run).find(({ id }) => id === actionId);
      requireCondition(action, 'Agent action not found', 'not_found', 404);
      if (action.state === 'queued') {
        action.state = input.outcome;
        action.observation = observation;
        action.observedAt = timestamp(now);
        emit(state, run, 'action.observed', { actionId: action.id, type: action.type, outcome: action.state }, now);
      } else {
        requireCondition(action.state === input.outcome && stableJson(observation) === stableJson(action.observation),
          'Action already has a different observation', 'action_conflict', 409);
      }
      return { action };
    },
  });
}

function reportAttachments(input, report) {
  if (input.attachments === undefined) return [];
  const manifestHashes = new Set(report.evidence.map(({ sha256 }) => sha256));
  const seen = new Set();
  let total = 0;
  return array(input.attachments, 'report attachments', 10).map((entry) => {
    const { sha256, dataBase64 } = object(entry, 'report attachment');
    requireCondition(manifestHashes.has(sha256) && !seen.has(sha256), 'Attachment is not uniquely listed in the signed evidence');
    const bytes = decodeBase64(dataBase64, 'attachment bytes', MiB);
    total += bytes.length;
    requireCondition(digest(bytes) === sha256 && total <= 3 * MiB, 'Attachment digest or size does not match');
    seen.add(sha256);
    return { sha256, bytes };
  });
}

export async function submitReport({ store, config, credential, input }) {
  requireCondition(uuid(input.runId) && uuid(input.leaseId), 'Invalid report identifiers');
  const work = await store.transaction(async (state, addArtifact) => {
    const lease = authLease(state, input.leaseId, credential);
    const now = config.now();
    expireLeases(state, now);
    const run = state.runs[lease.runId];
    const provider = state.providers[lease.providerId];
    const build = state.builds[run.buildId];
    requireCondition(input.runId === run.id, 'Report does not match the lease', 'report_mismatch', 409);
    requireCondition(['running', 'verifying', 'completed'].includes(lease.status),
      'Lease no longer accepts evidence', 'lease_conflict', 409);
    const report = validateManifest(input.report, run, lease, build, now);
    if (run.evidence) {
      const consentKeys = { screenshot: 'screenshots', log: 'logs', trajectory: 'trajectory' };
      requireCondition(report.evidence.every((entry) => run.evidence[consentKeys[entry.kind]] === true),
        'Report contains evidence outside the workload consent', 'consent_required', 403);
    }
    requireCondition(validSignature(provider.publicKeyPem, report, input.signature),
      'Invalid report signature', 'invalid_signature', 400);
    const checksum = digest(stableJson(report));
    if (leaseReported(lease)) {
      requireCondition(run.receipt.manifestSha256 === checksum,
        'Lease already contains a different report', 'report_conflict', 409);
      return { complete: lease.status === 'completed', lease, run, actions: state.actions[run.id] ?? [] };
    }

    const attachments = reportAttachments(input, report);
    for (const attachment of attachments) {
      await addArtifact(`evidence:${run.id}:${attachment.sha256}`, attachment.bytes);
    }
    const available = new Set(attachments.map(({ sha256 }) => sha256));
    run.receipt = {
      id: randomUUID(), issuer: provider.id, publicKeyPem: provider.publicKeyPem, signature: input.signature,
      manifestSha256: checksum, manifest: report,
      evidence: report.evidence.map((evidence) => ({
        ...evidence, ...(available.has(evidence.sha256)
          ? { url: `/api/v1/runs/${run.id}/evidence/${evidence.sha256}` } : {}),
      })),
    };
    lease.status = 'verifying';
    run.state = 'verifying';
    run.executionState = 'verifying';
    run.leaseState = 'verifying';
    run.reportSeal = 'sealed';
    releaseDevice(state, lease, now, {
      quarantined: !report.checks.some(({ id, passed }) => id === 'cleanup' && passed),
    });
    emit(state, run, 'report.received', { receiptId: run.receipt.id }, now);
    return { complete: false, lease, run, actions: state.actions[run.id] ?? [] };
  });
  if (work.complete) return { run: publicRun(work.run) };
  return finalizeReport({ store, config, ...work });
}

export async function finalizeReport({ store, config, lease, run, actions }) {
  const verification = await verifyOutcome({
    run, report: run.receipt.manifest, lease, actions, config, fetchImpl: config.fetchImpl,
  });
  const next = await store.transaction((state) => {
    const current = state.runs[run.id];
    const currentLease = state.leases[lease.id];
    if ((currentLease.status !== 'verifying' && current.state !== 'unverified')
      || current.receipt?.id !== run.receipt.id) return current;
    if (verification.transaction.status === 'verified') {
      const used = Object.values(state.runs).some((entry) => (
        entry.id !== run.id && entry.verification?.transaction?.status === 'verified'
        && entry.verification.transaction.network === verification.transaction.network
        && entry.verification.transaction.signature === verification.transaction.signature
      ));
      if (used) {
        verification.transaction.status = 'signature_reused';
        verification.state = 'failed';
      }
    }
    currentLease.status = 'completed';
    current.state = verification.state;
    current.executionState = 'completed';
    current.evaluationOutcome = verification.state;
    current.leaseState = 'released';
    current.finishedAt = run.receipt.manifest.finishedAt;
    current.verification = verification;
    emit(state, current, 'run.' + current.state, {
      receiptId: current.receipt.id, transactionStatus: verification.transaction.status,
    }, config.now());
    return current;
  });
  return { run: publicRun(next) };
}
