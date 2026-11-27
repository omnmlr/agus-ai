import { randomUUID } from 'node:crypto';
import { createRun, getOwned, notice, publicRun, requestStop, terminal } from './domain.mjs';
import { refreshLifecycles } from './person-routes.mjs';
import { array, digest, requireCondition, stableJson, string } from './security.mjs';
import { conflict, exact, integer, missing, nativeClasses, own } from './pilot-policy.mjs';
import { expireNativeLease, publicInstallation, stopNativeLease } from './native-runtime.mjs';
import { qualified } from './qualifications.mjs';

const minutes = 60_000;
const classes = [...nativeClasses, 'dedicated_runner'];
const taskKinds = ['automated_test', 'human_test', 'agent_evaluation', 'human_demonstration', 'agent_correction'];
const outcomes = ['passed', 'failed', 'blocked'];
const activeAssignments = ['reserved', 'active', 'stopping'];
const immutableStates = ['accepted', 'cancelled', 'rejected', 'expired', 'interrupted'];

function text(value, field, maximum) {
  const normalized = string(value, field, maximum).trim();
  requireCondition(normalized.length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(normalized),
    'Invalid ' + field);
  return normalized;
}

function normalizeTask(state, user, input, projectId, config) {
  exact(input, ['title', 'kind', 'runtimeClass', 'buildId', 'count', 'instructions', 'maximumDurationSeconds',
    'minimumApi', 'abi', 'skill', 'actions', 'scenario', 'expectedTransaction', 'testUnits', 'trainingEligible'], 'task');
  requireCondition(classes.includes(input.runtimeClass) && taskKinds.includes(input.kind), 'Unsupported assignment class');
  const human = input.runtimeClass === 'phone_human';
  const dedicated = input.runtimeClass === 'dedicated_runner';
  requireCondition(human === ['human_test', 'human_demonstration', 'agent_correction'].includes(input.kind),
    'Task kind does not match the execution class');
  const build = getOwned(state.builds, input.buildId, user, 'Build');
  requireCondition(build.projectId === projectId && build.packageName, 'Build belongs to a different project or lacks a package');
  const skill = input.skill ?? (human ? 'human_reproduction' : null);
  requireCondition((!human && skill === null) || (human && ['human_reproduction', 'wallet_fundamentals'].includes(skill)),
    'Unsupported qualification');
  const abi = input.abi ?? null;
  requireCondition(abi === null || (!dedicated && ['x86_64', 'arm64-v8a'].includes(abi)),
    'Unsupported execution ABI');
  const actions = input.actions ?? (input.runtimeClass === 'phone_cooperative' ? ['describe', 'advance', 'describe'] : []);
  requireCondition(Array.isArray(actions) && actions.length <= 4 && actions.every(action => ['describe', 'advance'].includes(action))
    && (input.runtimeClass === 'phone_cooperative' ? actions.includes('advance') : actions.length === 0),
  'Invalid cooperative action plan');
  const minimumApi = integer(input.minimumApi ?? (dedicated ? 0 : 35), dedicated ? 0 : 35, dedicated ? 0 : 100, 'minimum API');
  const testUnits = integer(input.testUnits ?? 0, 0, dedicated ? 0 : 1_000_000, 'test compensation');
  requireCondition(input.trainingEligible === undefined || typeof input.trainingEligible === 'boolean', 'Invalid training eligibility');
  requireCondition(!(input.trainingEligible && dedicated), 'Dedicated trajectory rights use the legacy run contract');
  const scenario = input.scenario ?? 'app-launch';
  requireCondition(dedicated || (scenario === 'app-launch' && input.expectedTransaction === undefined),
    'Phone preview supports its offline reviewed app activity');
  return {
    title: text(input.title, 'task title', 100), kind: input.kind, runtimeClass: input.runtimeClass,
    buildId: build.id, buildSha256: build.sha256, packageName: build.packageName,
    count: integer(input.count, 1, 12, 'coverage count'), instructions: text(input.instructions, 'instructions', 2_000),
    maximumDurationSeconds: integer(input.maximumDurationSeconds ?? 120, 30, Math.min(900, config.leaseMs / 1000), 'duration'),
    minimumApi, abi, skill, actions, scenario, ...(input.expectedTransaction ? { expectedTransaction: input.expectedTransaction } : {}),
    testUnits, trainingEligible: input.trainingEligible === true, rubric: 'structured-outcome-v1',
  };
}

