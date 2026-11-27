# Implementation ledger

## Verified

- Source read access and destination push access were verified. The eleven mobile-testing commits preserve authorship and original evidence from `5ecc4d97156fc9ac94de895e76691e0ddef7a0c3`. The financial checkout and remote refs were preserved. Financial HTTPS readiness returned HTTP 200 on November 27. [Migration mapping](docs/migration/UPSTREAM.md)
- Canonical Android acceptance booted an API 35 AVD, exercised official MWA Fake Wallet, independently verified Localnet transfers and the missing-broadcast control, sealed the report and reconciled a single Localnet test-token payout. [Passing workflow](https://github.com/omnmlr/agus-ai/actions/runs/45888580906)
- A real Android 15 AVD paired, accepted a private agent workload, installed and launched the pinned APK, and completed a separate manually reserved marketplace job. CI verified both Ed25519 reports, screenshot hashes and uninstall cleanup. [Provider acceptance](https://github.com/omnmlr/agus-ai/actions/runs/45922423658)
- Real local HTTP with labeled synthetic device inputs verified paired private requests, target checks, public marketplace reservations, idempotent retry, stop acknowledgement, signed evidence and APK integrity rejection. Chromium exercised reference portal flows against the API. Generated client, CLI/MCP integration and Android debug build, unit checks and lint passed.
- The original AGUS Crypto ARM64 APK matched the released SHA-256 and App Links signer. The reference portal uploaded the exact release. [Original handset procedure](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/agus-crypto/ANDROID_DEVICE_TEST.md)
- The isolated Neon Free project and restricted runtime login exist. The Function package passed local PostgreSQL TLS, upload and event streaming. Settlement tests passed with disposable PostgreSQL and simulated RPC. Public Devnet read-only verification confirmed the Circle test mint at finalized slot 526624627.

## Pending acceptance

- Expanded CI verified real runner enrollment, then the agent exhausted its UI actions before finishing the Fake Wallet transfer. The prior scripted wallet workflow completed. The provider-only CI option now exercises private agent execution and marketplace allocation on real Android independently, and the optional agent-wallet path reports sanitized phases for diagnosis. [Agent wallet run](https://github.com/omnmlr/agus-ai/actions/runs/45921615816)
- Automatic approval review blocked the Function deploy with database and bootstrap secrets. Activate HTTPS using approved Neon bindings. Google OAuth and Resend are covered with simulated provider responses and require authorized live credentials. [Activation checklist](DEPLOYMENT.md#activation-checklist)
- The fixture runs Localnet only. Live Devnet compensation needs a supported Devnet device scenario, funded disposable wallets, and a mounted settlement signer. The public faucet returned HTTP 410. Mainnet funds were not used. [Settlement runbook](services/settlement/README.md)
- Antigravity owns the Windows and handset preparation. Physical Android, the original financial APK's wallet journey and genuine Seeker acceptance remain outstanding. Chisom owns final frontend visuals. The typed contract reflects the supplied design handoff. [Frontend contract](FRONTEND_CONTRACT.md)
