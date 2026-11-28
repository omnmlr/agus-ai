import { ApiError, createApi, readApk } from './api.mjs';
import { account, authView, buildOptions, deviceOptions, devicesView, escape, inboxView, integrationsView, invitationLinkView, invitationReview, invitationRows, navigation, paymentView, projectsView, requestsView, resultsView, runComparison, runDetail, runHistory, runsView, settingsView, workspaceView } from './views.mjs';

import { campaignDraft, campaignsView, campaignTask, updateCampaignTask } from './campaigns.mjs';

const sessionKey = 'agus-console-session';
const googleKey = 'agus-google-pkce';
const elements = Object.fromEntries(['account', 'navigation', 'notice', 'screen'].map((id) => [id, document.getElementById(id)]));
const state = { session: loadSession(), register: false, data: {}, routeVersion: 0, selected: null, events: [], runFingerprint: null, paymentFingerprint: null, share: null };
const api = createApi(() => state.session?.token);
let polling = false;
let sessionRefresh;

function loadSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey));
    return typeof value?.token === 'string' && typeof value?.user?.email === 'string' ? value : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  try {
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else sessionStorage.removeItem(sessionKey);
  } catch {
    // If browser storage is unavailable, the session remains in memory until reload.
  }
}

function route() {
  const [section, detail] = location.hash.slice(1).split('/');
  const selected = /^[\da-z-]{1,80}$/i.test(detail || '') ? detail : null;
  if (section === 'integrations') return { page: section };
  if (section === 'invite' && /^[\da-z_-]{20,160}$/i.test(detail || '')) return { page: section, token: detail };
  if (state.session && ['builds', 'devices', 'settings', 'inbox', 'reports', 'funding'].includes(section)) return { page: section };
  if (state.session && ['runs', 'requests', 'campaigns', 'projects'].includes(section)) return { page: section, selected };
  return { page: 'workspace' };
}

function notice(message, failure = false) {
  elements.notice.innerHTML = message ? `<p class="inline-status"${failure ? ' role="alert"' : ''}>${escape(message)}</p>` : '';
}

function displayError(error, { authenticationAttempt = false } = {}) {
  if (state.session && error instanceof ApiError && error.status === 401 && !authenticationAttempt) {
    saveSession(null);
    void navigate();
    notice('Your session has expired. Sign in again to continue.', true);
    return;
  }
  notice(error.message || 'Request failed. Try again.', true);
}

async function listCampaigns() {
  try {
    return await api.get('/campaigns');
  } catch (error) {
    if (['pilot_unavailable', 'pilot_access_required'].includes(error.code)) return { campaigns: [], campaignsUnavailable: true };
    throw error;
  }
}

async function loadData(page, selected) {
  if (page === 'settings') return Object.assign({}, ...(await Promise.all([api.get('/auth/me'), api.get('/me/notifications/preferences')])));
  if (page === 'inbox') return api.get('/me/notifications');
  if (page === 'campaigns') {
    try {
      return Object.assign({}, ...(await Promise.all([
        api.get('/projects'), api.get('/builds'), api.get('/campaigns'),
        ...(selected ? [api.get('/campaigns/' + encodeURIComponent(selected) + '/report'),
          api.get('/campaigns/' + encodeURIComponent(selected) + '/funding')] : []),
      ])));
    } catch (error) {
      if (['pilot_unavailable', 'pilot_access_required'].includes(error.code)) return { unavailable: true };
      throw error;
    }
  }
  if (page === 'devices') {
    const { devices } = await api.get('/devices');
    return { devices };
  }
  const workspaceRequests = [api.get('/projects'), api.get('/builds')];
  const requests = [...workspaceRequests];
  if (page === 'runs') requests.push(api.get('/devices'), api.get('/runs'));
  if (['workspace', 'projects', 'reports', 'funding'].includes(page)) requests.push(api.get('/runs'));
  if (['workspace', 'reports', 'funding'].includes(page)) requests.push(listCampaigns());
  if (page === 'requests') requests.push(api.get('/invitations'));
  return Object.assign({}, ...(await Promise.all(requests)));
}

async function refreshSessionIfDue() {
  const current = state.session;
  if (!current || !(Date.parse(current.expiresAt) - Date.now() <= 120_000)) return;
  if (!sessionRefresh) sessionRefresh = api.post('/auth/refresh', {}).then(replacement => {
    if (state.session === current) saveSession(replacement);
  }).finally(() => { sessionRefresh = undefined; });
  await sessionRefresh;
}

