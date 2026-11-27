# Demo

## Start with available evidence

The migrated lab is executable from this repository. Use the [Android lab walkthrough](docs/mobile-test/DEMO.md) for a dedicated Android 15 AVD or USB handset, official MWA Fake Wallet, pinned fixture and Localnet validator.

On a fresh test device, compare the `wallet-false-success` and `wallet-transfer` scenarios. The first returns a valid wallet signature without a finalized chain effect. The corrected case must independently match the exact payer, recipient, lamports, fee and slot. Verify the Ed25519 report and screenshot digest. The [historical hosted report](docs/mobile-test/evidence/hosted-regression/profiled-run.sealed.json) and [negative control](docs/mobile-test/evidence/hosted-regression/signed-without-broadcast.json) are available when a fresh Android run is unavailable. The archived payout used a local fixture token.

## Recording evidence

Show the Android 15 run's private invitation, five scoped agent actions, independently finalized Localnet transfer, signed report and screenshot integrity. Then show the separate manually accepted marketplace job. Both provider offers were unpaid. The scripted wallet workflow supplies the missing-broadcast negative control and a reconciled Localnet test-token payout. [Agent wallet and marketplace workflow](https://github.com/omnmlr/agus-ai/actions/runs/45923508742) · [Scripted wallet and payout workflow](https://github.com/omnmlr/agus-ai/actions/runs/45888580906)

## Hosted demo acceptance

1. Sign in with a disposable developer account. Register a project and upload a reviewed, hashed fixture build.
2. Start a dedicated provider runner, then check its profile and availability in the dashboard. Start a matched run through CLI or MCP and watch the lease events.
3. Run the signed-without-broadcast scenario and compare it with the corrected run. Show the independent verification decision before showing the runner report.
4. Create an agent-mode attempt and choose semantic actions from actual observations. Record the elapsed time, action count, invalid actions and deterministic result.
5. For a funded Devnet session, review the Circle test-USDC quote, verify funding on Devnet, and settle an eligible provider job. Reconcile a second time and confirm the same payout signature.
6. Confirm the dashboard and Android app reflect the actual run. Identify the environment and wallet evidence level at each step.

## Original AGUS Crypto customer target

Download the signed ARM64 prerelease and verify SHA-256 `d6f449dc6f71454b6fc554e8121f9b5db6cb5cadf3c4402c7483d4033d681e55`. Use its approved disposable identity and dedicated ARM64 phone with funded Phantom and Solflare Devnet accounts. Record the wallet handoff, authorization, ownership proof, callback and any resumed reconciliation. An ambiguous callback calls for reviewing the same attempt ID, not preparing another payment. Capture the package/version, timestamp, warning or failure boundary, and redacted evidence for the original maintainer. [Signed release](https://github.com/omnmlr/hackaholics-financial-agent/releases/tag/agus-crypto-devnet-1b56459d1875) · [Original handset procedure](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/agus-crypto/ANDROID_DEVICE_TEST.md)
