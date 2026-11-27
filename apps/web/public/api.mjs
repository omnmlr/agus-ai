export const MAX_APK_BYTES = 25 * 1024 * 1024;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function createApi(token, fetcher = fetch) {
  async function request(path, { method = 'GET', body, responseType = 'json' } = {}) {
    const endpoint = `/api/v1${path}`;
    const headers = new Headers({ Accept: responseType === 'json' ? 'application/json' : '*/*' });
    const bearer = token();
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetcher(endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    } catch {
      throw new ApiError('Could not reach the control plane. Check the connection and try again.', 0, 'network_error');
    }
    if (response.ok && responseType === 'blob') return response.blob();
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('The control plane returned an unreadable response.', response.status, 'invalid_response');
    }
    if (!response.ok) {
      throw new ApiError(data?.error?.message || `Request failed with HTTP ${response.status}.`, response.status, data?.error?.code);
    }
    return data;
  }
  return {
    get: (path) => request(path),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    delete: path => request(path, { method: 'DELETE' }),
    post: (path, body) => request(path, { method: 'POST', body }),
    download: (path) => request(path, { responseType: 'blob' }),
  };
}

export async function readApk(file, cryptography = globalThis.crypto) {
  if (!file || !/\.apk$/i.test(file.name) || file.size === 0) throw new Error('Choose a non-empty .apk file.');
  if (file.size > MAX_APK_BYTES) throw new Error('The APK exceeds the 25 MiB upload limit.');
  if (!cryptography?.subtle) throw new Error('Open the console over HTTPS or localhost to hash APK files.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await cryptography.subtle.digest('SHA-256', bytes));
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const encoded = [];
  const chunkSize = 12 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    encoded.push(btoa(String.fromCharCode(...chunk)));
  }
  return { sha256, apkBase64: encoded.join('') };
}
