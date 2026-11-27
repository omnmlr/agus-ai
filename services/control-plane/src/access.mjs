import { randomUUID } from 'node:crypto';
import {
  createRun, durationLimit, emit, evidenceConsent, getOwned, marketplaceEligible, notice,
  ownedDevice, publicRun, requestStop, statusDevice, terminal, timestamp, uuid, validPackage,
  walletNetworkMatches,
} from './domain.mjs';
import { digest, hex256, object, requireCondition, stableJson, string, token } from './security.mjs';
import { MODES, SCENARIOS, expectedTransaction } from './verification.mjs';

const pairingDurationMs = 15 * 60_000;
const invitationDurationMs = 24 * 60 * 60_000;
const reservationDurationMs = 120_000;
const marketplaceDurationMs = 24 * 60 * 60_000;
const pendingStates = ['pending', 'reviewed'];
const unpaidPayout = Object.freeze({ kind: 'unpaid', amountAtoms: '0', asset: null, cluster: null, decimals: null });

export function startPairing(state, user, now) {
  for (const [hash, pairing] of Object.entries(state.pairings)) {
    if (pairing.ownerId === user.id && !pairing.usedAt || pairing.expiresAt <= now) delete state.pairings[hash];
  }
  const code = token();
  const expiresAt = now + pairingDurationMs;
  state.pairings[digest(code)] = { ownerId: user.id, expiresAt, usedAt: null };
  return { pairing: { code, expiresAt: timestamp(expiresAt) } };
}

export function consumePairing(state, credential, now) {
  const pairing = state.pairings[digest(credential)];
  requireCondition(credential && pairing && !pairing.usedAt && pairing.expiresAt > now,
    'Provider pairing credential is invalid or expired', 'unauthorized', 401);
  const user = state.users[pairing.ownerId];
  requireCondition(user, 'Provider pairing owner is invalid', 'unauthorized', 401);
  pairing.usedAt = now;
  user.providerEnabled = true;
  return user.id;
}

export function getOwnedDevice(state, user, id, { active = false } = {}) {
  const device = id && state.devices[id];
  requireCondition(device?.ownerId === user.id, 'Device not found', 'not_found', 404);
  if (active) requireCondition(!device.revokedAt, 'Device enrollment was revoked', 'device_revoked', 409);
  return device;
}

function validateSchedule(raw) {
  if (raw === null) return null;
  const { timeZone, windows } = object(raw, 'schedule');
  string(timeZone, 'schedule time zone', 80);
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(0);
  } catch {
    requireCondition(false, 'Schedule requires a valid IANA time zone');
  }
  requireCondition(Array.isArray(windows) && windows.length <= 14, 'Invalid availability schedule');
  const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return {
    timeZone,
    windows: windows.map((window) => {
      const { days, start, end } = object(window, 'availability window');
      requireCondition(Array.isArray(days) && days.length > 0 && days.length <= 7
        && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        && new Set(days).size === days.length && validTime(start) && validTime(end) && start !== end,
      'Invalid availability window');
      return { days, start, end };
    }),
  };
}

export function updateDevice(state, device, input, now) {
  if (input.label !== undefined) {
    const label = string(input.label, 'device label', 80).trim();
    requireCondition(label, 'Device label is required');
    device.labelOverride = label;
    device.label = label;
  }
  if (input.publicListing !== undefined) {
    requireCondition(typeof input.publicListing === 'boolean', 'Invalid public listing preference');
    device.publicListing = input.publicListing;
    if (!device.publicListing) cancelMarketplaceReservation(state, device, now);
  }
  if (input.autoMatch !== undefined) {
    requireCondition(typeof input.autoMatch === 'boolean', 'Invalid auto-match preference');
    device.autoMatch = input.autoMatch;
  }
  if (input.schedule !== undefined) device.schedule = validateSchedule(input.schedule);
  if (input.constraints !== undefined) {
    const constraints = object(input.constraints, 'device constraints');
    for (const key of Object.keys(constraints)) {
      requireCondition(['chargingRequired', 'wifiRequired'].includes(key) && typeof constraints[key] === 'boolean',
        'Invalid device constraint');
    }
    device.constraints = { ...device.constraints, ...constraints };
  }
}

