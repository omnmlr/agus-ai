import { randomUUID } from 'node:crypto';
import {
  array, badInput, digest, hex256, object, publicAddress, requireCondition, string,
} from './security.mjs';
import { MODES, SCENARIOS, expectedTransaction } from './verification.mjs';

export const timestamp = (ms) => new Date(ms).toISOString();
export const validPackage = (value) => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){1,20}$/.test(value) && value.length <= 200;
export const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const terminal = (state) => ['passed', 'failed', 'cancelled', 'expired', 'unverified'].includes(state);
export const leaseReported = (lease) => ['verifying', 'completed'].includes(lease.status);

export function getOwned(records, id, user, name) {
  const value = records[id];
  requireCondition(value?.ownerId === user.id, `${name} not found`, 'not_found', 404);
  return value;
}

export function publicProject({ ownerId, ...project }) { return project; }
export function publicBuild({ ownerId, artifactId, ...build }) { return build; }
export function publicRun({ ownerId, leaseId, assignedProviderId, assignedPayoutWallet, authorizedProviderId, paymentNotificationStates, trainingConsent, ...run }) { return run; }
export function publicUser({ id, email, displayName, providerEnabled }) {
  return { id, email, ...(displayName ? { displayName } : {}), capabilities: { developer: true, provider: Boolean(providerEnabled) } };
}

export function notice(state, userId, type, data, now) {
  const items = state.notifications[userId] ?? (state.notifications[userId] = []);
  items.push({ id: randomUUID(), type, data, createdAt: timestamp(now), readAt: null });
  if (items.length > 200) items.shift();
}

export function emit(state, run, type, data, now) {
  const events = state.events[run.id] ?? (state.events[run.id] = []);
  events.push({ id: (events.at(-1)?.id ?? 0) + 1, type, at: timestamp(now), data });
  if (events.length > 256) events.shift();
  run.updatedAt = timestamp(now);
  if (['run.passed', 'run.failed', 'run.unverified', 'run.expired', 'run.cancelled', 'run.stop_requested'].includes(type)) {
    const participants = new Set([
      run.ownerId, state.providers[run.assignedProviderId ?? run.authorizedProviderId]?.ownerId,
    ]);
    for (const userId of participants) {
      if (userId) notice(state, userId, type, { runId: run.id }, now);
    }
  }
}

export function visibleTo(device, user, config) {
  if (device.revokedAt) return false;
  if (device.ownerId === user.id || device.publicListing) return true;
  return !device.ownerId && config.allowLegacyPool
    && (!device.allowedDeveloperEmails?.length || device.allowedDeveloperEmails.includes(user.email));
}

export function statusDevice(device, now, freshness) {
  if (device.revokedAt || !device.online || now - device.lastSeen > freshness
    || device.quarantinedAt != null) return 'offline';
  if (device.activeLeaseId || device.reservedRunId || !device.ready) return 'busy';
  return 'available';
}

