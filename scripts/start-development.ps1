param([switch]$UseVerifiedWslRelay,[switch]$Fn08Runtime,[switch]$RecoveryTls)
$ErrorActionPreference = 'Stop'
function Get-DevelopmentTlsDirectory([string]$Root,[bool]$Recovery) {
  if ([IO.Path]::GetFullPath($Root) -ne 'D:\Project\Anvil\.av3-data') { throw 'DEVELOPMENT_TLS_ROOT_INVALID' }
  return Join-Path 'D:\Project\Anvil\.av3-data' $(if($Recovery){'dev-tls-20261025-01'}else{'dev-tls'})
}
function Assert-DevelopmentTlsExecution([bool]$Recovery) {
  if ($Recovery) { throw 'DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED' }
}
function Get-DevelopmentRuntimePath([bool]$Fn08,[bool]$UseRelay,[bool]$Recovery=$false) {
  if ($Recovery -and ($Fn08 -or $UseRelay)) { throw 'DEVELOPMENT_RECOVERY_MODE_CONFLICT' }
  if ($Recovery) { return 'D:\Project\Anvil\.av3-data\n4-recovery-01\runtime' }
  if ($Fn08 -and !$UseRelay) { throw 'FN08_VERIFIED_RELAY_REQUIRED' }
  return Join-Path 'D:\Project\Anvil\.av3-data' $(if($Fn08){'runtime-fn08-20261017'}else{'runtime'})
}
$dataRoot = 'D:\Project\Anvil\.av3-data'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Get-DevelopmentRuntimePath ([bool]$Fn08Runtime) ([bool]$UseVerifiedWslRelay) ([bool]$RecoveryTls)
$tlsDirectory = Get-DevelopmentTlsDirectory $dataRoot ([bool]$RecoveryTls)
# cold-start 후보는 보호 선행 검증 전 파일·신뢰·port·process 획득을 하지 않는다.
Assert-DevelopmentTlsExecution ([bool]$RecoveryTls)
if ($Fn08Runtime) {
  foreach ($path in @($dataRoot,$tlsDirectory,(Join-Path $dataRoot 'auth.json'),(Join-Path $dataRoot 'db-app.json'),(Join-Path $tlsDirectory 'server.key.pem'),(Join-Path $tlsDirectory 'server.cert.pem'))) {
    if ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'FN08_PROTECTED_REFERENCE_LINK' }
  }
  if ((& git -C $projectRoot branch --show-current).Trim() -ne 'codex/av3-stage-b' -or @(& git -C $projectRoot status --porcelain --untracked-files=all).Count) { throw 'FN08_COMMITTED_SOURCE_REQUIRED' }
}
if (!(Test-Path -LiteralPath (Join-Path $dataRoot 'db-app.json')) -or (Test-Path -LiteralPath $runtime)) { throw 'DEVELOPMENT_RUNTIME_NOT_NEW_OR_DB_MISSING' }
$ca = [Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $tlsDirectory 'ca.cer'))
$caReceipt = Get-Content -LiteralPath (Join-Path $tlsDirectory 'receipt.json') -Raw | ConvertFrom-Json
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
    if ($Fn08Runtime -and ($relay.Id -ne 26052 -or (Get-CimInstance Win32_Process -Filter 'ProcessId=26052' -ErrorAction Stop).CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ') -ne '2026-10-15T12:28:17.5262970Z')) { throw 'FN08_ORIGINAL_RELAY_MISMATCH' }
    $relayPid = $relay.Id
  }
} elseif ($UseVerifiedWslRelay) { throw 'VERIFIED_RELAY_NOT_PRESENT' }
$null = New-Item -ItemType Directory -Path $runtime
if ($Fn08Runtime) {
  $acl = Get-Acl -LiteralPath $runtime
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  if ($acl.Owner -ne $identity.Name) { throw 'FN08_RUNTIME_OWNER_MISMATCH' }
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }
  foreach ($sid in @($identity.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')) }
  Set-Acl -LiteralPath $runtime -AclObject $acl
}
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$node = (Get-Command node.exe -ErrorAction Stop).Source
if ($Fn08Runtime -and ($node -ne 'C:\Program Files\nodejs\node.exe' -or (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -ne '9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE' -or $env:ANVIL_ARTIFACT_ROOT)) { throw 'FN08_RUNTIME_EXECUTABLE_OR_STORAGE_MISMATCH' }
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
  $authRef = Join-Path $dataRoot 'auth.json'
  $childEnvironment = @{ANVIL_TLS_KEY=(Join-Path $tlsDirectory 'server.key.pem');ANVIL_TLS_CERT=(Join-Path $tlsDirectory 'server.cert.pem');ANVIL_DB_CONFIG=(Join-Path $dataRoot 'db-app.json');ANVIL_AUTH_CONFIG=$(if(Test-Path -LiteralPath $authRef){$authRef}else{$null});ANVIL_HOST='127.0.0.1';ANVIL_PORT='3830'}
  if (!$Fn08Runtime) {
    $env:ANVIL_TLS_KEY = $childEnvironment.ANVIL_TLS_KEY
    $env:ANVIL_TLS_CERT = $childEnvironment.ANVIL_TLS_CERT
    $env:ANVIL_DB_CONFIG = $childEnvironment.ANVIL_DB_CONFIG
    $env:ANVIL_AUTH_CONFIG = $childEnvironment.ANVIL_AUTH_CONFIG
  }
  $entry = '"' + (Join-Path $projectRoot 'apps/server/main.ts') + '"'
  $startOptions = @{FilePath=$node;ArgumentList=$entry;WorkingDirectory=$projectRoot;WindowStyle='Hidden';PassThru=$true;RedirectStandardOutput=(Join-Path $runtime 'server.out.log');RedirectStandardError=(Join-Path $runtime 'server.err.log')}
  if ($Fn08Runtime) { $startOptions.Environment=$childEnvironment }
  $server = Start-Process @startOptions
  $healthy = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (($null -ne $tunnel -and $tunnel.HasExited) -or $server.HasExited) { throw 'OWNED_DEVELOPMENT_PROCESS_EXITED' }
    $probeArguments = @((Join-Path $PSScriptRoot 'check-development-https.ts'))
    if ($RecoveryTls) { $probeArguments += '--recovery-tls' }
    $probe = & $node @probeArguments
    if ($LASTEXITCODE -eq 0) { $healthy = $true; break }
    if ($LASTEXITCODE -ne 2) { throw 'DEVELOPMENT_TLS_OR_HEALTH_VALIDATION_FAILED' }
    Start-Sleep -Milliseconds 250
  }
  if (!$healthy) { throw 'DEVELOPMENT_HTTPS_NOT_READY' }
  $actualBranch = (& git -C $projectRoot branch --show-current).Trim()
  if (!$actualBranch) { $actualBranch = 'DETACHED' }
  $sourceChanges = @(& git -C $projectRoot status --porcelain --untracked-files=all -- apps contracts db scripts tests package.json package-lock.json tsconfig.base.json playwright.config.ts)
  $receipt = [ordered]@{ kind='ANVIL_V3_OWNED_DEVELOPMENT_RUNTIME'; branch=$actualBranch; commit=(& git -C $projectRoot rev-parse HEAD).Trim(); sourceState=$(if($sourceChanges.Count){'LOCAL_UNCOMMITTED'}else{'COMMITTED_SOURCE'}); url='https://localhost:3830/'; scope='process-only'; connectionMode=$(if($hasDbListener){'verified-wsl-relay'}else{'owned-ssh-tunnel'}); relayPid=$relayPid; tunnelPid=$(if($tunnel){$tunnel.Id}else{$null}); tunnelStartedAt=$(if($tunnel){$tunnel.StartTime.ToUniversalTime().ToString('o')}else{$null}); serverPid=$server.Id; serverStartedAt=$server.StartTime.ToUniversalTime().ToString('o'); lifetime='후속 개발 보존·프로젝트 사용 종료 때 정확 소유 process만 종료·공유 relay 종료 금지' }
  if ($Fn08Runtime) { $receipt.serverExecutable=$node; $receipt.serverExecutableHash=(Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash; $receipt.runtimeTransition='AV3-PMO-WINDOWS-RUNTIME-01'; $receipt.host='127.0.0.1'; $receipt.port=3830; $receipt.relayStartedAt=$relay.StartTime.ToUniversalTime().ToString('o') }
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
        if ($same -and $same.StartTime -eq $owned.StartTime -and (!$Fn08Runtime -or ($owned.Id -eq $server.Id -and $same.Path -eq $node))) { Stop-Process -Id $same.Id -ErrorAction Stop }
      }
    }
  }
}
