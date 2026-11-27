import { readFile } from 'node:fs/promises';
import {
  AccountState, ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction, getMintDecoder, getTokenDecoder, getTransferCheckedInstruction,
} from '@solana-program/token';
import {
  address, appendTransactionMessageInstructions, createKeyPairSignerFromBytes, createNoopSigner,
  createSolanaRpc, createTransactionMessage, getBase58Encoder, getBase64EncodedWireTransaction, getSignatureFromTransaction,
  isOffCurveAddress, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';
import { SettlementError } from './errors.mjs';

export const DEVNET = Object.freeze({
  cluster: 'devnet',
  genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  rpc: 'https://api.devnet.solana.com',
  asset: 'USDC',
  mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  decimals: 6,
});

const MEMO_PROGRAM = address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MAX_U64 = 2n ** 64n - 1n;

export function assertWallet(wallet) {
  try {
    if (typeof wallet !== 'string' || wallet.length > 44) throw new Error('Invalid public key');
    const publicAddress = address(wallet);
    if (isOffCurveAddress(publicAddress)) throw new Error('Invalid wallet');
    return publicAddress;
  } catch {
    throw new SettlementError('BAD_WALLET', 'Provide a valid Solana wallet address.', 400);
  }
}

export function assertAmount(amountAtoms) {
  if (typeof amountAtoms !== 'string' || !/^[1-9]\d{0,19}$/.test(amountAtoms) || BigInt(amountAtoms) > MAX_U64) {
    throw new SettlementError('BAD_AMOUNT', 'Provide an unsigned, nonzero amount in token atoms.', 400);
  }
  return BigInt(amountAtoms);
}

export function assertSignature(signature) {
  try {
    if (typeof signature !== 'string' || signature.length > 88 || getBase58Encoder().encode(signature).length !== 64) {
      throw new Error('Invalid signature');
    }
    return signature;
  } catch {
    throw new SettlementError('BAD_SIGNATURE', 'Provide a Solana transaction signature.', 400);
  }
}

export async function associatedTokenAccount(wallet, network = DEVNET) {
  const [tokenAccount] = await findAssociatedTokenPda({ owner: assertWallet(wallet), tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: address(network.mint) });
  return tokenAccount;
}

export function fundingMemo(reference) {
  return `mobile-workload:devnet:funding:v1:${reference}`;
}

export function settlementMemo(reference) {
  return `mobile-workload:devnet:settlement:v1:${reference}`;
}

export function connectDevnet(rpcUrl = DEVNET.rpc) {
  const url = new URL(rpcUrl);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('The configured settlement RPC must use HTTPS.');
  }
  return createSolanaRpc(url.href);
}

export function sendRpc(request) {
  return request.send({ abortSignal: AbortSignal.timeout(8_000) });
}

async function assertCluster(connection, network) {
  const genesis = await sendRpc(connection.getGenesisHash());
  if (genesis !== network.genesis) {
    throw new SettlementError('WRONG_CLUSTER', 'The settlement RPC does not report the pinned Solana genesis.', 503);
  }
}

export const assertDevnet = connection => assertCluster(connection, DEVNET);

export async function readKeypair(file) {
  try {
    const bytes = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(bytes) || bytes.length !== 64 || bytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new Error('Malformed keypair');
    }
    return await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  } catch {
    throw new Error('The configured disposable Solana keypair file could not be opened.');
  }
}

export async function buildTransfer({ payer, recipient, amountAtoms, memo, lifetime, network = DEVNET, createRecipientAccount = false }) {
  const mint = address(network.mint);
  const [source, destination] = await Promise.all([associatedTokenAccount(payer.address, network), associatedTokenAccount(recipient, network)]);
  const instructions = [];
  if (createRecipientAccount) {
    instructions.push(getCreateAssociatedTokenIdempotentInstruction({ payer, ata: destination, owner: recipient, mint }));
  }
  instructions.push(
    getTransferCheckedInstruction({ source, mint, destination, authority: payer, amount: assertAmount(amountAtoms), decimals: network.decimals }),
    { programAddress: MEMO_PROGRAM, data: Buffer.from(memo, 'utf8') },
  );
  let transaction = createTransactionMessage({ version: 'legacy' });
  transaction = setTransactionMessageFeePayerSigner(payer, transaction);
  transaction = setTransactionMessageLifetimeUsingBlockhash(lifetime, transaction);
  return appendTransactionMessageInstructions(instructions, transaction);
}

export async function createFundingTransaction(quote, lifetime, signer) {
  const payer = signer ?? createNoopSigner(assertWallet(quote.developerWallet));
  if (quote.cluster !== DEVNET.cluster || quote.mint !== DEVNET.mint || quote.decimals !== DEVNET.decimals ||
      quote.deposit?.tokenAccount !== await associatedTokenAccount(quote.deposit?.wallet) || payer.address !== quote.developerWallet ||
      !/^[0-9a-f-]{36}$/.test(quote.reference) || quote.funding?.memo !== fundingMemo(quote.reference)) {
    throw new SettlementError('BAD_QUOTE', 'The payment quote does not match the Devnet funding contract.', 400);
  }
  if (Date.parse(quote.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(quote.expiresAt))) {
    throw new SettlementError('QUOTE_EXPIRED', 'This quote is outside its funding window.');
  }
  return buildTransfer({
    payer,
    recipient: assertWallet(quote.deposit.wallet),
    amountAtoms: quote.amountAtoms,
    memo: quote.funding.memo,
    lifetime,
  });
}

