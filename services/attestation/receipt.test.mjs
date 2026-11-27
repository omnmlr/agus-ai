import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import {
  deriveAttestationPda, deriveSchemaPda, getAttestationEncoder, getCredentialEncoder, getSchemaEncoder,
  serializeAttestationData, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as program,
} from 'sas-lib';
import { digest, stableJson } from '../control-plane/src/security.mjs';
import { field, name, receiptClaim, verifyDevnetAttestation } from './receipt.mjs';

test('a finalized SAS account binds a signed receipt to an active trusted issuer', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const manifest = { version: 1, outcome: 'completed' };
  const receipt = { manifest, manifestSha256: digest(stableJson(manifest)),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    signature: sign(null, Buffer.from(stableJson(manifest)), privateKey).toString('base64') };
  const credential = '11111111111111111111111111111111';
  const signer = 'EMtq5F54UxgEwYx1bmZpRJXNodBPPqjFekwQZNjpzH3w';
  const nonce = 'So11111111111111111111111111111111111111112';
  const [schema] = await deriveSchemaPda({ credential, name, version: 1 });
  const [attestation] = await deriveAttestationPda({ credential, schema, nonce });
  const layout = { discriminator: 2, credential, name: Buffer.from(name), description: Buffer.alloc(0),
    layout: Buffer.from([12]), fieldNames: Buffer.concat([Buffer.from([field.length, 0, 0, 0]), Buffer.from(field)]),
    isPaused: false, version: 1 };
  const encoded = (codec, value) => ({ owner: program, executable: false,
    data: [Buffer.from(codec.encode(value)).toString('base64'), 'base64'] });
  const accounts = [
    encoded(getCredentialEncoder(), { discriminator: 1, authority: signer, name: Buffer.from('issuer'), authorizedSigners: [] }),
    encoded(getSchemaEncoder(), layout),
    encoded(getAttestationEncoder(), { discriminator: 0, nonce, credential, schema, signer, expiry: 9_000n,
      tokenAccount: credential, data: serializeAttestationData(layout, receiptClaim(receipt)) }),
  ];
  const rpc = async (method, params) => {
    if (method === 'getGenesisHash') return 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
    assert.deepEqual(params[0], [credential, schema, attestation]);
    assert.equal(params[1].commitment, 'finalized');
    return { context: { slot: 123 }, value: accounts };
  };
  const input = { receipt, credential, signer, nonce, rpc, now: 1_000 };
  const result = await verifyDevnetAttestation(input);
  assert.equal(result.scope, 'receipt-digest');
  assert.equal(result.slot, 123);
  await assert.rejects(verifyDevnetAttestation({ ...input, signer: nonce }), /trusted issuer/);
  await assert.rejects(verifyDevnetAttestation({ ...input, now: 10_000_000 }), /active receipt/);
  assert.throws(() => receiptClaim({ ...receipt, manifest: { ...manifest, outcome: 'failed' } }), /Invalid execution/);
});
