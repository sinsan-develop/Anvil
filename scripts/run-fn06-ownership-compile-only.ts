import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import {dirname, parse, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {buildOwnershipCompileOnlyPlan, compileOnlyFail, compileOnlyHash, ownershipCompileOnly as fixed, ownershipCompileOnlyFinalizationPolicies, readOwnershipCompileOnlyManifest, validateOwnershipCompileOnlyDecision} from './fn06-ownership-compile-only-input.ts';

type Ports = {
  readPreparation(): Promise<{manifestRaw: Uint8Array; observations: unknown; binding: any}>;
  readDecision(path: string): Promise<unknown>;
  report(value: unknown): void;
  executeCompileOnly?: (plan: ReturnType<typeof buildOwnershipCompileOnlyPlan>, decision: unknown) => Promise<any>;
};

/** import는 실행하지 않는다. 주입은 함수 인자에만 있으며 CLI는 자체 고정 포트를 사용한다. */
export async function runOwnershipCompileOnly(argv: string[], ports: Ports) {
  if (!(argv.length === 0 || (argv.length === 1 && ['--plan', '--apply'].includes(argv[0]!)))) return compileOnlyFail('ARGUMENT_INVALID');
  const preparation = await ports.readPreparation();
  const plan = buildOwnershipCompileOnlyPlan(preparation.manifestRaw, preparation.observations);
  if (argv[0] !== '--apply') {
    const result = {status: 'PLAN_ONLY', plan, binding: preparation.binding, externalUserApprovalVerified: false, executionAuthorized: false};
    ports.report(result);
    return result;
  }
  const decision = await ports.readDecision(fixed.decisionPath);
  validateOwnershipCompileOnlyDecision(decision, preparation.binding);
  if (!ports.executeCompileOnly) return compileOnlyFail('EXECUTION_ADAPTER_UNAVAILABLE');
  // 이 지점도 사람 승인 인증은 아니다. Main의 원문/플랫폼 승인 대조 후에만 CLI --apply를 호출한다.
  const result = await ports.executeCompileOnly(plan, decision);
  ports.report(result);
  return result;
}

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const powershell = 'C:/Program Files/PowerShell/7/pwsh.exe';
// stdin으로 고정 스크립트를 전달해 Windows 32767자 command-line 상한을 넘지 않는다.
// 입력 자체도 64KiB로 한정하며 stdout/stderr 캡처와 별개다.
const bootstrap = String.raw`$ErrorActionPreference='Stop';$stream=[Console]::OpenStandardInput();$buffer=[byte[]]::new(65536);$length=0;try{while($true){if($length -eq $buffer.Length){if($stream.ReadByte() -ne -1){throw 'OWNERSHIP_COMPILE_ONLY_SCRIPT_TOO_LARGE'};break};$read=$stream.Read($buffer,$length,$buffer.Length-$length);if(!$read){break};$length+=$read};$text=[Text.UTF8Encoding]::new($false,$true).GetString($buffer,0,$length);& ([scriptblock]::Create($text))}finally{[Array]::Clear($buffer,0,$buffer.Length);$stream.Dispose()}`;
const psPrelude = String.raw`
$ErrorActionPreference='Stop'
$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__'))|ConvertFrom-Json -AsHashtable -DateKind String
if(!$IsWindows){throw 'OWNERSHIP_COMPILE_ONLY_WINDOWS_REQUIRED'}
$owner='SINSAN\cyhuh';$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne $owner){throw 'OWNERSHIP_COMPILE_ONLY_OWNER_UNVERIFIED'}
function NoLink([string]$path,[bool]$SystemLeaf=$false){
 $item=Get-Item -LiteralPath $path -Force
 if($SystemLeaf){if($item -isnot [IO.FileInfo] -or $item.Target -or $item.LinkType -notin @($null,'','HardLink') -or (Get-Acl -LiteralPath $path).Owner -cne 'NT SERVICE\TrustedInstaller'){throw 'OWNERSHIP_COMPILE_ONLY_SYSTEM_LEAF_INVALID'};$item=$item.Directory}
 while($item){if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType){throw 'OWNERSHIP_COMPILE_ONLY_PATH_LINK'};if($item -is [IO.FileInfo]){$item=$item.Directory}else{$item=$item.Parent}}
}
function Private([string]$path){
 NoLink $path;$acl=Get-Acl -LiteralPath $path
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid){throw 'OWNERSHIP_COMPILE_ONLY_OWNER_UNVERIFIED'}
 $seen=@{};foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  $id=$rule.IdentityReference.Value
  if($id -notin @($sid,'S-1-5-18') -or $rule.AccessControlType -ne 'Allow'){throw 'OWNERSHIP_COMPILE_ONLY_ACL_UNVERIFIED'}
  $seen[$id]=[int64]$seen[$id] -bor [int64]$rule.FileSystemRights
 }
 foreach($id in @($sid,'S-1-5-18')){if(!($seen.ContainsKey($id)) -or ($seen[$id] -band [int64][Security.AccessControl.FileSystemRights]::FullControl) -ne [int64][Security.AccessControl.FileSystemRights]::FullControl){throw 'OWNERSHIP_COMPILE_ONLY_ACL_UNVERIFIED'}}
}
function FileFact([hashtable]$f,[bool]$tool){
 $path=if($tool){$f.path}else{Join-Path $p.sourceRoot $f.path}
 NoLink $path $tool;$i=Get-Item -LiteralPath $path -Force
 if($i -isnot [IO.FileInfo] -or $i.Length -ne $f.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $f.sha256){throw 'OWNERSHIP_COMPILE_ONLY_FILE_UNVERIFIED'}
 if(!$tool -and (Get-Acl -LiteralPath $path).Owner -cne $owner){throw 'OWNERSHIP_COMPILE_ONLY_OWNER_UNVERIFIED'}
 $o=@{path=$f.path;bytes=$f.bytes;sha256=$f.sha256;regularFile=$true;nonLink=$true;ownerVerified=$true}
 if($tool){$s=Get-AuthenticodeSignature -LiteralPath $path;if($s.Status -ne 'Valid' -or !$s.SignerCertificate -or $s.SignerCertificate.Subject -notmatch '(^|, )O=Microsoft Corporation(,|$)'){throw 'OWNERSHIP_COMPILE_ONLY_SIGNATURE_UNVERIFIED'};$o.signatureVerified=$true}
 return $o
}
function Preflight {
 Private $p.parent
 if((Get-Item -LiteralPath $p.parent -Force).FullName.Replace('\','/') -cne $p.parent){throw 'OWNERSHIP_COMPILE_ONLY_PARENT_UNVERIFIED'}
 if((Test-Path -LiteralPath $p.qaRoot) -or (Test-Path -LiteralPath $p.consumedMarker)){throw 'OWNERSHIP_COMPILE_ONLY_ALREADY_EXISTS'}
 $s=@();foreach($f in $p.sources){$s+=FileFact $f $false};$t=@();foreach($f in $p.tools){$t+=FileFact $f $true}
 return @{sources=$s;tools=$t;parent=@{path=$p.parent;resolvedPath=$p.parent;nonLink=$true;owner='SINSAN/cyhuh';aclPrincipals=@('SINSAN/cyhuh','SYSTEM');aclVerified=$true};qaRootExists=$false;consumedMarkerExists=$false}
}
`;

const metadataScript = psPrelude + String.raw`
$facts=Preflight
$facts|ConvertTo-Json -Depth 12 -Compress
`;

// 원 Process의 pipe/종료 관측은 image 신원 증명과 별개다. 함수 자체는 시작/중단/FS 권한이 없다.
const captureScript = String.raw`
function CaptureOriginalCompiler {
 param($Compiler,[string]$ExpectedExe,$Sources,[datetimeoffset]$Expires,$Context=$null,$Clock=$null,[scriptblock]$StopVerified=$null)
 $localContext=($null -eq $Context)
 if($localContext){$Context=@{outMemory=[IO.MemoryStream]::new();errMemory=[IO.MemoryStream]::new();outBuffer=[byte[]]::new(4096);errBuffer=[byte[]]::new(4096);outTask=$null;errTask=$null;cancel=[Threading.CancellationTokenSource]::new()}}
 if(!$Clock){$Clock=[Diagnostics.Stopwatch]::StartNew()}
 $identity=@{pid=$null;startTicks=$null;expectedExe=$ExpectedExe;observedExe=$null;exeObserved=$false;imageErrorType=$null;imageErrorCode=$null;hasExitedAtImageObservation=$null;startErrorType=$null}
 $verified=$false;$total=0;$reservedOut=0;$reservedErr=0;$eofOut=$false;$eofErr=$false;$limitHit=$false;$timedOut=$false;$captureFailure=$null;$diagnostics=@();$exitObserved=$false;$exitCode=$null
 try {
  # 조회보다 먼저 같은 원 Process의 두 pipe 읽기를 예약한다. 예약+보존 합계는 16KiB 이하다.
  $reservedOut=4096;$Context.outTask=$Compiler.StandardOutput.BaseStream.ReadAsync($Context.outBuffer,0,4096,$Context.cancel.Token)
  $reservedErr=4096;$Context.errTask=$Compiler.StandardError.BaseStream.ReadAsync($Context.errBuffer,0,4096,$Context.cancel.Token)
  try{$identity.pid=$Compiler.Id;$identity.startTicks=[string]$Compiler.StartTime.ToUniversalTime().Ticks}catch{$identity.startErrorType='START_OBSERVATION_FAILED'}
  try {
   $identity.hasExitedAtImageObservation=[bool]$Compiler.HasExited
   if(!$identity.hasExitedAtImageObservation){
    $previousError=if($Error.Count){$Error[0]}else{$null};$module=$Compiler.MainModule
    # PS ScriptProperty는 예외를 Error 원장에만 남기고 null을 반환할 수 있다. 원문은 내보내지 않는다.
    if(!$module -and $Error.Count -and ![object]::ReferenceEquals($previousError,$Error[0])){throw $Error[0].Exception}
    $image=$module.FileName;if($image -is [string] -and $image.Length){$identity.observedExe=$image.Replace('\','/');$identity.exeObserved=$true}
   }
  }catch{
   $errorType='IMAGE_OBSERVATION_FAILED';$errorCode=$null;$errorObject=$_.Exception
   for($depth=0;$errorObject -and $depth -lt 5;$depth++){
    if($errorObject -is [ComponentModel.Win32Exception]){$errorType='Win32Exception';$errorCode=$errorObject.NativeErrorCode;break}
    if($errorObject -is [InvalidOperationException]){$errorType='InvalidOperationException'}
    $errorObject=$errorObject.InnerException
   }
   $identity.imageErrorType=$errorType;$identity.imageErrorCode=$errorCode
   try{$identity.hasExitedAtImageObservation=[bool]$Compiler.HasExited}catch{$identity.hasExitedAtImageObservation=$null}
  }
  $verified=($identity.pid -gt 0 -and $null -ne $identity.startTicks -and $identity.exeObserved -and $identity.observedExe -ceq $ExpectedExe)
  while($true){
   try{$exitObserved=[bool]$Compiler.HasExited}catch{$exitObserved=$false}
   if($eofOut -and $eofErr -and $exitObserved){break}
   if($Clock.ElapsedMilliseconds -ge 15000 -or [datetimeoffset]::UtcNow.AddSeconds(5) -ge $Expires){$timedOut=$true;break}
   foreach($stream in @('out','err')){
    $task=$Context[$stream+'Task'];$done=if($stream -eq 'out'){$eofOut}else{$eofErr};if($done){continue}
    if(!$task){
     $available=16384-$total-$reservedOut-$reservedErr;if($available -le 0){continue};$reserve=[Math]::Min(4096,$available)
     if($stream -eq 'out'){$reservedOut=$reserve}else{$reservedErr=$reserve}
     $pipe=if($stream -eq 'out'){$Compiler.StandardOutput.BaseStream}else{$Compiler.StandardError.BaseStream}
     $Context[$stream+'Task']=$pipe.ReadAsync($Context[$stream+'Buffer'],0,$reserve,$Context.cancel.Token);$task=$Context[$stream+'Task']
    }
    if(!$task.IsCompleted){continue};$n=$task.GetAwaiter().GetResult();$buffer=$Context[$stream+'Buffer'];$memory=$Context[$stream+'Memory']
    $Context[$stream+'Task']=$null;if($stream -eq 'out'){$reservedOut=0}else{$reservedErr=0}
    if($n -eq 0){if($stream -eq 'out'){$eofOut=$true}else{$eofErr=$true};continue}
    $retain=[Math]::Min($n,16384-$total);if($retain -gt 0){$memory.Write($buffer,0,$retain);$total+=$retain};if($retain -lt $n){$limitHit=$true}
    [Array]::Clear($buffer,0,$buffer.Length)
   }
   if($total -ge 16384 -and !($eofOut -and $eofErr)){$limitHit=$true};if($limitHit){break};Start-Sleep -Milliseconds 5
  }
 }catch{$captureFailure='OWNERSHIP_COMPILE_ONLY_CAPTURE_FAILED'}
 # 중단은 외부에서 원 handle/PID/ticks/image/child를 다시 검증할 때만 가능하다. 불명 image에서는 호출하지 않는다.
 if(($limitHit -or $timedOut) -and $verified -and $StopVerified){try{& $StopVerified @{pid=$identity.pid;ticks=[int64]$identity.startTicks}}catch{$captureFailure='OWNERSHIP_COMPILE_ONLY_STOP_UNKNOWN'}}
 try{$exitObserved=[bool]$Compiler.HasExited;if($exitObserved){$exitCode=$Compiler.ExitCode}}catch{$exitObserved=$false;$exitCode=$null}
 $capture=@{combinedCapturedBytes=$total;stdoutCapturedBytes=$Context.outMemory.Length;stderrCapturedBytes=$Context.errMemory.Length;stdoutEof=$eofOut;stderrEof=$eofErr;limitHit=$limitHit;timedOut=$timedOut;exitObserved=$exitObserved;memoryErasureGuaranteed=$false;managedBufferClearAttempted=$false}
 foreach($pair in @(@('stdoutSha256',$Context.outMemory),@('stderrSha256',$Context.errMemory))){
  $array=$pair[1].ToArray()
  try{
   $capture[$pair[0]]=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($array));$text=[Text.Encoding]::UTF8.GetString($array)
   foreach($match in [regex]::Matches($text,'(?m)^(?:(.+?)\((\d{1,7}),(\d{1,7})\):\s*|CSC\s*:\s*)?(?:error|warning)\s+(CS\d{4})\b')){
    if($diagnostics.Count -ge 128){break};$source=$null;$line=$null;$column=$null
    if($match.Groups[1].Success){$basename=$match.Groups[1].Value.Replace('\','/').Split('/')[-1];foreach($file in $Sources){if($basename -ceq $file.path.Replace('\','/').Split('/')[-1]){$source=$basename;break}};$line=[int]$match.Groups[2].Value;$column=[int]$match.Groups[3].Value}
    $diagnostics+=@{code=$match.Groups[4].Value;source=$source;line=$line;column=$column}
   }
  }finally{[Array]::Clear($array,0,$array.Length)}
 }
 $failure=if(!$verified){'OWNERSHIP_COMPILE_ONLY_IDENTITY_UNKNOWN'}elseif($captureFailure){$captureFailure}elseif(!$exitObserved){'OWNERSHIP_COMPILE_ONLY_EXIT_UNKNOWN'}elseif($limitHit -or $timedOut -or !$eofOut -or !$eofErr){'OWNERSHIP_COMPILE_ONLY_CAPTURE_INCOMPLETE'}elseif($exitCode -ne 0){'OWNERSHIP_COMPILE_ONLY_COMPILER_FAILED'}else{$null}
 if($localContext){
  $Context.cancel.Cancel();$drain=[Diagnostics.Stopwatch]::StartNew()
  while((($Context.outTask -and !$Context.outTask.IsCompleted) -or ($Context.errTask -and !$Context.errTask.IsCompleted)) -and $drain.ElapsedMilliseconds -lt 1000){Start-Sleep -Milliseconds 5}
  if((!$Context.outTask -or $Context.outTask.IsCompleted) -and (!$Context.errTask -or $Context.errTask.IsCompleted)){
   foreach($task in @($Context.outTask,$Context.errTask)){if($task){try{$null=$task.GetAwaiter().GetResult()}catch{}}}
   foreach($buffer in @($Context.outBuffer,$Context.errBuffer)){[Array]::Clear($buffer,0,$buffer.Length)}
   foreach($memory in @($Context.outMemory,$Context.errMemory)){$buffer=$memory.GetBuffer();[Array]::Clear($buffer,0,$buffer.Length);$memory.Dispose()};$Context.cancel.Dispose()
  }
 }
 return @{status='FAIL_COMPILE_ONLY';failure=$failure;compilerIdentity=$identity;identityVerified=$verified;stopAuthorized=$false;capture=$capture;diagnostics=$diagnostics;exitCode=$exitCode}
}
`;

/** 새 허가 후에만 쓰일 고정 adapter의 소스. 현재 준비/단위시험에서는 실행하지 않는다. */
const applyScript = psPrelude + String.raw`
$state=@{status='FAIL_COMPILE_ONLY';phase='PREFLIGHT';failure=$null;cleanupFailure=$null;processStarted=$false;oneUseConsumed=$false;qaCreated=$false;qaRootAbsent=$false;actualCompilerExecuted=$false;externalUserApprovalVerified=$false;dllLoaded=$false;nativeFunctionsInvoked=0;actualAgentCalls=0;databaseWrites=0;serviceChanges=0;exitCode=$null;capture=$null;output=$null;diagnostics=@();compilerIdentity=$null;hostIdentity=$null;handoffRequired=$false;finalization=$null;stopIdentityChecked=$false;stopRequested=$false;stopOutcome='NOT_REQUESTED';memoryCleanupComplete=$false}
` + captureScript + String.raw`
$compiler=$null;$proof=$null;$rootCreated=$false;$knownFiles=@();$knownDirs=@();$captureOut=[IO.MemoryStream]::new();$captureErr=[IO.MemoryStream]::new();$outBuffer=[byte[]]::new(4096);$errBuffer=[byte[]]::new(4096);$outTask=$null;$errTask=$null;$unknown=$false;$readCancel=[Threading.CancellationTokenSource]::new()
$captureContext=@{outMemory=$captureOut;errMemory=$captureErr;outBuffer=$outBuffer;errBuffer=$errBuffer;outTask=$null;errTask=$null;cancel=$readCancel}
$hostProcess=[Diagnostics.Process]::GetCurrentProcess();$state.hostIdentity=@{pid=$hostProcess.Id;startTicks=[string]$hostProcess.StartTime.ToUniversalTime().Ticks;exe=$hostProcess.MainModule.FileName.Replace('\','/')}
$qa=$p.qaRoot;$exe=$p.tools[0].path;$expires=[datetimeoffset]::ParseExact($p.decision.expiresAt,'yyyy-MM-ddTHH:mm:ss.fffZ',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal)
function Window([int]$reserve=0){if([datetimeoffset]::UtcNow.AddSeconds($reserve) -ge $expires){throw 'OWNERSHIP_COMPILE_ONLY_WINDOW_EXPIRED'}}
function Owned($candidateProof=$proof) {
 if(!$compiler -or !$state.processStarted -or !$candidateProof -or $compiler.Id -ne $candidateProof.pid -or $compiler.StartTime.ToUniversalTime().Ticks -ne $candidateProof.ticks){throw 'OWNERSHIP_COMPILE_ONLY_IDENTITY_UNKNOWN'}
 if(!$compiler.HasExited -and $compiler.MainModule.FileName.Replace('\','/') -cne $exe){throw 'OWNERSHIP_COMPILE_ONLY_IDENTITY_UNKNOWN'}
 $children=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$candidateProof.pid)|Where-Object {$_.CreationDate.ToUniversalTime().Ticks -ge $candidateProof.ticks})
 if($children.Count){throw 'OWNERSHIP_COMPILE_ONLY_CHILD_UNKNOWN'}
}
function StopOwned($candidateProof=$proof) {
 if(!$compiler -or !$state.processStarted -or $compiler.HasExited){return}
 try{Owned $candidateProof;$state.stopIdentityChecked=$true}catch{$state.stopOutcome='IDENTITY_OR_CHILD_UNKNOWN';throw}
 # 같은 .NET Process handle의 신원이 일치한 compiler 본체만 중단한다. tree kill 없음.
 $state.stopRequested=$true;$state.stopOutcome='REQUESTED_EXIT_UNCONFIRMED'
 $compiler.Kill();if(!$compiler.WaitForExit(1000)){throw 'OWNERSHIP_COMPILE_ONLY_STILL_ACTIVE'};$state.stopOutcome='EXIT_OBSERVED'
}
function RelatedZero {
 $related=@(Get-CimInstance Win32_Process|Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine.Contains($qa) -or $_.CommandLine.Contains($qa.Replace('/','\')))})
 if($related.Count){throw 'OWNERSHIP_COMPILE_ONLY_RELATED_PROCESS_UNKNOWN'}
}
function Cleanup {
 if(!$rootCreated){return}
 if($unknown){throw 'OWNERSHIP_COMPILE_ONLY_UNKNOWN_PRESERVED'}
 if($compiler -and $state.processStarted){Owned;if(!$compiler.HasExited){throw 'OWNERSHIP_COMPILE_ONLY_STILL_ACTIVE'}}
 RelatedZero;Private $qa
 $actualFiles=@();$actualDirs=@($qa);$queue=[Collections.Generic.Stack[string]]::new();$queue.Push($qa)
 while($queue.Count){$dir=$queue.Pop();Private $dir;foreach($item in Get-ChildItem -LiteralPath $dir -Force){
  $full=$item.FullName.Replace('\','/');if(!$full.StartsWith($qa+'/',[StringComparison]::Ordinal)){throw 'OWNERSHIP_COMPILE_ONLY_CLEANUP_ESCAPE'};Private $full
  if($item.PSIsContainer){if($full -notin $knownDirs){throw 'OWNERSHIP_COMPILE_ONLY_UNEXPECTED_DIRECTORY'};$actualDirs+=$full;$queue.Push($full)}else{if($full -notin $knownFiles){throw 'OWNERSHIP_COMPILE_ONLY_UNEXPECTED_FILE'};$actualFiles+=@{path=$full;hash=(Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash}}
 }}
 foreach($file in $actualFiles){Private $file.path;if((Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash -cne $file.hash){throw 'OWNERSHIP_COMPILE_ONLY_CLEANUP_CHANGED'};Remove-Item -LiteralPath $file.path -Force}
 foreach($dir in ($actualDirs|Sort-Object Length -Descending)){Private $dir;if(@(Get-ChildItem -LiteralPath $dir -Force).Count){throw 'OWNERSHIP_COMPILE_ONLY_CLEANUP_NOT_EMPTY'};Remove-Item -LiteralPath $dir -Force}
 # 삭제 결과와 별도 재조회로 관련 process/root 부재를 확인한다. 소비 marker는 보존한다.
 if(Test-Path -LiteralPath $qa){throw 'OWNERSHIP_COMPILE_ONLY_CLEANUP_REMAINS'};RelatedZero;$state.qaRootAbsent=$true
}
function Finalization {
 $outSettled=(!$captureContext.outTask -or $captureContext.outTask.IsCompleted);$errSettled=(!$captureContext.errTask -or $captureContext.errTask.IsCompleted);$exited=(!$compiler -or !$state.processStarted)
 if(!$exited){try{$exited=$compiler.HasExited}catch{$exited=$false}}
 $key=([int]$outSettled).ToString()+([int]$errSettled).ToString()+([int]$exited).ToString()
 return $p.finalizationPolicies[$key]
}
function ReleaseCompleted {
 $policy=Finalization;if(!$policy.canDisposeProcess){return $false}
 foreach($task in @($captureContext.outTask,$captureContext.errTask)){if($task){try{$null=$task.GetAwaiter().GetResult()}catch{}}}
 foreach($buffer in @($outBuffer,$errBuffer)){[Array]::Clear($buffer,0,$buffer.Length)}
 foreach($memory in @($captureOut,$captureErr)){$buffer=$memory.GetBuffer();[Array]::Clear($buffer,0,$buffer.Length);$memory.Dispose()}
 if($compiler){$compiler.Dispose()};$readCancel.Dispose();$hostProcess.Dispose();return $true
}
try {
 Window 30;$null=Preflight
 # CLI가 고정 결정 파일을 읽고 raw/runner/input/실행 HEAD binding을 검사한 뒤 전달한 결정이다.
 # 내부 문자열은 사람의 승인을 인증하지 않는다. Main의 원문·플랫폼 대조가 선행한다.
 $marker=[IO.File]::Open($p.consumedMarker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{candidateId=$p.candidateId;executionCommit=$p.decision.executionCommit;manifestHash=$p.manifestHash;inputHash=$p.decision.inputHash;runnerHash=$p.decision.runnerHash;consumedAt=[datetimeoffset]::UtcNow.ToString('o');expiresAt=$p.decision.expiresAt}|ConvertTo-Json -Compress));$marker.Write($bytes,0,$bytes.Length);$marker.Flush($true)}finally{$marker.Dispose()}
 $state.oneUseConsumed=$true;Private $p.consumedMarker
 Window 30;if(Test-Path -LiteralPath $qa){throw 'OWNERSHIP_COMPILE_ONLY_ALREADY_EXISTS'}
 $null=New-Item -ItemType Directory -Path $qa -ErrorAction Stop;$rootCreated=$true;$state.qaCreated=$true;Private $qa
 foreach($name in @('src','bin','temp')){$path=$qa+'/'+$name;$null=New-Item -ItemType Directory -Path $path -ErrorAction Stop;$knownDirs+=$path;Private $path}
 foreach($f in $p.sources){
  Window 20;$null=FileFact $f $false;Private ($qa+'/src');$target=$qa+'/src/'+[IO.Path]::GetFileName($f.path);$knownFiles+=$target
  $from=[IO.File]::Open((Join-Path $p.sourceRoot $f.path),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{$to=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$from.CopyTo($to)}finally{$to.Dispose()}}finally{$from.Dispose()}
  Private $target;$copy=Get-Item -LiteralPath $target;if($copy.Length -ne $f.bytes -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -cne $f.sha256){throw 'OWNERSHIP_COMPILE_ONLY_COPY_MISMATCH'}
 }
 foreach($f in $p.tools){$null=FileFact $f $true};Window 20
 $info=[Diagnostics.ProcessStartInfo]::new($exe);$info.WorkingDirectory=$qa;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($arg in $p.argv){$info.ArgumentList.Add($arg)};$info.Environment['TEMP']=$qa+'/temp';$info.Environment['TMP']=$qa+'/temp'
 $knownFiles+=($qa+'/bin/OwnershipEvidenceSource.dll')
 $compiler=[Diagnostics.Process]::new();$compiler.StartInfo=$info;$clock=[Diagnostics.Stopwatch]::StartNew()
 if(!$compiler.Start()){throw 'OWNERSHIP_COMPILE_ONLY_START_FAILED'};$state.processStarted=$true;$state.actualCompilerExecuted=$true;$state.phase='CAPTURE'
 $evidence=CaptureOriginalCompiler -Compiler $compiler -ExpectedExe $exe -Sources $p.sources -Expires $expires -Context $captureContext -Clock $clock -StopVerified {param($candidate) StopOwned $candidate}
 # 이 네 사실은 신원/child 검증보다 먼저 보존한다. 검증 실패는 진단/exit를 삭제하지 않는다.
 $state.compilerIdentity=$evidence.compilerIdentity;$state.capture=$evidence.capture;$state.diagnostics=$evidence.diagnostics;$state.exitCode=$evidence.exitCode
 $state.phase='VERIFY'
 if(!$evidence.identityVerified){$unknown=$true;throw 'OWNERSHIP_COMPILE_ONLY_IDENTITY_UNKNOWN'}
 $proof=@{pid=$evidence.compilerIdentity.pid;ticks=[int64]$evidence.compilerIdentity.startTicks}
 try{Owned}catch{$unknown=$true;throw}
 if($evidence.failure){if($evidence.failure -in @('OWNERSHIP_COMPILE_ONLY_EXIT_UNKNOWN','OWNERSHIP_COMPILE_ONLY_STOP_UNKNOWN','OWNERSHIP_COMPILE_ONLY_CAPTURE_FAILED')){$unknown=$true};throw $evidence.failure}
 $dll=$qa+'/bin/OwnershipEvidenceSource.dll';Private $dll;$item=Get-Item -LiteralPath $dll;if($item -isnot [IO.FileInfo] -or $item.Length -le 0){throw 'OWNERSHIP_COMPILE_ONLY_OUTPUT_INVALID'}
 $state.output=@{path='bin/OwnershipEvidenceSource.dll';bytes=$item.Length;sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash};$state.status='PASS_COMPILE_ONLY';$state.phase='CLEANUP'
}catch{$code=[string]$_.Exception.Message;$state.failure=if($code -match '^OWNERSHIP_COMPILE_ONLY_[A-Z_]+$'){$code}else{'OWNERSHIP_COMPILE_ONLY_UNCLASSIFIED_FAILURE'};if($state.processStarted -and !$state.capture){$unknown=$true}}
finally {
 try{if($compiler -and $state.processStarted -and !$compiler.HasExited){StopOwned}}catch{$unknown=$true;$state.cleanupFailure='OWNERSHIP_COMPILE_ONLY_STOP_UNKNOWN'}
 $readCancel.Cancel();$drain=[Diagnostics.Stopwatch]::StartNew()
 while(!(Finalization).canDisposeProcess -and $drain.ElapsedMilliseconds -lt 1000){Start-Sleep -Milliseconds 5};$drain.Stop()
 $state.finalization=Finalization
 if($state.finalization.canDisposeProcess){
  try{Cleanup}catch{$state.cleanupFailure='OWNERSHIP_COMPILE_ONLY_CLEANUP_PRESERVED';$state.status='FAIL_COMPILE_ONLY'}
  $null=ReleaseCompleted
  $state.memoryCleanupComplete=$true;if($state.capture){$state.capture.managedBufferClearAttempted=$true}
 }else{
  $unknown=$true;$state.status='HANDOFF_REQUIRED';$state.handoffRequired=$true;$state.cleanupFailure='OWNERSHIP_COMPILE_ONLY_LEASE_PRESERVED';$state.phase='PRESERVED_ORIGINAL_HANDLE'
  $state.memoryCleanupComplete=$false;$state.qaCleanup='NOT_CLEANED';$state.expectedOwner='SINSAN/cyhuh'
  $state.retainedUntilHostExit=@{originalProcessObject=($null -ne $compiler);pendingReadTasks=(!$state.finalization.readsSettled);sharedReadBuffers=$true}
  $state.originalHandleTransferable=$false;$state.hostExitReleasesOriginalHandle=$true;$state.maximumLifetimeGuaranteed=$false
  $state.requiredNextAction='FRESH_VERIFY_RECORDED_PID_START_EXE_AND_OS_DENIAL_BEFORE_SEPARATE_RECOVERY_DECISION'
 }
}
$state|ConvertTo-Json -Depth 8 -Compress
if($state.handoffRequired){
 # 미완료 읽기에 공유 버퍼를 zero/dispose하지 않는다. 원 객체는 host 종료 때까지만 참조한다.
 # host 종료는 원 kernel handle을 해제하므로 다음 담당에게 같은 handle이 전달되지 않는다.
 # 다음 담당은 기록한 PID/start/관측exe를 새로 검증해야 하며 새 keeper/상주호스트는 만들지 않는다.
 exit 1
}
if($state.status -ne 'PASS_COMPILE_ONLY'){exit 1}
`;

function scriptText(script: string, payload: unknown) {
  return script.replace('__PAYLOAD__', Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'));
}
/** AST 구문 검사 전용 공개 값. 문자열을 읽는 것은 실행이 아니다. */
export const ownershipCompileOnlyWindowsScripts = Object.freeze({metadata: metadataScript, apply: applyScript, bootstrap, capture: captureScript});
function encoded(script: string) { return Buffer.from(script, 'utf16le').toString('base64'); }

function readGit(args: string[]) {
  const result = spawnSync('git.exe', args, {cwd: sourceRoot, windowsHide: true, shell: false, encoding: 'utf8', maxBuffer: 65536, timeout: 10000});
  if (result.error || result.status !== 0 || result.signal) return compileOnlyFail('GIT_UNVERIFIED');
  return result.stdout.trim();
}
function gitFacts(sources: {path: string}[]) {
  if (readGit(['rev-parse', '--show-toplevel']).replaceAll('\\', '/').toLowerCase() !== sourceRoot.replaceAll('\\', '/').toLowerCase()) return compileOnlyFail('GIT_ROOT_UNVERIFIED');
  const actualHead = readGit(['rev-parse', 'HEAD']);
  const branch = readGit(['branch', '--show-current']);
  const changed = readGit(['diff', fixed.sourceCheckpoint, '--', ...sources.map(x => x.path)]);
  const untracked = readGit(['ls-files', '--others', '--exclude-standard', '--', ...sources.map(x => x.path)]);
  const remote = readGit(['remote', 'get-url', 'development']);
  if (branch !== fixed.branch || changed || untracked || remote !== 'git@github-sinsan-develop:sinsan-develop/Anvil.git') return compileOnlyFail('GIT_UNVERIFIED');
  const remoteHead = readGit(['ls-remote', '--exit-code', 'development', 'refs/heads/' + fixed.branch]);
  if (remoteHead !== actualHead + '\trefs/heads/' + fixed.branch) return compileOnlyFail('PRIVATE_HEAD_UNVERIFIED');
  return {branch, sourceCheckpoint: fixed.sourceCheckpoint, actualHead, sourceUnchanged: true, privateRemoteVerified: true};
}

function readMetadata(script: string, payload: unknown) {
  const input = scriptText(script, payload);
  if (Buffer.byteLength(input) > 65536) return compileOnlyFail('SCRIPT_TOO_LARGE');
  const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded(bootstrap)], {input, cwd: sourceRoot, windowsHide: true, shell: false, encoding: 'utf8', timeout: 20000, maxBuffer: 32768});
  if (result.error || result.status !== 0 || result.signal || result.stderr.trim()) return compileOnlyFail('METADATA_UNVERIFIED');
  try { return JSON.parse(result.stdout); } catch { return compileOnlyFail('METADATA_UNVERIFIED'); }
}

