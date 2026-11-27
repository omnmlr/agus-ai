export const stoppableStates = new Set(['queued', 'reserved', 'preparing', 'running', 'awaiting_approval']);

export const scenarios = {
  'app-launch': 'App launch',
  'wallet-connect': 'Wallet connection',
  'wallet-transfer': 'Wallet transfer',
  'wallet-false-success': 'Wallet false-success check',
};

const scenarioScope = {
  'app-launch': 'Install and launch the exact approved Android build.',
  'wallet-connect': 'Launch the approved build and test authorization with a disposable test wallet.',
  'wallet-transfer': 'Test a transfer through a disposable test wallet and independently check the expected chain effect.',
  'wallet-false-success': 'Check whether a wallet success callback is backed by a matching finalized transaction.',
};

const statusNames = {
  awaiting_funding: 'Awaiting funding', submitted_or_unknown: 'Submitted or unknown', needs_review: 'Needs review',
  queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Failed', cancelled: 'Cancelled', expired: 'Expired',
  unverified: 'Unverified', available: 'Available', busy: 'Busy', offline: 'Offline', funded: 'Funded', settled: 'Settled',
  pending: 'Pending review', reviewed: 'Reviewed', accepted: 'Accepted', declined: 'Declined', revoked: 'Revoked',
  reserved: 'Reserved', stopping: 'Stopping', verifying: 'Verifying', preparing: 'Preparing', awaiting_approval: 'Awaiting approval',
  'runner-signed-claims': 'Runner-signed claims', 'runner-claims-and-solana-rpc': 'Runner claims and independent Solana RPC',
};

const escapings = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => escapings[character]);
const label = (value) => statusNames[value] || String(value ?? 'Unknown').replaceAll('_', ' ');
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function formattedDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? timeFormat.format(time) : 'Unavailable';
}
const date = (value) => escape(formattedDate(value));
const title = (heading, description) => `<div class="page-title"><h1>${escape(heading)}</h1><p>${escape(description)}</p></div>`;
const panel = (heading, content, classes = '') => `<section class="panel ${classes}"><h2>${escape(heading)}</h2>${content}</section>`;
const empty = (message) => `<p class="empty">${escape(message)}</p>`;
const badge = (state) => `<span class="badge badge-${escape(String(state ?? '').replace(/[^a-z_]/g, ''))}">${escape(label(state))}</span>`;
const json = (value) => escape(JSON.stringify(value, null, 2));
const detail = (heading, value) => `<details class="details"><summary>${escape(heading)}</summary><pre>${json(value)}</pre></details>`;
const selectOption = (value, text, isSelected = false) => `<option value="${escape(value)}"${isSelected ? ' selected' : ''}>${escape(text)}</option>`;
const pair = (key, content) => `<div><dt>${escape(key)}</dt><dd>${escape(content ?? 'Unavailable')}</dd></div>`;
const dataList = (items, render, emptyMessage) => items.length ? `<ul class="data-list">${items.map(render).join('')}</ul>` : empty(emptyMessage);
const refresh = (action) => `<button type="button" class="button button-outline" data-action="${action}">Refresh</button>`;

export function account(user) {
  return user ? `<span>${escape(user.email)}</span><button type="button" class="button button-outline" data-action="sign-out">Sign out</button>` : '';
}

export function navigation(page, user) {
  const items = user ? { workspace: 'Workspace', devices: 'Devices', runs: 'Runs', requests: 'Private requests', integrations: 'Integrations' } : { workspace: 'Sign in', integrations: 'Integrations' };
  return Object.entries(items).map(([key, text]) => `<a href="#${key}"${page === key ? ' aria-current="page"' : ''}>${text}</a>`).join('');
}

export function authView(register, fromInvite = false) {
  const heading = register ? 'Create an account' : 'Sign in';
  return `${title(heading, fromInvite ? 'Sign in with the account this private invitation was sent to.' : 'Use your developer account to access projects, enrolled devices, and run evidence.')}
    <section class="panel auth-panel"><form id="auth-form" class="form-stack">
      <label class="field">Email<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
      <label class="field">Password<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}">${register ? '<small>Choose at least 12 characters.</small>' : ''}</label>
      ${register ? '<label class="field">Registration token<input name="registrationToken" maxlength="512" autocomplete="off"><small>Enter a token if your deployment requires one.</small></label>' : ''}
      <button type="submit" class="button button-primary">${heading}</button>
    </form>
    <button type="button" class="button button-outline" data-action="toggle-auth">${register ? 'Use an existing account' : 'Create an account'}</button></section>`;
}

