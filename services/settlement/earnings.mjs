import { DEVNET } from './chain.mjs';
import { SettlementError } from './errors.mjs';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

function startOf(value, interval) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  if (interval === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (interval === 'month') date.setUTCDate(1);
  return date.valueOf();
}

function nextStart(value, interval) {
  if (interval === 'month') {
    const date = new Date(value);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.valueOf();
  }
  return value + DAY_MS * (interval === 'week' ? 7 : 1);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(value) ? time : NaN;
}

function stateOf(payment) {
  return payment.state === 'settled' || payment.state === 'failed' || payment.state === 'needs_review'
    ? payment.state : 'pending';
}

function amounts() {
  return { pending: 0n, settled: 0n, failed: 0n, needs_review: 0n };
}

function formatAmounts(values) {
  return {
    pendingAtoms: values.pending.toString(),
    settledAtoms: values.settled.toString(),
    failedAtoms: values.failed.toString(),
    needsReviewAtoms: values.needs_review.toString(),
  };
}

function utc(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function providerEarnings({ store, providerId, from, to, bucket = 'day', now }) {
  const tomorrow = startOf(now, 'day') + DAY_MS;
  const fromMs = from === undefined ? tomorrow - 30 * DAY_MS : parseDate(from);
  const toMs = to === undefined ? tomorrow : parseDate(to);
  if (!['day', 'week', 'month'].includes(bucket) || !Number.isFinite(fromMs) || !Number.isFinite(toMs) ||
      fromMs >= toMs || toMs - fromMs > MAX_RANGE_DAYS * DAY_MS) {
    throw new SettlementError('BAD_EARNINGS_RANGE', 'Provide an increasing UTC date range of at most 366 days and a day, week or month bucket.', 400);
  }

  const windows = new Map();
  for (let time = startOf(fromMs, bucket); time < toMs; time = nextStart(time, bucket)) windows.set(time, amounts());
  const totals = amounts();
  const payouts = await store.listProviderPayouts(providerId, fromMs, toMs);
  const jobs = payouts.map((payment) => {
    const state = stateOf(payment);
    const atoms = BigInt(payment.quote.amountAtoms);
    totals[state] += atoms;
    windows.get(startOf(payment.acceptedAt, bucket))[state] += atoms;
    const signature = payment.settlement?.signature;
    return {
      runId: payment.runId,
      state,
      amountAtoms: payment.quote.amountAtoms,
      destination: payment.quote.providerWallet,
      acceptedAt: new Date(payment.acceptedAt).toISOString(),
      signature,
      explorerUrl: state === 'settled' ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : undefined,
    };
  });
  return {
    cluster: DEVNET.cluster,
    asset: DEVNET.asset,
    mint: DEVNET.mint,
    decimals: DEVNET.decimals,
    timezone: 'Etc/UTC',
    from: utc(fromMs),
    to: utc(toMs),
    bucket,
    totals: formatAmounts(totals),
    buckets: [...windows].map(([start, values]) => ({
      start: utc(Math.max(start, fromMs)),
      end: utc(Math.min(nextStart(start, bucket), toMs)),
      ...formatAmounts(values),
    })),
    jobs,
  };
}
