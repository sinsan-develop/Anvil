# FN07 Windows 로컬 CLI 한정 조회 진단 후보

**NOT_APPROVED_EXECUTION**. `20670a`는 부모 exit 0과 UNKNOWN을 반환했다. 자식 단계·종료코드는 미확인이다. 원 승인과 소진 기록을 보존한다. 이 후보를 실행하려면 새 직접 승인에 조회 소스와 이 문서의 최종 SHA256, 유효창과 단발 dispatch를 결박해야 한다. 현 시각·소스 검증만으로 승인 창을 발급하지 않는다.

[기존 관측 범위](FN07_LOCAL_SDK_CLI_IDENTITY_READ_CANDIDATE_20261116.md)와 [새 조회 소스](../../scripts/fn07-local-cli-identity-read-v2.ps1)를 함께 검토한다. 새 소스 SHA256은 `0FD03A3F62C508F1E7343FBD80DC03DED0AFE30251C1D2356450E271F5B28120`이다. 기존 Node와 공개 SDK 지문은 재사용한다. 목적은 선택된 CLI의 바이트·제한된 메타데이터 관측이며 실행 이미지 신원·서명·SDK child와의 동일성은 미확인이다.

PATH 최대 32,767자·64항목, 경로 깊이 32개, 적격 로컬 고정 디렉터리당 세 literal(최대 192회), 첫 후보 하나만 확인한다. UNC·상대·재분석 경로를 제외한다. cmd/bat은 본문·해시를 읽지 않는다. PE는 256MiB·64KiB 버퍼의 순차 단일 판독, MZ/PE·길이·전후 속성 검산을 유지한다. 원 경로·PATH·예외·stderr는 출력하지 않는다. 같은 메타데이터로 복원된 경로·하드링크·최종 물리 신원은 확인하지 못한다.

감독은 고정 무프로필 자식 최대 1개, stdout 4095B와 stderr 감지 1B, 작업 27초·정지 확인 최대 3초·총 30초를 사용한다. 다른 PID 조회·트리 종료·다른 탐색·재시도는 없다. 시작 호출 자체가 불명이면 원 Process 객체를 보존한다. 진단의 첫 행은 검산된 자식 관측값 또는 UNKNOWN이며, 자식 자체의 실패는 UNKNOWN|단계|고정이유다. 두 번째 행은 감독의 최초 실패, 회수 실패, 자식 종단, 확인한 종료코드와 총 기한을 분리한다. EOF·stderr 비어 있음·exit 0·한도·원행 형상 확인 전에는 자식 원행을 채택하지 않는다. 늦은 종단이나 회수 불명에서 성공을 반환하지 않으며 이미 확인된 자식 실패를 보존한다. 시작 전 실패의 NO_START, 확인된 정상/정지후 종료, UNCONFIRMED를 구분한다. 확인 전 종료코드는 `-`이다.

## 고정 감독 블록

