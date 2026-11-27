import { randomUUID } from 'node:crypto';
import { authSession, notice } from './domain.mjs';
import { disputeWindowMs, publicObligation, publicTransfer, recordObligation } from './campaign-compensation.mjs';
import { ownCampaign, refreshCampaigns } from './campaigns.mjs';
import { conflict, exact, missing, own } from './pilot-policy.mjs';
import { requireCondition, stableJson, string } from './security.mjs';

const undisputedStates = ['accepted', 'partially_accepted', 'cancelled', 'expired', 'rejected', 'interrupted'];
const fundingLifetimeMs = 30 * 60_000;
const retryIntervalMs = 5_000;

function escrowView(escrow) {
  return escrow ? { quote: escrow.quote, funding: escrow.funding ?? null, refund: publicTransfer(escrow.refund) } : null;
}

function matchingConfiguration(chain, quote) {
  conflict(chain.depositWallet === quote.deposit && stableJson(chain.network) === stableJson(quote.network),
    'The settlement signer or asset differs from the original quote', 'settlement_configuration_changed');
}

function disputeDeadline(state, assignment) {
  const attempt = assignment.attempt;
  if (assignment.state === 'rejected' && attempt?.review) return attempt.review.at + disputeWindowMs;
  if (assignment.state === 'interrupted' && BigInt(assignment.terms.compensation?.partialAtoms ?? 0) > 0n) {
    const cleanup = own(state.nativeLeases, attempt?.leaseId)?.cleanup;
    if (cleanup) return cleanup.confirmedAt + disputeWindowMs;
  }
  if (['submitted', 'needs_revision'].includes(assignment.state)) return assignment.deadlineAt + disputeWindowMs;
  return 0;
}

function reasonText(value) {
  const reason = string(value, 'dispute reason', 400).trim();
  requireCondition(reason.length > 0, 'A dispute reason is required');
  return reason;
}

function disputeRoute(state, user, assignment, operation, input, config, now) {
  const attempt = assignment?.attempt;
  const paid = assignment?.terms.compensation && attempt?.payoutWallet;
  if (operation === 'dispute') {
    missing(paid && attempt.contributorId === user.id, 'Funded assignment');
    exact(input, ['reason'], 'dispute');
    conflict(!assignment.dispute && !own(state.compensation, assignment.id) && disputeDeadline(state, assignment) > now,
      'The assignment is outside the dispute window', 'dispute_unavailable');
    const dispute = { state: 'open', openedAt: now, reason: reasonText(input.reason) };
    assignment.dispute = dispute;
    notice(state, assignment.ownerId, 'assignment.disputed', { assignmentId: assignment.id }, now);
    return { dispute };
  }
  missing(paid && config.pilot.reviewerIds.has(user.id) && assignment.ownerId !== user.id && attempt.contributorId !== user.id,
    'Reviewable dispute');
  exact(input, ['decision', 'reason'], 'dispute resolution');
  conflict(assignment.dispute?.state === 'open' && !own(state.compensation, assignment.id), 'This dispute is already closed');
  const interrupted = assignment.state === 'interrupted';
  requireCondition(['uphold', 'award'].includes(input.decision), 'Choose uphold or award');
  const reason = reasonText(input.reason);
  if (input.decision === 'award') {
    recordObligation(state, assignment, attempt, 0, interrupted ? 'interrupted' : 'accepted', now);
  }
  attempt.review = {
    decision: input.decision === 'award' ? (interrupted ? 'partial' : 'accept') : 'reject', reason, at: now,
    ...(attempt.submissions.length && { submissionVersion: attempt.submissions.at(-1).version }),
  };
  assignment.state = input.decision === 'award' ? (interrupted ? 'partially_accepted' : 'accepted') : 'rejected';
  Object.assign(assignment.dispute, { state: 'resolved', decision: input.decision, resolution: reason, resolvedAt: now, reviewerId: user.id });
  notice(state, attempt.contributorId, 'assignment.dispute_resolved', { assignmentId: assignment.id }, now);
  return { dispute: assignment.dispute };
}

function planRefund(state, campaign, now) {
  const { escrow } = campaign;
  conflict(['cancelled', 'completed'].includes(campaign.state) && escrow?.funding, 'Close the funded campaign before requesting a refund');
  if (escrow.refund) return escrow.refund;
  let remaining = BigInt(escrow.quote.amountAtoms);
  for (const id of campaign.assignmentIds) {
    const assignment = state.assignments[id];
    if (!assignment.terms.compensation) continue;
    conflict(undisputedStates.includes(assignment.state) && assignment.dispute?.state !== 'open'
      && (assignment.dispute?.state === 'resolved' || disputeDeadline(state, assignment) <= now),
    'Outstanding work or dispute windows still reserve campaign funds', 'funds_reserved');
    const obligation = own(state.compensation, id);
    if (obligation?.amountAtoms) {
      conflict(obligation.payout?.state === 'finalized', 'Finalize earned payouts before refunding the remainder', 'funds_reserved');
      remaining -= BigInt(obligation.amountAtoms);
    }
  }
  conflict(remaining >= 0n, 'Campaign funding is inconsistent');
  escrow.refund = { state: remaining === 0n ? 'empty' : 'ready', amountAtoms: remaining.toString() };
  return escrow.refund;
}