function revision(state, user, input, config, now) {
  exact(input, ['projectId', 'title', 'objective', 'tasks', 'deadlineAt', 'budgetTestUnits', 'retentionDays'], 'campaign');
  const project = getOwned(state.projects, input.projectId, user, 'Project');
  const tasks = array(input.tasks, 'task list', 12).map(task => normalizeTask(state, user, task, project.id, config));
  const slots = tasks.reduce((count, task) => count + task.count, 0);
  requireCondition(slots > 0 && slots <= 24, 'Choose between one and 24 coverage slots');
  const budget = integer(input.budgetTestUnits ?? 0, 0, 24_000_000, 'campaign budget');
  requireCondition(tasks.reduce((sum, task) => sum + task.count * task.testUnits, 0) <= budget,
    'Coverage terms exceed the test-unit budget');
  const value = {
    projectId: project.id, title: text(input.title, 'campaign title', 100), objective: text(input.objective, 'objective', 1_000),
    deadlineAt: integer(input.deadlineAt, now + minutes, now + 30 * 86_400_000, 'deadline'),
    tasks, budgetTestUnits: budget, retentionDays: integer(input.retentionDays ?? 7, 1, 30, 'retention period'),
  };
  return { ...value, sha256: digest(stableJson(value)) };
}

export function ownCampaign(state, user, id) {
  const campaign = own(state.campaigns, id);
  missing(campaign?.ownerId === user.id, 'Campaign');
  return campaign;
}

const current = campaign => campaign.revisions.at(-1);
export const assignmentTask = (state, assignment) =>
  state.campaigns[assignment.campaignId].revisions[assignment.campaignRevision - 1].tasks[assignment.taskIndex];

export function campaignView(campaign) {
  const { ownerId, ...visible } = campaign;
  return visible;
}

export function saveCampaign(state, user, input, config, now, id = null) {
  if (id === null) {
    conflict(Object.values(state.campaigns).filter(campaign => campaign.ownerId === user.id && !['cancelled', 'completed'].includes(campaign.state)).length < 16,
      'Close an existing campaign before creating another');
    const first = revision(state, user, input, config, now);
    const campaign = { id: randomUUID(), ownerId: user.id, state: 'draft', revision: 1,
      revisions: [first], createdAt: now, updatedAt: now, assignmentIds: [] };
    state.campaigns[campaign.id] = campaign;
    return { campaign: campaignView(campaign) };
  }
  const campaign = ownCampaign(state, user, id);
  exact(input, ['expectedRevision', 'draft'], 'campaign revision');
  conflict(campaign.state === 'draft' && input.expectedRevision === campaign.revision && campaign.revision < 20,
    'Draft revision changed or publication is final', 'revision_conflict');
  const next = revision(state, user, input.draft, config, now);
  requireCondition(next.projectId === current(campaign).projectId, 'Campaign project is immutable');
  campaign.revisions.push(next);
  campaign.revision++;
  campaign.updatedAt = now;
  return { campaign: campaignView(campaign) };
}

export function stopAssignment(state, assignment, reason, now) {
  const lease = own(state.nativeLeases, assignment.attempt?.leaseId);
  if (lease && !lease.cleanup) {
    stopNativeLease(state, lease.id, reason, now);
    assignment.state = 'stopping';
  } else {
    assignment.state = reason === 'deadline' ? 'expired' : 'cancelled';
  }
  if (assignment.runId) {
    const run = state.runs[assignment.runId];
    if (run && !terminal(run.state) && !run.receipt) requestStop(state, run, reason, now);
  }
}

