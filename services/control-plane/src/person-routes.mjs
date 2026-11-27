import {
  acceptInvitation, closeInvitation, deviceDiagnostics, expireInvitations, expireMarketplace,
  getOwnedDevice, listInvitations, marketJobs, newInvitation, replayInvitation, reserveMarketJob, reviewInvitation,
  revokeDevice, startPairing, updateDevice,
} from './access.mjs';
import { idempotencyRecord } from './idempotency.mjs';
import { expireLeases, ownedDevice, publicRun, requestStop, timestamp } from './domain.mjs';
import { readJson, requireCondition } from './security.mjs';

export function refreshLifecycles(state, now) {
  expireLeases(state, now);
  expireInvitations(state, now);
  expireMarketplace(state, now);
}

const providerCanSee = (state, run, user) => {
  const providerId = run.assignedProviderId ?? run.authorizedProviderId;
  return providerId && state.providers[providerId]?.ownerId === user.id;
};

function ownerRun(run) {
  const { receipt, ...value } = publicRun(run);
  return {
    ...value,
    ...(receipt ? {
      receipt: {
        id: receipt.id, issuer: receipt.issuer, manifestSha256: receipt.manifestSha256,
        evidence: receipt.evidence?.map(({ kind, sha256, label }) => ({ kind, sha256, label })),
      },
    } : {}),
  };
}

export async function handlePersonRoutes({ response, request, route, url, user, store, config, settlement, send }) {
  const method = request.method;
  const execute = (work) => store.transaction((state) => {
    const now = config.now();
    refreshLifecycles(state, now);
    return work(state, now);
  });

  if (route[0] === 'invitations') {
    const [, id, operation] = route;
    let result;
    if (route.length === 1 && method === 'GET') {
      result = await execute((state) => ({ invitations: listInvitations(state, user) }));
    } else if (route.length === 1 && method === 'POST') {
      const input = await readJson(request, 16_384);
      result = await execute((state, now) => {
        const idempotency = idempotencyRecord({
          state, user, route: 'invitations', rawKey: request.headers['idempotency-key'], body: input, now,
          secret: config.idempotencySecret,
        });
        if (idempotency.previousId) return replayInvitation(state, user, idempotency.previousId, idempotency.retryToken);
        const value = newInvitation(state, user, input, config, now, idempotency.retryToken);
        idempotency.store(value.invitation.id);
        return value;
      });
      send(response, result, 201);
      return true;
    } else if (route.length === 2 && id === 'review' && method === 'POST') {
      const { token } = await readJson(request, 8_192);
      result = await execute((state, now) => reviewInvitation(state, user, token, now, true));
    } else if (route.length === 3 && operation === 'review' && method === 'POST') {
      result = await execute((state, now) => reviewInvitation(state, user, id, now));
    } else if (route.length === 3 && operation === 'accept' && method === 'POST') {
      const input = await readJson(request, 8_192);
      result = await execute((state, now) => acceptInvitation(state, user, id, input, config, now));
    } else if (route.length === 3 && ['decline', 'revoke'].includes(operation) && method === 'POST') {
      result = await execute((state, now) => closeInvitation(state, user, id, operation, now));
    } else {
      return false;
    }
    send(response, result);
    return true;
  }

  if (route[0] === 'marketplace' && route[1] === 'jobs') {
    if (route.length === 2 && method === 'GET') {
      const deviceId = url.searchParams.get('deviceId');
      const jobs = await execute((state, now) => marketJobs(
        state, getOwnedDevice(state, user, deviceId), config, now,
      ));
      send(response, { jobs });
      return true;
    }
    if (route.length === 4 && route[3] === 'accept' && method === 'POST') {
      const { deviceId } = await readJson(request, 8_192);
      const run = await execute((state, now) => reserveMarketJob(
        state, getOwnedDevice(state, user, deviceId, { active: true }), route[2], config, now,
      ));
      send(response, { run: ownerRun(run) });
      return true;
    }
    return false;
  }

  if (route[0] !== 'me') return false;
  const [, resource, id, operation, part] = route;
  if (resource === 'devices') {
    if (route.length === 2 && method === 'GET') {
      const devices = await execute((state, now) => Object.values(state.devices)
        .filter(({ ownerId }) => ownerId === user.id)
        .map((device) => ownedDevice(device, now, config.heartbeatMs)));
      send(response, { devices });
      return true;
    }
    if (route.length === 3 && id === 'pairings' && method === 'POST') {
      send(response, await execute((state, now) => startPairing(state, user, now)), 201);
      return true;
    }
    const deviceAction = (work, active = false) => execute(
      (state, now) => work(state, getOwnedDevice(state, user, id, { active }), now),
    );
    if (route.length === 3 && ['GET', 'PATCH', 'DELETE'].includes(method)) {
      const input = method === 'PATCH' ? await readJson(request, 16_384) : null;
      const device = await deviceAction((state, device, now) => {
        if (method === 'PATCH') updateDevice(state, device, input, now);
        if (method === 'DELETE') revokeDevice(state, device, now);
        return ownedDevice(device, now, config.heartbeatMs);
      }, method === 'PATCH');
      send(response, { device });
      return true;
    }
    if (route.length === 4 && operation === 'diagnostics' && method === 'POST') {
      const diagnostics = await deviceAction((state, device, now) => deviceDiagnostics(device, config, now));
      send(response, { diagnostics });
      return true;
    }
    if (operation === 'payout-wallet') {
      return walletRoutes({ request, response, route, part, deviceAction, config, send });
    }
  }
  if (resource === 'sessions') {
    if (route.length === 2 && method === 'GET') {
      const runs = await execute((state) => Object.values(state.runs).filter((run) => providerCanSee(state, run, user))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(ownerRun));
      send(response, { runs });
      return true;
    }
    const visible = (work) => execute((state, now) => {
      const run = state.runs[id];
      requireCondition(run && providerCanSee(state, run, user), 'Session not found', 'not_found', 404);
      return work(state, run, now);
    });
    if (route.length === 3 && method === 'GET') {
      send(response, { run: await visible((state, run) => ownerRun(run)) });
      return true;
    }
    if (route.length === 4 && operation === 'events' && method === 'GET') {
      const after = Number(url.searchParams.get('after') ?? '0');
      requireCondition(Number.isSafeInteger(after) && after >= 0, 'Invalid event cursor');
      const events = await visible((state, run) => (state.events[run.id] ?? []).filter(({ id }) => id > after));
      send(response, { events });
      return true;
    }
    if (route.length === 4 && operation === 'stop' && method === 'POST') {
      const run = await visible((state, run, now) => ownerRun(requestStop(state, run, 'provider', now)));
      send(response, { run });
      return true;
    }
  }
  if (resource === 'earnings' && route.length === 2 && method === 'GET') {
    const deviceId = url.searchParams.get('deviceId');
    const providerId = await execute((state) => getOwnedDevice(state, user, deviceId).providerId);
    requireCondition(settlement, 'Devnet payments are disabled on this deployment', 'payment_unavailable', 503);
    const earnings = await settlement.earnings({
      providerId,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      bucket: url.searchParams.get('bucket') ?? undefined,
    });
    send(response, { earnings });
    return true;
  }
  if (resource === 'notifications') {
    if (route.length === 2 && method === 'GET') {
      const notifications = await execute((state) => (state.notifications[user.id] ?? []).slice().reverse());
      send(response, { notifications });
      return true;
    }
    if (route.length === 4 && operation === 'read' && method === 'POST') {
      const notification = await execute((state, now) => {
        const value = (state.notifications[user.id] ?? []).find((entry) => entry.id === id);
        requireCondition(value, 'Notification not found', 'not_found', 404);
        value.readAt ??= timestamp(now);
        return value;
      });
      send(response, { notification });
      return true;
    }
  }
  return false;
}

