# Frontend integration contract

Use the [generated OpenAPI model](packages/developer-client/openapi.json) and [typed session client](packages/developer-client/src/typed.d.mts) for person-facing routes. Use the [control-plane API reference](services/control-plane/API.md) for provider-runner routes, exact status codes and report payloads. The reference web and Android interfaces are integration surfaces. The final visual system follows `UIUX_HANDOFF.md` and `DESIGN_TOKENS.json` (founder-provided November 26 handoff, reviewed).

## Integrate now

```sh
npm ci
npm ci --prefix services/control-plane
AGUS_LOCAL_DATA_DIR=.data/local AGUS_PROVIDER_BOOTSTRAP_TOKEN=synthetic-local-bootstrap-only \
  npm start --prefix services/control-plane
```

In a second terminal, run `npm run dev --prefix apps/web` and open the shown local origin. The web reference proxies `/api/v1` to loopback. Use your own synthetic email and a password of at least 12 characters. Configure a different state directory per teammate. A local Windows runner and dedicated handset can join through [provider setup](services/provider-runner/README.md). For a shared or hosted origin, use the [deployment configuration](DEPLOYMENT.md). All examples and fixtures in this contract use synthetic data.

```ts
import { createAgusClient, type AgusTypes } from '@agus/developer-client';

let token: string | undefined;
const api = createAgusClient({ baseUrl: 'http://localhost:8080', getToken: () => token });
const signedIn = await api.POST('/api/v1/auth/login', {
  body: { email: 'tester@example.com', password: 'synthetic-only-passphrase' },
});
token = signedIn.data?.token;
const projects = await api.GET('/api/v1/projects');
type Run = AgusTypes['Run'];
```

The browser build uses its own origin proxy. A separately served browser requires `AGUS_CORS_ORIGIN` on the API. Regenerate the checked-in schema and types with `npm run contract:generate --workspace @agus/developer-client` after a route change. The contract check and a real HTTP integration test are in the same workspace.

## Android navigation

Exactly three tabs persist as top-level destinations **Home**, **Activity**, and **Earnings**. Everything else is an authentication step, detail screen, or settings route. Open the web developer portal from Welcome and Profile.

| Screen and root test ID | Data and actions | State examples |
| --- | --- | --- |
| Welcome · `screen-welcome` | Explain dedicated-device participation, continue to Auth, open web Developer Portal. | First visit, alternate developer entry. |
| Auth · `screen-auth` | Google and email code in the final companion when configured. Password sign-in is limited to the reference integration preview. Preserve a pending invitation through the verified login flow. | Invited registration, expired/wrong code, provider unavailable, session expired. |
| Enrollment · `screen-enrollment` | Create expiring pairing code, show desktop runner setup and poll owned device records until first heartbeat. | Code issued, expired, device unseen, measured, revoked. |
| Home · `screen-home` | Tappable earnings chart, effective readiness and participation, today’s contributions, current session or helpful empty state. | Available, offline, active lease, no earnings. |
| My Device · `screen-my-device` | Capability readings with provenance, diagnostics, rename/revoke and private share overflow. | Missing measurement, stale heartbeat, unavailable tool, pending share. |
| Activity · `screen-activity` | Availability schedule and manual/auto settings. Separate available, running, history and private requests. | Listing off, auto off, overnight active, no jobs, received invitation. |
| Job Details · `screen-job-details` | Review requester, exact build, workload, duration, evidence, requirements and payout. Accept/decline only through authorized routes. | Available, unavailable, private reviewed, expired, explicit unpaid. |
| Active Session · `screen-active-session` | Authorized run, observed timestamps, ordered events, stop and acknowledgement. Intervention where the runner supports it. | Reserved, running, verifying, stopping, expired with cleanup unconfirmed. |
| Completed Session · `screen-completed-session` | Acceptance, evaluation outcome, report seal, chain effect, evidence access and payout status. | Accepted job with failed test, no receipt, unresolved chain, report verified. |
| Earnings · `screen-earnings` | Actual settled and pending totals/buckets and history. Wallet and receipts are secondary. | Payments disabled, zero totals, settled Devnet, failed or review needed. |
| Profile · `screen-profile` | Grouped account, settings, payout wallet, privacy/consent information and web developer portal. | Password workspace, optional configured auth, unverified wallet. |