export function refreshCampaigns(state, now) {
  refreshLifecycles(state, now);
  for (const lease of Object.values(state.nativeLeases)) {
    expireNativeLease(state, lease, now);
    const assignment = state.assignments[lease.assignmentId];
    if (lease.state === 'stopping' && assignment?.attempt?.leaseId === lease.id && assignment.state === 'active') {
      assignment.state = 'stopping';
    }
  }
  for (const assignment of Object.values(state.assignments)) {
    if (assignment.state === 'reserved' && assignment.reservationExpiresAt <= now) {
      assignment.priorAttempts.push({ ...assignment.attempt, state: 'reservation_expired' });
      assignment.attempt = null;
      assignment.installationId = null;
      assignment.state = assignment.deadlineAt > now &&
        ['active', 'paused'].includes(state.campaigns[assignment.campaignId].state) ? 'open' : 'expired';
    }
    if (assignment.deadlineAt <= now && ['open', 'reserved', 'active', 'awaiting_submission', 'dedicated'].includes(assignment.state)) {
      stopAssignment(state, assignment, 'deadline', now);
    }
  }
}

export function changeCampaign(state, user, id, action, input, config, now) {
  const campaign = ownCampaign(state, user, id);
  exact(input, ['expectedRevision'], 'campaign transition');
  conflict(input.expectedRevision === campaign.revision, 'Campaign revision changed', 'revision_conflict');
  const draft = current(campaign);
  if (action === 'launch') {
    if (campaign.state === 'active') return { campaign: campaignView(campaign) };
    conflict(campaign.state === 'draft' && draft.deadlineAt > now, 'Campaign is unavailable');
    for (const [taskIndex, task] of draft.tasks.entries()) {
      const dedicated = task.runtimeClass === 'dedicated_runner';
      if (!dedicated) {
        const reviewed = config.pilot.reviewedBuilds.get(task.buildSha256);
        conflict(reviewed?.packageName === task.packageName, 'Phone campaign requires an operator-reviewed build', 'build_not_reviewed');
      }
      for (let slot = 0; slot < task.count; slot++) {
        const id = randomUUID();
        const terms = { campaignId: campaign.id, revision: campaign.revision, taskIndex, slot,
          buildSha256: task.buildSha256, deadlineAt: draft.deadlineAt, maximumDurationSeconds: task.maximumDurationSeconds,
          testUnits: task.testUnits, evidence: 'structured_only', purpose: 'testing', trainingEligible: task.trainingEligible };
        const assignment = {
          id, campaignId: campaign.id, campaignRevision: campaign.revision, ownerId: user.id, taskIndex, slot,
          state: dedicated ? 'dedicated' : 'open', deadlineAt: draft.deadlineAt, attempt: null, priorAttempts: [],
          terms, termsDigest: digest(stableJson(terms)), installationId: null, declines: [],
        };
        if (dedicated) {
          const run = createRun(state, user, {
            projectId: draft.projectId, buildId: task.buildId, scenario: task.scenario,
            mode: task.kind === 'agent_evaluation' ? 'agent' : 'scripted', allocation: 'marketplace',
            maximumDurationSeconds: task.maximumDurationSeconds, expectedTransaction: task.expectedTransaction,
          }, config, now);
          run.campaignDeadlineAt = draft.deadlineAt;
          assignment.runId = run.id;
        }
        state.assignments[id] = assignment;
        campaign.assignmentIds.push(id);
      }
    }
    campaign.state = 'active';
  } else if (action === 'pause' || action === 'resume') {
    conflict(campaign.state === (action === 'pause' ? 'active' : 'paused') && draft.deadlineAt > now,
      'Campaign cannot change participation state');
    campaign.state = action === 'pause' ? 'paused' : 'active';
    for (const assignmentId of campaign.assignmentIds) {
      const assignment = state.assignments[assignmentId];
      if (assignment.runId) state.runs[assignment.runId].campaignPaused = action === 'pause';
      if (action === 'pause' && assignment.state === 'reserved') assignment.reservationExpiresAt = now;
    }
  } else if (action === 'cancel' || action === 'complete') {
    const entries = campaign.assignmentIds.map(assignmentId => state.assignments[assignmentId]);
    if (action === 'cancel') {
      conflict(!['completed', 'cancelled'].includes(campaign.state), 'Campaign is already closed');
      for (const entry of entries) {
        if (!immutableStates.includes(entry.state) && entry.state !== 'submitted') {
          stopAssignment(state, entry, 'campaign_cancelled', now);
        }
      }
      campaign.state = 'cancelled';
    } else {
      conflict(['active', 'paused'].includes(campaign.state) && entries.every(entry =>
        immutableStates.includes(entry.state) || (entry.runId && terminal(state.runs[entry.runId].state))),
      'Close or finish all active coverage slots before completion');
      campaign.state = 'completed';
    }
  } else missing(false, 'Campaign operation');
  campaign.updatedAt = now;
  return { campaign: campaignView(campaign) };
}

