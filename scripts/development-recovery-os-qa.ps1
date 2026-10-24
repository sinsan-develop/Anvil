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
if($MyInvocation.InvocationName -ne '.'){
 if($Plan){Get-DevelopmentRecoveryOsQaPlan|ConvertTo-Json -Depth 3 -Compress}
 else{throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'}
}