export function workspaceView({ projects, builds }) {
  const projectRows = dataList(projects, (item) => `<li><strong>${escape(item.name)}</strong><p>Created ${date(item.createdAt)}</p></li>`, 'No projects yet. Create your first project to register a build.');
  const buildRows = dataList(builds, (item) => `<li><strong>${escape(item.name)}</strong><p>${escape(projects.find(({ id }) => id === item.projectId)?.name || 'Project')} · ${escape(item.packageName || 'Package not declared')}</p><p class="mono break-all">${escape(item.sha256)}</p></li>`, 'No builds registered. Upload an APK after creating a project.');
  const createProject = `<form id="project-form" class="form-stack"><label class="field">Project name<input name="name" required maxlength="100" autocomplete="off"></label><button type="submit" class="button button-primary">Create project</button></form>`;
  const buildForm = projects.length ? `<form id="build-form" class="form-stack">
    <label class="field">Project<select name="projectId" required>${projects.map((item) => selectOption(item.id, item.name)).join('')}</select></label>
    <label class="field">Build name<input name="name" required maxlength="100" autocomplete="off"></label>
    <label class="field">Android package name<input name="packageName" placeholder="com.example.test" maxlength="200" autocomplete="off" required><small>Use the application ID from the authorized build.</small></label>
    <label class="field">APK file<input name="apk" type="file" accept=".apk,application/vnd.android.package-archive" required><small>Maximum size 25 MiB. The console calculates SHA-256 before upload.</small></label>
    <button type="submit" class="button button-primary">Upload build</button>
  </form>` : empty('Create a project to upload a build.');
  return `${title('Workspace', 'Organize authorized Android builds and prepare a run.')}
    <div class="console-grid"><div>${panel('Projects', projectRows)}${panel('Builds', buildRows)}</div><div>${panel('Create a project', createProject)}${panel('Register a build', buildForm)}</div></div>`;
}

export function devicesView(devices) {
  const deviceRows = dataList(devices, (item) => `<li>
    <div class="data-heading"><strong>${escape(item.label || item.id)}</strong>${badge(item.state)}</div>
    <p>${item.dedicated ? 'Dedicated environment' : 'Dedicated status unavailable'} · Last seen ${date(item.lastSeenAt)}</p>
    ${item.connectivity || item.readiness ? `<p>Connectivity · ${escape(label(item.connectivity))} · Readiness · ${escape(label(item.readiness))}</p>` : ''}
    ${typeof item.publicListing === 'boolean' ? `<p>${item.publicListing ? 'Publicly listed' : 'Private listing'} · ${item.marketplaceEligible ? 'Eligible for marketplace work' : 'Marketplace ineligible'}${item.autoMatch ? ' · Auto-match on' : ''}</p>` : ''}
    <p>Scenarios · ${escape((item.scenarios || []).map((name) => scenarios[name] || name).join(', ') || 'None advertised')}</p>
    ${item.profile ? detail('Reported capabilities', item.profile) : ''}
  </li>`, 'No devices are visible to this account. Use a private invitation to request access to an unlisted device.');
  return `${title('Devices', 'Inspect enrolled environments, supported scenarios, and availability.')}
    <section class="panel"><div class="panel-heading"><h2>Device inventory</h2>${refresh('refresh-devices')}</div>${deviceRows}</section>`;
}

export function buildOptions(builds, projectId) {
  return selectOption('', 'Select a build') + builds.filter((item) => item.projectId === projectId).map((item) => selectOption(item.id, item.name)).join('');
}

export function deviceOptions(devices, scenario, network) {
  return selectOption('', 'Any compatible listed device') + devices.filter((item) => item.marketplaceEligible && item.scenarios?.includes(scenario)
    && (!network || (item.profile?.walletNetwork ?? 'localnet') === network)).map((item) => selectOption(item.id, item.label || item.id)).join('');
}

