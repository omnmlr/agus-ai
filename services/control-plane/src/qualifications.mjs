import { randomUUID } from 'node:crypto';
import { requireCondition, string } from './security.mjs';
import { conflict, exact } from './pilot-policy.mjs';

const validityMs = 30 * 86_400_000;
const rubric = 'duplicate-onboarding-v1';
const exercise = {
  version: rubric,
  reproduction: 'The test fixture accepts Continue, returns to the review screen, and accepts Continue again. Report what should have happened and what you observed.',
  wallet: 'A test wallet returned a signature and the app marked the action complete. What evidence establishes the approved transaction effects?',
};

export function qualificationView(state, user, now) {
  const records = state.qualifications[user.id] ?? [];
  const current = records.at(-1) ?? null;
  const past = Object.values(state.assignments)
    .flatMap(assignment => [...(assignment.priorAttempts ?? []), ...(assignment.attempt ? [assignment.attempt] : [])])
    .filter(attempt => attempt.contributorId === user.id && attempt.submissions?.length);
  return { exercise, current, skills: skillsFor(current, now), history: records.slice(-5), reliability: {
    submissions: past.length, accepted: past.filter(attempt => attempt.review?.decision === 'accept').length,
    adjudicated: past.filter(attempt => ['accept', 'reject'].includes(attempt.review?.decision)).length,
  } };
}

function skillsFor(record, now) {
  return record?.validUntil > now ? record.skills : [];
}

export function qualified(state, userId, skill, now) {
  return skill === null || skillsFor(state.qualifications[userId]?.at(-1), now).includes(skill);
}

export function submitQualification(state, user, version, input, now) {
  exact(input, ['sequence', 'expectedCode', 'actualCode', 'walletAnswer', 'evidenceNote'], 'qualification answers');
  requireCondition(version === rubric, 'Unknown qualification exercise');
  requireCondition(Array.isArray(input.sequence) && input.sequence.length <= 5
    && input.sequence.every(value => ['continue', 'review', 'back', 'submit'].includes(value)), 'Invalid reproduction');
  requireCondition(['single_continue', 'no_action', 'multiple_continue'].includes(input.expectedCode)
    && ['single_continue', 'no_action', 'multiple_continue'].includes(input.actualCode), 'Invalid observed result');
  requireCondition(['finalized_effects', 'wallet_callback', 'screen_message', 'skip'].includes(input.walletAnswer),
    'Invalid wallet answer');
  const note = string(input.evidenceNote, 'evidence note', 280, 12).trim();
  requireCondition(note.length >= 12, 'Describe a redacted and reproducible finding');
  const records = state.qualifications[user.id] ??= [];
  conflict(!records.at(-1) || now - records.at(-1).submittedAt >= 10_000, 'Wait before retrying the exercise');
  const reproduced = input.sequence.join(',') === 'continue,review,continue'
    && input.expectedCode === 'single_continue' && input.actualCode === 'multiple_continue';
  const skills = reproduced ? ['human_reproduction'] : [];
  if (reproduced && input.walletAnswer === 'finalized_effects') skills.push('wallet_fundamentals');
  const record = {
    id: randomUUID(), version: rubric, submittedAt: now, validUntil: now + validityMs, skills,
    status: reproduced ? 'passed' : 'remediation',
    feedback: reproduced ? 'The sequence and expected versus actual outcomes match the exercise.'
      : 'Retest and explicitly distinguish the reported duplicate action from the expected single action.',
    appeal: null,
  };
  records.push(record);
  if (records.length > 10) records.shift();
  return qualificationView(state, user, now);
}

export function appealQualification(state, user, id, input, now) {
  exact(input, ['reason'], 'appeal');
  const record = state.qualifications[user.id]?.find(entry => entry.id === id);
  conflict(record?.status === 'remediation' && !record.appeal, 'This exercise is ineligible for appeal');
  record.appeal = { reason: string(input.reason, 'appeal reason', 400), submittedAt: now, state: 'pending_review' };
  return qualificationView(state, user, now);
}
