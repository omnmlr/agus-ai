# AGUS AI private preview release candidate

The candidate is on `feature/phase-2-3-product`. `a65e07e` recovered the independent-publisher and sealed correction implementation. `ad225f7` recovered the funded Localnet campaign. `3744c34` adds native Google identity. `e78a1a6` adds the private HTTPS runtime, funded UX, typed interfaces, settlement reconciliation, Devnet preparation, and SAS issuance. `9d49759` produces the downloadable release packages. [Feature branch](https://github.com/omnmlr/agus-ai/tree/feature/phase-2-3-product)

## Download and verify

The published software and artifact revision is `0f4fce42bc9cc3b19609ecce2a0a9c0278c783a7`. Both release workflow jobs passed. The Android archive includes the Companion, Work runtime, first-party fixture, independently signed partner fixture, dedicated Devnet wallet fixture, cooperative SDK samples, Neon Function ZIP, App Links template and installation guide. The settlement archive contains the AMD64 images, Compose overrides and runtime configuration template. [Build run](https://github.com/omnmlr/agus-ai/actions/runs/46019819285)

| Download | GitHub archive SHA-256 |
| --- | --- |
| [Android, SDK and Neon Function](https://github.com/omnmlr/agus-ai/actions/runs/46019819285/artifacts/15207177949) | `3c5d9dea3510d0e657c619ed0ab21d2cd25b8563f9f2b4a55a6639a04c081f9f` |
| [Linux AMD64 settlement package](https://github.com/omnmlr/agus-ai/actions/runs/46019819285/artifacts/15207901953) | `def3c897386ff09bad4ee9b8fd930736a79f4dc01f175283dbe57ab1b857f0df` |

The downloaded preview archive matched its GitHub digest. Every internal checksum and all five APK signatures verified. The runtime APK embeds the public key matching the restricted loopback signer. The final Neon archive passed ZIP integrity and its handler returned the expected maintenance response without starting a backend. The settlement job verified the packaged image and configuration checksums before publishing. [APK package IDs and certificate fingerprints](evidence/release-0f4fce4/ANDROID-SIGNERS.txt) · [Per-file checksums](evidence/release-0f4fce4/SHA256SUMS.txt) · [Installation](artifact-installation.md)

## Evidence and deployment boundary

| Gate | Evidence | Activation |
| --- | --- | --- |
| Funded campaigns | Archived `ad225f7` tests used disposable Localnet and Postgres. They finalized 700,000 atoms for automated work, 200,000 for a partial dispute award, and an 800,000-atom refund. The funded balance reached zero. The candidate repeated those results with disposable PostgreSQL 17 and Agave 2.3.13. Concurrent worker ticks settled the partial award and the accepted destination survived replacement. | Use the separately mounted campaign operator and test USDC in a disposable Devnet campaign. Localnet receipts cannot establish Devnet activity. [Original evidence](evidence/final-campaign-localnet.json) · [Candidate results](evidence/release-candidate-localnet.json) |
| Independent publisher | Android staged the independently signed partner APK after the pre-existing package collision was safely handled. `describe/advance/describe` completed, the app was removed, and the archive receipt and cleanup signature independently verified. A second run rejected the mismatched signer before staging. | Register publisher ID, exact APK SHA-256, Android signer and reviewed component. [Partner](https://github.com/omnmlr/agus-ai/actions/runs/46006746972) · [Signer rejection](https://github.com/omnmlr/agus-ai/actions/runs/46006753944) |
| Human correction | AOSP human corrected a sealed dedicated Android runner action from `describe` to `launch`. The installation-signed evidence and cleanup verify offline. The candidate CI run granted consent in Android, exported the exact action mapping without the source run ID, and denied the same delivery after withdrawal. [Candidate correction](https://github.com/omnmlr/agus-ai/actions/runs/46019600943) | The deterministic relay supplies the archived agent trajectory. Actual Gemini Android acceptance requires working Gemini egress or the authorized GitHub Actions secret. [Recovered correction](https://github.com/omnmlr/agus-ai/actions/runs/46006759739) |
| Developer and contributor experience | Real Chromium and isolated API verified create, upload, publish, pause/resume, separate submission, review and receipt download. Local Android builds and JVM tests passed. The browser harness used synthetic APK bytes and software-signed reports. | Hosted reviewer verifies current UI, exact paid amounts, notification preferences, wallet scope and denial states with authorized accounts. [Frontend contract](frontend.md) |
| OAuth and OTP | Local identity tests exercise PKCE, wrong verifier and replay denial, Android callback destination and cancellation, OTP expiry and throttling. Companion signs in with a browser, keeps the attempt and session in Android Keystore-encrypted storage and supports restart. The private Work app can sign in with an email code using the same registered identity. | Choose the final certificate and run verified App Link, real Google user consent, and authorized Resend delivery on the approved deployment. |
| Hosting | The candidate bundle passed local PostgreSQL TLS, dashboard, authenticated project and APK upload. The isolated Compose configuration passed startup with private preview, the worker enabled, App Links and authorization checks. The private runtime builds with HTTPS, a pinned operator public key and explicit preview eligibility. | Neon deployment 2 remains active according to the founder’s checkpoint. The Cloud environment denied a fresh hosted read. Production activation remains an owner action. |
| SAS | The verifier checks finalized account owner, credential, receipt schema, issuer, nonce, expiry and digest. The CLI checks a pinned runner key before allowing issuance and uses a deterministic receipt nonce. | Credential, schema and attestation must actually finalize on Devnet. |
| Hardware | Archive records Android 15 AOSP only. Android runtime limits execution to that measured image. | Antigravity performs the independent dedicated Android, genuine Seeker, and isolated hardware checks in the [handoff](handoff.md). |

The final test run passed 59 Node tests, including the separate funded Localnet integration, and five Android JVM tests. The companion AOSP regression declined an MWA proof, verified the subsequent signed proof against the server and removed the payout destination on disconnect. [Wallet run](https://github.com/omnmlr/agus-ai/actions/runs/46018792867)

## Disposable Devnet funding

The working directory contains six private key files restricted to their owner. The addresses below are public. Live balances were inaccessible in this environment. These are the exact demo reserve targets for fresh zero-balance identities. The utility computes current shortfalls from finalized balances when Devnet is reachable. The test USD Coin mint is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` with six decimals.

| Role | Public address | Reserve target |
| --- | --- | --- |
| App transaction payer | `4HMGQB5PrsdhfPuNhRvHmzEdCqYB3C13jN9sDdmssMrA` | 0.05 Devnet SOL |
| Campaign funder | `wmeuVbGKwnLXfWuqAg6eeALDxfE1efwZjvcvBcTbK89` | 0.05 Devnet SOL and 1.7 Devnet test USDC |
| Campaign settlement operator | `HUZiYNj9x1GuTbFN4wahprVeuwciz9WZzRnGLwUC9JRK` | 0.05 Devnet SOL |
| Contributor payout wallet | `C4LRvUBPHDeJE6sn8RMgWb6qXL7rv7ENNQpytU985Ldx` | 0.02 Devnet SOL |
| SAS authority | `AwUK8G9xKu2vtYGrvhAgTegmFnhSD7pEwSsuCcdckBYZ` | 0.05 Devnet SOL |
| SAS issuer | `J8c1sNxTunxYJyji3nLrDWjsn6vFSNn1RMxbw6k5U7YE` | 0.05 Devnet SOL |

Total reserve for fresh accounts is **0.27 Devnet SOL and 1.7 Devnet test USDC**. The USDC amount funds the quoted example with two coverage slots. Use the actual immutable quote if the demo changes. Give the test USDC to the campaign funder. Let the quote send it to the operator token account.

```bash
npm ci --prefix services/settlement
node services/settlement/prepare-devnet.mjs /path/to/private-identities 1700000 --addresses-only
node services/settlement/prepare-devnet.mjs /path/to/private-identities 1700000 --existing-only --airdrop --prepare-accounts
node services/settlement/prepare-devnet.mjs /path/to/private-identities 1700000 --existing-only --prepare-accounts
```

Use the existing restricted identity directory if you want these addresses. A new directory creates new addresses. Use an interactive Solana faucet only for the remaining SOL figures and an authorized test USDC faucet for the funder's remaining exact amount. Run the last command again to confirm final balances and associated token accounts. Keep separate authority and issuer roles. Use the nominated account wallet in Companion for funder and contributor ownership proof. A device-level wallet applies to dedicated runs.

## Founder activation checklist

Use the [founder-controlled signing setup](founder-signing.md) to retain the approved identities across workspace changes.

1. Download the checksum-verified artifacts and review the underlying evidence. Choose the approved companion and runtime signing identities. Keep every private signing key in the authorized secret store or restricted local service directory.
2. Build the signed companion with `./gradlew assembleRelease` from `apps/android`. Set `AGUS_ANDROID_KEYSTORE_FILE`, `AGUS_ANDROID_KEYSTORE_PASSWORD`, `AGUS_ANDROID_KEY_ALIAS`, and `AGUS_ANDROID_KEY_PASSWORD` from the approved signing store. Verify the result with SDK 35 `apksigner verify --print-certs`. Convert the actual SHA-256 certificate digest to colon-delimited octets and bind it as `AGUS_ANDROID_CERT_SHA256` with `AGUS_PUBLIC_ORIGIN=https://agusai.grindcity.app`.
3. Keep the existing Neon Function `mobileinfra`, project `old-fog-27608369`, branch `br-super-firefly-bgzy7s7x`, database `agus_ai`, and role `agus_ai_runtime`. Retain the current Google callback registration, Google/Resend bindings and rollback ZIP. Approve deployment separately. Pass the signed companion through Android App Link verification, Google consent/cancel/retry, replay denial, secure restart and a real Resend sign-in with the authorized mailbox. [Deployment commands](../../DEPLOYMENT.md)
4. To enable private Android AOSP preview, use registered person IDs in `AGUS_PILOT_MEMBER_IDS`. Place independent reviewer IDs in `AGUS_PILOT_REVIEWER_IDS`. Review APK bytes, signer, publisher and component, then set `AGUS_NATIVE_REVIEWED_BUILDS`. Set `AGUS_PRODUCT_PILOT=private-preview`. Use a restricted signing store to populate `AGUS_NATIVE_MANIFEST_PKCS8`. Build the HTTPS runtime with the corresponding public key and approved workload package list. [SDK and builds](../../packages/cooperative-android/README.md)
5. If Devnet settlement is needed, check Stockholm headroom and independent TLS routing. Use the isolated Compose package and authorize an AGUS AI cutover with a single write origin. Mount only that environment’s disposable campaign signer. Keep the financial service and its edge route separate. In the portal, download the funded revision quote and run the commands below. Verify funding, publish, accept work, pay once to the pinned destination, and reconcile the refund.
6. Initialize SAS on Devnet with the disposable authority, then independently verify the accepted receipt against the runner key obtained from approved enrollment. Issue using the delegated issuer. Record the finalized attestation, credential, schema and nonce. [SAS commands](../../services/attestation/README.md)
7. Run the Android model job on an authorized Android runner with Gemini access. Set `AGUS_GEMINI_API_KEY` from the existing authorized binding and `AGUS_GEMINI_MODEL=gemini-3.1-flash-lite`. Dispatch Android wallet acceptance with `provider_only`, `agent_wallet` and `gemini_agent` enabled, or follow the local dedicated commands. Keep API/network failure separate from evidentiary outcome. [Runner instructions](../../services/provider-runner/README.md)
8. Assign the Windows hardware run to Antigravity. Keep public onboarding and retail Work runtime activation gated until device-specific safety and evidence pass.

```bash
# Pass the disposable campaign-funder key via its restricted file binding.
AGUS_FUNDING_KEYPAIR_FILE=/path/to/private-identities/campaign-funder.json \
  npm --prefix services/settlement run fund:devnet -- agus-campaign-funding-quote.json --broadcast
```

Use the displayed signature in the campaign’s **Verify funding** control. Retry reconciliation with the existing payout or refund signature. An unknown signature stays attached to its original transfer. There is no automatic replacement after expiry.
