# Android provider runner

The desktop runner is the execution host. The provider Android app is a control surface for enrollment, consent, jobs and earnings. Use a factory-reset or dedicated provisioned Android test device, or a controlled Android emulator. Avoid running the control app or signing into personal accounts on the execution device. Use a disposable wallet for the wallet fixture.

## Windows USB acceptance

1. Install Node 24 and Android Studio with **Android SDK Platform-Tools** and **Android SDK Build-Tools 35.0.0**. Enable Developer options and USB debugging on the dedicated phone. Connect it via a data cable, unlock it and approve this laptop's ADB key. Keep Wireless debugging off.
2. Open PowerShell at the AGUS AI repository. The SDK paths below assume the default Android Studio installation.

```powershell
npm ci
$sdkDir = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:AGUS_ADB = Join-Path $sdkDir 'platform-tools\adb.exe'
$env:AGUS_AAPT = Join-Path $sdkDir 'build-tools\35.0.0\aapt.exe'
& $env:AGUS_ADB devices -l
New-Item -ItemType Directory -Path .data -ErrorAction SilentlyContinue
Copy-Item services/provider-runner/runner.example.json .data/provider-config.json
notepad .data/provider-config.json
```

The phone should show status `device`. In the JSON, set `device.serial` to that local ADB serial and `stateDirectory` to `./provider`. Set `kind` to `emulator` when using a dedicated AVD and set the serial from ADB. Review the APK and pin the exact SHA-256 and Android package in `approvedBuilds`. The example pins the signed historical AGUS Crypto Android ARM64 Devnet APK for launch-only inspection. Download it from the release and check the digest and package before uploading it to your developer project. [AGUS Crypto release](https://github.com/omnmlr/hackaholics-financial-agent/releases/tag/agus-crypto-devnet-1b56459d1875)

```powershell
$apk = '.data\AGUS-Crypto-Devnet-arm64.apk'
Get-FileHash -Path $apk -Algorithm SHA256
& $env:AGUS_AAPT dump badging $apk | Select-String '^package:'
```

3. In the provider app or API, request a one-time pairing code. Set the AGUS AI backend origin and enter the short-lived code when prompted. The PowerShell command uses a masked prompt and clears the environment variable on exit. Use the real HTTPS backend origin or a loopback HTTP development backend.

```powershell
$env:AGUS_CONTROL_PLANE_URL = 'https://<AGUS-AI-backend-host>'
$code = Read-Host 'Pairing code' -AsSecureString
$env:AGUS_PROVIDER_PAIRING_CODE = [System.Net.NetworkCredential]::new('', $code).Password
try {
  npm run start --prefix services/provider-runner -- .data/provider-config.json
} finally {
  Remove-Item Env:AGUS_PROVIDER_PAIRING_CODE -ErrorAction SilentlyContinue
}
```

On following starts the existing private runner identity and token are read from the private state directory. Keep this directory in the laptop owner's access-controlled profile. The example places it under the gitignored `.data` directory. Use a separate config and state directory for each dedicated device. To preview a private run, select the exact paired device, request scoped consent, accept while signed in as its owner, and launch the exact pinned build.

## Local stop and reconnect

- Developer or owner stop requests a stop through the backend. It remains pending until the runner cancels its work, stops and uninstalls staged packages, and acknowledges cleanup.
- Press **Ctrl+C** in the runner terminal for an attended shutdown, or run the following in a second PowerShell terminal for a persistent emergency stop. The marker is local and independent of the network.

```powershell
npm run start --prefix services/provider-runner -- .data/provider-config.json --stop
```

- If the connection fails after a clean local stop, the runner saves a pending receipt including its short-lived lease credential. Keep the state directory private. On reconnect, run with `--reconcile` to acknowledge outstanding cleanup and upload any eligible receipt without claiming new work.
- Resume after inspecting the dedicated device and any outstanding chain signature. Clear the `emergency-stop` marker inside the configured state directory and start normally. When an install or cleanup is uncertain, the runner retains the local device and state locks. Inspect the phone, resolve any unresolved transaction, clean the fixture packages, and clear those locks only after verifying the previous runner exited. A disconnected phone may need local cleanup before another workload.

## Workloads and evidence

- `app-launch` works on a pinned dedicated test APK. The runner enforces manifest/package and digest equality, installs for Android user 0, verifies the app is foreground, and uninstalls it. It refuses to replace a package already present. The historical APK is ARM64 and can require an ARM64 handset.
- `wallet-connect`, `wallet-transfer` and `wallet-false-success` require the migrated native fixture and the pinned Solana Mobile Fake Wallet. For Windows, a compatible disposable Agave validator and fixture prepare service must be reachable on the runner at loopback ports 8899 and 8898. Use the migrated demo's requirements for platform tooling, build, pinned wallet download and local services. Reverse only the two loopback ports over USB or to the AVD. The hosted transfer scenario must also configure its independent verifier for the same Localnet. [Fixture and Localnet setup](../../docs/mobile-test/DEMO.md)

```powershell
& $env:AGUS_ADB -s '<ADB-serial>' reverse tcp:8898 tcp:8898
& $env:AGUS_ADB -s '<ADB-serial>' reverse tcp:8899 tcp:8899
```

Add the fixture's `app.agus.testfixture` package and calculated digest to `approvedBuilds`, the desired wallet scenarios, `wallet: { "apkPath": "...", "sha256": "269c0357b05d039dc544d777a06fb10092c340d9606a89d192911d7ba82da3aa" }`, and `localnet: { "genesis": "..." }`. Replace the example paths and identifiers with the dedicated test setup. The finalized positive assertion uses the fixture-known recipient and 1,000,000 lamports. A simulated submission from the fixture wallet is a failing test result when independent RPC finality is absent.

- Scripted runs follow fixed fixture steps. Agent runs can use the external relay to inspect the semantic phase and choose one of the permitted actions. The executor accepts only the current fixture-specific tap target. It checks the foreground package and does not expose shell, coordinates, keyboard input, device settings, personal app inventories or arbitrary screenshots. Signed metrics include action count, invalid actions, recovery and policy violations.
- Optional runner-local planners `local` and `gemini` use the same action validator. For Gemini, explicitly set `AGUS_GEMINI_API_KEY` and `AGUS_GEMINI_MODEL` for the dedicated runner. Only synthetic phase names and allowlisted action choices are shared with the configured Gemini model. A runner-local outcome is labeled in the signed manifest and does not substitute for independent control-plane observation of external relay actions.
- Screenshot and log attachments are restricted by scoped job permissions. Trajectory retention requires its own explicit permission, and does not grant training reuse. Receipts are signed by the enrolled runner and attest its claims. ADB-reported Android hardware and Seeker compatibility require separate proof.

## Checks

Run `npm ci` at the repository root and `npm ci --prefix services/control-plane` for the integration test dependency. Then run `npm run test --prefix services/provider-runner`. Tests exercise the actual local control plane over HTTP with a labeled synthetic device. They test software behavior without claiming real Android execution.

For actual dedicated Android acceptance, supply the device serial, native fixture APK, pinned Fake Wallet APK, and an output directory to `node --import tsx services/provider-runner/test/android-acceptance.mjs`. Both packages must initially be absent from the device. The helper assumes the same two ports and genesis are set up as in the wallet demo. Supply `-` in place of the wallet APK for launch-only acceptance. It verifies a consented private external-agent job and a separate manual, unpaid marketplace job and exports their signed reports and fixture screenshots.

## Model-driven acceptance

Run `NODE_USE_ENV_PROXY=1 AGUS_GEMINI_MODEL=gemini-3.1-flash-lite node services/provider-runner/test/gemini-live.mjs` with `AGUS_GEMINI_API_KEY` loaded privately. This uses real Gemini decisions with a synthetic Android adapter. For real Android, use the existing Android acceptance script with `AGUS_ANDROID_ACCEPTANCE_GEMINI=1`, or dispatch `Android wallet acceptance` with `provider_only=true` and `gemini_agent=true` after an authorized operator binds the existing project key as the destination repository's `AGUS_GEMINI_API_KEY` secret. Set `agent_wallet=true` for the Localnet wallet variant when the job has adequate time. The signed report records the model and its decision count. The server labels these metrics as runner-signed. Only minimizing synthetic phases and allowlisted choices leave the runner.

## Public Devnet acceptance on dedicated USB hardware

1. Use the signed development fixture `agus-mwa-devnet.apk` from the release, or build it with `bash packages/mobile-test/lab/build-android.sh /tmp/agus-fixture devnet`. Register the exact APK and hash. Select a pinned Fake Wallet APK matching `FAKE_WALLET_SHA` from the runner protocol. Install that wallet on a disposable, dedicated test phone. Prepare its disposable test payer manually and fund it with test SOL. Keep private keys out of the runner. This wallet is intentionally retained after a run. Remove it manually after acceptance.
2. On the USB host, load `AGUS_TEST_CHAIN=devnet`, `AGUS_TEST_DEVNET_PAYER`, and `AGUS_TEST_DEVNET_RECIPIENT` with different disposable public addresses. Run `node --import tsx packages/mobile-test/lab/prepare.ts`. Run `adb -s DEVICE_SERIAL reverse tcp:8898 tcp:8898` to reach the loopback helper. The helper verifies public Devnet genesis, accepts the pinned payer, and emits only the fixed 1,000,000-lamport transfer to the pinned recipient. It neither holds signing keys nor requests Devnet airdrops.
3. Use `runner.example.json` as the base. Remove `localnet`, add `"devnet":{"payer":"PAYER","recipient":"RECIPIENT"}`, pin the Devnet fixture build SHA-256 and use `wallet-transfer`. Post a job with `expectedTransaction: {"network":"devnet","payer":"PAYER","recipient":"RECIPIENT","lamports":1000000}`. For an unpaid preflight, a private invitation suffices. A paid job requires a specific eligible public provider with a proved payout wallet and `payment: {"kind":"devnet","developerWallet":"USDC_FUNDING_WALLET"}`. Verify funding, reserve or accept, run, then settle and reconcile. [Settlement guide](../settlement/README.md)
4. For genuine Seeker, follow the attended USB procedure. Record build and Android/Seeker OS versions, observed wallet route, consent, UI outcome, and any independently verified chain result. A manually identified Seeker or a Fake Wallet run cannot prove Seed Vault TEE use, Seeker Genesis Token eligibility, or hardware attestation. [Windows and Seeker procedures](../../docs/mobile-test/WINDOWS_PHYSICAL_TESTING.md)
