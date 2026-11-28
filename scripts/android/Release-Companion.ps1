[CmdletBinding(DefaultParameterSetName='Build')]
param(
    [Parameter(Mandatory)][string]$OutputDirectory,
    [Parameter(ParameterSetName='Build')][string]$UnsignedApk,
    [Parameter(ParameterSetName='Build')][switch]$Offline,
    [Parameter(ParameterSetName='Build')][string]$SigningStore = (Join-Path $env:USERPROFILE '.agus-deployment/companion-release-2026-11-28.dpapi'),
    [Parameter(Mandatory,ParameterSetName='Package')][string]$SignedApk,
    [Parameter(ParameterSetName='Build')]
    [Parameter(Mandatory,ParameterSetName='Package')][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceRevision,
    [string]$AndroidSdk
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'CompanionTools.ps1')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$sdk = Get-CompanionSdk $AndroidSdk
$tools = Join-Path $sdk 'build-tools/35.0.0'
$out = (New-Item -ItemType Directory -Path $OutputDirectory -Force).FullName
$apkOut = Join-Path $out 'agus-companion-release.apk'
$manifestPath = Join-Path $out 'release-manifest.json'
$sumsPath = Join-Path $out 'SHA256SUMS.txt'
$zip = Join-Path $out 'agus-companion-release.zip'
if (Test-Path -LiteralPath $manifestPath) { throw 'Use a fresh release output directory.' }
if ((Test-Path -LiteralPath $sumsPath) -or (Test-Path -LiteralPath $zip)) { throw 'Use a fresh release output directory.' }

if ($PSCmdlet.ParameterSetName -eq 'Build') {
    if (Test-Path -LiteralPath $apkOut) { throw 'The release output APK already exists.' }
    if ($UnsignedApk) {
        if (!$SourceRevision) { throw 'Provide the original -SourceRevision for an existing unsigned APK.' }
        $unsigned = (Resolve-Path -LiteralPath $UnsignedApk).Path
    }
    else {
        $head = (Invoke-CompanionTool 'git' @('-C',$repo,'rev-parse','HEAD')).Trim()
        if ($SourceRevision -and $SourceRevision -ne $head) { throw 'The requested source revision differs from HEAD.' }
        if (Invoke-CompanionTool 'git' @('-C',$repo,'status','--porcelain','--','apps/android')) {
            throw 'Commit or integrate the Android source before making a revision-labeled release.'
        }
        $SourceRevision = $head
        $project = Join-Path $repo 'apps/android'
        $names = 'AGUS_ANDROID_KEYSTORE_FILE','AGUS_ANDROID_KEYSTORE_PASSWORD','AGUS_ANDROID_KEY_ALIAS','AGUS_ANDROID_KEY_PASSWORD','ANDROID_HOME','ANDROID_SDK_ROOT'
        $saved = @{}
        foreach ($name in $names) {
            $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
            [Environment]::SetEnvironmentVariable($name,$null,'Process')
        }
        $env:ANDROID_HOME = $sdk
        $env:ANDROID_SDK_ROOT = $sdk
        Push-Location $project
        try {
            $arguments = @(':app:assembleRelease','--no-daemon','--console=plain','--max-workers=2')
            if ($Offline) { $arguments += '--offline' }
            Invoke-CompanionTool '.\gradlew.bat' $arguments
        } finally {
            Pop-Location
            foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
        }
        $unsigned = Join-Path $project 'app/build/outputs/apk/release/app-release-unsigned.apk'
    }
    Invoke-CompanionTool (Join-Path $tools 'zipalign.exe') @('-c','4',$unsigned)
    $scratch = (New-Item -ItemType Directory (Join-Path $env:TEMP ('agus-sign-' + [Guid]::NewGuid().ToString('N')))).FullName
    $keyFile = Join-Path $scratch 'companion.p12'
    $candidate = Join-Path $scratch 'signed.apk'
    $passwordName = 'AGUS_LOCAL_COMPANION_STORE_PASSWORD'
    $oldPassword = [Environment]::GetEnvironmentVariable($passwordName,'Process')
    try {
        $secure = (Get-Content -Raw -LiteralPath $SigningStore).Trim() | ConvertTo-SecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            try { $stored = ConvertFrom-Json ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) }
            catch { throw 'Companion DPAPI signing store payload is invalid.' }
            if (!$stored.password -or !$stored.keystore) { throw 'Companion DPAPI signing store is incomplete.' }
            $keyBytes = [Convert]::FromBase64String($stored.keystore)
            try { [IO.File]::WriteAllBytes($keyFile,$keyBytes) }
            finally { [Array]::Clear($keyBytes,0,$keyBytes.Length) }
            [Environment]::SetEnvironmentVariable($passwordName,$stored.password,'Process')
            Remove-Variable stored
        } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        Invoke-CompanionTool (Join-Path $tools 'apksigner.bat') @('sign','--v4-signing-enabled','false',
            '--ks',$keyFile,'--ks-key-alias','agus-companion','--ks-pass',"env:$passwordName",
            '--key-pass',"env:$passwordName",'--out',$candidate,$unsigned)
        $null = Get-VerifiedCompanionApk $candidate $sdk
        [IO.File]::Copy($candidate,$apkOut,$false)
    } finally {
        [Environment]::SetEnvironmentVariable($passwordName,$oldPassword,'Process')
        foreach ($file in $keyFile,$candidate) { if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) } }
        [IO.Directory]::Delete($scratch)
    }
} else {
    $proof = Get-VerifiedCompanionApk $SignedApk $sdk
    if ($proof.path -ne $apkOut) { [IO.File]::Copy($proof.path,$apkOut,$false) }
}

$proof = Get-VerifiedCompanionApk $apkOut $sdk
$manifest = [ordered]@{
    sourceRevision = $SourceRevision
    apk = [IO.Path]::GetFileName($apkOut)
    package = $proof.package
    versionCode = $proof.versionCode
    versionName = $proof.versionName
    certificateSha256 = $proof.certificateSha256
    sha256 = $proof.sha256
}
$manifest | ConvertTo-Json | Set-Content -Encoding ASCII -LiteralPath $manifestPath
"$($proof.sha256)  $($manifest.apk)" | Set-Content -Encoding ASCII -LiteralPath $sumsPath
Compress-Archive -LiteralPath $apkOut,$manifestPath,$sumsPath -DestinationPath $zip
$zipHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$zipHash  $([IO.Path]::GetFileName($zip))" | Set-Content -Encoding ASCII -LiteralPath ($zip + '.sha256')
[pscustomobject]@{ apk = $apkOut; archive = $zip; sha256 = $zipHash }
