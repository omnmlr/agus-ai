import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { developerSession, logout, refreshSession, updateProfile } from './accounts.mjs';
import { finishGoogle, googleCallback, startEmailOtp, startGoogle, verifyEmailOtp } from './identity.mjs';
import {
  authSession, createRun, getOwned, newAction, notice, publicBuild, publicDevice,
  publicProject, publicRun, publicUser, requestStop, timestamp, validPackage, visibleTo,
} from './domain.mjs';
import { handlePersonRoutes, refreshLifecycles } from './person-routes.mjs';
import { idempotencyRecord } from './idempotency.mjs';
import {
  acknowledgeCleanup, buildForLease, claim, enrollProvider, finalizeReport, heartbeat, leaseStatus,
  pendingActions, recordAction, submitReport,
} from './provider.mjs';
import {
  HttpError, bearer, decodeBase64, digest, hex256, object, publicAddress, readJson, requireCondition, string,
} from './security.mjs';

const MiB = 1024 * 1024;

export function createApi({ store, config, settlement }) {
  const authLimits = new Map();
  let streams = 0;

  async function handler(request, response) {
    const origin = request.headers.origin;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (config.corsOrigin && origin === config.corsOrigin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, Last-Event-ID');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(!origin || origin === config.corsOrigin ? 204 : 403).end();
      return;
    }

    try {
      const url = new URL(request.url, 'http://control-plane.invalid');
      if (url.pathname === '/health' && request.method === 'GET') {
        try {
          await store.health();
        } catch {
          throw new HttpError(503, 'not_ready', 'Control-plane persistence is unavailable');
        }
        send(response, { ok: true, persistence: store.pool ? 'postgres' : 'local-file' });
        return;
      }
      const parts = url.pathname.split('/').slice(1).map(decodeURIComponent);
      requireCondition(parts[0] === 'api' && parts[1] === 'v1', 'Route not found', 'not_found', 404);
      const route = parts.slice(2);
      const services = { store, config, credential: bearer(request) };
      if (route[0] === 'auth') {
        if (['register', 'login'].includes(route[1]) && route.length === 2 && request.method === 'POST') {
          checkRate(authLimits, request.socket.remoteAddress, config.now());
          send(response, await developerSession({
            ...services, input: await readJson(request, 8_192), register: route[1] === 'register',
          }));
          return;
        }
        if (route.join('/') === 'auth/logout' && request.method === 'POST') {
          send(response, await logout({ ...services, now: config.now() }));
          return;
        }
        if (route.join('/') === 'auth/refresh' && request.method === 'POST') {
          send(response, await refreshSession({ ...services, now: config.now() }));
          return;
        }
        if (route.join('/') === 'auth/me' && request.method === 'PATCH') {
          send(response, await updateProfile({
            ...services, input: await readJson(request, 8_192), now: config.now(),
          }));
          return;
        }
        const identityRoute = route.slice(1).join('/');
        const identityRoutes = {
          'email/start': startEmailOtp, 'email/verify': verifyEmailOtp,
          'google/start': startGoogle, 'google/exchange': finishGoogle,
        };
        if (Object.hasOwn(identityRoutes, identityRoute) && request.method === 'POST') {
          checkRate(authLimits, request.socket.remoteAddress, config.now());
          send(response, await identityRoutes[identityRoute]({ ...services, input: await readJson(request, 8_192) }));
          return;
        }
        if (identityRoute === 'google/callback' && request.method === 'GET') {
          const location = await googleCallback({ ...services, query: url.searchParams });
          response.writeHead(303, { Location: location, 'Referrer-Policy': 'no-referrer' }).end();
          return;
        }
      }
      if (route[0] === 'provider') {
        await providerRoutes({ request, response, route, services });
        return;
      }

      const user = await store.transaction((state) => authSession(state, services.credential, config.now()));
      if (route.join('/') === 'auth/me' && request.method === 'GET') {
        send(response, { user: publicUser(user) });
        return;
      }
      if (await handlePersonRoutes({ response, request, route, url, user, store, config, settlement, send })) return;
      if (route.length === 1 && route[0] === 'devices' && request.method === 'GET') {
        const devices = await store.transaction((state) => {
          const now = config.now();
          refreshLifecycles(state, now);
          return Object.values(state.devices).filter((device) => visibleTo(device, user, config))
            .map((device) => publicDevice(device, now, config.heartbeatMs));
        });
        send(response, { devices });
        return;
      }
      if (route.length === 1 && route[0] === 'projects') {
        await projectRoutes({ store, config, user, request, response });
        return;
      }
      if (route.length === 1 && route[0] === 'builds') {
        await buildRoutes({ store, config, user, request, response });
        return;
      }
      if (route[0] !== 'runs') throw notFound();
      const runId = route[1];
      if (route.length === 1) {
        await runCollection({ store, config, user, request, response, settlement });
        return;
      }
      const owned = (action) => store.transaction((state) => {
        const now = config.now();
        refreshLifecycles(state, now);
        return action(state, getOwned(state.runs, runId, user, 'Run'), now);
      });
      if (route.length === 2 && request.method === 'GET') {
        send(response, { run: await owned((state, run) => publicRun(run)) });
        return;
      }
      if (route.length === 3 && route[2] === 'events' && request.method === 'GET') {
        const after = Number(url.searchParams.get('after') ?? request.headers['last-event-id'] ?? '0');
        requireCondition(Number.isSafeInteger(after) && after >= 0, 'Invalid event cursor');
        const read = (cursor) => owned((state, run) => (state.events[run.id] ?? []).filter(({ id }) => id > cursor));
        if (request.headers.accept?.includes('text/event-stream')) {
          requireCondition(streams < 32, 'Too many open event streams', 'busy', 503);
          const initial = await read(after);
          streams += 1;
          try {
            await eventStream(response, read, after, initial);
          } finally {
            streams -= 1;
          }
        } else {
          send(response, { events: await read(after) });
        }
        return;
      }
      if (route.length === 3 && route[2] === 'cancel' && request.method === 'POST') {
        const run = await owned((state, run, now) => publicRun(requestStop(state, run, 'developer', now)));
        send(response, { run });
        return;
      }
      if (route.length === 3 && route[2] === 'actions') {
        if (request.method === 'GET') {
          send(response, { actions: await owned((state, run) => state.actions[run.id] ?? []) });
          return;
        }
        if (request.method === 'POST') {
          const input = await readJson(request, 8_192);
          const action = await owned((state, run, now) => newAction(state, run, input, now));
          send(response, { action }, 201);
          return;
        }
      }
      if (route.length === 3 && route[2] === 'verify' && request.method === 'POST') {
        const work = await owned((state, run) => {
          requireCondition(['unverified', 'verifying'].includes(run.state) && run.receipt,
            'Run does not have retries pending', 'run_conflict', 409);
          return { run, lease: state.leases[run.leaseId], actions: state.actions[run.id] ?? [] };
        });
        send(response, await finalizeReport({ store, config, ...work }));
        return;
      }
      if (route.length === 4 && route[2] === 'evidence' && request.method === 'GET' && hex256(route[3])) {
        const evidence = await owned((state, run) => run.receipt?.evidence.find(
          ({ sha256, url }) => sha256 === route[3] && url,
        ));
        requireCondition(evidence, 'Evidence attachment not found', 'not_found', 404);
        const bytes = await store.artifact(`evidence:${runId}:${evidence.sha256}`);
        requireCondition(bytes && digest(bytes) === evidence.sha256,
          'Evidence no longer matches its signed hash', 'integrity_error', 503);
        sendBytes(response, bytes, 'application/octet-stream', `evidence-${evidence.sha256}`);
        return;
      }
      if (route.length === 3 && ['payment', 'quote', 'funding', 'settle', 'reconcile'].includes(route[2])) {
        await paymentRoutes({ settlement, owned, request, response, operation: route[2] });
        return;
      }
      throw notFound();
    } catch (error) {
      if (response.destroyed) return;
      if (response.headersSent) {
        response.end();
        return;
      }
      if (error instanceof URIError) {
        send(response, { error: { code: 'invalid_request', message: 'Malformed path' } }, 400);
        return;
      }
      if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599) {
        send(response, {
          error: { code: error.code ?? 'request_failed', message: error.message },
        }, error.statusCode);
        return;
      }
      console.error('Control-plane request error', error.code ?? error.name);
      send(response, { error: { code: 'internal_error', message: 'The control-plane request failed' } }, 500);
    }
  }
  return handler;
}

