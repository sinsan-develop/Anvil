$ErrorActionPreference='Stop'
$flow=Join-Path $PSScriptRoot '../../../scripts/ui11-runtime-flow.ps1'
if(Test-Path -LiteralPath $flow){. $flow}
if(!(Get-Command Invoke-Ui11RuntimeFlow -ErrorAction SilentlyContinue)){throw 'UI11_FLOW_NOT_IMPLEMENTED'}
$cases=0
function Assert-Equal($Actual,$Expected){if(($Actual|ConvertTo-Json -Depth 6 -Compress) -cne ($Expected|ConvertTo-Json -Depth 6 -Compress)){throw 'UI11_TEST_ASSERTION_FAILED'}}
function Scenario([string]$Fail){
 $events=[Collections.Generic.List[string]]::new()
 $state=@{Phase='INIT';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;Status='RUNNING';Failure=$null;RollbackFailure=$null;RollbackConfirmed=$false}
 $effects=@{}
 foreach($name in @('Prepare','StopOriginal','Publish','StartNew','VerifyNew','StopNew','Restore','StartRollback','VerifyRollback')){
  $step=$name
  $effects[$name]={param($s)$events.Add($step);if($Fail -eq $step){throw ('UI11_TEST_'+$step.ToUpperInvariant())}}.GetNewClosure()
 }
 $effects.Receipt={param($s)}
 Invoke-Ui11RuntimeFlow $state $effects | Out-Null
 return @{state=$state;events=$events.ToArray()}
}
$s=Scenario ''
Assert-Equal $s.events @('Prepare','StopOriginal','Publish','StartNew','VerifyNew')
Assert-Equal $s.state.Status 'PASS'
Assert-Equal $s.state.RollbackConfirmed $false
$cases++
$s=Scenario 'Prepare'
Assert-Equal $s.events @('Prepare')
Assert-Equal $s.state.Status 'FAIL_BEFORE_STOP'
$cases++
$s=Scenario 'StopOriginal'
Assert-Equal $s.events @('Prepare','StopOriginal')
Assert-Equal $s.state.Status 'FAIL_ORIGINAL_STOP_UNKNOWN'
Assert-Equal $s.state.OriginalStopped $false
$cases++
foreach($point in @('Publish','StartNew','VerifyNew')){
 $s=Scenario $point
 Assert-Equal $s.state.Status 'FAIL_ROLLED_BACK'
 Assert-Equal $s.state.RollbackConfirmed $true
 $tail=@($s.events | Select-Object -Last 3)
 Assert-Equal $tail @('Restore','StartRollback','VerifyRollback')
 if($point -ne 'Publish' -and !($s.events -contains 'StopNew')){throw 'UI11_TEST_OWNED_STOP_MISSING'}
 $cases++
}
$events=[Collections.Generic.List[string]]::new()
$state=@{Phase='INIT';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;Status='RUNNING';Failure=$null;RollbackFailure=$null;RollbackConfirmed=$false}
$effects=@{Prepare={param($s)};StopOriginal={param($s)};Publish={param($s)};StartNew={param($s)throw 'UI11_TEST_START_FAILED'};VerifyNew={param($s)};StopNew={param($s)$events.Add('StopNew');throw 'UI11_TEST_OWNERSHIP_UNKNOWN'};Restore={param($s)$events.Add('Restore')};StartRollback={param($s)$events.Add('StartRollback')};VerifyRollback={param($s)};Receipt={param($s)}}
Invoke-Ui11RuntimeFlow $state $effects | Out-Null
Assert-Equal $state.Status 'FAIL_ROLLBACK_UNCONFIRMED'
Assert-Equal $events.ToArray() @('StopNew')
Assert-Equal $state.RollbackConfirmed $false
$cases++
$receiptEvents=[Collections.Generic.List[string]]::new()
$receiptState=@{Phase='INIT';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;Status='RUNNING';Failure=$null;RollbackFailure=$null;RollbackConfirmed=$false}
$receiptEffects=@{Prepare={param($s)};StopOriginal={param($s)};Publish={param($s)$receiptEvents.Add('Publish')};StartNew={param($s)};VerifyNew={param($s)};StopNew={param($s)$receiptEvents.Add('StopNew')};Restore={param($s)$receiptEvents.Add('Restore')};StartRollback={param($s)$receiptEvents.Add('StartRollback')};VerifyRollback={param($s)$receiptEvents.Add('VerifyRollback')};Receipt={param($s)if($s.OriginalStopped){throw 'UI11_TEST_RECEIPT_FAILED'}}}
Invoke-Ui11RuntimeFlow $receiptState $receiptEffects|Out-Null
Assert-Equal $receiptEvents.ToArray() @('Restore','StartRollback','VerifyRollback')
Assert-Equal $receiptState.Status 'FAIL_ROLLED_BACK'
Assert-Equal $receiptState.ReceiptFailure $true
$cases++
$receiptEvents.Clear()
$receiptState=@{Phase='INIT';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;Status='RUNNING';Failure=$null;RollbackFailure=$null;RollbackConfirmed=$false}
$receiptEffects.Receipt={param($s)if($s.Phase -eq 'VerifyNew' -or $s.Phase -in @('StopNew','Restore','StartRollback','VerifyRollback')){throw 'UI11_TEST_RECEIPT_FAILED'}}
Invoke-Ui11RuntimeFlow $receiptState $receiptEffects|Out-Null
Assert-Equal $receiptEvents.ToArray() @('Publish','StopNew','Restore','StartRollback','VerifyRollback')
Assert-Equal $receiptState.Status 'FAIL_ROLLED_BACK'
$cases++
$receiptState=@{Phase='INIT';OriginalStopAttempted=$false;OriginalStopped=$false;NewStartAttempted=$false;Status='RUNNING';Failure=$null;RollbackFailure=$null;RollbackConfirmed=$false}
$receiptEffects.Receipt={param($s)if($s.Phase -eq 'StopOriginal'){throw 'UI11_TEST_RECEIPT_FAILED'}}
Invoke-Ui11RuntimeFlow $receiptState $receiptEffects|Out-Null
Assert-Equal $receiptState.Status 'FAIL_BEFORE_STOP'
Assert-Equal $receiptState.OriginalStopAttempted $false
$cases++
$binding=@{approval='AV3-PMO-N4-SERVICE-TRANSITION';commit=('a'*40);scriptHash=('b'*64);flowHash=('c'*64);issuedAt='2026-10-18T01:00:00Z';expiresAt='2026-10-18T02:00:00Z';runId='ab895197-2c6f-4f49-923e-7029d472381d'}
$valid=Read-Ui11RuntimeBinding $binding ([datetimeoffset]'2026-10-18T01:01:00Z')
Assert-Equal $valid.commit ('a'*40)
foreach($patch in @(@{approval='AV3-PMO-A3-FORMAL-SCHEMA-ONLY'},@{expiresAt='2026-10-18T01:00:00Z'},@{expiresAt='2026-10-18T03:00:01Z'},@{runId='wrong'},@{runId='ab895197-2c6f-1f49-923e-7029d472381d'},@{commit='wrong'})){
 $bad=$binding.Clone();foreach($key in $patch.Keys){$bad[$key]=$patch[$key]}
 $caught=$false;try{Read-Ui11RuntimeBinding $bad ([datetimeoffset]'2026-10-18T01:01:00Z')|Out-Null}catch{$caught=$_.Exception.Message -eq 'UI11_RUNTIME_BINDING_INVALID'}
 Assert-Equal $caught $true
}
$cases++
$line=Get-Ui11NodeArgumentLine 'ab895197-2c6f-4f49-923e-7029d472381d' 'new' 'C:\folder with spaces\apps\server\main.ts'
Assert-Equal $line '--title=anvil-ui11-n4-ab895197-2c6f-4f49-923e-7029d472381d-new "C:\folder with spaces\apps\server\main.ts"'
$caught=$false;try{Get-Ui11NodeArgumentLine 'wrong' 'new' 'C:\apps\server\main.ts'|Out-Null}catch{$caught=$true};Assert-Equal $caught $true
$cases++
$envPlan=Get-Ui11ChildEnvironment @{ANVIL_ARTIFACT_ROOT='DROP';ANVIL_UI11_RUNTIME_APPROVAL='DROP';KEEP='safe'} 'D:\fake-only'
Assert-Equal $envPlan.ANVIL_ARTIFACT_ROOT $null
Assert-Equal $envPlan.ANVIL_UI11_RUNTIME_APPROVAL $null
Assert-Equal $envPlan.ANVIL_TLS_KEY 'D:\fake-only\dev-tls\server.key.pem'
Assert-Equal $envPlan.ANVIL_HOST '127.0.0.1'
Assert-Equal $envPlan.ANVIL_PORT '3830'
$cases++
$expected=@{pid=1234;exe='C:\Program Files\nodejs\node.exe';createdUtc='2026-10-18T01:02:03.1234567Z';title='anvil-ui11-test'}
$observed=@{alive=$true;pid=1234;exe=$expected.exe;createdUtc=$expected.createdUtc;title=$expected.title;listeners=@(@{LocalAddress='127.0.0.1';LocalPort=3830;OwningProcess=1234})}
Assert-Ui11ServiceProof $observed $expected
foreach($patch in @(@{alive=$false},@{exe='wrong'},@{createdUtc='old'},@{title='wrong'},@{listeners=@(@{LocalAddress='127.0.0.1';LocalPort=3830;OwningProcess=4321})},@{listeners=@()})){
 $bad=$observed.Clone();foreach($key in $patch.Keys){$bad[$key]=$patch[$key]}
 $caught=$false;try{Assert-Ui11ServiceProof $bad $expected}catch{$caught=$_.Exception.Message -eq 'UI11_ACTIVE_SERVICE_PROOF_INVALID'}
 Assert-Equal $caught $true
}
$cases++
@{status='PASS';cases=$cases;actualServiceChanges=0;dbConnections=0}|ConvertTo-Json -Compress
