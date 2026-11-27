# Live verification, 27 November 2026

Resumed from `79e63ec43c78e4c681a01efb6f13fbdd5ae68055` on the product feature branch. The Cloud environment reported its updated egress policy as enforced. The existing Gemini key returned HTTP 200 from the model API and generated valid planner responses with `gemini-3.5-flash-lite` in the synthetic adapter smoke test. The configured 3.1 Flash-Lite model returned HTTP 503 during the initial generation checks. Google OpenID discovery and GitHub API reads succeeded. The unauthenticated Resend API answered HTTP 401.

## Devnet

Public Solana RPC returned the pinned Devnet genesis. Finalized reads found the Circle test USDC mint and the executable SAS program `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`. No original role files were available in the accessible workspace. The restricted replacement signer set had zero finalized SOL balances and its three campaign associated token accounts were absent.

The Devnet RPC airdrop returned HTTP 410 and directed users to the [interactive Solana faucet](https://faucet.solana.com/). The demo reserve is 0.27 Devnet SOL across the six roles and 1.7 Devnet USDC to the campaign funder through the [Circle testnet faucet](https://faucet.circle.com/). Use the [founder-controlled setup](founder-signing.md#disposable-solana-devnet-identities) to generate and record a persistent roster.

The funded Devnet test reached the public chain and stopped at its balance check before signing. The SAS credential and schema derived for this acceptance were absent at finalized commitment. Creation, payouts, refund and attestation issuance require the funded signers. The PostgreSQL and Agave Localnet regression finalized the 1.7 fixture deposit, the 0.7 payout, the 0.2 partial award and the 0.8 refund through separate finalized RPC reads. [Localnet verification](evidence/live-2026-11-27/localnet-campaign.json)

## Hosted activation

| Observed public endpoint | Result |
| --- | --- |
| `/health` | HTTP 200, Postgres persistence healthy |
| `/console.html` | HTTP 200 |
| `/api/v1/projects` | HTTP 401 without a session |
| `/api/v1/auth/google/callback` | HTTP 400 for a request without OAuth state |
| `/.well-known/assetlinks.json` | HTTP 404 |
| `/auth/android` | HTTP 404 |

The public check had no deployment metadata binding. Confirm the active deployment ID and save its rollback ZIP and configuration in the authorized Neon console. Deployment 2 was left in service. After approval, apply the reviewed artifact and use [the founder signing setup](founder-signing.md#android-release-keys-and-private-preview-manifest) to bind the installed Companion certificate. Confirm the JSON App Links association, Android consent and callback, restart and replay behavior, and Resend delivery with an authorized mailbox. Keep the settlement worker on the separate [approved single-write-origin cutover](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement).

Use the [hardware handoff](handoff.md#windows-and-genuine-seeker-verification-assignment) for the attended Windows USB run, genuine Seeker wallet and Seed Vault observations, and the separate candidate OEM isolation and recovery matrix.
