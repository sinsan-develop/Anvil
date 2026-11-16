# P03 WSL-server SSH 단계 진단 후보

상태는 **미채택·실행 0회**다. 앞선 SSH 255와 출력 0행으로는 원격 도달, Docker 호출 수, DB 상태를 판정할 수 없었다. 이번 후보는 기존 Docker 관측을 다시 수행하지 않는다. 결정 단위는 지정 Windows-local OpenSSH가 기존 인증을 사용하는 연결 **최대 1회**와 원격 명령 **/usr/bin/true 하나**다. 대상 사용자의 통상적인 SSH 인증 기록이나 서버 접속 기록이 남을 수 있다. 성공해도 개발 DB나 사본의 상태는 미확인이다.

## 승인과 발행

별도 USER_DIRECT에 후보의 최종 SHA256, 아래 실행 블록, attempt ID P03-SSH-STAGE-20261116-V1, 지정 수행자 1명, WSL-server, 단발 명령 및 새 UTC 창(최대 30분)을 결박한다. Main이 승인·지문·미소진을 대조하고 발행을 먼저 기록한 뒤 지정 수행자만 기존 PowerShell 7 Windows-local shell에서 한 번 발행한다. 아래 창 표식 두 개만 승인된 UTC 값(YYYY-MM-DDTHH:mm:ssZ)으로 대입한다. 창 잔여 30초 미만이면 시작하지 않는다. 후보 작성, 구문 검사와 RAM fixture는 승인이 아니다. 이전 R3/SDK 승인·소진표식 재사용은 0이다. spawn 불명·도구 거절·출력 유실을 포함하여 발행 뒤 추가 SSH/수리/정리 명령은 0회다. 실행 환경은 login:false, tty:false, 필요시 해당 단발만 require_escalated, 영속 prefix 없음이다.

고정 Windows ssh.exe에 기존 alias·기존 사용자 인증·strict hostkey 정책을 적용한다. SSH 자체가 기존 설정·known_hosts·인증 재료를 통상 사용할 수 있고 승인 대상에는 이 인증 시도가 포함된다. Agent가 그 파일 내용, 사용자명·키·지문·설정 덤프를 수집하거나 출력할 권한은 없다. proxy/jump, agent forwarding, multiplex, 포트·X11 forwarding, TTY, 로컬 명령 및 연결 재시도를 사용하지 않는다. 기존 설정의 Match exec·외부 인증 helper 등 별도 실행이 필요한 구성이면 이 안의 대상에서 제외한다. 기존 승인된 환경 근거만으로 직접 alias 조건을 확인할 수 없으면 발행하지 않는다. 설정 내용 조회나 대체 alias 시도는 이 후보의 절차에 없다.

## 분류 규칙

인증 전 서버 배너, 원격 stderr, 로컬 OpenSSH의 -v 진단이 같은 stderr로 들어올 수 있다. 분류기는 두 pipe의 EOF와 원 자식 종료를 관측한 후 완결된 ASCII 줄에서 고정 문구가 어떤 순서로 나타났는지만 판독한다. 출력 mixedStderrPattern의 MIXED_STDERR_* 값에는 문구의 출처나 진위 보증이 없다. 같은 문구를 배너에 넣어도 같은 결과가 나온다. 잘림·불완전·역행·서로 다른 실패 문구는 UNKNOWN으로 남긴다. exit에는 감독자가 직접 관측한 로컬 ssh.exe의 종료 상태만 기록한다. 명령 인자는 /usr/bin/true로 고정하지만 두 필드를 결합해도 실제 DNS/TCP/host key/인증/원격 명령 실행이나 장애 원인을 확정하지 않는다.

## 실행 후보

