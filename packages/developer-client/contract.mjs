import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const string = { type: 'string' };
const boolean = { type: 'boolean' };
const integer = { type: 'integer' };
const number = { type: 'number' };
const nullable = value => ({ anyOf: [value, { type: 'null' }] });
const values = (...items) => ({ type: 'string', enum: items });
const array = items => ({ type: 'array', items });
const of = name => ({ $ref: '#/components/schemas/' + name });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const record = { type: 'object', additionalProperties: true };
const envelope = (key, item) => obj({ [key]: item });
const envelopeList = (key, item) => envelope(key, array(item));
const account = { email: { ...string, format: 'email' }, password: { ...string, minLength: 12, maxLength: 128 } };
const authCode = { ...string, pattern: '^[a-f0-9]{64}$' };
const date = { ...string, format: 'date-time' };
const id = { ...string, format: 'uuid' };
const sha = { ...string, pattern: '^[a-f0-9]{64}$' };
const consent = { screenshots: boolean, logs: boolean, trajectory: boolean };
const constraints = { chargingRequired: boolean, wifiRequired: boolean };
const createRun = {
  projectId: id, buildId: id, deviceId: nullable(string), scenario: of('Scenario'), mode: of('Mode'),
  expectedTransaction: of('TransactionExpectation'), allocation: values('marketplace'),
  maximumDurationSeconds: integer, evidence: of('EvidenceConsent'),
  payment: obj({ kind: { const: 'devnet' }, developerWallet: string }),
};
const inviteBase = {
  deviceId: string, scenario: of('Scenario'), mode: of('Mode'),
  maximumDurationSeconds: integer, evidence: of('EvidenceConsent'),
};
const userSummary = obj({ id, email: string, displayName: string }, ['id', 'email']);
const profile = {
  kind: string, walletNetwork: nullable(values('devnet', 'localnet')), provenance: values('runner_observed', 'simulated_environment'),
  hardwareAttested: { const: false }, seekerVerified: { const: false },
  measuredAt: nullable(date), source: nullable(string), manufacturer: nullable(string),
  model: nullable(string), androidVersion: nullable(string), apiLevel: nullable(integer),
  dataAvailableBytes: nullable(integer), dataTotalBytes: nullable(integer),
  memoryAvailableBytes: nullable(integer), memoryTotalBytes: nullable(integer),
  batteryPercent: nullable(number), batteryHealth: nullable(string), batteryTemperatureC: nullable(number),
  thermalStatus: nullable(string), networkLatencyMs: nullable(number), networkProbedAt: nullable(date),
  throughputMbps: nullable(number), charging: nullable(boolean), wifiConnected: nullable(boolean),
};
const device = {
  id: string, label: string, profile: of('DeviceProfile'), dedicated: { const: true },
  lastSeenAt: date, revokedAt: date, scenarios: array(of('Scenario')),
  state: values('available', 'busy', 'offline'),
  connectivity: values('online', 'offline'), readiness: values('ready', 'busy', 'offline', 'quarantined'),
  publicListing: boolean, autoMatch: boolean, marketplaceEligible: boolean,
};
const schemas = {
  Error: envelope('error', obj({ code: string, message: string })),
  User: obj({ id, email: string, displayName: string, capabilities: obj({ developer: { const: true }, provider: boolean }) },
    ['id', 'email', 'capabilities']),
  Session: obj({ token: string, user: of('User'), expiresAt: date }),
  Scenario: values('app-launch', 'wallet-connect', 'wallet-transfer', 'wallet-false-success'),
  Mode: values('scripted', 'agent'),
  RunState: values('queued', 'reserved', 'running', 'verifying', 'stopping', 'passed', 'failed', 'cancelled', 'expired', 'unverified'),
  LeaseState: values('unallocated', 'reserved', 'running', 'stopping', 'verifying', 'released', 'expired'),
  ExecutionState: values('queued', 'reserved', 'running', 'stopping', 'verifying', 'completed', 'cancelled', 'expired'),
  TransactionExpectation: obj({ network: values('devnet', 'localnet'), recipient: string, lamports: integer, payer: string },
    ['network', 'recipient', 'lamports']),
  EvidenceConsent: obj(consent, []),
  CreateRun: obj(createRun, ['projectId', 'buildId', 'scenario', 'mode']),
  Project: obj({ id, name: string, createdAt: date }),
  Build: obj({ id, projectId: id, name: string, packageName: nullable(string), sha256: sha, createdAt: date, size: integer }),
  DeviceProfile: obj(profile, ['kind', 'provenance', 'hardwareAttested', 'seekerVerified']),
  Device: obj(device, Object.keys(device).filter(key => key !== 'revokedAt')),
  OwnedDevice: {
    allOf: [of('Device'), obj({ schedule: nullable(of('Schedule')), constraints: of('Constraints') })],
  },
  Constraints: obj(constraints),
  Schedule: obj({ timeZone: string, windows: array(obj({
    days: array({ ...integer, minimum: 0, maximum: 6 }), start: string, end: string,
  })) }),
  UpdateDevice: obj({
    label: string, publicListing: boolean, autoMatch: boolean,
    schedule: nullable(of('Schedule')), constraints: obj(constraints, []),
  }, []),
  Diagnostic: obj({ checkedAt: date, source: string, checks: array(obj({
    id: string, passed: boolean, lastSeenAt: nullable(date), measuredAt: nullable(date),
  }, ['id', 'passed'])) }),
  Unpaid: obj({ kind: { const: 'unpaid' }, amountAtoms: { const: '0' }, asset: { type: 'null' },
    cluster: { type: 'null' }, decimals: { type: 'null' } }),
  Paid: obj({ kind: { const: 'devnet' }, amountAtoms: string, asset: values('USDC'),
    cluster: values('devnet'), mint: string, decimals: integer, destination: string }),
  Payout: { oneOf: [of('Unpaid'), of('Paid')] },
  Run: obj({
    id, projectId: id, buildId: id, deviceId: nullable(string), scenario: of('Scenario'), mode: of('Mode'),
    allocation: values('private', 'marketplace', 'legacy'), maximumDurationSeconds: integer,
    expectedTransaction: nullable(of('TransactionExpectation')), evidence: of('EvidenceConsent'),
    consentVersion: string, invitationId: id, state: of('RunState'), executionState: of('ExecutionState'),
    leaseState: of('LeaseState'), createdAt: date, updatedAt: date, reservationExpiresAt: date,
    stop: obj({ requestedAt: date, requesterRole: string, acknowledgedAt: nullable(date) }),
    acceptedWork: obj({ source: values('marketplace', 'private'), providerId: id, acceptedAt: date,
      method: values('manual', 'auto'), payout: of('Payout') }, ['source', 'providerId', 'acceptedAt', 'payout']),
    receipt: record, verification: record, paymentTerms: record,
    evaluationOutcome: values('passed', 'failed', 'unverified'), reportSeal: values('sealed'),
  }, ['id', 'projectId', 'buildId', 'deviceId', 'scenario', 'mode', 'allocation', 'state', 'createdAt', 'updatedAt']),
  Event: obj({ id: integer, type: string, at: date, data: record }),
  Action: obj({ id, type: of('ActionType'), args: record, createdAt: date,
    state: values('queued', 'completed', 'failed'), observation: record }, ['id', 'type', 'args', 'createdAt', 'state']),
  ActionType: values('launch', 'screenshot', 'describe', 'tap', 'back', 'wait', 'finish'),
  Invitation: obj({
    id, kind: values('developer_request', 'provider_share'), state: values('pending', 'reviewed', 'accepted', 'declined', 'revoked', 'expired'),
    deviceId: string, packageName: string, buildSha256: sha, scenario: of('Scenario'), mode: of('Mode'),
    maximumDurationSeconds: integer, evidence: of('EvidenceConsent'), consentVersion: string, payout: values('unpaid'),
    createdAt: date, expiresAt: date, reviewedAt: date, acceptedAt: date, declinedAt: date, revokedAt: date,
    runId: id, requester: userSummary, recipient: userSummary, viewerRole: values('requester', 'recipient'),
  }, ['id', 'kind', 'state', 'deviceId', 'packageName', 'buildSha256', 'scenario', 'mode', 'maximumDurationSeconds',
    'evidence', 'consentVersion', 'payout', 'createdAt', 'expiresAt', 'requester', 'recipient', 'viewerRole']),
  NewInvitation: { oneOf: [
    obj({ ...inviteBase, kind: { const: 'developer_request' }, projectId: id, buildId: id,
      expectedTransaction: of('TransactionExpectation') }, ['kind', 'deviceId', 'scenario', 'mode', 'projectId', 'buildId']),
    obj({ ...inviteBase, kind: { const: 'provider_share' }, targetUserId: id, packageName: string, buildSha256: sha },
      ['kind', 'deviceId', 'scenario', 'mode', 'targetUserId', 'packageName', 'buildSha256']),
  ] },
  MarketJob: obj({ id, requester: userSummary, packageName: string, buildSha256: sha, maximumDurationSeconds: integer,
    scenario: of('Scenario'), mode: of('Mode'), evidence: of('EvidenceConsent'), quote: of('Payout'),
    requirements: obj({ dedicatedAndroid: { const: true }, scenario: of('Scenario') }), availability: { const: 'available' },
    createdAt: date, expiresAt: date }),
  PayoutWallet: obj({ address: string, verifiedAt: nullable(date) }),
  Notification: obj({ id, type: string, data: record, createdAt: date, readAt: nullable(date) }),
  Quote: obj({ cluster: values('devnet'), asset: values('USDC'), mint: string, decimals: integer, amountAtoms: string,
    deposit: obj({ wallet: string, tokenAccount: string }), developerWallet: string, providerWallet: string,
    reference: id, expiresAt: date, funding: obj({ instruction: values('transferChecked'), tokenAccount: string, memo: string }) }),
  Payment: obj({ runId: id, state: string, quote: of('Quote'), funding: record, eligibleReportId: string,
    acceptedAt: date, settlement: record }, ['runId', 'state', 'quote']),
};