function transactionFields(visible = false) {
  return `<fieldset data-transaction-fields${visible ? '' : ' disabled hidden'}><legend>Expected transaction</legend>
    <label class="field">Network<select name="network"><option value="devnet">Solana Devnet</option><option value="localnet">Configured Localnet</option></select></label>
    <label class="field">Disposable Devnet test payer<input name="payer" maxlength="44" autocomplete="off"></label>
    <label class="field">Recipient wallet<input name="recipient" required maxlength="44" autocomplete="off"></label>
    <label class="field">Amount in lamports<input name="lamports" type="number" required min="1" max="9007199254740991" step="1"></label>
  </fieldset>`;
}

function evidenceFields(note) {
  return `<fieldset><legend>Requested evidence</legend><label><input type="checkbox" name="screenshots"> Workload screenshots</label><label><input type="checkbox" name="logs"> Workload logs</label><small class="subtle">${escape(note)}</small></fieldset>`;
}

export function runHistory(runs, selected) {
  return dataList(runs, (item) => `<li><div class="data-heading">
    <a href="#runs/${encodeURIComponent(item.id)}"${selected === item.id ? ' aria-current="true"' : ''}><strong>${escape(scenarios[item.scenario] || item.scenario)}</strong></a>${badge(item.state)}
  </div><p>${escape(item.mode === 'agent' ? 'Agent-driven' : 'Scripted')} · ${item.allocation === 'marketplace' ? 'Marketplace · ' : ''}${date(item.createdAt)}</p></li>`, 'No runs yet. Queue a run using an authorized build.');
}

export function runsView({ projects, builds, devices, runs }, selected) {
  const rows = runHistory(runs, selected);
  const runForm = builds.length ? `<form id="run-form" class="form-stack">
    <label class="field">Project<select name="projectId" required>${projects.filter((project) => builds.some((build) => build.projectId === project.id)).map((item) => selectOption(item.id, item.name)).join('')}</select></label>
    <label class="field">Build<select name="buildId" required>${selectOption('', 'Select a build')}</select></label>
    <label class="field">Scenario<select name="scenario" required>${Object.entries(scenarios).map(([key, name]) => selectOption(key, name)).join('')}</select></label>
    <label class="field">Device<select name="deviceId">${deviceOptions(devices, 'app-launch')}</select><small>Use Private requests to propose a session on a particular unlisted device.</small></label>
    <label class="field">Maximum duration in seconds<input name="maximumDurationSeconds" type="number" min="15" max="600" step="1" value="120" required><small>Unpaid marketplace offers require provider acceptance under the device's availability settings.</small></label>
    <label class="field">Execution mode<select name="mode">${selectOption('scripted', 'Scripted')}${selectOption('agent', 'Agent-driven')}</select></label>
    ${transactionFields()}
    <label class="field">Devnet USDC funding wallet (optional)<input name="fundingWallet" maxlength="44" autocomplete="off"><small>Paid Devnet work requires a specific provider device, test payer and verified payout wallet.</small></label>
    ${evidenceFields('Choose which workload attachments the provider may collect.')}
    <button type="submit" class="button button-primary">Post marketplace job</button>
  </form>` : empty('Register a build in Workspace to start a run.');
  return `${title('Runs', 'Allocate a device, follow execution, and inspect verification and settlement.')}
    <div class="console-grid"><div>
      <section class="panel"><div class="panel-heading"><h2>Run history</h2>${refresh('refresh-runs')}</div><div id="run-history">${rows}</div></section>
      <div id="run-detail">${selected ? '<p class="empty">Loading selected run…</p>' : '<p class="empty">Select a run to see its evidence and events.</p>'}</div>
      <div id="run-comparison"></div>
      <div id="payment-detail"></div>
    </div><div>${panel('Offer a marketplace job', runForm)}</div></div>`;
}

const signatureReference = (signature, network) => {
  if (network !== 'devnet' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature || '')) return escape(signature || 'Unavailable');
  return `<a href="https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet" target="_blank" rel="noopener noreferrer">View Devnet transaction</a>`;
};

