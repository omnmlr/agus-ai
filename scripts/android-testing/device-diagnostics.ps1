[CmdletBinding()]
param(
  [string]$Serial,
  [switch]$ExpectSeeker
)

$ErrorActionPreference = 'Stop'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = if ($env:AGUS_ADB) { $env:AGUS_ADB } else { Join-Path $sdk "platform-tools\adb.exe" }
if (-not (Test-Path $adb)) {
  $cmd = Get-Command $adb -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "ADB executable not found at $adb" }
  $adb = $cmd.Source
}

$rawLines = (& $adb -H 127.0.0.1 -P 5037 devices -l) | Where-Object { $_ -and $_ -notmatch '^List of devices attached' }
$attached = @()
foreach ($line in $rawLines) {
  if ($line -match '^\s*(\S+)\s+(device|unauthorized|offline|recovery|sideload)\b(.*)$') {
    $attached += [pscustomobject]@{
      Serial = $Matches[1]
      State  = $Matches[2]
      Detail = $Matches[3].Trim()
    }
  }
}

if ($attached.Count -eq 0) {
  Write-Host "No ADB targets attached."
  Write-Host "For a physical Android handset or Solana Seeker:"
  Write-Host "  1. Enable Developer Options (Settings > About phone > tap Build number 7 times)."
  Write-Host "  2. Enable USB debugging in Settings > System > Developer options."
  Write-Host "  3. Connect via a data-capable USB-C cable and accept 'Allow USB debugging'."
  exit 2
}

if (-not $Serial) {
  if ($attached.Count -gt 1) {
    Write-Host "Multiple ADB targets attached; pass -Serial <serial>:"
    $attached | Format-Table -AutoSize
    exit 2
  }
  $Serial = $attached[0].Serial
}

$target = $attached | Where-Object { $_.Serial -eq $Serial } | Select-Object -First 1
if (-not $target) {
  throw "Device serial '$Serial' is not attached. Run 'adb devices -l'."
}
if ($target.State -eq 'unauthorized') {
  throw "Device '$Serial' is unauthorized. Unlock the phone and tap 'Allow USB debugging' on the RSA prompt."
}
if ($target.State -ne 'device') {
  throw "Device '$Serial' is in state '$($target.State)', expected 'device'."
}

if ($Serial -notmatch '^[A-Za-z0-9_-]{1,100}$') {
  Write-Warning "Serial '$Serial' does NOT match AGUS runner schema (/^[A-Za-z0-9_-]{1,100}$/). Wireless ADB IP:PORT serials are rejected; use USB ADB."
}

function Adb-Shell {
  param([string[]]$ShellArgs)
  $out = & $adb -H 127.0.0.1 -P 5037 -s $Serial shell @ShellArgs 2>$null
  if ($LASTEXITCODE -ne 0) { return "" }
  return ($out | Out-String).Trim()
}

$qemu = Adb-Shell @('getprop', 'ro.kernel.qemu')
$kind = if ($qemu -eq '1') { 'emulator' } else { 'android-device' }
$manufacturer = Adb-Shell @('getprop', 'ro.product.manufacturer')
$brand = Adb-Shell @('getprop', 'ro.product.brand')
$model = Adb-Shell @('getprop', 'ro.product.model')
$deviceCode = Adb-Shell @('getprop', 'ro.product.device')
$api = Adb-Shell @('getprop', 'ro.build.version.sdk')
$release = Adb-Shell @('getprop', 'ro.build.version.release')
$patch = Adb-Shell @('getprop', 'ro.build.version.security_patch')
$abi = Adb-Shell @('getprop', 'ro.product.cpu.abi')
$abiList = Adb-Shell @('getprop', 'ro.product.cpu.abilist')
$deviceEpoch = Adb-Shell @('date', '+%s.%3N')

