# Solana Attestation Service receipt verification

The AGUS execution receipt remains the issuer-signed record of a run. SAS can place its manifest digest on Devnet. The verifier checks the known SAS program owner, finalized account reads, expected schema and credential PDAs, trusted signer, current signer authorization, expiry, Ed25519 receipt signature and exact digest. The result has scope `receipt-digest`. It does not establish physical-device, wallet, or hardware provenance.

The existing schema is `agus-execution-v1`, numeric version 1, with one Borsh string field `manifest_sha256`. Publish only the digest. Pin the issuer's credential and signer from a trusted source. The issuance command below derives a stable nonce and uses a seven-day expiry for the Devnet demonstration.

```sh
npm ci --prefix services/attestation
jq '.run.receipt' run.json > receipt.json
node services/attestation/receipt.mjs payload receipt.json
NODE_USE_ENV_PROXY=1 node services/attestation/receipt.mjs verify receipt.json CREDENTIAL SIGNER NONCE
```

The payload command is local and does not sign or broadcast. The verifier uses public Solana Devnet RPC. Tests use SDK-encoded accounts, including wrong signer, expired account and modified manifest checks. The SAS program was independently observed executable on public Devnet. Issuing an AGUS attestation still requires an authorized funded issuer.

## Authorized Devnet issuance

Use the existing `agus-execution-v1` version 1 schema and an issuer delegated by the disposable SAS credential authority. Obtain the pinned Ed25519 runner key from the authorized provider enrollment record through a separate trusted channel. Use a verified dedicated-runner execution receipt. The receipt manifest SHA-256 is the only on-chain claim. Installation-signed P-256 phone preview receipts use the native offline verifier.

```bash
npm ci --prefix services/attestation
export AGUS_SAS_AUTHORITY_KEYPAIR_FILE=/path/to/private-identities/sas-authority.json
export AGUS_SAS_ISSUER_KEYPAIR_FILE=/path/to/private-identities/sas-issuer.json
node services/attestation/issue.mjs initialize agus-rc-demo ISSUER_PUBLIC_ADDRESS --broadcast
node services/attestation/issue.mjs issue receipt.json trusted-runner.pem CREDENTIAL_PUBLIC_ADDRESS --broadcast
node services/attestation/receipt.mjs verify receipt.json CREDENTIAL_PUBLIC_ADDRESS ISSUER_PUBLIC_ADDRESS NONCE \
  --trusted-runner trusted-runner.pem
```

`AGUS_SAS_DEVNET_RPC_URL` can select an authorized HTTPS Devnet RPC. Issuance calculates the nonce from the trusted receipt digest, checks authorization before signing, and reconciles account creation by reading finalized state. Rerunning issuance checks the same attestation PDA. If confirmation remains unresolved, reconcile the returned public PDA and transaction signature before retrying. Use the separate authority only for credential and schema preparation. Finalized test-network issuance requires actual funded Devnet signers and network access.