function cancelMarketplaceReservation(state, device, now) {
  const run = state.runs[device.reservedRunId];
  if (run?.allocation === 'marketplace' && run.state === 'reserved') requestStop(state, run, 'provider', now);
}

export function revokeDevice(state, device, now) {
  if (device.revokedAt) return;
  device.revokedAt = now;
  device.publicListing = false;
  device.autoMatch = false;
  device.online = false;
  device.ready = false;
  if (state.providers[device.providerId]?.ownerId) state.providers[device.providerId].revokedAt = now;
  for (const invitation of Object.values(state.invitations)) {
    if (invitation.deviceId === device.id && [...pendingStates, 'accepted'].includes(invitation.state)) {
      revokeInvitation(state, invitation, now);
    }
  }
  for (const run of Object.values(state.runs)) {
    if (run.deviceId === device.id && !terminal(run.state) && !run.receipt) requestStop(state, run, 'provider', now);
  }
}

export function deviceDiagnostics(device, config, now) {
  const value = ownedDevice(device, now, config.heartbeatMs);
  return {
    checkedAt: timestamp(now), source: 'control_plane_and_last_runner_heartbeat',
    checks: [
      { id: 'runner-heartbeat', passed: value.connectivity === 'online', lastSeenAt: value.lastSeenAt },
      { id: 'device-ready', passed: value.readiness === 'ready' },
      { id: 'capability-profile', passed: Boolean(device.profile.measuredAt && device.profile.androidVersion), measuredAt: device.profile.measuredAt ?? null },
      { id: 'marketplace-eligible', passed: value.marketplaceEligible },
    ],
  };
}

function userSummary(state, id) {
  const user = state.users[id];
  return { id, email: user.email, ...(user.displayName ? { displayName: user.displayName } : {}) };
}

export function invitationView(state, invitation, viewer) {
  const {
    tokenHash, creatorId, recipientId, providerId, developerId, projectId, buildId, ...value
  } = invitation;
  return {
    ...value, requester: userSummary(state, creatorId), recipient: userSummary(state, recipientId),
    viewerRole: viewer.id === creatorId ? 'requester' : 'recipient',
  };
}

export function expireInvitations(state, now) {
  for (const invitation of Object.values(state.invitations)) {
    if (Date.parse(invitation.expiresAt) > now) continue;
    if (pendingStates.includes(invitation.state)) {
      invitation.state = 'expired';
      continue;
    }
    const run = state.runs[invitation.runId];
    if (invitation.state === 'accepted' && run?.state === 'queued') {
      invitation.state = 'expired';
      run.state = 'expired';
      run.executionState = 'expired';
      emit(state, run, 'run.expired', { reason: 'private_grant_expired' }, now);
    }
  }
}

