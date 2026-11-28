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
  completed: 'Completed', pending: 'Pending review', reviewed: 'Reviewed', accepted: 'Accepted', declined: 'Declined', revoked: 'Revoked',
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

const menu = {
  workspace: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', 'Overview'],
  projects: ['M3 7h6l2 2h10v10H3z', 'Projects'],
  reports: ['M6 3h8l4 4v14H6zM9 11h6M9 15h6', 'Reports and evidence'],
  funding: ['M3 7h18v10H3zM15 12h3M6 12h3', 'Funding and settlement'],
  builds: ['M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4', 'Builds'],
  runs: ['M8 5l12 7-12 7z', 'Executions'],
  campaigns: ['M12 3l9 9-9 9-9-9zM8 12h8M12 8v8', 'Campaigns'],
  devices: ['M7 3h10v18H7zM10 17h4', 'Devices'],
  requests: ['M5 12h14M14 7l5 5-5 5', 'Private access'],
  inbox: ['M4 4h16v16H4zM4 13h5l2 3h2l2-3h5', 'Inbox'],
  settings: ['M4 7h16M4 17h16M9 4v6M15 14v6', 'Settings'],
  integrations: ['M8 5L3 12l5 7M16 5l5 7-5 7', 'Integrations'],
};

export function navigation(page, user) {
  if (!user) return '';
  const groups = [
    ['Workspace', ['workspace', 'projects', 'builds', 'campaigns', 'runs']],
    ['Results', ['reports']],
    ['Manage', ['devices', 'requests', 'funding', 'inbox', 'settings', 'integrations']],
  ];
  return groups.map(([name, keys]) => `<div class="nav-group"><p>${name}</p>${keys.map(key => {
    const [icon, label] = menu[key];
    return `<a href="#${key}"${page === key ? ' aria-current="page"' : ''}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="${icon}"/></svg>${label}</a>`;
  }).join('')}</div>`).join('');
}

export function authView(register, fromInvite = false) {
  const heading = register ? 'Create an account' : 'Sign in to AGUS AI';
  return `<div class="auth-layout">
    <div class="auth-intro">
      <div class="auth-insignia" aria-hidden="true"><img src="/assets/orbital-ghost.webp" width="700" height="700" alt=""></div>
      <p class="auth-brand"><img src="/assets/brand-wordmark-dark.svg" width="74" height="14" alt="AGUS AI"> Developer console</p>
      <h1>From build<br>to evidence.</h1>
      <p>Register your Android builds, commission testing, and review the execution record in one workspace.</p>
      <a href="/docs/quickstart">Read the quickstart</a>
    </div>
    <section class="auth-panel" aria-labelledby="auth-title">
      <h2 id="auth-title">${heading}</h2>
      <p>${fromInvite ? 'Use the account that received this private invitation.' : 'Access your developer workspace.'}</p>
      <form id="google-start-form" class="form-stack">
        <button type="submit" class="button button-outline google-button"><img src="/assets/google-g.png" alt="" width="17" height="17"> Continue with Google</button>
        <details class="auth-invite"><summary>Have a registration token?</summary><label class="field">Registration token<input name="registrationToken" maxlength="512" autocomplete="off" spellcheck="false"></label></details>
      </form>
      <div class="auth-divider"><span>or use your email</span></div>
      <form id="auth-form" class="form-stack">
        <label class="field">Email<input name="email" type="email" required maxlength="254" autocomplete="email" spellcheck="false"></label>
        <label class="field">Password<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}">${register ? '<small>Choose at least 12 characters.</small>' : ''}</label>
        ${register ? '<label class="field">Registration token<input name="registrationToken" maxlength="512" autocomplete="off" spellcheck="false"><small>Enter the token supplied by your preview coordinator if required.</small></label>' : ''}
        <button type="submit" class="button button-primary">${register ? 'Create an account' : 'Sign in'}</button>
      </form>
      <details class="email-auth">
        <summary>Use a one-time email code</summary>
        <form id="otp-start-form" class="form-stack">
          <label class="field">Email<input name="email" type="email" required autocomplete="email" spellcheck="false"></label>
          <label class="field">Registration token if needed<input name="registrationToken" maxlength="512" spellcheck="false"></label>
          <button type="submit" class="button button-outline">Send email code</button>
        </form>
        <form id="otp-verify-form" class="form-stack">
          <label class="field">Email<input name="email" type="email" required autocomplete="email" spellcheck="false"></label>
          <label class="field">Email code<input name="code" required inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"></label>
          <button type="submit" class="button button-outline">Verify email code</button>
        </form>
      </details>
      <button type="button" class="auth-toggle" data-action="toggle-auth">${register ? 'Use an existing account' : 'Create an account'}</button>
      <p class="auth-legal"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></p>
    </section>
  </div>`;
}