async function projectRoutes({ store, config, user, request, response }) {
  if (request.method === 'GET') {
    const projects = await store.transaction((state) => Object.values(state.projects)
      .filter(({ ownerId }) => ownerId === user.id).map(publicProject));
    send(response, { projects });
    return;
  }
  if (request.method !== 'POST') throw notFound();
  const input = await readJson(request, 8_192);
  const name = string(input.name, 'project name', 100).trim();
  requireCondition(name.length > 0, 'Project name is required');
  const project = await store.transaction((state) => {
    const record = { id: randomUUID(), name, ownerId: user.id, createdAt: timestamp(config.now()) };
    state.projects[record.id] = record;
    return publicProject(record);
  });
  send(response, { project }, 201);
}

async function buildRoutes({ store, config, user, request, response }) {
  if (request.method === 'GET') {
    const builds = await store.transaction((state) => Object.values(state.builds)
      .filter(({ ownerId }) => ownerId === user.id).map(publicBuild));
    send(response, { builds });
    return;
  }
  if (request.method !== 'POST') throw notFound();
  const input = await readJson(request, 4 * Math.ceil(config.maxApkBytes / 3) + 8_192);
  const name = string(input.name, 'build name', 100).trim();
  requireCondition(name.length > 0, 'Build name is required');
  requireCondition(hex256(input.sha256), 'Invalid build SHA-256');
  requireCondition(input.packageName === undefined || validPackage(input.packageName), 'Invalid Android package name');
  const bytes = decodeBase64(input.apkBase64, 'APK bytes', config.maxApkBytes);
  requireCondition(digest(bytes) === input.sha256, 'APK bytes do not match SHA-256', 'hash_mismatch', 400);
  requireCondition(bytes.length >= 8 && bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])),
    'APK upload must be a ZIP-format Android package');
  const build = await store.transaction(async (state, addArtifact) => {
    const project = getOwned(state.projects, input.projectId, user, 'Project');
    const id = randomUUID();
    const artifactId = 'apk:' + id;
    await addArtifact(artifactId, bytes);
    const record = {
      id, projectId: project.id, ownerId: user.id, name, artifactId, sha256: input.sha256,
      packageName: input.packageName ?? null, createdAt: timestamp(config.now()), size: bytes.length,
    };
    state.builds[id] = record;
    return publicBuild(record);
  });
  send(response, { build }, 201);
}

