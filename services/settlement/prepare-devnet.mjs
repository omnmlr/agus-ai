import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  appendTransactionMessageInstructions, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';
import { getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
import { assertAmount, assertDevnet, associatedTokenAccount, connectDevnet, DEVNET, readKeypair, sendRpc, signTransfer } from './chain.mjs';

// SOL targets are demo reserves in lamports, including transaction fees and expected account rent.
const roles = {
  'app-test-payer': 50_000_000n,
  'campaign-funder': 50_000_000n,
  'settlement-operator': 50_000_000n,
  'contributor-payout': 20_000_000n,
  'sas-authority': 50_000_000n,
  'sas-issuer': 50_000_000n,
};
const tokenRoles = new Set(['campaign-funder', 'settlement-operator', 'contributor-payout']);
const finalized = { commitment: 'finalized' };

function restricted(info, isDirectory) {
  if ((isDirectory ? !info.isDirectory() : !info.isFile()) || (process.platform !== 'win32' && (info.mode & 0o077))) {
    throw new Error('Use a private identity directory and regular key files accessible only to the owner.');
  }
}

async function disposableSigner(directory, role) {
  const file = resolve(directory, role + '.json');
  try {
    restricted(await lstat(file), false);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const seed = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
    const publicBytes = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
    const temp = resolve(directory, '.' + randomUUID());
    await writeFile(temp, JSON.stringify([...seed, ...publicBytes]) + '\n', { flag: 'wx', mode: 0o600, flush: true });
    try {
      await link(temp, file);
    } catch (racing) {
      if (racing.code !== 'EEXIST') throw racing;
    } finally {
      await unlink(temp);
    }
    restricted(await lstat(file), false);
  }
  return readKeypair(file);
}

async function prepareAccount(rpc, payer, ata) {
  const { value: lifetime } = await sendRpc(rpc.getLatestBlockhash(finalized));
  const instruction = getCreateAssociatedTokenIdempotentInstruction({ payer, ata, owner: payer.address, mint: DEVNET.mint });
  let message = createTransactionMessage({ version: 'legacy' });
  message = setTransactionMessageFeePayerSigner(payer, message);
  message = setTransactionMessageLifetimeUsingBlockhash(lifetime, message);
  message = appendTransactionMessageInstructions([instruction], message);
  const signed = await signTransfer(message);
  return sendRpc(rpc.sendTransaction(signed.signedTransaction, { encoding: 'base64', preflightCommitment: 'finalized', maxRetries: 2n }));
}

const remaining = (target, actual) => (target > actual ? target - actual : 0n).toString();

async function prepare(directory, campaignAtoms, flags) {
  await mkdir(directory, { mode: 0o700, recursive: true });
  restricted(await lstat(directory), true);
  const signers = await Promise.all(Object.keys(roles).map(async role => [role, await disposableSigner(directory, role)]));
  if (new Set(signers.map(([, signer]) => signer.address)).size !== signers.length) throw new Error('Identity roles must have distinct addresses.');
  const rpc = connectDevnet(process.env.AGUS_SETTLEMENT_RPC_URL);
  let online = false;
  if (!flags.includes('--addresses-only')) {
    await assertDevnet(rpc).then(() => { online = true; }, error => {
      if (error.code === 'WRONG_CLUSTER') throw error;
    });
  }
  const results = [];
  let faucetUnavailable = false;
  for (const [role, payer] of signers) {
    const target = roles[role];
    const row = { role, address: payer.address, targetLamports: target.toString(), balanceStatus: 'unverified',
      requiredFaucetLamports: null };
    results.push(row);
    if (tokenRoles.has(role)) row.tokenAccount = await associatedTokenAccount(payer.address);
    if (role === 'campaign-funder') row.targetUsdcAtoms = campaignAtoms.toString();
    if (!online) continue;
    const sol = await sendRpc(rpc.getBalance(payer.address, finalized)).then(result => BigInt(result.value), () => null);
    if (sol === null) continue;
    row.balanceStatus = 'finalized';
    row.balanceLamports = sol.toString();
    row.requiredFaucetLamports = remaining(target, sol);
    if (sol < target && flags.includes('--airdrop') && !faucetUnavailable) {
      await sendRpc(rpc.requestAirdrop(payer.address, target - sol, finalized)).then(signature => {
        row.airdrop = { status: 'submitted', signature };
      }, () => {
        row.airdrop = { status: 'interactive_faucet_required' };
        faucetUnavailable = true;
      });
    }
    if (!row.tokenAccount) continue;
    const account = () => sendRpc(rpc.getAccountInfo(row.tokenAccount, finalized)).then(result => result.value);
    let exists;
    try { exists = await account(); } catch { row.tokenAccountStatus = 'unverified'; continue; }
    row.tokenAccountStatus = exists ? 'finalized' : 'missing';
    if (!exists && sol >= target && flags.includes('--prepare-accounts')) {
      await prepareAccount(rpc, payer, row.tokenAccount).then(signature => {
        row.tokenAccountStatus = 'submitted';
        row.tokenAccountSignature = signature;
      }, () => { row.tokenAccountStatus = 'retry_or_reconcile'; });
    }
    if (role === 'campaign-funder') {
      const atoms = exists ? await sendRpc(rpc.getTokenAccountBalance(row.tokenAccount, finalized))
        .then(result => BigInt(result.value.amount), () => null) : 0n;
      row.requiredFaucetUsdcAtoms = atoms === null ? null : remaining(campaignAtoms, atoms);
    }
  }
  return { network: 'devnet', pinnedGenesis: DEVNET.genesis, rpcStatus: online ? 'verified' : 'unavailable',
    mint: DEVNET.mint, decimals: DEVNET.decimals, identities: results };
}

const [directory, atoms, ...flags] = process.argv.slice(2);
try {
  if (!directory || !atoms || flags.some(flag => !['--addresses-only', '--airdrop', '--prepare-accounts'].includes(flag)) ||
      (flags.includes('--addresses-only') && flags.length > 1)) throw new Error('Usage: prepare-devnet.mjs PRIVATE_DIRECTORY CAMPAIGN_ATOMS [--addresses-only | --airdrop --prepare-accounts]');
  console.log(JSON.stringify(await prepare(resolve(directory), assertAmount(atoms), flags), null, 2));
} catch (error) {
  console.error(error.code === 'WRONG_CLUSTER' ? 'Refused RPC with a non-Devnet genesis.' : 'Devnet preparation failed. Check the arguments and private identity directory permissions.');
  process.exitCode = 1;
}
