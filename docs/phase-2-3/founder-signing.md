# Founder-controlled identity and signing

Run this setup on the founder's encrypted workstation. Keep the private files outside all repositories, with an encrypted offline backup and access to the corresponding passwords in the existing password manager. Record the public addresses and certificate fingerprints with the release. Keep each role tied to its original signer for as long as a campaign, credential or installed APK depends on it.

## Disposable Solana Devnet identities

Use Bash on Linux, macOS or WSL2. On Windows, use the Linux filesystem under WSL2 for the private directory so the POSIX permissions apply. Use Node.js 24 from the repository root.

```bash
umask 077
signing_root="$HOME/.local/share/agus-ai/signing"
mkdir -p "$signing_root"
chmod 700 "$signing_root"
npm ci --prefix services/settlement

# Once per new disposable Devnet environment.
node services/settlement/prepare-devnet.mjs "$signing_root/devnet" 1700000 --addresses-only

# Use for every later read or preparation on this set of signers.
node services/settlement/prepare-devnet.mjs "$signing_root/devnet" 1700000 \
  --existing-only --prepare-accounts
```

Match the reported public addresses to the founder's roster before requesting funds. The campaign funder needs test USDC at its wallet address, and the operator and payout wallets have separate associated token accounts. Use the [Solana Devnet faucet](https://faucet.solana.com/) and [Circle testnet faucet](https://faucet.circle.com/), selecting Solana Devnet and USDC at Circle. Check the exact shortfalls from the preparation command. A faucet may dispense a fixed amount. Fund accounts for an active signer set that the founder or an authorized test operator controls.

Use the campaign funder file only on the workstation that authorizes the campaign funding transfer. Mount only the campaign operator file into the isolated settlement container. Bind the funder and contributor wallet ownership with account-specific proofs. The SAS authority prepares the credential and delegates the SAS issuer. Keep the authority offline between administrative operations. Keep the public runner key from enrollment in the release evidence so it can be checked independently against the signed receipt.

## Android release keys and private-preview manifest

Keep using any approved existing release key for the corresponding installed app. Only initialize the following files for new signing identities. Run the two keytool commands in an interactive terminal, with independent password-manager entries for the two keystores.

```bash
test ! -e "$signing_root/companion.p12" &&
  keytool -genkeypair -storetype PKCS12 -keystore "$signing_root/companion.p12" \
    -alias agus-companion -keyalg RSA -keysize 3072 -validity 9125 \
    -dname 'CN=AGUS AI Companion'
test ! -e "$signing_root/runtime.p12" &&
  keytool -genkeypair -storetype PKCS12 -keystore "$signing_root/runtime.p12" \
    -alias agus-runtime -keyalg RSA -keysize 3072 -validity 9125 \
    -dname 'CN=AGUS AI Work Runtime'

(
  set -eu -o pipefail
  set -o noclobber
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 \
    > "$signing_root/manifest.pem"
  openssl pkey -in "$signing_root/manifest.pem" -pubout -outform DER |
    openssl base64 -A > "$signing_root/manifest.public.b64"
)
```

Set `AGUS_ANDROID_KEYSTORE_FILE` and `AGUS_ANDROID_KEY_ALIAS` for the Companion. Set `AGUS_NATIVE_KEYSTORE_FILE` and `AGUS_NATIVE_KEY_ALIAS` for the Work runtime. Supply each build's existing `*_KEYSTORE_PASSWORD` and `*_KEY_PASSWORD` environment variables from the password manager for the build process, then clear them. The JDK PKCS12 commands above use one password for each keystore and its key. Build with the [checked release commands](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement) and verify both APKs with SDK 35 `apksigner verify --print-certs`.

Point `AGUS_NATIVE_MANIFEST_PUBLIC_FILE` at `manifest.public.b64` for the private-preview runtime build. On the approved control-plane operator machine, create a restricted import file with shell tracing disabled. Import it into the server secret store as `AGUS_NATIVE_MANIFEST_PKCS8` through the store's secret input. Keep the PEM as the backed-up identity and remove the import file once the store has it.

```bash
(
  set -eu -o pipefail
  set -o noclobber
  openssl pkcs8 -topk8 -nocrypt -in "$signing_root/manifest.pem" -outform DER |
    openssl base64 -A > "$signing_root/manifest.private.b64"
)
```

The enrolled Android installation has its own device-generated key. The dedicated runner separately generates a receipt signing key at enrollment. Preserve its restricted state directory on the founder-controlled runner and record its public key at enrollment. The runtime APK's manifest trust anchor, the APK certificate, and the receipt signer each serve a different verification step.

## Activation approval

Record the active Neon deployment ID and rollback artifact in the owner console. Apply the approved Companion's actual APK SHA-256 certificate fingerprint to `AGUS_ANDROID_CERT_SHA256` as colon-separated octets only when the rollout is authorized. Keep the existing Google callback and Resend bindings. After approval, use the [deployment and rollback procedure](../../DEPLOYMENT.md#managed-https-target), then verify App Links and perform both sign-in flows on the actual signed app.

Turn on private-preview membership, independent reviewer IDs and reviewed workload digests only for the approved cohort. Keep mounted settlement signing and Devnet campaign activation under the separate [single-write-origin cutover procedure](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement).