function publicPayout(provider) {
  return provider.payoutWallet
    ? { address: provider.payoutWallet, verifiedAt: provider.payoutWalletVerifiedAt ?? null }
    : null;
}

async function walletRoutes({ request, response, route, part, deviceAction, config, send }) {
  if (route.length === 4 && request.method === 'GET') {
    const payoutWallet = await deviceAction((state, device) => publicPayout(state.providers[device.providerId]));
    send(response, { payoutWallet });
    return true;
  }
  if (route.length === 4 && request.method === 'DELETE') {
    await deviceAction((state, device) => {
      const provider = state.providers[device.providerId];
      provider.payoutWallet = null;
      provider.payoutWalletVerifiedAt = null;
      for (const [id, challenge] of Object.entries(state.walletChallenges)) {
        if (challenge.providerId === provider.id) delete state.walletChallenges[id];
      }
    }, true);
    send(response, { payoutWallet: null });
    return true;
  }
  if (route.length !== 5 || request.method !== 'POST') return false;
  if (part === 'challenge') {
    requireCondition(config.publicOrigin, 'Payout wallet proof is unavailable', 'payment_unavailable', 503);
    const { wallet } = await readJson(request, 8_192);
    const { createPayoutWalletChallenge } = await import('../../settlement/wallet-proof.mjs');
    const challenge = await deviceAction((state, device, now) => {
      const challenge = createPayoutWalletChallenge({ providerId: device.providerId, wallet, origin: config.publicOrigin, now });
      for (const [id, entry] of Object.entries(state.walletChallenges)) {
        if (entry.providerId === device.providerId || Date.parse(entry.expiresAt) <= now) delete state.walletChallenges[id];
      }
      state.walletChallenges[challenge.id] = challenge;
      return challenge;
    }, true);
    send(response, { challenge });
    return true;
  }
  if (part === 'verify') {
    const { challengeId, signature } = await readJson(request, 8_192);
    const { verifyPayoutWalletProof } = await import('../../settlement/wallet-proof.mjs');
    const payoutWallet = await deviceAction(async (state, device, now) => {
      const challenge = state.walletChallenges[challengeId];
      requireCondition(challenge?.providerId === device.providerId,
        'Wallet proof challenge not found', 'not_found', 404);
      await verifyPayoutWalletProof({ challenge, signature, now });
      const provider = state.providers[device.providerId];
      provider.payoutWallet = challenge.wallet;
      provider.payoutWalletVerifiedAt = timestamp(now);
      delete state.walletChallenges[challengeId];
      return publicPayout(provider);
    }, true);
    send(response, { payoutWallet });
    return true;
  }
  return false;
}
