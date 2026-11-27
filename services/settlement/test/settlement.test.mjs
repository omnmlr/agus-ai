import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSigner, getBase58Decoder, signBytes } from '@solana/kit';
import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import {
  associatedTokenAccount, assertFinalizedTransfer, assertSignature, createDevnetChain, createFundingTransaction, DEVNET,
  settlementMemo, signTransfer,
} from '../chain.mjs';
import { createSettlementService } from '../index.mjs';
import { createPayoutWalletChallenge, verifyPayoutWalletProof } from '../wallet-proof.mjs';

const [operator, buyer, payee, stranger] = await Promise.all(Array.from({ length: 4 }, () => generateKeyPairSigner()));
const sampleTime = Date.parse('2026-11-26T12:00:00.000Z');
const amountAtoms = '2500000';
const providerId = 'provider-1';
const runId = 'run-1';
const reportId = 'verified-report-1';
const encodeSignature = (byte) => getBase58Decoder().decode(new Uint8Array(64).fill(byte));
const code = (code) => ({ code });

function makeStore() {
  const rows = new Map();
  return {
    get: async (id) => rows.has(id) ? structuredClone(rows.get(id)) : null,
    async insert(id, payment) {
      if (rows.has(id)) return null;
      const row = { revision: 0, payment };
      rows.set(id, structuredClone(row));
      return row;
    },
    async compareAndSet(id, revision, payment) {
      if (rows.get(id)?.revision !== revision) return null;
      const row = { revision: revision + 1, payment };
      rows.set(id, structuredClone(row));
      return row;
    },
    async listProviderPayouts(owner, from, to) {
      return [...rows.values()].map(({ payment }) => payment).filter((payment) =>
        payment.providerId === owner && payment.acceptedAt >= from && payment.acceptedAt < to);
    },
  };
}

async function parsedTransfer({ payer, recipient, signature, memo, slot = 11, createRecipient = false }) {
  const source = await associatedTokenAccount(payer);
  const destination = await associatedTokenAccount(recipient);
  const balance = (accountIndex, owner, amount) => ({
    accountIndex, owner, mint: DEVNET.mint, programId: TOKEN_PROGRAM_ADDRESS, uiTokenAmount: { amount, decimals: 6 },
  });
  const createAccount = {
    programId: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    parsed: {
      type: 'createIdempotent',
      info: { account: destination, wallet: recipient, mint: DEVNET.mint, source: payer, tokenProgram: TOKEN_PROGRAM_ADDRESS },
    },
  };
  return {
    slot: BigInt(slot),
    blockTime: BigInt(sampleTime / 1000 + 1),
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [
          { pubkey: payer, signer: true, writable: true },
          { pubkey: source, signer: false, writable: true },
          { pubkey: destination, signer: false, writable: true },
        ],
        instructions: [
          ...(createRecipient ? [createAccount] : []),
          {
            programId: TOKEN_PROGRAM_ADDRESS,
            parsed: {
              type: 'transferChecked',
              info: { authority: payer, source, destination, mint: DEVNET.mint, tokenAmount: { amount: amountAtoms, decimals: 6 } },
            },
          },
          { programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', parsed: memo },
        ],
      },
    },
    meta: {
      err: null,
      preBalances: [1_000_000_000n, 2_039_280n, createRecipient ? 0n : 2_039_280n],
      preTokenBalances: [balance(1, payer, '5000000'), ...(createRecipient ? [] : [balance(2, recipient, '0')])],
      postTokenBalances: [balance(1, payer, '2500000'), balance(2, recipient, '2500000')],
    },
  };
}

function setup({ lostResponse = false } = {}) {
  const store = makeStore();
  const observed = new Map();
  const broadcasts = [];
  const history = [];
  let prepares = 0;
  let milliseconds = sampleTime;
  const chain = {
    quoteWindow: async () => 10,
    observe: async (signature) => {
      history.push('observe');
      return observed.get(signature) ?? { state: 'pending' };
    },
    prepare: async () => ({ signature: encodeSignature(++prepares), signedTransaction: `signed-${prepares}`, lastValidBlockHeight: 99 }),
    broadcast: async (prepared) => {
      history.push('broadcast');
      const persisted = await store.get(runId);
      assert.equal(persisted.payment.settlement.signedTransaction, prepared.signedTransaction);
      assert.equal(persisted.payment.state, 'submitted_or_unknown');
      broadcasts.push(prepared.signedTransaction);
      if (lostResponse) throw new Error('Simulated network interruption after submission');
    },
  };
  const service = createSettlementService({ store, chain, depositWallet: operator.address, amountAtoms, now: () => milliseconds });
  const quote = (options) => service.quote({ runId, developerWallet: buyer.address, providerWallet: payee.address, providerId, ...options });
  const settle = (options) => service.settle({ runId, eligibleReportId: reportId, providerWallet: payee.address, providerId, ...options });

  async function funded() {
    const { quote: terms } = await quote();
    const signature = encodeSignature(100);
    observed.set(signature, {
      state: 'finalized', transaction: await parsedTransfer({ payer: buyer.address, recipient: operator.address, signature, memo: terms.funding.memo }),
    });
    return service.verifyFunding({ runId, signature });
  }

  return { store, service, observed, broadcasts, history, quote, settle, funded, advance: (ms) => { milliseconds += ms; } };
}