async function navigate() {
  const currentVersion = ++state.routeVersion;
  const { page, selected } = route();
  state.selected = selected || null;
  state.events = [];
  state.runFingerprint = null;
  state.paymentFingerprint = null;
  document.body.dataset.mode = state.session ? 'member' : 'guest';
  elements.account.innerHTML = account(state.session?.user);
  elements.navigation.innerHTML = navigation(page, state.session?.user);
  notice('');
  if (page === 'integrations') {
    elements.screen.innerHTML = integrationsView();
    return;
  }
  if (!state.session) {
    elements.screen.innerHTML = page === 'invite' ? `${invitationLinkView(false)}${authView(state.register, true)}` : authView(state.register);
    return;
  }
  if (page === 'invite') {
    elements.screen.innerHTML = invitationLinkView(true);
    return;
  }
  elements.screen.innerHTML = '<p class="empty" aria-busy="true">Loading data from the control plane…</p>';
  try {
    await refreshSessionIfDue();
    const data = await loadData(page, selected);
    if (currentVersion !== state.routeVersion) return;
    state.data = data;
    if (page === 'campaigns') {
      elements.screen.innerHTML = campaignsView(data);
      for (const row of elements.screen.querySelectorAll('[data-campaign-task]')) updateCampaignTask(row);
    }
    if (page === 'workspace' || page === 'builds') elements.screen.innerHTML = workspaceView(data, page === 'builds');
    if (page === 'projects') elements.screen.innerHTML = projectsView(data, selected);
    if (['reports', 'funding'].includes(page)) elements.screen.innerHTML = resultsView(data, page === 'funding');
    if (page === 'settings') elements.screen.innerHTML = settingsView(data);
    if (page === 'inbox') elements.screen.innerHTML = inboxView(data.notifications);
    if (page === 'devices') elements.screen.innerHTML = devicesView(data.devices);
    if (page === 'requests') {
      const invitation = data.invitations.find(({ id }) => id === state.selected);
      const shareUrl = invitation && ['pending', 'reviewed'].includes(invitation.state) && state.share?.id === invitation.id ? state.share.url : null;
      elements.screen.innerHTML = requestsView(data, state.session.user, shareUrl);
      updateWorkloadFields(document.getElementById('request-form'));
      if (invitation) renderInvitation(invitation);
      else if (state.selected) notice('This invitation was not found for your account.', true);
    }
    if (page === 'runs') {
      elements.screen.innerHTML = runsView(data, state.selected);
      updateWorkloadFields(document.getElementById('run-form'));
      if (state.selected) {
        await refreshRun();
        if (currentVersion === state.routeVersion) await refreshPayment();
      }
    }
  } catch (error) {
    if (currentVersion !== state.routeVersion) return;
    elements.screen.innerHTML = '<div class="actions"><button type="button" class="button button-outline" data-action="retry">Retry loading</button></div>';
    displayError(error);
  }
}

function updateWorkloadFields(form, changed) {
  if (!form) return;
  const trajectory = form.elements.trajectory;
  if (trajectory && (!changed || changed === 'mode')) {
    trajectory.disabled = form.elements.mode.value !== 'agent';
    trajectory.closest('label').hidden = trajectory.disabled;
  }
  if (!changed || changed === 'projectId') form.elements.buildId.innerHTML = buildOptions(state.data.builds, form.elements.projectId.value);
  if (!changed || changed === 'scenario' || changed === 'network') {
    if (form.id === 'run-form') {
      const { deviceId } = form.elements;
      const selectedDevice = deviceId.value;
      const scenario = form.elements.scenario.value;
      deviceId.innerHTML = deviceOptions(state.data.devices, scenario, scenario === 'wallet-transfer' ? form.elements.network.value : undefined);
      if (Array.from(deviceId.options).some((option) => option.value === selectedDevice)) deviceId.value = selectedDevice;
    }
    const expected = form.querySelector('[data-transaction-fields]');
    const show = form.elements.scenario.value === 'wallet-transfer';
    expected.disabled = !show;
    expected.hidden = !show;
  }
}

function refreshHistory(run) {
  const index = state.data.runs.findIndex(({ id }) => id === run.id);
  if (index < 0) state.data.runs.unshift(run);
  else state.data.runs[index] = run;
  applyRunFilters();
}

