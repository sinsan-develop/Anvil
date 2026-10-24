param([switch]$Plan)
$ErrorActionPreference='Stop'
# source-only 계획/검증. Add-Type·assembly load·handle·process·cert/trust 연산은 없다.
function Get-DevelopmentRecoverySourcePlan([string]$Mode) {
 if ($Mode -notin @('P2','P3')) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
 return @{
  mode=$Mode;tlsRoot='D:\Project\Anvil\.av3-data\dev-tls-20261025-01'
  bootstrapRoot='D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01'
  artifactRoot='D:\Project\Anvil\.av3-data\n4-recovery-01\artifacts'
  runtimeRoot='D:\Project\Anvil\.av3-data\n4-recovery-01\runtime'
  compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  compilerHash='46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00'
  assemblyName='DevelopmentRecoveryPathGuard.dll'
  maxWindowMs=$(if($Mode -eq 'P2'){600000}else{1800000})
  maxInventoryFiles=100000;maxInventoryBytes=2147483648
  maxRetainedHandleCandidate=4096;nativePinCapacityVerified=$false
  # 소스 후보의 탐색 상한일 뿐 실제 OS 능력·용량 검증을 의미하지 않는다.
  nativeVerified=$false;bootstrapExceptionAccepted=$false;executionAuthorized=$false
  missing=@('EXACT_SOURCE_REVIEW','BOOTSTRAP_EXCEPTION_DECISION','NATIVE_COMPILE_DECISION','ACTUAL_OS_NEGATIVE_QA','AUTHENTICATED_GUARD_LIFETIME','EXACT_RUNTIME_FILE_MANIFEST','PIN_CAPACITY_AND_STARTUP_TIME')
 }
}
function Read-DevelopmentRecoverySourceBinding([hashtable]$Value,[datetimeoffset]$Now) {
 $keys=@('mode','commit','runId','issuedAt','expiresAt')
 if (!$Value -or $Value.Count -ne $keys.Count -or @($Value.Keys|Where-Object{$_ -notin $keys}).Count) { throw 'DEVELOPMENT_RECOVERY_BINDING_INVALID' }
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
if($MyInvocation.InvocationName -ne '.'){
 if($Plan){Get-DevelopmentRecoverySourcePlan 'P2'|ConvertTo-Json -Depth 3 -Compress}
 else{throw 'DEVELOPMENT_RECOVERY_OS_NOT_VALIDATED'}
}
