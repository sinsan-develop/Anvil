param([switch]$Plan)
$ErrorActionPreference='Stop'
# 시험 코드 준비만 승인됐다. 실제 공격 fixture·Job·handle·process를 만들지 않는다.
function Get-DevelopmentRecoveryOsQaPlan {
 return @{
  root='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\os-qa'
  maxFiles=64;maxBytes=8388608;maxWindowMs=1800000;maxProcesses=2;maxProcessMs=60000
  cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED','WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE','GUARDIAN_LOST','CHILD_PIN_LIFETIME','JOB_MEMBERSHIP','BREAKAWAY_DENIED','CLEANUP_UNKNOWN')
  compiled=$false;osVerified=$false;executionAuthorized=$false
 }
}
function Assert-DevelopmentRecoveryOsQaExecution {
 # 외부 실행 승인을 읽거나 발급하지 않는다. 실 adapter 등록/OS 검수 전에는 항상 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
}
function Read-DevelopmentRecoveryQaSourceBinding([hashtable]$Value,[datetimeoffset]$Now) {
 $keys=@('mode','commit','runId','issuedAt','expiresAt')
 if(!$Value -or $Value.Count -ne 5 -or @($Value.Keys|Where-Object{$_ -cnotin $keys}).Count){throw 'DEVELOPMENT_RECOVERY_QA_BINDING_INVALID'}
 foreach($key in $keys){if($Value[$key] -isnot [string]){throw 'DEVELOPMENT_RECOVERY_QA_BINDING_INVALID'}}
 $from=[datetimeoffset]::MinValue;$until=[datetimeoffset]::MinValue
 if($Value.mode -cne 'R1' -or $Value.commit -cnotmatch '^[a-f0-9]{40}$' -or $Value.runId -cnotmatch '^r1-[a-z0-9][a-z0-9-]{0,47}$' -or
  ![datetimeoffset]::TryParseExact($Value.issuedAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$from) -or
  ![datetimeoffset]::TryParseExact($Value.expiresAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$until) -or
  $until -le $from -or ($until-$from).TotalMilliseconds -gt 1800000 -or $Now -lt $from -or $Now -ge $until){throw 'DEVELOPMENT_RECOVERY_QA_BINDING_INVALID'}
 # 입력은 대상/기한 선언일 뿐 원 handle 소유권·외부 실행 승인을 증명하지 않는다.
 return @{mode='R1';commit=$Value.commit;runId=$Value.runId;issuedAt=$from.ToString('o');expiresAt=$until.ToString('o');ownership='NOT_ACQUIRED';executionAuthorized=$false}
}
function Read-DevelopmentRecoveryQaMutationReceipt([string]$CaseId,[object]$Value) {
 $operations=@{
  PARENT_REPLACEMENT='RENAME_AND_CREATE_NEW_PARENT';FILE_ID_CHANGED='RENAME_AND_CREATE_NEW_LEAF'
  OUTSIDE_WRITE='WRITE_OWN_UNSELECTED_SENTINEL';HARD_LINK='LINK_ORIGINAL_LEAF_IN_ORIGINAL_PARENT'
  REPARSE_CHILD='SET_RELATIVE_REPARSE_ON_ORIGINAL_SELECTED_DIRECTORY';DACL_CHANGED='CHANGE_ORIGINAL_SYNTHETIC_LEAF_DACL'
 }
 if($CaseId -cnotin $operations.Keys -or $Value -isnot [array] -or $Value.Rank -ne 1 -or $Value.GetLowerBound(0) -ne 0 -or $Value.Length -ne 4){throw 'DEVELOPMENT_RECOVERY_QA_RESULT_UNCONFIRMED'}
 foreach($field in $Value){if($field -isnot [string]){throw 'DEVELOPMENT_RECOVERY_QA_RESULT_UNCONFIRMED'}}
 if($Value[0] -cne $CaseId -or $Value[1] -cne $operations[$CaseId] -or $Value[2] -cnotin @('MUTATION_ATTEMPT_RECORDED_NOT_GUARD_RESULT','MUTATION_UNCONFIRMED') -or $Value[3] -cnotmatch '^(?:[a-f0-9]{8}|NOT_OBSERVED)$'){throw 'DEVELOPMENT_RECOVERY_QA_RESULT_UNCONFIRMED'}
 return @{caseId=$CaseId;operation=$Value[1];mutation=$Value[2];nativeStatus=$Value[3];cleanupRequired=$true;osVerified=$false;guardVerdict='NOT_EVALUATED';fixtureInterference='UNRESOLVED'}
}
function Read-DevelopmentRecoveryQaCleanupReceipt([string]$CaseId,[object]$Value) {
 $cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')
 $cleanup=@('CLEANUP_UNCONFIRMED_PRESERVED','PENDING_DELETE_CLOSE_EFFECT_UNCONFIRMED_PRESERVED','HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED','HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED','OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED')
 $dacl=@('NOT_APPLICABLE','DACL_CHANGE_ATTEMPTED_RESTORE_NOT_OBSERVED','DACL_RESTORE_UNCONFIRMED_PRESERVED','DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE','ORIGINAL_DACL_ALREADY_MATCHED_NOT_OS_VALIDATED','ORIGINAL_DACL_RESTORED_NOT_OS_VALIDATED')
 if($CaseId -cnotin $cases -or $Value -isnot [array] -or $Value.Rank -ne 1 -or $Value.GetLowerBound(0) -ne 0 -or $Value.Length -ne 3){throw 'DEVELOPMENT_RECOVERY_QA_CLEANUP_UNCONFIRMED'}
 foreach($field in $Value){if($field -isnot [string]){throw 'DEVELOPMENT_RECOVERY_QA_CLEANUP_UNCONFIRMED'}}
 if($Value[0] -cne $CaseId -or $Value[1] -cnotin $cleanup -or $Value[2] -cnotin $dacl -or ($CaseId -cne 'DACL_CHANGED' -and $Value[2] -cne 'NOT_APPLICABLE')){throw 'DEVELOPMENT_RECOVERY_QA_CLEANUP_UNCONFIRMED'}
 if($Value[1] -ceq 'OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED' -and $Value[2] -cin @('DACL_CHANGE_ATTEMPTED_RESTORE_NOT_OBSERVED','DACL_RESTORE_UNCONFIRMED_PRESERVED','DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE')){throw 'DEVELOPMENT_RECOVERY_QA_CLEANUP_UNCONFIRMED'}
 return @{caseId=$CaseId;cleanupObservation=$Value[1];daclObservation=$Value[2];osVerified=$false;residueVerified=$false;executionAuthorized=$false;guardVerdict='NOT_EVALUATED'}
}
function New-DevelopmentRecoveryOsQaFilesystemAdapter([object]$OwnedLease) {
 # 생성자는 메모리 객체만 만든다. 실제 assembly 출처/run 결박은 아직 host에 등록되지 않았다.
 $adapter=[pscustomobject]@{kind='OS_FIXTURE_SOURCE_CANDIDATE';OwnedLease=$OwnedLease;nativeVerified=$false;executionAuthorized=$false}
 $adapter|Add-Member -MemberType ScriptMethod -Name Mutate -Value {
  param([string]$CaseId)
  # 함수 이름 재정의로 우회할 수 있는 실행 gate를 사용하지 않는다. 이 본문은 아직 미등록이다.
  throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
  $cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')
  if($CaseId -cnotin $cases){throw 'DEVELOPMENT_RECOVERY_QA_CASE_INVALID'}
  # pathname 연산을 하지 않는다. 타입 이름만으로 출처/승인/소유를 인증하지 않으며 실제 host bridge는 미등록이다.
  $lease=$this.OwnedLease
  if(!$lease -or $lease.GetType().FullName -cne 'DevelopmentRecoveryPathGuard+QaFixtureLease'){throw 'DEVELOPMENT_RECOVERY_QA_ORIGINAL_LEASE_REQUIRED'}
  $result=$lease.AttemptFilesystemMutation($CaseId)
  return Read-DevelopmentRecoveryQaMutationReceipt $CaseId $result
 }
 $adapter|Add-Member -MemberType ScriptMethod -Name Cleanup -Value {
  param([string]$CaseId)
  throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
  # 타입 이름은 실제 출처·권위 인증이 아니다. 원 lease/host 결박 전에는 위에서 항상 거절한다.
  $lease=$this.OwnedLease
  if(!$lease -or $lease.GetType().FullName -cne 'DevelopmentRecoveryPathGuard+QaFixtureLease'){throw 'DEVELOPMENT_RECOVERY_QA_ORIGINAL_LEASE_REQUIRED'}
  return Read-DevelopmentRecoveryQaCleanupReceipt $CaseId ($lease.CleanupFilesystemMutation())
 }
 return $adapter
}
function Invoke-DevelopmentRecoveryOsQaSourceCases([scriptblock]$ObserveSimulation) {
 if (!$ObserveSimulation) { throw 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID' }
 $plan=Get-DevelopmentRecoveryOsQaPlan
 $records=@()
 foreach($caseId in $plan.cases){
  if($caseId -cin @('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')){$expected='DENIED'}
  elseif($caseId -cin @('WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE')){$expected='UNVERIFIED'}
  elseif($caseId -ceq 'CLEANUP_UNKNOWN'){$expected='PRESERVED_UNCONFIRMED'}
  else{$expected='OBSERVATION_REQUIRED'}
  # 외부 source 시험용 callback뿐이다. 실제 native/fixture adapter를 선택하거나 실행하지 않는다.
  # expected를 observer에게 주지 않으며 원 caseId/기대값은 callback 변조와 별도로 보관한다.
  try{$result=& $ObserveSimulation @{caseId=$caseId;fixtureRoot=(Join-Path $plan.root $caseId);kind='SOURCE_SIMULATION'}}
  catch{throw 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID'}
  $keys=@('caseId','outcome','kind','nativeVerified')
  if($result -isnot [hashtable] -or $result.Count -ne $keys.Count -or @($result.Keys|Where-Object{$_ -cnotin $keys}).Count -or
   $result.caseId -isnot [string] -or $result.caseId -cne $caseId -or $result.outcome -isnot [string] -or $result.outcome -cne $expected -or
   $result.kind -isnot [string] -or $result.kind -cne 'SOURCE_SIMULATION' -or $result.nativeVerified -isnot [bool] -or $result.nativeVerified -ne $false){throw 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID'}
  $records+=@{caseId=$caseId;outcome=$expected;kind='SOURCE_SIMULATION';nativeVerified=$false}
 }
 # callback은 임의 외부 코드다. 이 함수는 그 코드의 OS 효과를 관측하거나 격리하지 않는다.
 return @{status='SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED';recordedCases=$records.Count;records=$records;executionAuthorized=$false;osVerified=$false;actualOsCases=$null;osEffects='NOT_OBSERVED'}
}
if($MyInvocation.InvocationName -ne '.'){
 if($Plan){Get-DevelopmentRecoveryOsQaPlan|ConvertTo-Json -Depth 3 -Compress}
 else{throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'}
}
