[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$FunctionZip,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$FunctionSha256,
  [Parameter(Mandatory)][string]$CompanionApk,
  [Parameter(Mandatory)][string]$RollbackZip,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$RollbackSha256,
  [Parameter(Mandatory)][int]$ExpectedActiveDeployment,
  [string]$AndroidSdk = (Join-Path $env:LOCALAPPDATA 'Android/Sdk'),
  [string]$CredentialStore = (Join-Path $env:USERPROFILE '.agus-deployment/mobileinfra.encrypted'),
  [switch]$Activate
)

$ErrorActionPreference = 'Stop'
$origin = 'https://agusai.grindcity.app'
$package = 'app.agus.companion'
$functionUrl = 'https://console.neon.tech/api/v2/projects/old-fog-27608369/branches/br-super-firefly-bgzy7s7x/functions/mobileinfra'
$relation = 'delegate_permission/common.handle_all_urls'
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Confirm-Bundle([string]$Path, [string]$Sha256) {
  $file = (Get-Item -LiteralPath $Path).FullName
  if ((Get-FileHash -LiteralPath $file).Hash -ne $Sha256) { throw 'Function ZIP SHA-256 mismatch.' }
  $zip = [IO.Compression.ZipFile]::OpenRead($file)
  try {
    if ($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -ne 'index.mjs' -or !$zip.Entries[0].Length) {
      throw 'Expected a Function ZIP containing only index.mjs.'
    }
  } finally { $zip.Dispose() }
  return $file
}

function Get-NeonKey {
  if ($env:NEON_API_KEY) { return $env:NEON_API_KEY }
  if (Test-Path -LiteralPath $CredentialStore -PathType Leaf) {
    $secure = (Get-Content -Raw -LiteralPath $CredentialStore).Trim() | ConvertTo-SecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $clear = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      if ($clear.TrimStart().StartsWith('{')) {
        $storedKey = (ConvertFrom-Json -InputObject $clear -ErrorAction Stop).NEON_API_KEY
        if ($storedKey) { return $storedKey }
      } else {
        $match = [regex]::Match($clear, '(?m)^NEON_API_KEY=([^\r\n]+)')
        if ($match.Success) { return $match.Groups[1].Value.Trim() }
      }
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      Remove-Variable clear -ErrorAction SilentlyContinue
    }
  }
  $secure = Read-Host 'Existing authorized Neon API key' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-HostedState {
  $health = $public.GetAsync("$origin/health").GetAwaiter().GetResult()
  try {
    if ([int]$health.StatusCode -ne 200) { throw 'Hosted health did not return 200.' }
    $body = ConvertFrom-Json ($health.Content.ReadAsStringAsync().GetAwaiter().GetResult())
    if ($body.ok -ne $true -or $body.persistence -ne 'postgres') { throw 'Hosted PostgreSQL is unhealthy.' }
  } finally { $health.Dispose() }
  foreach ($check in @(@('/console.html',200), @('/api/v1/projects',401))) {
    $response = $public.GetAsync("$origin$($check[0])").GetAwaiter().GetResult()
    try {
      if ([int]$response.StatusCode -ne $check[1]) { throw "Unexpected HTTP status for $($check[0])." }
    } finally { $response.Dispose() }
  }
  $links = $public.GetAsync("$origin/.well-known/assetlinks.json").GetAwaiter().GetResult()
  try {
    if ([int]$links.StatusCode -eq 404) { return }
    if ([int]$links.StatusCode -ne 200) { throw 'Unexpected App Links HTTP status.' }
    $statements = ConvertFrom-Json ($links.Content.ReadAsStringAsync().GetAwaiter().GetResult())
    foreach ($statement in $statements) {
      if ($statement.relation -contains $relation -and $statement.target.namespace -eq 'android_app' -and $statement.target.package_name -eq $package) {
        $statement.target.sha256_cert_fingerprints
      }
    }
  } finally { $links.Dispose() }
}

function Get-ActiveFunction {
  $response = $neon.GetAsync($functionUrl).GetAwaiter().GetResult()
  try {
    if (!$response.IsSuccessStatusCode) { throw "Neon function lookup returned HTTP $([int]$response.StatusCode)." }
    $data = ConvertFrom-Json ($response.Content.ReadAsStringAsync().GetAwaiter().GetResult())
    if ($data.function) { return $data.function }
    return $data
  } finally { $response.Dispose() }
}

function Publish-Function([string]$Zip, [hashtable]$Bindings) {
  $content = [Net.Http.MultipartFormDataContent]::new()
  try {
    $part = [Net.Http.ByteArrayContent]::new([IO.File]::ReadAllBytes($Zip))
    $part.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('application/zip')
    $content.Add($part, 'zip', 'function.zip')
    $content.Add([Net.Http.StringContent]::new('nodejs24'), 'runtime')
    $content.Add([Net.Http.StringContent]::new((ConvertTo-Json -InputObject $Bindings -Compress)), 'environment')
    $response = $neon.PostAsync("$functionUrl/deployments", $content).GetAwaiter().GetResult()
    try {
      if (!$response.IsSuccessStatusCode) { throw "Neon deploy request returned HTTP $([int]$response.StatusCode)." }
      $data = ConvertFrom-Json ($response.Content.ReadAsStringAsync().GetAwaiter().GetResult())
      if ($data.deployment) { $data = $data.deployment }
      if (!$data.id) { throw 'Neon did not return a deployment ID. Check the owner console before retrying.' }
      return [int]$data.id
    } finally { $response.Dispose() }
  } finally { $content.Dispose() }
}

