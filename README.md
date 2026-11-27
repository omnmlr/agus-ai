# AGUS AI

Dedicated Android execution, Solana wallet assurance and measurable agent evaluation for application teams. The platform connects an exact APK, device lease, wallet outcome and independently checked chain result to a runner-signed execution report.

## Start here

- [Product requirements](PRD.md) and [frontend integration](FRONTEND_CONTRACT.md)
- [Architecture](ARCHITECTURE.md), [security](SECURITY.md) and [implementation ledger](PROGRESS.md)
- [Deployment](DEPLOYMENT.md) and [demo](DEMO.md)
- [Historical device and chain evidence](docs/mobile-test/DEMO.md) and [migration history](docs/migration/UPSTREAM.md)

Use the [frontend contract](FRONTEND_CONTRACT.md) to run the reference portal against the local control plane. The [runner guide](services/provider-runner/README.md) gives the separate device-host setup. [Managed deployment](DEPLOYMENT.md) lists the scoped secret bindings needed for the HTTPS origin.

## Connect external agents

Set `AGUS_API_URL` to the control-plane origin and `AGUS_API_TOKEN_FILE` to a private file outside the repository. The CLI can create it from a disposable account using `AGUS_API_PASSWORD` from a local secret store or masked prompt. The token stays out of command output. From the repository root, run `node packages/developer-client/src/cli.mjs login <email>` and unset the password input after sign-in.

Configure a stdio client with command `node`, arguments `[/absolute/path/to/agus-ai/packages/developer-client/src/cli.mjs, mcp]`, and the same `AGUS_API_URL` and `AGUS_API_TOKEN_FILE` environment variables. It can discover devices, queue and inspect runs, send scenario-scoped agent actions, and request stop. Use `node packages/developer-client/src/cli.mjs --help` for the CLI equivalents.

## Local mobile-test suite

Use Node 24.

```sh
npm ci
npm test
npm run mobile-test -- --help
```

The local scenario pack uses a dedicated Android AVD or test handset, an official Fake Wallet APK and a disposable Solana validator. [Android lab instructions](docs/mobile-test/DEMO.md)

The previous financial application is maintained independently at `omnmlr/hackaholics-financial-agent`. Its signed Android release is this platform's first external test target.
