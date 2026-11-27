[CmdletBinding()]
param(
  [string]$LabRoot = "$env:USERPROFILE\.agus-lab"
)

$ErrorActionPreference = 'Continue'
$failures = 0

function Check-Item {
  param(
    [string]$Name,
    [bool]$Ok,
    [string]$Detail
  )
  if ($Ok) {
    Write-Host ("[PASS] {0}: {1}" -f $Name, $Detail)
  } else {
    Write-Host ("[FAIL] {0}: {1}" -f $Name, $Detail)
    $script:failures++
  }
}

function Warn-Item {
  param(
    [string]$Name,
    [string]$Detail
  )
  Write-Host ("[WARN] {0}: {1}" -f $Name, $Detail)
}

Write-Host "=== AGUS AI Windows + Android Testing Preflight ==="

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeVer = if ($nodeCmd) { (& $nodeCmd.Source -v).Trim() } else { "" }
$nodeMajor = if ($nodeVer -match '^v(\d+)\.') { [int]$Matches[1] } else { 0 }
Check-Item "Node.js >= 24" ($nodeMajor -ge 24) ("$nodeVer ($($nodeCmd.Source))")

$execPolicy = Get-ExecutionPolicy -Scope CurrentUser
Check-Item "PowerShell CurrentUser ExecutionPolicy" ($execPolicy -in @('RemoteSigned', 'Unrestricted', 'Bypass')) "$execPolicy"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Check-Item "Workspace node_modules" (Test-Path (Join-Path $repoRoot 'node_modules')) (Join-Path $repoRoot 'node_modules')

$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "$env:LOCALAPPDATA\Programs\EclipseAdoptium\jdk-21.0.13.1+2" }
$javacPath = Join-Path $javaHome "bin\javac.exe"
$javacVer = if (Test-Path $javacPath) { (& $javacPath -version 2>&1 | Out-String).Trim() } else { "missing" }
Check-Item "JDK 21 (javac)" ($javacVer -match '^javac 21\.') "$javacVer ($javaHome)"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adbPath = Join-Path $sdk "platform-tools\adb.exe"
$emuPath = Join-Path $sdk "emulator\emulator.exe"
$platform35 = Join-Path $sdk "platforms\android-35\android.jar"
$buildTools35 = Join-Path $sdk "build-tools\35.0.0\apksigner.bat"
$usbDriver = Join-Path $sdk "extras\google\usb_driver\android_winusb.inf"

Check-Item "Android SDK root" (Test-Path $sdk) $sdk
Check-Item "ADB binary" (Test-Path $adbPath) $adbPath
Check-Item "Android Platform 35" (Test-Path $platform35) $platform35
Check-Item "Android Build-Tools 35.0.0" (Test-Path $buildTools35) $buildTools35
Check-Item "Google USB Driver" (Test-Path $usbDriver) $usbDriver

if (Test-Path $emuPath) {
  $accelOut = (& $emuPath -accel-check 2>&1 | Out-String).Trim()
  Check-Item "Emulator acceleration (WHPX)" ($LASTEXITCODE -eq 0) ($accelOut -replace '\r?\n', ' | ')
  $avds = (& $emuPath -list-avds 2>&1 | Out-String).Trim()
  Check-Item "AVD agus_ci present" ($avds -match '(?m)^agus_ci$') ($avds -replace '\r?\n', ', ')
} else {
  Check-Item "Android Emulator binary" $false $emuPath
}

$jqCmd = Get-Command jq -ErrorAction SilentlyContinue
Check-Item "jq CLI" ($null -ne $jqCmd) ($(if ($jqCmd) { $jqCmd.Source } else { "missing" }))

$opensslPath = @(
  (Get-Command openssl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  "C:\Program Files\Git\usr\bin\openssl.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
Check-Item "OpenSSL (Ed25519)" ($null -ne $opensslPath) ($(if ($opensslPath) { $opensslPath } else { "missing" }))

$gitBash = "C:\Program Files\Git\bin\bash.exe"
Check-Item "Git Bash" (Test-Path $gitBash) $gitBash

$wslOk = $false
$wslDetail = "wsl missing"
if (Get-Command wsl -ErrorAction SilentlyContinue) {
  $wslOut = (wsl -d Ubuntu -- bash -c "~/agus-lab/solana-release/bin/solana --version && ~/agus-lab/solana-release/bin/solana-test-validator --version" 2>&1 | Out-String).Trim()
  $wslOk = ($LASTEXITCODE -eq 0) -and ($wslOut -match 'solana-test-validator 4\.4\.1')
  $wslDetail = ($wslOut -replace '\r?\n', ' | ')
}
Check-Item "WSL2 Ubuntu Agave v4.4.1" $wslOk $wslDetail

$walletApk = Join-Path $LabRoot "apks\fakewallet-v1-debug.apk"
$expectedWalletSha = "269c0357b05d039dc544d777a06fb10092c340d9606a89d192911d7ba82da3aa"
$walletOk = (Test-Path $walletApk) -and ((Get-FileHash $walletApk -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedWalletSha)
Check-Item "Pinned Fake Wallet APK" $walletOk $walletApk

$agusApk = Join-Path $LabRoot "apks\AGUS-Crypto-Devnet-arm64.apk"
$expectedAgusSha = "d6f449dc6f71454b6fc554e8121f9b5db6cb5cadf3c4402c7483d4033d681e55"
if (Test-Path $agusApk) {
  $agusOk = ((Get-FileHash $agusApk -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedAgusSha)
  Check-Item "Signed AGUS Crypto ARM64 APK" $agusOk $agusApk
} else {
  Warn-Item "Signed AGUS Crypto ARM64 APK" "Not staged yet at $agusApk (only required for ARM64 physical handset customer target test)"
}

$warp = Get-Service -Name "CloudflareWARP" -ErrorAction SilentlyContinue
if ($warp -and $warp.Status -eq 'Running') {
  Warn-Item "CloudflareWARP" "CloudflareWARP service is Running; pause WARP if large APK/SDK downloads or Devnet RPC calls reset."
}

if (Test-Path $adbPath) {
  Write-Host "`n=== Connected ADB Devices ==="
  & $adbPath devices -l
}

Write-Host ""
if ($failures -gt 0) {
  Write-Host "Preflight finished with $failures failure(s)."
  exit 1
}
Write-Host "Preflight passed: local Windows + Android + WSL2 test environment is ready."