function installationFor(state, user, assignment, id, now) {
  const installation = own(state.runtimes, id);
  const task = assignmentTask(state, assignment);
  return installation?.ownerId === user.id && installation.runtimeClass === task.runtimeClass &&
    publicInstallation(installation, now).readiness === 'ready' && installation.policy.apiLevel >= task.minimumApi
    && (!task.abi || installation.policy.abi === task.abi) ? installation : null;
}

function canSeeOffer(state, user, assignment, now) {
  return assignment.state === 'open' && assignment.ownerId !== user.id && !assignment.declines.includes(user.id)
    && assignment.deadlineAt > now && state.campaigns[assignment.campaignId].state === 'active'
    && qualified(state, user.id, assignmentTask(state, assignment).skill, now);
}

function assignmentView(state, assignment, user, now) {
  const task = assignmentTask(state, assignment);
  const mine = assignment.attempt?.contributorId === user.id;
  const owned = assignment.ownerId === user.id;
  const attempt = mine || owned ? assignment.attempt : null;
  const lease = own(state.nativeLeases, attempt?.leaseId);
  const retentionDeadline = assignment.deadlineAt + state.campaigns[assignment.campaignId].revisions[assignment.campaignRevision - 1].retentionDays * 86_400_000;
  const retain = retentionDeadline > now;
  return {
    id: assignment.id, campaignId: assignment.campaignId, campaignRevision: assignment.campaignRevision,
    task, slot: assignment.slot, state: assignment.state, terms: assignment.terms, termsDigest: assignment.termsDigest,
    expiresAt: assignment.reservationExpiresAt ?? assignment.deadlineAt, deadlineAt: assignment.deadlineAt,
    ...(canSeeOffer(state, user, assignment, now) && { eligibleInstallationIds: Object.keys(state.runtimes)
      .filter(id => installationFor(state, user, assignment, id, now)) }),
    ...(attempt && { attempt: { id: attempt.id, startedAt: attempt.startedAt,
      submissions: retain ? attempt.submissions : [], review: retain ? attempt.review : null,
      cleanup: lease?.cleanup ? 'confirmed' : lease ? lease.state : null,
      evidence: retain && lease?.report ? { sha256: lease.report.sha256, outcome: lease.report.outcome,
        evaluation: lease.report.evaluation, provenance: lease.report.provenance } : null,
    } }),
    ...(assignment.runId && owned && { run: publicRun(state.runs[assignment.runId]) }),
    ...(attempt && state.compensation[assignment.id] && { compensation: compensationView(state.compensation[assignment.id]) }),
  };
}

function compensationView({ id, assignmentId, state, testUnits, acceptedAt }) {
  return { id, assignmentId, state, testUnits, acceptedAt };
}

export function listAssignments(state, user, now) {
  return { assignments: Object.values(state.assignments).filter(assignment =>
    assignment.attempt?.contributorId === user.id || canSeeOffer(state, user, assignment, now))
    .slice(-100).map(assignment => assignmentView(state, assignment, user, now)) };
}

