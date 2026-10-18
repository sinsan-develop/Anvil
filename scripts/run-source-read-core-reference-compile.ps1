[CmdletBinding()]param([switch]$Plan,[switch]$Apply,[string]$Commit,[string]$ScriptHash,[string]$DecisionId,[string]$IssuedAt,[string]$ExpiresAt)
$ErrorActionPreference='Stop'
function Get-A3ExecutionLayout([string]$Qa,[string]$Receipt,[string]$Head){
 return @{directories=@(($Qa+'\bin'),($Qa+'\temp'));privatePaths=@($Receipt,$Qa,($Qa+'\bin'),($Qa+'\temp'));expectedHeads=@(($Head+"`trefs/heads/codex/av3-stage-b"),('f976ed5e29e14b13e12729d5b1ccf98f050f2210'+"`trefs/heads/main"))}
}
function Get-A3CoreCompileArguments([string]$Source,[string]$Qa){
 $bcl='C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
 return @('/nologo','/noconfig','/nostdlib+','/target:library','/debug-','/optimize+',('/reference:'+$bcl+'\mscorlib.dll'),('/reference:'+$bcl+'\System.dll'),('/reference:'+$bcl+'\System.Core.dll'),('/out:'+$Qa+'\bin\SourceReadObserver.dll'),$Source)
}
# Main은 호출 전에 PMO의 실제 외부 결정·정확 command/hash/창을 직접 대조한다.
# 이 도구의 문자열/boolean/영수증은 외부 승인 자체를 인증하거나 발급하지 않는다.
if($Plan -and !$Apply){@{mode='PLAN';decisionId='A3_CORE_REFERENCE_COMPILE_01';runId='a3-core-reference-compile-01';priorReceiptRequired='D:\Project\Anvil\.av3-data\a3-absolute-source-compile-01.consumed.json';priorReceiptHash='0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4';compileArguments=(Get-A3CoreCompileArguments 'D:\synthetic\Anvil\apps\connector\native\SourceReadObserver.cs' 'D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa');processStarted=$false;oneUseConsumed=$false;qaCreated=$false;executionAuthorized=$false;timeoutMs=15000;combinedOutputBytes=16384;retries=0;layout=(Get-A3ExecutionLayout 'D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa' 'D:\Project\Anvil\.av3-data\a3-core-reference-compile-01.consumed.json' ('0'*40));receiptProposed='D:\Project\Anvil\.av3-data\a3-core-reference-compile-01.consumed.json'}|ConvertTo-Json -Compress -Depth 5;exit 0}
try{
 if(!$Apply -or $Plan -or !$IsWindows -or !$Commit -or !$ScriptHash -or !$DecisionId -or !$IssuedAt -or !$ExpiresAt){throw 'A3_BINDING_INVALID'}
 $flow=Join-Path $PSScriptRoot 'source-read-absolute-flow.ps1'
 if((Get-FileHash -LiteralPath $flow -Algorithm SHA256).Hash -cne 'EE66AFFEBF755C7C12FDCD14C0D5CBFF75D6F5290604457E11A2F9DA778ADB32'){throw 'A3_BINDING_INVALID'}
 $coreFlow=Join-Path $PSScriptRoot 'source-read-core-reference-flow.ps1'
 if((Get-FileHash -LiteralPath $coreFlow -Algorithm SHA256).Hash -cne 'D6B66FFE63F1AB6BFC864E9214066915703781F054DBD704FD615180C3A9BFFF'){throw 'A3_BINDING_INVALID'}
 . $flow
 . $coreFlow
 $binding=Read-A3CoreReferenceBinding @{decisionId=$DecisionId;runId='a3-core-reference-compile-01';commit=$Commit;scriptHash=$ScriptHash;issuedAt=$IssuedAt;expiresAt=$ExpiresAt} ([datetimeoffset]::UtcNow)
}catch{@{status='FAIL_BEFORE_MUTATION';failure='A3_BINDING_INVALID';processStarted=$false;oneUseConsumed=$false;qaCreated=$false;executionAuthorized=$false}|ConvertTo-Json -Compress;exit 1}
$sourceRoot=Split-Path -Parent $PSScriptRoot
$source=Join-Path $sourceRoot 'apps\connector\native\SourceReadObserver.cs'
$dataRoot='D:\Project\Anvil\.av3-data'
$qa='D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa'
$receipt=Join-Path $dataRoot 'a3-core-reference-compile-01.consumed.json'
$layout=Get-A3ExecutionLayout $qa $receipt $binding.commit
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$bcl=Split-Path -Parent $compiler
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$protected=@{'auth.json'='FA18CA22A06BB8C884675CD93DB0DB83758F8CAFA4E7C3FDBD7E5A1E864B95A7';'db-app.json'='089FF1AC3C07788FEF69C0E78CFE09BFCA3B5F59488BE801D523567048142139';'dev-tls/ca.cer'='B6BBBD6386EB8D6972E15678459858ACA2F4D2FE78B700E1F5CBC965A2727744';'dev-tls/ca.cert.pem'='7657BFC0F623571933D4EF4659EB254B761C0522A93F3A13036DB7AA98411CE3';'dev-tls/ca.key.pem'='D2691A089D9DF4BC4E0AD42A0FF070565EEF1388AD519E3F34D8444B9E9E35BE';'dev-tls/receipt.json'='B4B98FB4E6FF9B83F874B5DF615AFAE8C065092661B9B39F43B3B0B538344CD5';'dev-tls/server.cert.pem'='62AC1DC7E9575A9F497CAEAA709686A697240126B44B4937CFE257C11976A5BA';'dev-tls/server.key.pem'='E8B1E380851DBD6BC713C825AD413A94AF81DFC954B211EB48CDCC193E22EC4A';'runtime-fn08-20261017/receipt.json'='38DFAB5AE73B92B9770AAE82B132810999B985008B06425C890E8C2F77ACD701';'runtime-ui06-served-01/receipt.json'='FDC1467E0CB838071F4B1AA547552D6A61ED76BEBCC79347BCFFA2E2C57E16D7';'runtime-ui11-n4-01/receipt.json'='50459C537F84E4E9DB8B1DD35F3301638B1843EAB05A8928B7DEAEE1B5F74F92';'a3-absolute-source-compile-01.consumed.json'='0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4'}
$state=@{status='FAIL';phase='PREFLIGHT';decisionId=$binding.decisionId;runId=$binding.runId;commit=$binding.commit;failure=$null;cleanupFailure=$null;processStarted=$false;oneUseConsumed=$false;qaCreated=$false;qaRootAbsent=$false;compiler=$null;exitCode=$null;output=$null;byteCapture=$null;byteDiagnostic=$null;externalDecisionAuthenticatedByTool=$false;dllLoaded=$false;nativeFunctionsInvoked=0;osSourceObservations=0;actualAgentCalls=0;databaseWrites=0;serviceChanges=0}
$process=$null;$proof=$null;$capture=$null;$catalog=@{};$resources=@{receiptStream=$null}
function Assert-A3Window([int]$Reserve=0){if([datetimeoffset]::UtcNow.AddSeconds($Reserve) -ge $binding.expiresAt){throw 'A3_WINDOW_EXPIRED'}}
function Assert-A3NoLink([string]$Path,[bool]$CompilerLeaf=$false){
 $item=Get-Item -LiteralPath $Path -Force
 if($CompilerLeaf){if($item -isnot [IO.FileInfo] -or $item.Attributes -ne [IO.FileAttributes]::Archive -or $item.LinkType -ne 'HardLink' -or $item.Target -or (Get-Acl -LiteralPath $Path).Owner -ne 'NT SERVICE\TrustedInstaller'){throw 'A3_COMPILER_LEAF_INVALID'};$item=$item.Directory}
 while($item){if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType){throw 'A3_PATH_LINK'};if($item -is [IO.FileInfo]){$item=$item.Directory}else{$item=$item.Parent}}
}
function Assert-A3Hash([string]$Path,[string]$Hash,[bool]$CompilerLeaf=$false){Assert-A3NoLink $Path $CompilerLeaf;if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -cne $Hash){throw 'A3_HASH_MISMATCH'}}
function Assert-A3PrivateAcl([string]$Path,[bool]$ProtectedParent=$false){
 Assert-A3NoLink $Path;$acl=Get-Acl -LiteralPath $Path
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|ForEach-Object {@{sid=$_.IdentityReference.Value;type=[string]$_.AccessControlType;rights=[int64]$_.FileSystemRights}})
 if(($ProtectedParent -and !$acl.AreAccessRulesProtected) -or !(Test-A3PrivateAclFacts $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value $ownerSid $rules)){throw 'A3_PRIVATE_ACL_UNVERIFIED'}
}
function Read-A3Git([string[]]$Arguments){
 Assert-A3Window
 $info=[Diagnostics.ProcessStartInfo]::new((Get-Command git.exe).Source);$info.WorkingDirectory=$sourceRoot;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($arg in $Arguments){$info.ArgumentList.Add($arg)};$p=[Diagnostics.Process]::new();$p.StartInfo=$info
 try{if(!$p.Start()){throw 'A3_GIT_FAILED'};$out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync();if(!$p.WaitForExit(10000)){try{$p.Kill();$null=$p.WaitForExit(1000)}catch{};throw 'A3_GIT_TIMEOUT'};if(!$out.Wait(1000) -or !$err.Wait(1000) -or $p.ExitCode -ne 0 -or $out.Result.Length -gt 65536 -or $err.Result.Length -gt 65536){throw 'A3_GIT_FAILED'};return $out.Result.Trim()}finally{$p.Dispose()}
}
function Assert-A3Git {
 if((Read-A3Git @('rev-parse','--show-toplevel')).Replace('/','\') -cne $sourceRoot){throw 'A3_GIT_ROOT_MISMATCH'}
 if((Read-A3Git @('rev-parse','HEAD')) -cne $binding.commit -or (Read-A3Git @('branch','--show-current')) -cne 'codex/av3-stage-b' -or (Read-A3Git @('status','--porcelain')) -ne '' -or (Read-A3Git @('remote','get-url','development')) -cne 'git@github-sinsan-develop:sinsan-develop/Anvil.git'){throw 'A3_GIT_BINDING_MISMATCH'}
 $heads=Read-A3Git @('ls-remote','--exit-code','development','refs/heads/codex/av3-stage-b','refs/heads/main')
 $expected=@($layout.expectedHeads|Sort-Object)
 if((@($heads -split '\r?\n'|Sort-Object) -join "`n") -cne ($expected -join "`n")){throw 'A3_REMOTE_BINDING_MISMATCH'}
}
function Assert-A3Protected {
 foreach($key in $protected.Keys){Assert-A3Hash (Join-Path $dataRoot $key) $protected[$key]}
 foreach($pair in @(@(54212,'C:\Program Files\nodejs\node.exe','2026-10-17T19:08:16.5819449Z'),@(26052,'C:\Program Files\WSL\wslrelay.exe','2026-10-15T12:28:17.5262971Z'))){$p=Get-Process -Id $pair[0];if($p.Path -cne $pair[1] -or $p.StartTime.ToUniversalTime().Ticks -ne ([datetimeoffset]$pair[2]).UtcTicks){throw 'A3_RUNTIME_CHANGED'}}
 $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 3830);if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].OwningProcess -ne 54212){throw 'A3_LISTENER_CHANGED'}
}
function Assert-A3OwnedCompiler {
 if(!$process -or !(Test-A3CompilerIdentityFacts $proof $state.compiler) -or $process.Id -ne $proof.pid -or $process.StartTime.ToUniversalTime().Ticks -ne $proof.ticks){throw 'A3_COMPILER_IDENTITY_UNKNOWN'}
 if(!$process.HasExited -and $process.MainModule.FileName -cne $compiler){throw 'A3_COMPILER_IDENTITY_UNKNOWN'}
 $children=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$proof.pid)|Where-Object {$_.CreationDate.ToUniversalTime().Ticks -ge $proof.ticks});if($children.Count){throw 'A3_CHILDREN_UNVERIFIED'}
}
function Stop-A3Compiler {
 if(!$process -or $process.HasExited){return}
 if(!$proof -or !$state.compiler.exeObserved -or $process.Id -ne $proof.pid -or $process.StartTime.ToUniversalTime().Ticks -ne $proof.ticks -or $process.MainModule.FileName -cne $compiler){throw 'A3_COMPILER_IDENTITY_UNKNOWN'}
 # 같은 kernel Process handle의 본인 compiler만 종료한다. 자식·다른 PID는 종료하지 않는다.
 $process.Kill();if(!$process.WaitForExit(1000)){throw 'A3_COMPILER_STILL_ACTIVE'}
}
function Remove-A3Qa {
 if(!$state.qaCreated){return}
 if($process){Assert-A3OwnedCompiler;if(!$process.HasExited){throw 'A3_COMPILER_STILL_ACTIVE'}}
 $active=@(Get-CimInstance Win32_Process|Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine.Contains($qa) -or $_.CommandLine.Contains($qa.Replace('\','/')))});if($active.Count){throw 'A3_QA_PROCESS_ACTIVE'}
 Assert-A3NoLink $qa;Assert-A3PrivateAcl $qa
 $dirs=@($qa);$files=@();$queue=[Collections.Generic.Stack[string]]::new();$queue.Push($qa)
 while($queue.Count){$dir=$queue.Pop();if((Get-Acl -LiteralPath $dir).Owner -cne $owner){throw 'A3_QA_OWNER_MISMATCH'};foreach($item in Get-ChildItem -LiteralPath $dir -Force){$full=[IO.Path]::GetFullPath($item.FullName);if(!$full.StartsWith($qa+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'A3_QA_ESCAPE'};Assert-A3NoLink $full;if((Get-Acl -LiteralPath $full).Owner -cne $owner){throw 'A3_QA_OWNER_MISMATCH'};if($item.PSIsContainer){if($full -notin $layout.directories -and !$full.StartsWith($qa+'\temp\',[StringComparison]::OrdinalIgnoreCase)){throw 'A3_QA_UNEXPECTED'};$dirs+=$full;$queue.Push($full)}else{if($full -cne $qa+'\bin\SourceReadObserver.dll' -and !$full.StartsWith($qa+'\temp\',[StringComparison]::OrdinalIgnoreCase)){throw 'A3_QA_UNEXPECTED'};$files+=@{path=$full;hash=(Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash}}}}
 foreach($file in $files){Assert-A3Hash $file.path $file.hash;Remove-Item -LiteralPath $file.path -Force};foreach($dir in ($dirs|Sort-Object Length -Descending)){if(@(Get-ChildItem -LiteralPath $dir -Force).Count){throw 'A3_QA_NOT_EMPTY'};Remove-Item -LiteralPath $dir -Force}
 if(Test-Path -LiteralPath $qa){throw 'A3_QA_REMAINS'}
}
try{
 Assert-A3Window 90
 Assert-A3Hash $PSCommandPath $binding.scriptHash
 Assert-A3Hash $flow 'EE66AFFEBF755C7C12FDCD14C0D5CBFF75D6F5290604457E11A2F9DA778ADB32'
 Assert-A3Hash $coreFlow 'D6B66FFE63F1AB6BFC864E9214066915703781F054DBD704FD615180C3A9BFFF'
 Assert-A3Hash (Join-Path $PSScriptRoot 'source-read-core-reference-candidate.ts') '40F93C610F201583D50978A4C083B83837AEC250A3802B75B9FD1F9D0D8F90B9'
 Assert-A3Hash (Join-Path $PSScriptRoot 'source-read-absolute-compile.ts') '081977C0E2B0C5744F8CE383216CAC24441EC41FA12EC7A9C7739E9BCB4A424D'
 $diagnostic=Join-Path $PSScriptRoot 'source-read-compile-diagnostics.ps1';Assert-A3Hash $diagnostic '5A4B808ABA9D5E63F7EDB31C7B16DADF9F3BFE0A83FF0BEB5DBA45C39555BD18'
 Assert-A3Hash $source '3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC'
 if((Get-Acl -LiteralPath $sourceRoot).Owner -cne $owner -or (Get-Acl -LiteralPath $source).Owner -cne $owner){throw 'A3_SOURCE_OWNER_MISMATCH'}
 Assert-A3Hash $compiler '46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00' $true
 Assert-A3Hash (Join-Path $bcl 'mscorlib.dll') '11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C' $true
 Assert-A3Hash (Join-Path $bcl 'System.dll') '2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71' $true
 Assert-A3Hash (Join-Path $bcl 'System.Core.dll') '8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D' $true
 $coreItem=Get-Item -LiteralPath (Join-Path $bcl 'System.Core.dll');if($coreItem.Length -ne 1551104 -or $coreItem.VersionInfo.FileVersion -cne '4.8.9363.0 built by: NET481REL1LAST_25H2_B'){throw 'A3_CORE_VERSION_CHANGED'}
 $version=(Get-Item -LiteralPath $compiler).VersionInfo;if($version.FileVersion -cne '4.8.9221.0 built by: NET481REL1LAST_25H2' -or @($version.FileMajorPart,$version.FileMinorPart,$version.FileBuildPart,$version.FilePrivatePart) -join '/' -cne '4/8/9221/0'){throw 'A3_COMPILER_VERSION_CHANGED'}
 Assert-A3NoLink $dataRoot;Assert-A3NoLink (Split-Path -Parent $qa);if((Get-Acl -LiteralPath $dataRoot).Owner -cne $owner -or (Get-Acl -LiteralPath (Split-Path -Parent $qa)).Owner -cne $owner -or (Test-Path -LiteralPath $qa) -or (Test-Path -LiteralPath $receipt)){throw 'A3_FRESH_RESOURCE_INVALID'}
 Assert-A3PrivateAcl $dataRoot $true;Assert-A3PrivateAcl (Split-Path -Parent $qa) $true
 Assert-A3PrivateAcl (Join-Path $dataRoot 'a3-absolute-source-compile-01.consumed.json')
 Assert-A3Git;Assert-A3Protected;Assert-A3Window 60
 $state.phase='CONSUME_ONCE'
 . $diagnostic
 Invoke-A3PreparationStages -CheckDeadline {Assert-A3Window 20} -Consume {
  Assert-A3PrivateAcl $dataRoot $true;Assert-A3Window 20
  $resources.receiptStream=[IO.FileStream]::new($receipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$state.oneUseConsumed=$true;Assert-A3PrivateAcl $receipt
  $bytes=[Text.Encoding]::UTF8.GetBytes((@{schemaVersion=1;decisionId=$binding.decisionId;runId=$binding.runId;commit=$binding.commit;scriptHash=$binding.scriptHash;issuedAt=$binding.issuedAt.ToString('o');expiresAt=$binding.expiresAt.ToString('o');consumedAt=[datetimeoffset]::UtcNow.ToString('o');consumed=$true;executionAuthorizedByReceipt=$false}|ConvertTo-Json -Compress));try{$resources.receiptStream.Write($bytes,0,$bytes.Length);$resources.receiptStream.Flush($true)}finally{[Array]::Clear($bytes,0,$bytes.Length)}
 } -CreateQa {
  Assert-A3PrivateAcl (Split-Path -Parent $qa) $true;Assert-A3Window 20
  $null=New-Item -ItemType Directory -Path $qa;$state.qaCreated=$true;Assert-A3PrivateAcl $qa
  foreach($dir in $layout.directories){Assert-A3Window 20;$null=New-Item -ItemType Directory -Path $dir;Assert-A3PrivateAcl $dir}
 } -CollectCatalog {
  foreach($code in @(2,3,5,32,33,123)){Assert-A3Window 20;$message=[ComponentModel.Win32Exception]::new($code).Message;$catalog[[string]$code]=@{utf8=[Text.Encoding]::UTF8.GetBytes($message);ansi=[Text.Encoding]::GetEncoding([Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage).GetBytes($message)}}
 }
 $compileArguments=Get-A3CoreCompileArguments $source $qa
 $info=[Diagnostics.ProcessStartInfo]::new($compiler);$info.WorkingDirectory=$sourceRoot;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.Environment['TMP']=$qa+'\temp';$info.Environment['TEMP']=$qa+'\temp';foreach($arg in $compileArguments){$info.ArgumentList.Add($arg)}
 Assert-A3PrivateAcl $dataRoot $true;Assert-A3PrivateAcl (Split-Path -Parent $qa) $true;foreach($path in $layout.privatePaths){Assert-A3PrivateAcl $path}
 Assert-A3Window 20;$state.phase='COMPILE';$clock=[Diagnostics.Stopwatch]::StartNew();$process=[Diagnostics.Process]::new();$process.StartInfo=$info
 if(!$process.Start()){throw 'A3_COMPILER_START_FAILED'};$state.processStarted=$true
 $proof=@{pid=$process.Id;ticks=$process.StartTime.ToUniversalTime().Ticks};$state.compiler=@{pid=$proof.pid;requestedExe=$compiler;exe=$null;exeObserved=$false;startUtc=$process.StartTime.ToUniversalTime().ToString('o')};$actualExe=$process.MainModule.FileName;if($actualExe -cne $compiler){throw 'A3_COMPILER_IDENTITY_UNKNOWN'};$state.compiler.exe=$actualExe;$state.compiler.exeObserved=$true
 $remaining=15000-[int]$clock.ElapsedMilliseconds;if($remaining -le 0){throw 'A3_COMPILE_TIMEOUT'};$capture=Read-A3BoundedBytes $process.StandardOutput.BaseStream $process.StandardError.BaseStream $remaining {Stop-A3Compiler;$process.StandardOutput.BaseStream.Dispose();$process.StandardError.BaseStream.Dispose()}
 if(!$capture.complete -or $capture.limitHit -or $capture.timedOut){throw 'A3_COMPILE_CAPTURE_INCOMPLETE'};$remaining=15000-[int]$clock.ElapsedMilliseconds;if($remaining -lt 0 -or !$process.WaitForExit([Math]::Max(0,$remaining))){throw 'A3_COMPILE_TIMEOUT'}
 Assert-A3OwnedCompiler;$state.exitCode=$process.ExitCode;$state.elapsedMs=$clock.Elapsed.TotalMilliseconds
 $state.byteDiagnostic=Get-A3CompileDiagnostic -Stdout $capture.stdout -Stderr $capture.stderr -ExitCode $process.ExitCode -Complete $true -ExpectedAbsoluteSource $source -OsReasons $catalog
 if($process.ExitCode -ne 0){throw 'A3_COMPILE_EXIT_NONZERO'}
 $dll=$qa+'\bin\SourceReadObserver.dll';Assert-A3NoLink $dll;$state.output=@{sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash;bytes=(Get-Item -LiteralPath $dll).Length;loaded=$false};$state.status='PASS_LIBRARY_COMPILE_ONLY'
}catch{$code=$_.Exception.Message;$state.failure=if($code -cmatch '^A3_[A-Z_]+$'){$code}else{'A3_PREPARATION_OR_EXECUTION_FAILED'};$state.status='FAIL'}
finally{
 try{
  Stop-A3Compiler
  if($process){$process.StandardOutput.Dispose();$process.StandardError.Dispose()}
  if($capture){foreach($task in $capture.cleanup.tasks){if($task -and !$task.IsCompleted){try{$null=$task.Wait(500)}catch{}}};if(!(Complete-A3CaptureCleanup $capture.cleanup)){throw 'A3_CAPTURE_CLEANUP_UNVERIFIED'}}
  Remove-A3Qa;$state.qaRootAbsent=!(Test-Path -LiteralPath $qa);Assert-A3Protected;Assert-A3Git
 }catch{$state.cleanupFailure='A3_CLEANUP_OR_POSTCHECK_UNVERIFIED';$state.status='FAIL'}
 if($capture){$state.byteCapture=@{stdout=@{capturedBytes=$capture.stdout.Length;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([byte[]]$capture.stdout)).ToLowerInvariant()};stderr=@{capturedBytes=$capture.stderr.Length;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([byte[]]$capture.stderr)).ToLowerInvariant()};complete=$capture.complete;limitHit=$capture.limitHit;timedOut=$capture.timedOut;memoryCleanupComplete=$capture.cleanup.complete};foreach($bytes in @($capture.stdout,$capture.stderr)){[Array]::Clear($bytes,0,$bytes.Length)}};foreach($entry in $catalog.Values){foreach($bytes in @($entry.utf8,$entry.ansi)){[Array]::Clear($bytes,0,$bytes.Length)}}
 if($process){$process.Dispose()};if($resources.receiptStream){$resources.receiptStream.Dispose()}
}
$state|ConvertTo-Json -Compress -Depth 12
if($state.status -eq 'PASS_LIBRARY_COMPILE_ONLY'){exit 0}else{exit 1}
