# Windows release activation

The release artifacts were prepared from feature revision `98aeb20fd136a6be569bf4e6795b37b1d979666c`. Follow this procedure with the founder’s encrypted workstation and approved Devnet identities.

## Ordinary Companion authentication

Use SDK build-tools 35.0.0 and the verified, non-debuggable `app.agus.companion` APK. In Windows PowerShell, pass the new Function ZIP and the reviewed rollback ZIP and their independently recorded SHA-256 values to [Activate-Companion.ps1](../../deploy/neon/Activate-Companion.ps1). The same invocation with `-Activate` performs the hosted update after founder approval. The default invocation checks the artifacts locally.

```powershell
$release = @{
  FunctionZip = '<current release Function ZIP>'
  FunctionSha256 = '<verified current ZIP SHA-256>'
  CompanionApk = '<verified founder-signed Companion APK>'
  RollbackZip = '<ZIP corresponding to the approved rollback deployment>'
  RollbackSha256 = '<verified rollback ZIP SHA-256>'
  ExpectedActiveDeployment = 2
}
& .\deploy\neon\Activate-Companion.ps1 @release
# Run after founder approval and with the existing authorized API key loaded.
& .\deploy\neon\Activate-Companion.ps1 @release -Activate
```

The ordinary release keeps the existing OAuth callback, console return URL, Resend and database bindings through Neon’s deployment inheritance. The script derives the App Links certificate from the APK and checks PostgreSQL, console HTTP 200, unauthenticated projects HTTP 401, and the published App Links statement. If the new deployment becomes active and fails verification, the script reapplies the supplied rollback ZIP and prior App Links setting.

On the founder’s authorized phone, select the appropriate ADB serial and install the Companion after checking any existing package signature. If a debug installation conflicts, discuss removing it with the owner first because removal deletes its app data.

```powershell
adb -s SERIAL install -r PATH_TO_VERIFIED_COMPANION_APK
adb -s SERIAL shell pm verify-app-links --re-verify app.agus.companion
adb -s SERIAL shell pm get-app-links app.agus.companion
```

Confirm `agusai.grindcity.app` is verified. Test browser consent, cancellation, retry, app restart during sign-in, secure session restart, callback replay denial and sign-out. Use an authorized mailbox for an actual Resend delivery check.

## Private-preview approval

Approve a separate rollout for `app.agus.runtime.preview`. Use a dedicated device running the reviewed AOSP image and register only approved person UUIDs. Use the existing P-256 PKCS#8 file in WSL to supply `AGUS_NATIVE_MANIFEST_PKCS8` through the operator secret input. The corresponding SPKI SHA-256 is `7800f5d0b34e4858aa2f8a1e25e86c474bcd1530cc44ee12be7d6acb0895a6d1`.

Set `AGUS_PRODUCT_PILOT=private-preview`, `AGUS_PILOT_MEMBER_IDS`, `AGUS_PILOT_REVIEWER_IDS`, and `AGUS_NATIVE_REVIEWED_BUILDS` only after approving the cohort and package records. Every reviewed record needs the exact APK SHA-256, Android certificate SHA-256, package name, publisher ID and reviewed component. Reviewer IDs must belong to enrolled independent reviewers. The runtime package allowlist is `app.agus.preview.fixture` and `org.example.agus.checklist`. Follow the [deployment requirements](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement).

On the dedicated device, verify Android profile prompts, package lists before/during/after a lease, independently signed publisher acceptance and wrong-signer rejection, package collision handling, notification Stop, server revocation and offline expiry. Use synthetic data for clipboard, screenshot and sharing checks. Record the actual OS image and gate results. Keep the Work runtime off the founder’s everyday phone.

For separate Seeker acceptance, record physical provenance from trusted device records and use the authorized disposable wallet on Devnet. Run the pinned Fake Wallet control before a separate approved Seeker wallet check. Compare the intended recipient, amount and Devnet genesis with finalized RPC effects. Record whether Seed Vault was exercised. See the [physical acceptance checklist](handoff.md#windows-and-genuine-seeker-verification-assignment) and the [dedicated runner procedure](../../services/provider-runner/README.md).

## Funded Devnet acceptance and SAS

From the feature worktree on Windows, keep the database URI in the operator secret store. Use a fresh disposable PostgreSQL instance on loopback and an empty operator token account. Fund the six verified addresses using Devnet faucets. The funder receives 1.7 test USDC. The existing-only preparation creates missing operator and contributor token accounts after sufficient test SOL is available.

```powershell
$identities = '\\wsl.localhost\Ubuntu\home\omnmlr\.local\share\agus-ai\signing\devnet'
node services/settlement/prepare-devnet.mjs $identities 1700000 --existing-only --prepare-accounts
$env:AGUS_TEST_CAMPAIGN_DEVNET_IDENTITIES = $identities
$env:AGUS_TEST_CAMPAIGN_DEVNET_BROADCAST = '1'
# AGUS_TEST_PRODUCT_DATABASE_URL must already be set to the disposable local database.
node --test services/control-plane/test/campaign-localnet.integration.mjs
Remove-Item Env:AGUS_TEST_CAMPAIGN_DEVNET_IDENTITIES,Env:AGUS_TEST_CAMPAIGN_DEVNET_BROADCAST
```

The broadcast fixture reconciles one 1.7 USDC funding transaction, a 0.7 payout, a 0.2 partial award and a 0.8 refund. If submission is interrupted, use the journal and finalized RPC to reconcile the existing transfer before attempting anything further. See the [founder signing procedure](founder-signing.md).

For SAS, use a reviewed receipt JSON and the public key from that runner’s trusted enrollment. Take `$credential` and `$nonce` from the corresponding finalized command output.

```powershell
$env:AGUS_SAS_AUTHORITY_KEYPAIR_FILE = Join-Path $identities 'sas-authority.json'
$env:AGUS_SAS_ISSUER_KEYPAIR_FILE = Join-Path $identities 'sas-issuer.json'
$issuer = 'CsabkMjpeHytxppS8mXwvCnN5PbJ9uBzumkkskT1xBqc'
node services/attestation/issue.mjs initialize agus-rc-demo $issuer --broadcast
$credential = Read-Host 'Finalized credential address'
node services/attestation/issue.mjs issue receipt.json trusted-runner.pem $credential --broadcast
$nonce = Read-Host 'Issued receipt nonce'
node services/attestation/receipt.mjs verify receipt.json $credential $issuer $nonce --trusted-runner trusted-runner.pem
```

## Stockholm settlement

Keep the documented isolated AMD64 Compose release staged. An authorized SSM operator must check actual RAM, disk, CPU credits and the TLS edge on `i-0b608f6472205b337` in `eu-north-1`. Use a separate approved activation for the [single-write-origin settlement cutover](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement). Record AGUS AI and financial service health independently before and after the cutover.