export function scheduledNow(schedule, now) {
  if (!schedule || !schedule.windows.length) return true;
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(local.map(({ type, value }) => [type, value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday);
  const time = values.hour + ':' + values.minute;
  const previous = (day + 6) % 7;
  return schedule.windows.some(({ days, start, end }) => {
    if (start < end) return days.includes(day) && time >= start && time < end;
    return (days.includes(day) && time >= start) || (days.includes(previous) && time < end);
  });
}

export function marketplaceEligible(device, now, freshness) {
  return Boolean(device.ownerId && device.publicListing
    && statusDevice(device, now, freshness) === 'available'
    && scheduledNow(device.schedule, now)
    && (!device.constraints?.chargingRequired || device.profile.charging === true)
    && (!device.constraints?.wifiRequired || device.profile.wifiConnected === true));
}

export function publicDevice(device, now, freshness) {
  const state = statusDevice(device, now, freshness);
  const connectivity = device.online && !device.revokedAt && now - device.lastSeen <= freshness ? 'online' : 'offline';
  const readiness = device.quarantinedAt != null ? 'quarantined'
    : state === 'available' ? 'ready' : state;
  return {
    id: device.id, label: device.label, profile: device.profile,
    scenarios: device.scenarios, dedicated: true, state, connectivity, readiness,
    lastSeenAt: timestamp(device.lastSeen), publicListing: Boolean(device.publicListing),
    autoMatch: Boolean(device.autoMatch), marketplaceEligible: marketplaceEligible(device, now, freshness),
    ...(device.revokedAt ? { revokedAt: timestamp(device.revokedAt) } : {}),
  };
}

export function ownedDevice(device, now, freshness) {
  return {
    ...publicDevice(device, now, freshness), schedule: device.schedule ?? null,
    constraints: device.constraints ?? { chargingRequired: false, wifiRequired: false },
  };
}

const profileNumbers = new Set([
  'apiLevel', 'dataAvailableBytes', 'dataTotalBytes', 'memoryAvailableBytes', 'memoryTotalBytes',
  'batteryPercent', 'batteryTemperatureC', 'networkLatencyMs', 'throughputMbps',
]);
const profileStrings = new Set([
  'measuredAt', 'source', 'manufacturer', 'model', 'androidVersion', 'brand',
  'batteryHealth', 'thermalStatus', 'networkProbedAt',
]);
const profileKinds = new Set(['emulator', 'physical', 'android-device', 'adb-emulator', 'android-handset', 'unknown']);

export function walletNetworkMatches(device, expectation) {
  return !expectation || (device.profile?.walletNetwork ?? 'localnet') === expectation.network;
}

export function safeProfile(input) {
  const source = object(input, 'device profile');
  const profile = {};
  for (const key of profileNumbers) {
    const value = source[key];
    profile[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  for (const key of profileStrings) {
    const value = source[key];
    profile[key] = typeof value === 'string' ? value.slice(0, 120) : null;
  }
  for (const key of ['charging', 'wifiConnected']) {
    profile[key] = typeof source[key] === 'boolean' ? source[key] : null;
  }
  profile.walletNetwork = ['devnet', 'localnet'].includes(source.walletNetwork) ? source.walletNetwork : null;
  const kind = profileKinds.has(source.kind) ? source.kind : 'unknown';
  const provenance = kind === 'emulator' || kind === 'adb-emulator' ? 'simulated_environment' : 'runner_observed';
  return { ...profile, kind, provenance, hardwareAttested: false, seekerVerified: false };
}

export function deviceEntries(input) {
  const ids = new Set();
  return array(input, 'devices', 24).map((value) => {
    const device = object(value, 'device');
    const id = string(device.id, 'device id', 80);
    requireCondition(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !ids.has(id), 'Invalid or duplicate device id');
    ids.add(id);
    const scenarios = array(device.scenarios, 'device scenarios', SCENARIOS.length);
    requireCondition(
      scenarios.length > 0 && scenarios.every((scenario) => SCENARIOS.includes(scenario))
        && new Set(scenarios).size === scenarios.length,
      'Invalid device scenarios',
    );
    requireCondition(device.dedicated === true, 'Dedicated device authorization is required');
    return {
      localId: id, profile: safeProfile(device.profile), scenarios,
      online: device.online !== false, ready: device.ready !== false,
      label: device.label ? string(device.label, 'device label', 80) : null,
    };
  });
}

export function normalizedEmail(value) {
  const email = string(value, 'email', 254).trim().toLowerCase();
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Invalid email address');
  return email;
}

export function developerEmails(value) {
  if (value === undefined) return [];
  return [...new Set(array(value, 'allowedDeveloperEmails', 50).map(normalizedEmail))];
}

export function payoutWallet(value) {
  if (value === undefined) return null;
  requireCondition(publicAddress(value), 'Invalid payout wallet');
  return value;
}

export function applyHeartbeats(state, provider, entries, now) {
  const reported = new Set(entries.map(({ localId }) => localId));
  for (const device of Object.values(state.devices)) {
    if (device.providerId === provider.id && !reported.has(device.localId)) {
      device.online = false;
      device.ready = false;
    }
  }
  for (const entry of entries) {
    const id = `${provider.id}:${entry.localId}`;
    const previous = state.devices[id];
    if (previous?.revokedAt) continue;
    const label = previous?.labelOverride ?? entry.label ?? entry.profile.model ?? provider.displayName;
    let quarantinedAt = previous?.quarantinedAt ?? null;
    if (entry.ready && entry.online && quarantinedAt !== null && now > quarantinedAt) {
      quarantinedAt = null;
    }
    state.devices[id] = {
      ...previous, id, ...entry, label, providerId: provider.id, ownerId: provider.ownerId ?? null,
      allowedDeveloperEmails: provider.allowedDeveloperEmails,
      lastSeen: now, activeLeaseId: previous?.activeLeaseId ?? null, quarantinedAt,
    };
  }
}

export function releaseDevice(state, lease, now, { quarantined = false } = {}) {
  const device = state.devices[lease.deviceId];
  if (device?.activeLeaseId === lease.id) {
    device.activeLeaseId = null;
    device.ready = false;
    device.quarantinedAt = quarantined ? now : null;
  }
}

export function releaseReservation(state, run) {
  const device = state.devices[run.deviceId];
  if (device?.reservedRunId === run.id) device.reservedRunId = null;
  delete run.reservationExpiresAt;
}

export function requestStop(state, run, requesterRole, now) {
  if (run.state === 'stopping' || run.state === 'cancelled') return run;
  requireCondition(!terminal(run.state) && !run.receipt, 'Run can no longer be stopped', 'run_conflict', 409);
  run.stop = { requestedAt: timestamp(now), requesterRole, acknowledgedAt: null };
  const lease = state.leases[run.leaseId];
  if (lease?.status === 'running') {
    lease.status = 'stopping';
    run.state = 'stopping';
    run.executionState = 'stopping';
    run.leaseState = 'stopping';
    emit(state, run, 'run.stop_requested', { requesterRole }, now);
  } else {
    releaseReservation(state, run);
    run.state = 'cancelled';
    run.executionState = 'cancelled';
    run.leaseState = 'unallocated';
    run.stop.acknowledgedAt = timestamp(now);
    emit(state, run, 'run.cancelled', { requesterRole, priorActivation: false }, now);
  }
  return run;
}

export function expireLeases(state, now) {
  for (const lease of Object.values(state.leases)) {
    if (!['running', 'stopping', 'cancelled'].includes(lease.status) || lease.expiresAt > now) continue;
    const stopUnconfirmed = lease.status === 'stopping';
    lease.status = 'expired';
    releaseDevice(state, lease, now, { quarantined: true });
    const run = state.runs[lease.runId];
    if (['running', 'stopping'].includes(run.state)) {
      run.state = 'expired';
      run.executionState = 'expired';
      run.leaseState = 'expired';
      emit(state, run, 'run.expired', { deviceId: lease.deviceId, stopUnconfirmed }, now);
    }
  }
  for (const run of Object.values(state.runs)) {
    if (run.state === 'reserved' && Date.parse(run.reservationExpiresAt) <= now) {
      releaseReservation(state, run);
      run.state = 'expired';
      run.executionState = 'expired';
      run.leaseState = 'unallocated';
      emit(state, run, 'run.expired', { reason: 'reservation_expired' }, now);
    }
  }
}

export const evidenceConsent = (value = {}) => {
  const choices = object(value, 'evidence');
  for (const key of Object.keys(choices)) {
    requireCondition(['screenshots', 'logs', 'trajectory'].includes(key) && typeof choices[key] === 'boolean',
      'Invalid workload evidence choice');
  }
  return { screenshots: choices.screenshots === true, logs: choices.logs === true, trajectory: choices.trajectory === true };
};

export function durationLimit(value, config) {
  const max = Math.floor(config.leaseMs / 1000);
  const seconds = value ?? max;
  requireCondition(Number.isInteger(seconds) && seconds >= 15 && seconds <= max,
    `Duration must be between 15 and ${max} seconds`);
  return seconds;
}

export function createRun(state, user, input, config, now, privateGrant = null) {
  requiredRunFields(input);
  const project = getOwned(state.projects, input.projectId, user, 'Project');
  const build = getOwned(state.builds, input.buildId, user, 'Build');
  requireCondition(build.projectId === project.id, 'Build does not belong to this project');
  requireCondition(build.packageName, 'Registered build must include its Android package name');
  const expected = expectedTransaction(input.expectedTransaction, input.scenario, config);
  let device;
  if (input.deviceId !== undefined && input.deviceId !== null) {
    device = state.devices[input.deviceId];
    requireCondition(device && !device.revokedAt && (privateGrant || visibleTo(device, user, config)),
      'Device not found', 'not_found', 404);
    requireCondition(device.scenarios.includes(input.scenario) && walletNetworkMatches(device, expected),
      'Device does not support this scenario and wallet network', 'device_unavailable', 409);
  }
  requireCondition(input.allocation === undefined || input.allocation === 'marketplace', 'Unsupported allocation');
  const allocation = privateGrant ? 'private'
    : input.allocation || device?.ownerId || !config.allowLegacyPool ? 'marketplace' : 'legacy';
  requireCondition(allocation !== 'marketplace' || !device || device.publicListing,
    'Selected device is not listed for marketplace use', 'device_unavailable', 409);
  const run = {
    id: randomUUID(), ownerId: user.id, projectId: project.id, buildId: build.id,
    deviceId: input.deviceId ?? null, scenario: input.scenario, mode: input.mode, allocation,
    maximumDurationSeconds: durationLimit(input.maximumDurationSeconds, config),
    ...(allocation !== 'legacy' ? { evidence: evidenceConsent(input.evidence), consentVersion: 'workload-v1' } : {}),
    ...(privateGrant ? { invitationId: privateGrant.id, authorizedProviderId: device.providerId } : {}),
    expectedTransaction: expected,
    state: 'queued', executionState: 'queued', leaseState: 'unallocated', leaseId: null,
    createdAt: timestamp(now), updatedAt: timestamp(now),
  };
  state.runs[run.id] = run;
  emit(state, run, 'run.queued', { scenario: run.scenario, mode: run.mode, allocation }, now);
  return run;
}

function requiredRunFields(input) {
  requireCondition(uuid(input.projectId) && uuid(input.buildId), 'Invalid project or build identifier');
  requireCondition(SCENARIOS.includes(input.scenario), 'Invalid run scenario');
  requireCondition(MODES.includes(input.mode), 'Invalid run mode');
  if (input.deviceId !== undefined && input.deviceId !== null) string(input.deviceId, 'device identifier', 120);
}

const ACTIONS = ['launch', 'screenshot', 'describe', 'tap', 'wait', 'finish'];

export function actionInput(input) {
  const type = input.type;
  requireCondition(ACTIONS.includes(type), 'Unsupported agent action');
  const args = input.args === undefined ? {} : object(input.args, 'action args');
  if (type === 'tap') {
    requireCondition(Object.keys(args).length === 1, 'Tap requires exactly one semantic target');
    const target = string(args.target, 'semantic tap target', 100);
    requireCondition(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(target), 'Invalid semantic tap target');
    return { type, args: { target } };
  }
  if (type === 'wait') {
    requireCondition(
      Object.keys(args).length === 0 || (Object.keys(args).length === 1
        && Number.isInteger(args.ms) && args.ms >= 0 && args.ms <= 5_000),
      'Invalid wait; use up to 5000 ms',
    );
    return { type, args: args.ms === undefined ? {} : { ms: args.ms } };
  }
  if (Object.keys(args).length !== 0) throw badInput('action args');
  return { type, args: {} };
}

export function safeObservation(input) {
  const observation = object(input, 'action observation');
  requireCondition(Object.keys(observation).every((key) => ['code', 'sha256', 'phase', 'actions'].includes(key)),
    'Observation contains a field outside the action scope');
  if (observation.code !== undefined) {
    requireCondition(typeof observation.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(observation.code), 'Invalid action code');
  }
  if (observation.phase !== undefined) {
    requireCondition(typeof observation.phase === 'string' && /^[a-z0-9-]{1,80}$/.test(observation.phase), 'Invalid action phase');
  }
  if (observation.sha256 !== undefined) requireCondition(hex256(observation.sha256), 'Invalid action evidence digest');
  if (observation.actions !== undefined) {
    return { ...observation, actions: array(observation.actions, 'semantic actions', 8).map(actionInput) };
  }
  return observation;
}

export function newAction(state, run, input, now) {
  requireCondition(run.mode === 'agent' && run.state === 'running' && !run.receipt,
    'Run is not accepting agent actions', 'run_conflict', 409);
  const actions = state.actions[run.id] ?? (state.actions[run.id] = []);
  requireCondition(actions.length < 80 && !actions.some(({ state, type }) => state === 'queued'
    || (type === 'finish' && state === 'completed')),
  'Wait for the pending action or finish the evaluation', 'action_conflict', 409);
  const { type, args } = actionInput(input);
  requireCondition(type !== 'screenshot' || run.allocation === 'legacy' || run.evidence?.screenshots,
    'Screenshot collection is outside this workload consent', 'consent_required', 403);
  const action = { id: randomUUID(), type, args, createdAt: timestamp(now), state: 'queued' };
  actions.push(action);
  emit(state, run, 'action.queued', { actionId: action.id, type }, now);
  return action;
}

export function authSession(state, credential, now) {
  const session = state.sessions[digest(credential)];
  requireCondition(credential && session?.expiresAt > now, 'Developer sign-in required', 'unauthorized', 401);
  return state.users[session.userId];
}

export function authProvider(state, credential) {
  const hash = digest(credential);
  const provider = credential && Object.values(state.providers).find(({ tokenHash, revokedAt }) => !revokedAt && tokenHash === hash);
  requireCondition(provider, 'Provider sign-in required', 'unauthorized', 401);
  return provider;
}

export function authLease(state, id, credential) {
  const lease = state.leases[id];
  requireCondition(credential && lease?.tokenHash === digest(credential),
    'Valid scoped lease token required', 'unauthorized', 401);
  return lease;
}
