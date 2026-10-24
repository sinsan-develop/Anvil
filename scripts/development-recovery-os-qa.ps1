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
 return @{status='SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED';recordedCases=$records.Count;records=$records;executionAuthorized=$false;osVerified=$false;actualOsCases=0}
}
if($MyInvocation.InvocationName -ne '.'){
 if($Plan){Get-DevelopmentRecoveryOsQaPlan|ConvertTo-Json -Depth 3 -Compress}
 else{throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'}
}
