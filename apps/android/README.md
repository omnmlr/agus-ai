# Android provider companion

The native reference app uses the provider API from `services/control-plane`. It provides a recording and integration target while the founder and Chisom own the final UI. The developer portal stays web-first. Its URL can be set from Welcome or Profile.

## Build and install

Use JDK 17 or 21, Android SDK Platform 35, Android SDK Build Tools 35.0.0 and Platform Tools. The app targets Android 15 and requires Android 9 or newer.

From `apps/android` run:

```sh
./gradlew assembleDebug testDebugUnitTest lintDebug
adb devices -l
adb -s DEVICE_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
```

The Windows equivalent uses `gradlew.bat` and `adb.exe`. The APK package is `app.agus.companion`, separate from the financial app and Android execution fixture. The debug signing key is for development. Configure a dedicated release signing identity before producing a distributable release.

Run the control plane, web portal and desktop runner using the root setup. Enter the control plane **origin** as the app’s sign-in host and the **web** origin in Developer portal. Use HTTPS for shared preview or deployment. With the API's default port 8080, use `http://10.0.2.2:8080` from a local emulator. For a USB development device, use `adb -s DEVICE_SERIAL reverse tcp:8080 tcp:8080` and enter `http://127.0.0.1:8080`. Reverse the separate web port if you need a local developer portal on the same phone. Debug cleartext support is restricted to emulator and local ADB reverse addresses.

## Primary screens

| Screen | Behavior |
| --- | --- |
| Welcome | Provider entry, private code review with safe auth resume, and Developer portal. |
| Auth | Account creation and sign-in with the control-plane account. The bearer session stays in memory. Logout revokes it on the server. |
| Enrollment | Generate a short-lived one-time code for the desktop runner. |
| Home | Tappable payout chart, owned device readiness, today’s terminal sessions, and current session. |
| My Device | Owned capability profile and freshness, diagnostics, and a Device options menu for private share, rename and revoke. |
| Activity | Public listing, weekly schedule and constraints, independent automatic matching, compatible offers, private requests, running sessions and history. |
| Job Details | Review requester, exact package and build, scenario, time limit, evidence allowances and payout. Explicit acceptance, decline, or revoke is server-authorized. |
| Active Session | Provider-owned state and timeline. A stop request waits for runner acknowledgement. The runner operator retains local stop. |
| Completed Session | Outcome, chain-verification status, report seal, evidence digests and runner timeline. |
| Earnings | Device-scoped Devnet payout totals, daily chart, status and history, with Explorer links only for returned public signatures. |
| Profile | Account ID, developer portal settings, privacy guidance, test wallet and sign-out. |

The three tabs are Home, Activity and Earnings. The UI polls authoritative detail every ten seconds while foregrounded and supports manual refresh. Session tokens, wallet authorizations and invitation codes are excluded from backups and durable application state. Closing the app leaves workload authorization and stop enforcement with the server and runner.

The companion controls enrollment and observes workload status. Automation runs on a dedicated, operator-approved USB Android phone or emulator managed by the desktop runner. Use disposable accounts and reviewed APKs. The MWA action authorizes the official Fake Wallet for a disposable Devnet public address and immediately deauthorizes. It does not sign transactions or change a server-side payout destination. The upstream adapter is pinned to 2.1.1 because 2.2.x declares minimum compile SDK 37.

Private invitations share an opaque code or a configured HTTPS `/invite/<code>` web link. In the reference build, paste the code in Activity or Welcome. Android App Links require the actual deployment host and release-signing certificate in `/.well-known/assetlinks.json`. Add the verified intent filter together with that association. Accept remains a separate authenticated action on the assigned account.

## Verification and integration selectors

The Gradle suite builds a debug APK, checks Android lint, and tests production vs localhost origin handling, exact-origin invitation links and Solana address conversion. A device acceptance pass requires a connected dedicated phone or emulator, configured control plane and a paired runner. Use disposable Devnet accounts for wallet and payout verification.

Automation selectors are Android resource IDs under `app.agus.companion`, including `screen_title`, `tab_home`, `tab_activity`, `tab_earnings`, `auth_sign_in`, `generate_pairing`, `device_options`, `share_private_invitation`, `review_private_code`, `invitation_accept`, `accept_market_offer`, `session_stop` and `connect_test_wallet`. Native UI never receives the runner token or ADB transport credentials.