const runtimeClass = values('phone_human', 'phone_cooperative', 'dedicated_runner');
const taskFields = {
  title: string, kind: values('automated_test', 'human_test', 'agent_evaluation', 'human_demonstration', 'agent_correction'),
  runtimeClass, buildId: id, count: integer, instructions: string, maximumDurationSeconds: integer,
  minimumApi: integer, abi: nullable(string), maximumNetworkLatencyMs: nullable(integer), skill: nullable(string),
  actions: array(values('describe', 'advance')), scenario: of('Scenario'),
  expectedTransaction: of('TransactionExpectation'), testUnits: integer, stopTestUnits: integer, trainingEligible: boolean, referenceRunId: id,
};
const draftFields = {
  projectId: id, title: string, objective: string, tasks: array(of('CampaignTask')), deadlineAt: integer,
  budgetTestUnits: integer, retentionDays: integer, visibility: values('qualified_preview', 'invited'), contributorIds: array(id),
};
Object.assign(schemas, {
  CampaignTask: obj(taskFields, ['title', 'kind', 'runtimeClass', 'buildId', 'count', 'instructions']),
  CampaignDraft: obj(draftFields, ['projectId', 'title', 'objective', 'tasks', 'deadlineAt']),
  CampaignRevision: obj({ ...draftFields, tasks: array(record), sha256: sha }),
  Campaign: obj({ id, state: values('draft', 'active', 'paused', 'cancelled', 'completed'), revision: integer,
    revisions: array(of('CampaignRevision')), createdAt: integer, updatedAt: integer, assignmentIds: array(id) }),
  Assignment: obj({ id, campaignId: id, campaignRevision: integer, task: record, slot: integer,
    state: values('open', 'reserved', 'active', 'cleanup_pending', 'stopping', 'awaiting_submission', 'submitted',
      'needs_revision', 'accepted', 'partially_accepted', 'rejected', 'cancelled', 'interrupted', 'expired', 'dedicated'),
    terms: record, termsDigest: sha, expiresAt: integer, deadlineAt: integer, eligibleInstallationIds: array(id),
    attempt: record, run: of('Run'), compensation: record, referenceActions: array(record),
  }, ['id', 'campaignId', 'campaignRevision', 'task', 'slot', 'state', 'terms', 'termsDigest', 'expiresAt', 'deadlineAt']),
  CoverageCell: obj({ taskIndex: integer, kind: string, runtimeClass, planned: integer, attempted: integer,
    accepted: integer, measured: integer, passed: integer, failed: integer, blocked: integer, unverified: integer, missing: integer }),
  CampaignReport: obj({ campaign: of('Campaign'), cells: array(of('CoverageCell')), findings: array(record),
    reservedTestUnits: integer, acceptedTestUnits: integer, assignments: array(of('Assignment')) }),
  NativeProof: obj({ payload: string, signature: string }),
  NativeManifest: obj({ encoding: values('base64'), alg: values('ECDSA-P256-SHA256-DER'), payload: string,
    signature: string, sha256: sha, keyId: sha }),
  Installation: obj({ id, runtimeClass, policyVersion: string, readiness: string, policy: nullable(record),
    lastSeenAt: nullable(integer), windowExpiresAt: nullable(integer), activeLeaseId: nullable(id),
    credentialExpiresAt: integer, provenance: string }),
});

