# Security and evidence boundaries

| Threat | Required control |
| --- | --- |
| Unknown or malicious APK | Require a byte hash and locally reviewed package/scenario authorization before execution. Install only on a dedicated test device with controlled egress. Remove or reset the build before returning the device to service. |
| Unauthorized device control | Outbound authenticated runner connections, device-scoped exclusive leases, expiry and cancellation. Keep ADB local to the approved host. Restrict agent actions to explicit scenario verbs and selectors. |
| Dishonest provider or fabricated result | Verify signed evidence with an enrolled issuer key. Independently check chain claims and distinguish measurement provenance. A provider claim still depends on runner trust. |
| Cross-tenant leakage | Enforce ownership on projects, files, runs and events. Scope runner grants to one build and lease. Keep identity, storage, secrets and deployment separate from AGUS Crypto. |
| Compromised agent | Give the agent a scoped task interface with bounded actions, observation projection and time and action budgets. Keep host paths, application secrets and unrelated device surfaces outside the interface. |
| Duplicate or diverted payment | Verify canonical Devnet genesis, exact job reference, mint, recipient, amount and finalized effects. Save the payout signature before broadcasting. Reconcile the same signature on ambiguous outcomes. |
| Privacy and consent | Exclude IMEI, contacts, location, personal apps and device-wide logs. Use a disposable identity and wallet. Treat training reuse as separate explicit permission. |

Provenance labels distinguish operator declaration, measurements observed on hardware, emulator measurements and fixture results. A valid issuer signature verifies the issuer and integrity of the report. Physical provenance and wallet eligibility require independent acceptance.

Keep private keys, runtime session credentials, APKs and customer evidence out of Git. Capture screenshots from approved apps only. Purge sandbox artifacts after the documented retention window. On an unsafe state, stop the session, preserve the limited audit record and pause device reuse until cleanup is confirmed. [Historical threat model](docs/mobile-test/NETWORK.md)
