param([switch]$UseVerifiedWslRelay)
$ErrorActionPreference = 'Stop'
$dataRoot = 'D:\Project\Anvil\.av3-data'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $dataRoot 'runtime'
if (!(Test-Path -LiteralPath (Join-Path $dataRoot 'db-app.json')) -or (Test-Path -LiteralPath $runtime)) { throw 'DEVELOPMENT_RUNTIME_NOT_NEW_OR_DB_MISSING' }
$ca = [Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $dataRoot 'dev-tls/ca.cer'))
$caReceipt = Get-Content -LiteralPath (Join-Path $dataRoot 'dev-tls/receipt.json') -Raw | ConvertFrom-Json
if ($ca.Thumbprint -ne $caReceipt.thumbprint -or $ca.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow) { throw 'DEVELOPMENT_CA_INVALID' }
$store = [Security.Cryptography.X509Certificates.X509Store]::new('Root','CurrentUser')
$store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
try { if ($store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$ca.Thumbprint,$false).Count -ne 1) { throw 'DEVELOPMENT_CA_NOT_TRUSTED' } } finally { $store.Close() }
$listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if (@($listeners | Where-Object Port -eq 3830).Count) { throw 'DEVELOPMENT_PORT_ALREADY_USED' }
$hasDbListener = @($listeners | Where-Object Port -eq 5546).Count -gt 0
$relayPid = $null
if ($hasDbListener) {
  if (!$UseVerifiedWslRelay) { throw 'DEVELOPMENT_PORT_ALREADY_USED' }
  $connections = @(Get-NetTCPConnection -State Listen -LocalPort 5546 -ErrorAction Stop)
  foreach ($connection in $connections) {
    $relay = Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    if ($connection.LocalAddress -ne '127.0.0.1' -or $relay.ProcessName -ne 'wslrelay' -or $relay.Path -ne 'C:\Program Files\WSL\wslrelay.exe') { throw 'VERIFIED_RELAY_OWNER_MISMATCH' }
    $relayPid = $relay.Id
  }
} elseif ($UseVerifiedWslRelay) { throw 'VERIFIED_RELAY_NOT_PRESENT' }
$null = New-Item -ItemType Directory -Path $runtime
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$node = (Get-Command node.exe -ErrorAction Stop).Source
$tunnel = $null
$server = $null
$ready = $false
$oldKey = $env:ANVIL_TLS_KEY
$oldCert = $env:ANVIL_TLS_CERT
$oldDb = $env:ANVIL_DB_CONFIG
$oldAuth = $env:ANVIL_AUTH_CONFIG
try {
  if (!$hasDbListener) {
    $tunnel = Start-Process -FilePath $ssh -ArgumentList @('-N','-L','127.0.0.1:5546:127.0.0.1:5546','-o','ExitOnForwardFailure=yes','-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','WSL-server') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $runtime 'tunnel.err.log')
  }
  $env:ANVIL_TLS_KEY = Join-Path $dataRoot 'dev-tls/server.key.pem'
  $env:ANVIL_TLS_CERT = Join-Path $dataRoot 'dev-tls/server.cert.pem'
  $env:ANVIL_DB_CONFIG = Join-Path $dataRoot 'db-app.json'
  $authRef = Join-Path $dataRoot 'auth.json'
  $env:ANVIL_AUTH_CONFIG = $(if(Test-Path -LiteralPath $authRef){$authRef}else{$null})
  $entry = '"' + (Join-Path $projectRoot 'apps/server/main.ts') + '"'
  $server = Start-Process -FilePath $node -ArgumentList $entry -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'server.out.log') -RedirectStandardError (Join-Path $runtime 'server.err.log')
  $healthy = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (($null -ne $tunnel -and $tunnel.HasExited) -or $server.HasExited) { throw 'OWNED_DEVELOPMENT_PROCESS_EXITED' }
    $probe = & $node (Join-Path $PSScriptRoot 'check-development-https.ts')
    if ($LASTEXITCODE -eq 0) { $healthy = $true; break }
    if ($LASTEXITCODE -ne 2) { throw 'DEVELOPMENT_TLS_OR_HEALTH_VALIDATION_FAILED' }
    Start-Sleep -Milliseconds 250
  }
  if (!$healthy) { throw 'DEVELOPMENT_HTTPS_NOT_READY' }
  $actualBranch = (& git -C $projectRoot branch --show-current).Trim()
  if (!$actualBranch) { $actualBranch = 'DETACHED' }
  $sourceChanges = @(& git -C $projectRoot status --porcelain --untracked-files=all -- apps contracts db scripts tests package.json package-lock.json tsconfig.base.json playwright.config.ts)
  $receipt = [ordered]@{ kind='ANVIL_V3_OWNED_DEVELOPMENT_RUNTIME'; branch=$actualBranch; commit=(& git -C $projectRoot rev-parse HEAD).Trim(); sourceState=$(if($sourceChanges.Count){'LOCAL_UNCOMMITTED'}else{'COMMITTED_SOURCE'}); url='https://localhost:3830/'; scope='process-only'; connectionMode=$(if($hasDbListener){'verified-wsl-relay'}else{'owned-ssh-tunnel'}); relayPid=$relayPid; tunnelPid=$(if($tunnel){$tunnel.Id}else{$null}); tunnelStartedAt=$(if($tunnel){$tunnel.StartTime.ToUniversalTime().ToString('o')}else{$null}); serverPid=$server.Id; serverStartedAt=$server.StartTime.ToUniversalTime().ToString('o'); lifetime='후속 개발 보존·프로젝트 사용 종료 때 정확 소유 process만 종료·공유 relay 종료 금지' }
  [IO.File]::WriteAllText((Join-Path $runtime 'receipt.json'),($receipt|ConvertTo-Json -Depth 3))
  $ready = $true
  $receipt|ConvertTo-Json -Depth 3
} finally {
  $env:ANVIL_TLS_KEY = $oldKey
  $env:ANVIL_TLS_CERT = $oldCert
  $env:ANVIL_DB_CONFIG = $oldDb
  $env:ANVIL_AUTH_CONFIG = $oldAuth
  if (!$ready) {
    foreach ($owned in @($server,$tunnel)) {
      if ($null -ne $owned -and !$owned.HasExited) {
        $same = Get-Process -Id $owned.Id -ErrorAction SilentlyContinue
        if ($same -and $same.StartTime -eq $owned.StartTime) { Stop-Process -Id $same.Id -ErrorAction Stop }
      }
    }
  }
}
