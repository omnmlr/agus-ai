# Funded Devnet Acceptance & SAS Verification (2026-11-28)

Sanitized verification evidence executed on Solana Devnet (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`) against persistent disposable test identities and loopback PostgreSQL (`127.0.0.1:55432/agus_campaign_acceptance`).

## Task 1 — Funded Campaign Acceptance

- Command: `node --test services/control-plane/test/campaign-localnet.integration.mjs`
- Result: 1/1 passed (`38444ms` test, `61158ms` total)
- Finalized Devnet transfers (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 decimals):
  - Campaign funding (`1,700,000` atoms): `3gtjcd876aZuDfxi8eDuFbjFrNyZ7XTSv2aFab73v4Hh22gfvxzYVvfY4izXsoxbxwd9NfeN7DkoZr4GCjvZMe2` (slot `527139836`)
  - Automatic contributor payout (`700,000` atoms): `dDrLq4wvKHLQjdFTm2HD3SHSxF1dztNRFFeXWGebPbKZqTKVvKoMumNocm7rZNTxkUF8JTykMmieCnpBsbPGmLM` (slot `527139876`)
  - Partial dispute award (`200,000` atoms): `ra56SDP4n6ptZQBF63JYvqYTb99tnkA9HsfgUWKUGqHGnouB8pNwc82Du6xhHdrYqs7VvgyXx5RVSEzij1srW1o` (slot `527139895`)
  - Remaining escrow refund (`800,000` atoms): `pDhcSUXuNs4ADt3LVDjwtEMc4eJoyhMPhj6xY5PJkjk9NJ8wQdZEhRNp52F5UTWUoYmmyWNXFDja2aMJtVv6SfP` (slot `527139934`)
- Final escrow deposit balance: `0` atoms.
- Verified concurrent worker ticks, duplicate payment prevention, pinned payout address after wallet replacement, duplicate refund idempotency, and independent finalized RPC balance reconciliation (`devnet-campaign.json`, `reconciled-balances.json`).

## Task 2 — Solana Attestation Service

- Fix applied: Updated SAS account discriminators in `services/attestation/receipt.mjs` and `services/attestation/receipt.test.mjs` (`Credential = 0`, `Schema = 1`, `Attestation = 2`) to match the live SAS program (`22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`).
- Unit tests: `node --test services/attestation/receipt.test.mjs` — 2/2 passed.
- Finalized Devnet SAS artifacts (`sas-attestation.json`):
  - Credential PDA (`agus-rc-demo`): `3n18sJwKkaH3zXtR4mvzDMq4qaAqpKfAf14BzFbNF7mh` — tx `W2KdhjytCJYkhcZYwi9Pj2eZXTekeQMPyw44RkFtFCTKJSKteXrN5hgyJSkqmMEpLAoRPmTKsdtaHNXQoohGgzF` (slot `527140100`)
  - Schema PDA (`agus-execution-v1` v1): `Fv8RjNckaAubwMYWrFuYVRwHvRb4nDzjPahAQyQAUSkp` — tx `MgiQdLCp4WPUhAqdNuHkMdn9BDDZcyQgt32tfUrizqjAotJgcKcUQEXbKvESQQrFh5YQndk1Rf7KnAUE2TUKBhA` (slot `527143021`)
  - Attestation PDA: `FXnAJamsS8b2VNG8BkxNLjWXh2A2Ni77SRuyB9ondeYi` (nonce `A4pTmXpCnZM7JQfWHfBdocs65U2r4q6ufWTcS5r9cTG5`) — tx `2QbXjrHnXC5roGQtNxPrHcU9tM3P6niwXfdb46ghv68ntMVNnCHzNiEufdaFFbNi6gV35B4pBRSoS8duUNBTP299` (slot `527148221`)
- Independent verification:

```sh
node services/attestation/receipt.mjs verify \
  docs/phase-2-3/evidence/devnet-2026-11-28/receipt-private.json \
  3n18sJwKkaH3zXtR4mvzDMq4qaAqpKfAf14BzFbNF7mh \
  CsabkMjpeHytxppS8mXwvCnN5PbJ9uBzumkkskT1xBqc \
  A4pTmXpCnZM7JQfWHfBdocs65U2r4q6ufWTcS5r9cTG5 \
  --trusted-runner docs/phase-2-3/evidence/devnet-2026-11-28/runner-enrollment.pub.pem
```

Succeeded at finalized slot `527148291` (`scope: "receipt-digest"`, `manifest_sha256: "6efbe29c0747ca5da53ec31396a7b2085a5edf45de68caef5175bb369aca723a"`).