export function contributorTransition(state, user, id, action, input, now) {
  const assignment = own(state.assignments, id);
  const mine = assignment?.attempt?.contributorId === user.id;
  missing(assignment && (mine || canSeeOffer(state, user, assignment, now)), 'Assignment');
  if (action === 'accept') {
    exact(input, ['termsDigest', 'installationId', 'consent'], 'assignment acceptance');
    conflict(input.termsDigest === assignment.termsDigest && input.consent === true, 'Review the current testing terms', 'scope_changed');
    if (mine && assignment.state === 'reserved' && assignment.installationId === input.installationId) {
      return { assignment: assignmentView(state, assignment, user, now) };
    }
    conflict(assignment.state === 'open' && canSeeOffer(state, user, assignment, now), 'Assignment is unavailable', 'assignment_unavailable');
    conflict(!Object.values(state.assignments).some(entry => entry.id !== id &&
      activeAssignments.includes(entry.state) && (entry.attempt?.contributorId === user.id || entry.installationId === input.installationId)),
    'Finish the active assignment first', 'active_assignment');
    conflict(installationFor(state, user, assignment, input.installationId, now), 'No matching qualified foreground installation', 'profile_unavailable');
    conflict(!Object.values(state.assignments).some(entry => entry.campaignId === assignment.campaignId &&
      entry.taskIndex === assignment.taskIndex && entry.id !== assignment.id && entry.attempt?.contributorId === user.id
      && !['cancelled', 'expired', 'interrupted'].includes(entry.state)), 'This cohort requires distinct contributors');
    assignment.installationId = input.installationId;
    assignment.attempt = { id: randomUUID(), contributorId: user.id, startedAt: now,
      submissions: [], review: null, consent: { testing: now, contributor: null, developer: null } };
    assignment.state = 'reserved';
    assignment.reservationExpiresAt = Math.min(assignment.deadlineAt, now + 2 * minutes);
  } else if (action === 'decline') {
    exact(input, [], 'decline');
    if (mine) {
      conflict(assignment.state === 'reserved', 'An active assignment must be stopped');
      assignment.priorAttempts.push({ ...assignment.attempt, state: 'declined' });
      assignment.attempt = null;
      assignment.installationId = null;
      assignment.state = 'open';
    }
    conflict(assignment.declines.length < 200, 'Offer response capacity reached');
    if (!assignment.declines.includes(user.id)) assignment.declines.push(user.id);
    return { declined: true };
  } else if (action === 'stop') {
    exact(input, [], 'stop');
    conflict(mine && activeAssignments.includes(assignment.state), 'Assignment has no active attempt');
    stopAssignment(state, assignment, 'owner_stop', now);
  } else missing(false, 'Assignment operation');
  return { assignment: assignmentView(state, assignment, user, now) };
}

function structuredSubmission(task, input) {
  exact(input, ['attemptId', 'expectedVersion', 'steps', 'expected', 'actual', 'result', 'category', 'correction'], 'submission');
  requireCondition(outcomes.includes(input.result), 'Choose a structured result');
  requireCondition(['bug', 'usability', 'validation', 'agent_correction'].includes(input.category), 'Choose a finding category');
  const steps = array(input.steps, 'reproduction steps', 12).map(step => text(step, 'step', 250));
  requireCondition(steps.length > 0, 'Include at least one reproducible step');
  const evidence = { steps, expected: text(input.expected, 'expected outcome', 600),
    actual: text(input.actual, 'observed outcome', 600), result: input.result, category: input.category };
  if (task.kind === 'agent_correction') {
    exact(input.correction, ['actionIndex', 'actualAction', 'suggestedAction'], 'correction');
    const { actionIndex, actualAction, suggestedAction } = input.correction;
    requireCondition(['describe', 'advance'].includes(actualAction) && ['describe', 'advance'].includes(suggestedAction)
      && actualAction !== suggestedAction, 'Correction needs two distinct supported actions');
    evidence.correction = { actionIndex: integer(actionIndex, 0, 3, 'action index'), actualAction, suggestedAction };
  } else requireCondition(input.correction === undefined, 'Correction requires a correction assignment');
  return evidence;
}

export function sendSubmission(state, user, id, input, now) {
  const assignment = own(state.assignments, id);
  missing(assignment?.attempt?.contributorId === user.id, 'Assignment');
  conflict(assignment.attempt.id === input.attemptId && ['awaiting_submission', 'needs_revision'].includes(assignment.state),
    'Assignment must finish profile cleanup before submission', 'cleanup_unconfirmed');
  const campaign = state.campaigns[assignment.campaignId];
  conflict(now <= assignment.deadlineAt && campaign.state !== 'cancelled', 'Submission window closed', 'grant_expired');
  const submissions = assignment.attempt.submissions;
  conflict(submissions.length === input.expectedVersion && submissions.length < 4, 'Submission version changed', 'revision_conflict');
  const evidence = structuredSubmission(assignmentTask(state, assignment), input);
  submissions.push({ version: submissions.length + 1, at: now, sha256: digest(stableJson(evidence)), evidence });
  assignment.state = 'submitted';
  notice(state, assignment.ownerId, 'assignment.submitted', { campaignId: campaign.id, assignmentId: id }, now);
  return { assignment: assignmentView(state, assignment, user, now) };
}