export function newInvitation(state, user, input, config, now, opaque = token()) {
  requireCondition(['developer_request', 'provider_share'].includes(input.kind), 'Invalid invitation kind');
  requireCondition(SCENARIOS.includes(input.scenario) && MODES.includes(input.mode), 'Invalid workload definition');
  const deviceId = string(input.deviceId, 'device identifier', 120);
  const device = state.devices[deviceId];
  requireCondition(device?.ownerId && !device.revokedAt, 'Device not found', 'not_found', 404);
  requireCondition(device.scenarios.includes(input.scenario), 'Device does not support this scenario');
  const own = input.kind === 'provider_share';
  let recipientId;
  let developerId;
  let build;
  let projectId;
  let transfer;
  if (own) {
    getOwnedDevice(state, user, deviceId, { active: true });
    recipientId = input.targetUserId;
    requireCondition(uuid(recipientId) && state.users[recipientId] && recipientId !== user.id,
      'Target developer not found', 'not_found', 404);
    developerId = recipientId;
    requireCondition(validPackage(input.packageName) && hex256(input.buildSha256),
      'Provider share requires an exact approved build hash and package');
    transfer = expectedTransaction(input.expectedTransaction, input.scenario, config);
  } else {
    requireCondition(device.ownerId !== user.id, 'Request a device owned by the intended provider');
    recipientId = device.ownerId;
    developerId = user.id;
    const project = getOwned(state.projects, input.projectId, user, 'Project');
    build = getOwned(state.builds, input.buildId, user, 'Build');
    requireCondition(build.projectId === project.id && build.packageName, 'Invalid workload build');
    projectId = project.id;
    transfer = expectedTransaction(input.expectedTransaction, input.scenario, config);
  }
  const pending = Object.values(state.invitations).filter((value) => value.creatorId === user.id && pendingStates.includes(value.state));
  requireCondition(pending.length < 20, 'Invitation limit reached', 'rate_limited', 429);
  const invitation = {
    id: randomUUID(), tokenHash: digest(opaque), kind: input.kind, state: 'pending',
    creatorId: user.id, recipientId, developerId, providerId: device.providerId, deviceId: device.id,
    packageName: build?.packageName ?? input.packageName, buildSha256: build?.sha256 ?? input.buildSha256,
    buildId: build?.id ?? null, projectId: projectId ?? null, expectedTransaction: transfer ?? null,
    scenario: input.scenario, mode: input.mode,
    maximumDurationSeconds: durationLimit(input.maximumDurationSeconds, config),
    evidence: evidenceConsent(input.evidence), consentVersion: 'workload-v1',
    payout: 'unpaid', createdAt: timestamp(now), expiresAt: timestamp(now + invitationDurationMs),
  };
  state.invitations[invitation.id] = invitation;
  notice(state, recipientId, 'invitation.received', { invitationId: invitation.id }, now);
  return { invitation: invitationView(state, invitation, user), token: opaque };
}

function getInvitation(state, user, id, { recipient = false } = {}) {
  const invitation = state.invitations[id];
  requireCondition(invitation && (invitation.recipientId === user.id || (!recipient && invitation.creatorId === user.id)),
    'Invitation not found', 'not_found', 404);
  return invitation;
}

export function replayInvitation(state, user, id, credential) {
  const invitation = getInvitation(state, user, id);
  requireCondition(invitation.tokenHash === digest(credential), 'Invitation signature key changed', 'idempotency_conflict', 409);
  return { invitation: invitationView(state, invitation, user), token: credential };
}

