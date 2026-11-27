# Independent verification and founder handoff

Use the [preview release matrix](functionality-matrix.md), [audit](audit.md) and [commercial dossier](../research/README.md). The public product and payments remain unavailable pending a separate decision.

Start from branch `feature/phase-2-3-product`. The full AOSP campaign, staging-failure safety exercise and offline receipt verification passed at `b3f239f6e885a3f212e090d89909ef4281282671`. Compare the code and artifacts you test with the revision file in each run. [Full AOSP](https://github.com/omnmlr/agus-ai/actions/runs/45994668676) · [Safety](https://github.com/omnmlr/agus-ai/actions/runs/45994670655) · [Signed evidence](evidence/45994668676) · [Sanitized campaign report](evidence/45994668676/campaign-evidence.json)

## Antigravity assignment

1. Start from the published feature branch and verify the recorded commit and CI artifacts. Preserve your existing Windows/Seeker setup. In a clean checkout, run the `full` and `safety` AOSP journeys. Record the APK SHA-256, signer, manifest key fingerprint, OS and policy. Verify both downloaded receipts with the pinned issuer key and compare the assignment, attempt and build digest with the campaign. ADB bootstraps and observes the lab. Record each interaction and its privilege. [Reproduction and verification commands](../../packages/cooperative-android/README.md)
2. Verify the dedicated lane using an already authorized lab phone/emulator and the existing Localnet tools. Run positive wallet transfer, cancellation, wrong network, and signed-without-broadcast. Capture independent chain evidence with the expected genesis, recipient, amounts and finality. Compare deterministic external actions and signed report verification.
3. For each approved candidate retail OS/OEM, obtain separate owner consent on disposable hardware before attempting enrollment. Use a stock Pixel-class device, one approved high-volume non-Google OEM, and a genuine attended Seeker for hardware claims. Start with an empty personal profile seeded only with synthetic contacts, media, clipboard, test wallets and apps. Validate two directions of bridge attempts, sharing, pickers, protected windows, allowed networking, package collisions and relevant OEM behavior.
4. Run the [Phase 1 acceptance cases](../phase-1/implementation.md) with at least 30 stop/recovery and 30 cleanup trials per qualifying configuration. Include installation interruption, process death, portrait change, network loss, airplane mode, owner Stop, Home, lock, server revocation and reboot. Measure worst local stop/reclaim time and verify no new work until cleanup. Record each trial, artifact, receipt and hardware provenance.
5. On a dedicated controlled device, verify the reference companion points to an authorized control-plane origin. Connect the disposable Fake Wallet, view the exact challenge, decline once, verify once, replace, disconnect, and retry old proofs. Check earnings and ledger behavior. Separately exercise sign-in, native assignment review and consent withdrawal. Never use personal keys or Mainnet.
6. Report reproducible issues with exact image, step, expected and actual result. Record environment classification and untested surfaces. Return only sanitized observations and an independently assessed go/no-go for each lane. A failed safety or evidence gate keeps the affected lane disabled.

## Founder activation checklist

- Review the local emulator and independent audit evidence. Choose the smallest supported test scope, reviewed first-party build and authorized devices after review.
- Approve a separate hosting and PostgreSQL environment. Set `AGUS_DATABASE_URL` with the dedicated restricted database role, and `AGUS_PUBLIC_ORIGIN` to the exact HTTPS API origin. Verify restore, rate limiting, tenant separation and alerting before activation. [Deployment instructions](../../DEPLOYMENT.md)
- Approve the verified Resend sender and a dedicated OTP secret. Register `/api/v1/auth/google/callback` for the chosen HTTPS API origin and set the web return URL to the approved console. Verify both flows with disposable accounts. Publish `/.well-known/assetlinks.json` for the companion package and the chosen production signer only after the Android callback is complete. [Identity configuration](../../DEPLOYMENT.md)
- Confirm legal and distribution approval for DPC, workload installs and user disclosures. Verify role removal, privacy, retention and export deletion independently before any retail onboarding.
- Approve disposable Devnet identities only after the wallet and settlement gates pass. Agree who can adjudicate a dispute, when partial entitlement vests, where funds return, and who pays network fees. Run quoted funding, accepted payout, cancellation and unknown-signature reconciliation with the approved test asset before any public payment activation. [Dedicated settlement contract](../../services/settlement/README.md)
- For genuine Seeker and SAS, authorize the devices, disposable issuer, schema and RPC policy. Publish evidence claims only after actual hardware and finalized on-chain verification.
- For model-driven tests, authorize the existing model binding, set scoped budgets, and run actual Android with the model. Keep evidence distinct from deterministic or simulated controls.

## Demonstration sequence

| Time | Show |
| --- | --- |
| 0:00–0:30 | A release owner wants repeatable onboarding and Solana wallet coverage without requiring a Seeker of their own. Open a pinned build in the portal. |
| 0:30–1:15 | Build and publish a mixed campaign. Point to exact APK, reviewer rubric, eligibility criteria, device lanes and visible missing denominator. Use the actual Chromium path. |
| 1:15–2:10 | Show AOSP Android’s consented Work-profile testing. Reproduce the duplicate onboarding count, review and send the structured finding, then show signed evidence and confirmed Android cleanup. |
| 2:10–2:55 | Open the dedicated Android Localnet result. Compare the callback-only result with the independently finalized expected transaction. Show the runner receipt signature and emulator provenance. |
| 2:55–3:40 | Show the accepted finding, the automated pass, two interrupted coverage slots, and 14 nontransferable test units including partial credits. Contrast the buyer’s coverage report with the contributor’s earnings record. End with the retail, funding and model gates in the release matrix. |