function readDecisionFile(path: string): unknown {
  if (path !== fixed.decisionPath) return compileOnlyFail('DECISION_PATH_INVALID');
  try {
    const full = resolve(sourceRoot, path);
    // 결정 경로 및 모든 조상의 symbolic/reparse 우회는 읽기 전에 거절한다.
    for (let item = full; item !== parse(item).root; item = dirname(item)) {
      const stat = lstatSync(item);
      if (stat.isSymbolicLink() || realpathSync.native(item).toLowerCase() !== item.toLowerCase()) return compileOnlyFail('DECISION_PATH_INVALID');
    }
    const stat = lstatSync(full);
    if (!stat.isFile() || stat.size > 32768) return compileOnlyFail('DECISION_INVALID');
    const raw = readFileSync(full);
    if (raw.length > 32768) return compileOnlyFail('DECISION_INVALID');
    // JSON 중복키는 재직렬화로 승인 내용을 유추하지 않고 별도 차단한다.
    const text = raw.toString('utf8'), keys = [...text.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map(m => JSON.parse('"' + m[1] + '"'));
    if (new Set(keys).size !== keys.length) return compileOnlyFail('DECISION_DUPLICATE_KEY');
    return JSON.parse(text);
  } catch { return compileOnlyFail('DECISION_UNAVAILABLE'); }
}

/** 외부 PS 결과도 bounded 수집한다. outer timeout은 compiler tree를 광역 종료하지 않고 UNKNOWN으로 보고한다. */
async function applyWindows(payload: unknown) {
  const script = scriptText(applyScript, payload);
  if (Buffer.byteLength(script) > 65536) return compileOnlyFail('SCRIPT_TOO_LARGE');
  const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded(bootstrap)], {cwd: sourceRoot, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe']});
  child.stdin.on('error', () => { /* 시작/종료 결과는 아래 error/close에서 판정한다. */ });
  child.stdin.end(script);
  return await new Promise<any>((accept, reject) => {
    const buffers: Buffer[] = []; let bytes = 0, overflow = false, done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      reject(Error('OWNERSHIP_COMPILE_ONLY_OUTER_TIMEOUT_UNKNOWN'));
    }, 60000);
    const data = (chunk: Buffer) => {
      if (done || overflow) return;
      if (bytes + chunk.length > 16384) { overflow = true; return; }
      bytes += chunk.length; buffers.push(Buffer.from(chunk));
      if (chunk.includes(10)) {
        try {
          const value = JSON.parse(Buffer.concat(buffers).toString('utf8'));
          if (value.status === 'HANDOFF_REQUIRED' && value.handoffRequired === true && value.hostIdentity?.pid > 0) {
            done = true; clearTimeout(timer);
            child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); child.unref();
            for (const buffer of buffers) buffer.fill(0);
            accept(value);
          }
        } catch { /* 분할된 JSON은 close 또는 다음 chunk에서만 판정한다. */ }
      }
    };
    child.stdout.on('data', data); child.stderr.on('data', data);
    child.once('error', () => { if (done) return; done = true; clearTimeout(timer); reject(Error('OWNERSHIP_COMPILE_ONLY_OUTER_START_FAILED')); });
    child.once('close', code => {
      if (done) return; done = true; clearTimeout(timer);
      try {
        if (overflow) return reject(Error('OWNERSHIP_COMPILE_ONLY_OUTER_CAPTURE_UNKNOWN'));
        const value = JSON.parse(Buffer.concat(buffers).toString('utf8'));
        if (!value || (code !== 0 && value.status === 'PASS_COMPILE_ONLY')) return reject(Error('OWNERSHIP_COMPILE_ONLY_OUTER_RESULT_UNKNOWN'));
        accept(value);
      } catch { reject(Error('OWNERSHIP_COMPILE_ONLY_OUTER_RESULT_UNKNOWN')); }
      finally { for (const buffer of buffers) buffer.fill(0); }
    });
  });
}

