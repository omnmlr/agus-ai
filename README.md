# AGUS AI

Dedicated Android execution, Solana wallet assurance and measurable agent evaluation for application teams. The platform connects an exact APK, device lease, wallet outcome and independently checked chain result to a runner-signed execution report.

## Start here

- [Android review build, physical acceptance and hackathon demonstration](docs/phase-2-3/companion-hackathon-review.md)
- [Verified Devnet test-USDC payouts and Solana Attestation Service evidence](docs/phase-2-3/evidence/devnet-2026-11-28/README.md)

- [Research dossier: market, Solana opportunity, economics and technical research](docs/research/README.md) (proposed expanded product direction and evidence boundaries)

- [Public website and developer console handoff](docs/web-design/handoff.md)
- [Product requirements](PRD.md) and [frontend integration](FRONTEND_CONTRACT.md)
- [Architecture](ARCHITECTURE.md), [security](SECURITY.md) and [implementation ledger](PROGRESS.md)
- [Deployment](DEPLOYMENT.md) and [demo](DEMO.md)
- [Historical device and chain evidence](docs/mobile-test/DEMO.md) and [migration history](docs/migration/UPSTREAM.md)

Use the [frontend contract](FRONTEND_CONTRACT.md) to run the reference portal against the local control plane. The [runner guide](services/provider-runner/README.md) gives the separate device-host setup. [Managed deployment](DEPLOYMENT.md) lists the scoped secret bindings needed for the HTTPS origin.

## Connect external agents

Set `AGUS_API_URL` to the control-plane origin and `AGUS_API_TOKEN_FILE` to a private file outside the repository. The CLI can create it from a disposable account using `AGUS_API_PASSWORD` from a local secret store or masked prompt. The token stays out of command output. From the repository root, run `node packages/developer-client/src/cli.mjs login <email>` and unset the password input after sign-in.

Configure a stdio client with command `node`, arguments `[/absolute/path/to/agus-ai/packages/developer-client/src/cli.mjs, mcp]`, and the same `AGUS_API_URL` and `AGUS_API_TOKEN_FILE` environment variables. It can discover devices, queue and inspect runs, request a private device with owner review, send scenario-scoped agent actions, and request stop. Use `node packages/developer-client/src/cli.mjs --help` for the CLI equivalents.

For Codex, register the local process with the private token file path.

```sh
codex mcp add agus --env "AGUS_API_URL=$AGUS_API_URL" --env "AGUS_API_TOKEN_FILE=$AGUS_API_TOKEN_FILE" -- \
  node /absolute/path/to/agus-ai/packages/developer-client/src/cli.mjs mcp
```

In Claude Code or Gemini CLI, add an `agus` entry under `mcpServers` in the client configuration. Replace the example paths with absolute local paths.

```json
{
  "mcpServers": {
    "agus": {
      "command": "node",
      "args": ["/absolute/path/to/agus-ai/packages/developer-client/src/cli.mjs", "mcp"],
      "env": {
        "AGUS_API_URL": "https://agusai.grindcity.app",
        "AGUS_API_TOKEN_FILE": "/absolute/private/path/agus-token"
      }
    }
  }
}
```

The MCP process uses local stdio. Its HTTPS requests go to the configured control plane. The [typed SDK and OpenAPI contract](packages/developer-client) support the same scoped API from code. The [dedicated local lab](docs/mobile-test/DEMO.md#mcp-registration) offers a separate stdio server for local scenario reproduction and evidence.

## Local mobile-test suite

Use Node 24.

```sh
npm ci
npm test
npm run mobile-test -- --help
```

The local scenario pack uses a dedicated Android AVD or test handset, an official Fake Wallet APK and a disposable Solana validator. [Android lab instructions](docs/mobile-test/DEMO.md)

The previous financial application is maintained independently at `omnmlr/hackaholics-financial-agent`. Its signed Android release is this platform's first external test target.

The [Phase 2 and 3 local preview handoff](docs/phase-2-3/handoff.md) links the functionality matrix, audit results, and independent verification assignment.