export function reviewSubmission(state, user, id, input, now) {
  const assignment = own(state.assignments, id);
  missing(assignment?.ownerId === user.id, 'Assignment');
  exact(input, ['attemptId', 'version', 'decision', 'reason'], 'review');
  requireCondition(['accept', 'revise', 'reject'].includes(input.decision), 'Unknown review action');
  const attempt = assignment.attempt;
  const latest = attempt?.submissions.at(-1);
  conflict(assignment.state === 'submitted' && attempt?.contributorId !== user.id && attempt?.id === input.attemptId
    && latest?.version === input.version, 'Submission is no longer reviewable', 'revision_conflict');
  conflict(input.decision !== 'revise' || (latest.version < 4 && now < assignment.deadlineAt
    && state.campaigns[assignment.campaignId].state !== 'cancelled'), 'Revision window is closed');
  attempt.review = { submissionVersion: latest.version, at: now, decision: input.decision,
    reason: text(input.reason, 'review reason', 400) };
  assignment.state = { accept: 'accepted', revise: 'needs_revision', reject: 'rejected' }[input.decision];
  if (input.decision === 'accept') {
    conflict(!state.compensation[id], 'Work was already accepted');
    state.compensation[id] = { id: randomUUID(), assignmentId: id, contributorId: attempt.contributorId,
      testUnits: assignment.terms.testUnits, termsDigest: assignment.termsDigest, acceptedAt: now,
      state: assignment.terms.testUnits ? 'test_obligation_recorded' : 'unpaid_accepted' };
  }
  notice(state, attempt.contributorId, 'assignment.reviewed', { assignmentId: id, decision: input.decision }, now);
  return { assignment: assignmentView(state, assignment, user, now) };
}

export function campaignReport(state, user, id, now) {
  const campaign = ownCampaign(state, user, id);
  const entries = campaign.assignmentIds.map(assignmentId => state.assignments[assignmentId]);
  const cells = current(campaign).tasks.map((task, taskIndex) => {
    const eligible = entries.filter(assignment => assignment.taskIndex === taskIndex);
    const evidence = eligible.map(assignment => {
      if (assignment.runId) return state.runs[assignment.runId].evaluationOutcome ?? null;
      const lease = own(state.nativeLeases, assignment.attempt?.leaseId);
      return task.runtimeClass === 'phone_human'
        ? assignment.state === 'accepted' ? assignment.attempt?.submissions.at(-1)?.evidence.result ?? null : null
        : lease?.report?.evaluation ?? null;
    });
    return { taskIndex, kind: task.kind, runtimeClass: task.runtimeClass, planned: task.count,
      attempted: eligible.filter(entry => entry.attempt || (entry.runId && state.runs[entry.runId]?.startedAt)).length,
      accepted: eligible.filter(entry => entry.state === 'accepted').length,
      measured: evidence.filter(value => value !== null).length, passed: evidence.filter(value => value === 'passed').length,
      failed: evidence.filter(value => value === 'failed').length, blocked: evidence.filter(value => value === 'blocked').length,
      unverified: evidence.filter(value => value === 'unverified').length,
      missing: task.count - evidence.filter(value => value !== null).length,
    };
  });
  return { report: { campaign: campaignView(campaign), cells,
    reservedTestUnits: entries.filter(entry => !immutableStates.includes(entry.state)).reduce((sum, entry) => sum + entry.terms.testUnits, 0),
    acceptedTestUnits: entries.reduce((sum, entry) => sum + (state.compensation[entry.id]?.testUnits ?? 0), 0),
    assignments: entries.map(entry => assignmentView(state, entry, user, now)) } };
}