$trustDump = Adb-Shell @('dumpsys', 'trust')
$deviceSecure = if ($trustDump -match 'deviceSecure=(true|false)') { $Matches[1] } else { 'unknown' }
$batteryRaw = Adb-Shell @('dumpsys', 'battery')
$battLevel = if ($batteryRaw -match '(?m)^\s*level:\s*(\d+)') { $Matches[1] } else { 'unknown' }
$battTemp = if ($batteryRaw -match '(?m)^\s*temperature:\s*(\d+)') { [math]::Round([int]$Matches[1] / 10, 1) } else { 'unknown' }

$pkgsRaw = Adb-Shell @('pm', 'list', 'packages')
$installed = @{}
$watchPackages = @(
  'app.agus.testfixture',
  'app.agus.prototype',
  'com.solana.mobilewalletadapter.fakewallet',
  'com.solana.mwallet',
  'com.solanamobile.fakewallet',
  'com.solanamobile.seedvaultimpl',
  'com.solanamobile.seedvault',
  'com.solanamobile.wallet',
  'app.phantom',
  'com.solflare.mobile'
)
foreach ($pkg in $watchPackages) {
  $installed[$pkg] = ($pkgsRaw -match ("(?m)^package:" + [regex]::Escape($pkg) + "\s*$"))
}

$seedVaultMatches = ($pkgsRaw -split "`r?`n") | Where-Object { $_ -match 'seedvault|solanamobile' } | ForEach-Object { $_ -replace '^package:', '' }
$mwaIntentOut = Adb-Shell @('cmd', 'package', 'query-activities', '-a', 'android.intent.action.VIEW', '-d', 'solana-wallet://v1/associate/local')
$appLinksAgus = if ($installed['app.agus.prototype']) { Adb-Shell @('pm', 'get-app-links', 'app.agus.prototype') } else { 'app.agus.prototype not installed' }
$reverses = (& $adb -H 127.0.0.1 -P 5037 -s $Serial reverse --list | Out-String).Trim()

$summary = [ordered]@{
  serial              = $Serial
  runnerKind          = $kind
  serialMatchesSchema = ($Serial -match '^[A-Za-z0-9_-]{1,100}$')
  manufacturer        = $manufacturer
  brand               = $brand
  model               = $model
  device              = $deviceCode
  androidRelease      = $release
  apiLevel            = $api
  securityPatch       = $patch
  primaryAbi          = $abi
  abiList             = $abiList
  arm64Supported      = ($abiList -split ',') -contains 'arm64-v8a'
  api33PlusFixtureOk  = ([int]$api -ge 33)
  deviceSecurePinSet  = $deviceSecure
  deviceEpochFormatOk = ($deviceEpoch -match '^\d{10}\.\d{3}$')
  batteryPercent      = $battLevel
  batteryTempC        = $battTemp
  packagesInstalled   = $installed
  solanaMobileSystemPackages = @($seedVaultMatches)
  mwaHandlersFound    = ($mwaIntentOut -match 'ActivityInfo|packageName=')
  adbReverses         = if ($reverses) { $reverses -split "`r?`n" } else { @() }
  agusAppLinks        = $appLinksAgus
}

$summary | ConvertTo-Json -Depth 4

if ($ExpectSeeker -and $kind -eq 'emulator') {
  throw "Emulator attached; genuine Seeker testing requires an authorized physical Seeker unit."
}
if ($kind -eq 'android-device' -and -not $summary.arm64Supported) {
  Write-Warning "Device does not report arm64-v8a; AGUS-Crypto-Devnet-arm64.apk requires ARM64."
}
if (-not $summary.api33PlusFixtureOk) {
  Write-Warning "Device API $api is below 33; agus-mwa-lab.apk and SeedVaultSimulator require API 33+."
}
if ($deviceSecure -ne 'true') {
  Write-Warning "Device lock screen / PIN may not be configured (deviceSecure=$deviceSecure). Mock MWA Wallet requires PIN/biometric authentication."
}