const paths = {};
const json = schema => ({ 'application/json': { schema } });
const err = { description: 'Stable error envelope', content: json(of('Error')) };
const positive = (schema, extra = {}) => ({ description: 'Success', content: { ...json(schema), ...extra } });
const parameter = (name, schema, where = 'query', required = false) => ({ name, in: where, schema, required });
function operation(path, method, summary, response, {
  body, auth = true, query = [], status = 200, extraContent, emptyResponse,
} = {}) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => parameter(name, string, 'path', true));
  const responseDoc = emptyResponse ? { description: emptyResponse } : positive(response, extraContent);
  const item = paths['/api/v1' + path] ??= {};
  item[method] = {
    summary, security: auth ? [{ [auth === true ? 'SessionBearer' : auth]: [] }] : [],
    parameters: [...parameters, ...query],
    ...(body ? { requestBody: { required: true, content: json(body) } } : {}),
    responses: { [status]: responseDoc, default: err },
  };
}
function get(path, summary, response, query) { operation(path, 'get', summary, response, { query }); }
function post(path, summary, response, body, options = {}) {
  operation(path, 'post', summary, response, { body, ...options });
}
const session = of('Session');
const user = envelope('user', of('User'));
const run = envelope('run', of('Run'));
const invitations = envelope('invitation', of('Invitation'));
const ownedDevice = envelope('device', of('OwnedDevice'));
const walletResult = envelope('payoutWallet', nullable(of('PayoutWallet')));
const streamQuery = [parameter('after', integer), parameter('Last-Event-ID', integer, 'header')];
const idempotency = [parameter('Idempotency-Key', string, 'header')];

