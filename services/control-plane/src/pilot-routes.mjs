import { campaignRoute, isCampaignRoute } from './campaign-routes.mjs';
import { qualified } from './qualifications.mjs';
import { authSession } from './domain.mjs';
import { digest, readJson, requireCondition } from './security.mjs';
import { boundJson, conflict, exact, missing, own } from './pilot-policy.mjs';
import {
  authenticateNativeLease, authenticateRuntime, completeNativeEnrollment, issueNativeLease,
  nativeBuildForLease, nativeHeartbeat, publicInstallation, receiveNativeCleanup, receiveNativeReport,
  renewNativeLease, revokeNativeInstallation, startNativeEnrollment,
} from './native-runtime.mjs';

function nativePersonRoute(state, user, route, method, input, now) {
  const [, resource, id, action] = route;
  if (resource === 'runtime-enrollments') {
    if (method === 'POST' && !id) return startNativeEnrollment(state, user, input, now);
    if (method === 'POST' && action === 'complete') return completeNativeEnrollment(state, user, id, input, now);
  }
  if (resource === 'runtime-installations') {
    if (method === 'GET' && !id) {
      return { installations: Object.values(state.runtimes).filter(record => record.ownerId === user.id)
        .map(record => publicInstallation(record, now)) };
    }
    if (method === 'DELETE' && id && !action) return revokeNativeInstallation(state, user, id, now);
  }
  missing(false, 'Route');
}

function transport(state, pilot, credential, route, method, input, now) {
  const [, resource, id, operation] = route;
  if (resource === 'installations' && method === 'POST' && id) {
    const installation = authenticateRuntime(state, id, credential, now);
    if (operation === 'heartbeat') return nativeHeartbeat(state, installation, input, now);
    if (operation === 'claim') {
      exact(input, ['assignmentId'], 'claim');
      const assignment = own(state.assignments, input.assignmentId);
      missing(assignment?.installationId === installation.id, 'Assignment');
      const campaign = own(state.campaigns, assignment.campaignId);
      const task = campaign?.revisions[assignment.campaignRevision - 1]?.tasks[assignment.taskIndex];
      conflict(campaign?.state === 'active' && task && qualified(state, installation.ownerId, task.skill ?? null, now),
        'The campaign is paused or qualification has expired', 'assignment_unavailable');
      const build = own(state.builds, task?.buildId);
      missing(build && task, 'Reviewed workload');
      return issueNativeLease(state, installation, assignment, task, build, pilot, now);
    }
  }
  if (resource === 'leases' && id) {
    const lease = authenticateNativeLease(state, id, credential, now);
    if (method === 'GET' && operation === 'build') return nativeBuildForLease(state, lease);
    if (method === 'GET' && !operation) return renewNativeLease(state, lease, now);
    if (method === 'POST' && operation === 'report') return receiveNativeReport(state, lease, input, now);
    if (method === 'POST' && operation === 'cleanup') return receiveNativeCleanup(state, lease, input, now);
  }
  missing(false, 'Route');
}

export async function handlePilotRoutes({ services, route, request, response, send, sendBytes }) {
  const { store, config, credential } = services;
  const method = request.method;
  const runtime = route[0] === 'runtime';
  const nativePerson = route[0] === 'me' && ['runtime-enrollments', 'runtime-installations'].includes(route[1]);
  if (!runtime && !nativePerson && !isCampaignRoute(route)) return false;
  requireCondition(config.pilot, 'The local product pilot is disabled', 'pilot_unavailable', 503);
  missing(route.length <= 4, 'Route');
  const input = ['POST', 'PUT', 'PATCH'].includes(method) ? await readJson(request, 65_536) : null;
  if (input) boundJson(input);
  const result = await store.transaction(state => {
    const now = config.now();
    if (runtime) return transport(state, config.pilot, credential, route, method, input, now);
    const user = authSession(state, credential, now);
    if (nativePerson) return nativePersonRoute(state, user, route, method, input, now);
    return campaignRoute(state, user, route, method, input, config, now, request.headers['idempotency-key']);
  });
  if (runtime && method === 'GET' && route[3] === 'build') {
    const bytes = await store.artifact(result.artifactId);
    requireCondition(bytes && digest(bytes) === result.sha256, 'Reviewed artifact failed integrity verification',
      'integrity_error', 503);
    await store.transaction(state => nativeBuildForLease(state, authenticateNativeLease(state, route[2], credential, config.now())));
    sendBytes(response, bytes, 'application/vnd.android.package-archive', result.id + '.apk');
  } else {
    send(response, result);
  }
  return true;
}
