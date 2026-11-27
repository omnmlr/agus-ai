import { createHmac } from 'node:crypto';
import { digest, requireCondition, stableJson, token } from './security.mjs';

const retentionMs = 24 * 60 * 60_000;

export function idempotencyRecord({ state, user, route, rawKey, body, now, secret }) {
  if (rawKey === undefined) return { store() {} };
  requireCondition(typeof rawKey === 'string' && /^[\w.-]{1,128}$/.test(rawKey),
    'Idempotency-Key must be 1 to 128 URL-safe characters');
  const scope = JSON.stringify([route, user.id, rawKey]);
  const keyHash = digest(scope);
  const requestHash = digest(stableJson(body));
  for (const [hash, value] of Object.entries(state.idempotencyKeys)) {
    if (value.expiresAt <= now) delete state.idempotencyKeys[hash];
  }
  const record = state.idempotencyKeys[keyHash];
  if (record) {
    requireCondition(record.requestHash === requestHash,
      'Idempotency key already used for a different request body', 'idempotency_conflict', 409);
  }
  const generation = record?.generation ?? token();
  const retryToken = createHmac('sha256', secret)
    .update(JSON.stringify(['agus:idempotency:v1', scope, generation])).digest('base64url');
  return {
    previousId: record?.resourceId,
    retryToken,
    store(resourceId) {
      state.idempotencyKeys[keyHash] = { requestHash, resourceId, generation, expiresAt: now + retentionMs };
    },
  };
}
