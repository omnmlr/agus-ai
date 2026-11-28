function Get-CompanionSdk([string]$Path) {
    if (!$Path) { $Path = $env:ANDROID_HOME }
    if (!$Path) { $Path = $env:ANDROID_SDK_ROOT }
    if (!$Path) { $Path = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Invoke-CompanionTool([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Tool $([IO.Path]::GetFileName($File)) exited with $LASTEXITCODE." }
}

function Get-CompanionAssociation {
    $path = Join-Path $PSScriptRoot '../../deploy/stockholm/assetlinks.json'
    $entries = @(Get-Content -Raw -LiteralPath $path | ConvertFrom-Json)
    if ($entries.Count -ne 1 -or $entries[0].target.package_name -ne 'app.agus.companion') {
        throw 'Expected a single approved Companion App Links association.'
    }
    return $entries[0]
}

function Get-VerifiedCompanionApk([string]$Path, [string]$Sdk) {
    $apk = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    $tools = Join-Path $Sdk 'build-tools/35.0.0'
    $expected = (Get-CompanionAssociation).target.sha256_cert_fingerprints -replace ':',''
    $signer = @(Invoke-CompanionTool (Join-Path $tools 'apksigner.bat') @('verify','--print-certs',$apk) |
        Where-Object { $_ -match '^Signer #[0-9]+ certificate SHA-256 digest: [a-fA-F0-9]{64}$' })
    if ($signer.Count -ne 1 -or $expected -notcontains ($signer[0] -split ': ')[-1]) {
        throw 'APK certificate does not match the approved Companion association.'
    }
    $info = @(Invoke-CompanionTool (Join-Path $tools 'aapt2.exe') @('dump','badging',$apk))
    $package = $info | Where-Object { $_ -match "^package: name='app\.agus\.companion'" } | Select-Object -First 1
    if (!$package -or ($info -match '^application-debuggable')) { throw 'Expected a non-debuggable Companion release APK.' }
    [pscustomobject]@{
        path = $apk
        package = 'app.agus.companion'
        versionCode = [regex]::Match($package, "versionCode='([^']+)'").Groups[1].Value
        versionName = [regex]::Match($package, "versionName='([^']*)'").Groups[1].Value
        certificateSha256 = ($signer[0] -split ': ')[-1].ToLowerInvariant()
        sha256 = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
