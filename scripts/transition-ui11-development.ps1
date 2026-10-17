[CmdletBinding()]param([switch]$Plan,[switch]$Apply)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'ui11-runtime-flow.ps1')
if($Plan -and !$Apply){@{mode='PLAN';port=3830;originalPid=23836;serviceChanges=0;secretReads=0}|ConvertTo-Json -Compress;exit 0}
try{
 if(!$Apply -or $Plan -or !$IsWindows){throw 'UI11_RUNTIME_BINDING_INVALID'}
 $binding=Read-Ui11RuntimeBinding @{approval=$env:ANVIL_UI11_RUNTIME_APPROVAL;commit=$env:ANVIL_UI11_RUNTIME_COMMIT;scriptHash=$env:ANVIL_UI11_RUNTIME_SCRIPT_HASH;flowHash=$env:ANVIL_UI11_RUNTIME_FLOW_HASH;issuedAt=$env:ANVIL_UI11_RUNTIME_ISSUED_AT;expiresAt=$env:ANVIL_UI11_RUNTIME_EXPIRES_AT;runId=$env:ANVIL_UI11_RUNTIME_RUN_ID} ([datetimeoffset]::UtcNow)
}catch{@{status='FAIL_BEFORE_STOP';failure='UI11_RUNTIME_BINDING_INVALID';originalStopAttempted=$false}|ConvertTo-Json -Compress;exit 1}
$sourceRoot=Split-Path -Parent $PSScriptRoot
$operatorPath=$PSCommandPath
$flowPath=Join-Path $PSScriptRoot 'ui11-runtime-flow.ps1'
$dist=Join-Path $sourceRoot 'apps/web/dist'
$candidate='D:\tmp\anvil-v3-stage-b\candidate-ui11-n4-02'
$runtime='D:\Project\Anvil\.av3-data\runtime-ui11-n4-01'
$browserRoot='D:\tmp\anvil-v3-stage-b\browser\ui11-n4-served-01'
$dataRoot='D:\Project\Anvil\.av3-data'
$node='C:\Program Files\nodejs\node.exe'
$nodeHash='9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE'
$rollbackCommit='9bade63e3d3959a16f015ff89bc0c6a0baddaa1b'
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$probePath=Join-Path $PSScriptRoot 'ui11-runtime-probe.mjs'
$probeHash=$env:ANVIL_UI11_RUNTIME_PROBE_HASH
$probeSource=$null
$originalHashes=@{'index.html'='39BD2923BF898FA1D23AAC96385CDC890EA7C55167D5AB864FB897BF455BC9F5';'assets/index-DCxasc0L.js'='150B3D211B349A4464126DD079E9071FB11A2CEFA7C0F9AD82E5680D2ACF1C69';'assets/index-BkhWFJOr.js'='D89EB3520EF784E54FAA74D1EB4D09A6533C1322EDA079B125C402270656995C';'assets/index-C3a7Hrx0.css'='034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56'}
$candidateHashes=@{'index.html'='1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216';'assets/index-Csxr80L5.js'='923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9';'assets/index-C3a7Hrx0.css'='034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56'}
$protected=@{'auth.json'='FA18CA22A06BB8C884675CD93DB0DB83758F8CAFA4E7C3FDBD7E5A1E864B95A7';'db-app.json'='089FF1AC3C07788FEF69C0E78CFE09BFCA3B5F59488BE801D523567048142139';'dev-tls/ca.cer'='B6BBBD6386EB8D6972E15678459858ACA2F4D2FE78B700E1F5CBC965A2727744';'dev-tls/ca.cert.pem'='7657BFC0F623571933D4EF4659EB254B761C0522A93F3A13036DB7AA98411CE3';'dev-tls/ca.key.pem'='D2691A089D9DF4BC4E0AD42A0FF070565EEF1388AD519E3F34D8444B9E9E35BE';'dev-tls/receipt.json'='B4B98FB4E6FF9B83F874B5DF615AFAE8C065092661B9B39F43B3B0B538344CD5';'dev-tls/server.cert.pem'='62AC1DC7E9575A9F497CAEAA709686A697240126B44B4937CFE257C11976A5BA';'dev-tls/server.key.pem'='E8B1E380851DBD6BC713C825AD413A94AF81DFC954B211EB48CDCC193E22EC4A';'runtime-fn08-20261017/receipt.json'='38DFAB5AE73B92B9770AAE82B132810999B985008B06425C890E8C2F77ACD701';'runtime-ui06-served-01/receipt.json'='FDC1467E0CB838071F4B1AA547552D6A61ED76BEBCC79347BCFFA2E2C57E16D7'}
$state=@{Phase='INIT';Status='RUNNING';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;RollbackConfirmed=$false;Failure=$null;RollbackFailure=$null;RuntimeCreated=$false;Child=$null;ChildProof=$null;RollbackChild=$null;RollbackProof=$null;DbBefore=$null;DbAfter=$null;ProbeFailure=$null;RunId=$binding.runId;Commit=$binding.commit}
function Assert-Ui11Window([int]$Reserve=0){if([datetimeoffset]::UtcNow.AddSeconds($Reserve) -ge $binding.expiresAt){throw 'UI11_RUNTIME_EXPIRED'}}
function Assert-Ui11NoLink([string]$Path){
 $current=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
 while($current){if(($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $current.LinkType){throw 'UI11_PATH_LINK'};if($current -is [IO.FileInfo]){$current=$current.Directory}else{$current=$current.Parent}}
}
function Assert-Ui11Hash([string]$Path,[string]$Hash){Assert-Ui11NoLink $Path;if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Hash){throw 'UI11_FILE_HASH_MISMATCH'}}
function Invoke-Ui11Tool([string]$File,[string[]]$ToolArguments,[int]$TimeoutMs=10000){
 Assert-Ui11Window
 $info=[Diagnostics.ProcessStartInfo]::new($File)
 $info.WorkingDirectory=$sourceRoot;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($part in $ToolArguments){$info.ArgumentList.Add($part)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$info
 try{
  if(!$process.Start()){throw 'UI11_TOOL_START_FAILED'}
  $out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
  if(!$process.WaitForExit($TimeoutMs)){try{$process.Kill($true);$null=$process.WaitForExit(1000)}catch{};throw 'UI11_TOOL_TIMEOUT'}
  if(!$out.Wait(1000) -or !$err.Wait(1000)){throw 'UI11_TOOL_OUTPUT_TIMEOUT'}
  return @{code=$process.ExitCode;output=$out.Result.Trim()}
 }finally{$process.Dispose()}
}
function Invoke-Ui11Git([string[]]$GitArguments){
 $result=Invoke-Ui11Tool (Get-Command git.exe -ErrorAction Stop).Source $GitArguments
 if($result.code -ne 0){throw 'UI11_GIT_STEP_FAILED'}
 return $result.output
}
function Read-Ui11Cim([int]$ProcessId){
 $item=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
 if(!$item){throw 'UI11_PROCESS_MISSING'}
 $sid=Invoke-CimMethod -InputObject $item -MethodName GetOwnerSid -ErrorAction Stop
 if($sid.ReturnValue -ne 0 -or $sid.Sid -ne $ownerSid){throw 'UI11_PROCESS_OWNER_MISMATCH'}
 return $item
}
function Assert-Ui11Original {
 $item=Read-Ui11Cim 23836
 if($item.ExecutablePath -ne $node -or $item.CreationDate.ToUniversalTime().Ticks -ne ([datetimeoffset]'2026-10-17T10:02:29.4487470Z').UtcTicks -or !$item.CommandLine.Contains(('"'+(Join-Path $sourceRoot 'apps/server/main.ts')+'"'))){throw 'UI11_ORIGINAL_IDENTITY_MISMATCH'}
 $listeners=@(Get-NetTCPConnection -LocalPort 3830 -State Listen -ErrorAction Stop)
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].OwningProcess -ne 23836){throw 'UI11_ORIGINAL_LISTENER_MISMATCH'}
 return $item
}
function Assert-Ui11Protected {
 foreach($ref in $protected.Keys){Assert-Ui11Hash (Join-Path $dataRoot $ref) $protected[$ref]}
 $relay=Read-Ui11Cim 26052
 if($relay.ExecutablePath -ne 'C:\Program Files\WSL\wslrelay.exe' -or $relay.CreationDate.ToUniversalTime().Ticks -ne ([datetimeoffset]'2026-10-15T12:28:17.5262970Z').UtcTicks){throw 'UI11_RELAY_IDENTITY_MISMATCH'}
}
function Read-Ui11Wsl {
 Assert-Ui11Window
 $js='const cp=require("node:child_process"),x=(p,a)=>cp.execFileSync(p,a,{encoding:"utf8",timeout:5000,stdio:["ignore","pipe","pipe"]}).trim(),i=JSON.parse(x("/usr/bin/docker",["--host","unix:///var/run/docker.sock","inspect","anvil-v3-development-pg"]))[0];console.log(JSON.stringify({head:x("git",["rev-parse","HEAD"]),clean:x("git",["status","--porcelain"])==="",id:i.Id,image:i.Image,startedAt:i.State.StartedAt,running:i.State.Running,restarts:i.RestartCount}));'
 $command="cd /home/daon/deploy/anvil-v3 && node -e '"+$js+"'"
 $out=Invoke-Ui11Tool (Get-Command ssh.exe -ErrorAction Stop).Source @('-o','BatchMode=yes','-o','ConnectTimeout=5','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','WSL-server',$command) 20000
 if($out.code -ne 0){throw 'UI11_WSL_GATE_FAILED'}
 try{$value=$out.output|ConvertFrom-Json -DateKind String -ErrorAction Stop}catch{throw 'UI11_WSL_GATE_INVALID'}
 if($value.head -ne $binding.commit -or !$value.clean -or $value.id -ne 'e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba' -or $value.image -ne 'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f' -or $value.startedAt -ne '2026-10-15T18:53:33.435483583Z' -or !$value.running -or $value.restarts -ne 0){throw 'UI11_WSL_BASELINE_DRIFT'}
 return $value
}
function Invoke-Ui11Probe([string]$ProbeMode){
 Assert-Ui11Window
 $state.ProbeFailure=$null
 $out=Invoke-Ui11Tool $node @('--input-type=module','-e',$state.ProbeSource,'--',$ProbeMode) 35000
 try{$value=$out.output|ConvertFrom-Json -ErrorAction Stop}catch{throw 'UI11_PROBE_OUTPUT_INVALID'}
 if($out.code -ne 0 -or $value.status -ne 'PASS'){$state.ProbeFailure=@{mode=$ProbeMode;exitCode=$out.code;failure=$value.failure;code=$value.code};throw 'UI11_PROBE_FAILED'}
 return $value
}
function Write-Ui11Receipt {
 if(!$state.RuntimeCreated){return}
 Assert-Ui11NoLink $runtime
 if((Get-Acl -LiteralPath $runtime).Owner -ne $owner){throw 'UI11_RECEIPT_OWNER_MISMATCH'}
 $value=[ordered]@{kind='ANVIL_UI11_N4_SERVICE_TRANSITION';status=$state.Status;phase=$state.Phase;runId=$binding.runId;commit=$binding.commit;issuedAt=$binding.issuedAt.ToString('o');expiresAt=$binding.expiresAt.ToString('o');originalPid=23836;originalStopped=$state.OriginalStopped;newProcess=$state.ChildProof;rollbackProcess=$state.RollbackProof;rollbackSource=$(if($state.RollbackProof){$rollbackCommit}else{$null});rollbackConfirmed=$state.RollbackConfirmed;failure=$state.Failure;rollbackFailure=$state.RollbackFailure;receiptFailure=[bool]$state.ReceiptFailure;probeFailure=$state.ProbeFailure;dbBefore=$state.DbBefore;dbAfter=$state.DbAfter;wsl=$state.WslProof;http=$state.HttpProof;browser=$state.BrowserProof;environment='ORIGINAL_SIX_NO_ARTIFACT_ROOT';sourceFileAccess=0;actualAgentCalls=0}
 $path=Join-Path $runtime 'receipt.json';$stage=Join-Path $runtime 'receipt.staged.json'
 foreach($ref in @($path,$stage)){if(Test-Path -LiteralPath $ref){Assert-Ui11NoLink $ref}}
 [IO.File]::WriteAllText($stage,($value|ConvertTo-Json -Depth 10))
 [IO.File]::Move($stage,$path,$true)
}
function Assert-Ui11RuntimeOwner {
 Assert-Ui11NoLink $runtime
 if((Get-Acl -LiteralPath $runtime).Owner -ne $owner){throw 'UI11_RUNTIME_OWNER_MISMATCH'}
}
function Assert-Ui11ActiveNode([bool]$Rollback){
 $process=$(if($Rollback){$state.RollbackChild}else{$state.Child})
 $proof=$(if($Rollback){$state.RollbackProof}else{$state.ChildProof})
 if(!$process -or !$proof -or $process.HasExited){throw 'UI11_ACTIVE_SERVICE_PROOF_INVALID'}
 $item=Read-Ui11Cim $proof.pid
 if(!$item.CommandLine.Contains('--title='+$proof.title) -or !$item.CommandLine.Contains(('"'+(Join-Path $sourceRoot 'apps/server/main.ts')+'"'))){throw 'UI11_ACTIVE_SERVICE_PROOF_INVALID'}
 Assert-Ui11ServiceProof @{alive=(!$process.HasExited);pid=$item.ProcessId;exe=$item.ExecutablePath;createdUtc=$item.CreationDate.ToUniversalTime().ToString('o');title=$proof.title;listeners=@(Get-NetTCPConnection -LocalPort 3830 -State Listen -ErrorAction Stop)} $proof
}
function Start-Ui11OwnedNode([bool]$Rollback){
 Assert-Ui11Window
 Assert-Ui11RuntimeOwner
 if(@(Get-NetTCPConnection -LocalPort 3830 -State Listen -ErrorAction SilentlyContinue).Count){throw 'UI11_PORT_NOT_EMPTY'}
 $slot=$(if($Rollback){'rollback'}else{'new'})
 $title='anvil-ui11-n4-'+$binding.runId+'-'+$slot
 $state.ActiveSlot=$slot
 $childEnv=Get-Ui11ChildEnvironment ([Environment]::GetEnvironmentVariables()) $dataRoot
 $prefix=$(if($Rollback){'rollback'}else{'server'})
 $argumentLine=$(if($Rollback){$state.ArgumentsRollback}else{$state.ArgumentsNew})
 if(!$argumentLine){throw 'UI11_NODE_ARGUMENT_INVALID'}
 $process=Start-Process -FilePath $node -ArgumentList $argumentLine -WorkingDirectory $sourceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime ($prefix+'.out.log')) -RedirectStandardError (Join-Path $runtime ($prefix+'.err.log')) -Environment $childEnv
 if($Rollback){$state.RollbackChild=$process}else{$state.Child=$process}
 $null=$process.Handle
 if($process.HasExited){throw 'UI11_CHILD_EXITED'}
 $item=Read-Ui11Cim $process.Id
 if($item.ExecutablePath -ne $node -or !$item.CommandLine.Contains('--title='+$title) -or !$item.CommandLine.Contains(('"'+(Join-Path $sourceRoot 'apps/server/main.ts')+'"'))){throw 'UI11_CHILD_IDENTITY_MISMATCH'}
 $proof=@{pid=$process.Id;exe=$item.ExecutablePath;createdUtc=$item.CreationDate.ToUniversalTime().ToString('o');title=$title}
 if($Rollback){$state.RollbackProof=$proof}else{$state.ChildProof=$proof}
 try{Write-Ui11Receipt}catch{$state.ReceiptFailure=$true;if(!$Rollback){throw}}
}
function Stop-Ui11NewNode {
 $process=$state.Child;$proof=$state.ChildProof
 if(!$process){throw 'UI11_CHILD_OWNERSHIP_UNCONFIRMED'}
 if($process.HasExited){return}
 if(!$proof){throw 'UI11_CHILD_OWNERSHIP_UNCONFIRMED'}
 $item=Read-Ui11Cim $proof.pid
 if($item.ExecutablePath -ne $proof.exe -or $item.CreationDate.ToUniversalTime().ToString('o') -ne $proof.createdUtc -or !$item.CommandLine.Contains('--title='+$proof.title)){throw 'UI11_CHILD_OWNERSHIP_UNCONFIRMED'}
 $process.Kill()
 if(!$process.WaitForExit(5000)){throw 'UI11_CHILD_STOP_UNCONFIRMED'}
}
$effects=@{}
$effects.Receipt={param($s)Write-Ui11Receipt}
$effects.Prepare={param($s)
 Assert-Ui11Window 180
 $s.ArgumentsNew=Get-Ui11NodeArgumentLine $binding.runId 'new' (Join-Path $sourceRoot 'apps/server/main.ts')
 $s.ArgumentsRollback=Get-Ui11NodeArgumentLine $binding.runId 'rollback' (Join-Path $sourceRoot 'apps/server/main.ts')
 Assert-Ui11NoLink $sourceRoot;Assert-Ui11NoLink $dataRoot
 if($env:ANVIL_ARTIFACT_ROOT -or $env:NODE_OPTIONS -or $env:NODE_PATH -or $env:NODE_TLS_REJECT_UNAUTHORIZED){throw 'UI11_PARENT_OVERRIDE_PRESENT'}
 if((Invoke-Ui11Git @('rev-parse','HEAD')) -ne $binding.commit -or (Invoke-Ui11Git @('branch','--show-current')) -ne 'codex/av3-stage-b' -or (Invoke-Ui11Git @('status','--porcelain')) -or (Invoke-Ui11Git @('remote','get-url','development')) -ne 'git@github-sinsan-develop:sinsan-develop/Anvil.git'){throw 'UI11_SOURCE_GIT_INVALID'}
 $remote=Invoke-Ui11Git @('ls-remote','development','refs/heads/codex/av3-stage-b')
 if(($remote -split '\s+')[0] -ne $binding.commit){throw 'UI11_PRIVATE_SHA_MISMATCH'}
 Assert-Ui11Hash $operatorPath $binding.scriptHash
 Assert-Ui11Hash $flowPath $binding.flowHash
 if($probeHash -notmatch '^[0-9A-Fa-f]{64}$'){throw 'UI11_PROBE_HASH_REQUIRED'}
 Assert-Ui11Hash $probePath $probeHash
 $s.ProbeSource=[IO.File]::ReadAllText($probePath)
 $env:ANVIL_UI11_RUNTIME_INLINE='1'
 Assert-Ui11Hash $node $nodeHash
 Assert-Ui11Protected
 $null=Assert-Ui11Original
 foreach($ref in $originalHashes.Keys){Assert-Ui11Hash (Join-Path $dist $ref) $originalHashes[$ref]}
 foreach($ref in $candidateHashes.Keys){Assert-Ui11Hash (Join-Path $candidate $ref) $candidateHashes[$ref]}
 if(@(Get-ChildItem -LiteralPath $candidate -File -Recurse).Count -ne 3){throw 'UI11_CANDIDATE_LIST_INVALID'}
 foreach($name in @('index.ui11-n4-original.html','index.ui11-n4-staged.html','index.ui11-n4-failed.html')){if(Test-Path -LiteralPath (Join-Path $dist $name)){throw 'UI11_STATIC_STAGING_EXISTS'}}
 foreach($path in @($runtime,$browserRoot)){if(Test-Path -LiteralPath $path){throw 'UI11_NEW_RESOURCE_ALREADY_EXISTS'};Assert-Ui11NoLink (Split-Path -Parent $path)}
 if(@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |Where-Object {$_.CommandLine -and $_.CommandLine.Contains('anvil-ui11-n4-'+$binding.runId)}).Count){throw 'UI11_RUN_ID_ALREADY_ACTIVE'}
 $ca=[Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $dataRoot 'dev-tls/ca.cer'))
 if($ca.Thumbprint -ne '498348218A4015B341A90B10FF4FE176987D4424' -or $ca.NotAfter.ToUniversalTime() -le [datetime]::UtcNow){throw 'UI11_CA_INVALID'}
 $store=[Security.Cryptography.X509Certificates.X509Store]::new('Root','CurrentUser');$store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
 try{if($store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,$ca.Thumbprint,$false).Count -ne 1){throw 'UI11_CA_NOT_TRUSTED'}}finally{$store.Close()}
 $s.WslProof=Read-Ui11Wsl
 $s.DbBefore=Invoke-Ui11Probe '--db'
 $null=Invoke-Ui11Probe '--http-original'
 Assert-Ui11Window 120
 $null=New-Item -ItemType Directory -Path $runtime
 $s.RuntimeCreated=$true
 $acl=Get-Acl -LiteralPath $runtime
 if($acl.Owner -ne $owner){throw 'UI11_NEW_RUNTIME_OWNER_INVALID'}
 $acl.SetAccessRuleProtection($true,$false)
 foreach($rule in @($acl.Access)){$null=$acl.RemoveAccessRuleSpecific($rule)}
 foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 Set-Acl -LiteralPath $runtime -AclObject $acl
 $null=New-Item -ItemType Directory -Path (Join-Path $browserRoot 'profile')
 $js=Join-Path $dist 'assets/index-Csxr80L5.js'
 if(Test-Path -LiteralPath $js){Assert-Ui11Hash $js $candidateHashes['assets/index-Csxr80L5.js']}else{[IO.File]::Copy((Join-Path $candidate 'assets/index-Csxr80L5.js'),$js,$false)}
 [IO.File]::Copy((Join-Path $candidate 'index.html'),(Join-Path $dist 'index.ui11-n4-staged.html'),$false)
 Write-Ui11Receipt
}
$effects.StopOriginal={param($s)
 Assert-Ui11Window 300
 $null=Assert-Ui11Original
 $process=Get-Process -Id 23836 -ErrorAction Stop;$null=$process.Handle
 $null=Assert-Ui11Original
 $process.Kill()
 if(!$process.WaitForExit(5000)){throw 'UI11_ORIGINAL_STOP_UNCONFIRMED'}
}
$effects.Publish={param($s)Assert-Ui11Window;Set-Ui11AtomicIndex (Join-Path $dist 'index.ui11-n4-staged.html') (Join-Path $dist 'index.html') (Join-Path $dist 'index.ui11-n4-original.html') $candidateHashes['index.html'] $originalHashes['index.html']}
$effects.StartNew={param($s)Start-Ui11OwnedNode $false}
$effects.VerifyNew={param($s)
 $healthy=$false
 for($tryIndex=0;$tryIndex -lt 10;$tryIndex++){try{$s.HttpProof=Invoke-Ui11Probe '--http-new';$healthy=$true;break}catch{if($s.Child.HasExited){throw 'UI11_CHILD_EXITED'};if($s.ProbeFailure.failure -ne 'UI11_HTTP_CONNECTION_FAILED'){throw};Start-Sleep -Milliseconds 200}}
 if(!$healthy){throw 'UI11_RUNTIME_HTTP_NOT_READY'}
 $s.BrowserProof=Invoke-Ui11Probe '--browser'
 $s.DbAfter=Invoke-Ui11Probe '--db'
 if($s.DbAfter.hash -ne $s.DbBefore.hash){throw 'UI11_DB_DATA_DRIFT'}
 Assert-Ui11Protected;$s.WslProof=Read-Ui11Wsl
 Assert-Ui11ActiveNode $false
}
$effects.StopNew={param($s)Stop-Ui11NewNode}
$effects.Restore={param($s)
 Assert-Ui11Window
 $index=Join-Path $dist 'index.html';$hash=(Get-FileHash -LiteralPath $index -Algorithm SHA256).Hash
 if($hash -eq $candidateHashes['index.html']){
  Assert-Ui11Hash (Join-Path $dist 'index.ui11-n4-original.html') $originalHashes['index.html']
  [IO.File]::Copy((Join-Path $dist 'index.ui11-n4-original.html'),(Join-Path $dist 'index.ui11-n4-staged.html'),$false)
  Set-Ui11AtomicIndex (Join-Path $dist 'index.ui11-n4-staged.html') $index (Join-Path $dist 'index.ui11-n4-failed.html') $originalHashes['index.html'] $candidateHashes['index.html']
 }elseif($hash -ne $originalHashes['index.html']){throw 'UI11_ROLLBACK_INDEX_UNCONFIRMED'}
 Assert-Ui11Protected
 if((Invoke-Ui11Git @('status','--porcelain'))){throw 'UI11_ROLLBACK_DIRTY_SOURCE'}
 $null=Invoke-Ui11Git @('checkout','--detach',$rollbackCommit)
 if((Invoke-Ui11Git @('rev-parse','HEAD')) -ne $rollbackCommit){throw 'UI11_ROLLBACK_GIT_UNCONFIRMED'}
}
$effects.StartRollback={param($s)Start-Ui11OwnedNode $true}
$effects.VerifyRollback={param($s)
 $healthy=$false
 for($tryIndex=0;$tryIndex -lt 10;$tryIndex++){try{$s.HttpProof=Invoke-Ui11Probe '--http-old';$healthy=$true;break}catch{if($s.RollbackChild.HasExited){throw 'UI11_ROLLBACK_CHILD_EXITED'};if($s.ProbeFailure.failure -ne 'UI11_HTTP_CONNECTION_FAILED'){throw};Start-Sleep -Milliseconds 200}}
 if(!$healthy){throw 'UI11_ROLLBACK_HTTP_UNCONFIRMED'}
 $s.DbAfter=Invoke-Ui11Probe '--db'
 if($s.DbAfter.hash -ne $s.DbBefore.hash){throw 'UI11_ROLLBACK_DB_DATA_DRIFT'}
 Assert-Ui11Protected;$s.WslProof=Read-Ui11Wsl
 Assert-Ui11ActiveNode $true
}
$oldInline=$env:ANVIL_UI11_RUNTIME_INLINE
Push-Location -LiteralPath $sourceRoot
try{$null=Invoke-Ui11RuntimeFlow $state $effects}
finally{$env:ANVIL_UI11_RUNTIME_INLINE=$oldInline;Pop-Location}
$result=@{status=$state.Status;phase=$state.Phase;failure=$state.Failure;rollbackFailure=$state.RollbackFailure;receiptFailure=[bool]$state.ReceiptFailure;rollbackConfirmed=$state.RollbackConfirmed;originalStopAttempted=$state.OriginalStopAttempted;originalStopped=$state.OriginalStopped;newProcess=$state.ChildProof;rollbackProcess=$state.RollbackProof;commit=$binding.commit;runId=$binding.runId;receipt=$(if($state.RuntimeCreated){Join-Path $runtime 'receipt.json'}else{$null});probeFailure=$state.ProbeFailure}
$result|ConvertTo-Json -Depth 6 -Compress
if($state.Status -ne 'PASS'){exit 1}
