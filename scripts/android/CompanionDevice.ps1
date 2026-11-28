[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Devices','Pair','Connect','Install','Diagnostics','Acceptance')][string]$Action,
    [string]$Endpoint,
    [string]$Serial,
    [string]$Apk,
    [string]$AndroidSdk,
    [string]$Report
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'CompanionTools.ps1')
$sdk = Get-CompanionSdk $AndroidSdk
$adb = Join-Path $sdk 'platform-tools/adb.exe'
$package = 'app.agus.companion'
$domainName = 'agusai.grindcity.app'
$origin = "https://$domainName"

if ($Action -eq 'Devices') { Invoke-CompanionTool $adb @('devices','-l'); return }
if ($Action -in 'Pair','Connect') {
    if ($Endpoint -notmatch '^(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}$') {
        throw 'Supply the IPv4 address and port shown in Android Wireless debugging.'
    }
    # ADB prompts interactively for the one-time pairing code.
    Invoke-CompanionTool $adb @($Action.ToLowerInvariant(),$Endpoint)
    return
}

if (!$Serial) { throw 'Select the authorized physical device by its ADB serial using -Serial.' }
function Invoke-Device([string[]]$Arguments) {
    Invoke-CompanionTool $adb (@('-s',$Serial) + $Arguments)
}
function Get-DeviceProperty([string]$Name) {
    return ((Invoke-Device @('shell','getprop',$Name)) -join '').Trim()
}
if (((Invoke-Device @('get-state')) -join '').Trim() -ne 'device') {
    throw 'Unlock the device and authorize the workstation fingerprint in Android.'
}
if ((Get-DeviceProperty 'ro.kernel.qemu') -eq '1' -or (Get-DeviceProperty 'ro.boot.qemu') -eq '1') {
    throw 'Select the authorized physical device.'
}

if ($Action -eq 'Install') {
    if (!$Apk) { throw 'Provide the approved signed Companion APK using -Apk.' }
    $proof = Get-VerifiedCompanionApk $Apk $sdk
    Invoke-Device @('install','-r',$proof.path)
    return
}

$diagnostics = [ordered]@{
    collectedAt = [DateTime]::UtcNow.ToString('o')
    model = Get-DeviceProperty 'ro.product.model'
    manufacturer = Get-DeviceProperty 'ro.product.manufacturer'
    apiLevel = Get-DeviceProperty 'ro.build.version.sdk'
    android = Get-DeviceProperty 'ro.build.version.release'
    securityPatch = Get-DeviceProperty 'ro.build.version.security_patch'
    buildType = Get-DeviceProperty 'ro.build.type'
    companionInstalled = [bool]((Invoke-Device @('shell','pm','list','packages',$package)) -contains "package:$package")
}
if ($Action -eq 'Acceptance') {
    if (!$diagnostics.companionInstalled) { throw 'Install the approved signed Companion APK first.' }
    if (!$Report) { throw 'Provide a local acceptance report path using -Report.' }
    if (Test-Path -LiteralPath $Report) { throw 'Choose a new acceptance report path.' }
    $approved = Get-CompanionAssociation
    $associations = Invoke-RestMethod -Uri "$origin/.well-known/assetlinks.json" -MaximumRedirection 0 -TimeoutSec 15
    $match = @($associations |
        Where-Object { $_.target.namespace -eq $approved.target.namespace -and
            $_.target.package_name -eq $package -and $_.relation -contains 'delegate_permission/common.handle_all_urls' })
    if ($match.Count -ne 1 -or
        @($approved.target.sha256_cert_fingerprints | Where-Object { $_ -notin $match[0].target.sha256_cert_fingerprints }).Count) {
        throw 'The public App Links response does not contain the approved Companion association.'
    }
    $remoteApk = @(Invoke-Device @('shell','pm','path',$package) | Where-Object { $_ -match '^package:.*/base\.apk$' })
    if ($remoteApk.Count -ne 1) { throw 'Could not identify the installed base APK.' }
    $temporaryApk = Join-Path $env:TEMP ('agus-installed-' + [Guid]::NewGuid().ToString('N') + '.apk')
    try {
        $null = Invoke-Device @('pull',$remoteApk[0].Substring('package:'.Length),$temporaryApk)
        $installed = Get-VerifiedCompanionApk $temporaryApk $sdk
    } finally { if ([IO.File]::Exists($temporaryApk)) { [IO.File]::Delete($temporaryApk) } }
    $diagnostics.installedSha256 = $installed.sha256
    $diagnostics.certificateSha256 = $installed.certificateSha256
    if ([int]$diagnostics.apiLevel -lt 31) { throw 'Automated domain verification requires Android 12 or later.' }
    $null = Invoke-Device @('shell','pm','verify-app-links','--re-verify',$package)
    $verified = $false
    $queries = 0
    do {
        $state = Invoke-Device @('shell','pm','get-app-links',$package)
        $verified = [bool]($state -match '^\s*agusai\.grindcity\.app:\s*verified\s*$')
        if (!$verified) { Start-Sleep -Seconds 3 }
        $queries++
    } until ($verified -or $queries -ge 20)
    if (!$verified) { throw 'Android did not verify the Companion domain.' }
    $diagnostics.domainVerified = $true
    $launched = Invoke-Device @('shell','am','start','-W','-a','android.intent.action.VIEW','-c',
        'android.intent.category.BROWSABLE','-d',"$origin/auth/android")
    if (!($launched -match 'Activity:\s+app\.agus\.companion/')) { throw 'Android did not dispatch the public App Link to Companion.' }
    $checks = [ordered]@{
        google = 'Complete Google sign-in, then cancel a fresh request and retry'
        emailOtp = 'Complete email OTP with the authorized test mailbox, then verify an expired or reused code fails'
        restart = 'Verify session restore after restarting Companion and verify sign-out'
    }
    foreach ($field in $checks.Keys) {
        $diagnostics[$field] = (Read-Host "$($checks[$field]). Enter PASS or FAIL") -eq 'PASS'
    }
}
$json = $diagnostics | ConvertTo-Json
if ($Report) {
    if (Test-Path -LiteralPath $Report) { throw 'Choose a new diagnostics report path.' }
    $json | Set-Content -LiteralPath $Report -Encoding UTF8
}
$json
if ($Action -eq 'Acceptance' -and (!$diagnostics.google -or !$diagnostics.emailOtp -or !$diagnostics.restart)) {
    throw 'One or more observed physical acceptance checks failed.'
}