export function listInvitations(state, user) {
  return Object.values(state.invitations)
    .filter(({ creatorId, recipientId }) => creatorId === user.id || recipientId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((invitation) => invitationView(state, invitation, user));
}

export function reviewInvitation(state, user, idOrToken, now, byToken = false) {
  let id = idOrToken;
  if (byToken) {
    const opaque = string(idOrToken, 'invitation token', 100);
    const hash = digest(opaque);
    id = Object.values(state.invitations).find((value) => value.tokenHash === hash)?.id;
  }
  const invitation = getInvitation(state, user, id, { recipient: true });
  if (invitation.state === 'pending') {
    invitation.state = 'reviewed';
    invitation.reviewedAt = timestamp(now);
  }
  requireCondition(invitation.state === 'reviewed', 'Invitation can no longer be reviewed',
    invitation.state === 'expired' ? 'invitation_expired' : 'invitation_conflict', 409);
  return { invitation: invitationView(state, invitation, user) };
}

export function acceptInvitation(state, user, id, input, config, now) {
  const invitation = getInvitation(state, user, id, { recipient: true });
  requireCondition(invitation.state === 'reviewed', 'Invitation must be reviewed and pending acceptance',
    invitation.state === 'expired' ? 'invitation_expired' : 'invitation_conflict', 409);
  const device = state.devices[invitation.deviceId];
  requireCondition(device?.providerId === invitation.providerId && !device.revokedAt,
    'Invitation device is unavailable', 'device_revoked', 409);
  const developer = state.users[invitation.developerId];
  const share = invitation.kind === 'provider_share';
  const buildId = share ? input.buildId : invitation.buildId;
  const projectId = share ? input.projectId : invitation.projectId;
  if (share && input.expectedTransaction !== undefined) {
    const submitted = expectedTransaction(input.expectedTransaction, invitation.scenario, config);
    requireCondition(stableJson(submitted) === stableJson(invitation.expectedTransaction),
      'Transaction scope differs from the reviewed workload', 'invitation_mismatch', 409);
  }
  const build = getOwned(state.builds, buildId, developer, 'Build');
  requireCondition(build.sha256 === invitation.buildSha256 && build.packageName === invitation.packageName,
    'Build does not match the reviewed workload', 'invitation_mismatch', 409);
  const run = createRun(state, developer, {
    projectId, buildId, deviceId: device.id, scenario: invitation.scenario, mode: invitation.mode,
    maximumDurationSeconds: invitation.maximumDurationSeconds,
    expectedTransaction: invitation.expectedTransaction ?? undefined,
    evidence: invitation.evidence,
  }, config, now, invitation);
  run.acceptedWork = { source: 'private', providerId: device.providerId, acceptedAt: timestamp(now), payout: unpaidPayout };
  invitation.state = 'accepted';
  invitation.acceptedAt = timestamp(now);
  invitation.runId = run.id;
  emit(state, run, 'work.accepted', { source: 'private' }, now);
  notice(state, invitation.creatorId, 'invitation.accepted', { invitationId: invitation.id, runId: run.id }, now);
  return { invitation: invitationView(state, invitation, user), run: publicRun(run) };
}

function revokeInvitation(state, invitation, now) {
  invitation.state = 'revoked';
  invitation.revokedAt = timestamp(now);
  const run = state.runs[invitation.runId];
  if (run && !terminal(run.state) && !run.receipt) requestStop(state, run, 'invitation_revocation', now);
  return run;
}

export function closeInvitation(state, user, id, operation, now) {
  const invitation = getInvitation(state, user, id, { recipient: operation === 'decline' });
  let run;
  if (operation === 'decline') {
    requireCondition(pendingStates.includes(invitation.state), 'Invitation can no longer be declined', 'invitation_conflict', 409);
    invitation.state = 'declined';
    invitation.declinedAt = timestamp(now);
  } else {
    requireCondition([...pendingStates, 'accepted', 'revoked'].includes(invitation.state),
      'Invitation can no longer be revoked', 'invitation_conflict', 409);
    run = revokeInvitation(state, invitation, now);
  }
  const otherId = user.id === invitation.creatorId ? invitation.recipientId : invitation.creatorId;
  notice(state, otherId, 'invitation.' + invitation.state, { invitationId: invitation.id, ...(run ? { runId: run.id } : {}) }, now);
  return { invitation: invitationView(state, invitation, user), ...(run ? { run: publicRun(run) } : {}) };
}

export function expireMarketplace(state, now) {
  for (const run of Object.values(state.runs)) {
    if (run.allocation === 'marketplace' && run.state === 'queued'
      && Date.parse(run.createdAt) + marketplaceDurationMs <= now) {
      run.state = 'expired';
      run.executionState = 'expired';
      emit(state, run, 'run.expired', { reason: 'marketplace_expired' }, now);
    }
  }
}

function matchingMarketJob(state, run, device, now) {
  return run.allocation === 'marketplace' && run.state === 'queued' && run.ownerId !== device.ownerId
    && (!run.deviceId || run.deviceId === device.id) && device.scenarios.includes(run.scenario) && walletNetworkMatches(device, run.expectedTransaction)
    && Date.parse(run.createdAt) + marketplaceDurationMs > now && state.builds[run.buildId]
    && (!run.paymentTerms || (run.paymentTerms.status === 'funded' && run.paymentTerms.providerId === device.providerId));
}

function payoutOffer(run) {
  const terms = run.paymentTerms;
  if (!terms) return unpaidPayout;
  const { asset, cluster, mint, decimals, amountAtoms } = terms.quote;
  return { kind: 'devnet', asset, cluster, mint, decimals, amountAtoms, destination: terms.providerWallet };
}

export function marketJobs(state, device, config, now) {
  if (!marketplaceEligible(device, now, config.heartbeatMs)) return [];
  return Object.values(state.runs).filter((run) => matchingMarketJob(state, run, device, now))
    .map((run) => {
      const build = state.builds[run.buildId];
      return {
        id: run.id, requester: userSummary(state, run.ownerId), packageName: build.packageName,
        buildSha256: build.sha256, maximumDurationSeconds: run.maximumDurationSeconds,
        scenario: run.scenario, mode: run.mode, evidence: run.evidence, quote: payoutOffer(run),
        requirements: { dedicatedAndroid: true, scenario: run.scenario }, availability: 'available',
        createdAt: run.createdAt, expiresAt: timestamp(Date.parse(run.createdAt) + marketplaceDurationMs),
      };
    });
}

export function reserveMarketJob(state, device, id, config, now) {
  const run = state.runs[id];
  requireCondition(run && matchingMarketJob(state, run, device, now), 'Job is unavailable', 'job_unavailable', 409);
  requireCondition(marketplaceEligible(device, now, config.heartbeatMs),
    'Device is not ready for marketplace work', 'device_unavailable', 409);
  run.deviceId = device.id;
  run.authorizedProviderId = device.providerId;
  run.state = 'reserved';
  run.executionState = 'reserved';
  run.leaseState = 'reserved';
  run.reservationExpiresAt = timestamp(now + reservationDurationMs);
  device.reservedRunId = run.id;
  recordMarketAcceptance(state, device, run, now, 'manual');
  return run;
}

export function recordMarketAcceptance(state, device, run, now, method) {
  run.acceptedWork = { source: 'marketplace', providerId: device.providerId, acceptedAt: timestamp(now), method, payout: payoutOffer(run) };
  emit(state, run, 'work.accepted', { source: 'marketplace', method, deviceId: device.id }, now);
}

export function claimAllowed(state, run, device, config, now) {
  const agreesWithDevice = (!run.deviceId || run.deviceId === device.id) && device.scenarios.includes(run.scenario) && walletNetworkMatches(device, run.expectedTransaction);
  if (!agreesWithDevice) return false;
  if (device.reservedRunId) {
    const candidate = device.reservedRunId === run.id && run.state === 'reserved'
      && run.authorizedProviderId === device.providerId && device.publicListing;
    if (!candidate) return false;
    return marketplaceEligible({ ...device, reservedRunId: null }, now, config.heartbeatMs);
  }
  if (run.state !== 'queued' || statusDevice(device, now, config.heartbeatMs) !== 'available') return false;
  if (run.allocation === 'private') {
    const invitation = state.invitations[run.invitationId];
    return run.authorizedProviderId === device.providerId && invitation?.state === 'accepted'
      && Date.parse(invitation.expiresAt) > now;
  }
  if (run.allocation === 'marketplace') {
    return Boolean(device.autoMatch && marketplaceEligible(device, now, config.heartbeatMs)
      && matchingMarketJob(state, run, device, now));
  }
  if (run.allocation === 'legacy' || !run.allocation) {
    return config.allowLegacyPool && !device.ownerId
      && (!device.allowedDeveloperEmails?.length || device.allowedDeveloperEmails.includes(state.users[run.ownerId].email));
  }
  return false;
}