async function chainRead(action) {
  try { return await action(); }
  catch (error) {
    if (Number.isInteger(error.statusCode)) throw error;
    requireCondition(false, 'The settlement RPC could not be read. Retry reconciliation.', 'settlement_rpc_unavailable', 503);
  }
}

// Only committed bytes can be broadcast. A lost response or an expired unknown signature keeps the original intent.
async function advanceTransfer({ edit, chain, quote, transfer, recipient, memo }) {
  if (transfer.state === 'ready') {
    const signed = await chainRead(() => chain.prepareTransfer({ recipient, amountAtoms: transfer.amountAtoms, memo }));
    transfer = await edit(current => {
      if (current.state === 'ready') Object.assign(current, signed, { state: 'submitted_or_unknown', attempts: 0 });
      return current;
    });
  }
  if (!['submitted_or_unknown', 'needs_review'].includes(transfer.state)) return transfer;
  const observation = await chainRead(() => chain.inspect(transfer.signature, {
    payer: quote.deposit, recipient, amountAtoms: transfer.amountAtoms, memo, afterSlot: quote.fundingSlot,
    createRecipientAccount: true,
  }, transfer.lastValidBlockHeight));
  const persisted = await edit((current, now) => {
    if (current.signature !== transfer.signature || !['submitted_or_unknown', 'needs_review'].includes(current.state)) return { current };
    if (observation.state === 'finalized') {
      Object.assign(current, { state: 'finalized', receipt: observation.receipt });
      delete current.reason;
    } else if (observation.state === 'failed') {
      Object.assign(current, { state: 'needs_review', reason: 'finalized_failure' });
    } else if (observation.state === 'expired') {
      Object.assign(current, { state: 'needs_review', reason: 'signature_unknown_after_expiry' });
    } else if (current.state === 'submitted_or_unknown' && current.attempts < 3
      && now - (current.lastSubmittedAt ?? -Infinity) >= retryIntervalMs) {
      current.attempts++;
      current.lastSubmittedAt = now;
      return { current, broadcast: true };
    }
    return { current };
  });
  if (persisted.broadcast) {
    try { await chain.broadcast(persisted.current); } catch { /* Observe the original signature on the next request. */ }
  }
  return persisted.current;
}

export function isEscrowRoute([resource, id, operation, suffix]) {
  return Boolean(id && ((resource === 'campaigns' && operation === 'funding')
    || (resource === 'assignments' && ['payment', 'dispute'].includes(operation) && (!suffix || suffix === 'resolve'))));
}

