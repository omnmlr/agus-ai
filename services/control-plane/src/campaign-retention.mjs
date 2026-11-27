const dayMs = 86_400_000;

export function evidenceExpiresAt(state, assignment) {
  const revision = state.campaigns[assignment.campaignId].revisions[assignment.campaignRevision - 1];
  return assignment.deadlineAt + revision.retentionDays * dayMs;
}

export function purgeExpiredCampaignEvidence(state, now) {
  for (const assignment of Object.values(state.assignments)) {
    if (assignment.purgedAt || evidenceExpiresAt(state, assignment) > now) continue;
    for (const attempt of [...(assignment.priorAttempts ?? []), ...(assignment.attempt ? [assignment.attempt] : [])]) {
      for (const submission of attempt.submissions ?? []) {
        if (!submission.evidence) continue;
        submission.finding = { category: submission.evidence.category, result: submission.evidence.result };
        delete submission.evidence;
      }
      if (attempt.review) delete attempt.review.reason;
      const lease = state.nativeLeases[attempt.leaseId];
      if (lease?.report) {
        delete lease.report.proof;
        delete lease.report.observations;
      }
    }
    assignment.purgedAt = now;
  }
  for (const record of Object.values(state.campaignExports)) {
    if (record.expiresAt <= now) delete state.campaignExports[record.id];
  }
}
