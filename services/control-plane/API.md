# AGUS control-plane HTTP API

Base path `/api/v1`. Send Bearer credentials over HTTPS. JSON requests have `Content-Type: application/json`. Names, states and paths below are current runtime contracts. Every API error is `{"error":{"code":"...","message":"..."}}`. Identifiers are opaque. The API returns `404/not_found` for other owners' records and `401/unauthorized` for missing or out-of-scope credentials.

## Local integration

Node 22.13 or newer. From the repository root:

```sh
npm ci --prefix services/control-plane
AGUS_LOCAL_DATA_DIR="$(mktemp -d)" AGUS_PROVIDER_BOOTSTRAP_TOKEN="$(node -p 'require("crypto").randomBytes(32).toString("base64url")')" npm start --prefix services/control-plane
```

`GET /health` is outside the API prefix and probes persistence. For deployment use the dedicated `AGUS_DATABASE_URL` and `NODE_ENV=production`. Separate provider pairing codes from the operator bootstrap secret. The bootstrap-only fixture pool is disabled in production unless `AGUS_ALLOW_LEGACY_POOL=1`. Same-origin reverse proxy is preferred. `AGUS_CORS_ORIGIN` can allow a specified origin. Set `AGUS_PUBLIC_ORIGIN` to the application HTTPS origin for payout proof. Configure `AGUS_LOCALNET_RPC_URL` only for a controlled Localnet deployment. The runtime does not rotate signing or operator credentials.

## Identity and projects

| Method and path | Request → response |
| --- | --- |
| POST `/auth/register`, `/auth/login` | `{email,password,registrationToken?}` → `{token,user,expiresAt}`. Password 12–128 characters. Invite required when registration is gated. |
| POST `/auth/email/start`, `/auth/email/verify` | `{email,registrationToken?}` → acknowledgment, `{email,code}` → session. Enabled only with authorized proof delivery credentials. |
| POST `/auth/google/start` | `{challenge,registrationToken?}` → Google authorization URL. Generate S256 challenge from the client verifier. |
| GET `/auth/google/callback` | Google's `code` and `state` → fixed callback URL with single-use exchange code in a fragment. |
| POST `/auth/google/exchange` | `{code,verifier}` → session. |
| GET and PATCH `/auth/me` | PATCH `{displayName}`, both → `{user}`. |
| POST `/auth/refresh`, `/auth/logout` | Refresh → rotated session. Logout → `{ok:true}`. |
| GET and POST `/projects` | GET → `{projects}`. POST `{name}` → `{project}` including `id,name,createdAt`. |
| GET and POST `/builds` | GET → `{builds}`. POST `{projectId,name,sha256,apkBase64,packageName}` → `{build}` including `id,projectId,name,sha256,packageName,size,createdAt`. |

The person session has `user:{id,email,displayName?,capabilities:{developer:true,provider:boolean}}`. OAuth, OTP and password flows share tenant user IDs only when identity ownership is established by the configured flow. APK cap defaults to 25 MiB. Upload validates ZIP signature and SHA-256. The runner additionally requires local operator approval for the exact APK digest, package and scenario, validates package metadata and rechecks the bytes.

## Provider-owned devices

| Method and path | Request → response |
| --- | --- |
| GET `/devices` | Discover marketplace-listed devices, own devices and explicitly enabled legacy demo devices → `{devices}`. |
| POST `/me/devices/pairings` | Person Bearer → `{pairing:{code,expiresAt}}`. Provide this code to the desktop runner as its one-time enrollment credential. Reissuing invalidates the unused previous code. |
| GET `/me/devices` | Own device records → `{devices}`. |
| GET, PATCH and DELETE `/me/devices/:id` | Own device → `{device}`. PATCH accepts `label,publicListing,autoMatch,schedule,constraints` as optional fields. DELETE revokes the runner and future grants, and initiates a stop for work already active. |
| POST `/me/devices/:id/diagnostics` | `{diagnostics:{checkedAt,source,checks:[{id,passed,lastSeenAt?,measuredAt?}]}}`. It evaluates live heartbeat freshness and last observed readings. |
| GET and DELETE `/me/devices/:id/payout-wallet` | `{payoutWallet:{address,verifiedAt}|null}`. DELETE disconnects destination for future offers and leaves accepted payment terms bound. |
| POST `/me/devices/:id/payout-wallet/challenge` | `{wallet}` → `{challenge:{id,providerId,wallet,origin,issuedAt,expiresAt,message}}`. |
| POST `/me/devices/:id/payout-wallet/verify` | `{challengeId,signature}` → `{payoutWallet}`. Signature is standard base64 of raw Ed25519 signature of exact UTF-8 message. |

