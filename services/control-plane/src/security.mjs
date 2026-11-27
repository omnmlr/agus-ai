import {
  createHash, createPublicKey, randomBytes, scrypt, timingSafeEqual, verify,
} from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const hex256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const publicAddress = (value) => typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);

export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function requireCondition(condition, message, code = 'invalid_request', status = 400) {
  if (!condition) throw new HttpError(status, code, message);
}

export function badInput(field) {
  return new HttpError(400, 'invalid_request', `Invalid ${field}`);
}

export function string(value, field, max, min = 1) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw badInput(field);
  }
  return value;
}

export function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badInput(field);
  return value;
}

export function array(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw badInput(field);
  return value;
}

export function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  return timingSafeEqual(Buffer.from(digest(left), 'hex'), Buffer.from(digest(right), 'hex'));
}

export function bearer(request) {
  const value = request.headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ')
    ? value.slice(7) : '';
}

export async function passwordRecord(password, salt = randomBytes(16).toString('hex')) {
  const hash = await derive(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

export function publicKey(value) {
  const pem = string(value, 'publicKeyPem', 512);
  try {
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType === 'ed25519') {
      return key.export({ type: 'spki', format: 'pem' });
    }
  } catch { /* validated below */ }
  throw badInput('Ed25519 publicKeyPem');
}

export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(
      (key) => JSON.stringify(key) + ':' + stableJson(value[key]),
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function validSignature(publicKeyPem, manifest, signature) {
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  return verify(null, Buffer.from(stableJson(manifest)), publicKeyPem, Buffer.from(signature, 'base64'));
}

export function decodeBase64(value, field, max) {
  const encoded = string(value, field, 4 * Math.ceil(max / 3));
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > max || bytes.toString('base64') !== encoded) {
    throw badInput(field);
  }
  return bytes;
}

export async function readJson(request, maxBytes) {
  const contentType = request.headers['content-type']?.split(';')[0];
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Expected application/json');
  }
  if (Number(request.headers['content-length']) > maxBytes) {
    request.resume();
    throw new HttpError(413, 'too_large', 'Request exceeds the configured size limit');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) {
      request.resume();
      throw new HttpError(413, 'too_large', 'Request exceeds the configured size limit');
    }
    chunks.push(chunk);
  }
  try {
    return object(JSON.parse(Buffer.concat(chunks).toString('utf8')), 'JSON body');
  } catch {
    throw badInput('JSON body');
  }
}
