[CmdletBinding()]
param(
  [string]$Serial,
  [switch]$BootEmulator,
  [string]$AvdName = "agus_ci",
  [switch]$IncludeDecline,
  [switch]$IncludeSettlement,
  [string]$LabRoot = "$env:USERPROFILE\.agus-lab"
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = if ($env:AGUS_ADB) { $env:AGUS_ADB } else { Join-Path $sdk "platform-tools\adb.exe" }
$emu = Join-Path $sdk "emulator\emulator.exe"
$openssl = @(
  (Get-Command openssl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  "C:\Program Files\Git\usr\bin\openssl.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $openssl) { throw "OpenSSL not found; install Git for Windows or OpenSSL." }

$apkDir = Join-Path $LabRoot "apks"
$runDir = Join-Path $LabRoot ("run-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$evidenceDir = Join-Path $runDir "evidence"
$configPath = Join-Path $runDir "runner.json"
New-Item -ItemType Directory -Force -Path $apkDir, $runDir, $evidenceDir | Out-Null

$labApk = Join-Path $apkDir "agus-mwa-lab.apk"
if (-not (Test-Path $labApk)) {
  Write-Host "Building agus-mwa-lab.apk..."
  & node (Join-Path $PSScriptRoot "build-lab-apk.mjs") $apkDir
  if ($LASTEXITCODE -ne 0) { throw "Failed to build agus-mwa-lab.apk" }
}

$walletApk = Join-Path $apkDir "fakewallet-v1-debug.apk"
$expectedWalletSha = "269c0357b05d039dc544d777a06fb10092c340d9606a89d192911d7ba82da3aa"
if (-not (Test-Path $walletApk) -or ((Get-FileHash $walletApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedWalletSha)) {
  curl.exe -fsSL --http1.1 --retry 5 --retry-delay 2 --retry-all-errors `
    "https://github.com/solana-mobile/mobile-wallet-adapter/releases/download/%40solana-mobile/wallet-adapter-mobile%403.0.1/fakewallet-v1-debug.apk" `
    -o $walletApk
}
if ((Get-FileHash $walletApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedWalletSha) {
  throw "fakewallet-v1-debug.apk SHA-256 verification failed"
}

$emuProc = $null
$valProc = $null
$prepProc = $null

try {
  if ($BootEmulator) {
    if (-not $Serial) { $Serial = "emulator-5554" }
    $port = if ($Serial -match '^emulator-(\d+)$') { $Matches[1] } else { "5554" }
    Write-Host "Starting AVD '$AvdName' on port $port..."
    $emuLog = Join-Path $runDir "emulator.log"
    $emuErr = Join-Path $runDir "emulator.err.log"
    $emuProc = Start-Process -FilePath $emu -ArgumentList @(
      "-avd", $AvdName, "-port", $port, "-accel", "on", "-no-window",
      "-noaudio", "-no-boot-anim", "-no-snapshot", "-gpu", "swiftshader_indirect"
    ) -RedirectStandardOutput $emuLog -RedirectStandardError $emuErr -PassThru
  }

  if (-not $Serial) {
    $devices = @((& $adb -H 127.0.0.1 -P 5037 devices) | ForEach-Object {
      if ($_ -match '^\s*(\S+)\s+device\b') { $Matches[1] }
    })
    if ($devices.Count -ne 1) {
      throw "Pass -Serial <deviceSerial> or -BootEmulator (found $($devices.Count) ready devices)."
    }
    $Serial = $devices[0]
  }

  Write-Host "Starting WSL2 solana-test-validator (Agave v4.4.1)..."
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $wslHome = (& wsl.exe -d Ubuntu -- printenv HOME 2>$null | Out-String).Trim()
  $ErrorActionPreference = $prevPref
  if (-not $wslHome) { throw "Could not resolve WSL2 Ubuntu HOME directory." }

  $valOut = Join-Path $runDir "validator.log"
  $valErr = Join-Path $runDir "validator.err.log"
  $valProc = Start-Process -FilePath "wsl.exe" -ArgumentList @(
    "-d", "Ubuntu", "--",
    "$wslHome/agus-lab/solana-release/bin/solana-test-validator",
    "--ledger", "$wslHome/agus-lab/ledger",
    "--reset",
    "--bind-address", "127.0.0.1",
    "--rpc-port", "8899",
    "--faucet-per-request-sol-cap", "1",
    "--quiet"
  ) -RedirectStandardOutput $valOut -RedirectStandardError $valErr -PassThru

  $genesis = $null
  $body = '{"jsonrpc":"2.0","id":1,"method":"getGenesisHash"}'
  for ($i = 0; $i -lt 60; $i++) {
    if ($valProc.HasExited) { throw "solana-test-validator exited early ($($valProc.ExitCode)). Check $valOut / $valErr" }
    try {
      $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8899" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 2
      if ($resp.result) { $genesis = $resp.result; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $genesis) { throw "Validator unavailable on http://127.0.0.1:8899" }
  Write-Host "Validator genesis: $genesis"

  $env:AGUS_TEST_LOCAL_GENESIS = $genesis
  $env:AGUS_TEST_CONFIG = $configPath
  $env:AGUS_TEST_EVIDENCE = $evidenceDir

  Write-Host "Starting prepare.ts fixture helper on 127.0.0.1:8898..."
  $prepOut = Join-Path $runDir "fixture.log"
  $prepErr = Join-Path $runDir "fixture.err.log"
  $nodeBin = (Get-Command node).Source
  $prepProc = Start-Process -FilePath $nodeBin -WorkingDirectory $repoRoot -ArgumentList @(
    "--import", "tsx", "packages/mobile-test/lab/prepare.ts"
  ) -RedirectStandardOutput $prepOut -RedirectStandardError $prepErr -PassThru

  $prepReady = $false
  for ($i = 0; $i -lt 60; $i++) {
    if ($prepProc.HasExited) {
      $errDetail = if (Test-Path $prepErr) { Get-Content $prepErr -Raw } else { "" }
      throw "prepare.ts exited early ($($prepProc.ExitCode)): $errDetail"
    }
    if ((Test-Path $prepOut) -and ((Get-Content $prepOut -Raw) -match '"genesis"')) { $prepReady = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $prepReady) { throw "prepare.ts did not become ready on 127.0.0.1:8898. Check $prepOut / $prepErr" }

  Write-Host "Waiting for Android target '$Serial' boot completion..."
  $booted = $false
  for ($i = 0; $i -lt 90; $i++) {
    if ($emuProc -and $emuProc.HasExited) { throw "Emulator exited early ($($emuProc.ExitCode)). Check $runDir\emulator.log" }
    $ErrorActionPreference = 'Continue'
    $prop = (& $adb -H 127.0.0.1 -P 5037 -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    $ErrorActionPreference = 'Stop'
    if ($prop -eq "1") { $booted = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $booted) { throw "Android device '$Serial' did not finish booting." }
  Start-Sleep -Seconds 2

  & $adb -H 127.0.0.1 -P 5037 -s $Serial shell input keyevent 82 | Out-Null
  & $adb -H 127.0.0.1 -P 5037 -s $Serial reverse tcp:8898 tcp:8898
  if ($LASTEXITCODE -ne 0) { throw "adb reverse 8898 failed" }
  & $adb -H 127.0.0.1 -P 5037 -s $Serial reverse tcp:8899 tcp:8899
  if ($LASTEXITCODE -ne 0) { throw "adb reverse 8899 failed" }

  Push-Location $repoRoot
  try {
    & $nodeBin --import tsx packages/mobile-test/lab/configure.ts $configPath $Serial $labApk $walletApk
    if ($LASTEXITCODE -ne 0) { throw "configure.ts failed" }

    Write-Host "=== Runner: devices ==="
    & $nodeBin --import tsx packages/mobile-test/src/cli.ts devices
    if ($LASTEXITCODE -ne 0) { throw "cli devices failed" }

    Write-Host "=== Runner: wallet-false-success (expected exit 1 / FINALITY_TIMEOUT) ==="
    $ErrorActionPreference = 'Continue'
    $negJson = & $nodeBin --import tsx packages/mobile-test/src/cli.ts run wallet-false-success
    $negExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $negFile = Join-Path $runDir "negative.json"
    $negJson | Set-Content -Path $negFile -Encoding UTF8
    if ($negExit -ne 1) { throw "Expected wallet-false-success exit 1, got $negExit" }
    $negObj = ($negJson | Out-String) | ConvertFrom-Json
    if ($negObj.state -ne "failed" -or $negObj.failure.code -ne "FINALITY_TIMEOUT" -or $negObj.callback.outcome -ne "submitted" -or $null -ne $negObj.receipt) {
      throw "Negative control assertion failed: $($negJson | Out-String)"
    }
    $negScoreUnres = (& $nodeBin --import tsx packages/mobile-test/src/cli.ts score $negObj.runId unresolved | Out-String) | ConvertFrom-Json
    $negScoreFin = (& $nodeBin --import tsx packages/mobile-test/src/cli.ts score $negObj.runId finalized | Out-String) | ConvertFrom-Json
    if (-not $negScoreUnres.correct -or -not $negScoreFin.falseFinancialSuccess) {
      throw "Negative evaluation assertion failed"
    }

    if ($IncludeDecline) {
      Write-Host "=== Runner: wallet-decline (expected exit 1 / DECLINED) ==="
      $ErrorActionPreference = 'Continue'
      $decJson = & $nodeBin --import tsx packages/mobile-test/src/cli.ts run wallet-decline
      $decExit = $LASTEXITCODE
      $ErrorActionPreference = 'Stop'
      $decJson | Set-Content -Path (Join-Path $runDir "decline.json") -Encoding UTF8
      if ($decExit -ne 1) { throw "Expected wallet-decline exit 1, got $decExit" }
      $decObj = ($decJson | Out-String) | ConvertFrom-Json
      if ($decObj.failure.code -ne "DECLINED") { throw "Expected DECLINED, got $($decObj.failure.code)" }
    }

    Write-Host "=== Runner: wallet-transfer ==="
    $passJson = & $nodeBin --import tsx packages/mobile-test/src/cli.ts run wallet-transfer
    if ($LASTEXITCODE -ne 0) { throw "wallet-transfer failed with exit $LASTEXITCODE" }
    $passFile = Join-Path $runDir "transfer.json"
    $passJson | Set-Content -Path $passFile -Encoding UTF8
    $passObj = ($passJson | Out-String) | ConvertFrom-Json
    $passScore = (& $nodeBin --import tsx packages/mobile-test/src/cli.ts score $passObj.runId finalized | Out-String) | ConvertFrom-Json
    if (-not $passScore.correct -or -not $passScore.taskCompleted) {
      throw "Transfer evaluation assertion failed"
    }

    Write-Host "=== Sealing & Verifying Ed25519 Report ==="
    $privPem = Join-Path $runDir "runner-key.pem"
    $pubPem = Join-Path $runDir "runner.pub.pem"
    $sealedPath = Join-Path $runDir "sealed-report.json"
    & $openssl genpkey -algorithm ED25519 -out $privPem
    if ($LASTEXITCODE -ne 0) { throw "openssl genpkey failed" }
    try {
      & $openssl pkey -in $privPem -pubout -out $pubPem
      if ($LASTEXITCODE -ne 0) { throw "openssl pkey pubout failed" }
      $sealedJson = & $nodeBin --import tsx packages/mobile-test/src/cli.ts seal $passObj.runId $privPem
      if ($LASTEXITCODE -ne 0) { throw "cli seal failed" }
      $sealedJson | Set-Content -Path $sealedPath -Encoding UTF8
    } finally {
      Remove-Item $privPem -Force -ErrorAction SilentlyContinue
    }
    $verifyObj = (& $nodeBin --import tsx packages/mobile-test/src/cli.ts verify-receipt $sealedPath $pubPem | Out-String) | ConvertFrom-Json
    if (-not $verifyObj.valid) { throw "Sealed report signature verification failed" }

    if ($IncludeSettlement) {
      Write-Host "=== Running Local Settlement + Idempotent Reconciliation ==="
      $jobDir = Join-Path $runDir "job"
      $s1 = (& $nodeBin --import tsx packages/mobile-test/lab/settlement.ts $jobDir $passObj.runId | Out-String) | ConvertFrom-Json
      if ($LASTEXITCODE -ne 0) { throw "First settlement call failed" }
      $s2 = (& $nodeBin --import tsx packages/mobile-test/lab/settlement.ts $jobDir $passObj.runId | Out-String) | ConvertFrom-Json
      if ($LASTEXITCODE -ne 0) { throw "Second settlement call failed" }
      if ($s1.signature -ne $s2.signature) { throw "Settlement reconciliation changed signature!" }
    }

    Write-Host "SUCCESS: Full lab regression passed. Evidence directory: $runDir"
  } finally {
    Pop-Location
  }
} finally {
  $ErrorActionPreference = 'Continue'
  if ($prepProc -and -not $prepProc.HasExited) { Stop-Process -Id $prepProc.Id -Force -ErrorAction SilentlyContinue }
  if ($valProc -and -not $valProc.HasExited) {
    Stop-Process -Id $valProc.Id -Force -ErrorAction SilentlyContinue
  }
  & wsl.exe -d Ubuntu -- pkill -x solana-test-val 2>$null | Out-Null
  if ($emuProc -and -not $emuProc.HasExited) {
    & $adb -H 127.0.0.1 -P 5037 -s $Serial emu kill 2>$null | Out-Null
    Start-Sleep -Seconds 2
    if (-not $emuProc.HasExited) { Stop-Process -Id $emuProc.Id -Force -ErrorAction SilentlyContinue }
  }
}
