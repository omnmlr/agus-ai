# Implementation ledger

## Verified

- Source read access and destination push access were verified. The eleven mobile-testing commits preserve authorship and original evidence from `5ecc4d97156fc9ac94de895e76691e0ddef7a0c3`. The financial checkout and remote refs were preserved. Financial HTTPS readiness returned HTTP 200 on November 27. [Migration mapping](docs/migration/UPSTREAM.md)
- Canonical Android acceptance booted an API 35 AVD, exercised official MWA Fake Wallet, independently verified Localnet transfers and the missing-broadcast control, sealed the report and reconciled a single Localnet test-token payout. [Passing workflow](https://github.com/omnmlr/agus-ai/actions/runs/45888580906)
- A real Android 15 AVD paired, accepted a private agent workload, installed and launched the pinned APK, and completed a separate manually reserved marketplace job. CI verified both Ed25519 reports, screenshot hashes and uninstall cleanup. [Provider acceptance](https://github.com/omnmlr/agus-ai/actions/runs/45922423658)
- Real local HTTP with labeled synthetic device inputs verified paired private requests, target checks, public marketplace reservations, idempotent retry, stop acknowledgement, signed evidence and APK integrity rejection. Chromium exercised reference portal flows against the API. Generated client, CLI/MCP integration and Android debug build, unit checks and lint passed.
- The original AGUS Crypto ARM64 APK matched the released SHA-256 and App Links signer. The reference portal uploaded the exact release. [Original handset procedure](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/agus-crypto/ANDROID_DEVICE_TEST.md)
- The isolated Neon Free project and restricted runtime login exist. The Function package passed local PostgreSQL TLS, upload and event streaming. Settlement tests passed with disposable PostgreSQL and simulated RPC. Public Devnet read-only verification confirmed the Circle test mint at finalized slot 526624627.

- A follow-up real Android 15 workflow completed a private MWA Localnet transfer in five scoped device actions, independently verified the chain result, validated the signed report and screenshot digest, and passed a separately accepted unpaid marketplace job. It fixed the Fake Wallet post-approval transition and used numeric lamports in the signed API report. [Agent wallet and marketplace evidence](https://github.com/omnmlr/agus-ai/actions/runs/45923508742)

## Pending acceptance

- Automatic approval review blocked the Function deploy with database and bootstrap secrets. Activate HTTPS using approved Neon bindings. Google OAuth and Resend are covered with simulated provider responses and require authorized live credentials. [Activation checklist](DEPLOYMENT.md#activation-checklist)
- The fixture runs Localnet only. Live Devnet compensation needs a supported Devnet device scenario, funded disposable wallets, and a mounted settlement signer. The public faucet returned HTTP 410. Mainnet funds were not used. [Settlement runbook](services/settlement/README.md)
- Antigravity owns the Windows and handset preparation. Physical Android, the original financial APK's wallet journey and genuine Seeker acceptance remain outstanding. Chisom owns final frontend visuals. The typed contract reflects the supplied design handoff. [Frontend contract](FRONTEND_CONTRACT.md)

## November 27 model, Devnet and release checkpoint

- Live Gemini 3.1 Flash-Lite selected launch and finish over the existing bounded action API in a synthetic Android adapter. The signed-run schema distinguishes Gemini provenance from scripted selection and the external controller. Actual Android with Gemini is available as a credentialed workflow option. It has not run yet.
- The Devnet fixture APK builds and verifies. Its loopback helper verified public Devnet genesis and correctly rejected wrong and unfunded payers. Focused control-plane tests verified cluster matching, pinned payer and receipt replay against simulated RPC. A funded attended transfer and public payout are outstanding.
- Training export requires a consented signed trajectory plus separate grants from the developer and device owner. Tests verified redaction, role checks and withdrawal. SAS now verifies a digest claim using SDK codecs. The Devnet SAS program was observed executable at finalized slot 526768507. Actual AGUS issuance still needs a trusted funded issuer.
- Integrated the published Antigravity `f077492` tooling. Windows 17/17 preflight is Antigravity’s result. Physical USB and genuine Seeker acceptance remain open. The MCP scenario test now uses a bounded wall-time deadline to handle Windows process latency.
- Founder activation requires approved hosting bindings, live Google/Resend checks and funded disposable Devnet wallets. [Exact configuration](DEPLOYMENT.md#founder-activation-inputs)
- GitHub Actions published the Neon backend ZIP, signed Android reference APK, signed Devnet fixture APK, checksums and source revision from `a5673c8`. The direct release upload returned HTTP 401. [Preview artifacts](https://github.com/omnmlr/agus-ai/actions/runs/45948715543)
