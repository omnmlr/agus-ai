import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { generateKeyPairSigner, getAddressDecoder } from '@solana/kit';
import {
  deriveAttestationPda, deriveSchemaPda, getAttestationEncoder, getCredentialEncoder, getSchemaEncoder,
  serializeAttestationData, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as program,
} from 'sas-lib';
import { digest, stableJson } from '../control-plane/src/security.mjs';
import { authorizedReceiptClaim, issueSas } from './issue.mjs';
import { devnetGenesis, field, name, receiptClaim, verifyDevnetAttestation } from './receipt.mjs';

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

test('issuance signs only trusted receipt claims and reuses the deterministic finalized account', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const manifest = { version: 1, outcome: 'completed' };
  const trustedReceiptKey = publicKey.export({ type: 'spki', format: 'pem' });
  const receipt = { manifest, manifestSha256: digest(stableJson(manifest)), publicKeyPem: trustedReceiptKey,
    signature: sign(null, Buffer.from(stableJson(manifest)), privateKey).toString('base64') };
  const issuer = await generateKeyPairSigner();
  const credential = (await generateKeyPairSigner()).address;
  const nonce = getAddressDecoder().decode(Buffer.from(digest('agus-sas-receipt-v1:' + receipt.manifestSha256), 'hex'));
  const [schema] = await deriveSchemaPda({ credential, name, version: 1 });
  const [attestation] = await deriveAttestationPda({ credential, schema, nonce });
  const layout = { discriminator: 2, credential, name: Buffer.from(name), description: Buffer.alloc(0),
    layout: Buffer.from([12]), fieldNames: Buffer.concat([Buffer.from([field.length, 0, 0, 0]), Buffer.from(field)]),
    isPaused: false, version: 1 };
  const encoded = (codec, value) => ({ owner: program, executable: false,
    data: [Buffer.from(codec.encode(value)).toString('base64'), 'base64'] });
  const entries = {
    [credential]: encoded(getCredentialEncoder(), { discriminator: 1, authority: issuer.address, name: Buffer.from('issuer'), authorizedSigners: [] }),
    [schema]: encoded(getSchemaEncoder(), layout),
  };
  let submissions = 0;
  const rpc = async (method, params) => {
    if (method === 'getGenesisHash') return devnetGenesis;
    if (method === 'getAccountInfo') return { value: entries[params[0]] ?? null };
    if (method === 'getLatestBlockhash') {
      return { value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100 } };
    }
    if (method === 'sendTransaction') {
      assert.ok(Buffer.from(params[0], 'base64').length > 100);
      submissions++;
      entries[attestation] = encoded(getAttestationEncoder(), { discriminator: 0, nonce, credential, schema, signer: issuer.address,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 1800), tokenAccount: credential, data: serializeAttestationData(layout, receiptClaim(receipt)) });
      throw new Error('simulated lost acknowledgement');
    }
    assert.equal(method, 'getMultipleAccounts');
    return { context: { slot: 123 }, value: params[0].map(id => entries[id]) };
  };
  const foreignKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  assert.throws(() => authorizedReceiptClaim(receipt, foreignKey), /unapproved runner/);
  const options = { receipt, trustedReceiptKey, credential, issuer, rpc };
  assert.equal((await issueSas(options)).status, 'finalized');
  assert.equal((await issueSas(options)).status, 'already_finalized');
  assert.equal(submissions, 1);
});
