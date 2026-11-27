import { digest, requireCondition } from './security.mjs';
import { timestamp } from './domain.mjs';

const version = 'agus.training-trajectory.v1';
const actionTypes = new Set(['describe', 'wait', 'launch', 'tap', 'finish', 'screenshot', 'unsupported']);
const phases = new Set(['ready', 'app-launched', 'wallet-authorized', 'request-wallet', 'approve-connection',
  'approve-transaction', 'submit-transfer', 'simulate-result', 'wallet-request-answered', 'waiting-for-approved-ui']);

export function trainingAccess(state, runId, user, now, grant) {
  const run = state.runs[runId];
  const providerOwner = run && state.providers[run.assignedProviderId]?.ownerId;
  const role = user.id === run?.ownerId ? 'developer' : user.id === providerOwner ? 'provider' : null;
  requireCondition(role, 'Run not found', 'not_found', 404);
  const trace = run.receipt?.evidence.find(entry => entry.kind === 'trajectory' && entry.url);
  requireCondition(run.evidence?.trajectory && trace && providerOwner && providerOwner !== run.ownerId,
    'Run has no eligible consented trajectory', 'training_unavailable', 409);
  const consent = run.trainingConsent ??= { developer: null, provider: null };
  if (grant !== undefined) consent[role] = grant ? timestamp(now) : null;
  return { role, consent: { ...consent }, trace, receipt: run.receipt, scenario: run.scenario };
}

export function trainingExport(access, bytes) {
  requireCondition(access.role === 'developer' && access.consent.developer && access.consent.provider,
    'Training export requires both parties’ consent', 'training_consent_required', 403);
  requireCondition(bytes && digest(bytes) === access.trace.sha256, 'Trajectory hash mismatch', 'integrity_error', 503);
  let rows;
  try { rows = JSON.parse(bytes); } catch { rows = null; }
  requireCondition(Array.isArray(rows) && rows.length <= 60 && rows.every(row => row && actionTypes.has(row.type)
    && ['completed', 'failed'].includes(row.outcome) && Number.isFinite(Date.parse(row.at))),
  'Unsupported trajectory evidence', 'training_unavailable', 409);
  const start = Date.parse(access.receipt.manifest.startedAt);
  return {
    format: version, purpose: 'training', scenario: access.scenario,
    source: { receiptId: access.receipt.id, manifestSha256: access.receipt.manifestSha256,
      trajectorySha256: access.trace.sha256, planner: access.receipt.manifest.execution?.planner ?? 'unknown' },
    actions: rows.map((row, index) => ({ index, type: row.type, outcome: row.outcome,
      offsetMs: Math.max(0, Date.parse(row.at) - start),
      ...(phases.has(row.observation?.phase) ? { phase: row.observation.phase } : {}),
      ...(row.selectedBy === 'gemini' ? { selectedBy: 'gemini' } : {}),
    })),
  };
}