function resourceTable(headings, rows) {
  return `<div class="table-scroll" tabindex="0" aria-label="${escape(headings[0])} table"><table>
    <thead><tr>${headings.map(heading => `<th scope="col">${escape(heading)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([name, ...values]) => `<tr><th scope="row">${name}</th>${values.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function workspaceView({ projects, builds, runs = [], campaigns = [], campaignsUnavailable }, buildsOnly = false) {
  const projectRows = projects.length ? resourceTable(['Project', 'Builds', 'Created'], projects.map(item =>
    [`<a href="#projects/${encodeURIComponent(item.id)}">${escape(item.name)}</a>`, builds.filter(build => build.projectId === item.id).length, date(item.createdAt)]))
    : empty('Your projects will appear here.');
  const buildRows = builds.length ? resourceTable(['Build', 'Android package', 'SHA-256'], builds.map(item => [
    `${escape(item.name)}<small>${escape(projects.find(project => project.id === item.projectId)?.name ?? 'Project')}</small>`,
    escape(item.packageName || 'Unavailable'), `<code class="break-all">${escape(item.sha256)}</code><button class="button button-outline digest-copy" type="button" data-action="copy-digest" data-digest="${escape(item.sha256)}">Copy digest</button>`,
  ])) : empty('Uploaded APKs will appear here.');
  const createProject = `<form id="project-form" class="form-stack"><label class="field">Project name<input name="name" required maxlength="100" autocomplete="off"></label><button type="submit" class="button button-primary">Create project</button></form>`;
  const buildForm = projects.length ? `<form id="build-form" class="form-stack">
    <label class="field">Project<select name="projectId" required>${projects.map(item => selectOption(item.id, item.name)).join('')}</select></label>
    <label class="field">Build name<input name="name" required maxlength="100" autocomplete="off"></label>
    <label class="field">Android package name<input name="packageName" placeholder="com.example.test" maxlength="200" autocomplete="off" required spellcheck="false"></label>
    <label class="field">APK file<input name="apk" type="file" accept=".apk,application/vnd.android.package-archive" required><small>Up to 25 MiB. AGUS AI checks the APK’s SHA-256 digest.</small><small data-build-selection aria-live="polite"></small></label>
    <button type="submit" class="button button-primary">Upload build</button>
  </form>` : '<p class="empty">Create a project in the <a href="#workspace">workspace overview</a> before uploading an APK.</p>';
  if (buildsOnly) return `${title('Builds', 'Register and inspect exact Android application builds.')}
    <div class="console-grid"><div>${panel('Registered APKs', buildRows)}</div><div>${panel('Upload an APK', buildForm)}</div></div>`;
  const onboarding = !builds.length ? `<div class="onboarding"><div><h2>${projects.length ? 'Register a build to start testing.' : 'Create your first project.'}</h2>
    <p>${projects.length ? 'Choose an authorized Android build and enter its package name.' : 'Projects organize the application builds, tests, and campaigns you commission.'}</p></div>
    <a class="button button-outline" href="/docs/quickstart">Read the quickstart</a></div>` : '';
  return `${title('Workspace overview', 'Manage projects and Android builds for your team’s test work.')}${onboarding}
    <div class="console-grid"><div>${panel('Projects', projectRows)}${builds.length ? panel('Registered APKs', buildRows) : ''}
    ${runs.length ? panel('Recent executions', runHistory(runs.slice(0,4))) : ''}
    ${!campaignsUnavailable && campaigns.length ? panel('Recent campaigns', campaignListing(campaigns.slice(0,4))) : ''}</div>
    <div>${panel('Create a project', createProject)}${projects.length ? panel('Upload an APK', buildForm) : ''}</div></div>`;
}

function campaignListing(campaigns) {
  return dataList(campaigns, campaign => `<li><div class="data-heading"><a href="#campaigns/${encodeURIComponent(campaign.id)}">${escape(campaign.revisions.at(-1).title)}</a>${badge(campaign.state)}</div></li>`, 'Campaigns appear here after you create a draft.');
}

export function projectsView({ projects, builds, runs }, selected) {
  if (!selected) return `${title('Projects', 'Find the Android builds and execution records for each project.')}
    ${projects.length ? panel('Owned projects', resourceTable(['Project','Builds', 'Executions'], projects.map(project => [
      `<a href="#projects/${encodeURIComponent(project.id)}">${escape(project.name)}</a>`,
      builds.filter(build => build.projectId === project.id).length, runs.filter(run => run.projectId === project.id).length,
    ]))) : empty('Create your first project from the workspace overview.')}
    <p><a class="button button-primary" href="#workspace">Create a project</a></p>`;
  const project = projects.find(item => item.id === selected);
  if (!project) return `${title('Project unavailable', 'This project could not be opened.')}<a href="#projects">Back to projects</a>`;
  const ownedBuilds = builds.filter(build => build.projectId === project.id);
  return `<a class="back-link" href="#projects">Back to projects</a>${title(project.name, 'Application builds and execution history.')}
    <div class="actions project-actions"><a class="button button-primary" href="#builds">Upload a build</a><a class="button button-outline" href="#runs">New execution</a></div>
    ${panel('Application builds', dataList(ownedBuilds, build => `<li><strong>${escape(build.name)}</strong><p>${escape(build.packageName)}</p><code class="break-all">${escape(build.sha256)}</code></li>`, 'Register a build to use this project.'))}
    ${panel('Executions', runHistory(runs.filter(run => run.projectId === project.id)))}`;
}

export function resultsView({ runs, campaigns, campaignsUnavailable }, funding = false) {
  if (funding) return `${title('Funding and settlement', 'Open a funded campaign or eligible run to review its payment state.')}
    ${panel('Campaign funding', campaignsUnavailable ? empty('Campaign funding is unavailable for this account or environment.') :
      campaignListing(campaigns.filter(campaign => campaign.fundingState || campaign.revisions.at(-1).fundingAmountAtoms)))}
    ${panel('Devnet executions', runHistory(runs.filter(run => run.paymentTerms?.kind === 'devnet')))}`;
  return `${title('Reports and evidence', 'Review campaign findings or inspect evidence in an execution record.')}
    ${panel('Campaign reports', campaignsUnavailable ? empty('Campaign reports are unavailable for this account or environment.') : campaignListing(campaigns))}
    ${panel('Executions with a receipt', runHistory(runs.filter(run => run.receipt)))}`;
}

export function settingsView({ user, preferences }) {
  return `${title('Settings', 'Manage your developer profile and optional notifications.')}
    <div class="console-grid"><div>${panel('Profile', `<form id="profile-form" class="form-stack">
      <label class="field">Email<input readonly type="email" value="${escape(user.email)}"></label>
      <label class="field">Display name<input required name="displayName" maxlength="80" autocomplete="name" value="${escape(user.displayName ?? '')}"></label>
      <button class="button button-primary" type="submit">Save profile</button></form>`)}</div>
    <div>${panel('Inbox preferences', `<form id="preferences-form" class="form-stack">
      <p class="subtle">Required safety messages remain available.</p>
      <label><input type="checkbox" name="completedRuns"${preferences.completedRuns ? ' checked' : ''}> Completed test runs</label>
      <label><input type="checkbox" name="campaignUpdates"${preferences.campaignUpdates ? ' checked' : ''}> Campaign updates</label>
      <button class="button button-primary" type="submit">Save preferences</button>
    </form>`)}${panel('Privacy', '<p>Review training consent on eligible executions and campaign assignments. See the <a href="/privacy">Privacy Policy</a> for account data requests.</p>')}</div></div>`;
}

export function inboxView(notifications) {
  const rows = dataList(notifications, entry => `<li><div class="data-heading"><strong>${escape(label(entry.type).replaceAll('-', ' '))}</strong><time>${date(entry.createdAt)}</time></div>
    ${entry.readAt ? '<p>Read</p>' : `<button type="button" class="button button-outline" data-action="read-notification" data-notification="${escape(entry.id)}">Mark as read</button>`}</li>`, 'Updates about your runs and work will appear here.');
  return `${title('Inbox', 'Follow operational updates for your account.')}${panel('Notifications', rows)}`;
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
  return `<fieldset><legend>Requested evidence</legend><label><input type="checkbox" name="screenshots"> Workload screenshots</label><label><input type="checkbox" name="logs"> Workload logs</label><label hidden><input type="checkbox" name="trajectory" disabled> Allow collection of a scoped action trajectory</label><small class="subtle">${escape(note)}</small></fieldset>`;
}

export function runHistory(runs, selected, { query = '', status = '' } = {}) {
  const search = query.trim().toLowerCase();
  const filtered = runs.filter(run => (!status || [run.state, run.executionState].includes(status)) &&
    [run.id, run.scenario, scenarios[run.scenario], run.mode, run.buildId].some(value => String(value ?? '').toLowerCase().includes(search)));
  return filtered.length ? resourceTable(['Scenario', 'State', 'Created'], filtered.map(item => [
    `<a href="#runs/${encodeURIComponent(item.id)}"${selected === item.id ? ' aria-current="true"' : ''}>${escape(scenarios[item.scenario] || item.scenario)}</a><small>${item.mode === 'agent' ? 'Agent-driven' : 'Scripted'}</small>`,
    badge(item.state), date(item.createdAt),
  ])) : empty(runs.length ? 'No runs match these filters.' : 'No runs yet. Queue a run using an authorized build.');
}

export function runsView({ projects, builds, devices, runs }, selected) {
  const rows = runHistory(runs, selected);
  const runForm = builds.length ? `<form id="run-form" class="form-stack">
    <label class="field">Project<select name="projectId" required>${projects.filter((project) => builds.some((build) => build.projectId === project.id)).map((item) => selectOption(item.id, item.name)).join('')}</select></label>
    <label class="field">Build<select name="buildId" required>${selectOption('', 'Select a build')}</select></label>
    <label class="field">Scenario<select name="scenario" required>${Object.entries(scenarios).map(([key, name]) => selectOption(key, name)).join('')}</select></label>
    <label class="field">Device<select name="deviceId">${deviceOptions(devices, 'app-launch')}</select><small>Use Private access to propose a session on a particular unlisted device.</small></label>
    <label class="field">Maximum duration in seconds<input name="maximumDurationSeconds" type="number" min="15" max="600" step="1" value="120" required><small>Unpaid marketplace offers require provider acceptance under the device's availability settings.</small></label>
    <label class="field">Execution mode<select name="mode">${selectOption('scripted', 'Scripted')}${selectOption('agent', 'Agent-driven')}</select></label>
    ${transactionFields()}
    <label class="field">Devnet USDC funding wallet (optional)<input name="fundingWallet" maxlength="44" autocomplete="off"><small>Paid Devnet work requires a specific provider device, test payer and verified payout wallet.</small></label>
    ${evidenceFields('Choose which workload attachments the provider may collect.')}
    <button type="submit" class="button button-primary">Post marketplace job</button>
  </form>` : empty('Register a build in Builds to start a run.');
  const history = `<section class="panel"><div class="panel-heading"><h2>Run history</h2>${refresh('refresh-runs')}</div>
    ${runs.length ? `<div class="run-filters"><label class="field">Search runs<input type="search" id="run-search" placeholder="Scenario or run ID" autocomplete="off"></label>
    <label class="field">Execution state<select id="run-status">${selectOption('', 'All states')}${['queued', 'reserved', 'running', 'stopping', 'verifying', 'completed', 'failed', 'expired', 'cancelled'].map(state => selectOption(state, label(state))).join('')}</select></label></div>` : ''}
    <div id="run-history">${rows}</div></section>`;
  return selected ? `${title('Test run', 'Inspect execution, evaluation, and evidence.')}
    <a class="back-link" href="#runs">Back to all executions</a><div class="console-grid run-detail-layout"><div><div id="run-detail"><p class="empty">Loading selected run…</p></div>
    <div id="run-comparison"></div></div><div>${history}<div id="payment-detail"></div></div></div>`
    : `${title('Test runs', 'Allocate a device, follow execution, and inspect verification and settlement.')}
    <div class="console-grid"><div>${history}</div><div>${panel('Offer a marketplace job', runForm)}</div></div>`;
}

const signatureReference = (signature, network) => {
  if (network !== 'devnet' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature || '')) return escape(signature || 'Unavailable');
  return `<a href="https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet" target="_blank" rel="noopener noreferrer">View Devnet transaction</a>`;
};

export function runDetail(run, events, runActions = [], consent) {
  const receipt = run.receipt;
  const verification = run.verification;
  const evidence = receipt?.evidence || receipt?.report?.evidence;
  const transaction = verification?.transaction;
  const stopping = run.state === 'stopping';
  const stopUnconfirmed = run.state === 'expired' && run.stop?.requestedAt && !run.stop?.acknowledgedAt;
  const verificationSummary = verification ? `<dl class="data-pairs run-summary">${pair('Verification scope', label(verification.scope))}${pair('Transaction', label(transaction?.status))}${pair('Duration', duration(verification.durationMs))}${verification.actionMetrics ? `${pair('Completed actions', verification.actionMetrics.actionCount)}${pair('Invalid actions', verification.actionMetrics.invalidActions)}` : ''}</dl>${transaction?.signature ? `<p>Transaction reference · ${signatureReference(transaction.signature, transaction.network)}</p>` : ''}` : '';
  const report = receipt?.manifest;
  const signedReceipt = receipt ? `<section class="panel receipt-panel"><div class="panel-heading"><h2>Signed runner receipt</h2>
    <button type="button" class="button button-outline" data-action="download-run-receipt">Download JSON</button></div>
    <dl class="data-pairs run-summary">${pair('Receipt ID', receipt.id)}${pair('Manifest SHA-256', receipt.manifestSha256)}
    ${pair('Issuer runner', receipt.issuer)}${pair('Public key', receipt.publicKeyPem)}${pair('Build SHA-256', report?.buildSha256)}
    ${report?.execution?.planner ? pair('Planner', report.execution.planner) : ''}${report?.execution?.modelId ? pair('Model', report.execution.modelId) : ''}</dl>${detail('Raw signed receipt', receipt)}</section>` : '';
  const result = `<div class="panel-heading"><h2>${escape(scenarios[run.scenario] || run.scenario)}</h2>${badge(run.state)}</div>
    <dl class="data-pairs run-summary">${pair('Run ID', run.id)}${pair('Project ID', run.projectId)}${pair('Build ID', run.buildId)}${pair('Execution', label(run.executionState))}${pair('Evaluation', label(run.evaluationOutcome))}${pair('Mode', run.mode === 'agent' ? 'Agent-driven' : 'Scripted')}${pair('Allocation', run.allocation === 'marketplace' ? 'Marketplace' : run.invitationId ? 'Private request' : 'Dedicated lab')}${pair('Device', run.deviceId || 'Awaiting allocation')}${pair('Lease', label(run.leaseState))}${pair('Updated', formattedDate(run.updatedAt))}${run.acceptedWork ? `${pair('Work accepted', formattedDate(run.acceptedWork.acceptedAt))}${pair('Accepted payout', run.acceptedWork.payout?.kind === 'unpaid' ? 'Unpaid' : 'See settlement')}` : ''}${run.stop?.requestedAt ? pair('Stop requested', formattedDate(run.stop.requestedAt)) : ''}${run.stop?.acknowledgedAt ? pair(run.leaseState === 'unallocated' ? 'Cancellation confirmed' : 'Stop acknowledged', formattedDate(run.stop.acknowledgedAt)) : ''}</dl>
    ${stoppableStates.has(run.state) ? `<button type="button" class="button button-danger" data-action="cancel-run">${run.state === 'queued' ? 'Cancel queued run' : 'Request stop'}</button>` : ''}
    ${receipt && ['verifying', 'unverified'].includes(run.state) ? '<button type="button" class="button button-outline" data-action="verify-run">Retry verification</button>' : ''}
    ${stopping ? '<p class="subtle">Waiting for the runner to confirm stop and cleanup. The device may still be busy.</p>' : ''}
    ${stopUnconfirmed ? '<p class="subtle">Lease expired before stop and cleanup were confirmed. Check the device before using it again.</p>' : ''}
    ${verification ? verificationSummary + detail('Verification details', verification) : '<p class="subtle">Verification awaits a completed report.</p>'}
    ${run.evaluation ? detail('Scenario evaluation', run.evaluation) : ''}`;
  const evidenceRows = dataList(Array.isArray(evidence) ? evidence : [], (item) => {
    const hash = item?.sha256 || item?.hash;
    const canDownload = /^[0-9a-fA-F]{64}$/.test(hash || '') && Boolean(item?.url || item?.available);
    const name = item.label || item.name || item.kind || 'Evidence';
    const previewLabel = item.kind === 'screenshot' ? 'screenshot' : item.kind === 'log' ? 'log' : null;
    const extension = item.kind === 'screenshot' ? '.png' : item.kind === 'log' ? '.log' : '';
    const filename = extension && !/\.[a-z0-9]+$/i.test(name) ? `${name}${extension}` : name;
    return `<li><div class="data-heading"><strong>${escape(name)}</strong>${canDownload ? `<div class="actions">${previewLabel ? `<button type="button" class="button button-outline" data-action="preview-evidence" aria-expanded="false" data-sha="${hash}" data-kind="${previewLabel}" data-filename="${escape(filename)}">View ${previewLabel}</button>` : ''}<button type="button" class="button button-outline" data-action="download-evidence" data-sha="${hash}" data-filename="${escape(filename)}">Download</button></div>` : ''}</div><p class="mono break-all">${escape(hash || 'Digest unavailable')}</p></li>`;
  }, 'No evidence files are attached to the receipt yet.');
  const eventRows = dataList(events, (event) => `<li data-event-id="${escape(event.id)}"><div class="data-heading"><strong>${escape(label(event.type))}</strong><time datetime="${escape(event.at)}">${date(event.at)}</time></div>${event.data && Object.keys(event.data).length ? detail('Event details', event.data) : ''}</li>`, 'No events received yet.');
  const canAct = run.mode === 'agent' && run.state === 'running' && !run.receipt && runActions.length < 80
    && !runActions.some(action => action.state === 'queued' || (action.type === 'finish' && action.state === 'completed'));
  const targets = (runActions.at(-1)?.observation?.actions ?? []).filter(action => action.type === 'tap' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(action.args?.target));
  const tools = canAct ? `<div class="actions agent-tools">
    <button class="button button-outline" type="button" data-action="agent-step" data-type="describe">Describe approved controls</button>
    ${targets.map(action => `<button class="button button-outline" type="button" data-action="agent-step" data-type="tap" data-target="${escape(action.args.target)}">Tap ${escape(action.args.target)}</button>`).join('')}
    <button class="button button-outline" type="button" data-action="agent-step" data-type="finish">Finish evaluation</button></div>` : '';
  const agent = run.mode === 'agent' ? panel('Agent actions', tools + dataList(runActions, action => `
    <li><div class="data-heading"><strong>${escape(action.type)}</strong>${badge(action.state ?? action.status)}</div>
    ${action.selectedBy ? `<p>Selected by ${escape(action.selectedBy)}</p>` : ''}
    ${detail('Action record', action)}</li>`, 'No recorded actions for this run.'), 'timeline-panel') : '';
  const training = consent ? panel('Training consent', `<p>Exporting the redacted trajectory requires a separate grant from each participant.</p>
    <dl class="data-pairs run-summary">${pair('Developer', consent.developer ? 'Granted' : 'Pending')}${pair('Provider', consent.provider ? 'Granted' : 'Pending')}</dl>
    <div class="actions"><button type="button" class="button button-outline" data-action="${consent.developer ? 'run-training-withdraw' : 'run-training-grant'}">${consent.developer ? 'Withdraw training consent' : 'Grant training consent'}</button>
    ${consent.developer && consent.provider ? '<button class="button button-outline" type="button" data-action="run-training-export">Download redacted trajectory</button>' : ''}</div>`) : '';
  return `<section class="panel">${result}</section>${agent}${signedReceipt}${training}${panel('Evidence files', evidenceRows)}${panel('Execution timeline', eventRows, 'timeline-panel')}`;
}

const duration = (milliseconds) => Number.isFinite(milliseconds) ? `${(milliseconds / 1_000).toFixed(2)} s` : 'Unavailable';

export function runComparison(runs, selectedRun) {
  if (selectedRun.mode !== 'agent') return '';
  const peers = runs.filter((run) => run.mode === 'agent' && run.scenario === selectedRun.scenario && run.buildId === selectedRun.buildId && run.verification?.actionMetrics);
  return panel('Compare agent runs', peers.length > 1 ? dataList(peers, (run) => `<li><div class="data-heading"><a href="#runs/${encodeURIComponent(run.id)}">${date(run.createdAt)}</a>${badge(run.state)}</div><p>${duration(run.verification.durationMs)} · ${escape(run.verification.actionMetrics.actionCount)} actions · ${escape(run.verification.actionMetrics.invalidActions)} invalid</p></li>`, '') : empty('Complete at least two agent-driven runs for this build and scenario to compare outcomes.'));
}

export function decimalAtoms(value, decimals) {
  const atoms = String(value ?? '');
  if (!/^\d+$/.test(atoms) || !Number.isInteger(decimals) || decimals < 0 || decimals > 20) return null;
  if (decimals === 0) return atoms;
  const padded = atoms.padStart(decimals + 1, '0');
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return padded.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

export function paymentView(payment, unavailable, run) {
  if (!payment && (run?.allocation === 'private' || run?.paymentTerms?.kind === 'unpaid'
    || (run?.allocation === 'marketplace' && !run.paymentTerms))) {
    return panel('Payout terms', empty('This workload has unpaid preview terms.'), 'payment-panel');
  }
  if (unavailable) return panel('Devnet settlement', empty(unavailable), 'payment-panel');
  if (!payment && run?.paymentTerms?.kind === 'devnet' && run.allocation === 'marketplace') {
    return panel('Devnet settlement', empty('Funding state is unavailable. Refresh the run to check again.'), 'payment-panel');
  }
  const state = payment?.state;
  const quote = payment?.quote;
  const quoteForm = `<form id="quote-form" class="form-stack"><label class="field">Developer Devnet wallet<input name="developerWallet" required maxlength="44" autocomplete="off"></label><button type="submit" class="button button-primary">Request quote</button></form>`;
  const fundingForm = `<form id="funding-form" class="form-stack"><label class="field">Devnet funding signature<input name="signature" required maxlength="90" autocomplete="off"><small>Submit the finalized transaction signature after funding from the quoted wallet.</small></label><button type="submit" class="button button-primary">Verify funding</button></form>`;
  const quoteSummary = quote ? `<dl class="data-pairs run-summary">${pair('Asset mint', quote.mint)}${pair('Amount', `${decimalAtoms(quote.amountAtoms, quote.decimals) ?? 'Unavailable'} ${quote.asset} · ${quote.amountAtoms} atoms`)}${pair('Token decimals', quote.decimals)}${pair('Deposit wallet', quote.deposit?.wallet)}${pair('Deposit token account', quote.deposit?.tokenAccount)}${pair('Funding memo', quote.funding?.memo)}${pair('Expires', formattedDate(quote.expiresAt))}</dl>` : '';
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
  </form>` : empty('Register a build in Builds to send a private request.');
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