export async function escrowRoute({ services, route, method, input }) {
  const { store, config, credential } = services;
  const chain = config.campaignChain;
  const [resource, id, operation, suffix] = route;
  const execute = work => store.transaction(state => {
    const now = config.now();
    const user = authSession(state, credential, now);
    refreshCampaigns(state, now);
    return work(state, user, now);
  });
  if (resource === 'assignments' && operation === 'dispute' && method === 'POST') {
    return execute((state, user, now) => disputeRoute(state, user, own(state.assignments, id), suffix ?? 'dispute', input, config, now));
  }
  if (resource === 'campaigns' && method === 'GET' && !suffix) {
    return execute((state, user) => ({ escrow: escrowView(ownCampaign(state, user, id).escrow) }));
  }
  missing(method === 'POST' && (resource === 'campaigns' ? ['quote', 'verify', 'refund'].includes(suffix) : !suffix), 'Route');
  requireCondition(chain, 'Funded campaign settlement is disabled', 'campaign_settlement_unavailable', 503);

  if (resource === 'campaigns' && suffix === 'quote') {
    exact(input, ['expectedRevision'], 'campaign funding quote');
    const snapshot = await execute((state, user, now) => {
      const campaign = ownCampaign(state, user, id);
      const revision = campaign.revisions.at(-1);
      conflict(input.expectedRevision === campaign.revision, 'Campaign revision changed', 'revision_conflict');
      if (campaign.escrow) return { escrow: escrowView(campaign.escrow) };
      conflict(campaign.state === 'draft' && revision.fundingAmountAtoms && revision.deadlineAt > now, 'A payable draft is required');
      conflict([...config.pilot.reviewerIds].some(id => id !== user.id && own(state.users, id)),
        'A separate dispute reviewer is required before funding', 'reviewer_required');
      const funder = state.users[user.id].payoutWallet;
      conflict(funder && state.users[user.id].payoutWalletVerifiedAt && funder !== chain.depositWallet, 'Verify a distinct funding wallet first', 'wallet_required');
      return { funder, revision };
    });
    if (snapshot.escrow) return snapshot;
    const [afterSlot, source, destination] = await chainRead(() => Promise.all([
      chain.quoteWindow(), chain.tokenAccount(snapshot.funder), chain.tokenAccount(chain.depositWallet),
    ]));
    return execute((state, user, now) => {
      const campaign = ownCampaign(state, user, id);
      const revision = campaign.revisions.at(-1);
      conflict(campaign.state === 'draft' && revision.sha256 === snapshot.revision.sha256 && revision.deadlineAt > now,
        'Campaign changed while the quote was created', 'revision_conflict');
      conflict(state.users[user.id].payoutWallet === snapshot.funder, 'Funding wallet changed', 'wallet_required');
      campaign.escrow ??= { quote: {
        reference: randomUUID(), revision: campaign.revision, revisionSha256: revision.sha256, funder: snapshot.funder,
        deposit: chain.depositWallet, source, destination, network: chain.network,
        memo: `agus:campaign:funding:v1:${id}:${revision.sha256}`, amountAtoms: revision.fundingAmountAtoms,
        createdAt: now, expiresAt: Math.min(now + fundingLifetimeMs, revision.deadlineAt), afterSlot,
      } };
      return { escrow: escrowView(campaign.escrow) };
    });
  }
  if (resource === 'campaigns' && suffix === 'verify') {
    exact(input, ['signature'], 'campaign funding proof');
    const escrow = await execute((state, user) => ownCampaign(state, user, id).escrow);
    missing(escrow, 'Funding quote');
    matchingConfiguration(chain, escrow.quote);
    if (!escrow.funding) {
      const funding = await chainRead(() => chain.verifyFunding(input.signature, escrow.quote));
      return execute((state, user) => {
        const current = ownCampaign(state, user, id).escrow;
        conflict(current.quote.reference === escrow.quote.reference, 'Funding quote changed');
        current.funding ??= funding;
        conflict(current.funding.signature === input.signature, 'A different finalized funding transfer is pinned');
        return { escrow: escrowView(current) };
      });
    }
    conflict(escrow.funding.signature === input.signature, 'A different finalized funding transfer is pinned');
    return { escrow: escrowView(escrow) };
  }
  exact(input, [], resource === 'campaigns' ? 'campaign refund' : 'assignment payout');
  const refunding = resource === 'campaigns';
  const load = (state, user) => {
    if (refunding) return { campaign: ownCampaign(state, user, id) };
    const assignment = own(state.assignments, id);
    missing(assignment && (assignment.ownerId === user.id || assignment.attempt?.contributorId === user.id), 'Assignment');
    const obligation = own(state.compensation, id);
    conflict(obligation?.amountAtoms && assignment.dispute?.state !== 'open', 'An accepted entitlement is required');
    return { campaign: state.campaigns[assignment.campaignId], obligation };
  };
  const planned = await execute((state, user, now) => {
    const { campaign, obligation } = load(state, user);
    conflict(campaign.escrow?.funding, 'Finalized funding is required');
    const quote = { ...campaign.escrow.quote, fundingSlot: campaign.escrow.funding.slot };
    matchingConfiguration(chain, quote);
    const transfer = refunding ? planRefund(state, campaign, now)
      : obligation.payout ??= { state: 'ready', amountAtoms: obligation.amountAtoms };
    return { quote, transfer, recipient: refunding ? quote.funder : obligation.payoutWallet };
  });
  const edit = work => execute((state, user, now) => {
    const { campaign, obligation } = load(state, user);
    return work(refunding ? campaign.escrow.refund : obligation.payout, now);
  });
  const memo = `agus:campaign:${refunding ? 'refund' : 'payout'}:v1:${planned.quote.reference}:${id}`;
  const payment = await advanceTransfer({ ...planned, edit, chain, memo });
  return { [refunding ? 'refund' : 'payout']: publicTransfer(payment) };
}

export function campaignEarnings(state, user) {
  const entries = Object.values(state.compensation).filter(entry => entry.contributorId === user.id);
  const assets = new Map();
  for (const entry of entries) {
    if (!entry.amountAtoms) continue;
    const key = entry.network.genesis + ':' + entry.network.mint;
    if (!assets.has(key)) assets.set(key, { network: entry.network, pendingAtoms: 0n, finalizedAtoms: 0n, reviewAtoms: 0n });
    const row = assets.get(key);
    const bucket = ({ finalized: 'finalizedAtoms', needs_review: 'reviewAtoms' })[entry.payout?.state] ?? 'pendingAtoms';
    row[bucket] += BigInt(entry.amountAtoms);
  }
  const funded = [...assets.values()].map(({ network, pendingAtoms, finalizedAtoms, reviewAtoms }) => ({
    network, pendingAtoms: pendingAtoms.toString(), finalizedAtoms: finalizedAtoms.toString(), reviewAtoms: reviewAtoms.toString(),
  }));
  return { earnings: { asset: 'TEST_UNITS', transferable: false,
    testUnits: entries.reduce((sum, entry) => sum + entry.testUnits, 0), records: entries.map(publicObligation), funded } };
}
