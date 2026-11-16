# FN07 Windows 로컬 CLI 신원 한정 읽기 후보

**미채택·미실행.** 제품 기준은 main `8776fe90`이다. 결정할 사항은 현재 Windows 프로세스의 PATH에서 아래 범위의 첫 `claude` Application을 한 번 관측할지다. CLI 경로 및 설치 이미지 신원은 아직 미확인이다.

## 재사용할 증거

- 기존 개발 Node 기록은 `C:\Program Files\nodejs\node.exe`, FileVersion `24.22.1`, SHA256 `D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5`이다. Node를 조회·해시·실행하는 횟수는 0회다. [기존 고정 이미지 근거](FN07_WINDOWS_LOCAL_PINNED_SOURCE_READ_CANDIDATE_20261115.md)
- 고정 공개 SDK `0.3.224`의 sdk.mjs는 1,145,192B·SHA256 `70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5`, sdk.d.ts는 333,809B·SHA256 `556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575`다. 이 결과에서 공개 query의 일반 분기와 원 Query 반환을 확인했다. SDK 원문·tar·로컬 package.json·node_modules를 새로 조회하는 횟수는 0회다. 현재 설치된 SDK의 신원은 이 후보에서 확인되지 않는다. [기존 공개 query 판독](../04_test_reports/AV3/FN07_PUBLIC_QUERY_CHAIN_READ_RESULT_20261116.md)
- 기존 개발환경 기록에 Windows CLI 실행 이미지의 고정 경로·지문은 없다. 알려진 Node 설치 디렉터리 한 곳만 검사하면 CLI 후보를 찾지 못해도 현재 명령 선택에 관한 답을 얻을 수 없다. [개발환경 기록](../DEVELOPMENT_ENVIRONMENT.md)

## 관측 범위와 한계

[고정 조회 소스](../../scripts/fn07-local-cli-identity-read.ps1) SHA256 `2A7E89112023DDB2F40631ABD098529B47AF1A2B6CF87317C7113F56C636F511`. 조회 소스와 아래 감독 블록을 함께 고정한다.

- 조회 소스가 직접 읽는 환경변수는 프로세스 PATH 하나다. 최대 32,767자·64개 항목을 메모리에서 처리한다. 로컬 고정 드라이브 절대 디렉터리만 원 순서대로 검토한다. 상대·UNC·장치 경로·대체 데이터 스트림·환경변수 확장·wildcard·재분석 지점은 제외한다. 경로 구성요소 최대 32개. 전체 PATH와 제외 디렉터리는 출력하지 않는다.
- 디렉터리마다 고정 순서 `claude.exe`, `claude.cmd`, `claude.bat`의 literal 존재 조회만 한다(최대 192번). 첫 후보의 파일 속성을 확인하고 정확한 절대경로로 `Get-Command -CommandType Application -TotalCount 1`을 한 번 사용한다. alias·함수·다른 확장자·자식 디렉터리 탐색·wrapper 대상 해석은 제외한다. 홈·설정·키·사용자 자료의 디렉터리 목록과 본문을 읽지 않는다.
- 래퍼는 경로 대조값·이름·길이·수정시각만 반환한다. EXE는 최대 256MiB, 단일 FileStream에서 최대 64KiB씩 한 번 순차 판독해 MZ/PE 서명 바이트와 SHA256을 얻는다. 판독 전후 같은 문자열 경로의 부모 속성·파일 크기·수정시각·속성을 대조한다. 경로 대조값은 실제 선택한 절대경로 문자열의 UTF-8 SHA256이다. 공개 응답에는 개인 디렉터리와 절대경로 원문을 넣지 않는다.
- 위 검사는 동시 이름 교체, 동일 메타데이터 복원, 다중 하드링크, 핸들의 최종 물리경로·파일 ID를 판별하지 못한다. 결과는 읽은 바이트와 조회한 경로 메타데이터의 관측이다. 코드 서명·공급자 진위·SDK child와의 동일성·실행 승인은 별도다. 이 한계로 관측 자체가 허용되지 않으면 실행을 진행할 수 없다.
- `NO_ELIGIBLE_SCOPE`는 적격 디렉터리 0개, `NOT_FOUND_IN_SCOPE`는 적격 디렉터리 1개 이상을 모두 확인한 뒤 고정 이름 부재다. `WRAPPER_TARGET_UNKNOWN`은 래퍼 메타데이터만 관측했다는 뜻이다. `IMAGE_BYTES_OBSERVED`는 EXE 바이트를 읽고 전후 대조를 마친 결과다. 접근 오류·한도 초과·시간 초과·출력 유실은 `UNKNOWN`이다. Windows 전체에 CLI가 없다는 결론은 어느 결과로도 내릴 수 없다.

## 1회 감독 블록

실행 담당자는 별도 직접 승인에 이 후보의 최종 지문과 조회 소스 지문을 결박하고, 승인 유효시간과 미소진 상태를 확인한 뒤 **PATH 접근이나 프로세스 시작 전에** 해당 승인 ID의 단일 dispatch를 소진 기록한다. 아래 메모리 표식은 같은 감독 세션의 중복 호출도 거절한다. 세션 교체나 결과 불명은 재시작 근거가 되지 않는다.

