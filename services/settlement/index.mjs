import { randomUUID } from 'node:crypto';
import {
  assertAmount, assertFinalizedTransfer, assertSignature, assertWallet, associatedTokenAccount,
  connectDevnet, createDevnetChain, DEVNET, fundingMemo, readKeypair, settlementMemo,
} from './chain.mjs';
import { SettlementError } from './errors.mjs';
import { providerEarnings } from './earnings.mjs';
import { createPostgresSettlementStore } from './store.mjs';

export { createFundingTransaction } from './chain.mjs';

const MAX_BROADCAST_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 5_000;

function assertIdentifier(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9:_-]{1,96}$/.test(id)) {
    throw new SettlementError('BAD_PAYMENT_ID', 'Provide a valid run or report identifier.', 400);
  }
}

function toPublic({ payment }) {
  return {
    runId: payment.runId,
    state: payment.state,
    quote: payment.quote,
    funding: payment.funding,
    eligibleReportId: payment.eligibleReportId,
    acceptedAt: payment.acceptedAt === undefined ? undefined : new Date(payment.acceptedAt).toISOString(),
    settlement: payment.settlement && {
      signature: payment.settlement.signature,
      preparedAt: payment.settlement.preparedAt,
      lastSubmittedAt: payment.settlement.lastSubmittedAt ?? null,
      receipt: payment.settlement.receipt,
      reason: payment.settlement.reason,
    },
  };
}

async function readChain(read) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof SettlementError) throw error;
    throw new SettlementError('RPC_UNAVAILABLE', 'Devnet evidence could not be read. Retry the status check.', 503);
  }
}

