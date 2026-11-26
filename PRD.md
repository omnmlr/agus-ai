# AGUS AI product requirements

AGUS AI gives Solana Android teams and their agents a controlled device on which to test an exact APK, observe wallet behavior and verify the resulting chain effects. The first customer is the existing AGUS Crypto application. The initial buyer is a release or QA owner who has to decide whether a wallet-dependent build is ready to ship.

## Hackathon release

- A developer signs in, creates a project, uploads a hashed Android build and queues a supported workload against a compatible dedicated device.
- An approved provider enrolls a desktop runner, publishes measured capabilities, accepts an exclusive lease, and can stop the session. Device connectivity, availability and provenance are visible.
- A developer or external MCP client can run a versioned wallet scenario or a bounded agent evaluation and inspect progress, evidence, and an issuer-signed report.
- The wallet path demonstrates a callback without broadcast and a corrected transfer. A finalized chain read with exact transaction assertions determines financial success.
- A quoted job can be funded and settled using disposable Devnet wallets when funding and provider wallet acceptance are available. Submission uncertainty follows the original signature through reconciliation.
- The website explains the service, the dashboard supports the developer journey and the Android companion monitors it. The demo identifies which steps used simulation, archived evidence, live Android or live Devnet.

## Acceptance

| Journey | Passing evidence |
| --- | --- |
| Hosted persistence | A project and session survive service restart in isolated Postgres. Another account cannot read the build, run or evidence. |
| Device and lease | A dedicated USB handset or an actual AVD claims a job, measures its capabilities, installs the pinned APK and clears the workload before returning to availability. Duplicate and expired leases are rejected. |
| Wallet behavior | The same approved test pack shows the negative callback, finalized positive result, and a distinct diagnosis for each. A report binds the build, run and evidence hashes. |
| Agent benchmark | The agent chooses bounded actions from observations. A deterministic evaluator measures the result and separately records mode, elapsed time, actions, invalid actions and recovery. |
| Settlement | Finalized Devnet funding and payout bind the exact job, wallet and amount. Reopening reconciliation preserves one payout signature. |
| First customer | An authorized tester verifies the signed AGUS Crypto APK and reproduces a wallet journey on ARM64 using disposable credentials. The report records the actual point reached and any missing evidence. |

## Deferred beyond the demo

Multi-tenant physical fleet operation requires reset and egress controls. Everyday-phone participation requires a demonstrated isolation boundary, provider consent, independent device provenance, and a separate distribution and privacy review. Enterprise evaluation and licensed trajectory export need customer and contributor authorization. [Vision](VISION.md) · [Historical research](docs/mobile-test/RESEARCH.md)
