import { createHash, createPublicKey, verify } from 'node:crypto';

const algorithm = 'ECDSA-P256-SHA256-DER';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function bytes(value, limit) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(limit / 3) * 4) {
    throw new Error('Invalid receipt encoding');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length > limit || decoded.toString('base64') !== value) throw new Error('Invalid receipt encoding');
  return decoded;
}

function key(encoded) {
  const der = bytes(encoded, 120);
  const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' });
  if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails.namedCurve !== 'prime256v1'
    || !publicKey.export({ format: 'der', type: 'spki' }).equals(der)) throw new Error('Expected a P-256 SPKI public key');
  return { publicKey, fingerprint: sha256(der) };
}

function signedJson(envelope, publicKey, sha) {
  const body = bytes(envelope?.payload, 8_192);
  if (sha256(body) !== sha || !verify('sha256', body, publicKey, bytes(envelope.signature, 72))) {
    throw new Error('Receipt digest or signature verification failed');
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
}

export function verifyNativeReceipt(receipt, trustedManifestKey) {
  const { manifest, report, cleanup } = receipt;
  const issuer = key(trustedManifestKey);
  if (receipt.algorithm !== algorithm || manifest?.alg !== algorithm || manifest.encoding !== 'base64'
    || manifest.keyId !== issuer.fingerprint) throw new Error('Receipt manifest key or algorithm differs');
  const workload = signedJson(manifest, issuer.publicKey, manifest.sha256);
  const installation = key(receipt.publicKey);
  if (workload.v !== 1 || workload.type !== 'agus.native.workload'
    || workload.installationKeySha256 !== installation.fingerprint) throw new Error('Manifest does not bind the installation key');

  function proof(record, kind) {
    const value = signedJson(record?.proof, installation.publicKey, record?.sha256);
    if (value.v !== 1 || value.kind !== kind || value.installationId !== workload.audience
      || value.leaseId !== workload.leaseId || value.challenge !== workload.challenge || value.fence !== workload.fence
      || value.manifestSha256 !== manifest.sha256) throw new Error('Receipt proof does not bind the signed workload');
    return value;
  }

  const signedReport = proof(report, 'report');
  const signedCleanup = cleanup ? proof(cleanup, 'cleanup') : null;
  if (signedCleanup && (signedCleanup.installRestricted !== true || signedCleanup.packageAbsent !== true)) {
    throw new Error('Signed cleanup does not confirm package absence and restored install policy');
  }
  return { valid: true, assignmentId: workload.assignmentId, attemptId: workload.attemptId,
    runtimeClass: workload.runtimeClass, buildSha256: workload.build.sha256, outcome: signedReport.outcome,
    observations: signedReport.observations, cleanupConfirmed: Boolean(signedCleanup) };
}
