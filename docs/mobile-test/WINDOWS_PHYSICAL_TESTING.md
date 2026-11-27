# Windows Local Environment & Physical Android / Seeker Testing Guide

This guide documents the Windows 11 local testing setup on branch `setup/android-testing` for exercising the AGUS mobile runner (`@agus/mobile-test`) against:
1. An accelerated local Android 15 AVD (`agus_ci`)
2. Ordinary physical Android handsets over USB ADB
3. A genuine physical Solana Seeker handset (plus official Solana Mobile testing tools)

All temporary lab APKs, keys, ledgers, and evidence live **outside Git** under `%USERPROFILE%\.agus-lab\` and `~/agus-lab/` (WSL2).

---

## 1. AGUS Provider Runner Requirements for Physical Devices

From `packages/mobile-test/src/{android.ts,runner.ts,contracts.ts}` and `packages/mobile-test/lab/{configure.ts,prepare.ts}`:

- **USB ADB transport only:** Runner invokes `adb -H 127.0.0.1 -P 5037 -s <serial> ...`. `configSchema` enforces `serial` matching `/^[A-Za-z0-9_-]{1,100}$/`, which rejects wireless `IP:PORT` ADB connections.
- **Explicit physical classification:** Physical devices must configure `kind: "android-device"` and `isolated: true`. The runner rejects a mismatch against `ro.kernel.qemu === "1"`.
- **Port reverse for Localnet + fixture helper:** `adb -s <serial> reverse tcp:8898 tcp:8898` (`prepare.ts`) and `adb -s <serial> reverse tcp:8899 tcp:8899` (Agave Localnet RPC) must be active.
- **Android API & ABI requirements:**
  - `agus-mwa-lab.apk` (`app.agus.testfixture`): `minSdkVersion 33` (Android 13+), `targetSdkVersion 35`.
  - `SeedVaultSimulator` (`com.solanamobile.seedvaultimpl`): `minSdk 33` (Android 13+).
  - `AGUS-Crypto-Devnet-arm64.apk` (`app.agus.prototype`): requires `arm64-v8a` ABI (physical ARM64 handset) and Solana Devnet reachability.
- **Runner ADB commands & device expectations:**
  - `get-state`, `getprop` (`ro.product.model`, `ro.build.version.sdk`, `ro.kernel.qemu`, `ro.product.brand`)
  - `dumpsys battery`, `cat /proc/meminfo`, `df -k /data`
  - `cmd package resolve-activity`, `am start -S -W -n`
  - `exec-out uiautomator dump /dev/tty`, `input tap`, `dumpsys window` (`mCurrentFocus`), `exec-out screencap -p`
  - `date +%s.%3N` (10-digit epoch + milliseconds), `logcat -b crash`, `pidof`, `logcat --pid=... -s AGUS_TEST:I`
  - **Privacy boundary:** Never expose device serials, IMEI, contacts, location, personal apps, or device-wide logs.

---

## 2. Windows 11 + WSL2 Toolchain Summary

| Component | Location / Version | Notes |
| --- | --- | --- |
| Node.js / npm | `C:\Program Files\nodejs\node.exe` (`v24.19.0`, npm `11.17.0`) | PowerShell `CurrentUser` ExecutionPolicy set to `RemoteSigned` so `npm`/`npx` work. |
| JDK 21 | `%LOCALAPPDATA%\Programs\EclipseAdoptium\jdk-21.0.13.1+2` | Required for `build-lab-apk.mjs` and `ANDROID_HOME` CLI tools (Android Studio's bundled JBR is OpenJDK 25). |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` | Includes `platform-tools` (`adb` 36.0.0), `build-tools;35.0.0`, `platforms;android-35`, `extras;google;usb_driver`, `system-images;android-35;default;x86_64`, and `WHPX` acceleration. |
| AVD | `agus_ci` in `%USERPROFILE%\.android\avd` | API 35 x86_64 accelerated virtual baseline. |
| `jq` & OpenSSL | `WinGet\Links\jq.exe` (1.8.2), `C:\Program Files\Git\usr\bin\openssl.exe` | Used for JSON assertions and ephemeral Ed25519 report signing. |
| Agave Localnet | `~/agus-lab/solana-release/bin/solana-test-validator` (`v4.4.1`) in WSL2 `Ubuntu` | Anza provides no native Windows binary; `.wslconfig` uses `networkingMode=mirrored` so `127.0.0.1:8899` shares seamlessly with Windows. |
| Windows APK Builder | `scripts/android-testing/build-lab-apk.mjs` | Cross-platform equivalent of `packages/mobile-test/lab/build-android.sh` (handles `;` classpath, `.bat` tools, and `jar ufM` instead of Linux `zip`). |

---

## 3. Solana Mobile Testing Tools & Seeker Requirements