test('a quote fixes provider identity, developer, payout destination, amount, cluster and run-specific memo', async () => {
  const { quote, service } = setup();
  const first = await quote();
  assert.deepEqual(await quote(), first);
  assert.equal(first.quote.deposit.tokenAccount, await associatedTokenAccount(operator.address));
  assert.equal(first.quote.amountAtoms, amountAtoms);
  assert.equal(first.quote.cluster, 'devnet');
  await assert.rejects(quote({ providerWallet: stranger.address }), code('QUOTE_FIXED'));
  await assert.rejects(quote({ providerId: 'another-provider' }), code('QUOTE_FIXED'));
  await assert.rejects(quote({ runId: 'other-run', providerWallet: operator.address }), code('WALLETS_MUST_DIFFER'));
  assert.notEqual((await quote({ runId: 'other-run' })).quote.funding.memo, first.quote.funding.memo);
  await assert.rejects(service.verifyFunding({ runId, signature: encodeSignature(100) }), code('FUNDING_PENDING'));
});

test('funding rejects mismatched memo, signer, time, token units, deltas, stale slot and a failed transaction', async () => {
  const { quote, service, observed } = setup();
  const { quote: terms } = await quote();
  const signature = encodeSignature(110);
  const exact = await parsedTransfer({ payer: buyer.address, recipient: operator.address, signature, memo: terms.funding.memo });
  for (const corrupt of [
    (transaction) => { transaction.transaction.message.instructions[1].parsed = 'other job'; },
    (transaction) => { transaction.transaction.message.accountKeys[0].signer = false; },
    (transaction) => { transaction.blockTime = BigInt(sampleTime / 1000 + 2000); },
    (transaction) => { transaction.transaction.message.instructions[0].parsed.info.tokenAmount.amount = '2499999'; },
    (transaction) => { transaction.meta.postTokenBalances[1].uiTokenAmount.amount = '2500001'; },
    (transaction) => { transaction.slot = 10n; },
  ]) {
    const different = structuredClone(exact);
    corrupt(different);
    observed.set(signature, { state: 'finalized', transaction: different });
    await assert.rejects(service.verifyFunding({ runId, signature }), code('CHAIN_MISMATCH'));
  }
  observed.set(signature, { state: 'failed' });
  await assert.rejects(service.verifyFunding({ runId, signature }), code('FUNDING_FAILED'));
  observed.set(signature, { state: 'finalized', transaction: exact });
  const funded = await service.verifyFunding({ runId, signature });
  assert.equal(funded.funding.commitment, 'finalized');
  assert.deepEqual(await service.verifyFunding({ runId, signature }), funded);
  assert.equal((await service.earnings({ providerId })).totals.pendingAtoms, '0');
});

test('settlement requires accepted work, persists before broadcast, reconciles lost responses and retries the exact bytes', async () => {
  const { service, settle, funded, broadcasts, observed, history, advance } = setup({ lostResponse: true });
  await assert.rejects(settle(), code('PAYMENT_NOT_FOUND'));
  await funded();
  await assert.rejects(settle({ providerId: 'unknown-provider' }), code('PROVIDER_MISMATCH'));
  await assert.rejects(settle({ providerWallet: stranger.address }), code('PROVIDER_MISMATCH'));
  const approved = await service.accept({ runId, eligibleReportId: reportId, providerWallet: payee.address, providerId });
  assert.equal(approved.state, 'settlement_ready');
  assert.equal((await service.earnings({ providerId })).totals.pendingAtoms, amountAtoms);

  await Promise.all([settle(), settle(), settle()]);
  const first = await service.get({ runId });
  assert.equal(first.state, 'submitted_or_unknown');
  assert.equal(first.settlement.signedTransaction, undefined);
  assert.equal(broadcasts.length, 1);
  await assert.rejects(settle({ eligibleReportId: 'replacement-report' }), code('REPORT_FIXED'));
  await service.reconcile({ runId });
  assert.equal(broadcasts.length, 1);

  advance(6_000);
  await settle();
  assert.deepEqual(history.slice(-2), ['observe', 'broadcast']);
  assert.deepEqual(broadcasts, [broadcasts[0], broadcasts[0]]);

  const { signature } = first.settlement;
  observed.set(signature, {
    state: 'finalized', transaction: await parsedTransfer({
      payer: operator.address, recipient: payee.address, signature,
      memo: settlementMemo(first.quote.reference), slot: 12, createRecipient: true,
    }),
  });
  const settled = await service.reconcile({ runId });
  assert.equal(settled.state, 'settled');
  assert.equal(settled.settlement.receipt.signature, signature);
  assert.equal(broadcasts.length, 2);
  assert.deepEqual(await settle(), settled);
  const earnings = await service.earnings({ providerId, from: '2026-11-25', to: '2026-11-28' });
  assert.equal(earnings.totals.settledAtoms, amountAtoms);
  assert.equal(earnings.buckets[1].settledAtoms, amountAtoms);
  assert.equal(earnings.jobs[0].destination, payee.address);
  assert.match(earnings.jobs[0].explorerUrl, /\?cluster=devnet$/);
  assert.deepEqual((await service.earnings({ providerId: 'unknown-provider' })).jobs, []);
});

