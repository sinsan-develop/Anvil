param([switch]$Plan)
$ErrorActionPreference='Stop'
# source-only 진입은 고정 차단한다. 아래 R0 본문은 실제 compiler/OS 실행 검증을 받지 않았다.
function New-DevelopmentRecoveryR0Budget([datetimeoffset]$UtcNow,[long]$MonotonicMs) {
 if($UtcNow.Offset -ne [timespan]::Zero -or $MonotonicMs -lt 0){throw 'DEVELOPMENT_RECOVERY_R0_CLOCK_INVALID'}
 return @{startedUtc=$UtcNow;previousUtc=$UtcNow;startedMono=$MonotonicMs;previousMono=$MonotonicMs;clockInvalid=$false}
}
function Get-DevelopmentRecoveryR0Budget([hashtable]$Clock,[datetimeoffset]$UtcNow,[long]$MonotonicMs) {
 if($Clock.clockInvalid -or $UtcNow.Offset -ne [timespan]::Zero -or $UtcNow -lt $Clock.previousUtc -or $MonotonicMs -lt $Clock.previousMono){
  $Clock.clockInvalid=$true;throw 'DEVELOPMENT_RECOVERY_R0_CLOCK_INVALID'
 }
 $Clock.previousUtc=$UtcNow;$Clock.previousMono=$MonotonicMs
 # 두 시계 중 더 많이 소비한 시간을 사용한다. UTC 전진도 창을 연장하지 않는다.
 $elapsed=[math]::Max(($UtcNow-$Clock.startedUtc).TotalMilliseconds,($MonotonicMs-$Clock.startedMono))
 return @{elapsedMs=[long][math]::Ceiling($elapsed);compilerRemainingMs=[long][math]::Max(0,480000-$elapsed);totalRemainingMs=[long][math]::Max(0,600000-$elapsed)}
}
function Get-DevelopmentRecoveryR0FailureAction([hashtable]$Run,[bool]$OriginalCaptured,[long]$MonotonicMs,[long]$TotalRemainingMs) {
 # 순수 상태 전이이며 실행 허가가 아니다. 실제 catch가 원 반환의 확보 사실로만 호출한다.
 $action=@{requestTermination=$false;observe=$false;waitMs=0L;preserve=$true}
 $Run.cleanup='PRESERVED_UNCONFIRMED'
 if(!$OriginalCaptured -or $Run.exitObserved -or $TotalRemainingMs -le 0){return $action}
 if($null -eq $Run.terminationDeadlineMono){
  # 이미 요청했는데 원 기한을 잃었으면 새 15초 창을 열지 않는다.
  if($Run.killAttempted){return $action}
  $Run.terminationDeadlineMono=$MonotonicMs+[math]::Min(15000,$TotalRemainingMs)
 }
 if($MonotonicMs -ge $Run.terminationDeadlineMono){return $action}
 if(!$Run.killAttempted){$Run.killAttempted=$true;$action.requestTermination=$true}
 $action.observe=$true
 $action.waitMs=[long][math]::Min(10,[math]::Min($TotalRemainingMs,$Run.terminationDeadlineMono-$MonotonicMs))
 # read fault/EOF는 수정하지 않는다. 종료 요청·종료 관측은 별개의 사실이다.
 return $action
}
function New-DevelopmentRecoveryR0DiagnosticState {
 $state=@{entries=[Collections.Generic.List[object]]::new();omittedRecords=0L}
 foreach($name in @('stdout','stderr')){
  $state[$name]=@{bytes=0L;lines=0L;oversizeLines=0L;lineBuffer=[byte[]]::new(1024);lineLength=0;lineOversize=$false;eof=$false;
   sha=[Security.Cryptography.SHA256]::Create();sha256='NOT_FINAL_EOF_UNCONFIRMED'}
 }
 return $state
}
function Complete-DevelopmentRecoveryR0DiagnosticLine([hashtable]$State,[string]$Channel) {
 $s=$State[$Channel];$s.lines++
 if($s.lineOversize){$s.oversizeLines++}
 $text=[Text.Encoding]::ASCII.GetString($s.lineBuffer,0,$s.lineLength)
 # 원문·파일명·임의 exception 본문을 저장하지 않고 고정 ID와 줄번호만 추출한다.
 # 지역화된 오류/경고 단어 대신 고정 CS ID와 뒤의 진단 구분자만 대조한다.
 $id=[regex]::Match($text,'\b(CS[0-9]{4,5})\b(?=\s*:)',[Text.RegularExpressions.RegexOptions]::CultureInvariant)
 if($id.Success){
  $lineMatch=[regex]::Match($text,'\(([0-9]{1,9})(?:,[0-9]{1,9})?\)',[Text.RegularExpressions.RegexOptions]::CultureInvariant)
  $line=$null;if($lineMatch.Success){$line=[int]$lineMatch.Groups[1].Value}
  if($State.entries.Count -lt 200){$State.entries.Add([pscustomobject]@{stream=$Channel;errorId=$id.Groups[1].Value;line=$line;oversize=$s.lineOversize})}
  else{$State.omittedRecords++}
 }
 [Array]::Clear($s.lineBuffer,0,$s.lineBuffer.Length);$s.lineLength=0;$s.lineOversize=$false
}
function Add-DevelopmentRecoveryR0DiagnosticBytes([hashtable]$State,[string]$Channel,[byte[]]$Bytes,[int]$Offset,[int]$Count) {
 if($Channel -cnotin @('stdout','stderr') -or $Offset -lt 0 -or $Count -lt 0 -or $Offset -gt $Bytes.Length-$Count -or $State[$Channel].eof){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_INVALID'}
 $s=$State[$Channel]
 if($Count){$null=$s.sha.TransformBlock($Bytes,$Offset,$Count,$null,0);$s.bytes+=$Count}
 for($i=$Offset;$i -lt $Offset+$Count;$i++){
  if($Bytes[$i] -eq 10){Complete-DevelopmentRecoveryR0DiagnosticLine $State $Channel}
  elseif($s.lineLength -lt $s.lineBuffer.Length){$s.lineBuffer[$s.lineLength]=$Bytes[$i];$s.lineLength++}
  else{$s.lineOversize=$true}
 }
}
function Complete-DevelopmentRecoveryR0DiagnosticStream([hashtable]$State,[string]$Channel) {
 if($Channel -cnotin @('stdout','stderr') -or $State[$Channel].eof){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_INVALID'}
 $s=$State[$Channel];if($s.lineLength -or $s.lineOversize){Complete-DevelopmentRecoveryR0DiagnosticLine $State $Channel}
 $null=$s.sha.TransformFinalBlock([byte[]]::new(0),0,0)
 $s.sha256=[BitConverter]::ToString($s.sha.Hash).Replace('-','');$s.sha.Dispose();$s.eof=$true
}
function ConvertTo-DevelopmentRecoveryR0Diagnostics([hashtable]$State,$ExitCode,[long]$ElapsedMs,[string]$Status,[string]$Cleanup) {
 if($Status -cnotin @('COMPILE_FAILED','COMPILE_RETURNED_NOT_OS_VALIDATED','TIMEOUT','RUN_UNCONFIRMED') -or
  $Cleanup -cnotin @('PRESERVED_UNCONFIRMED','OWNED_FILES_REMOVED_NOT_OS_VALIDATED')){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_INVALID'}
 $value=[ordered]@{schemaVersion=1;status=$Status;cleanup=$Cleanup;exitCode=$ExitCode;elapsedMs=$ElapsedMs;
  sourceCommit='d71eb50870b088f57e1648ee4a1eba36aa058557';sourceBytes=96953;
  sourceSha256='F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49';
  compilerSha256='46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00';
  entries=@($State.entries.ToArray());omittedRecords=$State.omittedRecords;truncated=($State.omittedRecords -gt 0);
  executionAuthorized=$false;osVerified=$false;outputOwnership='NOT_PROVEN_BY_PATHNAME';extraCompilerOutputs='UNCONFIRMED';bootstrapRace='PARENT_AND_CLEANUP_PATHNAME_RACE_UNRESOLVED'}
 foreach($name in @('stdout','stderr')){
  $s=$State[$name];$value[$name]=@{bytes=$s.bytes;lines=$s.lines;oversizeLines=$s.oversizeLines;sha256=$s.sha256;eof=$s.eof}
  if($s.oversizeLines){$value.truncated=$true}
 }
 $json=ConvertTo-Json -InputObject $value -Depth 6 -Compress
 if([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536 -or $json.Split([char]10).Length -gt 256){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_LIMIT'}
 return @{value=$value;json=$json}
}
function Copy-DevelopmentRecoveryR0Source([byte[]]$GitSourceBytes) {
 # 원 exec가 exact Git stdout을 raw byte[]로 사전 취득하는 경계는 별도 실행 패킷에 포함한다.
 # runner 안의 git.exe/현재 파일/UTF8 문자열 재인코딩으로 이 입력을 대체하지 않는다.
 if($null -eq $GitSourceBytes -or $GitSourceBytes.Length -ne 96953){throw 'DEVELOPMENT_RECOVERY_R0_SOURCE_INVALID'}
 $copy=[byte[]]$GitSourceBytes.Clone();$sha=$null;$git=$null
 try{
  $sha=[Security.Cryptography.SHA256]::Create();$digest=[BitConverter]::ToString($sha.ComputeHash($copy)).Replace('-','')
  $git=[Security.Cryptography.SHA1]::Create();$header=[Text.Encoding]::ASCII.GetBytes("blob 96953`0")
  $null=$git.TransformBlock($header,0,$header.Length,$null,0);$null=$git.TransformFinalBlock($copy,0,$copy.Length)
  $blob=[BitConverter]::ToString($git.Hash).Replace('-','').ToLowerInvariant()
  if($digest -cne 'F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49' -or $blob -cne '8d38a21bf18f5b6bed95c8582b87d12e090d95f3'){throw 'DEVELOPMENT_RECOVERY_R0_SOURCE_INVALID'}
  return ,$copy
 }catch{[Array]::Clear($copy,0,$copy.Length);throw 'DEVELOPMENT_RECOVERY_R0_SOURCE_INVALID'}
 finally{if($sha){$sha.Dispose()};if($git){$git.Dispose()}}
}
# 불명 원 객체의 유일 보관함: 외부 입력/승인 토큰이 아니며 조회·비우기·재시도 API를 제공하지 않는다.
# closure 안의 목록은 원 process/read-task/배열/stream을 GC/finalizer에 넘기지 않는다.
if(!(Get-Variable -Name DevelopmentRecoveryR0Retain -Scope Script -ErrorAction Ignore)){
$script:DevelopmentRecoveryR0Retain = & {
 $lifetime=@{started=$false;retained=$null}
 {
  param([string]$Operation,$Run)
  if($Operation -ceq 'BEGIN'){
   if($lifetime.started){throw 'DEVELOPMENT_RECOVERY_R0_ALREADY_ATTEMPTED'}
   $lifetime.started=$true
  }elseif($Operation -ceq 'RETAIN'){
   if(!$lifetime.started -or $null -ne $lifetime.retained){throw 'DEVELOPMENT_RECOVERY_R0_LIFETIME_INVALID'}
   $lifetime.retained=$Run
  }else{throw 'DEVELOPMENT_RECOVERY_R0_LIFETIME_INVALID'}
 }.GetNewClosure()
}
}
function Invoke-DevelopmentRecoveryR0CompileSource([byte[]]$GitSourceBytes) {
 # 이 고정 throw는 첫 I/O와 내부 I/O 함수 정의보다 앞선다. caller bool/JSON/digest는 제거 권위가 아니다.
 throw 'DEVELOPMENT_RECOVERY_R0_NOT_AUTHORIZED'
 # 아래는 검수할 실제 runner 본문이며 현재 실행 불가다. raw 취득/호출/종료 요청까지 별도 exact 실행 경계다.
function Get-DevelopmentRecoveryR0PathObservation([string]$Path) {
 $full=[IO.Path]::GetFullPath($Path)
 $item=Get-Item -LiteralPath $full -Force
 $cursor=$item
 while($cursor){
  if(($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $cursor.LinkTarget){throw 'DEVELOPMENT_RECOVERY_R0_PATH_UNCONFIRMED'}
  if($cursor -is [IO.DirectoryInfo]){$cursor=$cursor.Parent}else{$cursor=$cursor.Directory}
 }
 if(![string]::Equals($item.FullName,$full,[StringComparison]::OrdinalIgnoreCase)){throw 'DEVELOPMENT_RECOVERY_R0_PATH_UNCONFIRMED'}
 $acl=Get-Acl -LiteralPath $full
 $owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
 $writeMask=[Security.AccessControl.FileSystemRights]'Write,Delete,ChangePermissions,TakeOwnership'
 foreach($rule in $acl.Access){
  $sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and ($rule.FileSystemRights -band $writeMask) -ne 0 -and
   $sid -cnotin @($owner,'S-1-5-18','S-1-5-32-544')){throw 'DEVELOPMENT_RECOVERY_R0_PROTECTION_UNCONFIRMED'}
 }
 $hash=[Security.Cryptography.SHA256]::Create()
 try{$aclHash=[BitConverter]::ToString($hash.ComputeHash($acl.GetSecurityDescriptorBinaryForm())).Replace('-','')}finally{$hash.Dispose()}
 return @{path=$full;owner=$owner;created=$item.CreationTimeUtc.Ticks;aclHash=$aclHash;
  attributes=[int]$item.Attributes;directory=($item -is [IO.DirectoryInfo]);nativeFileIdVerified=$false}
}
function Assert-DevelopmentRecoveryR0PathObservation([hashtable]$Original) {
 $current=Get-DevelopmentRecoveryR0PathObservation $Original.path
 if($current.owner -cne $Original.owner -or $current.aclHash -cne $Original.aclHash -or $current.created -ne $Original.created -or $current.attributes -ne $Original.attributes -or
  $current.directory -ne $Original.directory){throw 'DEVELOPMENT_RECOVERY_R0_IDENTITY_UNCONFIRMED'}
 # 메타데이터/경로 재대조는 native FileId 검증이 아니다. 부모교체·정리 pathname race는 남는다.
}
function Get-DevelopmentRecoveryR0StreamDigest([IO.Stream]$Stream,[hashtable]$Clock,[Diagnostics.Stopwatch]$Timer) {
 $hash=[Security.Cryptography.SHA256]::Create();$buffer=[byte[]]::new(8192)
 try{
  $Stream.Position=0;$length=$Stream.Length
  if($length -gt 67108864){throw 'DEVELOPMENT_RECOVERY_R0_FILE_LIMIT'}
  while($true){
   $budget=Get-DevelopmentRecoveryR0Budget $Clock ([datetimeoffset]::UtcNow) $Timer.ElapsedMilliseconds
   if($budget.totalRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_WINDOW_EXPIRED'}
   $count=$Stream.Read($buffer,0,$buffer.Length);if($count -eq 0){break}
   $null=$hash.TransformBlock($buffer,0,$count,$null,0)
  }
  if($Stream.Length -ne $length){throw 'DEVELOPMENT_RECOVERY_R0_IDENTITY_UNCONFIRMED'}
  $null=$hash.TransformFinalBlock([byte[]]::new(0),0,0)
  return @{sha256=[BitConverter]::ToString($hash.Hash).Replace('-','');bytes=$length}
 }finally{[Array]::Clear($buffer,0,$buffer.Length);$hash.Dispose()}
}
function Write-DevelopmentRecoveryR0OwnedDiagnostics([hashtable]$Run,[hashtable]$Clock,[Diagnostics.Stopwatch]$Timer) {
 if($Run.diagnosticsWriteAttempted -or $Run.owned.Count -ne 2){return}
 $budget=Get-DevelopmentRecoveryR0Budget $Clock ([datetimeoffset]::UtcNow) $Timer.ElapsedMilliseconds;$Run.elapsedMs=$budget.elapsedMs
 if($budget.totalRemainingMs -eq 0){return}
 $diagnostics=$Run.owned[1]
 Assert-DevelopmentRecoveryR0PathObservation $diagnostics.observation
 if($diagnostics.stream.Length -ne 0){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_NOT_EMPTY'}
 $report=ConvertTo-DevelopmentRecoveryR0Diagnostics $Run.diagnostics $Run.exitCode $Run.elapsedMs $Run.status $Run.cleanup
 $report.value.output=$Run.output;$report.value.exitObserved=$Run.exitObserved;$report.value.killAttempted=$Run.killAttempted
 foreach($name in @('stdout','stderr')){$report.value[$name].pendingRead=($Run.reads.ContainsKey($name) -and $null -ne $Run.reads[$name].pending)}
 $json=ConvertTo-Json -InputObject $report.value -Depth 6 -Compress
 if([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536 -or $json.Split([char]10).Length -gt 256){throw 'DEVELOPMENT_RECOVERY_R0_DIAGNOSTICS_LIMIT'}
 $data=[Text.Encoding]::UTF8.GetBytes($json)
 try{
  # 새 자기 CreateNew stream에 단 한 번만 쓴다. 부분 쓰기/오류 뒤 덮어쓰기·재시도0.
  $Run.diagnosticsWriteAttempted=$true
  $diagnostics.stream.Write($data,0,$data.Length);$diagnostics.stream.Flush($true)
  $diagnostics.sha256=(Get-DevelopmentRecoveryR0StreamDigest $diagnostics.stream $Clock $Timer).sha256
 }finally{[Array]::Clear($data,0,$data.Length)}
}
 $timer=[Diagnostics.Stopwatch]::StartNew()
 $clock=New-DevelopmentRecoveryR0Budget ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
 $run=@{process=$null;processHandle=$null;originalProcessCaptured=$false;startAttempted=$false;exitObserved=$false;exitCode=$null;killAttempted=$false;terminationDeadlineMono=$null;
  reads=@{};diagnostics=New-DevelopmentRecoveryR0DiagnosticState;pins=[Collections.Generic.List[object]]::new();
  owned=[Collections.Generic.List[object]]::new();directories=[Collections.Generic.List[object]]::new();source=$null;
  status='RUN_UNCONFIRMED';cleanup='PRESERVED_UNCONFIRMED';output=$null;outputOwnership='NOT_PROVEN_BY_PATHNAME';extraItems=$false;elapsedMs=0L;diagnosticsWriteAttempted=$false}
 & $script:DevelopmentRecoveryR0Retain 'BEGIN' $null
 $bootstrap='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01'
 $compile=$bootstrap+'\compile';$sourcePath=$compile+'\development-recovery-path-guard.cs'
 $outputPath=$compile+'\DevelopmentRecoveryPathGuard.dll';$diagnosticsPath=$compile+'\diagnostics.json'
 $compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
 $expected=@{
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'='46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00'
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll'='11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C'
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll'='2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71'
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll'='8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D'
 }
 try{
  $run.source=Copy-DevelopmentRecoveryR0Source $GitSourceBytes
  $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $parent=Get-DevelopmentRecoveryR0PathObservation 'D:\Project\Anvil\.av3-data'
  if(!$parent.directory -or $parent.owner -cne $owner){throw 'DEVELOPMENT_RECOVERY_R0_PARENT_UNCONFIRMED'}
  # 기존 root/compile/세 leaf를 채택하거나 덮어쓰지 않는다. ACL 수리·다른 root 우회도 없다.
  foreach($path in @($bootstrap,$compile,$sourcePath,$outputPath,$diagnosticsPath)){
   if(Test-Path -LiteralPath $path){throw 'DEVELOPMENT_RECOVERY_R0_PATH_EXISTS'}
  }
  foreach($path in $expected.Keys){
   $before=Get-DevelopmentRecoveryR0PathObservation $path
   $pin=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
   $run.pins.Add($pin)
   $digest=Get-DevelopmentRecoveryR0StreamDigest $pin $clock $timer
   Assert-DevelopmentRecoveryR0PathObservation $before
   if($digest.sha256 -cne $expected[$path]){throw 'DEVELOPMENT_RECOVERY_R0_TOOLCHAIN_MISMATCH'}
   $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
   if($budget.compilerRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_PREFLIGHT_EXPIRED'}
  }
  Assert-DevelopmentRecoveryR0PathObservation $parent
  foreach($path in @($bootstrap,$compile)){
   $created=New-Item -Path $path -ItemType Directory -ErrorAction Stop
   # 성공 반환 즉시 자기 생성 목록에 보관한다. 후속 관측 실패도 삭제하지 않는다.
   $record=@{path=$path;createdObject=$created;observation=$null};$run.directories.Add($record)
   $record.observation=Get-DevelopmentRecoveryR0PathObservation $path
   if($record.observation.owner -cne $owner){throw 'DEVELOPMENT_RECOVERY_R0_OWNER_UNCONFIRMED'}
  }
  foreach($path in @($sourcePath,$diagnosticsPath)){
   $file=[IO.FileStream]::new($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
   $record=@{path=$path;stream=$file;observation=$null;sha256=$null};$run.owned.Add($record)
   $record.observation=Get-DevelopmentRecoveryR0PathObservation $path
   if($record.observation.owner -cne $owner){throw 'DEVELOPMENT_RECOVERY_R0_OWNER_UNCONFIRMED'}
  }
  $source=$run.owned[0];$source.stream.Write($run.source,0,$run.source.Length);$source.stream.Flush($true)
  $source.sha256=(Get-DevelopmentRecoveryR0StreamDigest $source.stream $clock $timer).sha256
  if($source.sha256 -cne 'F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49'){throw 'DEVELOPMENT_RECOVERY_R0_SOURCE_INVALID'}
  foreach($directory in $run.directories){Assert-DevelopmentRecoveryR0PathObservation $directory.observation}
  foreach($file in $run.owned){Assert-DevelopmentRecoveryR0PathObservation $file.observation}
  if(Test-Path -LiteralPath $outputPath){throw 'DEVELOPMENT_RECOVERY_R0_PATH_EXISTS'}
  $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
  if($budget.compilerRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_PREFLIGHT_EXPIRED'}
  $psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$compiler;$psi.WorkingDirectory=$compile
  $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
  $psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
  $psi.Arguments='/noconfig /nologo /nostdlib+ /target:library /platform:x64 /optimize- /debug- /warn:4 /errorreport:none /out:D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile\DevelopmentRecoveryPathGuard.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile\development-recovery-path-guard.cs'
  # 부모 환경 전체 승계0. CLR/COR profiling·startup hook·COMPLUS·PATH 등의 주입 변수를 받지 않는다.
  $psi.EnvironmentVariables.Clear()
  $psi.EnvironmentVariables['SystemRoot']='C:\Windows';$psi.EnvironmentVariables['windir']='C:\Windows'
  $psi.EnvironmentVariables['TEMP']=$compile;$psi.EnvironmentVariables['TMP']=$compile
  # TEMP를 이 경로에 한정해도 compiler 내부 추가 산출/밖의 암묵 I/O는 입증되지 않았다.
  # 정확3파일 상한은 후관측 기준이며 quota/sandbox 보장이 아니다. 실제 실행 패킷의 미충족 delta다.
  $run.startAttempted=$true
  $run.process=[Diagnostics.Process]::Start($psi)
  if(!$run.process){throw 'DEVELOPMENT_RECOVERY_R0_START_UNCONFIRMED'}
  $run.processHandle=$run.process.SafeHandle
  if(!$run.processHandle -or $run.processHandle.IsClosed -or $run.processHandle.IsInvalid){throw 'DEVELOPMENT_RECOVERY_R0_START_UNCONFIRMED'}
  $run.originalProcessCaptured=$true
  foreach($name in @('stdout','stderr')){
   $stream=$(if($name -ceq 'stdout'){$run.process.StandardOutput.BaseStream}else{$run.process.StandardError.BaseStream})
   $read=@{stream=$stream;buffer=[byte[]]::new(4096);pending=$null;eof=$false};$run.reads[$name]=$read
   $read.pending=$stream.ReadAsync($read.buffer,0,$read.buffer.Length)
  }
  while($true){
   $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds;$run.elapsedMs=$budget.elapsedMs
   if(!$run.exitObserved -and $run.process.HasExited){$run.exitCode=$run.process.ExitCode;$run.exitObserved=$true}
   foreach($name in @('stdout','stderr')){
    $read=$run.reads[$name]
    if($read.pending -and $read.pending.IsCompleted){
     $count=$read.pending.GetAwaiter().GetResult();$read.pending=$null
     if($count -eq 0){$read.eof=$true;Complete-DevelopmentRecoveryR0DiagnosticStream $run.diagnostics $name}
     else{
      Add-DevelopmentRecoveryR0DiagnosticBytes $run.diagnostics $name $read.buffer 0 $count
      $read.pending=$read.stream.ReadAsync($read.buffer,0,$read.buffer.Length)
     }
    }
   }
   if($run.exitObserved -and $run.reads.stdout.eof -and $run.reads.stderr.eof){
    if($budget.compilerRemainingMs -eq 0){$run.status='TIMEOUT'}
    elseif($run.status -cne 'TIMEOUT'){$run.status=$(if($run.exitCode -eq 0){'COMPILE_RETURNED_NOT_OS_VALIDATED'}else{'COMPILE_FAILED'})}
    break
   }
   if($budget.compilerRemainingMs -eq 0 -and $null -eq $run.terminationDeadlineMono){
    $run.status='TIMEOUT';$run.terminationDeadlineMono=$timer.ElapsedMilliseconds+[math]::Min(15000,$budget.totalRemainingMs)
    if(!$run.exitObserved -and !$run.killAttempted){
     $run.killAttempted=$true
     try{$run.process.Kill()}catch{<# 요청 실패도 원 객체 보존. 예외 원문/추가 kill0 #>}
    }
   }
   if($budget.totalRemainingMs -eq 0 -or ($null -ne $run.terminationDeadlineMono -and $timer.ElapsedMilliseconds -ge $run.terminationDeadlineMono)){break}
   # 두 독립 byte ReadAsync를 함께 관측하며 한 stream의 대기 때문에 다른 stream을 막지 않는다.
   [Threading.Thread]::Sleep(10)
  }
  # exit·stdout EOF·stderr EOF·pending read는 독립 조건이다. Kill 반환은 exit 증거가 아니다.
  $complete=$run.exitObserved -and $run.reads.stdout.eof -and $run.reads.stderr.eof -and
   !$run.reads.stdout.pending -and !$run.reads.stderr.pending
  if(!$complete){throw 'DEVELOPMENT_RECOVERY_R0_LIFETIME_UNCONFIRMED'}
  foreach($directory in $run.directories){Assert-DevelopmentRecoveryR0PathObservation $directory.observation}
  $entries=[IO.Directory]::EnumerateFileSystemEntries($compile).GetEnumerator();$count=0
  try{
   # 4번째 항목 또는 예상 밖 첫 항목에서 중단한다. 공격적 대형 목록을 메모리에 모으지 않는다.
   while($entries.MoveNext()){
    $count++
    if($count -gt 3 -or $entries.Current -cnotin @($sourcePath,$outputPath,$diagnosticsPath)){$run.extraItems=$true;break}
   }
  }finally{$entries.Dispose()}
  if($run.extraItems){throw 'DEVELOPMENT_RECOVERY_R0_EXTRA_ITEMS_PRESERVED'}
  if(Test-Path -LiteralPath $outputPath){
   $observation=Get-DevelopmentRecoveryR0PathObservation $outputPath
   $pin=[IO.FileStream]::new($outputPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$run.pins.Add($pin)
   if($pin.Length -le 0 -or $pin.Length -gt 4194304){throw 'DEVELOPMENT_RECOVERY_R0_OUTPUT_LIMIT'}
   $run.output=Get-DevelopmentRecoveryR0StreamDigest $pin $clock $timer
   Assert-DevelopmentRecoveryR0PathObservation $observation
   if($run.output.bytes -le 0 -or $run.output.bytes -gt 4194304){throw 'DEVELOPMENT_RECOVERY_R0_OUTPUT_LIMIT'}
   # Start 뒤 생긴 파일/해시는 compiler 원생성 신원 증거가 아니다. owned 목록에 채택/삭제하지 않는다.
   $run.outputOwnership='PRESERVED_UNCONFIRMED'
  }
  $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds;$run.elapsedMs=$budget.elapsedMs
  if($budget.totalRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_WINDOW_EXPIRED'}
  Write-DevelopmentRecoveryR0OwnedDiagnostics $run $clock $timer
  if($run.output -or $run.exitCode -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_OUTPUT_OWNERSHIP_UNCONFIRMED'}
  # 출력 부재인 실패만 자기 생성 source/diagnostics를 회수할 수 있다. DLL 신원 불명은 모두 보존한다.
  foreach($file in $run.owned){
   Assert-DevelopmentRecoveryR0PathObservation $file.observation
   if((Get-DevelopmentRecoveryR0StreamDigest $file.stream $clock $timer).sha256 -cne $file.sha256){throw 'DEVELOPMENT_RECOVERY_R0_IDENTITY_UNCONFIRMED'}
  }
  foreach($file in $run.owned){
   $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
   if($budget.totalRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_WINDOW_EXPIRED'}
   Assert-DevelopmentRecoveryR0PathObservation $parent
   foreach($directory in $run.directories){Assert-DevelopmentRecoveryR0PathObservation $directory.observation}
   Assert-DevelopmentRecoveryR0PathObservation $file.observation
   # no-delete 원 leaf stream을 닫은 뒤 pathname 삭제하는 stock PS race는 원자적으로 해소되지 않는다.
   $file.stream.Dispose();Remove-Item -LiteralPath $file.path -ErrorAction Stop
  }
  for($i=$run.directories.Count-1;$i -ge 0;$i--){
   $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
   if($budget.totalRemainingMs -eq 0){throw 'DEVELOPMENT_RECOVERY_R0_WINDOW_EXPIRED'}
   $directory=$run.directories[$i];Assert-DevelopmentRecoveryR0PathObservation $directory.observation
   $entries=[IO.Directory]::EnumerateFileSystemEntries($directory.path).GetEnumerator()
   try{if($entries.MoveNext()){throw 'DEVELOPMENT_RECOVERY_R0_EXTRA_ITEMS_PRESERVED'}}finally{$entries.Dispose()}
   [IO.Directory]::Delete($directory.path,$false)
  }
  $run.cleanup='OWNED_FILES_REMOVED_NOT_OS_VALIDATED'
 }catch{
  # 오류 ID만 고정하며 exception/환경/source/diagnostic raw body를 출력하지 않는다.
  if($run.status -cne 'TIMEOUT'){$run.status='RUN_UNCONFIRMED'}
  # Start/SafeHandle 반환 불명에는 PID 재탐색·새 handle 확보·종료 요청0이다.
  if($run.originalProcessCaptured){
   while($true){
    try{
     $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
     $run.elapsedMs=$budget.elapsedMs
    }catch{break}
    if($budget.totalRemainingMs -eq 0){break}
    # 실패한 read는 다시 GetResult/ReadAsync하거나 EOF로 바꾸지 않는다. 원 Process만 관측한다.
    try{
     if(!$run.exitObserved -and $run.process.HasExited){
      $run.exitObserved=$true
      try{$run.exitCode=$run.process.ExitCode}catch{<# 종료 관측과 exit-code 불명은 구분한다. #>}
     }
    }catch{<# 같은 원 handle의 관측 불명. 기한 안에서만 관측하며 PID를 다시 열지 않는다. #>}
    try{
     $budget=Get-DevelopmentRecoveryR0Budget $clock ([datetimeoffset]::UtcNow) $timer.ElapsedMilliseconds
     $run.elapsedMs=$budget.elapsedMs
    }catch{break}
    $action=Get-DevelopmentRecoveryR0FailureAction $run $run.originalProcessCaptured $timer.ElapsedMilliseconds $budget.totalRemainingMs
    if($action.requestTermination){
     # latch는 요청 전 이미 기록됐다. timeout 경로와 같은 원 요청 총1회이며 성공을 종료로 세지 않는다.
     try{$run.process.Kill()}catch{<# 원 객체 보존·추가 요청0·예외 원문 로그0 #>}
     continue
    }
    if(!$action.observe){break}
    [Threading.Thread]::Sleep([int]$action.waitMs)
   }
  }
 }finally{
  if($run.source){[Array]::Clear($run.source,0,$run.source.Length)}
  if(!$run.diagnosticsWriteAttempted -and $run.cleanup -cne 'OWNED_FILES_REMOVED_NOT_OS_VALIDATED'){
   try{Write-DevelopmentRecoveryR0OwnedDiagnostics $run $clock $timer}catch{<# 원 stream/참조 보존. 예외 본문 로그0 #>}
  }
  if($run.cleanup -ceq 'OWNED_FILES_REMOVED_NOT_OS_VALIDATED'){
   foreach($pin in $run.pins){$pin.Dispose()}
   foreach($read in $run.reads.Values){$read.stream.Dispose();[Array]::Clear($read.buffer,0,$read.buffer.Length)}
   if($run.process){$run.process.Dispose()}
  }else{
   # 미완료 ReadAsync는 cancel 요청/stream Dispose로 완료를 가장하지 않는다. 원 참조를 영구 보존한다.
   & $script:DevelopmentRecoveryR0Retain 'RETAIN' $run
  }
 }
 return [pscustomobject]@{status=$run.status;exitCode=$run.exitCode;exitObserved=$run.exitObserved;killAttempted=$run.killAttempted;
  stdoutEof=$run.diagnostics.stdout.eof;stderrEof=$run.diagnostics.stderr.eof;
  stdoutPending=($run.reads.ContainsKey('stdout') -and $null -ne $run.reads.stdout.pending);
  stderrPending=($run.reads.ContainsKey('stderr') -and $null -ne $run.reads.stderr.pending);cleanup=$run.cleanup;output=$run.output;
  outputOwnership=$run.outputOwnership;executionAuthorized=$false;osVerified=$false;implicitCompilerIoVerified=$false;
  bootstrapRace='PARENT_AND_CLEANUP_PATHNAME_RACE_UNRESOLVED';synchronousFileIoHardDeadlineVerified=$false;realCompilerValidation='NOT_RUN'}
}
function Get-DevelopmentRecoverySourcePlan([string]$Mode) {
 if ($Mode -cnotin @('P2','P3')) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
 return @{
  mode=$Mode;tlsRoot='D:\Project\Anvil\.av3-data\dev-tls-20261025-01'
  bootstrapRoot='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01'
  artifactRoot='D:\Project\Anvil\.av3-data\n4-recovery-01\artifacts'
  runtimeRoot='D:\Project\Anvil\.av3-data\n4-recovery-01\runtime'
  compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  compilerHash='46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00'
  assemblyName='DevelopmentRecoveryPathGuard.dll'
  maxWindowMs=$(if($Mode -eq 'P2'){600000}else{1800000})
  nativeOperationPhase=$(if($Mode -ceq 'P2'){'TLS_ONLY'}else{'RUNTIME_ONLY'})
  maxInventoryFiles=100000;maxInventoryBytes=2147483648
  maxRetainedHandleCandidate=4096;nativePinCapacityVerified=$false
  # 소스 후보의 탐색 상한일 뿐 실제 OS 능력·용량 검증을 의미하지 않는다.
  nativeVerified=$false;bootstrapExceptionAccepted=$false;executionAuthorized=$false
  sourcePreparationStatus='PARTIAL_NOT_EXECUTABLE'
  authorityBoundary='EXTERNAL_EXECUTION_PLATFORM'
  bindingPurpose='TARGET_AND_LIFETIME_AUDIT_ONLY'
  injectionBoundary='SOURCE_SIMULATION_ONLY'
  missing=@('EXACT_SOURCE_REVIEW','BOOTSTRAP_EXCEPTION_DECISION','NATIVE_COMPILE_DECISION','ACTUAL_OS_NEGATIVE_QA','EXTERNAL_APPROVED_INVOCATION_LIFETIME_ADAPTER','EXACT_RUNTIME_FILE_MANIFEST','PIN_CAPACITY_AND_STARTUP_TIME')
 }
}
function Read-DevelopmentRecoverySourceBinding([hashtable]$Value,[datetimeoffset]$Now) {
 $keys=@('mode','commit','runId','issuedAt','expiresAt')
 if (!$Value -or $Value.Count -ne $keys.Count -or @($Value.Keys|Where-Object{$_ -cnotin $keys}).Count) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
 foreach($key in $keys){if($Value[$key] -isnot [string]){throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID'}}
 $p=Get-DevelopmentRecoverySourcePlan $Value.mode
 $issued=[datetimeoffset]::MinValue;$until=[datetimeoffset]::MinValue
 if ($Value.commit -cnotmatch '\A[0-9a-f]{40}\z' -or $Value.runId -cnotmatch '\A[a-z0-9][a-z0-9-]{0,63}\z' -or
  ![datetimeoffset]::TryParseExact($Value.issuedAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$issued) -or
  ![datetimeoffset]::TryParseExact($Value.expiresAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$until) -or
  $until -le $issued -or ($until-$issued).TotalMilliseconds -gt $p.maxWindowMs -or $Now -lt $issued -or $Now -ge $until) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
 $p.commit=$Value.commit;$p.runId=$Value.runId;$p.issuedAt=$issued.ToString('o');$p.expiresAt=$until.ToString('o')
 return $p
}
function New-DevelopmentRecoveryQaHostFromAssembly([string]$CaseId,[string]$RunId,[string]$Commit,[datetime]$IssuedAt,[datetime]$ExpiresAt,[string]$ExpectedAssemblySha256) {
 # digest는 외부 exact 실행 결정의 대조값일 뿐 허가가 아니다. 실제 등록 전 I/O보다 먼저 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
 $cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED','WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE','CLEANUP_UNKNOWN','JOB_MEMBERSHIP','CHILD_PIN_LIFETIME')
 $now=[datetime]::UtcNow
 if($CaseId -cnotin $cases -or $RunId -cnotmatch '\Ar1-[a-z0-9][a-z0-9-]{0,47}\z' -or $Commit -cnotmatch '\A[a-f0-9]{40}\z' -or $ExpectedAssemblySha256 -cnotmatch '\A[A-F0-9]{64}\z' -or
  $IssuedAt.Kind -ne [DateTimeKind]::Utc -or $ExpiresAt.Kind -ne [DateTimeKind]::Utc -or $ExpiresAt -le $IssuedAt -or ($ExpiresAt-$IssuedAt).TotalMinutes -gt 30 -or $now -lt $IssuedAt -or $now -ge $ExpiresAt){throw 'DEVELOPMENT_RECOVERY_QA_BINDING_INVALID'}
 $path='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile\DevelopmentRecoveryPathGuard.dll'
 $file=$null;$bytes=$null;$digest=$null
 try{
  $file=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $length=$file.Length
  if($length -le 0 -or $length -gt 4194304){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $bytes=[byte[]]::new([int]$length);$offset=0
  while($offset -lt $length){$read=$file.Read($bytes,$offset,[int]($length-$offset));if($read -le 0){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'};$offset+=$read}
  if($file.Length -ne $length -or $file.ReadByte() -ne -1){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $digest=[Security.Cryptography.SHA256]::Create()
  $actual=[BitConverter]::ToString($digest.ComputeHash($bytes)).Replace('-','')
  if($actual -cne $ExpectedAssemblySha256){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  # hash한 동일 메모리 바이트만 로드한다. 파일명을 다시 열어 LoadFrom하지 않는다.
  $assembly=[Reflection.Assembly]::Load($bytes)
  $type=$assembly.GetType('DevelopmentRecoveryQaHost',$true,$false)
  if(!$type.IsPublic -or !$type.IsSealed -or $type.IsAbstract -or ![object]::ReferenceEquals($type.Assembly,$assembly)){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $signature=[type[]]@([string],[string],[string],[datetime],[datetime])
  $factory=$type.GetMethod('Create',([Reflection.BindingFlags]'Public,Static,DeclaredOnly'),$null,$signature,$null)
  if(!$factory -or $factory.ReturnType -ne $type){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $owned=$factory.Invoke($null,[object[]]@($CaseId,$RunId,$Commit,$IssuedAt,$ExpiresAt))
  if(!$owned -or ![object]::ReferenceEquals($owned.GetType(),$type)){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  return $owned
 }finally{
  if($digest){$digest.Dispose()};if($file){$file.Dispose()};if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}
 }
}
function New-DevelopmentRecoveryQaStandaloneLauncherFromAssembly([string]$RunId,[string]$Commit,[datetime]$IssuedAt,[datetime]$ExpiresAt,[string]$ExpectedControllerSha256) {
 # digest는 외부 exact 실행 결정의 대조값일 뿐 허가가 아니다. 실제 등록 전 I/O보다 먼저 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
 $now=[datetime]::UtcNow
 if($RunId -cnotmatch '\Ar1-[a-z0-9][a-z0-9-]{0,47}\z' -or $Commit -cnotmatch '\A[a-f0-9]{40}\z' -or $ExpectedControllerSha256 -cnotmatch '\A[A-F0-9]{64}\z' -or
  $IssuedAt.Kind -ne [DateTimeKind]::Utc -or $ExpiresAt.Kind -ne [DateTimeKind]::Utc -or $ExpiresAt -le $IssuedAt -or ($ExpiresAt-$IssuedAt).TotalMinutes -gt 30 -or $now -lt $IssuedAt -or $now -ge $ExpiresAt){throw 'DEVELOPMENT_RECOVERY_QA_BINDING_INVALID'}
 $path='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\r1-artifacts\DevelopmentRecoveryQaController.exe'
 $file=$null;$bytes=$null;$digest=$null
 try{
  $file=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $length=$file.Length
  if($length -le 0 -or $length -gt 4194304){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $bytes=[byte[]]::new([int]$length);$offset=0
  while($offset -lt $length){$read=$file.Read($bytes,$offset,[int]($length-$offset));if($read -le 0){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'};$offset+=$read}
  if($file.Length -ne $length -or $file.ReadByte() -ne -1){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $digest=[Security.Cryptography.SHA256]::Create()
  $actual=[BitConverter]::ToString($digest.ComputeHash($bytes)).Replace('-','')
  if($actual -cne $ExpectedControllerSha256){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  # hash한 동일 메모리 바이트만 로드한다. 파일명을 다시 열어 LoadFrom하지 않는다.
  $assembly=[Reflection.Assembly]::Load($bytes)
  # role1 metadata는 무결성 대조이며 외부 exact 실행 신뢰가 아니다.
  $resource=$assembly.GetManifestResourceStream('Anvil.Qa.Build.V1')
  if(!$resource){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  try{
   $build=[byte[]]::new(73);$at=0
   while($at -lt 73){$read=$resource.Read($build,$at,73-$at);if($read -le 0){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'};$at+=$read}
   if($resource.ReadByte() -ne -1 -or $build[0] -ne 1 -or [Text.Encoding]::ASCII.GetString($build,1,40) -cne $Commit){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
   $any=0;for($i=41;$i -lt 73;$i++){$any=$any -bor $build[$i]};if($any -eq 0){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  }finally{$resource.Dispose()}
  $type=$assembly.GetType('DevelopmentRecoveryQaStandaloneLauncher',$true,$false)
  if(!$type.IsPublic -or !$type.IsSealed -or $type.IsAbstract -or ![object]::ReferenceEquals($type.Assembly,$assembly)){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $signature=[type[]]@([string],[string],[datetime],[datetime],[string])
  $factory=$type.GetMethod('Create',([Reflection.BindingFlags]'Public,Static,DeclaredOnly'),$null,$signature,$null)
  if(!$factory -or $factory.ReturnType -ne $type){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  $owned=$factory.Invoke($null,[object[]]@($RunId,$Commit,$IssuedAt,$ExpiresAt,$ExpectedControllerSha256))
  if(!$owned -or ![object]::ReferenceEquals($owned.GetType(),$type)){throw 'DEVELOPMENT_RECOVERY_QA_ASSEMBLY_INVALID'}
  return $owned
 }finally{
  if($digest){$digest.Dispose()};if($file){$file.Dispose()};if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}
 }
}
function Invoke-DevelopmentRecoveryQaOwnedHost([string]$CaseId,[string]$RunId,[string]$Commit,[datetime]$IssuedAt,[datetime]$ExpiresAt,[string]$ExpectedAssemblySha256) {
 # 실제 assembly 출처와 실행 승인이 연결되기 전에는 타입 조회·factory 호출보다 먼저 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
 if($CaseId -ceq 'CHILD_PIN_LIFETIME'){
  $ownedHost=New-DevelopmentRecoveryQaStandaloneLauncherFromAssembly $RunId $Commit $IssuedAt $ExpiresAt $ExpectedAssemblySha256
 }else{
  $ownedHost=New-DevelopmentRecoveryQaHostFromAssembly $CaseId $RunId $Commit $IssuedAt $ExpiresAt $ExpectedAssemblySha256
 }
 $observation=$null;$cleanup=$null;$hostState='QA_HOST_FLOW_UNCONFIRMED'
 try{$observation=$ownedHost.Execute();$hostState='QA_HOST_RETURNED_NOT_OS_VALIDATED'}
 catch{$hostState='QA_HOST_FLOW_UNCONFIRMED'}
 finally{
  # Execute의 finally와 동일 원 객체 정리다. 오류 뒤 외부 경로나 새 owner를 탐색하지 않는다.
  try{$cleanup=$ownedHost.Cleanup()}catch{$hostState='QA_HOST_CLEANUP_UNCONFIRMED'}
 }
 # 오류/정리 불명도 원 host를 반환해 동일 원목록 참조를 잃지 않는다. 이 객체는 실행 허가가 아니다.
 return [pscustomobject]@{ownedHost=$ownedHost;observation=$observation;cleanup=$cleanup;state=$hostState;osVerified=$false;executionAuthorized=$false}
}
if($MyInvocation.InvocationName -ne '.'){
 if($Plan){Get-DevelopmentRecoverySourcePlan 'P2'|ConvertTo-Json -Depth 3 -Compress}
 else{throw 'DEVELOPMENT_RECOVERY_OS_NOT_VALIDATED'}
}