Device response includes `id,label,profile,scenarios,dedicated,state,connectivity,readiness,lastSeenAt,publicListing,autoMatch,marketplaceEligible,revokedAt?`. Owner device response also includes `schedule,constraints`. Dates are UTC ISO strings. `state` is the compatibility field `available|busy|offline`. `connectivity` reflects heartbeat freshness. `readiness` adds `ready|busy|quarantined|offline`. A paired device starts privately listed with auto-match disabled, including when ready. The app does not grant execution from its own installation alone. A desktop runner connects outbound using ADB to an approved dedicated phone or isolated emulator.

`schedule:null` means no restriction. An example is `{"timeZone":"Africa/Lagos","windows":[{"days":[1,2,3,4,5],"start":"22:00","end":"06:00"}]}`. Days are Sunday 0 through Saturday 6; this example continues the window into the following local morning. Constraints are `{chargingRequired,wifiRequired}`. Missing readings do not satisfy required constraints. Public listing, auto-match and schedule only authorize future marketplace eligibility. A private invitation ignores public toggles, and still requires runner readiness and an exclusive lease. Runner capability readings carry `provenance` and a last measurement timestamp. Hardware-attestation and Seeker flags remain false until independently established. The service drops IMEI and unapproved profile keys.

## Private invitations and public marketplace

| Method and path | Request → response |
| --- | --- |
| GET `/invitations` | Current person is the sender or bound recipient → `{invitations}`. |
| POST `/invitations` | Developer request or provider share schema below → `{invitation,token}`. |
| POST `/invitations/review` | Signed-in intended recipient submits `{token}` → `{invitation}`. Wrong users receive 404. No authority is granted by the link alone. |
| POST `/invitations/:id/review` | Signed-in recipient acknowledges seeing consent terms from their inbox → `{invitation}`. |
| POST `/invitations/:id/accept` | `{}` for developer-request recipient, `{projectId,buildId,expectedTransaction?}` for provider-share recipient → `{invitation,run}`. Requires reviewed state. |
| POST `/invitations/:id/decline`, `/revoke` | Recipient may decline, either participant may revoke → `{invitation,run?}`. Revoking started work requests an acknowledged stop. |
| GET `/marketplace/jobs?deviceId=...` | Only owner of the specified device sees compatible jobs → `{jobs}`. Offline, private and constrained-unavailable devices get an empty result. |
| POST `/marketplace/jobs/:runId/accept` | Owner `{deviceId}` → `{run}`. Creates a two-minute exclusive reservation with atomic contention checks. |

Both invitation types require `kind,deviceId,scenario,mode,maximumDurationSeconds?,evidence?`. Developer requests additionally require `projectId,buildId,expectedTransaction?` and derive the provider from an exact device ID the provider chose to share. Provider share additionally requires `targetUserId,packageName,buildSha256`; the accepted APK must match exactly, and only the bound developer can provide the matching build. Private invitations are intentionally unpaid and expire after 24 hours. Invitation states are `pending|reviewed|accepted|declined|revoked|expired`. Responses also include `id,requester:{id,email,displayName?},recipient:{id,email,displayName?},viewerRole,deviceId,packageName,buildSha256,scenario,mode,maximumDurationSeconds,evidence,consentVersion,expiresAt,runId?,payout:'unpaid'`. Valid HTTP conflict codes include `invitation_conflict`, `invitation_mismatch`, `invitation_expired`, `device_revoked`, `device_unavailable` and `job_unavailable`.