export function createSettlementService({ store, chain, depositWallet, amountAtoms, ttlSeconds = 1800, now = Date.now }) {
  assertWallet(depositWallet);
  assertAmount(amountAtoms);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 24 * 3600) {
    throw new Error('Settlement quote TTL must be between 60 and 86400 seconds.');
  }

  async function load(runId) {
    assertIdentifier(runId);
    const row = await store.get(runId);
    if (!row) throw new SettlementError('PAYMENT_NOT_FOUND', 'Create a payment quote first.', 404);
    return row;
  }

  async function write(row, payment) {
    return await store.compareAndSet(payment.runId, row.revision, payment) ?? await load(payment.runId);
  }

  async function reconcileRow(row) {
    const { payment } = row;
    if (payment.state !== 'submitted_or_unknown' && payment.state !== 'needs_review') return row;
    const { settlement, quote, funding } = payment;
    const observation = await readChain(() => chain.observe(settlement.signature, settlement.lastValidBlockHeight));
    switch (observation.state) {
      case 'finalized': {
        const receipt = await assertFinalizedTransfer(observation.transaction, settlement.signature, {
          payer: quote.deposit.wallet,
          recipient: quote.providerWallet,
          amountAtoms: quote.amountAtoms,
          memo: settlementMemo(quote.reference),
          afterSlot: funding.slot,
          createRecipientAccount: true,
        });
        const { reason: _resolved, ...submission } = settlement;
        return write(row, { ...payment, state: 'settled', settlement: { ...submission, receipt } });
      }
      case 'failed':
        return write(row, { ...payment, state: 'failed', settlement: { ...settlement, reason: 'finalized_failure' } });
      case 'expired':
        if (payment.state === 'needs_review') return row;
        return write(row, { ...payment, state: 'needs_review', settlement: { ...settlement, reason: 'signature_unknown_after_expiry' } });
      default:
        return row;
    }
  }

  async function submit(row) {
    const { payment } = row;
    const { settlement } = payment;
    const timestamp = now();
    if (settlement.attempts >= MAX_BROADCAST_ATTEMPTS || timestamp - (settlement.lastSubmittedAt ?? -Infinity) < RETRY_INTERVAL_MS) {
      return row;
    }

    // Persist the exact signed bytes and track each broadcast before touching the network.
    const attempt = {
      ...payment,
      settlement: { ...settlement, attempts: settlement.attempts + 1, lastSubmittedAt: timestamp },
    };
    const claimed = await store.compareAndSet(payment.runId, row.revision, attempt);
    if (!claimed) return load(payment.runId);
    try {
      await chain.broadcast(claimed.payment.settlement);
    } catch {
      // Treat transport, preflight and acknowledgement errors as unresolved until an independent read.
    }
    return claimed;
  }

  async function acceptRow(row, { eligibleReportId, providerId, providerWallet }) {
    assertIdentifier(eligibleReportId);
    assertIdentifier(providerId);
    const { payment } = row;
    if (payment.providerId !== providerId || payment.quote.providerWallet !== providerWallet) {
      throw new SettlementError('PROVIDER_MISMATCH', 'The verified runner differs from the funded quote.');
    }
    if (!payment.funding) throw new SettlementError('FUNDING_REQUIRED', 'Finalize funding before accepting a payout.');
    if (payment.state === 'funded') {
      row = await write(row, { ...payment, eligibleReportId, state: 'settlement_ready', acceptedAt: now() });
    }
    if (row.payment.eligibleReportId !== eligibleReportId) {
      throw new SettlementError('REPORT_FIXED', 'This payout is already bound to another verified report.');
    }
    return row;
  }

  return {
    depositWallet,
    async get({ runId }) {
      assertIdentifier(runId);
      const row = await store.get(runId);
      return row && toPublic(row);
    },
    async quote({ runId, developerWallet, providerId, providerWallet }) {
      assertIdentifier(runId);
      assertIdentifier(providerId);
      assertWallet(developerWallet);
      assertWallet(providerWallet);
      if (new Set([depositWallet, developerWallet, providerWallet]).size !== 3) {
        throw new SettlementError('WALLETS_MUST_DIFFER', 'Use separate developer, provider and deposit wallets.', 400);
      }

      let row = await store.get(runId);
      if (!row) {
        const afterSlot = await readChain(() => chain.quoteWindow());
        const [depositAccount, developerAccount] = await Promise.all([
          associatedTokenAccount(depositWallet), associatedTokenAccount(developerWallet),
        ]);
        const createdAt = now();
        const reference = randomUUID();
        const quote = {
          cluster: DEVNET.cluster,
          asset: DEVNET.asset,
          mint: DEVNET.mint,
          decimals: DEVNET.decimals,
          amountAtoms,
          deposit: { wallet: depositWallet, tokenAccount: depositAccount },
          developerWallet,
          providerWallet,
          reference,
          expiresAt: new Date(createdAt + ttlSeconds * 1000).toISOString(),
          funding: {
            instruction: 'transferChecked',
            tokenAccount: developerAccount,
            memo: fundingMemo(reference),
          },
        };
        row = await store.insert(runId, { runId, providerId, state: 'awaiting_funding', createdAt, afterSlot, quote }) ?? await load(runId);
      }
      if (row.payment.providerId !== providerId || row.payment.quote.developerWallet !== developerWallet ||
          row.payment.quote.providerWallet !== providerWallet) {
        throw new SettlementError('QUOTE_FIXED', 'This run already has a quote for different wallets.');
      }
      return toPublic(row);
    },
    async verifyFunding({ runId, signature }) {
      assertSignature(signature);
      const row = await load(runId);
      const { payment } = row;
      if (payment.funding?.signature === signature) return toPublic(row);
      if (payment.state !== 'awaiting_funding') {
        throw new SettlementError('FUNDING_FIXED', 'This run already has a finalized funding transaction.');
      }

      const observation = await readChain(() => chain.observe(signature));
      if (observation.state === 'failed') {
        throw new SettlementError('FUNDING_FAILED', 'The funding transaction finalized with an error.');
      }
      if (observation.state !== 'finalized') {
        throw new SettlementError('FUNDING_PENDING', 'The funding transaction has no finalized evidence yet.');
      }
      const { quote } = payment;
      const funding = await assertFinalizedTransfer(observation.transaction, signature, {
        payer: quote.developerWallet,
        recipient: quote.deposit.wallet,
        amountAtoms: quote.amountAtoms,
        memo: quote.funding.memo,
        afterSlot: payment.afterSlot,
        timeWindow: {
          from: Math.floor(payment.createdAt / 1000),
          until: Math.floor(Date.parse(quote.expiresAt) / 1000),
        },
      });
      const updated = await write(row, { ...payment, state: 'funded', funding });
      if (updated.payment.funding?.signature !== signature) {
        throw new SettlementError('FUNDING_FIXED', 'This run already has a different finalized funding transaction.');
      }
      return toPublic(updated);
    },
    async accept({ runId, ...context }) {
      return toPublic(await acceptRow(await load(runId), context));
    },
    async settle({ runId, ...context }) {
      const row = await acceptRow(await load(runId), context);
      const { payment } = row;
      if (payment.state === 'submitted_or_unknown' || payment.state === 'needs_review') {
        const checked = await reconcileRow(row);
        return toPublic(checked.payment.state === 'submitted_or_unknown' ? await submit(checked) : checked);
      }
      if (payment.state !== 'settlement_ready') return toPublic(row);
      if (payment.quote.deposit.wallet !== depositWallet) {
        throw new SettlementError('DEPOSIT_CHANGED', 'The configured operator differs from the funded deposit wallet.');
      }

      const prepared = await readChain(() => chain.prepare(payment.quote));
      const firstAttempt = await store.compareAndSet(runId, row.revision, {
        ...payment,
        state: 'submitted_or_unknown',
        settlement: { ...prepared, preparedAt: now(), attempts: 0 },
      });
      if (!firstAttempt) {
        const current = await load(runId);
        if (current.payment.eligibleReportId !== context.eligibleReportId) {
          throw new SettlementError('REPORT_FIXED', 'This payout is already bound to another report.');
        }
        return toPublic(current);
      }
      return toPublic(await submit(firstAttempt));
    },
    async reconcile({ runId }) {
      return toPublic(await reconcileRow(await load(runId)));
    },
    async earnings({ providerId, from, to, bucket }) {
      assertIdentifier(providerId);
      return providerEarnings({ store, providerId, from, to, bucket, now: now() });
    },
  };
}

export async function createSettlementFromEnv({ pool, env = process.env }) {
  if (env.AGUS_SETTLEMENT_ENABLED !== '1') return null;
  if (!pool) throw new Error('Devnet settlement requires the dedicated AGUS Postgres connection.');
  const payer = await readKeypair(env.AGUS_SETTLEMENT_KEYPAIR_FILE);
  const connection = connectDevnet(env.AGUS_SETTLEMENT_RPC_URL);
  return createSettlementService({
    store: await createPostgresSettlementStore(pool),
    chain: createDevnetChain({ connection, payer }),
    depositWallet: payer.address,
    amountAtoms: env.AGUS_SETTLEMENT_AMOUNT_ATOMS ?? '2500000',
    ttlSeconds: Number(env.AGUS_SETTLEMENT_QUOTE_TTL_SECONDS ?? '1800'),
  });
}