function applyRunFilters() {
  const target = document.getElementById('run-history');
  if (!target) return;
  target.innerHTML = runHistory(state.data.runs, state.selected, {
    query: document.getElementById('run-search')?.value,
    status: document.getElementById('run-status')?.value,
  });
}

async function refreshRun({ silent = false } = {}) {
  const selected = state.selected;
  const version = state.routeVersion;
  const detail = document.getElementById('run-detail');
  if (!selected || !detail) return;
  const base = `/runs/${encodeURIComponent(selected)}`;
  const last = state.events.at(-1)?.id;
  const after = Number.isInteger(last) && last >= 0 ? `?after=${last}` : '';
  let result;
  try {
    const detailResult = await api.get(base);
    result = [detailResult, ...(await Promise.all([
      api.get(`${base}/events${after}`),
      detailResult.run.mode === 'agent' ? api.get(base + '/actions') : { actions: [] },
    ]))];
  } catch (error) {
    if (version !== state.routeVersion) return;
    if (!silent || error.status === 401) displayError(error);
    if (!silent) detail.innerHTML = '<p class="empty">Run details could not be loaded.</p>';
    return;
  }
  if (version !== state.routeVersion) return;
  const [{ run }, { events }, { actions: runActions }] = result;
  const knownEvents = new Set(state.events.map(({ id }) => id));
  state.events.push(...events.filter(({ id }) => !knownEvents.has(id)));
  let consent;
  if (run.evidence?.trajectory && run.receipt?.evidence?.some(item => item.kind === 'trajectory' && item.url)) {
    try {
      ({ consent } = await api.get(base + '/training-consent'));
    } catch (error) {
      if (version !== state.routeVersion) return;
      if (!['training_unavailable', 'not_found'].includes(error.code)) displayError(error);
    }
  }
  if (version !== state.routeVersion) return;
  const latest = JSON.stringify([run, state.events.length, runActions, consent]);
  if (latest === state.runFingerprint) return;
  state.runFingerprint = latest;
  refreshHistory(run);
  document.getElementById('run-comparison').innerHTML = runComparison(state.data.runs, run);
  const expanded = new Set(Array.from(detail.querySelectorAll('details[open] summary'), (summary) => summary.textContent));
  detail.innerHTML = runDetail(run, state.events, runActions, consent);
  for (const summary of detail.querySelectorAll('details summary')) {
    if (expanded.has(summary.textContent)) summary.parentElement.open = true;
  }
  return true;
}

async function refreshPayment() {
  const selected = state.selected;
  const version = state.routeVersion;
  const target = document.getElementById('payment-detail');
  if (!selected || !target) return;
  let result;
  let unavailable;
  try {
    result = await api.get(`/runs/${encodeURIComponent(selected)}/payment`);
  } catch (error) {
    if (version !== state.routeVersion) return;
    if (error.status === 401) {
      displayError(error);
      return;
    }
    if (error.code !== 'PAYMENT_NOT_FOUND' && error.code !== 'payment_not_found') {
      unavailable = error.status === 404 || error.status === 503 ? 'Devnet settlement is unavailable for this run.' : error.message;
    }
  }
  if (version !== state.routeVersion) return;
  const payment = result && Object.hasOwn(result, 'payment') ? result.payment : result;
  const run = state.data.runs?.find(({ id }) => id === selected);
  const latest = JSON.stringify([payment, unavailable, run?.state, run?.verification?.transaction?.status]);
  if (latest === state.paymentFingerprint) return;
  state.paymentFingerprint = latest;
  target.innerHTML = paymentView(payment, unavailable, run);
}

function beginRun(run) {
  const nextHash = `#runs/${encodeURIComponent(run.id)}`;
  if (location.hash !== nextHash) location.hash = nextHash;
  else void refreshRun();
}

function expectedTransaction(data) {
  if (!data.has('network')) return undefined;
  const lamports = Number(data.get('lamports'));
  if (!Number.isSafeInteger(lamports) || lamports < 1) throw new Error('Enter a whole number of lamports between 1 and 9007199254740991.');
  const payer = data.get('payer')?.trim();
  return { network: data.get('network'), recipient: data.get('recipient').trim(), lamports, ...(payer ? { payer } : {}) };
}

