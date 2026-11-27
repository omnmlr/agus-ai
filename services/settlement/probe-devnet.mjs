import { connectDevnet, DEVNET, validateDevnetMint } from './chain.mjs';

try {
  const rpc = connectDevnet(process.env.AGUS_SETTLEMENT_RPC_URL);
  const mint = await validateDevnetMint(rpc);
  console.log(JSON.stringify({
    evidence: 'public-devnet-mint-read-only',
    cluster: DEVNET.cluster,
    genesis: DEVNET.genesis,
    mint: DEVNET.mint,
    ...mint,
  }, null, 2));
} catch {
  console.error('Could not verify the finalized Devnet test USDC mint through the configured RPC.');
  process.exitCode = 1;
}
