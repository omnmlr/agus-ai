import { escape } from './views.mjs';

const e = escape;
const options = (values, selected) => values.map(([value, title]) =>
  `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(title)}</option>`).join('');
const kinds = [
  ['phone_human:human_test', 'Attended human test'],
  ['phone_human:human_demonstration', 'Human demonstration'],
  ['phone_human:agent_correction', 'Human correction'],
  ['phone_cooperative:automated_test', 'Cooperative scripted test'],
  ['dedicated_runner:automated_test', 'Dedicated scripted test'],
  ['dedicated_runner:agent_evaluation', 'Dedicated agent evaluation'],
];

export function campaignTask(builds, task = {}) {
  const lane = task.runtimeClass ? task.runtimeClass + ':' + task.kind : kinds[0][0];
  return `<fieldset class="form-stack" data-campaign-task>
    <legend>Coverage task</legend>
    <label class="field">Task title<input name="taskTitle" value="${e(task.title ?? '')}" maxlength="100" required></label>
    <label class="field">Execution lane<select name="lane">${options(kinds, lane)}</select></label>
    <label class="field">Exact build<select name="buildId" required>${options(builds.map(build =>
      [build.id, build.name + ' · ' + build.packageName + ' · ' + build.sha256.slice(0, 12)]), task.buildId)}</select></label>
    <label class="field">Instructions<textarea name="instructions" maxlength="2000" required>${e(task.instructions ?? '')}</textarea></label>
    <label class="field">Coverage slots<input name="count" type="number" min="1" max="12" value="${e(task.count ?? 1)}" required></label>
    <label class="field">Maximum duration in seconds<input name="duration" type="number" min="30" max="600" value="${e(task.maximumDurationSeconds ?? 120)}" required></label>
    <label class="field">Phone minimum API<input name="minimumApi" type="number" min="35" max="100" value="${e(task.minimumApi || 35)}"></label>
    <label class="field">Phone ABI<select name="abi">${options([['', 'Any qualified ABI'], ['arm64-v8a', 'ARM64'], ['x86_64', 'x86-64']], task.abi ?? '')}</select></label>
    <label class="field">Maximum phone RTT in milliseconds<input name="maximumNetworkLatencyMs" type="number" min="10" max="60000" value="${e(task.maximumNetworkLatencyMs ?? '')}"></label>
    <label class="field">Human skill<select name="skill">${options([['human_reproduction', 'Structured reproduction'], ['wallet_fundamentals', 'Wallet fundamentals']], task.skill ?? 'human_reproduction')}</select></label>
    <label class="field">Reference run ID for an agent correction<input name="referenceRunId" value="${e(task.referenceRunId ?? '')}"></label>
    <label class="field">Dedicated scenario<select name="scenario">${options([
      ['app-launch', 'App launch'], ['wallet-connect', 'Wallet connect'], ['wallet-transfer', 'Wallet transfer'],
      ['wallet-false-success', 'Missing broadcast'],
    ], task.scenario ?? 'app-launch')}</select></label>
    <label class="field">Dedicated transfer expectation JSON<textarea name="expectedTransaction" maxlength="800">${e(task.expectedTransaction ? JSON.stringify(task.expectedTransaction) : '')}</textarea></label>
    <label class="field">Nontransferable test units per phone assignment<input name="testUnits" type="number" min="0" max="1000000" value="${e(task.testUnits ?? 0)}" required></label>
    <label class="field">Partial test units after cleaned interruption<input name="stopTestUnits" type="number" min="0" max="1000000" value="${e(task.stopTestUnits ?? 0)}" required></label>
    <label><input type="checkbox" name="training"${task.trainingEligible ? ' checked' : ''}> Permit separate training rights review</label>
    <button type="button" class="button button-outline" data-action="remove-campaign-task">Remove task</button>
  </fieldset>`;
}