export function runDetail(run, events) {
  const receipt = run.receipt;
  const verification = run.verification;
  const evidence = receipt?.evidence || receipt?.report?.evidence;
  const transaction = verification?.transaction;
  const stopping = run.state === 'stopping';
  const stopUnconfirmed = run.state === 'expired' && run.stop?.requestedAt && !run.stop?.acknowledgedAt;
  const verificationSummary = verification ? `<dl class="data-pairs run-summary">${pair('Verification scope', label(verification.scope))}${pair('Transaction', label(transaction?.status))}${pair('Duration', duration(verification.durationMs))}${verification.actionMetrics ? `${pair('Completed actions', verification.actionMetrics.actionCount)}${pair('Invalid actions', verification.actionMetrics.invalidActions)}` : ''}</dl>${transaction?.signature ? `<p>Transaction reference · ${signatureReference(transaction.signature, transaction.network)}</p>` : ''}` : '';
  const result = `<div class="panel-heading"><h2>${escape(scenarios[run.scenario] || run.scenario)}</h2>${badge(run.state)}</div>
    <dl class="data-pairs run-summary">${pair('Run ID', run.id)}${pair('Mode', run.mode === 'agent' ? 'Agent-driven' : 'Scripted')}${pair('Allocation', run.allocation === 'marketplace' ? 'Marketplace' : run.invitationId ? 'Private request' : 'Dedicated lab')}${pair('Device', run.deviceId || 'Awaiting allocation')}${pair('Lease', label(run.leaseState))}${pair('Updated', formattedDate(run.updatedAt))}${run.acceptedWork ? `${pair('Work accepted', formattedDate(run.acceptedWork.acceptedAt))}${pair('Accepted payout', run.acceptedWork.payout?.kind === 'unpaid' ? 'Unpaid' : 'See settlement')}` : ''}${run.stop?.requestedAt ? pair('Stop requested', formattedDate(run.stop.requestedAt)) : ''}${run.stop?.acknowledgedAt ? pair(run.leaseState === 'unallocated' ? 'Cancellation confirmed' : 'Stop acknowledged', formattedDate(run.stop.acknowledgedAt)) : ''}</dl>
    ${stoppableStates.has(run.state) ? `<button type="button" class="button button-danger" data-action="cancel-run">${run.state === 'queued' ? 'Cancel queued run' : 'Request stop'}</button>` : ''}
    ${stopping ? '<p class="subtle">Waiting for the runner to confirm stop and cleanup. The device may still be busy.</p>' : ''}
    ${stopUnconfirmed ? '<p class="subtle">Lease expired before stop and cleanup were confirmed. Check the device before using it again.</p>' : ''}
    ${verification ? verificationSummary + detail('Verification details', verification) : '<p class="subtle">Verification awaits a completed report.</p>'}
    ${receipt ? '<p class="subtle">The signed receipt identifies the runner and its execution claims.</p>' + detail('Runner receipt', receipt) : ''}
    ${run.evaluation ? detail('Deterministic evaluation', run.evaluation) : ''}`;
  const evidenceRows = dataList(Array.isArray(evidence) ? evidence : [], (item) => {
    const hash = item?.sha256 || item?.hash;
    const canDownload = /^[0-9a-fA-F]{64}$/.test(hash || '') && Boolean(item?.url || item?.available);
    const name = item.label || item.name || item.kind || 'Evidence';
    const previewLabel = item.kind === 'screenshot' ? 'screenshot' : item.kind === 'log' ? 'log' : null;
    const extension = item.kind === 'screenshot' ? '.png' : item.kind === 'log' ? '.log' : '';
    const filename = extension && !/\.[a-z0-9]+$/i.test(name) ? `${name}${extension}` : name;
    return `<li><div class="data-heading"><strong>${escape(name)}</strong>${canDownload ? `<div class="actions">${previewLabel ? `<button type="button" class="button button-outline" data-action="preview-evidence" data-sha="${hash}" data-kind="${previewLabel}" data-filename="${escape(filename)}">View ${previewLabel}</button>` : ''}<button type="button" class="button button-outline" data-action="download-evidence" data-sha="${hash}" data-filename="${escape(filename)}">Download</button></div>` : ''}</div><p class="mono break-all">${escape(hash || 'Digest unavailable')}</p></li>`;
  }, 'No evidence files are attached to the receipt yet.');
  const eventRows = dataList(events, (event) => `<li><div class="data-heading"><strong>${escape(label(event.type))}</strong><time datetime="${escape(event.at)}">${date(event.at)}</time></div>${event.data && Object.keys(event.data).length ? detail('Event details', event.data) : ''}</li>`, 'No events received yet.');
  return `<section class="panel">${result}</section>${panel('Evidence files', evidenceRows)}${panel('Run events', eventRows)}`;
}