승인된 개발 checkout 루트의 기존 Windows PowerShell 감독자가 아래 블록을 1회 사용한다. 고정 소스 바이트를 메모리에서 검산한 뒤 무프로필 Windows PowerShell 자식 1개에 전달한다. 감독자 단조시계로 27초 작업과 최대 3초 정지 확인을 배분하고 전체 30초를 초과한 결과는 `UNKNOWN`으로 처리한다. Windows 프로세스 시작·종료 시스템 호출의 자체 지연과 CPU 스케줄링까지 제한하는 실시간 보증은 없다. stdout/stderr 합산 수거 버퍼는 4KiB이고 원오류를 내보내지 않는다. 정지는 소유 Process 객체에 한정하고 종료가 불명하면 원 객체와 소진 상태를 보존한다. 다른 PID 선택·프로세스 트리 종료·자동 재시도는 없다.

```powershell
$ErrorActionPreference = 'Stop'
# Main has verified the approved packet and durably consumed its one dispatch.
if (Get-Variable Fn07CliIdentityIssued -Scope Script -ErrorAction SilentlyContinue) { throw 'ATTEMPT_CONSUMED' }
$script:Fn07CliIdentityIssued = $true
$watch = [Diagnostics.Stopwatch]::StartNew()
$owned = $null
$started = $false
$answer = 'UNKNOWN'
try {
    $file = Join-Path $PWD 'scripts/fn07-local-cli-identity-read.ps1'
    $inputFile = [IO.File]::OpenRead($file)
    try {
        if ($inputFile.Length -lt 1 -or $inputFile.Length -gt 10000) { throw 'SOURCE_SIZE' }
        $bytes = [byte[]]::new([int]$inputFile.Length)
        $filled = 0
        while ($filled -lt $bytes.Length) {
            $take = $inputFile.Read($bytes, $filled, $bytes.Length - $filled)
            if ($take -eq 0) { throw 'SOURCE_SHORT' }
            $filled += $take
        }
        if ($inputFile.Length -ne $bytes.Length) { throw 'SOURCE_CHANGED' }
    } finally { $inputFile.Dispose() }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '') } finally { $sha.Dispose() }
    if ($digest -cne '2A7E89112023DDB2F40631ABD098529B47AF1A2B6CF87317C7113F56C636F511') { throw 'SOURCE_CHANGED' }
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
    if ($watch.ElapsedMilliseconds -ge 27000) { throw 'START_DEADLINE' }
    $started = $owned.Start()
    if (!$started) { throw 'START_UNKNOWN' }
    $out = [byte[]]::new(4095)
    $err = [byte[]]::new(1)
    $pipe = $owned.StandardOutput.BaseStream
    $read = $pipe.ReadAsync($out, 0, $out.Length)
    $errRead = $owned.StandardError.BaseStream.ReadAsync($err, 0, 1)
    $n = 0
    $end = $false
    while ($watch.ElapsedMilliseconds -lt 27000) {
        if ($errRead.IsCompleted -and $errRead.GetAwaiter().GetResult() -ne 0) { throw 'STDERR' }
        if (!$end -and $read.IsCompleted) {
            $count = $read.GetAwaiter().GetResult()
            $end = $count -eq 0
            $n += $count
            if ($n -ge $out.Length) { throw 'OUTPUT_LIMIT' }
            if (!$end) { $read = $pipe.ReadAsync($out, $n, $out.Length - $n) }
        }
        if ($end -and $errRead.IsCompleted -and $owned.HasExited) { break }
        [Threading.Thread]::Sleep(5)
    }
    if ($watch.ElapsedMilliseconds -ge 27000 -or !$owned.HasExited -or $owned.ExitCode -ne 0 -or
        !$end -or !$errRead.IsCompleted -or $errRead.GetAwaiter().GetResult() -ne 0) { throw 'INCOMPLETE' }
    $line = [Text.Encoding]::ASCII.GetString($out, 0, $n)
    $shape = '\A(?:NO_ELIGIBLE_SCOPE|NOT_FOUND_IN_SCOPE|UNKNOWN|IMAGE_BYTES_OBSERVED\|claude\.exe\|[0-9A-F]{64}\|[0-9]{1,19}\|[0-9]{1,19}\|[0-9A-F]{64}|WRAPPER_TARGET_UNKNOWN\|claude\.(?:cmd|bat)\|[0-9A-F]{64}\|[0-9]{1,19}\|[0-9]{1,19}\|-)\r?\n\z'
    if ($line -cnotmatch $shape) { throw 'RESULT_FORMAT' }
    $answer = $line.TrimEnd([char[]]"`r`n")
} catch { $answer = 'UNKNOWN' }
finally {
    if ($null -ne $owned) {
        try {
            if (!$owned.HasExited) {
                $owned.Kill()
                $left = [int][Math]::Min(3000L, [Math]::Max(0L, 30000L - $watch.ElapsedMilliseconds))
                if (!$owned.WaitForExit($left)) { throw 'EXIT_UNCONFIRMED' }
            }
            $owned.Dispose()
        } catch { $script:Fn07UnconfirmedProcess = $owned; $answer = 'UNKNOWN' }
    }
    if ($watch.ElapsedMilliseconds -ge 30000) { $answer = 'UNKNOWN' }
}
$answer
```

조회·설치·네트워크·실제 CLI/SDK/Node/Agent·권한·DB·서비스 실행 0회. 이 후보의 검증 범위는 두 PowerShell 소스의 정적 구문 분석이다.