A marketplace job is `{id,requester,packageName,buildSha256,scenario,mode,maximumDurationSeconds,evidence,quote,requirements:{dedicatedAndroid:true,scenario},availability:'available',createdAt,expiresAt}`. Auto-match, if explicitly enabled by the provider, applies the same compatibility and exclusive claim rules. Provider runner local approval remains mandatory. The unpaid quote is `{kind:'unpaid',asset:null,cluster:null,decimals:null,amountAtoms:'0'}`. A funded paid quote includes `{kind:'devnet',asset,cluster,mint,decimals,amountAtoms,destination}`.

Use a unique `Idempotency-Key` header on POST `/runs` and POST `/invitations`. Same person, route, key and equivalent JSON body return the same resource for 24 hours, with its current state. Reusing a key on a changed body returns `409/idempotency_conflict`. Set stable `AGUS_IDEMPOTENCY_SECRET` or preserve the bootstrap credential if using it as the default secret for invitation retry token derivation.

## Runs, actions and evidence

| Method and path | Request → response |
| --- | --- |
| GET and POST `/runs` | GET → `{runs}`. POST `{projectId,buildId,deviceId?,scenario,mode,allocation?,maximumDurationSeconds?,evidence?,expectedTransaction?,payment?}` → `{run}`. Send `allocation:"marketplace"` for public posting. Private runs only originate from accepted invitations. |
| GET `/runs/:id` | Developer-owned detail → `{run}`. |
| GET `/runs/:id/events?after=N` | `{events:[{id,type,at,data}]}` or SSE with Bearer and `Accept: text/event-stream`. Cursor increments per run and transports use it for resume. |
| POST `/runs/:id/cancel` | Developer → `{run}`. No active lease means immediate cancellation. Otherwise state is `stopping` until runner acknowledgement. |
| GET and POST `/runs/:id/actions` | Agent mode only for enqueue. GET → `{actions}`, POST `{type,args}` → `{action}`. |
| POST `/runs/:id/verify` | Retry a sealed report pending independent verification → `{run}`. |
| GET `/runs/:id/evidence/:sha256` | Developer owner only. Binary attachment fetched with Bearer and checked against signed hash. |
| GET `/me/sessions`, `/me/sessions/:id`, `/me/sessions/:id/events?after=N` | Provider-owner historical or live sessions and sanitized polling cursor → `{runs}`, `{run}`, `{events}`. |
| POST `/me/sessions/:id/stop` | Provider-owner stop request → `{run}` with explicit acknowledgement timestamp if received. |

Scenarios are `app-launch`, `wallet-connect`, `wallet-transfer` and `wallet-false-success`. `wallet-transfer` requires `expectedTransaction:{network:'devnet'|'localnet',recipient,lamports}`. Modes are `scripted|agent`. Developer actions are `launch,screenshot,describe,tap,wait,finish`. `tap` accepts only a runner-described semantic `{target}`. The runner can refuse out-of-scope controls and the service only accepts one pending action. The event cursor is monotonic per run. Refetch authoritative state after a gap. A run retains its most recent 256 events.

A run includes `id,projectId,buildId,deviceId,scenario,mode,allocation,state,executionState,leaseState,createdAt,updatedAt,startedAt?,finishedAt?,evaluationOutcome?,reportSeal?,acceptedWork?,stop?,receipt?,verification?,paymentTerms?`. Compatibility `state` is `queued|reserved|running|stopping|verifying|passed|failed|unverified|cancelled|expired`. `executionState` separately records lifecycle and successful completion even when an app assertion failed. `evaluationOutcome` is `passed|failed|unverified`. `stop:{requestedAt,requesterRole,acknowledgedAt}` preserves an unconfirmed stop if the lease expires while disconnected. `receipt` includes issuer Ed25519 public key, signature, canonical manifest, its SHA-256 and evidence hash references. `verification.transaction` contains the independent chain judgment. A signed claim is not hardware attestation.

The consent object is `{screenshots:boolean,logs:boolean,trajectory:boolean}`, defaults false for marketplace and private runs, and is enforced at action and report scope. Consent is for the named job only. Training reuse has no ingestion path. Dedicated test devices must use disposable accounts. Owner session responses omit evidence URLs and full signed manifest. The developer owner can inspect or export authorized evidence only after a signed report.