These root IDs are design/testing integration identifiers. Use matching accessible semantics. The [fixture pack](packages/developer-client/fixtures/provider-states.json) provides opted-in snapshots for rendering and tests. Live environments must derive status from the API.

## Core requests

All paths below are under `/api/v1`. For person requests send `Authorization: Bearer <session>` unless marked public. Token review requires a session and target ownership. Runner credentials and lease tokens are outside the person client.

| Method and path | Body → response | Access and recovery |
| --- | --- | --- |
| POST `/auth/register`, `/auth/login` | `{email,password,registrationToken?}` → `{user,token,expiresAt}` | Public, preview sign-up is invite-gated. `registration_required`, `invalid_credentials`, `account_exists`, `rate_limited`. |
| POST `/auth/email/start`, `/auth/email/verify` | `{email,registrationToken?}` → acknowledgement, `{email,code}` → session | Public. Six digits, 10 minutes, five attempts, 60-second resend cooldown. `identity_unavailable` without server configuration. |
| POST `/auth/google/start`, GET `/auth/google/callback`, POST `/auth/google/exchange` | `{challenge,registrationToken?}` → `{url}`. Callback redirects to configured origin with `#authCode=…` or error. `{code,verifier}` → session. | Public, configured Google provider. Generate a random 64-character lowercase hex verifier, persist it locally for the browser round trip, and send its SHA-256 hex challenge. Erase the fragment after exchange. |
| GET/PATCH `/auth/me`, POST `/auth/refresh`, `/auth/logout` | Profile GET; `{displayName}` PATCH. Refresh returns a replacement session. Logout returns `{ok:true}`. | Person. Refresh atomically invalidates prior token. Expired auth needs sign-in. |
| GET/POST `/projects`, GET/POST `/builds` | `{name}` → project. `{projectId,name,packageName,sha256,apkBase64}` → build. | Developer/owner. Reject hash mismatch and over-limit upload. A build still needs local provider approval. |
| GET `/devices`, `/me/devices`, POST `/me/devices/pairings` | Visible or owned list, then `{pairing:{code,expiresAt}}`. | Person, only owned records in `/me`. Pairing is single-use, 15 minutes, latest code supersedes unused codes. |
| GET/PATCH/DELETE `/me/devices/:deviceId`, POST `/me/devices/:deviceId/diagnostics` | Optional `{label,publicListing,autoMatch,schedule,constraints}` updates. Diagnostics returns server/heartbeat checks. DELETE revokes. | Device owner. `not_found` or `device_revoked`. On revoke retain audit status. |
| GET/POST `/invitations` | List or create a target-bound request. Creation returns `{invitation,token}`. | Creator or designated recipient. Opaque token is returned once and is used only for authenticated review. |
| POST `/invitations/review`, `/invitations/:id/review` | Link review sends `{token}`. Inbox review has no body. Returns `{invitation}`. | Intended recipient. Wrong account returns `not_found`; expiry or replay returns conflict. |
| POST `/invitations/:id/accept`, `/decline`, `/revoke` | Accept developer request with `{}`. Accept provider share with `{projectId,buildId,expectedTransaction?}`. | Target review required. A mismatch is `invitation_mismatch`. Either party may revoke and request a stop where permitted. |
| GET `/marketplace/jobs?deviceId=…`, POST `/marketplace/jobs/:id/accept` | Compatible offers and atomic `{deviceId}` acceptance → `{run}`. | Provider device owner. `job_unavailable` or `device_unavailable` on lost race, stale heartbeat or conflicting reservation. |
| GET/POST `/runs`, GET `/runs/:id` | `{projectId,buildId,scenario,mode,deviceId?,maximumDurationSeconds?,evidence?,allocation?,expectedTransaction?,payment?}` → `{run}`. | Developer/owner. Wallet transfer requires explicit expectation; private work enters via invitation. |
| GET `/runs/:id/events`, POST `/runs/:id/cancel`, `/verify` | Poll or authenticated SSE, request stop, or recheck saved transaction. | Developer/owner. Replay `after` or `Last-Event-ID`; refetch snapshot on gaps. Recheck the saved signature after network uncertainty. |
| GET `/me/sessions`, `/me/sessions/:id`, `/events`, POST `/stop` | Provider summary and pollable events via `after`. Stop returns `{run}`. | Associated provider. `stopping` lasts until cleanup acknowledgement or expiry. |
| GET/POST `/runs/:id/actions`, GET `/runs/:id/evidence/:sha256` | Action `{type,args?}` or list, separate authorized artifact bytes. | Developer/owner. One queued semantic action at a time, no shell. Only grant-backed signed digests can be downloaded. |
| GET `/runs/:id/payment`, POST `/quote`, `/funding`, `/settle`, `/reconcile` | Quote returns immutable Devnet details, funding accepts `{signature}`, all return `{payment}`. | Eligible developer/owner. When off, `payment_unavailable`. Unknown broadcast uses only the saved signature. |
| GET `/me/earnings`, GET/DELETE `/me/devices/:id/payout-wallet`, POST `/payout-wallet/challenge`, `/payout-wallet/verify` | Earnings query includes `deviceId`, optional `from/to`, `bucket`. Challenge `{wallet}`, verify `{challengeId,signature}`. | Device owner. Exact UTF-8 challenge, standard base64 signature. Wallet changes apply to future work. |
| GET `/me/notifications`, POST `/me/notifications/:id/read` | Sanitized notifications with `readAt` and resource IDs. | Associated person. Push requires a separate integration. |