```powershell
$ErrorActionPreference = 'Stop'
function Read-Fn07ChildLine([byte[]]$bytes, [int]$n) {
    if ($null -eq $bytes -or $n -le 0 -or $n -ge 4095 -or $n -gt $bytes.Length) { return $null }
    $line = [Text.Encoding]::ASCII.GetString($bytes, 0, $n)
    $shape = '\A(?:NO_ELIGIBLE_SCOPE|NOT_FOUND_IN_SCOPE|UNKNOWN\|(?:SCOPE|DIRECTORY|PROBE|METADATA|COMMAND|IMAGE|RECHECK)\|(?:OTHER|TIME_LIMIT|PATH_LIMIT|DIR_LIMIT|DEPTH_LIMIT|FILE_TYPE|FILE_LOST|IMAGE_SIZE|SIZE_CHANGED|SHORT_READ|IMAGE_HEADER|IMAGE_SIGNATURE|PATH_CHANGED|PARENT_CHANGED|METADATA_CHANGED)|IMAGE_BYTES_OBSERVED\|claude\.exe\|[0-9A-F]{64}\|[0-9]{1,19}\|[0-9]{1,19}\|[0-9A-F]{64}|WRAPPER_TARGET_UNKNOWN\|claude\.(?:cmd|bat)\|[0-9A-F]{64}\|[0-9]{1,19}\|[0-9]{1,19}\|-)\r?\n\z'
    if ($line -cnotmatch $shape) { return $null }
    return $line.TrimEnd([char[]]"`r`n")
}
function Format-Fn07Result([byte[]]$bytes, [int]$n, [bool]$complete, [string]$failure,
    [string]$cleanup, [string]$terminal, [Nullable[int]]$exitCode, [bool]$late) {
    $answer = 'UNKNOWN'
    if ($failure -cnotin @('NONE','SOURCE','SOURCE_SIZE','SOURCE_CHANGED','PREPARE','START_DEADLINE','START','PIPE','STDERR','OUTPUT_LIMIT','TIME_LIMIT','INCOMPLETE','CHILD_EXIT','FORMAT')) { $failure = 'INCOMPLETE' }
    if ($cleanup -cnotin @('NONE','STOP_UNCONFIRMED','RECLAIM_FAILED')) { $cleanup = 'RECLAIM_FAILED' }
    if ($terminal -cnotin @('NO_START','EXIT_CONFIRMED','EXIT_AFTER_STOP','UNCONFIRMED')) { $terminal = 'UNCONFIRMED' }
    $exit = '-'
    if ($terminal -cin @('EXIT_CONFIRMED','EXIT_AFTER_STOP') -and $null -ne $exitCode) { $exit = [string]$exitCode }
    if ($complete -and $failure -ceq 'NONE' -and $terminal -ceq 'EXIT_CONFIRMED' -and $exit -ceq '0') {
        $parsed = Read-Fn07ChildLine $bytes $n
        if ($null -eq $parsed) { $failure = 'FORMAT' }
        elseif (($cleanup -ceq 'NONE' -and !$late) -or $parsed.StartsWith('UNKNOWN|')) { $answer = $parsed }
    } elseif ($failure -ceq 'NONE') { $failure = 'INCOMPLETE' }
    $deadline = if ($late) { 'EXCEEDED' } else { 'WITHIN' }
    $answer
    "SUPERVISOR=$failure|CLEANUP=$cleanup|CHILD=$terminal|EXIT=$exit|TOTAL=$deadline"
}

# A new approved dispatch must already have been durably consumed by Main.
if (Get-Variable Fn07CliIdentityV2Issued -Scope Script -ErrorAction SilentlyContinue) { throw 'ATTEMPT_CONSUMED' }
$script:Fn07CliIdentityV2Issued = $true
$watch = [Diagnostics.Stopwatch]::StartNew()
$owned = $null
$startAttempted = $false
$started = $false
$exitCode = $null
$terminal = 'NO_START'
$cleanup = 'NONE'
$failure = 'NONE'
$phase = 'SOURCE'
$out = $null
$n = 0
$complete = $false
try {
    $file = Join-Path $PWD 'scripts/fn07-local-cli-identity-read-v2.ps1'
    $inputFile = [IO.File]::OpenRead($file)
    try {
        if ($inputFile.Length -lt 1 -or $inputFile.Length -gt 10000) { $phase = 'SOURCE_SIZE'; throw 'STOP' }
        $bytes = [byte[]]::new([int]$inputFile.Length)
        $filled = 0
        while ($filled -lt $bytes.Length) {
            $take = $inputFile.Read($bytes, $filled, $bytes.Length - $filled)
            if ($take -eq 0) { $phase = 'SOURCE_CHANGED'; throw 'STOP' }
            $filled += $take
        }
        if ($inputFile.Length -ne $bytes.Length) { $phase = 'SOURCE_CHANGED'; throw 'STOP' }
    } finally { $inputFile.Dispose() }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '') } finally { $sha.Dispose() }
    if ($digest -cne '0FD03A3F62C508F1E7343FBD80DC03DED0AFE30251C1D2356450E271F5B28120') { $phase = 'SOURCE_CHANGED'; throw 'STOP' }
    $phase = 'PREPARE'
    $src = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($src))
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
    $info.Arguments = '-NoLogo -NoProfile -NonInteractive -EncodedCommand ' + $encoded
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $owned = [Diagnostics.Process]::new()
    $owned.StartInfo = $info
    if ($watch.ElapsedMilliseconds -ge 27000) { $phase = 'START_DEADLINE'; throw 'STOP' }
    $phase = 'START'
    $startAttempted = $true
    $terminal = 'UNCONFIRMED'
    $started = $owned.Start()
    if (!$started) { throw 'STOP' }
    $phase = 'PIPE'
    $out = [byte[]]::new(4095)
    $err = [byte[]]::new(1)
    $pipe = $owned.StandardOutput.BaseStream
    $read = $pipe.ReadAsync($out, 0, $out.Length)
    $errRead = $owned.StandardError.BaseStream.ReadAsync($err, 0, 1)
    $end = $false
    while ($watch.ElapsedMilliseconds -lt 27000) {
        if ($errRead.IsCompleted -and $errRead.GetAwaiter().GetResult() -ne 0) { $phase = 'STDERR'; throw 'STOP' }
        if (!$end -and $read.IsCompleted) {
            $count = $read.GetAwaiter().GetResult()
            $end = $count -eq 0
            $n += $count
            if ($n -ge $out.Length) { $phase = 'OUTPUT_LIMIT'; throw 'STOP' }
            if (!$end) { $read = $pipe.ReadAsync($out, $n, $out.Length - $n) }
        }
        if ($end -and $errRead.IsCompleted -and $owned.HasExited) { break }
        [Threading.Thread]::Sleep(5)
    }
    if ($watch.ElapsedMilliseconds -ge 27000) { $phase = 'TIME_LIMIT'; throw 'STOP' }
    if (!$end -or !$errRead.IsCompleted -or !$owned.HasExited) { $phase = 'INCOMPLETE'; throw 'STOP' }
    if ($errRead.GetAwaiter().GetResult() -ne 0) { $phase = 'STDERR'; throw 'STOP' }
    $terminal = 'EXIT_CONFIRMED'
    $exitCode = $owned.ExitCode
    if ($exitCode -ne 0) { $phase = 'CHILD_EXIT'; throw 'STOP' }
    $complete = $true
} catch { $failure = $phase }
finally {
    if ($null -ne $owned) {
        try {
            if ($startAttempted -and !$started) {
                $script:Fn07UnconfirmedProcess = $owned
            } else {
                if ($started) {
                    if ($owned.HasExited) { $terminal = 'EXIT_CONFIRMED' }
                    else {
                        $owned.Kill()
                        $left = [int][Math]::Min(3000L, [Math]::Max(0L, 30000L - $watch.ElapsedMilliseconds))
                        if (!$owned.WaitForExit($left)) { $cleanup = 'STOP_UNCONFIRMED'; throw 'STOP' }
                        $terminal = 'EXIT_AFTER_STOP'
                    }
                    $exitCode = $owned.ExitCode
                }
                $owned.Dispose()
            }
        } catch {
            $script:Fn07UnconfirmedProcess = $owned
            if ($cleanup -ceq 'NONE') { $cleanup = 'RECLAIM_FAILED' }
        }
    }
}
Format-Fn07Result $out $n $complete $failure $cleanup $terminal $exitCode ($watch.ElapsedMilliseconds -ge 30000)
```

이 문서의 시험 범위는 구문 분석과 두 순수 결과 함수의 RAM 입력이다. 실제 관측·프로세스·설치·권한·서비스·CLI·SDK·Agent·자료 조회는 미실행이다.