async function runCollection({ store, config, user, request, response, settlement }) {
  if (request.method === 'GET') {
    const runs = await store.transaction((state) => {
      refreshLifecycles(state, config.now());
      return Object.values(state.runs).filter(({ ownerId }) => ownerId === user.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(publicRun);
    });
    send(response, { runs });
    return;
  }
  if (request.method !== 'POST') throw notFound();
  const input = await readJson(request, 8_192);
  const run = await store.transaction((state) => {
    const now = config.now();
    const idempotency = idempotencyRecord({
      state, user, route: 'runs', rawKey: request.headers['idempotency-key'], body: input, now,
      secret: config.idempotencySecret,
    });
    if (idempotency.previousId) return publicRun(getOwned(state.runs, idempotency.previousId, user, 'Run'));
    const run = createRun(state, user, input, config, now);
    if (input.payment !== undefined) {
      const { developerWallet, kind } = object(input.payment, 'payment');
      requireCondition(settlement, 'Devnet payments are disabled', 'payment_unavailable', 503);
      const provider = state.providers[state.devices[run.deviceId]?.providerId];
      requireCondition(kind === 'devnet' && run.allocation === 'marketplace' && run.scenario === 'wallet-transfer'
        && run.expectedTransaction?.network === 'devnet' && provider?.payoutWalletVerifiedAt && publicAddress(developerWallet),
      'Paid work requires verified Devnet wallet-transfer terms and a selected verified provider wallet', 'payment_unavailable', 409);
      run.paymentTerms = {
        kind: 'devnet', status: 'quote_required', providerWallet: provider.payoutWallet,
        providerId: provider.id, developerWallet,
      };
    }
    idempotency.store(run.id);
    return publicRun(run);
  });
  send(response, { run }, 201);
}

async function providerRoutes({ request, response, route, services }) {
  const [, resource, leaseId, operation, actionId] = route;
  if (route.length === 2 && request.method === 'POST') {
    const handler = ({
      enroll: enrollProvider, heartbeat, claim, report: submitReport,
    })[resource];
    if (!Object.hasOwn({ enroll: true, heartbeat: true, claim: true, report: true }, resource)) throw notFound();
    const input = await readJson(request, resource === 'report' ? 5 * MiB : 64 * 1024);
    send(response, await handler({ ...services, input }));
    return;
  }
  if (resource !== 'leases' || !leaseId) throw notFound();
  const lease = { ...services, leaseId };
  if (route.length === 3 && request.method === 'GET') {
    send(response, await leaseStatus(lease));
    return;
  }
  if (route.length === 4 && operation === 'build' && request.method === 'GET') {
    const build = await buildForLease(lease);
    const bytes = await services.store.artifact(build.artifactId);
    requireCondition(bytes && digest(bytes) === build.sha256,
      'Artifact does not match the registered hash', 'integrity_error', 503);
    sendBytes(response, bytes, 'application/vnd.android.package-archive', `${build.id}.apk`);
    return;
  }
  if (route.length === 4 && operation === 'release' && request.method === 'POST') {
    send(response, await acknowledgeCleanup({ ...lease, input: await readJson(request, 8_192) }));
    return;
  }
  if (route.length === 4 && operation === 'actions' && request.method === 'GET') {
    send(response, await pendingActions(lease));
    return;
  }
  if (route.length === 5 && operation === 'actions' && request.method === 'POST') {
    send(response, await recordAction({ ...lease, actionId, input: await readJson(request, 64 * 1024) }));
    return;
  }
  throw notFound();
}

async function paymentRoutes({ settlement, owned, request, response, operation }) {
  const run = await owned((state, run) => run);
  requireCondition(settlement, 'Devnet payments are disabled on this deployment', 'payment_unavailable', 503);
  const runId = run.id;
  const terms = run.paymentTerms;
  let payment;
  if (operation === 'payment' && request.method === 'GET') {
    payment = await settlement.get({ runId });
  } else if (operation === 'quote' && request.method === 'POST') {
    requireCondition(terms, 'This workload uses explicit unpaid terms', 'payment_unavailable', 409);
    const { developerWallet } = await readJson(request, 8_192);
    requireCondition(developerWallet === undefined || developerWallet === terms.developerWallet,
      'The funding wallet differs from the approved terms', 'payment_conflict', 409);
    payment = await settlement.quote({
      runId, developerWallet: terms.developerWallet, providerWallet: terms.providerWallet, providerId: terms.providerId,
    });
  } else if (operation === 'funding' && request.method === 'POST') {
    requireCondition(terms, 'This workload uses explicit unpaid terms', 'payment_unavailable', 409);
    const { signature } = await readJson(request, 8_192);
    payment = await settlement.verifyFunding({ runId, signature });
  } else if (operation === 'settle' && request.method === 'POST') {
    const transaction = run.verification?.transaction;
    requireCondition(run.state === 'passed' && transaction?.status === 'verified' && transaction.network === 'devnet'
      && run.receipt?.id && run.acceptedWork?.payout.kind === 'devnet'
      && run.assignedProviderId === terms?.providerId && run.assignedPayoutWallet === terms?.providerWallet,
    'Accepted paid work with a signed report and independently verified Devnet outcome is required', 'ineligible_report', 409);
    payment = await settlement.settle({
      runId, eligibleReportId: run.receipt.id, providerWallet: run.assignedPayoutWallet, providerId: run.assignedProviderId,
    });
  } else if (operation === 'reconcile' && request.method === 'POST') {
    payment = await settlement.reconcile({ runId });
  } else {
    throw notFound();
  }

  if (payment) await owned((state, current, now) => {
    if (!current.paymentTerms) return;
    const transitions = ['quote_required', 'awaiting_funding', 'funded', 'settlement_ready', 'submitted_or_unknown', 'needs_review', 'failed', 'settled'];
    if (transitions.indexOf(payment.state) >= transitions.indexOf(current.paymentTerms.status)) {
      current.paymentTerms.status = payment.state;
    }
    current.paymentTerms.quote ??= payment.quote;
    const reported = current.paymentNotificationStates ?? (current.paymentNotificationStates = []);
    if (!reported.includes(payment.state)) {
      reported.push(payment.state);
      const owner = state.providers[current.paymentTerms.providerId]?.ownerId;
      for (const participant of new Set([current.ownerId, owner])) {
        if (participant) notice(state, participant, 'payment.' + payment.state, { runId }, now);
      }
    }
  });
  send(response, { payment });
}

function checkRate(limits, address, now) {
  for (const [key, value] of limits) {
    if (value.until <= now) limits.delete(key);
  }
  const current = limits.get(address) ?? { count: 0, until: now + 60_000 };
  requireCondition(current.count < 40 && limits.size < 10_000,
    'Too many sign-in attempts; retry in one minute', 'rate_limited', 429);
  current.count += 1;
  limits.set(address, current);
}

function send(response, value, status = 200) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

function sendBytes(response, bytes, contentType, filename) {
  response.writeHead(200, {
    'Content-Type': contentType, 'Content-Length': bytes.length,
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  response.end(bytes);
}

function notFound() { return new HttpError(404, 'not_found', 'Route not found'); }

async function eventStream(response, read, after, initial) {
  response.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
  response.write('retry: 2000\n\n');
  const deliver = (events) => {
    for (const event of events) {
      response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      after = event.id;
    }
  };
  deliver(initial);
  const expires = Date.now() + 60_000;
  let heartbeatAt = Date.now() + 12_000;
  while (!response.destroyed && Date.now() < expires) {
    await delay(750);
    if (response.destroyed) return;
    deliver(await read(after));
    if (Date.now() > heartbeatAt) {
      response.write(': keepalive\n\n');
      heartbeatAt = Date.now() + 12_000;
    }
  }
  response.end();
}
