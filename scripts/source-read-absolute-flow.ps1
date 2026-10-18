# 순수 준비 함수. 입력 결박은 외부 결정의 진위나 실제 실행 허가를 증명하지 않는다.
function Read-A3AbsoluteBinding([hashtable]$Value,[datetimeoffset]$Now){
 if(!$Value -or (@($Value.Keys|Sort-Object) -join ',') -cne 'commit,decisionId,expiresAt,issuedAt,runId,scriptHash'){throw 'A3_BINDING_INVALID'}
 foreach($key in $Value.Keys){if($Value[$key] -isnot [string]){throw 'A3_BINDING_INVALID'}}
 if($Value.decisionId -cne 'A3_ABSOLUTE_SOURCE_COMPILE_01' -or $Value.runId -cne 'a3-absolute-source-compile-01' -or $Value.commit -cnotmatch '^[a-f0-9]{40}$' -or $Value.scriptHash -cnotmatch '^[A-F0-9]{64}$|^[a-f0-9]{64}$' -or $Value.issuedAt -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$' -or $Value.expiresAt -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$'){throw 'A3_BINDING_INVALID'}
 try{$issued=[datetimeoffset]$Value.issuedAt;$expires=[datetimeoffset]$Value.expiresAt}catch{throw 'A3_BINDING_INVALID'}
 if($issued -gt $Now -or $expires -le $Now.AddSeconds(90) -or $expires -le $issued -or ($expires-$issued).TotalMinutes -gt 30){throw 'A3_BINDING_INVALID'}
 return @{commit=$Value.commit;decisionId=$Value.decisionId;runId=$Value.runId;scriptHash=$Value.scriptHash.ToUpperInvariant();issuedAt=$issued;expiresAt=$expires;executionAuthorized=$false}
}
function Test-A3PrivateAclFacts([string]$OwnerSid,[string]$CurrentSid,[object[]]$Rules){
 if(!$CurrentSid -or $OwnerSid -cne $CurrentSid -or !$Rules -or $Rules.Count -gt 32){return $false}
 $seen=@{}
 foreach($rule in $Rules){if($rule.sid -cnotin @($CurrentSid,'S-1-5-18') -or $rule.type -cne 'Allow' -or [int64]$rule.rights -ne 2032127){return $false};$seen[$rule.sid]=$true}
 return $seen.ContainsKey($CurrentSid) -and $seen.ContainsKey('S-1-5-18')
}
function Invoke-A3PreparationStages([scriptblock]$CheckDeadline,[scriptblock]$Consume,[scriptblock]$CreateQa,[scriptblock]$CollectCatalog){
 & $CheckDeadline;$null=& $Consume;& $CheckDeadline;$null=& $CreateQa;& $CheckDeadline;$null=& $CollectCatalog
}
function Test-A3CompilerIdentityFacts([hashtable]$Proof,[hashtable]$Receipt){
 return $null -ne $Proof -and $null -ne $Receipt -and $Proof.pid -gt 0 -and $Proof.ticks -gt 0 -and $Receipt.pid -eq $Proof.pid -and $Receipt.exeObserved -is [bool] -and $Receipt.exeObserved -and $Receipt.exe -ceq 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
}
function Complete-A3CaptureCleanup([hashtable]$Lease){
 if(!$Lease){return $false};foreach($task in $Lease.tasks){if($task -and !$task.IsCompleted){return $false}}
 foreach($task in $Lease.tasks){if($task){try{$null=$task.GetAwaiter().GetResult()}catch{}}}
 foreach($buffer in $Lease.buffers){[Array]::Clear($buffer,0,$buffer.Length)};$Lease.complete=$true;return $true
}
# 미완료 읽기의 buffer는 호출자 lease에 남기며 실제 읽기 종료보다 먼저 지우지 않는다.
function Read-A3BoundedBytes([IO.Stream]$Stdout,[IO.Stream]$Stderr,[int]$TimeoutMs,[scriptblock]$OnIncomplete=$null){
 if(!$Stdout -or !$Stderr -or $TimeoutMs -lt 1 -or $TimeoutMs -gt 15000){throw 'A3_CAPTURE_INPUT_INVALID'}
 $streams=@($Stdout,$Stderr);$stores=@([IO.MemoryStream]::new(),[IO.MemoryStream]::new());$buffers=@([byte[]]::new(4096),[byte[]]::new(4096));$tasks=@($null,$null);$reserved=@(0,0);$eof=@($false,$false);$total=0;$limitHit=$false;$clock=[Diagnostics.Stopwatch]::StartNew();$cancel=[Threading.CancellationTokenSource]::new()
 $lease=@{buffers=$buffers;tasks=$tasks;complete=$false};$result=@{stdout=@();stderr=@();complete=$false;limitHit=$false;timedOut=$false;readFailure=$false;stopFailure=$false;cleanup=$lease}
 try{
  while(!($eof[0] -and $eof[1]) -and $clock.ElapsedMilliseconds -lt $TimeoutMs){
   for($i=0;$i -lt 2;$i++){
    if(!$eof[$i] -and !$tasks[$i]){$available=16384-$total-$reserved[0]-$reserved[1];if($available -gt 0){$reserved[$i]=[Math]::Min(4096,$available);$tasks[$i]=$streams[$i].ReadAsync($buffers[$i],0,$reserved[$i],$cancel.Token)}}
    if($tasks[$i] -and $tasks[$i].IsCompleted){$n=$tasks[$i].GetAwaiter().GetResult();$reserved[$i]=0;$tasks[$i]=$null;if($n -eq 0){$eof[$i]=$true}else{$stores[$i].Write($buffers[$i],0,$n);$total+=$n}}
   }
   if($total -ge 16384 -and !($eof[0] -and $eof[1])){$limitHit=$true;break}
   if(!($eof[0] -and $eof[1])){[Threading.Thread]::Sleep(1)}
  }
 }catch{$result.readFailure=$true}finally{
  $result.stdout=$stores[0].ToArray();$result.stderr=$stores[1].ToArray();$result.complete=($eof[0] -and $eof[1]);$result.limitHit=$limitHit;$result.timedOut=(!$result.complete -and !$limitHit -and !$result.readFailure)
  if(!$result.complete -and $OnIncomplete){try{& $OnIncomplete}catch{$result.stopFailure=$true}}
  $cancel.Cancel();$null=Complete-A3CaptureCleanup $lease
  foreach($store in $stores){$bytes=$store.GetBuffer();[Array]::Clear($bytes,0,$bytes.Length);$store.Dispose()};$cancel.Dispose();$clock.Stop()
 }
 return $result
}
