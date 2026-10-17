function Read-Ui11RuntimeBinding([hashtable]$Value,[datetimeoffset]$Now) {
 try{
  $issued=[datetimeoffset]::Parse($Value.issuedAt)
  $expiry=[datetimeoffset]::Parse($Value.expiresAt)
  $run=[guid]::Empty
  if($Value.approval -cne 'AV3-PMO-N4-SERVICE-TRANSITION' -or $Value.commit -cnotmatch '^[0-9a-f]{40}$' -or $Value.scriptHash -notmatch '^[0-9A-Fa-f]{64}$' -or $Value.flowHash -notmatch '^[0-9A-Fa-f]{64}$' -or $Value.runId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' -or ![guid]::TryParseExact($Value.runId,'D',[ref]$run) -or $run -eq [guid]::Empty -or $run.ToString() -cne $Value.runId -or $Now -lt $issued -or $Now -ge $expiry -or $expiry -le $issued -or ($expiry-$issued).TotalSeconds -gt 7200){throw 'INVALID'}
  return @{commit=$Value.commit;scriptHash=$Value.scriptHash.ToUpperInvariant();flowHash=$Value.flowHash.ToUpperInvariant();runId=$Value.runId;issuedAt=$issued;expiresAt=$expiry}
 }catch{throw 'UI11_RUNTIME_BINDING_INVALID'}
}
function Invoke-Ui11RuntimeEffect([hashtable]$State,[hashtable]$Effects,[string]$Step,[switch]$Recovery){
 $State.Phase=$Step
 try{$null=& $Effects.Receipt $State}catch{$State.ReceiptFailure=$true;if(!$Recovery){throw}}
 if($Step -eq 'StopOriginal'){$State.OriginalStopAttempted=$true}
 if($Step -eq 'StartNew'){$State.NewStartAttempted=$true}
 $null=& $Effects[$Step] $State
}
function Invoke-Ui11RuntimeFlow([hashtable]$State,[hashtable]$Effects){
 try{
  Invoke-Ui11RuntimeEffect $State $Effects 'Prepare'
  Invoke-Ui11RuntimeEffect $State $Effects 'StopOriginal'
  $State.OriginalStopped=$true
  Invoke-Ui11RuntimeEffect $State $Effects 'Publish'
  Invoke-Ui11RuntimeEffect $State $Effects 'StartNew'
  Invoke-Ui11RuntimeEffect $State $Effects 'VerifyNew'
  $State.Status='PASS'
  $State.Phase='DONE'
  $null=& $Effects.Receipt $State
 }catch{
  $message=$_.Exception.Message
  $State.Failure=$(if($message -cmatch '^UI11_[A-Z0-9_]{1,90}$'){$message}else{'UI11_RUNTIME_STEP_FAILED'})
  if(!$State.OriginalStopAttempted){$State.Status='FAIL_BEFORE_STOP'}
  elseif(!$State.OriginalStopped){$State.Status='FAIL_ORIGINAL_STOP_UNKNOWN'}
  else{
   try{
    if($State.NewStartAttempted){Invoke-Ui11RuntimeEffect $State $Effects 'StopNew' -Recovery}
    Invoke-Ui11RuntimeEffect $State $Effects 'Restore' -Recovery
    Invoke-Ui11RuntimeEffect $State $Effects 'StartRollback' -Recovery
    Invoke-Ui11RuntimeEffect $State $Effects 'VerifyRollback' -Recovery
    $State.RollbackConfirmed=$true
    $State.Status='FAIL_ROLLED_BACK'
   }catch{
    $rollbackMessage=$_.Exception.Message
    $State.RollbackFailure=$(if($rollbackMessage -cmatch '^UI11_[A-Z0-9_]{1,90}$'){$rollbackMessage}else{'UI11_ROLLBACK_STEP_FAILED'})
    $State.Status='FAIL_ROLLBACK_UNCONFIRMED'
   }
  }
  try{$null=& $Effects.Receipt $State}catch{$State.ReceiptFailure=$true}
 }
 return $State
}
function Assert-Ui11ServiceProof([hashtable]$Observed,[hashtable]$Expected){
 $listeners=@($Observed.listeners)
 if(!$Expected -or !$Observed.alive -or $Observed.pid -ne $Expected.pid -or $Observed.exe -ne $Expected.exe -or $Observed.createdUtc -cne $Expected.createdUtc -or $Observed.title -cne $Expected.title -or $listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].LocalPort -ne 3830 -or $listeners[0].OwningProcess -ne $Expected.pid){throw 'UI11_ACTIVE_SERVICE_PROOF_INVALID'}
}
function Set-Ui11AtomicIndex([string]$Stage,[string]$Destination,[string]$Backup,[string]$StageHash,[string]$BeforeHash){
 $parent=[IO.Path]::GetFullPath((Split-Path -Parent $Destination))
 foreach($path in @($Stage,$Destination,$Backup)){
  if([IO.Path]::GetFullPath((Split-Path -Parent $path)) -ne $parent){throw 'UI11_ATOMIC_VOLUME_MISMATCH'}
 }
 if(Test-Path -LiteralPath $Backup){throw 'UI11_ATOMIC_BACKUP_EXISTS'}
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 foreach($path in @($parent,$Stage,$Destination)){
  $item=Get-Item -LiteralPath $path -Force -ErrorAction Stop
  if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-Acl -LiteralPath $path).Owner -ne $owner){throw 'UI11_ATOMIC_METADATA_INVALID'}
 }
 if((Get-FileHash -LiteralPath $Stage -Algorithm SHA256).Hash -ne $StageHash -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $BeforeHash){throw 'UI11_ATOMIC_HASH_MISMATCH'}
 # backup은 같은 volume의 명시적 새 파일이다. null/빈 backup 인자를 사용하지 않는다.
 [IO.File]::Replace($Stage,$Destination,$Backup)
 if((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $StageHash -or (Get-FileHash -LiteralPath $Backup -Algorithm SHA256).Hash -ne $BeforeHash){throw 'UI11_ATOMIC_POSTCHECK_FAILED'}
}
function Get-Ui11NodeArgumentLine([string]$RunId,[string]$Slot,[string]$Entry){
 if($RunId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' -or $Slot -notin @('new','rollback') -or $Entry -match '["\r\n]' -or ![IO.Path]::IsPathFullyQualified($Entry)){throw 'UI11_NODE_ARGUMENT_INVALID'}
 return '--title=anvil-ui11-n4-'+$RunId+'-'+$Slot+' "'+$Entry+'"'
}
function Get-Ui11ChildEnvironment([System.Collections.IDictionary]$ParentEnvironment,[string]$DataRoot){
 $result=@{}
 foreach($key in $ParentEnvironment.Keys){if([string]$key -like 'ANVIL_*'){$result[[string]$key]=$null}}
 foreach($key in @('NODE_OPTIONS','NODE_PATH','NODE_TLS_REJECT_UNAUTHORIZED')){$result[$key]=$null}
 $result.ANVIL_TLS_KEY=Join-Path $DataRoot 'dev-tls/server.key.pem'
 $result.ANVIL_TLS_CERT=Join-Path $DataRoot 'dev-tls/server.cert.pem'
 $result.ANVIL_DB_CONFIG=Join-Path $DataRoot 'db-app.json'
 $result.ANVIL_AUTH_CONFIG=Join-Path $DataRoot 'auth.json'
 $result.ANVIL_HOST='127.0.0.1';$result.ANVIL_PORT='3830'
 $result.ANVIL_ARTIFACT_ROOT=$null
 return $result
}
