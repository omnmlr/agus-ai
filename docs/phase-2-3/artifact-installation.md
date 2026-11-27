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

For an independently runnable local native journey, build a matched APK and manifest signing key in your own disposable directory using `apps/android/native-preview/build.sh`. Keep that generated private key with the local backend and publish only the corresponding public key. `packages/cooperative-android/README.md` gives the commands for the Android full, partner, signer and correction journeys.

Use an authorized companion release keystore and operator manifest public key for the HTTPS private builds. The release procedure and Compose cutover are in `DEPLOYMENT.md` and `docs/phase-2-3/release-candidate.md` at the revision recorded here. Retail work-profile enrollment requires independent hardware acceptance. All wallet demonstrations use disposable Localnet or Devnet identities.
