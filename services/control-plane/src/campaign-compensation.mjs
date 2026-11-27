import { randomUUID } from 'node:crypto';
import { conflict, exact, own } from './pilot-policy.mjs';
import { requireCondition } from './security.mjs';

const maximum = 2n ** 64n - 1n;
export const disputeWindowMs = 24 * 60 * 60_000;

export function disputeDeadline(state, assignment) {
  const attempt = assignment.attempt;
  if (assignment.state === 'rejected' && attempt?.review) return attempt.review.at + disputeWindowMs;
  if (assignment.state === 'interrupted' && BigInt(assignment.terms.compensation?.partialAtoms ?? 0) > 0n) {
    const cleanup = own(state.nativeLeases, attempt?.leaseId)?.cleanup;
    if (cleanup) return cleanup.confirmedAt + disputeWindowMs;
  }
  if (['submitted', 'needs_revision'].includes(assignment.state)) return assignment.deadlineAt + disputeWindowMs;
  return 0;
}

export function mayDispute(state, assignment, now) {
  return Boolean(assignment.terms.compensation && assignment.attempt?.payoutWallet && !assignment.dispute &&
    !own(state.compensation, assignment.id) && disputeDeadline(state, assignment) > now);
}

function atoms(input) {
  requireCondition(typeof input === 'string' && /^(0|[1-9]\d{0,19})$/.test(input) && BigInt(input) <= maximum,
    'Use a non-negative token amount in whole atoms');
  return BigInt(input);
}

export function paymentTerms(input, config, dedicated) {
  if (input === undefined) return null;
  requireCondition(config.campaignChain && !dedicated, 'Funded compensation requires an enabled native campaign settlement service',
    'campaign_settlement_unavailable', 503);
  exact(input, ['amountAtoms', 'partialAtoms'], 'task compensation');
  const amount = atoms(input.amountAtoms);
  const partial = atoms(input.partialAtoms ?? '0');
  requireCondition(amount > 0n && partial <= amount, 'Partial compensation must be within the published amount');
  return { amountAtoms: amount.toString(), partialAtoms: partial.toString() };
}

export function sumCampaignFunds(tasks) {
  const total = tasks.reduce((sum, task) => sum + BigInt(task.compensation?.amountAtoms ?? 0) * BigInt(task.count), 0n);
  requireCondition(total <= maximum, 'Campaign compensation exceeds the token amount limit');
  return total.toString();
}

export function pinnedPayout(user, campaign) {
  const { payoutWallet, payoutWalletVerifiedAt } = user;
  const quote = campaign.escrow?.quote;
  conflict(quote && campaign.escrow.funding && payoutWallet && payoutWalletVerifiedAt
    && ![quote.funder, quote.deposit].includes(payoutWallet), 'Verify a distinct payout wallet before accepting funded work', 'wallet_required');
  return payoutWallet;
}

export function recordObligation(state, assignment, attempt, testUnits, basis, now) {
  conflict(!own(state.compensation, assignment.id), 'Work was already accepted');
  const terms = assignment.terms.compensation;
  const amountAtoms = terms ? (basis === 'interrupted' ? terms.partialAtoms : terms.amountAtoms) : '0';
  if (BigInt(amountAtoms) > 0n) conflict(attempt.payoutWallet, 'The assignment has no pinned destination', 'wallet_required');
  state.compensation[assignment.id] = {
    id: randomUUID(), assignmentId: assignment.id, contributorId: attempt.contributorId, testUnits, basis,
    termsDigest: assignment.termsDigest, acceptedAt: now,
    ...(BigInt(amountAtoms) > 0n && { payoutWallet: attempt.payoutWallet, amountAtoms, network: terms.network }),
    state: BigInt(amountAtoms) > 0n ? 'payout_eligible' : testUnits ? 'test_obligation_recorded' : 'unpaid_accepted',
  };
}

export function publicObligation(entry) {
  const { id, assignmentId, state, testUnits, acceptedAt, amountAtoms, network, payout } = entry;
  return { id, assignmentId, state, testUnits, acceptedAt,
    ...(amountAtoms && { amountAtoms, network, payout: publicTransfer(payout) }) };
}

export function publicTransfer(value) {
  if (!value) return null;
  const { state, amountAtoms, signature, receipt, reason } = value;
  return { state, amountAtoms, signature, receipt, reason };
}