post('/auth/register', 'Register a password account', session, obj({ ...account, registrationToken: string }, ['email', 'password']),
  { auth: false });
post('/auth/login', 'Create a developer session', session, obj(account), { auth: false });
post('/auth/logout', 'Revoke the current session', envelope('ok', boolean));
post('/auth/refresh', 'Rotate the current bearer session', session);
get('/auth/me', 'Read the current profile and capabilities', user);
operation('/auth/me', 'patch', 'Update the current profile', user, { body: envelope('displayName', string) });
post('/auth/email/start', 'Request a single-use email sign-in code',
  obj({ accepted: boolean, retryAfterSeconds: integer }), obj({ email: string, registrationToken: string }, ['email']),
  { auth: false });
post('/auth/email/verify', 'Exchange a delivered code for a session', session, obj({ email: string, code: string }), { auth: false });
post('/auth/google/start', 'Request a browser OAuth flow', envelope('url', string),
  obj({ challenge: authCode, registrationToken: string }, ['challenge']), { auth: false });
operation('/auth/google/callback', 'get', 'Complete OAuth and redirect with an exchange code', null, {
  auth: false, status: 303, emptyResponse: 'Redirect to configured frontend',
  query: [parameter('code', string), parameter('state', string), parameter('error', string)],
});
post('/auth/google/exchange', 'Exchange OAuth code bound to the originating client', session,
  obj({ code: string, verifier: authCode }), { auth: false });

