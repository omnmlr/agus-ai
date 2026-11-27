# Devnet workload settlement

The control plane can enable an opt-in test USDC lane for an approved device, developer wallet and payout wallet. A quote captures the provider identity, developer source wallet, verified payout destination, exact atom amount, asset, reference and expiry. The operator uses a dedicated disposable Devnet signer and holds test tokens between funding and payout. Failure and expiry can require manual resolution. This lane has no automatic refund or withdrawal endpoint.

The verifier checks finalized Devnet receipts, the Circle test mint, the fee payer, a checked transfer between the expected token accounts, exact before and after balances, the quote-specific memo and funding time window. The payout additionally requires an accepted report from the control plane. Hardware identity and test assertion outcomes are independently evaluated by the execution platform. [Circle testnet faucet](https://faucet.circle.com/) · [USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## Local verification

Run these commands inside `services/settlement`.

```bash
npm ci
npm test
npm run probe:devnet
```

The core tests use simulated RPC outcomes and real Ed25519 signatures and signed transaction serialization. `npm run probe:devnet` is a public read-only test. Using a separate local Postgres test database, set `AGUS_TEST_SETTLEMENT_DATABASE_URL` before running `npm test` to include the concurrent and replay persistence test. A managed Codex runtime with proxy-based egress may need `NODE_USE_ENV_PROXY=1` and `NODE_USE_SYSTEM_CA=1` on Node 24 or a compatible Node 22 release.

## Isolated configuration

| Setting | Value |
| --- | --- |
| `AGUS_SETTLEMENT_ENABLED` | `1` enables the lane. Default off. |
| `AGUS_SETTLEMENT_KEYPAIR_FILE` | Restricted secret file path for the disposable operator Solana CLI JSON keypair. |
| `AGUS_SETTLEMENT_RPC_URL` | Optional HTTPS RPC. Default `https://api.devnet.solana.com`. The driver checks the Devnet genesis. |
| `AGUS_SETTLEMENT_AMOUNT_ATOMS` | Immutable server-side quote amount in integer atoms. Default `2500000` means 2.5 test USDC. |
| `AGUS_SETTLEMENT_QUOTE_TTL_SECONDS` | Default `1800`. Range 60 to 86,400. |

The control plane supplies its dedicated AGUS Postgres connection. The module creates `mobile_devnet_payments_v1` and persists the immutable quote, the verified funding receipt, the accepted report ID and the exact signed payout bytes. Concurrent updates use revision checks. Funding and payout signatures are unique. The public API projects signatures and receipts without the signed bytes.

## Disposable funding and payout walkthrough

1. Create disposable developer and operator wallets and get a provider wallet from the authorized test provider. Restrict key files to their owner and put the operator key in the AGUS deployment secret store. Connect the provider payout destination using the server challenge and the wallet’s sign-message option.
2. Fund the developer and operator with Devnet SOL for fees. Use the Circle faucet with Solana Devnet to give the developer enough test USDC for the quote. Create the operator’s Circle test USDC associated token account using the operator as owner and fee payer. The official Solana faucet can require GitHub sign-in, and the Circle site can require an interactive reCAPTCHA. [Solana faucet](https://faucet.solana.com/) · [Circle faucet](https://faucet.circle.com/)
3. Request a quote through the control plane for a selected provider device. Save the response in a private local directory as `quote.json`. Set `AGUS_FUNDING_KEYPAIR_FILE` to the developer’s disposable keypair file and run `npm run fund:devnet -- quote.json --broadcast`. The command journals the precomputed signature next to the quote before sending. Rerunning against that journal recovers the saved signature.
4. Submit the developer signature to the control plane. The verifier requires finalized funding and returns `FUNDING_PENDING` while evidence is unavailable. Once the run meets the control plane’s accepted-report gate, request settlement and poll reconciliation for the same signature. `settled` requires a successful finalized chain receipt.

For signing with an external wallet, provide the exact `quote.funding.memo` and `quote.funding.tokenAccount` to a checked SPL transfer, with `quote.deposit.tokenAccount` as destination. The transaction uses the developer as fee payer and token authority and includes that transfer followed by the memo. An ordinary send without the memo cannot be credited to the workload.

If the payout acknowledgement is lost, reconciliation reads the saved signature and performs no send. A further explicit settle request checks finality before a rate-limited rebroadcast of identical bytes. An unknown expired signature enters `needs_review`, and a finalized error enters `failed`. Both keep the original signature. Review can still reconcile late finalized evidence for that same signature. The system never signs a replacement for that payout.

## Earnings

Provider earnings use immutable, accepted payout records scoped to the authenticated provider identity. Queries accept UTC `YYYY-MM-DD` bounds with exclusive `to` and `day`, `week` or `month` buckets. The default window covers the last 30 UTC dates. The server returns integer atom strings for pending, settled, failed and review-needed totals, plus separate per-job states. The original accepted payout destination remains attached to each job after a profile wallet change or disconnect. A Devnet explorer link appears when a receipt is finalized.

The wallet proof signs the exact server-issued UTF-8 text with Ed25519. The response uses standard base64, and clients should send the challenge identifier and signature to the authenticated control plane. The server binds challenges to the provider and configured origin, expires them after five minutes and consumes each successful proof once.

## Provenance

The quote verifier adapts the legacy mobile lab’s checked-transfer and token balance validation. The journal preserves its precomputed-signature approach. The historical Localnet acceptance used a separate minted fixture token. [Upstream verifier](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/packages/mobile-test/src/chain.ts) · [Upstream local settlement](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/packages/mobile-test/lab/settlement.ts) · [Upstream acceptance](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/mobile-test/DEMO.md)