const duration = (milliseconds) => Number.isFinite(milliseconds) ? `${(milliseconds / 1_000).toFixed(2)} s` : 'Unavailable';

export function runComparison(runs, selectedRun) {
  if (selectedRun.mode !== 'agent') return '';
  const peers = runs.filter((run) => run.mode === 'agent' && run.scenario === selectedRun.scenario && run.buildId === selectedRun.buildId && run.verification?.actionMetrics);
  return panel('Compare agent runs', peers.length > 1 ? dataList(peers, (run) => `<li><div class="data-heading"><a href="#runs/${encodeURIComponent(run.id)}">${date(run.createdAt)}</a>${badge(run.state)}</div><p>${duration(run.verification.durationMs)} · ${escape(run.verification.actionMetrics.actionCount)} actions · ${escape(run.verification.actionMetrics.invalidActions)} invalid</p></li>`, '') : empty('Complete at least two agent-driven runs for this build and scenario to compare outcomes.'));
}

export function paymentView(payment, unavailable, run) {
  if (!payment && ['private', 'marketplace'].includes(run?.allocation)) return panel('Payout terms', empty('This workload has unpaid preview terms.'), 'payment-panel');
  if (unavailable) return panel('Devnet settlement', empty(unavailable), 'payment-panel');
  const state = payment?.state;
  const quote = payment?.quote;
  const quoteForm = `<form id="quote-form" class="form-stack"><label class="field">Developer Devnet wallet<input name="developerWallet" required maxlength="44" autocomplete="off"></label><button type="submit" class="button button-primary">Request quote</button></form>`;
  const fundingForm = `<form id="funding-form" class="form-stack"><label class="field">Devnet funding signature<input name="signature" required maxlength="90" autocomplete="off"><small>Submit the finalized transaction signature after funding from the quoted wallet.</small></label><button type="submit" class="button button-primary">Verify funding</button></form>`;
  const quoteSummary = quote ? `<dl class="data-pairs run-summary">${pair('Asset mint', quote.mint)}${pair('Amount', `${quote.amountAtoms} atomic units · ${quote.asset}`)}${pair('Token decimals', quote.decimals)}${pair('Deposit wallet', quote.deposit?.wallet)}${pair('Deposit token account', quote.deposit?.tokenAccount)}${pair('Funding memo', quote.funding?.memo)}${pair('Expires', formattedDate(quote.expiresAt))}</dl>` : '';
  const link = (name, signature) => `<p class="check-line">${name} · ${signatureReference(signature, 'devnet')}</p>`;
  const funding = payment?.funding?.signature ? link('Funding receipt', payment.funding.signature) : '';
  const settlement = payment?.settlement?.signature ? link('Settlement transaction', payment.settlement.signature) : '';
  const eligible = run?.state === 'passed' && run?.receipt?.id && run?.verification?.transaction?.status === 'verified' && run.verification.transaction.network === 'devnet';
  const settleActions = state === 'funded' || state === 'submitted_or_unknown' || state === 'needs_review'
    ? `<div class="actions">${state === 'funded' && eligible ? '<button type="button" class="button button-primary" data-action="settle-run">Request settlement</button>' : ''}<button type="button" class="button button-outline" data-action="reconcile-run">Reconcile</button></div>` : '';
  return panel('Devnet settlement', `${state ? badge(state) : '<p class="subtle">Request a test-token funding quote for this workload.</p>'}${quoteSummary}${funding}${settlement}${!quote ? quoteForm : ''}${state === 'awaiting_funding' ? '<p class="subtle">Use a checked token transfer from the quoted Devnet wallet. Include the exact funding memo in the same transaction.</p>' + fundingForm : ''}${settleActions}`, 'payment-panel');
}

function invitationRole(invitation, user) {
  return invitation.viewerRole || (invitation.requester?.id === user.id ? 'requester' : invitation.recipient?.id === user.id ? 'recipient' : null);
}