| Tool | Role | Source / Binary Status | Key Testing Caveats |
| --- | --- | --- | --- |
| **MWA Fake Wallet** (`com.solana.mobilewalletadapter.fakewallet`) | Automated Localnet MWA + negative control (`Simulate submitted`) | Prebuilt pinned APK (`@solana-mobile/wallet-adapter-mobile@3.0.1`) | Supports `solana:localnet` and deterministic UI automation IDs used by `configure.ts`. |
| **Mock MWA Wallet** (`com.solana.mwallet`) | Bottom-sheet approval + biometric/PIN test wallet | Source-only (`solana-mobile/mock-mwa-wallet`, `compileSdk 36`, `minSdk 23`) | No prebuilt GitHub releases; requires `local.properties` (`privateKey`, `walletName`) and device PIN/fingerprint (`Authenticate` button valid 15 min); lacks Localnet RPC switch. |
| **Seed Vault Simulator** (`com.solanamobile.seedvaultimpl`) | Software simulation of `WalletContractV1` | Source-only (`solana-mobile/seed-vault-sdk`, `minSdk 33`, `targetSdk 35`) | Zero hardware security guarantees; intended for wallet developers rather than dApp MWA callers. |
| **Solana Mobile CLI** (`npx solana-mobile@0.6.0`) | `device list`, `device install fakewallet`, `device tune`, `playground` | npm (`npx solana-mobile@0.6.0`) | On Windows, `doctor` reports `Package managers: fail` due to `.cmd`/`.ps1` detection even when `npm` works. |
| **Genuine Solana Seeker** | Hardware TEE Seed Vault, built-in Seed Vault Wallet, Seeker Connect App Links | Attended physical device | Emulator / simulator runs cannot substantiate hardware attestation (`hardwareAttested: false`, `seekerVerified: false`), Seed Vault TEE custody, or genuine Seeker Genesis Token / `.skr` eligibility. |

---

## 4. Reproducible Verification Commands

### A. Workspace & Environment Preflight

```powershell
# Run workspace unit + stdio MCP tests (from repo root)
npm test

# Verify Windows SDK, JDK 21, WHPX, Google USB driver, WSL2 Agave v4.4.1, and staged APKs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/preflight.ps1

# Rebuild the disposable MWA fixture APK on Windows (outputs to %USERPROFILE%\.agus-lab\apks\)
node scripts/android-testing/build-lab-apk.mjs
```

### B. Accelerated Local AVD (`agus_ci`) End-to-End Regression

Runs WSL2 Agave `v4.4.1`, `prepare.ts`, `agus_ci` AVD, `wallet-false-success` (`FINALITY_TIMEOUT` + evaluation checks), `wallet-decline` (`DECLINED`), `wallet-transfer`, Ed25519 report sealing/verification, and idempotent two-pass token settlement:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/run-localnet-lab.ps1 `
  -BootEmulator -IncludeDecline -IncludeSettlement
```

### C. Ordinary Physical Android Phone (USB ADB)

1. Connect the dedicated test phone over a data-capable USB cable and accept **Allow USB debugging**.
2. Inspect device readiness:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/device-diagnostics.ps1
```

3. Run the automated Localnet Fake Wallet regression on the physical handset (replace `<SERIAL>` with the USB serial from `adb devices -l`):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/run-localnet-lab.ps1 `
  -Serial <SERIAL> -IncludeDecline -IncludeSettlement
```

4. Stage a Devnet configuration for the signed ARM64 customer target (`AGUS-Crypto-Devnet-arm64.apk`):

```powershell
$lab = "$env:USERPROFILE\.agus-lab"
$env:AGUS_TEST_CONFIG = "$lab\devnet-device.json"
$env:AGUS_TEST_EVIDENCE = "$lab\devnet-evidence"

node --import tsx scripts/android-testing/configure-device.mjs `
  "$lab\devnet-device.json" <SERIAL> devnet `
  --apk "agus-crypto:app.agus.prototype:$lab\apks\AGUS-Crypto-Devnet-arm64.apk" `
  --label "physical-arm64-test"

node --import tsx packages/mobile-test/src/cli.ts devices
node --import tsx packages/mobile-test/src/cli.ts run agus-crypto-launch
```

5. Capture post-test App Links and MWA diagnostics if an external wallet flow fails:

```powershell
adb -s <SERIAL> shell pm get-app-links app.agus.prototype
adb -s <SERIAL> logcat -d -t 1500 -s ReactNativeJS SolanaMobileWalletAdapterModule AndroidRuntime
```

### D. Genuine Solana Seeker Testing

1. Verify a physical Seeker unit is connected (fails fast if an emulator is attached):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/device-diagnostics.ps1 `
  -Serial <SEEKER_SERIAL> -ExpectSeeker
```

2. Run the automated Localnet MWA baseline (Fake Wallet + `agus-mwa-lab.apk` via USB `adb reverse`):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/android-testing/run-localnet-lab.ps1 `
  -Serial <SEEKER_SERIAL> -IncludeDecline
```

