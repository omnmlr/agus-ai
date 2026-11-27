import { randomUUID } from 'node:crypto';
import { array, digest, requireCondition, stableJson } from './security.mjs';
import { conflict, exact, missing, own } from './pilot-policy.mjs';
import { assignmentTask, ownCampaign } from './campaigns.mjs';

function participant(state, user, id) {
  const assignment = own(state.assignments, id);
  const role = assignment?.ownerId === user.id ? 'developer'
    : assignment?.attempt?.contributorId === user.id ? 'contributor' : null;
  missing(role && assignment.attempt && assignment.terms.trainingEligible, 'Training consent');
  return { assignment, role };
}

export function trainingConsent(state, user, id, method, input, now) {
  const { assignment, role } = participant(state, user, id);
  const consent = assignment.attempt.consent;
  if (method === 'PUT') {
    exact(input, ['termsDigest', 'grant'], 'export authorization');
    conflict(input.termsDigest === assignment.termsDigest && input.grant === true, 'Review the exact export terms', 'scope_changed');
    consent[role] ??= { grantId: randomUUID(), grantedAt: now };
  } else if (method === 'DELETE') {
    consent[role] = null;
  }
  return { purpose: 'training', termsDigest: assignment.termsDigest, contributorGrantedAt: consent.contributor?.grantedAt ?? null,
    developerGrantedAt: consent.developer?.grantedAt ?? null };
}

function eligibleSource(state, assignment, campaign, now) {
  const revision = campaign.revisions[assignment.campaignRevision - 1];
  const attempt = assignment.attempt;
  const evidence = attempt?.submissions.at(-1);
  conflict(assignment.state === 'accepted' && assignment.terms.trainingEligible && evidence?.evidence &&
    attempt.review?.submissionVersion === evidence.version &&
    assignment.deadlineAt + revision.retentionDays * 86_400_000 > now,
  'Accepted evidence is outside the authorized retention scope', 'training_unavailable');
  requireCondition(attempt.consent.contributor && attempt.consent.developer,
    'Both participants must grant training rights', 'training_consent_required', 403);
  const task = assignmentTask(state, assignment);
  const { result, category, steps, correction } = evidence.evidence;
  const lease = own(state.nativeLeases, attempt.leaseId);
  const actions = lease?.report?.observations ?? [];
  return {
    reference: { assignmentId: assignment.id, attemptId: attempt.id, evidenceSha256: evidence.sha256,
      developerGrant: attempt.consent.developer.grantId, contributorGrant: attempt.consent.contributor.grantId },
    row: { taskKind: task.kind, runtimeClass: task.runtimeClass, buildSha256: task.buildSha256,
      rubric: task.rubric, result, category, stepCount: steps.length, sourceSha256: evidence.sha256,
      ...(correction && { correction }),
      ...(actions.length && { actions: actions.map(({ action, result: outcome, offsetMs }) =>
        ({ action, outcome, ...(Number.isSafeInteger(offsetMs) && { offsetMs }) })) }),
    },
  };
}

export function createCampaignExport(state, user, id, input, now) {
  const campaign = ownCampaign(state, user, id);
  exact(input, ['purpose', 'assignmentIds'], 'export package');
  requireCondition(input.purpose === 'training', 'Unknown export purpose');
  const ids = array(input.assignmentIds, 'export assignments', 24);
  requireCondition(ids.length > 0 && new Set(ids).size === ids.length
    && ids.every(assignmentId => typeof assignmentId === 'string' && campaign.assignmentIds.includes(assignmentId)),
  'Invalid assignment export scope');
  const sources = ids.map(assignmentId => eligibleSource(state, state.assignments[assignmentId], campaign, now));
  for (const record of Object.values(state.campaignExports)) {
    if (record.expiresAt <= now) delete state.campaignExports[record.id];
  }
  conflict(Object.values(state.campaignExports).filter(entry => entry.campaignId === id).length < 30, 'Export limit reached');
  const record = { id: randomUUID(), campaignId: id, purpose: input.purpose, createdAt: now, expiresAt: now + 60 * 60_000,
    sources: sources.map(source => source.reference), deliveries: 0,
    sha256: digest(stableJson(dataset(sources))) };
  state.campaignExports[record.id] = record;
  return { export: { id: record.id, purpose: record.purpose, expiresAt: record.expiresAt, sha256: record.sha256 } };
}

function dataset(sources) {
  return { schema: 'agus.campaign.training.v1', purpose: 'training', rows: sources.map(source => source.row) };
}

export function readCampaignExport(state, user, campaignId, exportId, now) {
  const campaign = ownCampaign(state, user, campaignId);
  const record = own(state.campaignExports, exportId);
  missing(record?.campaignId === campaign.id && record.expiresAt > now, 'Training export');
  const sources = record.sources.map(reference => eligibleSource(state, state.assignments[reference.assignmentId], campaign, now));
  requireCondition(stableJson(sources.map(source => source.reference)) === stableJson(record.sources),
    'Consent or source changed after export creation', 'consent_withdrawn', 403);
  const data = dataset(sources);
  conflict(digest(stableJson(data)) === record.sha256, 'Export integrity mismatch', 'integrity_error');
  record.lastDeliveredAt = now;
  record.deliveries++;
  return { export: { id: record.id, sha256: record.sha256, data } };
}