function renderInvitation(invitation, reviewed = false) {
  const target = document.getElementById('invitation-detail');
  if (target) target.innerHTML = invitationReview(invitation, state.session.user, state.data, reviewed);
  const list = document.getElementById('invitation-list');
  if (list) {
    state.data.invitations = state.data.invitations.map((item) => item.id === invitation.id ? invitation : item);
    list.innerHTML = invitationRows(state.data.invitations, state.session.user);
  }
}

async function reviewInvitation(path, body) {
  const version = state.routeVersion;
  const { invitation } = await api.post(path, body);
  if (version !== state.routeVersion) return;
  if (route().page === 'invite' && invitation.kind === 'provider_share') {
    const { builds } = await api.get('/builds');
    if (version !== state.routeVersion) return;
    state.data = { builds };
  }
  renderInvitation(invitation, true);
}

const optionalRegistration = data => {
  const registrationToken = data.get('registrationToken')?.trim();
  return registrationToken ? { registrationToken } : {};
};

const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
const pendingCreates = new Map();

async function createResource(path, body) {
  const currentUser = state.session?.user.id;
  const payload = JSON.stringify(body);
  const scope = JSON.stringify([currentUser, path, payload]);
  const last = pendingCreates.get(scope);
  const key = last?.key ?? crypto.randomUUID();
  pendingCreates.set(scope, { key });
  try {
    const result = await api.post(path, body, key);
    pendingCreates.delete(scope);
    return result;
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && ![408, 425, 429].includes(error.status)) pendingCreates.delete(scope);
    else throw new Error('The result is unknown. Refresh the list before retrying. Retrying the same request in this tab reuses its submission key.');
    throw error;
  }
}