3. For Devnet `AGUS-Crypto-Devnet-arm64.apk` or Seeker Connect / Seed Vault Wallet attended tests:
   - Configure Devnet runner JSON with `configure-device.mjs` as above and launch `agus-crypto-launch`.
   - Complete Seed Vault biometric/PIN prompts in person (hardware TEE dialogs and `FLAG_SECURE` screens cannot and must not be automated across personal accounts).
   - Keep `hardwareAttested: false` / `seekerVerified: false` on automated runner reports until hardware provenance attestation and SGT/SIWS verification are separately implemented.

---

## 5. Safe, Isolated Testing Configurations

- **Dedicated test handset only:** Do not test on a personal primary phone. Use a dedicated/resettable device with no personal Google account, no banking apps, and no Mainnet wallets.
- **Disposable wallets & funds:**
  - **Localnet:** `prepare.ts` and `settlement.ts` generate ephemeral keypairs and local SOL/fixture SPL tokens on the disposable WSL2 ledger only.
  - **Devnet:** Create dedicated burner Phantom/Solflare/Seed Vault accounts switched to **Devnet**, funded only with free Devnet test SOL (`0.001` SOL transfer test amount + fees) or Circle test USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).
  - **Solflare Battery Saver:** Disable Android Battery Saver for Solflare before Devnet testing so Android does not kill the background MWA session.
- **Disposable app identities & keys:**
  - Use disposable tester Gmail/OTP accounts for `AGUS-Crypto-Devnet-arm64.apk`.
  - Keep `build-lab-apk.mjs` keystore (`CN=AGUS Disposable Lab`, validity 14 days) strictly inside temp directories and delete ephemeral Ed25519 signing keys immediately after `cli.ts seal`.
- **Stale lock recovery:** If a runner process terminates abruptly while holding a device lease, confirm no runner Node process is alive, inspect `%TEMP%\agus-test-user-<serial-hash>.lock\owner.json`, reconcile any recorded signature on RPC first, and only then remove the stale lock directory.

---

## 6. Observed Host Findings & Potential Technical Blockers

1. **Local Emulator Cold Boot Bottleneck (`VBS` + `WHPX` + Skylake 4C/8T):**
   - Host hardware (`Intel Core i7-6820HQ`, 4 cores / 8 threads, 15.59 GB RAM, ~3.7 GB free under VM load, Windows 11 `26100` with `Virtualization-based security` running) kept headless Android 15 x86_64 (`agus_ci`) cold boot from completing within 543s–615s (`sys.boot_completed` still unset).
   - **Impact:** Physical USB Android / Seeker testing (zero VM/emulator/SwiftShader overhead) and GitHub Actions `ubuntu-24.04` KVM are far faster and more reliable than headless local AVD cold boots on this host. If using `agus_ci` locally, boot once interactively in Android Studio to save a Quick Boot snapshot.
2. **Runner Serial Regex Rejects Wireless ADB:**
   - `packages/mobile-test/src/contracts.ts` enforces `serial` matching `/^[A-Za-z0-9_-]{1,100}$/`, intentionally blocking `IP:PORT` wireless ADB. Always connect physical handsets and Seeker over USB-C data cable.
3. **PowerShell 5.1 & `solana-mobile` CLI Windows Quirks:**
   - `npm.ps1` / `npx.ps1` fail when `ExecutionPolicy` is `Undefined`/`Restricted`; `CurrentUser` `RemoteSigned` resolves this.
   - `npx solana-mobile@0.6.0 doctor --json` passes Node, JDK 21, SDK, ADB, and Build Tools, but flags `Package managers: fail` on Windows even when `npm.cmd` is functional.
4. **No Native Windows Agave Validator & WSL2 `systemd` Startup Delay:**
   - `solana-test-validator` (`v4.4.1`) runs inside WSL2 `Ubuntu` and shares `127.0.0.1:8899` cleanly via `.wslconfig` `networkingMode=mirrored`, though cold WSL invocations emit a non-fatal `systemd` user session warning (`Failed to start the systemd user session`) and `prepare.ts` takes ~15–30s after genesis to finish its initial Localnet airdrop.
5. **Cloudflare WARP Service Active:**
   - `CloudflareWARP` is running on this host and coincided with transient TLS connection resets (`curl (35)` / `sdkmanager` stream close) during large downloads. Pause WARP if APK downloads or Devnet RPC requests reset.
6. **Physical Device Prerequisites & `FLAG_SECURE`:**
   - Real wallets (Seed Vault, Phantom, Solflare) commonly enable `FLAG_SECURE` on signing/PIN screens, which causes `adb exec-out screencap -p` or `uiautomator dump` to return blank frames or require attended manual approval.
   - `Mock MWA Wallet` and `Seed Vault Simulator` have no prebuilt GitHub release APKs and must be built from source if used (`Mock MWA Wallet` requires a configured device PIN/fingerprint lock screen).

