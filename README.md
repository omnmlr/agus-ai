# AGUS AI

Dedicated Android execution, Solana wallet assurance and measurable agent evaluation for application teams. The platform connects an exact APK, device lease, wallet outcome and independently checked chain result to a runner-signed execution report.

## Start here

- [Product requirements](PRD.md) and [frontend integration](FRONTEND_CONTRACT.md)
- [Architecture](ARCHITECTURE.md), [security](SECURITY.md) and [implementation ledger](PROGRESS.md)
- [Deployment](DEPLOYMENT.md) and [demo](DEMO.md)
- [Historical device and chain evidence](docs/mobile-test/DEMO.md) and [migration history](docs/migration/UPSTREAM.md)

## Local mobile-test suite

Use Node 24.

```sh
npm ci
npm test
npm run mobile-test -- --help
```

The local scenario pack uses a dedicated Android AVD or test handset, an official Fake Wallet APK and a disposable Solana validator. [Android lab instructions](docs/mobile-test/DEMO.md)

The previous financial application is maintained independently at `omnmlr/hackaholics-financial-agent`. Its signed Android release is this platform's first external test target.