get('/projects', 'List owned projects', envelopeList('projects', of('Project')));
post('/projects', 'Create a project', envelope('project', of('Project')), envelope('name', string), { status: 201 });
get('/builds', 'List owned APK builds', envelopeList('builds', of('Build')));
post('/builds', 'Upload a hashed APK', envelope('build', of('Build')),
  obj({ projectId: id, name: string, packageName: string, sha256: sha, apkBase64: string },
    ['projectId', 'name', 'sha256', 'apkBase64']), { status: 201 });
get('/devices', 'Discover visible devices', envelopeList('devices', of('Device')));
get('/runs', 'List owned runs', envelopeList('runs', of('Run')));
post('/runs', 'Queue an authorized scenario', run, of('CreateRun'), { status: 201, query: idempotency });
get('/runs/{runId}', 'Read owned run and report', run);
operation('/runs/{runId}/events', 'get', 'Poll or stream ordered run events', envelopeList('events', of('Event')), {
  query: streamQuery, extraContent: { 'text/event-stream': { schema: string } },
});
post('/runs/{runId}/cancel', 'Request stop and inspect acknowledgement', run);
post('/runs/{runId}/verify', 'Recheck an unresolved chain result', run);
get('/runs/{runId}/actions', 'List bounded actions with observations', envelopeList('actions', of('Action')));
post('/runs/{runId}/actions', 'Submit one bounded test action', envelope('action', of('Action')),
  obj({ type: of('ActionType'), args: obj({ target: string, ms: integer }, []) }, ['type']), { status: 201 });
operation('/runs/{runId}/evidence/{sha256}', 'get', 'Download a tenant-owned evidence artifact', null, {
  emptyResponse: 'Signed artifact bytes',
});
const payment = envelope('payment', nullable(of('Payment')));
get('/runs/{runId}/payment', 'Read Devnet payment and reconciliation', payment);
post('/runs/{runId}/quote', 'Create an immutable eligible Devnet quote', payment, obj({ developerWallet: string }, []));
post('/runs/{runId}/funding', 'Verify a finalized Devnet funding signature', payment, envelope('signature', string));
post('/runs/{runId}/settle', 'Settle a funded and eligible report', payment);
post('/runs/{runId}/reconcile', 'Reconcile the same payout signature', payment);

const trainingConsent = envelope('consent', obj({ developer: nullable(date), provider: nullable(date) }));
get('/runs/{runId}/training-consent', 'Read purpose-specific consent as a run participant', trainingConsent);
operation('/runs/{runId}/training-consent', 'put', 'Grant consent for training export', trainingConsent);
operation('/runs/{runId}/training-consent', 'delete', 'Withdraw consent for future training export', trainingConsent);
get('/runs/{runId}/training-export', 'Export a minimized, consented training trajectory as the developer', obj({
  format: values('agus.training-trajectory.v1'), purpose: values('training'), scenario: of('Scenario'),
  source: obj({ receiptId: string, manifestSha256: sha, trajectorySha256: sha, planner: string }),
  actions: array(obj({ index: integer, type: string, outcome: values('completed', 'failed'), offsetMs: integer,
    phase: string, selectedBy: values('gemini') }, ['index', 'type', 'outcome', 'offsetMs'])),
}));