~~~powershell
$ErrorActionPreference='Stop'
function Classify-Stage([byte[]]$Data,[int]$Count) {
    if ($Count -eq 0 -or $Data[$Count-1] -ne 10) { return 'UNKNOWN' }
    for ($i=0; $i -lt $Count; $i++) {
        $b=$Data[$i]
        if ($b -ne 9 -and $b -ne 10 -and $b -ne 13 -and ($b -lt 32 -or $b -gt 126)) { return 'UNKNOWN' }
    }
    $state='NONE'; $problem='NONE'
    foreach ($line in ([Text.Encoding]::ASCII.GetString($Data,0,$Count) -split '\r?\n')) {
        $failure=$null; $next=$null; $from=$null
        if ($line -cmatch '^ssh: Could not resolve hostname [^:]+: .+$') { $failure='NAME_RESOLUTION_FAILURE'; $from='NONE' }
        elseif ($line -cmatch '^ssh: connect to host .+ port [0-9]+: Connection refused$') { $failure='TCP_REFUSED'; $from='CONNECTING' }
        elseif ($line -cmatch '^ssh: connect to host .+ port [0-9]+: Connection timed out$') { $failure='TCP_TIMEOUT'; $from='CONNECTING' }
        elseif ($line -ceq 'Host key verification failed.') { $failure='HOSTKEY_FAILURE'; $from='TCP_CONNECTED' }
        elseif ($line -cmatch '^.+: Permission denied \([A-Za-z0-9,._@-]+\)\.$') { $failure='AUTH_DENIED'; $from='HOSTKEY_MATCH' }
        elseif ($line -cmatch '^debug1: Connecting to .+ port [0-9]+\.$') { $next='CONNECTING'; $from='NONE' }
        elseif ($line -ceq 'debug1: Connection established.') { $next='TCP_CONNECTED'; $from='CONNECTING' }
        elseif ($line -cmatch "^debug1: Host '.+' is known and matches the .+ host key\.$") { $next='HOSTKEY_MATCH'; $from='TCP_CONNECTED' }
        elseif ($line -cmatch '^Authenticated to .+ using "[^"]+"\.$') { $next='AUTHENTICATED'; $from='HOSTKEY_MATCH' }
        elseif ($line -ceq 'debug1: Sending command: /usr/bin/true') { $next='COMMAND_SENT'; $from='AUTHENTICATED' }
        if ($failure -or $next) {
            if ($state -ne $from -or $problem -ne 'NONE') { return 'UNKNOWN' }
            if ($failure) { $problem=$failure } else { $state=$next }
        }
    }
    if ($problem -ne 'NONE') { return 'MIXED_STDERR_'+$problem+'_TEXT' }
    if ($state -ne 'NONE') { return 'MIXED_STDERR_'+$state+'_TEXT' }
    return 'UNKNOWN'
}
$stage='UNKNOWN'; $ended=$false; $started=$false; $exitValue='UNKNOWN'; $outBytes=$null; $errBytes=$null
$p=[Diagnostics.Process]::new()
$watch=[Diagnostics.Stopwatch]::StartNew()
try {
    $style=[Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    $culture=[Globalization.CultureInfo]::InvariantCulture
    $first=[DateTimeOffset]::ParseExact('__APPROVED_START_UTC__',"yyyy-MM-dd'T'HH:mm:ss'Z'",$culture,$style)
    $end=[DateTimeOffset]::ParseExact('__APPROVED_END_UTC__',"yyyy-MM-dd'T'HH:mm:ss'Z'",$culture,$style)
    $psi=[Diagnostics.ProcessStartInfo]::new()
    $psi.FileName='C:\Windows\System32\OpenSSH\ssh.exe'
    foreach ($arg in @('-v','-T','-x','-oBatchMode=yes','-oStrictHostKeyChecking=yes','-oUpdateHostKeys=no','-oControlMaster=no','-oControlPath=none','-oConnectionAttempts=1','-oConnectTimeout=6','-oForwardAgent=no','-oClearAllForwardings=yes','-oProxyCommand=none','-oProxyJump=none','-oPermitLocalCommand=no','WSL-server','/usr/bin/true')) { $psi.ArgumentList.Add($arg) }
    $psi.UseShellExecute=$false; $psi.CreateNoWindow=$true
    $psi.RedirectStandardInput=$true; $psi.RedirectStandardOutput=$true; $psi.RedirectStandardError=$true
    $psi.Environment.Clear()
    foreach ($key in @('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH')) {
        $v=[Environment]::GetEnvironmentVariable($key)
        if ($null -ne $v) { $psi.Environment[$key]=$v }
    }
    $p.StartInfo=$psi
    $now=[DateTimeOffset]::UtcNow
    if ($now -lt $first -or ($end-$first).TotalSeconds -gt 1800 -or ($end-$now).TotalSeconds -lt 30) { throw 'WINDOW' }
    if (-not $p.Start()) { throw 'LAUNCH' }
    $started=$true
    $p.StandardInput.Close()
    $outBytes=[byte[]]::new(1); $errBytes=[byte[]]::new(32767)
    $out=$p.StandardOutput.BaseStream; $err=$p.StandardError.BaseStream
    $ot=$out.ReadAsync($outBytes,0,1); $et=$err.ReadAsync($errBytes,0,$errBytes.Length)
    $oe=$false; $ee=$false; $n=0
    while ($watch.ElapsedMilliseconds -lt 27000) {
        if (-not $oe -and $ot.IsCompleted) {
            if ($ot.GetAwaiter().GetResult() -ne 0) { throw 'UNEXPECTED_STDOUT' }
            $oe=$true
        }
        if (-not $ee -and $et.IsCompleted) {
            $got=$et.GetAwaiter().GetResult()
            if ($got -eq 0) { $ee=$true }
            else {
                $n+=$got
                if ($n -ge $errBytes.Length) { throw 'CAPTURE_LIMIT' }
                $et=$err.ReadAsync($errBytes,$n,$errBytes.Length-$n)
            }
        }
        if ($oe -and $ee -and $p.HasExited) {
            $ended=$true
            $code=$p.ExitCode
            $exitValue=if ($code -eq 0) {'ZERO'} elseif ($code -eq 255) {'SSH_255'} else {'OTHER'}
            $stage=Classify-Stage $errBytes $n
            break
        }
        [Threading.Thread]::Sleep(10)
    }
} catch { $stage='UNKNOWN' }
finally {
    if ($started -and -not $ended) {
        try {
            if (-not $p.HasExited) { $p.Kill() }
            $left=[int][Math]::Max(0,[Math]::Min(3000,30000-$watch.ElapsedMilliseconds))
            $ended=$p.WaitForExit($left)
        } catch { $ended=$false }
    }
    $p.Dispose()
    if ($null -ne $outBytes) { [Array]::Clear($outBytes,0,$outBytes.Length) }
    if ($null -ne $errBytes) { [Array]::Clear($errBytes,0,$errBytes.Length) }
}
[Console]::WriteLine((@{mixedStderrPattern=$stage; started=$started; ownedExitObserved=$ended; exit=$exitValue} | ConvertTo-Json -Compress))
if ($stage -eq 'UNKNOWN') { exit 2 }
exit 0
~~~

stdout는 1바이트만 관측돼도 UNKNOWN으로 중단하고 stderr는 32767바이트 버퍼가 차면 잘림으로 처리한다. 합산 수거 상한은 32768바이트다. 예외·stderr·PID·계정·주소·경로·fingerprint·원 로그를 출력·파일에 기록하지 않는다. 메모리의 문자열에 대한 완전 삭제나 시스템 자체 인증 로그 제거는 보장하지 않는다. 감독은 27초 관측, 원 소유 프로세스만 최대 잔여 3초 수거한다. 이미 시작한 OS 동기 호출의 정확한 실시간 중단은 미검증이다. stdout에는 고정 enum과 boolean만 반환한다. wrapper exit 0은 혼합 stderr 문구 분류 완료만 뜻한다. exit=ZERO는 로컬 ssh.exe가 0으로 종료했다는 독립 관측이다.

## 오프라인 검산 기록

PowerShell AST로 실행 블록 전체를 파싱하고 Classify-Stage 함수 정의만 분리해 메모리 안에서 호출했다. 합성 완결 줄은 DNS 실패, TCP 거절, host key 실패, 인증 거절, 명령 전송 및 exit 0의 다섯 범주를 확인했다. 줄 끝 LF 누락, 선행 연결 표시 없는 TCP 성립, 두 번째 CONNECTING은 각각 UNKNOWN이었다. 명령 전송 뒤 서버측처럼 보이는 권한거절 줄을 붙이고 SSH exit 255를 주면 COMMAND_SENT_LAST_REPORTED였다. 최초 검산 하네스는 PowerShell 배열 평탄화 때문에 사례명 처리에서 실패했고, 사례별 직접 호출로 정정한 뒤 9/9, 구문 오류 0, exit 0이었다. 실제 SSH·원격 명령·Docker·DB 호출은 모두 0회다.

보완본은 전체 블록 구문 오류 0건, 분류 함수 RAM 반례 14/14 통과(d21b9d)다. 인증 전 합성 배너의 인증·명령 문구도 같은 MIXED_STDERR 패턴만 반환했고, 인증거절과 이름해석 실패를 두 순서로 섞거나 TCP 거절과 시간초과를 섞으면 UNKNOWN이었다. 보완 중 첫 구문 검사는 편집 도중 문자열 종결이 깨져 실패했고, 수정 후 이 검산을 통과했다. 이 검산은 감독부나 SSH 프로세스를 시작하지 않는다.