export function invitationRows(invitations, user) {
  return dataList(invitations, (invite) => {
    const role = invitationRole(invite, user);
    const counterpart = role === 'requester' ? invite.recipient?.email : invite.requester?.email;
    return `<li><div class="data-heading"><a href="#requests/${encodeURIComponent(invite.id)}"><strong>${escape(scenarios[invite.scenario] || invite.scenario)}</strong></a>${badge(invite.state)}</div><p>${role === 'requester' ? 'Sent to' : 'From'} ${escape(counterpart || 'unknown account')} · Expires ${date(invite.expiresAt)}</p></li>`;
  }, 'No private invitations have been sent or received.');
}

export function requestsView({ projects, builds, invitations }, user, shareUrl) {
  const rows = `<div id="invitation-list">${invitationRows(invitations, user)}</div>`;
  const send = builds.length ? `<form id="request-form" class="form-stack">
    <label class="field">Target device ID<input name="deviceId" required maxlength="120" autocomplete="off"><small>Use the exact device ID its owner supplied. This request does not change public availability.</small></label>
    <label class="field">Project<select name="projectId" required>${projects.filter((project) => builds.some((build) => build.projectId === project.id)).map((item) => selectOption(item.id, item.name)).join('')}</select></label>
    <label class="field">Build<select name="buildId" required>${selectOption('', 'Select a build')}</select></label>
    <label class="field">Scenario<select name="scenario" required>${Object.entries(scenarios).map(([key, name]) => selectOption(key, name)).join('')}</select></label>
    <label class="field">Execution mode<select name="mode"><option value="scripted">Scripted</option><option value="agent">Agent-driven</option></select></label>
    <label class="field">Maximum duration in seconds<input name="maximumDurationSeconds" type="number" min="15" max="600" step="1" value="120" required></label>
    ${transactionFields()}
    ${evidenceFields('Private preview jobs are unpaid. The owner reviews the requested scope before accepting.')}
    <button type="submit" class="button button-primary">Send private request</button>
  </form>` : empty('Register a build in Workspace to send a private request.');
  const share = shareUrl ? panel('Invitation link', `<p>Share this link only with the intended recipient. They must sign in and review the request before accepting.</p><label class="field">Link<input id="private-share-url" value="${escape(shareUrl)}" readonly></label><button type="button" class="button button-outline" data-action="copy-share">Copy link</button>`, 'share-panel') : '';
  const developerId = panel('Account ID', `<p class="subtle">A device provider can address a private share to this account ID.</p><p class="mono break-all">${escape(user.id)}</p>`);
  return `${title('Private requests', 'Review invitations for a particular dedicated device. Acceptance is separate from enrollment and allocation.')}
    <div class="console-grid"><div><section class="panel"><div class="panel-heading"><h2>Invitations</h2>${refresh('refresh-requests')}</div>${rows}</section><div id="invitation-detail"></div>${share}</div><div>${panel('Request a private session', send)}${developerId}</div></div>`;
}

export function invitationLinkView(signedIn) {
  const content = signedIn
    ? '<p>Review the sender, workload, evidence scope, and duration before deciding. A signed-in account must match the intended recipient.</p><div class="actions"><button type="button" class="button button-primary" data-action="review-invite-link">Review invitation</button></div>'
    : '<p>Open the link on an enrolled Android provider device if the app is installed, or sign in below to use the web fallback. Opening a link does not allocate any device.</p><p><a href="./console.html#integrations">Read the device setup</a></p>';
  return `${signedIn ? title('Private device invitation', 'Access is granted through the reviewed workload and an exclusive runner lease.') : ''}${panel(signedIn ? 'Review access' : 'Private device invitation', content)}<div id="invitation-detail"></div>`;
}