const forms = {
  'profile-form': async data => {
    const { user } = await api.patch('/auth/me', { displayName: data.get('displayName').trim() });
    if (state.session?.user.id === user.id) saveSession({ ...state.session, user });
    await navigate();
    notice('Profile saved.');
  },
  'preferences-form': async data => {
    await api.patch('/me/notifications/preferences', { completedRuns: data.has('completedRuns'), campaignUpdates: data.has('campaignUpdates') });
    await navigate();
    notice('Notification preferences saved.');
  },
  'otp-start-form': async data => {
    const email = data.get('email').trim();
    await api.post('/auth/email/start', { email, ...optionalRegistration(data) });
    document.getElementById('otp-verify-form').elements.email.value = email;
    notice('If the account is eligible, a code will arrive shortly.');
  },
  'otp-verify-form': async data => {
    saveSession(await api.post('/auth/email/verify', { email: data.get('email').trim(), code: data.get('code') }));
    await navigate();
  },
  'google-start-form': async data => {
    if (!crypto.subtle) throw new Error('Use HTTPS or localhost for Google sign-in.');
    const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const { url } = await api.post('/auth/google/start', { challenge, ...optionalRegistration(data) });
    const destination = new URL(url);
    if (destination.origin !== 'https://accounts.google.com') throw new Error('Invalid Google authorization URL.');
    sessionStorage.setItem(googleKey, JSON.stringify({ verifier, returnHash: route().page === 'invite' ? location.hash : '' }));
    location.assign(destination);
  },
  'campaign-form': async (data, form) => {
    const draft = campaignDraft(form, data);
    const previous = state.data.report?.campaign;
    const result = previous ? await api.patch('/campaigns/' + previous.id, { expectedRevision: previous.revision, draft })
      : await createResource('/campaigns', draft);
    if (state.selected === result.campaign.id) await navigate();
    else location.hash = '#campaigns/' + result.campaign.id;
  },
  'campaign-review': async (data, form) => {
    await api.post('/assignments/' + form.dataset.assignment + '/reviews', {
      attemptId: form.dataset.attempt, version: Number(form.dataset.version), decision: data.get('decision'), reason: data.get('reason'),
    });
    await navigate();
    notice('Review saved.');
  },
  'campaign-funding-verify': async (data) => {
    await api.post('/campaigns/' + encodeURIComponent(state.selected) + '/funding/verify', { signature: data.get('signature').trim() });
    await navigate();
    notice('Funding verified on the finalized test chain.');
  },
  'auth-form': async (data) => {
    const registrationToken = data.get('registrationToken');
    const body = { email: data.get('email').trim(), password: data.get('password') };
    if (registrationToken) body.registrationToken = registrationToken.trim();
    saveSession(await api.post(state.register ? '/auth/register' : '/auth/login', body));
    state.register = false;
    await navigate();
  },
  'project-form': async (data) => {
    await api.post('/projects', { name: data.get('name').trim() });
    await navigate();
    notice('Project created.');
  },
  'build-form': async (data) => {
    notice('Calculating the APK fingerprint…');
    const apk = await readApk(data.get('apk'));
    const build = { ...apk, projectId: data.get('projectId'), name: data.get('name').trim(), packageName: data.get('packageName').trim() };
    notice('Uploading the APK and its fingerprint…');
    await api.post('/builds', build);
    await navigate();
    notice('Build registered.');
  },
  'run-form': async (data) => {
    const body = {
      projectId: data.get('projectId'), buildId: data.get('buildId'), scenario: data.get('scenario'), mode: data.get('mode'),
      allocation: 'marketplace', maximumDurationSeconds: Number(data.get('maximumDurationSeconds')), evidence: evidenceChoices(data),
      expectedTransaction: expectedTransaction(data),
    };
    if (data.get('deviceId')) body.deviceId = data.get('deviceId');
    const developerWallet = data.get('fundingWallet')?.trim();
    if (developerWallet) body.payment = { kind: 'devnet', developerWallet };
    const { run } = await createResource('/runs', body);
    beginRun(run);
  },
  'request-form': async (data) => {
    const { invitation, token } = await createResource('/invitations', {
      kind: 'developer_request', deviceId: data.get('deviceId').trim(), projectId: data.get('projectId'), buildId: data.get('buildId'),
      scenario: data.get('scenario'), mode: data.get('mode'), maximumDurationSeconds: Number(data.get('maximumDurationSeconds')),
      evidence: evidenceChoices(data), expectedTransaction: expectedTransaction(data),
    });
    state.share = token ? { id: invitation.id, url: new URL(`/console.html#invite/${encodeURIComponent(token)}`, location.origin).href } : null;
    location.hash = `#requests/${encodeURIComponent(invitation.id)}`;
  },
  'invite-accept-form': async (data, form) => {
    const body = {};
    const buildId = data.get('buildId');
    if (buildId) {
      const build = state.data.builds?.find(({ id }) => id === buildId);
      if (!build) throw new Error('Register and select the exact build from the invitation.');
      body.projectId = build.projectId;
      body.buildId = build.id;
      body.expectedTransaction = expectedTransaction(data);
    }
    const { invitation } = await api.post(`/invitations/${encodeURIComponent(form.dataset.inviteId)}/accept`, body);
    renderInvitation(invitation, true);
    notice('Invitation accepted. The run still requires runner readiness and an exclusive lease.');
  },
  'quote-form': async (data) => {
    await runPaymentAction('quote', { developerWallet: data.get('developerWallet').trim() });
    notice('Devnet quote requested.');
  },
  'funding-form': async (data) => {
    await runPaymentAction('funding', { signature: data.get('signature').trim() });
    notice('Funding reconciliation complete. Review the payment state.');
  },
};

const evidenceChoices = (data) => ({ screenshots: data.has('screenshots'), logs: data.has('logs'), trajectory: data.has('trajectory') });

async function runPaymentAction(action, body) {
  if (!state.selected) return;
  const path = `/runs/${encodeURIComponent(state.selected)}/${action}`;
  await api.post(path, body);
  await refreshPayment();
}