export async function createCampaignFundingTransaction(quote, lifetime, payer) {
  const network = quote.network;
  const match = /^agus:campaign:funding:v1:([0-9a-f-]{36}):([a-f0-9]{64})$/.exec(quote.memo ?? '');
  if (network?.cluster !== DEVNET.cluster || network?.genesis !== DEVNET.genesis || network?.mint !== DEVNET.mint ||
      network?.asset !== DEVNET.asset || network?.decimals !== DEVNET.decimals ||
      !match || match[2] !== quote.revisionSha256 || payer.address !== quote.funder ||
      payer.address === quote.deposit || quote.source !== await associatedTokenAccount(quote.funder) ||
      quote.destination !== await associatedTokenAccount(quote.deposit)) {
    throw new SettlementError('BAD_QUOTE', 'The campaign quote does not match the Devnet funding contract.', 400);
  }
  if (!Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= Date.now()) {
    throw new SettlementError('QUOTE_EXPIRED', 'This quote is outside its funding window.');
  }
  return buildTransfer({ payer, recipient: quote.deposit, amountAtoms: quote.amountAtoms, memo: quote.memo, lifetime });
}

function assertProof(condition) {
  if (!condition) {
    throw new SettlementError('CHAIN_MISMATCH', 'The finalized transfer differs from the expected payment.');
  }
}

const sameDecimals = (value, expected) => value === expected || value === BigInt(expected);

function tokenBalance(entries, accountIndex, owner, network) {
  const entry = entries?.find((candidate) => candidate.accountIndex === accountIndex);
  if (!entry) return null;
  const amount = entry.uiTokenAmount;
  assertProof(entry.owner === owner && entry.mint === network.mint &&
    (!entry.programId || entry.programId === TOKEN_PROGRAM_ADDRESS) &&
    sameDecimals(amount?.decimals, network.decimals) && /^\d{1,20}$/.test(amount.amount) && BigInt(amount.amount) <= MAX_U64);
  return BigInt(amount.amount);
}

function memoText(instruction) {
  if (typeof instruction.parsed === 'string') return instruction.parsed;
  if (typeof instruction.data === 'string' && instruction.accounts?.length === 0) {
    return Buffer.from(getBase58Encoder().encode(instruction.data)).toString('utf8');
  }
  return null;
}

// Adapts the upstream mobile-test chain verifier to quote-bound checked-transfer and memo pairs.
export async function assertFinalizedTransfer(transaction, signature, expected, network = DEVNET) {
  const { meta, transaction: body, slot, blockTime } = transaction;
  const slotNumber = Number(slot);
  const message = body?.message;
  const payer = message?.accountKeys?.[0];
  assertProof(meta && meta.err === null && body?.signatures?.[0] === signature && payer?.signer &&
    payer.pubkey === expected.payer && Number.isSafeInteger(slotNumber) && slotNumber > expected.afterSlot);
  if (expected.timeWindow) {
    const seconds = Number(blockTime);
    assertProof(blockTime != null && Number.isSafeInteger(seconds) && seconds >= expected.timeWindow.from && seconds <= expected.timeWindow.until);
  }

  const [source, destination] = await Promise.all([associatedTokenAccount(expected.payer, network), associatedTokenAccount(expected.recipient, network)]);
  const instructions = message.instructions;
  assertProof(Array.isArray(instructions) && instructions.length === (expected.createRecipientAccount ? 3 : 2));

  const [transfer, memo] = instructions.slice(-2);
  const { type, info } = transfer.parsed ?? {};
  assertProof(transfer.programId === TOKEN_PROGRAM_ADDRESS && type === 'transferChecked' && info &&
    info.authority === expected.payer && info.mint === network.mint && info.source === source &&
    info.destination === destination && source !== destination && info.tokenAmount?.amount === expected.amountAtoms &&
    sameDecimals(info.tokenAmount.decimals, network.decimals) && memo.programId === MEMO_PROGRAM && memoText(memo) === expected.memo);

  if (expected.createRecipientAccount) {
    const [createAccount] = instructions;
    const parsed = createAccount.parsed;
    assertProof(createAccount.programId === ASSOCIATED_TOKEN_PROGRAM_ADDRESS && parsed?.type === 'createIdempotent' &&
      parsed.info?.account === destination && parsed.info.wallet === expected.recipient && parsed.info.mint === network.mint &&
      parsed.info.source === expected.payer && parsed.info.tokenProgram === TOKEN_PROGRAM_ADDRESS);
  }

  const accountIndex = (address) => message.accountKeys.findIndex((key) => key.pubkey === address && key.writable);
  const sourceIndex = accountIndex(source);
  const destinationIndex = accountIndex(destination);
  assertProof(sourceIndex >= 0 && destinationIndex >= 0);
  const sourceBefore = tokenBalance(meta.preTokenBalances, sourceIndex, expected.payer, network);
  const sourceAfter = tokenBalance(meta.postTokenBalances, sourceIndex, expected.payer, network);
  const destinationBefore = tokenBalance(meta.preTokenBalances, destinationIndex, expected.recipient, network);
  const destinationAfter = tokenBalance(meta.postTokenBalances, destinationIndex, expected.recipient, network);
  const atoms = BigInt(expected.amountAtoms);
  const created = expected.createRecipientAccount && BigInt(meta.preBalances[destinationIndex]) === 0n;
  assertProof(sourceBefore !== null && sourceAfter !== null && destinationAfter !== null &&
    (destinationBefore !== null || created) && sourceBefore - sourceAfter === atoms &&
    destinationAfter - (destinationBefore ?? 0n) === atoms);

  return {
    signature, slot: slotNumber, commitment: 'finalized', cluster: network.cluster, mint: network.mint,
    amountAtoms: expected.amountAtoms, source, destination, payer: expected.payer, recipient: expected.recipient,
  };
}

