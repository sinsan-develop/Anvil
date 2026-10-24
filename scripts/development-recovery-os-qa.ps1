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
function New-DevelopmentRecoveryOsQaFilesystemAdapter {
 # 생성자는 메모리 객체만 만든다. 아래 실제 OS 행동 코드는 이번 승인에서 호출하지 않는다.
 $adapter=[pscustomobject]@{kind='OS_FIXTURE_SOURCE_CANDIDATE';nativeVerified=$false;executionAuthorized=$false}
 $adapter|Add-Member -MemberType ScriptMethod -Name Mutate -Value {
  param([string]$CaseId)
  # 함수 이름 재정의로 우회할 수 있는 실행 gate를 사용하지 않는다. 이 본문은 아직 미등록이다.
  throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
  $cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')
  if($CaseId -cnotin $cases){throw 'DEVELOPMENT_RECOVERY_QA_CASE_INVALID'}
  # 외부 경로/작업폴더 입력은 받지 않는다. outside는 선택 pin 밖이지만 격리 case 안의 합성 파일이다.
  $base='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\os-qa'
  $root=Join-Path $base $CaseId
  # pathname 사전 대조는 same-handle 안전성을 증명하지 않는다. 실제 runner/pin 결박은 아직 미구현이다.
  foreach($path in @('D:\','D:\Project','D:\Project\Anvil','D:\Project\Anvil\.av3-data','D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01',$base,$root)){
   $attributes=[IO.File]::GetAttributes($path)
   if(($attributes -band [IO.FileAttributes]::ReparsePoint) -or !($attributes -band [IO.FileAttributes]::Directory)){throw 'DEVELOPMENT_RECOVERY_QA_FIXTURE_INVALID'}
  }
  $leaf=Join-Path $root 'leaf.txt'
  $target=Join-Path $root 'target'
  $parent=Join-Path $root 'parent'
  $outside=Join-Path $root 'unselected.txt'
  $required=if($CaseId -ceq 'PARENT_REPLACEMENT'){$parent}elseif($CaseId -ceq 'REPARSE_CHILD'){$target}elseif($CaseId -ceq 'OUTSIDE_WRITE'){$outside}else{$leaf}
  $attributes=[IO.File]::GetAttributes($required)
  $directoryCase=$CaseId -cin @('PARENT_REPLACEMENT','REPARSE_CHILD')
  if(($attributes -band [IO.FileAttributes]::ReparsePoint) -or ([bool]($attributes -band [IO.FileAttributes]::Directory) -ne $directoryCase)){throw 'DEVELOPMENT_RECOVERY_QA_FIXTURE_INVALID'}
  # 성공은 변경 시도 기록일 뿐 guard 합격이 아니다. 거절 예외도 guard 효과로 자동 판정하지 않는다.
  $operation='NOT_ATTEMPTED'
  try{
   switch -CaseSensitive ($CaseId){
    'PARENT_REPLACEMENT' {
     $operation='RENAME_PARENT_AND_RECREATE_SELECTED_PATH'
     [IO.Directory]::Move($parent,(Join-Path $root 'parent-retained'))
     [IO.Directory]::CreateDirectory($parent)|Out-Null
    }
    'REPARSE_CHILD' {
     $operation='REPLACE_SELECTED_DIRECTORY_WITH_SYMBOLIC_LINK'
     $selected=Join-Path $root 'selected'
     $attributes=[IO.File]::GetAttributes($selected)
     if(($attributes -band [IO.FileAttributes]::ReparsePoint) -or !($attributes -band [IO.FileAttributes]::Directory)){throw 'DEVELOPMENT_RECOVERY_QA_FIXTURE_INVALID'}
     [IO.Directory]::Move($selected,(Join-Path $root 'selected-retained'))
     [IO.Directory]::CreateSymbolicLink($selected,$target)|Out-Null
    }
    'OUTSIDE_WRITE' {
     $operation='WRITE_UNSELECTED_SENTINEL'
     $stream=[IO.FileStream]::new($outside,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read)
     try{if($stream.Length -gt 16){throw 'DEVELOPMENT_RECOVERY_QA_SENTINEL_INVALID'};$stream.WriteByte(88);$stream.Flush($true)}finally{$stream.Dispose()}
    }
    'FILE_ID_CHANGED' {
     $operation='RENAME_AND_CREATE_NEW_LEAF'
     [IO.File]::Move($leaf,(Join-Path $root 'leaf-retained.txt'))
     $stream=[IO.FileStream]::new($leaf,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
     try{$stream.WriteByte(88);$stream.Flush($true)}finally{$stream.Dispose()}
    }
    'HARD_LINK' {
     $operation='CREATE_FILE_HARD_LINK'
     New-Item -ItemType HardLink -Path (Join-Path $root 'linked.txt') -Target $leaf -ErrorAction Stop|Out-Null
    }
    'DACL_CHANGED' {
     $operation='ADD_FIXTURE_EVERYONE_WRITE'
     $file=[IO.FileInfo]::new($leaf)
     $security=[IO.FileSystemAclExtensions]::GetAccessControl($file)
     $before=$security.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
     $sid=[Security.Principal.SecurityIdentifier]::new('S-1-1-0')
     $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::WriteData,[Security.AccessControl.AccessControlType]::Allow)
     $security.AddAccessRule($rule)
     if($before -ceq $security.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)){throw 'DEVELOPMENT_RECOVERY_QA_DACL_UNCHANGED'}
     [IO.FileSystemAclExtensions]::SetAccessControl($file,$security)
    }
   }
   return @{caseId=$CaseId;operation=$operation;mutation='ATTEMPT_RECORDED_NOT_GUARD_RESULT';cleanupRequired=$true;osVerified=$false}
  }catch{
   # 변경 일부 성공/권한 부족/guard 거절을 구분할 실제 원 handle 관측 없이는 모두 미확인이다.
   return @{caseId=$CaseId;operation=$operation;mutation='MUTATION_UNCONFIRMED';errorHResult=$_.Exception.HResult;cleanupRequired=$true;osVerified=$false}
  }
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
