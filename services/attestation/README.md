# Solana Attestation Service receipt verification

The AGUS execution receipt remains the issuer-signed record of a run. SAS can place its manifest digest on Devnet. The verifier checks the known SAS program owner, finalized account reads, expected schema and credential PDAs, trusted signer, current signer authorization, expiry, Ed25519 receipt signature and exact digest. The result has scope `receipt-digest`. It does not establish physical-device, wallet, or hardware provenance.

Use the official SAS SDK or publisher to create a credential and schema owned by an authorized disposable Devnet issuer. The schema is `agus-execution-v1`, numeric version 1, with one Borsh string field `manifest_sha256`. Choose an independent, unique nonce and a future Unix expiry. Publish only the digest. Pin the issuer's credential and signer from a trusted source.

```sh
npm ci --prefix services/attestation
jq '.run.receipt' run.json > receipt.json
node services/attestation/receipt.mjs payload receipt.json
NODE_USE_ENV_PROXY=1 node services/attestation/receipt.mjs verify receipt.json CREDENTIAL SIGNER NONCE
```

The payload command is local and does not sign or broadcast. The verifier uses public Solana Devnet RPC. Tests use SDK-encoded accounts, including wrong signer, expired account and modified manifest checks. The SAS program was independently observed executable on public Devnet. Issuing an AGUS attestation still requires an authorized funded issuer.