test('an expired or failed payout retains its signature without preparing a replacement', async () => {
  for (const [observation, result] of [['expired', 'needs_review'], ['failed', 'failed']]) {
    const { service, funded, settle, observed, broadcasts, advance } = setup();
    await funded();
    const submitted = await settle();
    observed.set(submitted.settlement.signature, { state: observation });
    advance(200_000);
    const checked = await settle();
    assert.equal(checked.state, result);
    assert.equal(checked.settlement.signature, submitted.settlement.signature);
    assert.equal(broadcasts.length, 1);
    assert.equal((await service.earnings({ providerId })).totals[observation === 'failed' ? 'failedAtoms' : 'needsReviewAtoms'], amountAtoms);
  }
});

test('review reconciles the original signature when authoritative evidence arrives late', async () => {
  const { service, funded, settle, observed, broadcasts } = setup();
  await funded();
  const submission = await settle();
  const { signature } = submission.settlement;
  observed.set(signature, { state: 'expired' });
  assert.equal((await service.reconcile({ runId })).state, 'needs_review');
  observed.set(signature, {
    state: 'finalized', transaction: await parsedTransfer({ payer: operator.address, recipient: payee.address,
      signature, memo: settlementMemo(submission.quote.reference), slot: 12, createRecipient: true }),
  });
  const settled = await service.reconcile({ runId });
  assert.equal(settled.state, 'settled');
  assert.equal(settled.settlement.reason, undefined);
  assert.equal(settled.settlement.signature, signature);
  assert.equal(broadcasts.length, 1);
});

test('wallet proof authenticates exact origin, provider, wallet, time and bytes', async () => {
  const challenge = createPayoutWalletChallenge({ providerId, wallet: payee.address, origin: 'https://app.example', now: sampleTime });
  const rawSignature = await signBytes(payee.keyPair.privateKey, Buffer.from(challenge.message));
  const signature = Buffer.from(rawSignature).toString('base64');
  assert.equal(await verifyPayoutWalletProof({ challenge, signature, now: sampleTime }), true);
  await assert.rejects(verifyPayoutWalletProof({ challenge, signature, now: sampleTime + 300_000 }), code('PAYOUT_CHALLENGE_EXPIRED'));
  await assert.rejects(verifyPayoutWalletProof({ challenge: { ...challenge, origin: 'https://other.example' }, signature, now: sampleTime }), code('BAD_PAYOUT_SIGNATURE'));
  await assert.rejects(verifyPayoutWalletProof({ challenge: { ...challenge, providerId: 'another-provider' }, signature, now: sampleTime }), code('BAD_PAYOUT_SIGNATURE'));
});

test('official instruction codecs produce signed Devnet funding and payout wire transactions against an RPC simulator', async () => {
  const { quote } = setup();
  const { quote: terms } = await quote();
  terms.expiresAt = new Date(Date.now() + 60_000).toISOString();
  const lifetime = { blockhash: DEVNET.genesis, lastValidBlockHeight: 99n };
  const funding = await signTransfer(await createFundingTransaction(terms, lifetime, buyer));
  assert.equal(assertSignature(funding.signature), funding.signature);
  assert.ok(Buffer.from(funding.signedTransaction, 'base64').length > 64);
  await assert.rejects(createFundingTransaction(terms, lifetime, stranger), code('BAD_QUOTE'));

  const rpcResponse = (value) => ({ send: async () => value });
  let genesis = DEVNET.genesis;
  let submitted;
  let expected;
  const chain = createDevnetChain({ payer: operator, connection: {
    getGenesisHash: () => rpcResponse(genesis),
    getLatestBlockhash: () => rpcResponse({ value: lifetime }),
    sendTransaction: (bytes) => {
      submitted = bytes;
      return rpcResponse(expected.signature);
    },
  } });
  expected = await chain.prepare(terms);
  assert.equal(expected.lastValidBlockHeight, 99);
  await chain.broadcast(expected);
  assert.equal(submitted, expected.signedTransaction);
  genesis = 'mainnet';
  await assert.rejects(chain.broadcast(expected), code('WRONG_CLUSTER'));

  const transfer = await parsedTransfer({ payer: operator.address, recipient: payee.address, signature: expected.signature, memo: settlementMemo(terms.reference), createRecipient: true });
  const receipt = await assertFinalizedTransfer(transfer, expected.signature, {
    payer: operator.address, recipient: payee.address, amountAtoms, memo: settlementMemo(terms.reference), afterSlot: 10, createRecipientAccount: true,
  });
  assert.equal(receipt.amountAtoms, amountAtoms);
});