function Wait-Deployment([int]$Id, [string[]]$RetainedBindings) {
  $until = [DateTime]::UtcNow.AddMinutes(5)
  do {
    $status = Get-ActiveFunction
    $latest = $status.current_deployment
    if (!$latest) { $latest = $status.latest_deployment }
    if ($latest.id -gt $Id) { throw "A newer deployment is present. Review deployment $Id in the owner console." }
    if ($latest.id -eq $Id -and $latest.status -eq 'failed') { throw "Neon deployment $Id failed." }
    if ($status.active_deployment.id -eq $Id -and $status.active_deployment.status -eq 'completed') {
      foreach ($name in $RetainedBindings) {
        if ($status.active_deployment.environment -notcontains $name) { throw "Deployment $Id lost the $name binding." }
      }
      return
    }
    Start-Sleep -Seconds 5
  } while ([DateTime]::UtcNow -lt $until)
  throw "Timed out waiting for deployment $Id. Check the owner console before retrying."
}

$bundle = Confirm-Bundle $FunctionZip $FunctionSha256
$rollback = Confirm-Bundle $RollbackZip $RollbackSha256
$apk = (Get-Item -LiteralPath $CompanionApk).FullName
$tools = Join-Path $AndroidSdk 'build-tools/35.0.0'
$apkOutput = & (Join-Path $tools 'apksigner.bat') verify --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'Companion APK signature verification failed.' }
$cert = @($apkOutput | Where-Object { $_ -match '^Signer #\d+ certificate SHA-256 digest: [a-fA-F0-9]{64}$' })
if ($cert.Count -ne 1) { throw 'Expected exactly one Companion APK signer.' }
$hex = ($cert[0] -split ': ')[-1].ToUpperInvariant()
$fingerprint = ([regex]::Matches($hex,'.{2}').Value -join ':')
$badging = & (Join-Path $tools 'aapt2.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or !($badging -match "^package: name='app\.agus\.companion'") -or ($badging -match '^application-debuggable')) {
  throw 'Expected the non-debuggable AGUS Companion APK.'
}
if (!$Activate) {
  Write-Output "Local preflight passed. Companion certificate $fingerprint. Expected rollback deployment $ExpectedActiveDeployment."
  return
}

$neon = [Net.Http.HttpClient]::new()
$publicHandler = [Net.Http.HttpClientHandler]::new()
$publicHandler.AllowAutoRedirect = $false
$public = [Net.Http.HttpClient]::new($publicHandler)
$neon.Timeout = [TimeSpan]::FromSeconds(60)
$public.Timeout = [TimeSpan]::FromSeconds(15)
try {
  $key = Get-NeonKey
  if (!$key) { throw 'The existing Neon API key is required.' }
  $neon.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $key)
  Remove-Variable key
  $before = Get-ActiveFunction
  if ($before.active_deployment.id -ne $ExpectedActiveDeployment -or $before.active_deployment.status -ne 'completed' -or
      ($before.current_deployment -and $before.current_deployment.id -ne $ExpectedActiveDeployment)) {
    throw 'Current Neon state differs from the reviewed rollback deployment.'
  }
  $retained = @($before.active_deployment.environment)
  foreach ($name in @('AGUS_DATABASE_URL','DATABASE_URL','DATABASE_URL_UNPOOLED','AGUS_GOOGLE_CALLBACK_URL','AGUS_AUTH_RETURN_URL','AGUS_GOOGLE_CLIENT_ID','AGUS_GOOGLE_CLIENT_SECRET','AGUS_RESEND_API_KEY','AGUS_SETTLEMENT_ENABLED')) {
    if ($retained -notcontains $name) { throw "The current deployment is missing $name." }
  }
  if ($retained -contains 'AGUS_CAMPAIGN_SETTLEMENT_CLUSTER' -or $retained -contains 'AGUS_CAMPAIGN_SETTLEMENT_AUTOMATIC') {
    throw 'Existing campaign settlement settings require a separate reviewed cutover.'
  }
  $previousCert = @(Get-HostedState)
  if ($previousCert.Count -gt 1 -or ($retained -contains 'AGUS_ANDROID_CERT_SHA256' -and $previousCert.Count -ne 1)) {
    throw 'Existing App Links settings cannot be reconstructed from the live response.'
  }
  $desired = @{
    AGUS_ANDROID_CERT_SHA256 = $fingerprint
    AGUS_SETTLEMENT_ENABLED = '0'
    AGUS_CAMPAIGN_SETTLEMENT_AUTOMATIC = '0'
  }
  $id = Publish-Function $bundle $desired
  Write-Output "Neon accepted deployment $id."
  try {
    Wait-Deployment $id ($retained + @($desired.Keys))
    $actual = @(Get-HostedState)
    if ($actual.Count -ne 1 -or $actual[0] -ne $fingerprint) { throw 'Hosted App Links fingerprint does not match the signed Companion.' }
    Write-Output "Deployment $id verified with PostgreSQL, console HTTP 200, projects HTTP 401, and matching App Links."
  } catch {
    $state = Get-ActiveFunction
    if ($state.active_deployment.id -ne $id -or ($state.current_deployment -and $state.current_deployment.id -ne $id)) {
      throw "Deployment $id was not positively identified as the only active update. Inspect the owner console before retrying."
    }
    $desired.AGUS_ANDROID_CERT_SHA256 = if ($previousCert.Count) { $previousCert[0] } else { '' }
    $desired.AGUS_CAMPAIGN_SETTLEMENT_AUTOMATIC = ''
    $rollbackId = Publish-Function $rollback $desired
    Wait-Deployment $rollbackId $retained
    $restored = @(Get-HostedState)
    if (($restored -join ',') -ne ($previousCert -join ',')) { throw "Rollback $rollbackId did not restore the prior App Links response." }
    throw "Activation failed verification. Rollback $rollbackId passed hosted checks."
  }
} finally {
  $neon.Dispose()
  $public.Dispose()
}