## Private test on a specific device

**Developer request.** Send `kind:"developer_request"`, the exact device ID, owned project and build IDs, scenario, mode, maximum duration and evidence choices. The provider sees the request privately and must review it before accepting.

**Provider share.** Send `kind:"provider_share"`, the owned device ID, targeted developer account ID, exact APK package and SHA-256, scenario, mode, maximum duration and evidence choices. Share the opaque URL out of band. The targeted developer authenticates, reviews the terms, attaches their matching build, then accepts. Paid private workloads are outside this pilot. Display **Unpaid**.

Review shows requesting person, exact APK and test, bounded duration, requested evidence and payout. A click on the link authorizes nothing. Listing and auto-match toggles are irrelevant to approved private grants. The device still needs a fresh ready heartbeat to claim the job. Accepting creates a queued run; the runner independently claims an exclusive expiring lease. The web fallback can begin a signed-in review. A verified Android App Link needs a published HTTPS association for the actual release signer.

## State and transport rules

- Device `connectivity`, `readiness`, `publicListing`, `autoMatch`, `marketplaceEligible`, and `revokedAt` have independent meanings. An offline device can retain a public listing without being eligible for jobs. IANA schedules accept `days` as Sunday=0 to Saturday=6, and `start`/ `end` as 24-hour times. An overnight window extends into the next local day. Avoid presenting missing measurement or charge as zero. A value can be runner-observed in a simulated environment. Hardware attestation and Seeker verification are separate.
- `Run.state` is the API summary. `executionState` and `leaseState` expose reserved, running, verifying and cleanup distinctions. `stop.requestedAt` is the start of a stop, `acknowledgedAt` is the confirmed cleanup signal. An expired stop without acknowledgement remains unconfirmed. Backgrounding the companion has no effect on the device’s grant.
- `acceptedWork` indicates acceptance of scope and terms. `evaluationOutcome` records test results. `reportSeal` and signed receipt identify the issuer and artifact hashes. Independently finalized `verification.transaction` governs chain effect. A failed app test can still have been executed and documented correctly.
- A live agent chooses scoped actions from observations. Scripted tests and post-hoc report interpretation use separate labels. Show actual elapsed time and observed actions, with unmeasured progress absent. The current API has no general-purpose intervention approval endpoint.
- Payment quote values are atomic decimal strings, with decimals, asset, Devnet cluster, funding reference and fixed destination. Provider earnings buckets are aggregates of recorded Devnet jobs. Show zero only when the returned aggregate is zero. Preserve expiry and submitted/unknown states, and link only actual public Devnet transactions. Training data use needs separate authorization. The workload evidence flags do not grant training rights.
- Developer events support bearer-capable SSE and JSON polling; provider sessions/notifications poll. Apply monotonic IDs, discard duplicates and refetch a snapshot after a sequence gap. Use provider-visible evidence metadata and scoped downloads. Omit ADB serials, model tokens, arbitrary logs and unrelated screenshots from clients.
- Send a unique `Idempotency-Key` on run and invitation creation. Reuse that key with the same JSON after an ambiguous response. The same person and route get the same resource for 24 hours. A different body returns `409/idempotency_conflict`.

