# QA 순수 함수: 프로세스/파일/네트워크/환경/OS catalog 접근이나 실행 권한 발급이 없다.
function Get-A3CompileDiagnostic {
 param(
  [AllowEmptyCollection()][byte[]]$Stdout = @(),
  [AllowEmptyCollection()][byte[]]$Stderr = @(),
  [int]$ExitCode,
  [bool]$Complete,
  [string]$ExpectedAbsoluteSource,
  [hashtable]$OsReasons = @{}
 )
 $outCopy = $null; $errCopy = $null
 try {
  # 경로 문자열의 분류만 수행한다. 정규화나 실제 파일 동일성 판정이 아니다.
  $strictPathText = {
   param([string]$Value)
   if ([string]::IsNullOrEmpty($Value) -or $Value.Length -gt 4096) { return $false }
   $body = $Value.Replace('\','/')
   if ($body -cmatch '^[A-Za-z]:/') { $body = $body.Substring(3) }
   if ($body -cnotmatch '^[\x20-\x7e]+$' -or $body -cmatch '[<>:"|?*]') { return $false }
   foreach ($segment in $body.Split('/')) {
    if ($segment.Length -eq 0 -or $segment.Length -gt 255 -or $segment -match '[. ]$') { return $false }
   }
   return $true
  }
  if ($null -eq $Stdout -or $null -eq $Stderr -or $Stdout.Length + $Stderr.Length -gt 16384 -or
      $ExpectedAbsoluteSource.Length -gt 4096 -or $ExpectedAbsoluteSource -cnotmatch '^[A-Za-z]:[\\/][\x20-\x7e]+[\\/]apps[\\/]connector[\\/]native[\\/]SourceReadObserver\.cs$' -or
      -not (& $strictPathText $ExpectedAbsoluteSource) -or $OsReasons.Count -gt 6) { throw 'A3_DIAG_INPUT_INVALID' }
  foreach ($key in $OsReasons.Keys) {
   $entry = $OsReasons[$key]
   if ([string]$key -cnotin @('2','3','5','32','33','123') -or $entry -isnot [hashtable] -or
       @($entry.Keys | Sort-Object) -join ',' -cne 'ansi,utf8' -or $entry.utf8 -isnot [byte[]] -or $entry.ansi -isnot [byte[]] -or
       $entry.utf8.Length -eq 0 -or $entry.utf8.Length -gt 4096 -or $entry.ansi.Length -gt 4096) { throw 'A3_DIAG_INPUT_INVALID' }
  }
  $outCopy = [byte[]]$Stdout.Clone(); $errCopy = [byte[]]$Stderr.Clone()
  $stdoutFact = @{capturedBytes=$outCopy.Length;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($outCopy)).ToLowerInvariant()}
  $stderrFact = @{capturedBytes=$errCopy.Length;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($errCopy)).ToLowerInvariant()}
  $diagnostics = [Collections.Generic.List[object]]::new(); $messages = [Collections.Generic.List[string]]::new(); $limitHit = $false
  foreach ($bytes in @($outCopy,$errCopy)) {
   $text = [Text.Encoding]::Latin1.GetString($bytes)
   foreach ($row in ($text -split '\r?\n')) {
    $match = [regex]::Match($row,'^\s*(?:(?:.+?\.cs)(?:\([0-9]{1,7}(?:,[0-9]{1,7})?\))?\s*:\s*|(?:CSC\s*:\s*)?)(?:fatal\s+)?(error|warning)\s+(CS[0-9]{4})\s*:(.*)$',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) { continue }
    if ($diagnostics.Count -ge 32) { $limitHit = $true; break }
    $code = $match.Groups[2].Value.ToUpperInvariant(); $severity = $match.Groups[1].Value.ToLowerInvariant()
    $diagnostics.Add(@{code=$code;severity=$severity})
    if ($code -ceq 'CS1504' -and $severity -ceq 'error') { $messages.Add($match.Groups[3].Value) }
   }
  }
  $detail = $null
  if ($ExitCode -ne 0 -and $messages.Count -gt 0) {
   $detail = @{fileRole='UNKNOWN';osReason='UNKNOWN'}
   if ($Complete -and -not $limitHit -and $messages.Count -eq 1) {
    $message = $messages[0]
    $english = [regex]::Match($message,"^[ \t]*Source file '([^'\r\n]+)' could not be opened (?:-- '([^'\r\n]*)'|\('([^'\r\n]*)'\))[ \t]*$")
    $localized = if (-not $english.Success) { [regex]::Match($message,"^([^']*)'([^']+)'([^']*)'([^']*)'([ \t().]*)$") } else { $null }
    $knownLayout = $english.Success -or ($null -ne $localized -and $localized.Success -and ($localized.Groups[1].Value+$localized.Groups[3].Value) -match '[\x80-\xff]')
    if ($knownLayout) {
     $file = if ($english.Success) { $english.Groups[1].Value } else { $localized.Groups[2].Value }
     $reason = if ($english.Success) { if ($english.Groups[2].Success) {$english.Groups[2].Value} else {$english.Groups[3].Value} } else { $localized.Groups[4].Value }
     $path = $file.Replace('\','/'); $absolute = $ExpectedAbsoluteSource.Replace('\','/')
     $literal = 'apps/connector/native/SourceReadObserver.cs'
     $alias = -not (& $strictPathText $path) -or ([string]::Equals($path,$literal,[StringComparison]::OrdinalIgnoreCase) -and $path -cne $literal) -or ([string]::Equals($path,$absolute,[StringComparison]::OrdinalIgnoreCase) -and $path -cne $absolute)
     if (-not $alias) {
      if ($path -ceq $literal) { $detail.fileRole='SOURCE_LITERAL' }
      elseif ($path -ceq $absolute) { $detail.fileRole='SOURCE_ABSOLUTE' }
      elseif ($path -cmatch '^[A-Za-z]:/[A-Za-z0-9_. /-]+/SourceReadObserver\.cs$') { $detail.fileRole='SOURCE_BASENAME_ELSEWHERE' }
      elseif ($path -cmatch '^(?:[A-Za-z]:/)?[A-Za-z0-9_. /-]+\.cs$') { $detail.fileRole='OTHER_SOURCE' }
     }
     $reasons = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
     switch -CaseSensitive ($reason) {
      'Access is denied.' { [void]$reasons.Add('ACCESS_DENIED') }
      'The process cannot access the file because it is being used by another process.' { [void]$reasons.Add('SHARING_VIOLATION') }
      'The system cannot find the file specified.' { [void]$reasons.Add('NOT_FOUND') }
      'The system cannot find the path specified.' { [void]$reasons.Add('NOT_FOUND') }
      'The filename, directory name, or volume label syntax is incorrect.' { [void]$reasons.Add('OTHER_OS_REASON') }
     }
     $numeric = [regex]::Match($reason,'^Win32 error (2|3|5|32|33|123)$')
     $hresult = [regex]::Match($reason,'^0x800700(02|03|05|20|21|7[bB])$')
     $code = if ($numeric.Success) { [int]$numeric.Groups[1].Value } elseif ($hresult.Success) { [Convert]::ToInt32($hresult.Groups[1].Value,16) } else { $null }
     if ($null -ne $code) { [void]$reasons.Add($(if($code -eq 5){'ACCESS_DENIED'}elseif($code -in @(32,33)){'SHARING_VIOLATION'}elseif($code -in @(2,3)){'NOT_FOUND'}else{'OTHER_OS_REASON'})) }
     foreach ($key in $OsReasons.Keys) {
      foreach ($encoding in @('utf8','ansi')) {
       $bytes = $OsReasons[$key][$encoding]
       if ($bytes.Length -gt 0 -and [string]::Equals([Text.Encoding]::Latin1.GetString($bytes),$reason,[StringComparison]::Ordinal)) {
        [void]$reasons.Add($(if([string]$key -ceq '5'){'ACCESS_DENIED'}elseif([string]$key -in @('32','33')){'SHARING_VIOLATION'}elseif([string]$key -in @('2','3')){'NOT_FOUND'}else{'OTHER_OS_REASON'}))
       }
      }
     }
     if ($reasons.Count -eq 1) { $detail.osReason = @($reasons)[0] }
    }
   }
  }
  return [pscustomobject]@{kind='A3_COMPILE_DIAGNOSTIC_INPUT';inputExitCode=$ExitCode;complete=$Complete;diagnosticLimitHit=$limitHit;stdout=$stdoutFact;stderr=$stderrFact;diagnostics=$diagnostics.ToArray();sourceOpenFailure=$detail;executionAuthorized=$false;actualExecutionVerified=$false}
 } catch { throw 'A3_DIAG_INPUT_INVALID' }
 finally {
  if ($null -ne $outCopy) { [Array]::Clear($outCopy,0,$outCopy.Length) }
  if ($null -ne $errCopy) { [Array]::Clear($errCopy,0,$errCopy.Length) }
 }
}