function displayBuilder(projects, builds, campaign) {
  if (!projects.length || !builds.length) return '<p class="empty">Create a project and register an APK in Workspace first.</p>';
  const draft = campaign?.revisions.at(-1);
  return `<section class="panel"><h2>${campaign ? 'Revise draft' : 'Create campaign draft'}</h2>
    <form id="campaign-form" class="form-stack">
      <label class="field">Project<select name="projectId">${options(projects.map(project => [project.id, project.name]), draft?.projectId)}</select></label>
      <label class="field">Title<input name="title" required maxlength="100" value="${e(draft?.title ?? '')}"></label>
      <label class="field">Objective<textarea name="objective" maxlength="1000" required>${e(draft?.objective ?? '')}</textarea></label>
      <label class="field">Deadline (local time)<input type="datetime-local" name="deadline" required value="${draft ? e(localDateTime(draft.deadlineAt)) : ''}"></label>
      <label class="field">Campaign budget in test units<input type="number" name="budget" min="0" max="24000000" value="${e(draft?.budgetTestUnits ?? 0)}" required></label>
      <label class="field">Visibility<select name="visibility">${options([['qualified_preview', 'Qualified preview contributors'], ['invited', 'Invited accounts only']], draft?.visibility ?? 'qualified_preview')}</select></label>
      <label class="field">Invited account IDs, comma separated<input name="contributorIds" value="${e(draft?.contributorIds?.join(', ') ?? '')}"></label>
      <label class="field">Evidence retention days<input type="number" name="retention" min="1" max="30" value="${e(draft?.retentionDays ?? 7)}" required></label>
      <div id="campaign-tasks">${(draft?.tasks ?? [{}]).map(task => campaignTask(builds, task)).join('')}</div>
      <div class="actions"><button type="button" class="button button-outline" data-action="add-campaign-task">Add coverage task</button>
      <button type="submit" class="button button-primary">${campaign ? 'Save draft revision' : 'Create draft'}</button></div>
    </form></section>`;
}

