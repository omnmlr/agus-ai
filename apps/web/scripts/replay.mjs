import receipt from '../../../docs/phase-2-3/evidence/devnet-2026-11-28/receipt-private.json' with { type: 'json' };
import sas from '../../../docs/phase-2-3/evidence/devnet-2026-11-28/sas-attestation.json' with { type: 'json' };

const { manifest, manifestSha256 } = receipt;
const { independentVerification: verification } = sas;
if (manifestSha256 !== verification.claim.manifest_sha256) {
  throw new Error('Execution theater receipt and attestation refer to different digests.');
}
function check(id) {
  if (manifest.checks.find(item => item.id === id)?.passed !== true) throw new Error('Missing replay check: ' + id);
  return id + ' · passed';
}
const short = value => value.slice(0, 8) + '…' + value.slice(-6);

export const replay = {
  source: 'https://github.com/omnmlr/agus-ai/tree/c2e2a97a252b0b36788cef715dc6cd37eed8e384/docs/phase-2-3/evidence/devnet-2026-11-28',
  explorer: 'https://explorer.solana.com/tx/' + sas.attestation.signature + '?cluster=devnet',
  run: manifest.runId.slice(0, 8),
  command: 'agus run ' + manifest.runId,
  build: manifest.buildSha256,
  digest: manifestSha256,
  chapters: [
    { name: 'Build', state: 'Build identified', detail: 'Exact APK fingerprint', evidence: 'Build SHA-256', value: short(manifest.buildSha256) },
    { name: 'Allocate', state: 'Runner reserved', detail: 'Scoped Android lease', evidence: 'Runner lease', value: short(manifest.leaseId) },
    { name: 'Execute', state: 'Wallet transfer', detail: 'Scripted checks and agent actions', evidence: 'Device actions', value: String(manifest.execution.deviceActionCount) },
    { name: 'Seal', state: 'Execution complete', detail: 'Signed evidence collected', evidence: 'Receipt digest', value: short(manifestSha256) },
    { name: 'Verify', state: 'Receipt verified', detail: 'Solana Devnet attestation', evidence: 'Finalized read slot', value: new Intl.NumberFormat('en-US').format(verification.slot) },
  ],
  events: [
    { at: 0, chapter: 0, label: 'Build registered', detail: 'APK fingerprint bound to the run', screen: 'build' },
    { at: 2550, chapter: 0, label: 'Build identity checked', detail: check('approved-build'), screen: 'build' },
    { at: 4400, chapter: 1, label: 'Runner allocated', detail: 'Lease ' + short(manifest.leaseId), screen: 'lease' },
    { at: 5850, chapter: 2, label: 'Android app launched', detail: check('app-launched'), screen: 'launch' },
    { at: 7650, chapter: 2, label: 'Wallet authorization', detail: check('wallet-authorized'), screen: 'authorize' },
    { at: 9550, chapter: 2, label: 'Wallet callback received', detail: check('wallet-callback'), screen: 'callback' },
    { at: 11150, chapter: 2, label: 'Test transaction finalized', detail: manifest.transaction.network + ' · ' + check('transaction-finalized'), screen: 'finalized' },
    { at: 12700, chapter: 3, label: 'Evidence sealed', detail: receipt.evidence.length + ' artifacts · Ed25519 runner signature', screen: 'sealed' },
    { at: 14500, chapter: 3, label: 'Runner cleanup confirmed', detail: check('cleanup'), screen: 'sealed' },
    { at: 16200, chapter: 4, label: 'Receipt attestation verified', detail: 'Solana Devnet · finalized · receipt-digest', screen: 'verified' },
  ],
};
