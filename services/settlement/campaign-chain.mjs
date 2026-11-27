import { address, createSolanaRpc } from '@solana/kit';
import {
  assertFinalizedTransfer, assertSignature, associatedTokenAccount, connectDevnet, createSettlementChain,
  DEVNET, readKeypair,
} from './chain.mjs';
import { SettlementError } from './errors.mjs';

export async function campaignChainFromEnv(env, { persistent, pilot }) {
  const cluster = env.AGUS_CAMPAIGN_SETTLEMENT_CLUSTER;
  if (!cluster) return null;
  if (!persistent || !pilot) throw new Error('Campaign settlement requires the isolated product pilot and durable Postgres');
  const payer = await readKeypair(env.AGUS_CAMPAIGN_SETTLEMENT_KEYPAIR_FILE);
  let network, connection;
  if (cluster === 'localnet' && env.NODE_ENV !== 'production') {
    const url = new URL(env.AGUS_CAMPAIGN_SETTLEMENT_RPC_URL);
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) throw new Error('Campaign Localnet RPC must be loopback');
    const genesis = address(env.AGUS_CAMPAIGN_SETTLEMENT_GENESIS);
    const mint = address(env.AGUS_CAMPAIGN_SETTLEMENT_MINT);
    if (genesis === DEVNET.genesis || genesis === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
      || genesis === '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpGReTQPL') throw new Error('Use a disposable Localnet genesis');
    network = { cluster, genesis, mint, asset: 'TEST-SPL', decimals: 6 };
    connection = createSolanaRpc(url.href);
  } else if (cluster === 'devnet' && env.AGUS_ENABLE_CAMPAIGN_DEVNET === '1') {
    const { rpc: _rpc, ...devnet } = DEVNET;
    network = devnet;
    connection = connectDevnet(env.AGUS_CAMPAIGN_SETTLEMENT_RPC_URL);
  } else throw new Error('Campaign settlement cluster is disabled');

  const chain = createSettlementChain({ connection, payer, network });
  return {
    ...chain, network, depositWallet: payer.address,
    tokenAccount: wallet => associatedTokenAccount(wallet, network),
    verifyFunding(signature, quote) { return inspectFunding(this, signature, quote); },
    inspect: async (signature, expected, height) => {
      assertSignature(signature);
      const result = await chain.observe(signature, height);
      if (result.state !== 'finalized') return { state: result.state };
      return { state: 'finalized', receipt: await assertFinalizedTransfer(result.transaction, signature, expected, network) };
    },
  };
}

export async function inspectFunding(chain, signature, quote) {
  const funding = await chain.inspect(signature, {
    payer: quote.funder, recipient: quote.deposit, amountAtoms: quote.amountAtoms, memo: quote.memo,
    afterSlot: quote.afterSlot,
    timeWindow: { from: Math.floor(quote.createdAt / 1000), until: Math.floor(quote.expiresAt / 1000) },
  });
  if (funding.state !== 'finalized') {
    throw new SettlementError('FUNDING_UNCONFIRMED', 'The authorized funding transfer has no successful finalized proof.');
  }
  return funding.receipt;
}
