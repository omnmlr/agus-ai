import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { badInput, decodeBase64, digest, hex256, object, requireCondition, stableJson } from './security.mjs';

export const nativeClasses = ['phone_human', 'phone_cooperative'];
export const workProfilePolicy = 'managed-profile-v1';
export const sdkVersion = 'cooperative-v1';

export function exact(value, fields, label) {
  object(value, label);
  requireCondition(Object.keys(value).every(key => fields.includes(key)), 'Unexpected field in ' + label);
  return value;
}

export function integer(value, minimum, maximum, label) {
  requireCondition(Number.isSafeInteger(value) && value >= minimum && value <= maximum, 'Invalid ' + label);
  return value;
}

export function own(collection, id) {
  return typeof id === 'string' && Object.hasOwn(collection, id) ? collection[id] : undefined;
}

export function conflict(condition, message, code = 'state_conflict') {
  requireCondition(condition, message, code, 409);
}

export function missing(condition, label) {
  requireCondition(condition, label + ' not found', 'not_found', 404);
}

export function pilotConfig(env) {
  if (env.AGUS_PRODUCT_PILOT !== '1') return null;
  if (env.NODE_ENV === 'production' || !['127.0.0.1', '::1', 'localhost'].includes(env.HOST ?? '127.0.0.1')) {
    throw new Error('AGUS_PRODUCT_PILOT requires a local non-production listener');
  }

  let key;
  try {
    key = createPrivateKey({ key: Buffer.from(env.AGUS_NATIVE_MANIFEST_PKCS8 ?? '', 'base64'), format: 'der', type: 'pkcs8' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') throw new Error();
  } catch {
    throw new Error('AGUS_NATIVE_MANIFEST_PKCS8 must be a disposable P-256 PKCS8 key');
  }
  let entries;
  try {
    entries = JSON.parse(env.AGUS_NATIVE_REVIEWED_BUILDS ?? '[]');
    if (!Array.isArray(entries) || entries.length > 16) throw new Error();
    for (const entry of entries) {
      exact(entry, ['sha256', 'packageName', 'signerSha256', 'component'], 'reviewed workload');
      if (!hex256(entry.sha256) || !hex256(entry.signerSha256)
        || typeof entry.packageName !== 'string' || entry.packageName.length > 120
        || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(entry.packageName)
        || entry.packageName.startsWith('com.android.') || entry.packageName.startsWith('com.google.android.')
        || ['app.agus.runtime.preview', 'app.agus.companion'].includes(entry.packageName)) throw new Error();
      const component = entry.component ?? '.TestActivity';
      if (typeof component !== 'string' || component.length > 120 || !/^(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(component)) throw new Error();
      entry.component = entry.packageName + component;
    }
    if (new Set(entries.map(entry => entry.sha256)).size !== entries.length) throw new Error();
  } catch {
    throw new Error('AGUS_NATIVE_REVIEWED_BUILDS must list exact local preview APK, package, and signer digests');
  }
  const reviewerIds = (env.AGUS_PILOT_REVIEWER_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (reviewerIds.length > 30 || reviewerIds.some(id => !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))) {
    throw new Error('AGUS_PILOT_REVIEWER_IDS must contain local person IDs');
  }
  return {
    reviewerIds: new Set(reviewerIds),
    manifestSigningKey: key,
    manifestKeyId: digest(createPublicKey(key).export({ format: 'der', type: 'spki' })),
    reviewedBuilds: new Map(entries.map(entry => [entry.sha256, entry])),
  };
}

export function p256PublicKey(encoded) {
  const bytes = decodeBase64(encoded, 'P-256 public key', 120);
  try {
    const key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails.namedCurve === 'prime256v1'
      && key.export({ format: 'der', type: 'spki' }).equals(bytes)) return key;
  } catch { /* Report the stable validation error below. */ }
  throw badInput('P-256 public key');
}

export function manifestEnvelope(pilot, document) {
  const bytes = Buffer.from(stableJson(document));
  return {
    encoding: 'base64', alg: 'ECDSA-P256-SHA256-DER', keyId: pilot.manifestKeyId,
    payload: bytes.toString('base64'), sha256: digest(bytes),
    signature: sign('sha256', bytes, pilot.manifestSigningKey).toString('base64'),
  };
}

export function verifyNativeProof(publicKey, input, maxBytes = 8_192) {
  exact(input, ['payload', 'signature'], 'signed proof');
  const bytes = decodeBase64(input.payload, 'signed payload', maxBytes);
  const signature = decodeBase64(input.signature, 'DER signature', 72);
  requireCondition(verify('sha256', bytes, p256PublicKey(publicKey), signature),
    'Signature verification failed', 'invalid_proof', 403);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw badInput('signed payload'); }
  object(value, 'signed payload');
  return { value, sha256: digest(bytes) };
}

export function qualifyingPolicy(policy) {
  exact(policy, ['managed', 'profileOwner', 'crossProfileCopyBlocked', 'unlocked', 'foreground',
    'installerRestricted', 'apiLevel', 'charging', 'batteryPercent', 'availableStorageMiB', 'thermalStatus',
    'abi', 'networkLatencyMs'], 'profile policy');
  for (const key of ['managed', 'profileOwner', 'crossProfileCopyBlocked', 'unlocked', 'foreground',
    'installerRestricted', 'charging']) requireCondition(typeof policy[key] === 'boolean', 'Invalid policy field ' + key);
  integer(policy.apiLevel, 1, 100, 'API level');
  integer(policy.batteryPercent, 0, 100, 'battery percentage');
  integer(policy.availableStorageMiB, 0, 10_000_000, 'storage availability');
  integer(policy.thermalStatus, 0, 6, 'thermal status');
  if (policy.networkLatencyMs !== undefined) integer(policy.networkLatencyMs, 0, 60_000, 'network round-trip');
  requireCondition(['arm64-v8a', 'x86_64', 'other'].includes(policy.abi), 'Invalid profile ABI');
  return policy.managed && policy.profileOwner && policy.crossProfileCopyBlocked && policy.unlocked
    && policy.foreground && policy.installerRestricted && policy.apiLevel >= 35
    && policy.batteryPercent >= 25 && policy.availableStorageMiB >= 200
    && policy.thermalStatus <= 2 && policy.abi !== 'other';
}

export function boundJson(value, depth = 0) {
  requireCondition(depth <= 12, 'Pilot input is nested too deeply');
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) boundJson(child, depth + 1);
  }
}