async function downloadEvidence(button) {
  if (!state.selected || !/^[0-9a-fA-F]{64}$/.test(button.dataset.sha)) return;
  const blob = await api.download(`/runs/${encodeURIComponent(state.selected)}/evidence/${button.dataset.sha}`);
  const url = URL.createObjectURL(blob);
  const trigger = document.createElement('a');
  trigger.href = url;
  trigger.download = button.dataset.filename || 'evidence';
  trigger.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

async function previewEvidence(button) {
  if (!state.selected || !/^[0-9a-fA-F]{64}$/.test(button.dataset.sha)) return;
  const row = button.closest('li');
  const previous = row.querySelector('.evidence-preview');
  if (previous) {
    previous.remove();
    button.textContent = `View ${button.dataset.kind}`;
    return;
  }
  const blob = await api.download(`/runs/${encodeURIComponent(state.selected)}/evidence/${button.dataset.sha}`);
  if (!row.isConnected) return;
  if (button.dataset.kind === 'log') {
    const limit = 64 * 1024;
    const log = document.createElement('pre');
    log.className = 'evidence-preview';
    log.textContent = await blob.slice(0, limit).text();
    if (blob.size > limit) log.append('\n\nPreview stops at 64 KiB. Download to inspect the full attachment.');
    row.append(log);
    button.textContent = 'Hide log';
    return;
  }
  const prefix = [...new Uint8Array(await blob.slice(0, 8).arrayBuffer())];
  const png = '137,80,78,71,13,10,26,10';
  const mime = prefix.join(',') === png ? 'image/png' : prefix.slice(0, 3).join(',') === '255,216,255' ? 'image/jpeg' : null;
  if (!mime) throw new Error('This evidence is not a PNG or JPEG screenshot. Download it for inspection.');
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const screenshot = document.createElement('img');
  screenshot.className = 'evidence-preview';
  screenshot.alt = button.dataset.filename || 'Run screenshot';
  screenshot.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  screenshot.addEventListener('error', () => {
    URL.revokeObjectURL(url);
    screenshot.remove();
    button.textContent = 'View screenshot';
    notice('Screenshot could not be displayed. Download it for inspection.', true);
  }, { once: true });
  screenshot.src = url;
  row.append(screenshot);
  button.textContent = 'Hide screenshot';
}

function downloadJson(name, value) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const actions = {
  'copy-digest': async button => {
    try {
      await navigator.clipboard.writeText(button.dataset.digest);
      notice('Build SHA-256 copied.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(button.previousElementSibling);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      notice('Copy the selected SHA-256.');
    }
  },
  'agent-step': async button => {
    const path = '/runs/' + encodeURIComponent(state.selected) + '/actions';
    const type = button.dataset.type;
    const args = type === 'tap' ? { target: button.dataset.target } : {};
    try {
      await api.post(path, { type, args });
    } catch (error) {
      await refreshRun();
      if (error.status === 0 || error.status >= 500) throw new Error('Action status is unknown. Check the execution timeline before submitting another action.');
      throw error;
    }
    await refreshRun();
    notice('Agent action queued.');
  },
  'run-training-grant': async () => {
    if (!confirm('Grant training consent for this run’s redacted trajectory?')) return;
    await api.put('/runs/' + encodeURIComponent(state.selected) + '/training-consent', {});
    await refreshRun();
  },
  'run-training-withdraw': async () => {
    await api.delete('/runs/' + encodeURIComponent(state.selected) + '/training-consent');
    await refreshRun();
  },
  'run-training-export': async () => {
    const report = await api.get('/runs/' + encodeURIComponent(state.selected) + '/training-export');
    downloadJson('agus-training-trajectory.json', report);
  },
  'read-notification': async button => {
    await api.post('/me/notifications/' + encodeURIComponent(button.dataset.notification) + '/read', {});
    await navigate();
  },
  'download-run-receipt': () => {
    const receipt = state.data.runs.find(run => run.id === state.selected)?.receipt;
    if (receipt) downloadJson('agus-run-receipt.json', receipt);
  },
  'verify-run': async () => {
    await api.post('/runs/' + encodeURIComponent(state.selected) + '/verify', {});
    await refreshRun();
    notice('Verification updated. Review the result.');
  },
  'add-campaign-task': () => {
    const area = document.getElementById('campaign-tasks');
    if (area.children.length >= 12) return;
    const projectId = document.getElementById('campaign-form').elements.projectId.value;
    area.insertAdjacentHTML('beforeend', campaignTask(state.data.builds.filter(build => build.projectId === projectId), {}, state.data.fundingNetwork));
    updateCampaignTask(area.lastElementChild);
    area.lastElementChild.querySelector('[name=taskTitle]').focus();
  },
  'remove-campaign-task': button => {
    const row = button.closest('[data-campaign-task]');
    if (row.parentElement.children.length > 1) row.remove();
  },
  'campaign-transition': async button => {
    const campaign = state.data.report.campaign;
    if (button.dataset.operation === 'cancel' && !confirm('Cancel future work and request stop for active assignments?')) return;
    await api.post('/campaigns/' + campaign.id + '/' + encodeURIComponent(button.dataset.operation), { expectedRevision: campaign.revision });
    await navigate();
  },
  'download-campaign-report': () => {
    if (state.data.report) downloadJson('agus-campaign-report.json', state.data.report);
  },
  'campaign-receipt': async button => {
    const { receipt } = await api.get('/assignments/' + button.dataset.assignment + '/receipt');
    downloadJson('agus-native-receipt.json', receipt);
  },
  'campaign-funding-quote': async () => {
    const { campaign } = state.data.report;
    if (!confirm('Lock this revision to the verified funding wallet and exact test amount?')) return;
    await api.post('/campaigns/' + campaign.id + '/funding/quote', { expectedRevision: campaign.revision });
    await navigate();
  },
  'campaign-funding-download': () => {
    downloadJson('agus-campaign-funding-quote.json', state.data.escrow.quote);
  },
  'campaign-funding-refund': async () => {
    await api.post('/campaigns/' + encodeURIComponent(state.selected) + '/funding/refund', {});
    await navigate();
  },
  'campaign-payout': async button => {
    await api.post('/assignments/' + encodeURIComponent(button.dataset.assignment) + '/payment', {});
    await navigate();
  },
  'campaign-training-grant': async button => {
    if (!confirm('Grant training rights for this assignment’s redacted, reviewed evidence? Contributor permission is also required.')) return;
    await api.put('/me/assignments/' + button.dataset.assignment + '/training-consent', { termsDigest: button.dataset.terms, grant: true });
    notice('Developer training grant recorded.');
  },
  'campaign-training-withdraw': async button => {
    await api.delete('/me/assignments/' + button.dataset.assignment + '/training-consent');
    notice('Developer training grant withdrawn for future deliveries.');
  },
  'campaign-export': async button => {
    const path = '/campaigns/' + state.selected + '/exports';
    const created = await api.post(path, { purpose: 'training', assignmentIds: [button.dataset.assignment] });
    const delivered = await api.get(path + '/' + created.export.id);
    downloadJson('agus-training-export.json', delivered.export);
  },
  'toggle-auth': () => {
    state.register = !state.register;
    return navigate();
  },
  'sign-out': async () => {
    let problem;
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      if (error.status !== 401) problem = error;
    }
    saveSession(null);
    pendingCreates.clear();
    state.share = null;
    await navigate();
    if (problem) notice('Signed out of this tab. Server-side session revocation could not be confirmed.', true);
  },
  'refresh-devices': navigate,
  'refresh-runs': navigate,
  'refresh-requests': navigate,
  retry: navigate,
  'cancel-run': async () => {
    if (!state.selected || !confirm('Cancel this queued run or request a stop for active work?')) return;
    const { run } = await api.post(`/runs/${encodeURIComponent(state.selected)}/cancel`, {});
    await refreshRun();
    notice(run.state === 'stopping' ? 'Stop requested. Waiting for runner confirmation and cleanup.' : 'Run cancelled.');
  },
  'review-invite-link': () => reviewInvitation('/invitations/review', { token: route().token }),
  'review-invite': (button) => reviewInvitation(`/invitations/${encodeURIComponent(button.dataset.inviteId)}/review`, {}),
  'decline-invite': async (button) => {
    const { invitation } = await api.post(`/invitations/${encodeURIComponent(button.dataset.inviteId)}/decline`, {});
    if (route().page === 'invite') renderInvitation(invitation);
    else await navigate();
    notice('Invitation declined.');
  },
  'revoke-invite': async (button) => {
    const { invitation, run } = await api.post(`/invitations/${encodeURIComponent(button.dataset.inviteId)}/revoke`, {});
    state.share = null;
    if (route().page === 'invite') renderInvitation(invitation);
    else await navigate();
    notice(run?.state === 'stopping' ? 'Invitation revoked. Waiting for runner confirmation and cleanup.' : 'Invitation revoked.');
  },
  'copy-share': async () => {
    if (!state.share || state.share.id !== route().selected) return;
    try {
      await navigator.clipboard.writeText(state.share.url);
      notice('Invitation link copied.');
    } catch {
      const input = document.getElementById('private-share-url');
      input.focus();
      input.select();
      notice('Copy the selected invitation link.');
    }
  },
  'download-evidence': downloadEvidence,
  'preview-evidence': previewEvidence,
  'settle-run': async () => {
    await runPaymentAction('settle', {});
    notice('Settlement request processed. Review the Devnet payment state.');
  },
  'reconcile-run': async () => {
    await runPaymentAction('reconcile', {});
    notice('Payment reconciled. Review the Devnet payment state.');
  },
};

document.addEventListener('submit', async (event) => {
  const form = event.target;
  const handle = forms[form.dataset.form || form.id];
  if (!handle) return;
  event.preventDefault();
  const button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  button.disabled = true;
  notice('');
  try {
    await handle(new FormData(form), form);
  } catch (error) {
    displayError(error, { authenticationAttempt: ['auth-form', 'otp-start-form', 'otp-verify-form', 'google-start-form'].includes(form.id) });
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  const handle = button && actions[button.dataset.action];
  if (!handle || button.disabled) return;
  button.disabled = true;
  notice('');
  try {
    await handle(button);
  } catch (error) {
    displayError(error);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('change', ({ target }) => {
  if (target.form?.id === 'build-form' && target.name === 'apk') {
    const selected = target.files[0];
    target.form.querySelector('[data-build-selection]').textContent = selected
      ? new Intl.NumberFormat(undefined, { style: 'unit', unit: 'byte' }).format(selected.size)
      : '';
  }
  if (target.id === 'run-status') applyRunFilters();
  if (target.form?.id === 'campaign-form') {
    if (target.name === 'visibility') target.form.querySelector('[data-campaign-invites]').hidden = target.value !== 'invited';
    if (target.name === 'projectId') {
      for (const select of target.form.querySelectorAll('[name=buildId]')) {
        select.replaceChildren(...state.data.builds.filter(build => build.projectId === target.value).map(build =>
          new Option(build.name + ' · ' + build.packageName + ' · ' + build.sha256.slice(0, 12), build.id)));
      }
    }
    const row = target.closest('[data-campaign-task]');
    if (row && ['lane', 'scenario'].includes(target.name)) updateCampaignTask(row);
  }
  if (['run-form', 'request-form'].includes(target.form?.id)) updateWorkloadFields(target.form, target.name);
});

document.addEventListener('input', ({ target }) => {
  if (target.id === 'run-search') applyRunFilters();
});
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('main').focus();
});
const menuButton = document.getElementById('console-menu');
const compactNavigation = matchMedia('(max-width: 767px)');
function setNavigation(open, restore = true) {
  document.body.dataset.navigation = open ? 'open' : 'closed';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close console navigation' : 'Open console navigation');
  if (open) (elements.navigation.querySelector('[aria-current]') ?? elements.navigation.querySelector('a'))?.focus();
  else if (restore) menuButton.focus();
}
menuButton.addEventListener('click', () => setNavigation(menuButton.getAttribute('aria-expanded') !== 'true'));
document.getElementById('console-menu-dismiss').addEventListener('click', () => setNavigation(false));
compactNavigation.addEventListener('change', () => setNavigation(false, false));
document.addEventListener('keydown', event => {
  if (document.body.dataset.navigation !== 'open') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setNavigation(false);
  }
  if (event.key === 'Tab') {
    const links = [...elements.navigation.querySelectorAll('a')];
    const edge = event.shiftKey ? links[0] : links.at(-1);
    if (document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? links.at(-1) : links[0]).focus();
    }
  }
});
window.addEventListener('hashchange', () => {
  setNavigation(false, false);
  document.getElementById('main').focus();
  void navigate();
});
setInterval(async () => {
  if (polling || route().page !== 'runs' || !state.session || !state.selected || document.visibilityState === 'hidden') return;
  polling = true;
  try {
    if (await refreshRun({ silent: true })) await refreshPayment();
  } finally {
    polling = false;
  }
}, 3_000);

async function initialize() {
  const response = new URLSearchParams(location.hash.slice(1));
  const code = response.get('authCode');
  if (!code && !response.has('authError')) return navigate();
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(googleKey)); sessionStorage.removeItem(googleKey); }
  catch { /* Invalid or disabled browser storage aborts the exchange. */ }
  const target = /^#invite\/[A-Za-z0-9_-]{20,160}$/.test(pending?.returnHash ?? '') ? pending.returnHash : '';
  history.replaceState(null, '', location.pathname + location.search + target);
  try {
    if (!code || !/^[a-f0-9]{64}$/.test(pending?.verifier ?? '')) throw new Error('Google sign-in was not completed in this tab.');
    saveSession(await api.post('/auth/google/exchange', { code, verifier: pending.verifier }));
    await navigate();
  } catch (error) {
    await navigate();
    displayError(error, { authenticationAttempt: true });
  }
}
void initialize();
