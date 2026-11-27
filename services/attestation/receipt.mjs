import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  deriveAttestationPda, deriveSchemaPda, getAttestationDecoder, getCredentialDecoder, getSchemaDecoder,
  serializeAttestationData, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as program,
} from 'sas-lib';
import { digest, hex256, stableJson, validSignature } from '../control-plane/src/security.mjs';

export const name = 'agus-execution-v1';
export const field = 'manifest_sha256';
const fields = Buffer.concat([Buffer.from([field.length, 0, 0, 0]), Buffer.from(field)]);
export const devnetGenesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

export function receiptClaim(receipt) {
  const manifest = receipt?.manifest;
  const hash = receipt?.manifestSha256;
  if (!manifest || !hex256(hash) || digest(stableJson(manifest)) !== hash
      || !validSignature(receipt.publicKeyPem, manifest, receipt.signature)) {
    throw new Error('Invalid execution receipt');
  }
  return { [field]: hash };
}

function decoded(account, discriminator, decoder) {
  if (!account || account.owner !== program || account.executable || account.data?.[1] !== 'base64') {
    throw new Error('Account is missing or has the wrong SAS owner');
  }
  const data = decoder.decode(Buffer.from(account.data[0], 'base64'));
  if (data.discriminator !== discriminator) throw new Error('Unexpected SAS account type');
  return data;
}

export const decodeCredential = account => decoded(account, 1, getCredentialDecoder());

export function decodeReceiptSchema(account, credential) {
  const layout = decoded(account, 2, getSchemaDecoder());
  if (layout.credential !== credential || Buffer.from(layout.name).toString() !== name ||
      layout.version !== 1 || layout.isPaused || !Buffer.from(layout.layout).equals(Buffer.from([12])) ||
      !Buffer.from(layout.fieldNames).equals(fields)) throw new Error('Unexpected or paused AGUS receipt schema');
  return layout;
}

export async function verifyDevnetAttestation({ receipt, credential, signer, nonce, rpc = publicRpc, now = Date.now() }) {
  const claim = receiptClaim(receipt);
  const [schema] = await deriveSchemaPda({ credential, name, version: 1 });
  const [address] = await deriveAttestationPda({ credential, schema, nonce });
  if (await rpc('getGenesisHash', []) !== devnetGenesis) throw new Error('Devnet genesis mismatch');
  const { context, value } = await rpc('getMultipleAccounts', [[credential, schema, address], {
    encoding: 'base64', commitment: 'finalized',
  }]);
  const issuer = decodeCredential(value[0]);
  const layout = decodeReceiptSchema(value[1], credential);
  const attestation = decoded(value[2], 0, getAttestationDecoder());
  if (attestation.credential !== credential || attestation.schema !== schema || attestation.nonce !== nonce ||
      attestation.signer !== signer || !(issuer.authority === signer || issuer.authorizedSigners.includes(signer)) ||
      attestation.expiry <= BigInt(Math.floor(now / 1000)) ||
      !Buffer.from(attestation.data).equals(Buffer.from(serializeAttestationData(layout, claim)))) {
    throw new Error('SAS attestation does not match the trusted issuer and active receipt claim');
  }
  return { address, schema, credential, signer, slot: context.slot, network: 'devnet', claim, scope: 'receipt-digest' };
}

export async function publicRpc(method, params, origin = 'https://api.devnet.solana.com') {
  const endpoint = new URL(origin);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Use an approved HTTPS Devnet RPC');
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000),
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error('Public Devnet RPC unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Public Devnet RPC rejected the request');
  return data.result;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [command, file, credential, signer, nonce] = process.argv.slice(2);
  if (!file || !['payload', 'verify'].includes(command) || (command === 'verify' && (!credential || !signer || !nonce))) {
    throw new Error('Usage: receipt.mjs payload RECEIPT.json | verify RECEIPT.json CREDENTIAL SIGNER NONCE');
  }
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  console.log(JSON.stringify(command === 'payload'
    ? { schema: name, version: 1, data: receiptClaim(receipt) }
    : await verifyDevnetAttestation({ receipt, credential, signer, nonce,
      rpc: (method, params) => publicRpc(method, params, process.env.AGUS_SAS_DEVNET_RPC_URL),
    }), null, 2));
}