get('/me/devices', 'List provider-owned device records', envelopeList('devices', of('OwnedDevice')));
post('/me/devices/pairings', 'Issue a one-time runner pairing code', envelope('pairing', obj({ code: string, expiresAt: date })),
  undefined, { status: 201 });
get('/me/devices/{deviceId}', 'Read a provider-owned device', ownedDevice);
operation('/me/devices/{deviceId}', 'patch', 'Update device availability preferences', ownedDevice, { body: of('UpdateDevice') });
operation('/me/devices/{deviceId}', 'delete', 'Revoke device authorization', ownedDevice);
post('/me/devices/{deviceId}/diagnostics', 'Inspect the latest device diagnostics', envelope('diagnostics', of('Diagnostic')));
get('/me/payout-wallet', 'Read the verified account payout wallet', walletResult);
operation('/me/payout-wallet', 'delete', 'Disconnect the account payout wallet', walletResult);
post('/me/payout-wallet/challenge', 'Create an account-scoped Devnet ownership challenge', envelope('challenge', record), envelope('wallet', string));
post('/me/payout-wallet/verify', 'Verify exact account wallet ownership', walletResult, obj({ challengeId: string, signature: string }));
get('/me/devices/{deviceId}/payout-wallet', 'Read the verified payout wallet', walletResult);
operation('/me/devices/{deviceId}/payout-wallet', 'delete', 'Disconnect the payout wallet for future work', walletResult);
post('/me/devices/{deviceId}/payout-wallet/challenge', 'Create a domain-bound Devnet wallet challenge',
  envelope('challenge', record), envelope('wallet', string));
post('/me/devices/{deviceId}/payout-wallet/verify', 'Verify ownership and store the future payout destination',
  walletResult, obj({ challengeId: string, signature: string }));
get('/me/sessions', 'List sessions visible to the provider', envelopeList('runs', of('Run')));
get('/me/sessions/{runId}', 'Read the provider session summary', run);
get('/me/sessions/{runId}/events', 'Poll the provider session event stream', envelopeList('events', of('Event')),
  [parameter('after', integer)]);
post('/me/sessions/{runId}/stop', 'Request stop on a provider-owned session', run);
get('/me/earnings', 'Read actual provider settlement aggregates', envelope('earnings', record),
  [parameter('deviceId', string, 'query', true), parameter('from', string), parameter('to', string), parameter('bucket', values('day', 'week', 'month'))]);
const inboxPreferences = obj({ completedRuns: boolean, campaignUpdates: boolean });
get('/me/notifications/preferences', 'Read in-app notification preferences', envelope('preferences', inboxPreferences));
operation('/me/notifications/preferences', 'patch', 'Change optional in-app notification categories', envelope('preferences', inboxPreferences),
  { body: obj({ completedRuns: boolean, campaignUpdates: boolean }, []) });
get('/me/notifications', 'Read owner-filtered notifications', envelopeList('notifications', of('Notification')));
post('/me/notifications/{notificationId}/read', 'Mark a notification read', envelope('notification', of('Notification')));

get('/invitations', 'List private invitations involving the authenticated person', envelopeList('invitations', of('Invitation')));
post('/invitations', 'Create a target-bound private invitation', obj({ invitation: of('Invitation'), token: string }),
  of('NewInvitation'), { status: 201, query: idempotency });
