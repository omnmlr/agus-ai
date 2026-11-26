# Frontend integration contract

Chisom can implement the screens in parallel using the REST API and the reference interfaces. The product design, final naming and visual assets are owned by the founder. Read [the endpoint contract](services/control-plane/API.md) for the exact transport, limits and provider requests.

## Navigation and screens

| Route | Responsibilities |
| --- | --- |
| `/` | Public product explanation, Solana Mobile workflow, integration guide and provider pilot scope. |
| `/sign-in` | Email and password registration or sign-in. Accept invited registration where enabled and resume the requested authenticated route after login. Provide sign-out and explicit session expiry. |
| `/dashboard` | Project list and recent real runs. A new account can create its first project and upload an APK. |
| `/projects/:id` | Builds with Android package, SHA-256 and upload time. New workload selection starts with a project and a build. |
| `/devices` | Dedicated devices by capability, freshness and supported scenarios. Show measured, declared and emulated attributes distinctly. |
| `/runs/new` | Select build, scenario, optional device and scripted/agent mode. For wallet transfer, show cluster, expected exact recipient and lamports. Confirm before requesting a lease. |
| `/runs/:id` | Live timeline, status, compatible device, evidence, independent chain verification and runner-signed report. Authenticate and check ownership on direct navigation. |
| `/runs/:id/settlement` | Separate quote, funding, payout and reconciliation. Show an explicit transfer review and current network. |
| `/developer` | CLI, API and MCP install instructions and a pointer to the API contract. Configure tokens outside browser code. |
| Android provider | Enrollment instructions, dedicated device capability and readiness, active session and emergency stop, completed work and Devnet wallet/settlement views when configured. |
| Android developer | Project/run status, device details, evidence and approval states. |

## Wire shapes

```ts
type Id = string
type Time = string // ISO 8601 UTC
type RunState = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'expired' | 'unverified'
type Mode = 'scripted' | 'agent'
type Scenario = 'app-launch' | 'wallet-connect' | 'wallet-transfer' | 'wallet-false-success'
type DeviceState = 'available' | 'busy' | 'offline'
type User = { id: Id; email: string }
type Project = { id: Id; name: string; createdAt: Time }
type Build = { id: Id; projectId: Id; name: string; packageName: string; sha256: string; createdAt: Time }
type Device = {
  id: Id; label: string; dedicated: true; state: DeviceState
  lastSeenAt: Time; scenarios: Scenario[]
  profile: { kind: string; hardwareAttested: false; seekerVerified: false } & Record<string, unknown>
}
type TransactionExpectation = { network: 'devnet' | 'localnet'; recipient: string; lamports: number }
type CreateRun = {
  projectId: Id; buildId: Id; deviceId?: Id; scenario: Scenario; mode: Mode
  expectedTransaction?: TransactionExpectation
}
type Run = CreateRun & { id: Id; state: RunState; createdAt: Time; updatedAt: Time }
type RunEvent = { id: number; type: string; at: Time; data: Record<string, unknown> }
```

Use the current API response schemas for verification, evidence and payment detail. Times and status are server-authoritative. Treat added fields or event types as forward-compatible. Keep unavailable profile fields blank and show evidence links only after access is granted.

| Request | Result |
| --- | --- |
| `POST /api/v1/auth/register` or `/auth/login` with email and password | User and bearer session. Keep credentials in OS secure storage or ephemeral browser state, with reload recovery appropriate to the app. |
| `GET /api/v1/projects`, `/builds`, `/devices`, `/runs` | Lists under plural keys. |
| `POST /api/v1/projects` with name | `{project}`. |
| `POST /api/v1/builds` with projectId, name, packageName, sha256 and apkBase64 | `{build}`. Compute the digest from the exact selected bytes before base64 encoding. |
| `POST /api/v1/runs` with CreateRun | `{run}`. Show one in-flight request and refresh the list after ambiguous network failure before queueing again. |
| `GET /api/v1/runs/:id` and `POST /api/v1/runs/:id/cancel` | `{run}`. Cancellation may await runner cleanup and preserves existing chain evidence. |
| `GET /api/v1/runs/:id/events` | `{events}` by default. Use a bearer-capable fetch for SSE where supported. Reconnect using the last event ID and refresh the snapshot after a gap. |
| `GET /api/v1/runs/:id/actions` and `POST /api/v1/runs/:id/actions` | `{actions}` or `{action}`. Apply one action at a time and re-read observations. Only semantic scenario targets, bounded waits and named actions. |

Expected ordering begins with `run.queued`, follows the active lease and any `action.queued` / `action.observed` events, and ends in a terminal snapshot. Keep callback, report signature and independently verified transaction status separately visible. Late or duplicate events cannot replace a newer observed snapshot.

## Funding and recovery

Show funding requirements as immutable Devnet review details with exact mint, amount, payer, payee, and job reference. Link only public Devnet signatures to the cluster-specific Explorer. Show `paid` only after finalized payout verification. On unknown submission or network interruption, keep the same intent and offer reconciliation. Keep provider wallet enrollment separate from the developer's review. A saved wallet address alone does not establish wallet ownership.

Present loading, actionable empty states, repeatable fetch retries, a bounded upload error, expired session, unavailable resource, offline device, no compatible device, canceled/expired run, cleanup pending, and RPC unavailable. Failed application behavior and failed infrastructure require distinct remedies. Preserve inputs on recoverable errors. Never request seeded wallet secrets or expose device serials.

## Development

Run the control plane and web app using the repository setup. The reference UI consumes the same API as CLI/MCP. Use synthetic local registrations and a dedicated runner with a reviewed fixture. The historical [sample reports](packages/mobile-test/examples/reports.json) can exercise success, failure, wallet rejection and missing receipt copy. Its [archived evidence](docs/mobile-test/evidence/) shows the actual previous callback and screenshot paths. Fixtures, historical results and live runs need persistent visible provenance labels.
