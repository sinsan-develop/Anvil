param([switch]$Plan)
$ErrorActionPreference='Stop'
# source-only 계획/검증. Add-Type·assembly load·handle·process·cert/trust 연산은 없다.
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
 if ($Value.commit -cnotmatch '^[0-9a-f]{40}$' -or $Value.runId -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}$' -or
  ![datetimeoffset]::TryParseExact($Value.issuedAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$issued) -or
  ![datetimeoffset]::TryParseExact($Value.expiresAt,'o',[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$until) -or
  $until -le $issued -or ($until-$issued).TotalMilliseconds -gt $p.maxWindowMs -or $Now -lt $issued -or $Now -ge $until) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
 $p.commit=$Value.commit;$p.runId=$Value.runId;$p.issuedAt=$issued.ToString('o');$p.expiresAt=$until.ToString('o')
 return $p
}
function New-DevelopmentRecoveryQaHostFromAssembly([string]$CaseId,[string]$RunId,[string]$Commit,[datetime]$IssuedAt,[datetime]$ExpiresAt,[string]$ExpectedAssemblySha256) {
 # digest는 외부 exact 실행 결정의 대조값일 뿐 허가가 아니다. 실제 등록 전 I/O보다 먼저 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
 $cases=@('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED','WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE','CLEANUP_UNKNOWN','JOB_MEMBERSHIP')
 $now=[datetime]::UtcNow
 if($CaseId -cnotin $cases -or $RunId -cnotmatch '^r1-[a-z0-9][a-z0-9-]{0,47}$' -or $Commit -cnotmatch '^[a-f0-9]{40}$' -or $ExpectedAssemblySha256 -cnotmatch '^[A-F0-9]{64}$' -or
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
function Invoke-DevelopmentRecoveryQaOwnedHost([string]$CaseId,[string]$RunId,[string]$Commit,[datetime]$IssuedAt,[datetime]$ExpiresAt,[string]$ExpectedAssemblySha256) {
 # 실제 assembly 출처와 실행 승인이 연결되기 전에는 타입 조회·factory 호출보다 먼저 거절한다.
 throw 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'
 $ownedHost=New-DevelopmentRecoveryQaHostFromAssembly $CaseId $RunId $Commit $IssuedAt $ExpiresAt $ExpectedAssemblySha256
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