post('/invitations/review', 'Review a private link as its targeted recipient', invitations, envelope('token', string));
post('/invitations/{invitationId}/review', 'Review a private request from the inbox', invitations);
post('/invitations/{invitationId}/accept', 'Accept reviewed, unpaid private work',
  obj({ invitation: of('Invitation'), run: of('Run') }),
  obj({ projectId: id, buildId: id, expectedTransaction: of('TransactionExpectation') }, []));
post('/invitations/{invitationId}/decline', 'Decline private work', invitations);
post('/invitations/{invitationId}/revoke', 'Revoke a private authorization',
  obj({ invitation: of('Invitation'), run: of('Run') }, ['invitation']));
get('/marketplace/jobs', 'List workload offers for an eligible provider device', envelopeList('jobs', of('MarketJob')),
  [parameter('deviceId', string, 'query', true)]);
post('/marketplace/jobs/{runId}/decline', 'Hide this queued offer for an owned device', envelope('declined', boolean), envelope('deviceId', string));
post('/marketplace/jobs/{runId}/accept', 'Reserve matching unpaid marketplace work',
  run, envelope('deviceId', string));

const campaign = envelope('campaign', of('Campaign'));
const assignment = envelope('assignment', of('Assignment'));
const installation = envelope('installation', of('Installation'));
const campaignConsent = obj({ purpose: values('training'), termsDigest: sha,
  contributorGrantedAt: nullable(integer), developerGrantedAt: nullable(integer) });
get('/campaigns', 'List owned campaigns in the local preview', envelopeList('campaigns', of('Campaign')));
post('/campaigns', 'Create an immutable first draft revision', campaign, of('CampaignDraft'), { query: idempotency });
get('/campaigns/{campaignId}', 'Read a campaign and its immutable revisions', campaign);
operation('/campaigns/{campaignId}', 'patch', 'Revise an owned draft', campaign,
  { body: obj({ expectedRevision: integer, draft: of('CampaignDraft') }) });
for (const action of ['launch', 'pause', 'resume', 'cancel', 'complete']) {
  post('/campaigns/{campaignId}/' + action, 'Transition an owned campaign', campaign, envelope('expectedRevision', integer));
}
get('/campaigns/{campaignId}/report', 'Read qualified coverage, review and findings', envelope('report', of('CampaignReport')));
post('/campaigns/{campaignId}/exports', 'Prepare accepted evidence after both training grants', envelope('export', record),
  obj({ purpose: values('training'), assignmentIds: array(id) }));
get('/campaigns/{campaignId}/exports/{exportId}', 'Deliver redacted data with current consent', envelope('export', record));
get('/me/assignments', 'List assigned or eligible coverage slots', envelopeList('assignments', of('Assignment')));
post('/me/assignments/{assignmentId}/accept', 'Reserve a coverage slot after reviewing scope', assignment,
  obj({ termsDigest: sha, installationId: id, consent: { const: true } }));
post('/me/assignments/{assignmentId}/decline', 'Decline a coverage slot', envelope('declined', boolean), obj({}));
post('/me/assignments/{assignmentId}/stop', 'Request owner stop on the active attempt', assignment, obj({}));
const consentPath = '/me/assignments/{assignmentId}/training-consent';
get(consentPath, 'Read separate training rights for the assignment', campaignConsent);
operation(consentPath, 'put', 'Grant current training rights', campaignConsent, { body: obj({ termsDigest: sha, grant: { const: true } }) });
operation(consentPath, 'delete', 'Withdraw future training delivery rights', campaignConsent);
post('/assignments/{assignmentId}/submissions', 'Submit redacted structured evidence after cleanup', assignment,
  obj({ attemptId: id, expectedVersion: integer, steps: array(string), expected: string, actual: string,
    result: values('passed', 'failed', 'blocked'), category: values('bug', 'usability', 'validation', 'agent_correction'),
    correction: record }, ['attemptId', 'expectedVersion', 'steps', 'expected', 'actual', 'result', 'category']));
post('/assignments/{assignmentId}/reviews', 'Review an exact submission or record disclosed partial credit', assignment,
  obj({ attemptId: id, version: integer, decision: values('accept', 'revise', 'reject', 'partial'), reason: string }));