## Recovery states

Use a retry for read failures, an inline remedy for validation and unavailable devices, reauthentication for 401, and a combined resource-unavailable state for missing or unauthorized records. Preserve form inputs across ordinary errors. During unknown write outcomes, refetch and reconcile before creating a second run or transaction. Treat Offline, job expired, lease expired, action rejected, cleanup unconfirmed, no matching wallet receipt, and payment unavailable as distinct states.

## Devnet payer, model provenance and training export

Paid Devnet `wallet-transfer` requests include `expectedTransaction.payer`, an explicitly authorized disposable test payer, in addition to network, recipient and integer lamports. `payment.developerWallet` funds the distinct USDC quote. Provider selection and confirmed funding are both required before paid execution. Match the selected wallet network to the device’s sanitized `profile.walletNetwork`. Legacy records without a network value default to Localnet for matching. The runner only claims jobs for the locally approved APK digest and wallet network.

A signed runner receipt can include `execution.planner="gemini"`, `modelId` and `modelActionCount`. Render this as model-selected actions reported by the runner. Fixture results continue to use separate labels for a scripted run or external controller. A signed report does not establish that a third party observed model execution.

Use `GET /api/v1/runs/:id/training-consent` as either run participant. `PUT` grants and `DELETE` withdraws that participant’s separate training permission. The response is `{consent:{developer: timestamp|null,provider: timestamp|null}}`. `GET /api/v1/runs/:id/training-export` is developer-only and requires both grants, plus an existing signed trajectory collected with workload consent. The `agus.training-trajectory.v1` JSON contains relative timestamps, action types and outcomes, allowlisted phases, selection provenance and source receipt digests. It excludes screenshots, raw observations, free-text logs, wallet credentials and account identifiers. Withdrawal blocks future exports. Previously downloaded copies remain subject to the recipient’s retention obligations. Treat `training_unavailable` as an unavailable feature and `training_consent_required` as an incomplete or withdrawn grant.

## Phase 2 and 3 local product preview

Use the [functional handoff](docs/phase-2-3/frontend.md) for campaign authoring and review, native enrollment, assignment submission, evidence, earnings, and purpose-specific consent. The original visual files were unavailable during this work. The historical Chisom handoff and this contract remain the functional reference. Compare release claims against [the final functionality matrix](docs/phase-2-3/functionality-matrix.md).

## Private phone campaigns and test settlement

The phone campaign controls use the generated [OpenAPI contract](packages/developer-client/openapi.json) and reuse the current reference components. [Campaign and Android integration handoff](docs/phase-2-3/frontend.md)

| Surface | Contract |
| --- | --- |
| Capability and draft | `GET /campaigns` includes `fundingNetwork`. Draft tasks can specify `compensation.amountAtoms` and `partialAtoms` as decimal strings. Verify the exact revision’s test-chain funding before publish. |
| Quote, verification and refund | `/campaigns/{campaignId}/funding` reads authoritative escrow. Its `quote`, `verify` and `refund` operations fix the revision, independently check the transfer and reconcile the remaining funds. |
| Review, payout and dispute | An assignment returns its entitlement and payout state. The payment route idempotently reconciles the original signature. A contributor sees `disputeEligible` only for a currently disputable attempt. A configured independent reviewer can award or uphold. |
| Earnings and ownership | `/me/campaign-earnings` provides account-level nontransferable units and per-asset pending, finalized and needs-review balances. `/me/earnings` covers dedicated device settlements. Account and dedicated device wallet proofs are separate. |
| Consent and correction | An accepted action correction refers to an owned, sealed source trajectory. Training requires both grants and delivers the minimized action mapping. The server checks consent again on delivery. |
| Android sign-in | `/auth/google/start` accepts `client: "android"` and an attempt challenge. The fixed HTTPS App Link carries an opaque exchange code in the fragment, with the attempt identifier. `/auth/google/exchange` requires the retained verifier. |
