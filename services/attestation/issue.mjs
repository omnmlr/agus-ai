import { createPublicKey } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import {
  address, appendTransactionMessageInstructions, createKeyPairSignerFromBytes, createTransactionMessage,
  getAddressDecoder, getBase64EncodedWireTransaction, getSignatureFromTransaction,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners,
} from '@solana/kit';
import {
  deriveAttestationPda, deriveCredentialPda, deriveSchemaPda, getCreateAttestationInstruction,
  getCreateCredentialInstruction, getCreateSchemaInstruction, serializeAttestationData,
} from 'sas-lib';
import { digest } from '../control-plane/src/security.mjs';
import {
  decodeCredential, decodeReceiptSchema, devnetGenesis, field, name, publicRpc, receiptClaim, verifyDevnetAttestation,
} from './receipt.mjs';

async function assertDevnet(rpc) {
  if (await rpc('getGenesisHash', []) !== devnetGenesis) throw new Error('Devnet genesis mismatch');
}

function account(rpc, id) {
  return rpc('getAccountInfo', [id, { commitment: 'finalized', encoding: 'base64' }]).then(result => result.value);
}

async function publish({ rpc, payer, instructions, id }) {
  const { value } = await rpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
  let message = createTransactionMessage({ version: 'legacy' });
  message = setTransactionMessageFeePayerSigner(payer, message);
  message = setTransactionMessageLifetimeUsingBlockhash({ ...value, lastValidBlockHeight: BigInt(value.lastValidBlockHeight) }, message);
  message = appendTransactionMessageInstructions(instructions, message);
  const transaction = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(transaction);
  // A duplicate submission can only create the same PDA. Accept success from finalized account state.
  try {
    await rpc('sendTransaction', [getBase64EncodedWireTransaction(transaction), {
      encoding: 'base64', preflightCommitment: 'finalized', skipPreflight: false, maxRetries: 3,
    }]);
  } catch { /* Check final state if broadcast or acknowledgement fails. */ }
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const found = await account(rpc, id).catch(() => null);
    if (found) return found;
    await delay(1_200);
  }
  throw new Error(`Finalized SAS account is unresolved. PDA ${id}. Transaction ${signature}. Reconcile before retrying.`);
}

export async function initializeSas({ authority, issuer, label, rpc = publicRpc }) {
  if (!/^[a-z0-9-]{1,32}$/.test(label)) throw new Error('Provide a 1–32 character credential label');
  await assertDevnet(rpc);
  const [credential] = await deriveCredentialPda({ authority: authority.address, name: label });
  const [schema] = await deriveSchemaPda({ credential, name, version: 1 });
  const credentialAccount = await account(rpc, credential) ?? await publish({ rpc, payer: authority, id: credential,
    instructions: [getCreateCredentialInstruction({ payer: authority, authority, credential, name: label,
      signers: issuer === authority.address ? [] : [issuer] })],
  });
  const existing = decodeCredential(credentialAccount);
  if (existing.authority !== authority.address || Buffer.from(existing.name).toString() !== label ||
      (existing.authority !== issuer && !existing.authorizedSigners.includes(issuer))) throw new Error('SAS credential authorization mismatch');
  const schemaAccount = await account(rpc, schema) ?? await publish({ rpc, payer: authority, id: schema,
    instructions: [getCreateSchemaInstruction({ payer: authority, authority, credential, schema, name,
      description: 'AGUS AI verified execution receipt manifest SHA-256', layout: Uint8Array.of(12), fieldNames: [field] })],
  });
  decodeReceiptSchema(schemaAccount, credential);
  return { network: 'devnet', credential, schema, authority: authority.address, issuer };
}

export function authorizedReceiptClaim(receipt, trustedReceiptKey) {
  const claim = receiptClaim(receipt);
  const pinned = createPublicKey(trustedReceiptKey).export({ type: 'spki', format: 'der' });
  const embedded = createPublicKey(receipt.publicKeyPem).export({ type: 'spki', format: 'der' });
  if (!pinned.equals(embedded)) throw new Error('Execution receipt was signed by an unapproved runner');
  return claim;
}

export async function issueSas({ receipt, trustedReceiptKey, credential, issuer, rpc = publicRpc }) {
  const claim = authorizedReceiptClaim(receipt, trustedReceiptKey);
  await assertDevnet(rpc);
  const nonce = getAddressDecoder().decode(Buffer.from(digest('agus-sas-receipt-v1:' + claim[field]), 'hex'));
  const [schema] = await deriveSchemaPda({ credential, name, version: 1 });
  const [attestation] = await deriveAttestationPda({ credential, schema, nonce });
  const [credentialAccount, schemaAccount, existing] = await Promise.all([credential, schema, attestation].map(id => account(rpc, id)));
  const config = decodeCredential(credentialAccount);
  if (config.authority !== issuer.address && !config.authorizedSigners.includes(issuer.address)) throw new Error('SAS issuer is unauthorized');
  const layout = decodeReceiptSchema(schemaAccount, credential);
  if (!existing) {
    await publish({ rpc, payer: issuer, id: attestation, instructions: [getCreateAttestationInstruction({
      payer: issuer, authority: issuer, credential, schema, attestation, nonce,
      data: serializeAttestationData(layout, claim), expiry: Math.floor(Date.now() / 1000) + 7 * 86_400,
    })] });
  }
  const finalized = await verifyDevnetAttestation({ receipt, credential, signer: issuer.address, nonce, rpc });
  return { ...finalized, nonce, status: existing ? 'already_finalized' : 'finalized' };
}

async function signerFromFile(file) {
  if (!file) throw new Error('Set the approved disposable SAS keypair file');
  const mode = (await stat(file)).mode;
  if (process.platform !== 'win32' && (mode & 0o077)) throw new Error('SAS keypair must be mode 0600');
  const bytes = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(bytes) || bytes.length !== 64 || !bytes.every(n => Number.isInteger(n) && n >= 0 && n < 256)) {
    throw new Error('Invalid SAS keypair');
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
}

async function main(args) {
  const [operation, arg, extra, credential, confirmation] = args;
  const rpc = (method, params) => publicRpc(method, params, process.env.AGUS_SAS_DEVNET_RPC_URL);
  if (operation === 'initialize' && credential === '--broadcast' && args.length === 4) {
    return initializeSas({ authority: await signerFromFile(process.env.AGUS_SAS_AUTHORITY_KEYPAIR_FILE),
      issuer: address(extra), label: arg, rpc });
  }
  if (operation === 'issue' && confirmation === '--broadcast' && args.length === 5) {
    return issueSas({ receipt: JSON.parse(await readFile(arg, 'utf8')), trustedReceiptKey: await readFile(extra, 'utf8'),
      credential: address(credential), issuer: await signerFromFile(process.env.AGUS_SAS_ISSUER_KEYPAIR_FILE), rpc });
  }
  throw new Error('Usage: issue.mjs initialize LABEL ISSUER --broadcast | issue RECEIPT.json TRUSTED_RUNNER.pem CREDENTIAL --broadcast');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