export function invitationReview(invite, user, data, reviewed) {
  const role = invitationRole(invite, user);
  const open = ['pending', 'reviewed'].includes(invite.state);
  const recipientCanDecide = open && role === 'recipient';
  const needsBuild = invite.kind === 'provider_share';
  const evidenceList = [invite.evidence?.screenshots ? 'Screenshots' : '', invite.evidence?.logs ? 'Logs' : '', invite.evidence?.trajectory ? 'Trajectory' : ''].filter(Boolean);
  const builds = needsBuild && data?.builds ? data.builds.filter((item) => item.sha256 === invite.buildSha256 && item.packageName === invite.packageName) : [];
  const payout = invite.payout === 'unpaid' ? 'Unpaid' : invite.payout || 'Unavailable';
  const acceptForm = needsBuild && !builds.length ? empty('Register the exact Android package and build hash from this invitation in Workspace, then return to accept it.') : `<form id="invite-accept-form" class="form-stack" data-invite-id="${escape(invite.id)}">
    ${needsBuild ? `<label class="field">Matching build<select name="buildId" required>${builds.map((item) => selectOption(item.id, item.name)).join('')}</select></label>${invite.scenario === 'wallet-transfer' ? transactionFields(true) : ''}` : ''}
    <label class="approval-check"><input name="reviewedTerms" type="checkbox" required> I reviewed the workload, evidence scope, duration, and payout terms.</label>
    <button type="submit" class="button button-primary">Accept invitation</button>
  </form>`;
  const actions = recipientCanDecide ? `${reviewed || invite.state === 'reviewed' ? acceptForm : `<button type="button" class="button button-primary" data-action="review-invite" data-invite-id="${escape(invite.id)}">Review invitation</button>`}<button type="button" class="button button-outline" data-action="decline-invite" data-invite-id="${escape(invite.id)}">Decline</button>`
    : role === 'requester' && (open || invite.state === 'accepted') ? `<button type="button" class="button button-danger" data-action="revoke-invite" data-invite-id="${escape(invite.id)}">Revoke invitation</button>` : '';
  const maySeeRun = invite.kind === 'provider_share' ? role === 'recipient' : role === 'requester';
  return `<section class="panel invitation-review"><div class="panel-heading"><h2>Invitation terms</h2>${badge(invite.state)}</div><dl class="data-pairs run-summary">
    ${pair('Requester', invite.requester?.email)}${pair('Recipient', invite.recipient?.email)}${pair('Device', invite.deviceId)}${pair('Scenario', scenarios[invite.scenario] || invite.scenario)}${pair('Workload scope', scenarioScope[invite.scenario])}${pair('Execution mode', invite.mode === 'agent' ? 'Agent-driven, scoped actions' : 'Scripted')}${pair('Android package', invite.packageName)}${pair('Build SHA-256', invite.buildSha256)}${pair('Maximum duration', `${invite.maximumDurationSeconds} seconds`)}${pair('Evidence', evidenceList.join(', ') || 'No attachments requested')}${pair('Payout', payout)}${pair('Expires', formattedDate(invite.expiresAt))}
  </dl>${invite.runId && maySeeRun ? `<p><a href="#runs/${encodeURIComponent(invite.runId)}">View private run</a></p>` : ''}${actions}</section>`;
}

export function integrationsView() {
  const docs = 'https://github.com/omnmlr/agus-ai';
  return `${title('Integrations', 'Connect a developer client or enroll an authorized Android environment.')}
    ${panel('Hosted API', `<p>Use your deployment origin with <code>/api/v1</code>. Send a developer session token as <code>Authorization: Bearer &lt;token&gt;</code>.</p><h3>Inspect device availability</h3><pre><code>curl --fail-with-body \\
  -H "Authorization: Bearer $AGUS_TOKEN" \\
  "$AGUS_ORIGIN/api/v1/devices"</code></pre><p><a href="${docs}/blob/main/FRONTEND_CONTRACT.md">Read the frontend integration contract</a></p><p><a href="${docs}/blob/main/packages/developer-client/openapi.json">Inspect the OpenAPI contract</a></p>`, 'integration-panel')}
    ${panel('CLI and MCP', `<p>Set <code>AGUS_API_URL</code> and reference a private token file with <code>AGUS_API_TOKEN_FILE</code>. CI and compatible external agents can use the hosted control plane through the developer client.</p><h3>List enrolled devices</h3><pre><code>node packages/developer-client/src/cli.mjs devices</code></pre><h3>Start the hosted-client MCP server over stdio</h3><pre><code>node packages/developer-client/src/cli.mjs mcp</code></pre><p><a href="${docs}/tree/main/packages/developer-client">Configure the hosted developer client</a></p><p><a href="${docs}/blob/main/docs/mobile-test/DEMO.md#mcp-registration">Configure the dedicated local lab</a></p>`, 'integration-panel')}
    ${panel('Provider runner', `<p>Use a dedicated test phone or controlled emulator, an authenticated outbound runner, and approved workloads. Ask your deployment administrator for enrollment access.</p><p><a href="${docs}/tree/main/services/provider-runner">Read the provider runner setup</a></p>`, 'integration-panel')}`;
}
