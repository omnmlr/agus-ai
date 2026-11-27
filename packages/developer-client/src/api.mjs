import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

export const scenarios = ['app-launch', 'wallet-connect', 'wallet-transfer', 'wallet-false-success'];
export const modes = ['scripted', 'agent'];
export const actions = ['launch', 'screenshot', 'describe', 'tap', 'back', 'wait', 'finish'];
const MAX_APK_BYTES = 32 * 1024 * 1024;

export function apiOrigin(input) {
  if (!input) throw new Error('Set AGUS_API_URL to the control plane origin');
  const url = new URL(input);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || (url.protocol !== 'https:' && (url.protocol !== 'http:' || !loopback))) {
    throw new Error('Use an HTTPS origin or a local HTTP loopback origin');
  }
  return url.origin;
}

export function createClient({ origin, token, fetchImpl = fetch }) {
  const base = apiOrigin(origin);
  const request = async (method, segments, body, idempotencyKey) => {
    const path = segments.map(encodeURIComponent).join('/');
    const response = await fetchImpl(`${base}/api/v1/${path}`, {
      method, headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const code = result?.error?.code ?? result?.code;
      const message = result?.error?.message ?? result?.message ?? response.statusText;
      throw new Error([code ?? `HTTP ${response.status}`, message].filter(Boolean).join(' — '));
    }
    if (!result || typeof result !== 'object') throw new Error('Unexpected control plane response');
    return result;
  };
  return {
    login: (email, password) => request('POST', ['auth', 'login'], { email, password }),
    register: (email, password, registrationToken) => request('POST', ['auth', 'register'], {
      email, password, ...(registrationToken ? { registrationToken } : {}),
    }),
    devices: () => request('GET', ['devices']),
    projects: () => request('GET', ['projects']),
    createProject: (name) => request('POST', ['projects'], { name }),
    builds: () => request('GET', ['builds']),
    createBuild: (build) => request('POST', ['builds'], build),
    campaigns: () => request('GET', ['campaigns']),
    createCampaign: (draft, idempotencyKey) => request('POST', ['campaigns'], draft, idempotencyKey),
    changeCampaign: (id, action, expectedRevision) => request('POST', ['campaigns', id, action], { expectedRevision }),
    campaignReport: id => request('GET', ['campaigns', id, 'report']),
    runs: () => request('GET', ['runs']),
    createRun: (input, idempotencyKey) => request('POST', ['runs'], input, idempotencyKey),
    invitations: () => request('GET', ['invitations']),
    createInvitation: (input, idempotencyKey) => request('POST', ['invitations'], input, idempotencyKey),
    run: (id) => request('GET', ['runs', id]),
    events: (id) => request('GET', ['runs', id, 'events']),
    cancel: (id) => request('POST', ['runs', id, 'cancel'], {}),
    agentActions: (id) => request('GET', ['runs', id, 'actions']),
    act: (id, input) => request('POST', ['runs', id, 'actions'], input),
  };
}

export async function readBuild(projectId, packageName, name, file) {
  const info = await stat(file);
  if (!info.isFile() || info.size < 1 || info.size > MAX_APK_BYTES) {
    throw new Error('Provide an APK file between 1 byte and 32 MiB');
  }
  const bytes = await readFile(file);
  if (bytes.length !== info.size) throw new Error('APK changed while reading');
  return {
    projectId, packageName, name,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    apkBase64: bytes.toString('base64'),
  };
}
