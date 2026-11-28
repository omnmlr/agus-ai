# AGUS AI Android review and hackathon checklist

The Companion defaults to `https://agusai.grindcity.app`. Use the **agus-companion-review** artifact from the [Companion review workflow](https://github.com/omnmlr/agus-ai/actions/workflows/companion-review.yml?query=branch%3Afeature%2Ffinal-hackathon-experience). It contains the debug APK, unsigned release APK, exact Git revision, signing fingerprint and SHA-256 checksums. The debug and production certificates are separate. Android requires a clean debug install on a dedicated review device if a build signed by another certificate is present.

## Physical Android and Seeker

1. Verify `SHA256SUMS.txt`, then use `adb devices -l` and `adb -s DEVICE_SERIAL install -r agus-companion-review.apk`. Record model, Android version, display size, density and font scale. The package is `app.agus.companion`, with Android 9 as its minimum.
2. On first launch check the logo, splash, screen insets and button access with both gesture and three-button navigation. Open the developer portal, Terms and Privacy links. Sign in with a disposable account, close and reopen the app, then sign out to check session removal.
3. Test email-code delivery, wrong code, resend cooldown and account creation. For Google and verified invitation links, use the release-signed APK after the live association for its certificate is available. Test browser cancellation, cold launch, warm launch and an expired invitation.
4. Generate a pairing code and pair a dedicated runner. Check ready, stale and disconnected states. Verify rename and diagnostics, then turn public listing off and review a direct invitation. Accept only the exact reviewed APK and evidence scope.
5. Start one authorized workload from the dedicated runner. Open the running session and stop it from the anchored control. Check acknowledgement and cleanup after reconnecting. Inspect the completed report, result, evidence digest and any receipt separately.
6. Review Earnings at different date ranges and inspect the payout status. Use only a disposable Devnet wallet for ownership proof. Verify denial, successful proof, replacement and disconnect. Record which wallet and network actually worked. Current proof uses the supported Fake Wallet path. Seeker Wallet or Seed Vault verification requires genuine hardware and a compatible wallet path.
7. Treat the managed-profile Work Runtime as a separate authorized preview. Check the Companion entry point and compatibility explanation on retail hardware. Provision and test the Runtime only on the approved disposable Android 15 preview image.

## Founder signing with the existing Companion key

Set the four variables through the founder's local secret store. `AGUS_ANDROID_KEYSTORE_FILE` and `AGUS_ANDROID_KEY_ALIAS` select the established Companion identity. `AGUS_ANDROID_KEYSTORE_PASSWORD` and `AGUS_ANDROID_KEY_PASSWORD` supply the existing passwords. In the checked-out revision, run:

```sh
cd apps/android
./gradlew --no-daemon assembleRelease testDebugUnitTest lintDebug
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs app/build/outputs/apk/release/app-release.apk
sha256sum app/build/outputs/apk/release/app-release.apk
```

Compare the certificate to the established signer before distributing. Apply the existing operator procedure for public HTTPS association and roll back if the release certificate does not match. The hosted API reported Android Google sign-in unavailable and the public association URL returned 404 during review. [Founder signing and approved activation](founder-signing.md)

## Demo sequence

1. Open the developer console, create a project and upload an authorized APK. Check its recorded SHA-256. Pair a dedicated runner and select a supported test scenario. [Developer quickstart](https://agusai.grindcity.app/docs/quickstart)
2. Connect an external agent over local stdio MCP or use the CLI. Queue a run with the developer identity, inspect evidence, and stop it where the demo calls for interruption. [External agent setup](../../README.md#connect-external-agents)
3. Show the runner-signed report and separately inspect finalized chain effect. Use the wallet false-success example to demonstrate why an app success callback alone is insufficient. [Reproducible local lab and historical evaluation](../mobile-test/DEMO.md)
4. Switch to the Companion to show enrollment, private review, running state, acknowledged stop and earnings. Keep paid and unpaid journeys distinct. Show the previously finalized Devnet test-USDC funding, payout, review award and refund alongside the SAS attestation. [Archived Devnet and SAS evidence](evidence/devnet-2026-11-28/README.md)

## Screen integration

| Screens | Control plane operations |
| --- | --- |
| Welcome and sign-in | `/auth/google/start`, `/auth/google/exchange`, `/auth/email/start`, `/auth/email/verify`, existing password login and registration |
| Home and enrollment | `/auth/me`, `/me/devices`, `/me/devices/pairings`, `/me/sessions`, `/me/earnings` |
| My Device | Owned device details, diagnostics, rename, revoke and `/invitations` |
| Activity and job details | Owned listing and schedule, `/marketplace/jobs`, `/invitations` review, accept, decline and revoke |
| Running and completed | `/me/sessions/:id`, timeline and stop, sanitized receipt metadata |
| Earnings and wallet | `/me/earnings`, `/me/campaign-earnings`, payout-wallet challenge and verification, verified destinations and finalized Explorer links |
| Profile and inbox | Profile update, notification list and preferences, read state, logout |