function windowsPorts(): Ports {
  if (process.platform !== 'win32') return compileOnlyFail('WINDOWS_REQUIRED');
  let prepared: {manifestRaw: Buffer; observations: any; binding: any; payload: any} | null = null;
  return {
    async readPreparation() {
      const manifestRaw = readFileSync(resolve(sourceRoot, fixed.manifestPath));
      const manifest = readOwnershipCompileOnlyManifest(manifestRaw);
      const git = gitFacts(manifest.sources);
      const payload = {...fixed, sourceRoot, ...manifest, finalizationPolicies: ownershipCompileOnlyFinalizationPolicies};
      const facts = readMetadata(metadataScript, payload);
      const binding = {candidateId: fixed.candidateId, manifestHash: fixed.manifestHash, sourceCheckpoint: fixed.sourceCheckpoint, executionCommit: git.actualHead,
        inputHash: compileOnlyHash(readFileSync(resolve(sourceRoot, 'scripts/fn06-ownership-compile-only-input.ts'))), runnerHash: compileOnlyHash(readFileSync(fileURLToPath(import.meta.url))),
        qaRoot: fixed.qaRoot, output: fixed.output, limits: {qaLifetimeMs: 1800000, compilerTimeoutMs: 15000, diagnosticBytes: 16384, compilerAttempts: 1}, decisionPath: fixed.decisionPath, observedAt: new Date().toISOString(), consumedMarkerExists: false};
      prepared = {manifestRaw, observations: {...facts, git}, binding, payload};
      return prepared;
    },
    async readDecision(path) { return readDecisionFile(path); },
    report(value) { process.stdout.write(JSON.stringify(value) + '\n'); },
    async executeCompileOnly(plan, decision) {
      if (!prepared) return compileOnlyFail('PREPARATION_REQUIRED');
      // 마지막 read-only 재검사 뒤에도 PS가 부모·부재·source/tool·창을 다시 검사한다.
      const git = gitFacts(prepared.payload.sources);
      const current = {...prepared.binding, executionCommit: git.actualHead, observedAt: new Date().toISOString()};
      current.inputHash = compileOnlyHash(readFileSync(resolve(sourceRoot, 'scripts/fn06-ownership-compile-only-input.ts')));
      current.runnerHash = compileOnlyHash(readFileSync(fileURLToPath(import.meta.url)));
      const freshDecision = readDecisionFile(fixed.decisionPath);
      validateOwnershipCompileOnlyDecision(freshDecision, current);
      if (JSON.stringify(freshDecision) !== JSON.stringify(decision) || plan.actualHead !== git.actualHead) return compileOnlyFail('BINDING_CHANGED');
      return applyWindows({...prepared.payload, argv: plan.argv, decision: freshDecision});
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const result = await runOwnershipCompileOnly(process.argv.slice(2), windowsPorts()); if (!['PLAN_ONLY', 'PASS_COMPILE_ONLY'].includes(result.status)) process.exitCode = 1; }
  catch (error) {
    const message = error instanceof Error && /^OWNERSHIP_COMPILE_ONLY_[A-Z_]+$/.test(error.message) ? error.message : 'OWNERSHIP_COMPILE_ONLY_UNCLASSIFIED_FAILURE';
    process.stderr.write(JSON.stringify({status: 'FAIL_COMPILE_ONLY', failure: message, externalUserApprovalVerified: false}) + '\n'); process.exitCode = 1;
  }
}
