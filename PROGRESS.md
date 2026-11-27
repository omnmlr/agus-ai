# Implementation ledger

## Verified

- Source read access returned pivot checkpoint `5ecc4d97156fc9ac94de895e76691e0ddef7a0c3`. The destination's authenticated permission reports push access and passed a dry-run push. Local financial checkout was clean at `b1862ef`.
- Eleven mobile-testing commits were migrated with preserved authorship, driver and evidence. The source and filtered mobile package tree IDs match at the import boundary. [History mapping](docs/migration/UPSTREAM.md)
- Seven migrated checks passed from the new repository, covering exact SOL and SPL effects, missing finality, collection boundaries, protected receipt data and the local MCP transport.
- Existing financial readiness returned HTTP 200 on a read-only request. A blank AGUS AI project in the connected Neon Free organization provides its own EU database and role namespace.

## Historical evidence

- Android 15 on GitHub Actions completed MWA wallet approval and Localnet transfers, the signed-without-broadcast negative control, signed receipts and one reconciled local provider payment.
- The signed original AGUS Crypto release is an ARM64 target with a published digest. Historical handset reports document an identity warning, a Solflare Battery Saver issue and an MWA teardown/callback regression. [Original handset procedure](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/agus-crypto/ANDROID_DEVICE_TEST.md)

## In progress

- Hosted Postgres API, outbound provider runner, dashboard, Android companion, developer CLI/MCP and signed report path.
- Exact Devnet test-USDC quote, funding, settlement and reconciliation path. A funded disposable wallet is required for a live payout.
- Dedicated device and hosted demo acceptance. The managed environment has no attached handset or hardware Android acceleration.

## November 27 recovery

- Recovered the previously unpublished services, apps and typed contract. The provider runner and control-plane HTTP suites passed private-link authorization, exclusive claiming, stop acknowledgement, consent and signed evidence using synthetic devices. Chromium exercised the reference console against the local API.
- The first new-repository Android CI run passed on a real booted API 35 AVD with Fake Wallet, Localnet finality, the missing-broadcast control and single-signed Localnet test-token settlement. [Acceptance workflow](https://github.com/omnmlr/agus-ai/actions/runs/45888580906)
- The original signed ARM64 AGUS Crypto APK matched release SHA-256 and the published App Links signer. An upload through the reference console succeeded. A physical wallet journey still needs device access and disposable identities.
- The founder supplied the design handoff and tokens. The frontend contract records the functional boundaries. Chisom owns final visuals. Antigravity owns Windows and physical-device preparation.
- Next gate is the isolated Neon HTTPS deployment and the expanded CI workflow combining the actual runner, Android, private invite, marketplace, agent actions and independent chain verification. Live Devnet payout still needs funded disposable wallets.

- Expanded CI reached the real provider runner in Android, then rejected the Localnet amount before invitation creation. Fixed the string-to-safe-integer conversion at the HTTP boundary and the runner’s pinned amount check. Re-run the workflow to verify the complete private and marketplace paths. [Initial expanded run](https://github.com/omnmlr/agus-ai/actions/runs/45921065159)
- HTTPS activation remains gated by approved Neon secret binding. The Function bundle and restricted PostgreSQL TLS startup passed locally. Google OAuth and Resend delivery need dedicated runtime bindings. The current runner’s wallet fixture targets Localnet. Public Devnet payout additionally needs a funded disposable Devnet wallet lane and a mounted settlement signer on the deployment that supports it. [Activation checklist](DEPLOYMENT.md#activation-checklist)
- Verified both generated-client HTTP and stdio MCP integration against the local control plane, including idempotent private requests hidden from marketplace discovery and pending explicit provider acceptance. [Expanded Android rerun](https://github.com/omnmlr/agus-ai/actions/runs/45921615816)
