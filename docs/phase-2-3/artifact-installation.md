# AGUS AI preview artifacts

Verify `SHA256SUMS.txt` with `sha256sum -c SHA256SUMS.txt` on Linux or compare `Get-FileHash -Algorithm SHA256` on Windows. `REVISION.txt` identifies the source. `ANDROID-SIGNERS.txt` records each application ID and development certificate.

| File | Use |
| --- | --- |
| `agus-companion-debug.apk` | Install on the authorized test device with `adb install -r agus-companion-debug.apk`. Use the saved preview origin or enter the approved HTTPS origin. |
| `agus-runtime-development.apk` | Android 15 AOSP on the pinned x86-64 `ranchu` image. The owner starts setup and visibly approves the work profile. The paired local verification service needs the private manifest signer corresponding to `development-manifest-public.b64`. |
| `agus-fixture-development.apk`, `agus-partner-development.apk` | First-party and independently signed cooperative SDK samples. Register the exact bytes as reviewed workloads. The Work runtime stages these builds only for an authorized lease. |
| `agus-dedicated-wallet-devnet.apk` | Dedicated reviewed wallet fixture. Use the pinned Fake Wallet and the dedicated runner playbook in the source repository. |
| `agus-cooperative-sdk.zip` | Java SDK source and two sample activities with manifests. Build and review each publisher’s independently signed APK. |
| `agus-neon-function.zip` | Deployment ZIP for the existing AGUS AI Function after owner approval. Existing runtime bindings are inherited. |
| `assetlinks.json.example` | Companion association template. Use the approved release APK’s SHA-256 certificate when binding `AGUS_ANDROID_CERT_SHA256`. |

The published development runtime pins `development-manifest-public.b64`. The matching disposable private key is retained as `manifest.pkcs8` in `/workspace/work/agus-ai-development-signing` on the release workspace, with owner-only permissions. It belongs to the loopback preview. For a different authorized workstation, create a matched runtime and backend pin with `apps/android/native-preview/build.sh` or build the release package with that workstation's `AGUS_NATIVE_MANIFEST_PUBLIC_FILE`. Keep its private key with the local backend.

To exercise the downloaded runtime with the matching workspace key, prepare an owner-only directory and copy `agus-runtime-development.apk`, `agus-fixture-development.apk`, and `agus-partner-development.apk` as `runtime.apk`, `fixture.apk`, and `partner.apk`. Copy the public pin as `manifest.public.b64` and install the retained private signing file as `manifest.pkcs8` with mode `0600`. Extract the fixture and partner certificates with SDK 35 `apksigner verify --print-certs`, saving only each `Signer #1 certificate SHA-256 digest` value as `fixture-signer.txt` and `partner-signer.txt`. Use that directory as the `preview_output` in the [SDK instructions](https://github.com/omnmlr/agus-ai/blob/feature/phase-2-3-product/packages/cooperative-android/README.md).

Use an authorized companion release keystore and operator manifest public key for the HTTPS private builds. The release procedure and Compose cutover are in `DEPLOYMENT.md` and `docs/phase-2-3/release-candidate.md` at the revision recorded here. Retail work-profile enrollment requires independent hardware acceptance. All wallet demonstrations use disposable Localnet or Devnet identities.