async function validateMint(connection, network) {
  await assertCluster(connection, network);
  const { context, value } = await sendRpc(connection.getAccountInfo(address(network.mint), { encoding: 'base64', commitment: 'finalized' }));
  if (!value || value.owner !== TOKEN_PROGRAM_ADDRESS) {
    throw new SettlementError('WRONG_MINT', 'The configured test token mint could not be validated.', 503);
  }
  const mint = getMintDecoder().decode(Buffer.from(value.data[0], 'base64'));
  if (!mint.isInitialized || mint.decimals !== network.decimals) {
    throw new SettlementError('WRONG_MINT', 'The configured test token mint could not be validated.', 503);
  }
  return { slot: Number(context.slot), decimals: mint.decimals, initialized: mint.isInitialized, program: value.owner };
}

export const validateDevnetMint = connection => validateMint(connection, DEVNET);

export async function signTransfer(transaction) {
  const signed = await signTransactionMessageWithSigners(transaction);
  return { signature: getSignatureFromTransaction(signed), signedTransaction: getBase64EncodedWireTransaction(signed) };
}

export const createDevnetChain = ({ connection, payer }) => createSettlementChain({ connection, payer, network: DEVNET });

export function createSettlementChain({ connection, payer, network }) {
  return {
    async quoteWindow() {
      await validateMint(connection, network);
      const depositAddress = await associatedTokenAccount(payer.address, network);
      const { context, value: deposit } = await sendRpc(connection.getAccountInfo(depositAddress, { encoding: 'base64', commitment: 'finalized' }));
      const account = deposit?.owner === TOKEN_PROGRAM_ADDRESS && getTokenDecoder().decode(Buffer.from(deposit.data[0], 'base64'));
      if (!account || account.state !== AccountState.Initialized || account.owner !== payer.address || account.mint !== network.mint) {
        throw new SettlementError('DEPOSIT_UNAVAILABLE', 'The disposable deposit account has not been initialized.', 503);
      }
      return Number(context.slot);
    },
    async observe(signature, lastValidBlockHeight) {
      await assertCluster(connection, network);
      const { value: [status] } = await sendRpc(connection.getSignatureStatuses([signature], { searchTransactionHistory: true }));
      if (status?.confirmationStatus === 'finalized') {
        if (status.err) return { state: 'failed', slot: status.slot };
        const transaction = await sendRpc(connection.getTransaction(signature, {
          encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0,
        }));
        if (transaction) {
          assertProof(transaction.slot === status.slot);
          return { state: 'finalized', transaction };
        }
      }
      if (!status && lastValidBlockHeight !== undefined && await sendRpc(connection.getBlockHeight({ commitment: 'finalized' })) > lastValidBlockHeight) {
        return { state: 'expired' };
      }
      return { state: 'pending' };
    },
    async prepare(quote) {
      return this.prepareTransfer({ recipient: quote.providerWallet, amountAtoms: quote.amountAtoms, memo: settlementMemo(quote.reference) });
    },
    async prepareTransfer({ recipient, amountAtoms, memo }) {
      await assertCluster(connection, network);
      const { value: lifetime } = await sendRpc(connection.getLatestBlockhash({ commitment: 'finalized' }));
      const transfer = await buildTransfer({
        payer,
        recipient: assertWallet(recipient),
        amountAtoms,
        memo,
        network,
        lifetime,
        createRecipientAccount: true,
      });
      return {
        ...await signTransfer(transfer),
        lastValidBlockHeight: Number(lifetime.lastValidBlockHeight),
      };
    },
    async broadcast(prepared) {
      await assertCluster(connection, network);
      const signature = await sendRpc(connection.sendTransaction(prepared.signedTransaction, {
        encoding: 'base64', skipPreflight: false, preflightCommitment: 'finalized', maxRetries: 0n,
      }));
      assertProof(signature === prepared.signature);
    },
  };
}
