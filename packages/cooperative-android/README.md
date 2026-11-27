# Cooperative Android preview SDK

The Java source in [Workload.java](src/Workload.java) verifies a signed server workload and the `cooperative-v1` action contract. The [onboarding example](../../apps/android/native-preview/fixture/TestActivity.java) binds the contract to a small test-only Activity. The owner approves setup, install, launch and uninstall in Android. The fixture records only scoped observations. The AGUS controller checks its own profile policy, artifact hash, package, signer, authorization deadline and package postconditions.

## Add the example to an Android test build

1. Create a distinct application ID under the operator-approved preview namespace and keep it out of release variants. Include the SDK source in the test variant. The reference build lists the first-party `app.agus.preview.fixture` and the independently signed `org.example.agus.checklist` sample. Add a package only after verifying the publisher, exact APK digest, certificate, component and capability review.
2. Declare one explicit Activity, no providers, receivers or services, and no requested permissions. The reference Activity uses the controller's signature permission and checks Android's caller identity. No general component, command line, accessibility, dynamic code or screen-capture interface is part of the contract.
3. Embed the authorized manifest signing public key and require the recognized policy, evidence and protocol version. The preview uses separate P-256 keys for server manifests and Android Keystore receipts, with SHA-256 and DER signatures. The calling package and work profile are checked independently. Avoid adding required debug hooks to release binaries.
4. Connect narrow semantic actions to existing app functions. The example supports `describe` and `advance`, up to four actions per manifest. Reports contain the named action and an enum result. For attended demonstrations, the first-party fixture can return up to 20 approved event names and relative times. Storage, raw screenshots, personal content, and arbitrary URLs are outside this interface.
5. Keep the SDK lifecycle fail-closed. Do not resume a test after leave, lock or authority loss. The controller's local watchdog and DPC are responsible for stopping and quarantining the scoped package. Independent Android behavior on noncooperating builds and hardware is a separate release gate.
6. Send the exact APK digest, application ID and signing certificate SHA-256 to the preview operator. Register the same APK under the developer's project and select the reviewed variant. Release assurance for an unmodified binary uses the dedicated runner.

AOSP tested independent publisher signing, rejection before installation for a mismatched certificate, and a preserved pre-existing package collision. The development build uses disposable keys and host loopback. The private preview build pins the approved HTTPS origin and a separately supplied operator key, and the server authorizes the registered publisher for each reviewed APK. The runtime continues to enforce the tested AOSP API 35 image and narrow install policy. [Acceptance evidence](../../docs/phase-2-3/release-candidate.md)

## Reproduce the end-to-end lab

The [CI workflow](../../.github/workflows/product-preview-android.yml) installs Android 35 SDK/tools, builds the actual controller and fixture artifacts, starts an isolated control plane on port 18765, and seeds a campaign with disposable identities. It drives visible controls on an AVD with Android's standard user-consent path. `full` verifies the mixed campaign. `cooperative` and `safety` independently exercise automated activity and offline stop. `partner` checks a separate signer and collision preservation. `signer` checks rejection before install. `correction` seeds a sealed dedicated Android run, accepts a human correction, and verifies the consented minimized export and withdrawal. Log and fixture provenance are in [the audit](../../docs/phase-2-3/audit.md).

To reproduce locally, use Node 24, JDK 21, Python 3, zip tools and a clean API 35 AOSP x86-64 `emulator-5554` with no existing work profile. Use a new output directory for every build. Run this in one shell on an isolated developer workstation so the offline test can suspend the disposable server started by that shell.

```sh
npm ci --prefix services/control-plane
preview_output="$(mktemp -d)"
bash apps/android/native-preview/build.sh "$preview_output"
export AGUS_PREVIEW_JOURNEY=full
node scripts/product-preview/fixtures.mjs "$preview_output" serve &
preview_backend_pid=$!
trap 'kill -CONT "$preview_backend_pid" 2>/dev/null || true
      kill "$preview_backend_pid" 2>/dev/null || true' EXIT
curl -fsS --retry 5 --retry-delay 1 --retry-connrefused http://127.0.0.1:18765/health
node scripts/product-preview/fixtures.mjs "$preview_output" seed
AGUS_PREVIEW_BACKEND_PID="$preview_backend_pid" python3 scripts/product-preview/android.py "$preview_output"
node scripts/product-preview/fixtures.mjs "$preview_output" review
```

The artifact directory contains a disposable private signing key, local state, and disposable authentication data. Keep it local and delete it after testing. Publish only the explicit sanitized evidence files from CI.

## Verify a downloaded receipt

Download the receipt through the campaign report or `GET /api/v1/assignments/{assignmentId}/receipt`. Obtain `manifest.public.b64` from the trusted operator or the exact audited lab build. The CLI takes the pinned key separately from the downloadable receipt.

```sh
node packages/developer-client/src/cli.mjs verify-native-receipt receipt.json "$preview_output/manifest.public.b64"
```

Check the returned assignment ID, attempt ID and build digest against the intended run. The verifier authenticates the manifest, installation key, structured report and any cleanup proof. The result represents the scoped preview claims and supplies no hardware attestation. Receipts issued before the installation-key binding require their original hosted verification record.