get('/assignments/{assignmentId}/receipt', 'Download the scoped native receipt and key', envelope('receipt', record));
get('/qualification-appeals', 'List pending appeals for a configured local reviewer', envelopeList('appeals', record));
post('/qualification-appeals/{qualificationId}/review', 'Adjudicate a current test qualification appeal', envelope('appeal', record),
  obj({ decision: values('uphold', 'retest', 'accept_reproduction'), decisionReason: string }));
get('/me/qualifications', 'Read exercises, current qualification and review history', record);
post('/me/qualifications/{version}/submissions', 'Score the reviewed qualification exercise', record,
  obj({ sequence: array(string), expectedCode: string, actualCode: string, walletAnswer: string, evidenceNote: string }));
post('/me/qualifications/{qualificationId}/appeal', 'Submit a person-owned qualification appeal', record, envelope('reason', string));
get('/me/campaign-earnings', 'Read nontransferable preview obligations', envelope('earnings', record));
post('/me/runtime-enrollments', 'Create a single-use native enrollment challenge', envelope('enrollment', record),
  obj({ runtimeClass: values('phone_human', 'phone_cooperative'), appVersion: string, policyVersion: string }));
post('/me/runtime-enrollments/{installationId}/complete', 'Verify native installation proof', obj({ installation: of('Installation'), credential: string }),
  obj({ publicKey: string, proof: of('NativeProof') }));
get('/me/runtime-installations', 'List owned native installations', envelopeList('installations', of('Installation')));
operation('/me/runtime-installations/{installationId}', 'delete', 'Revoke an owned native installation', installation);
post('/runtime/installations/{installationId}/heartbeat', 'Record a signed native policy observation', installation,
  of('NativeProof'), { auth: 'RuntimeBearer' });
post('/runtime/installations/{installationId}/claim', 'Exchange a reservation for a signed workload grant',
  envelope('lease', obj({ id, manifest: of('NativeManifest'), credential: string, expiresAt: integer, serverNow: integer })),
  envelope('assignmentId', id), { auth: 'RuntimeBearer' });
operation('/runtime/leases/{leaseId}', 'get', 'Renew and read native authority', envelope('lease', record), { auth: 'LeaseBearer' });
operation('/runtime/leases/{leaseId}/build', 'get', 'Download the leased reviewed APK', null, {
  auth: 'LeaseBearer', emptyResponse: 'Reviewed pinned APK bytes',
});
post('/runtime/leases/{leaseId}/report', 'Seal a native execution report', envelope('report', record), of('NativeProof'), { auth: 'LeaseBearer' });
post('/runtime/leases/{leaseId}/stop', 'Fence authority after local owner stop', envelope('lease', record), of('NativeProof'), { auth: 'LeaseBearer' });
post('/runtime/leases/{leaseId}/cleanup', 'Acknowledge actual profile cleanup', envelope('cleanup', record), of('NativeProof'), { auth: 'LeaseBearer' });

const spec = {
  openapi: '3.1.0', info: { title: 'AGUS AI control plane', version: '0.1.0' },
  paths, components: { schemas, securitySchemes: {
    SessionBearer: { type: 'http', scheme: 'bearer' }, RuntimeBearer: { type: 'http', scheme: 'bearer' },
    LeaseBearer: { type: 'http', scheme: 'bearer' },
  } },
};
const specPath = new URL('./openapi.json', import.meta.url);
const typesPath = new URL('./src/http.generated.d.ts', import.meta.url);
const generated = [
  [specPath, JSON.stringify(spec, null, 2) + '\n'],
  [typesPath, astToString(await openapiTS(spec, { alphabetize: true }))],
];
for (const [file, content] of generated) {
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== content) throw new Error('Regenerate ' + file.pathname);
  } else {
    await writeFile(file, content);
  }
}