## Payments, earnings and inbox

| Method and path | Request → response |
| --- | --- |
| GET `/runs/:id/payment` | Developer owner → `{payment}` or `{payment:null}`. |
| POST `/runs/:id/quote` | `{}` or `{developerWallet}` matching the bound offer → `{payment}`. |
| POST `/runs/:id/funding` | `{signature}` from finalized funding receipt → `{payment}`. |
| POST `/runs/:id/settle`, `/reconcile` | `{payment}`. Settlement requires accepted paid work with independently verified Devnet test effect. Reconciliation handles submitted/unknown status first. |
| GET `/me/earnings?deviceId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day` | Owner-only immutable provider earnings → `{earnings}`. |
| GET `/me/notifications` | `{notifications:[{id,type,data,createdAt,readAt}]}`. |
| POST `/me/notifications/:id/read` | Marks own notification read → `{notification}`. |

Devnet payments require authorized deployment configuration. Eligible public marketplace run creation includes `payment:{kind:"devnet",developerWallet}`, a selected public paired device with proved payout wallet, and a Devnet wallet-transfer specification. The destination and provider identity are frozen at posting. A paid run stays hidden from matching until finalized funding is verified. Confirmed earned amounts are Devnet test USDC atomic units and do not constitute cash or a withdrawable balance. Earnings buckets use UTC; from inclusive and to exclusive. Refunds for canceled funded offers require operator reconciliation. There is no automated refund path in this pilot. If payments are disabled the APIs return `503/payment_unavailable`.

## Runner transport

Runner traffic is outbound only. The existing runner owns its own Ed25519 key and local APK allowlist. Browser and Android clients never receive leases or runner credentials.

- POST `/provider/enroll` uses one-time pairing bearer, and returns `{providerId,token}`. Body `{displayName,publicKeyPem,devices:[{id,profile,scenarios,dedicated:true,online?,ready?}]}`. Paired runner scope is one device. The explicit operator bootstrap pool is a separate test-only path.
- POST `/provider/heartbeat` uses runner bearer and same devices list. Empty list marks its device offline. Runner only reports ready once cleanup completed and the device is in scope.
- POST `/provider/claim` uses runner bearer and `{deviceId,approvedBuilds:[{packageName,sha256,scenarios?}]}`; returns `{job:null|{runId,leaseId,leaseToken,challenge,expiresAt,scenario,mode,expectedTransaction?,evidence?,consentVersion?,expectedPackage,build:{id,sha256,packageName,url}}}`.
- GET `/provider/leases/:id` uses lease bearer. Status `running|stopping|cancelled|expired|verifying|completed`. Resume by polling and stop work locally on timeout or loss of authority.
- GET `/provider/leases/:id/build` serves only the claimed APK while the lease is active. GET `/provider/leases/:id/actions` and POST `/provider/leases/:id/actions/:actionId` use lease bearer with `{outcome,observation}` for completed actions.
- POST `/provider/leases/:id/release` takes lease bearer and `{cleaned:true,reason?}`. `reason:"local_emergency"` may acknowledge a runner-initiated stop. Other cleanup acknowledgements only apply to stopping or expired leases. No acknowledgement means unknown until independently reconciled.
- POST `/provider/report` takes lease bearer and `{runId,leaseId,report,signature,attachments?}`. The Ed25519 signature is standard Base64 over UTF-8 compact JSON with keys sorted recursively. The manifest binds run, lease, build and challenge. Attachment bytes are independent verified Base64 bound to declared SHA-256. Report body limit is 5 MiB, each attachment at most 1 MiB, combined attachments at most 3 MiB.

## Executable contract coverage

Run `npm test --prefix services/control-plane` for invitation, authorization, offline readiness, exclusive reservation, stop and cleanup, signed report and transaction replay cases. Tests use synthetic APK bytes and disposable accounts. The chain test uses a mocked authorized RPC transport to validate decisions. Android execution, external identity delivery, physical hardware and live-chain settlement require independent deployment acceptance.