function localDateTime(epoch) {
  const date = new Date(epoch);
  return new Date(epoch - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const transition = (action, label) => `<button type="button" class="button button-outline"
  data-action="campaign-transition" data-operation="${action}">${label}</button>`;

function assignmentCard(assignment) {
  const latest = assignment.attempt?.submissions.at(-1);
  const evidence = latest?.evidence;
  const review = assignment.attempt?.review;
  const completeReview = assignment.state === 'submitted' && latest;
  const partialReview = assignment.state === 'interrupted' && assignment.attempt?.cleanup === 'confirmed'
    && assignment.terms.stopTestUnits > 0;
  const reviewForm = completeReview || partialReview ? `<form data-form="campaign-review" class="form-stack"
      data-assignment="${e(assignment.id)}" data-attempt="${e(assignment.attempt.id)}" data-version="${latest?.version ?? 0}">
      <label class="field">Decision<select name="decision">${options(partialReview
        ? [['partial', 'Record disclosed partial test credit']]
        : [['accept', 'Accept work'], ['revise', 'Request revision'], ['reject', 'Reject work']])}</select></label>
      <label class="field">Review reason<input name="reason" required maxlength="400"></label>
      <button type="submit" class="button button-primary">Save review</button></form>` : '';
  return `<section class="panel"><h3>${e(assignment.task.title)} · Slot ${assignment.slot + 1}</h3>
    <p>${e(assignment.task.runtimeClass)} · ${e(assignment.state)}</p>
    ${assignment.run ? `<p><a href="#runs/${e(assignment.run.id)}">Open dedicated run</a> · ${e(assignment.run.evaluationOutcome ?? assignment.run.state)}</p>` : ''}
    ${assignment.attempt ? `<p>Cleanup ${e(assignment.attempt.cleanup ?? 'not due')}</p>` : ''}
    ${evidence ? `<h4>${e(evidence.category)} · ${e(evidence.result)}</h4><ol>${evidence.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol>
      <p>Expected: ${e(evidence.expected)}</p><p>Observed: ${e(evidence.actual)}</p>
      <p>Evidence SHA-256 <code>${e(latest.sha256)}</code></p>` : ''}
    ${review ? `<p>${e(review.decision)} · ${e(review.reason)}</p>` : ''}${reviewForm}
    ${assignment.compensation ? `<p>${assignment.compensation.testUnits} nontransferable test units · ${e(assignment.compensation.state)}</p>` : ''}
    <div class="actions">
    ${assignment.attempt?.evidence ? `<button data-action="campaign-receipt" data-assignment="${e(assignment.id)}" class="button button-outline">Download signed receipt</button>` : ''}
    ${assignment.terms.trainingEligible && assignment.state === 'accepted' ? `
      <button data-action="campaign-training-grant" data-assignment="${e(assignment.id)}" data-terms="${e(assignment.termsDigest)}" class="button button-outline">Grant developer training rights</button>
      <button data-action="campaign-training-withdraw" data-assignment="${e(assignment.id)}" class="button button-outline">Withdraw training rights</button>
      <button data-action="campaign-export" data-assignment="${e(assignment.id)}" class="button button-outline">Download redacted training export</button>` : ''}
    </div></section>`;
}

export function campaignsView({ campaigns, projects = [], builds = [], report, unavailable }) {
  if (unavailable) return '<h1>Campaigns</h1><p class="empty">Campaigns are available in the isolated product preview.</p>';
  const campaign = report?.campaign;
  return `<div class="page-title"><h1>Campaigns</h1><p>Commission qualified testing and review coverage and findings.</p></div>
    <section class="panel"><h2>Campaign list</h2><div class="actions"><a href="#campaigns">New campaign</a></div>
    ${campaigns.length ? `<ul class="data-list">${campaigns.map(entry =>
      `<li><a href="#campaigns/${e(entry.id)}">${e(entry.revisions.at(-1).title)}</a> · ${e(entry.state)}</li>`).join('')}</ul>`
      : '<p class="empty">No campaigns yet.</p>'}</section>
    ${campaign ? `<section class="panel"><h2>${e(campaign.revisions.at(-1).title)}</h2>
      <p>${e(campaign.revisions.at(-1).objective)}</p><p>Revision ${campaign.revision} · ${e(campaign.state)}</p>
      <div class="actions">${campaign.state === 'draft' ? transition('launch', 'Publish reviewed campaign') : ''}
      ${campaign.state === 'active' ? transition('pause', 'Pause new allocations') : campaign.state === 'paused' ? transition('resume', 'Resume allocations') : ''}
      ${['active', 'paused'].includes(campaign.state) ? transition('complete', 'Complete campaign') : ''}
      ${!['cancelled', 'completed'].includes(campaign.state) ? transition('cancel', 'Cancel campaign') : ''}
      <button type="button" class="button button-outline" data-action="retry">Refresh report</button></div>
      <h3>Coverage by task</h3><ul class="data-list">${report.cells.map(cell =>
        `<li>${e(campaign.revisions.at(-1).tasks[cell.taskIndex].title)} · ${cell.measured}/${cell.planned} measured,
          ${cell.accepted} accepted, ${cell.failed} failed, ${cell.blocked} blocked, ${cell.unverified} unverified, ${cell.missing} missing</li>`).join('')}</ul>
      <p>${report.acceptedTestUnits} accepted and ${report.reservedTestUnits} reserved nontransferable test units.</p></section>
      ${report.assignments.map(assignmentCard).join('')}` : ''}
    ${!campaign || campaign.state === 'draft' ? displayBuilder(projects, builds, campaign) : ''}`;
}

export function campaignDraft(form, data) {
  const projectId = data.get('projectId');
  const tasks = [...form.querySelectorAll('[data-campaign-task]')].map(row => {
    const get = name => row.querySelector('[name="' + name + '"]').value;
    const [runtimeClass, kind] = get('lane').split(':');
    const dedicated = runtimeClass === 'dedicated_runner';
    return {
      title: get('taskTitle'), instructions: get('instructions'), buildId: get('buildId'), count: Number(get('count')),
      runtimeClass, kind, maximumDurationSeconds: Number(get('duration')),
      ...(kind === 'agent_correction' && { referenceRunId: get('referenceRunId').trim() }),
      ...(runtimeClass === 'phone_human' && { skill: get('skill') }),
      ...(!dedicated && { minimumApi: Number(get('minimumApi')), ...(get('abi') && { abi: get('abi') }),
        ...(get('maximumNetworkLatencyMs') && { maximumNetworkLatencyMs: Number(get('maximumNetworkLatencyMs')) }),
        testUnits: Number(get('testUnits')), stopTestUnits: Number(get('stopTestUnits')),
        trainingEligible: row.querySelector('[name=training]').checked }),
      ...(dedicated && { scenario: get('scenario'), ...(get('scenario') === 'wallet-transfer' && {
        expectedTransaction: JSON.parse(get('expectedTransaction')),
      }) }),
    };
  });
  if (!tasks.length) throw new Error('Add at least one coverage task.');
  return { projectId, title: data.get('title'), objective: data.get('objective'), tasks, deadlineAt: new Date(data.get('deadline')).getTime(),
    visibility: data.get('visibility'),
    ...(data.get('visibility') === 'invited' && { contributorIds: data.get('contributorIds').split(/[,\s]+/).filter(Boolean) }),
    budgetTestUnits: Number(data.get('budget')), retentionDays: Number(data.get('retention')) };
}
