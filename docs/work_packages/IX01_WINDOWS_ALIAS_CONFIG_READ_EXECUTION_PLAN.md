# IX01 Windows 지정 alias config 한정 읽기 실행 후보

## 1. 상태와 새 결정 범위

**source-only 준비 완료 여부를 검수하는 후보이며 실제 실행 미승인·미실행이다.** 기준 `ee4a8092`. 앞선 Windows 8역할 읽기 1회는 `UNKNOWN / CONFIG_UNCONFIRMED`로 이미 소진됐다. 원 결과에 설정 원문이 없고 의도적으로 보관하지 않았으므로, 새 offline alias 판독을 그 결과에 소급 적용할 수 없다. 이번에는 새 직접 승인·시도에 결박한 **config 두 파일만의 새 읽기 1회**가 필요하다. 이전 승인·시도·수거 결과는 재사용하지 않는다.

기존 검사 PS `6847D094`, 기존 실행안과 실제 반환값은 불변이다. 새 판단은 당시 실패 원인을 소급 확정하지 않는다. 이 문서는 실제 승인 객체를 만들거나 다음 SSH/관측/원장 쓰기를 자동 승인하지 않는다.

## 2. 정확 읽기와 판정 상한

- `USER_CONFIG`: `C:\Users\cyhuh\.ssh\config`, 원 바이트 최대 65,536B.
- `SYSTEM_CONFIG`: `C:\ProgramData\ssh\ssh_config`, 원 바이트 최대 65,536B.
- 각 고정 위치의 부모 metadata/ACL만 기존 방식으로 확인한다. 목록/재귀/Include 대상 탐색0. 실제 존재가 확인되지 않은 부모나 부재 경로를 새로 만들지 않는다.
- 기존 owner/ACL/reparse·길이·전후 metadata digest·분할 8KiB 읽기·원 stream close 규칙을 재사용한다. `Get-Ix01WindowsReadinessTargets`에서 위 두 역할만 선택하고 8역할 검사 함수는 호출하지 않는다.
- 새 helper는 user→system 순서, 파일별 처음의 전역 구간, 지정 `WSL-server`의 제한된 Host exact/`*`/`?`/`!`, scalar 첫 값, IdentityFile 단일 적용을 계산한다. 비대상의 알려진 무해 값은 해석하지 않는다. 대상의 미지원 지시, Include/Match/명령·proxy 효과와 custom trust는 UNKNOWN이다. 원문·값·경로·키/trust 내용·예외는 출력하지 않는다.
- `ROOT_LITERAL/NON_ROOT_LITERAL/UNSET`은 입력 문자의 분류이며 원격 권한·기본 사용자·접속 허용을 증명하지 않는다. 미설정을 비root로 추정하지 않는다.
- 성공도 `readiness=UNCONFIRMED`다. 실제 기본 경로 적용·Windows env·alias 인증·host trust·현재 권한은 미검증이다. 이 두 파일의 관측을 8역할 비교 지문이나 `CURRENT`로 승격하지 않는다.

실제 SSH(`-G/-V` 포함), WSL/ip/Docker/IPAM, exe·known_hosts·개인키·agent·환경 덤프·DB·서비스·SDK/Agent, 설정/ACL/원장 및 모든 파일 쓰기·삭제0. 새 프로세스 검색/종료0. 허용 원 PowerShell의 메모리 및 제한 표준출력만 사용한다.

## 3. 고정 source closure와 미기입 결박

기존 지정 workdir/정확 HEAD는 Main이 실행 직전 별도 내부 검산한다. 공유 문서에는 작업 사본 절대경로를 넣지 않는다. 새 소스 commit은 Main 커밋 후 고정할 슬롯이며 지금은 미기입이다. 아래 원 바이트 길이/SHA는 이미 고정한다. Main은 최종 commit의 Git blob과 checkout 양쪽을 대조하고 같은 세 source만 메모리에 적재한다.

| 상대 source | UTF8 bytes | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-subnet-observation-windows-readiness.ps1 | 20197 | 6847D094D436D246983A8EA353C0705541B4FD4C312F596AB78B5FF3EFEA8CC3 |
| scripts/qa-ix01-subnet-observation-alias-config.ps1 | 7325 | EB0B94496E2C28C8C0193C2904CF3477D07B9A18540A673B9739C7D446CDD488 |
| scripts/qa-ix01-subnet-observation-config-readiness.ps1 | 8463 | 5D2B8D4442B7A4B8C3F7C98BAA0B1C114BA20178CDE7C5A411572D79D3AEF8CC |

추가 import/모듈/설치0. 기본 PowerShell/.NET만 쓴다. alias helper의 `RegexOptions.NonBacktracking`이 없는 런타임은 UNKNOWN이며 호환 우회를 하지 않는다. 합성시험에서는 기존 NoProfile PowerShell로 파싱·메모리 포트만 평가했다.

다음은 모두 **미기입**이다: source commit, 실행안 exact SHA/commit, 승인 ID, approvalHash, 새 attemptId(UUIDv4), 확인한 승인 UTC 및 절대 종료. Main이 신규 직접 승인 근거를 보존하고 한 담당자에게 원 실행 소유권을 배정한다. 문서의 빈 문자열을 자동 생성하지 않는다. `sourceHash`는 위 새 wrapper SHA이며 두 고정 의존성은 원 planHash와 적재 검사에 결박한다.

승인 후 30분 내 절대 종료를 상한으로, 프로세스 시작부터 source 적재/파싱/읽기/직렬화 전체 60초, 각 config 읽기≤10초를 wall/monotonic으로 전후 검사한다. 원 deadline을 늘리지 않는다. 동기 OS 호출의 강제 중단 보증은 아니므로 미종결 초과는 UNKNOWN·원 handle 보존이다.

## 4. 신규 승인 후 정확 원 호출

기존 `exec_command`를 정확 1회, Main이 검산한 지정 workdir에서 PowerShell `login:false`(`-NoProfile`), 비대화, `tty:false`, `yield_time_ms:10000`, 출력 예산 4096 tokens로 호출한다. 이는 바이트 상한·강제 timeout이 아니다. 자식 PowerShell/SSH를 다시 만들지 않는다. 아래 여섯 공개 빈 상수는 신규 승인 기록으로만 채우며 치환본 SHA도 기존 기록에 보존한다. **현재 빈 상태로 실행하지 않는다.**

```powershell
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue';$InformationPreference='SilentlyContinue';$VerbosePreference='SilentlyContinue';$DebugPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$approvalId='';$approvalHash='';$planHash='';$attemptId='';$approvalIssuedAtMs='';$approvalDeadlineMs=''
$fallback='{"schemaVersion":1,"code":"UNKNOWN","readiness":"UNCONFIRMED","reason":"EXECUTION_UNCONFIRMED","files":[]}'
$line=$fallback;$exitCode=1;$stream=$null;$bytes=$null
$timer=[Diagnostics.Stopwatch]::StartNew();$startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
try {
    if($approvalId -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}\z' -or $approvalHash -cnotmatch '\A[0-9a-f]{64}\z' -or $planHash -cnotmatch '\A[0-9a-f]{64}\z' -or
       $attemptId -cnotmatch '\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z' -or
       $approvalIssuedAtMs -cnotmatch '\A[0-9]{13}\z' -or $approvalDeadlineMs -cnotmatch '\A[0-9]{13}\z') {throw 'UNBOUND'}
    $approvedAt=[long]$approvalIssuedAtMs;$approvedUntil=[long]$approvalDeadlineMs
    if($approvedUntil -le $approvedAt -or $approvedUntil-$approvedAt -gt 1800000 -or $startedAt -lt $approvedAt -or $startedAt -ge $approvedUntil){throw 'EXPIRED'}
    $expiresAt=[Math]::Min($startedAt+60000L,$approvedUntil)
    $sources=@(
      @{path='scripts/qa-ix01-subnet-observation-windows-readiness.ps1';bytes=20197;hash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3';names=@('Get-Ix01WindowsReadinessTargets','Test-Ix01ReadinessKeys','Test-Ix01ReadinessHash','Test-Ix01ReadinessInteger','Test-Ix01ReadinessBudget','Test-Ix01ReadinessObservation','Get-Ix01ReadinessMetadataHash','Get-Ix01ReadinessTextVerdict','Invoke-Ix01WindowsReadiness','New-Ix01WindowsReadinessNativePorts')}
      @{path='scripts/qa-ix01-subnet-observation-alias-config.ps1';bytes=7325;hash='eb0b94496e2c28c8c0193c2904cf3477d07b9a18540a673b9739c7d446cdd488';names=@('Read-Ix01SubnetAliasConfig')}
      @{path='scripts/qa-ix01-subnet-observation-config-readiness.ps1';bytes=8463;hash='5d2b8d4442b7a4b8c3f7c98baa0b1c114ba20178cde7c5a411572d79d3aef8cc';names=@('Invoke-Ix01ConfigReadiness')}
    )
    foreach($pin in $sources){
        $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000){throw 'EXPIRED'}
        $stream=[IO.File]::Open((Join-Path (Get-Location) $pin.path),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        if($stream.Length -ne $pin.bytes){throw 'SOURCE'}
        $bytes=[byte[]]::new($pin.bytes);$offset=0
        while($offset -lt $bytes.Length){
            $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000){throw 'EXPIRED'}
            $n=$stream.Read($bytes,$offset,[Math]::Min(8192,$bytes.Length-$offset));if($n -le 0){throw 'SOURCE'};$offset+=$n
        }
        if($stream.ReadByte() -ne -1 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant() -cne $pin.hash){throw 'SOURCE'}
        $stream.Dispose();$stream=$null
        $source=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
        $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
        if($errors.Count -ne 0 -or $ast.EndBlock.Statements.Count -ne $pin.names.Count){throw 'SOURCE'}
        for($i=0;$i -lt $pin.names.Count;$i++){
            if($ast.EndBlock.Statements[$i] -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $ast.EndBlock.Statements[$i].Name -cne $pin.names[$i]){throw 'SOURCE'}
        }
        . ([scriptblock]::Create($source))
        [Array]::Clear($bytes,0,$bytes.Length);$bytes=$null
    }
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000){throw 'EXPIRED'}
    $binding=@{attemptId=$attemptId;approvalHash=$approvalHash;planHash=$planHash;sourceHash=$sources[2].hash;issuedAt=$startedAt;expiresAt=$expiresAt}
    $ports=New-Ix01WindowsReadinessNativePorts
    $candidate=Invoke-Ix01ConfigReadiness -Binding $binding -Ports $ports
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000 -or $candidate -isnot [string] -or $candidate.Contains([char]10) -or $candidate.Contains([char]13) -or [Text.Encoding]::UTF8.GetByteCount($candidate)+1 -gt 4096){throw 'RESULT'}
    $result=$candidate|ConvertFrom-Json -AsHashtable -Depth 12
    if($result.schemaVersion -ne 1 -or $result.readiness -cne 'UNCONFIRMED' -or $result.code -cnotin @('CONFIG_INSPECTION_COLLECTED','UNKNOWN')){throw 'RESULT'}
    $line=$candidate;if($result.code -ceq 'CONFIG_INSPECTION_COLLECTED'){$exitCode=0}
} catch {$line=$fallback;$exitCode=1} finally {
    if($null -ne $stream){try{$stream.Dispose()}catch{$line=$fallback;$exitCode=1}}
    if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}
}
[Console]::Out.Write($line+[char]10)
exit $exitCode
```

## 5. 원 수거와 후속 사용

원 session ID가 있으면 같은 handle의 빈 `write_stdin` 수거만 한다. 두 번째 실행/대상 재조회/재시도/검색·kill·자동 정리0. 한 줄이 먼저 보였어도 원 프로세스 정상 종료0 및 시간 내 종료가 확인돼야 수거 성공이다. 원 handle의 실제 종료가 불명하거나 초과면 UNKNOWN으로 남기고 늦은 성공을 채택하지 않는다. 도구가 별도 stdout-end를 제공하지 않으면 원 정상 종료와 완전 출력까지의 증거만 기록한다.

수거 성공은 strict UTF8 JSON 한 줄+LF≤4096B, exact 새 Binding, 정확 두 role/보호 metadata·길이/SHA/ACL, 제한 alias 결과 및 원 종료0을 함께 대조한다. `UNKNOWN`/종료1은 정상 수거된 실패일 뿐 PASS가 아니다. 절단·추가 출력·다른 handle·비정상 종료·기한 초과도 성공이 아니다.

alias 실패 진단은 닫힌 reason과 `{role:USER_CONFIG|SYSTEM_CONFIG,line:0..4096}`뿐이다. 최초 불명 뒤 다음 파일 읽기0이다. 두 파일을 다 읽은 뒤 누적 IdentityFile 충돌이 드러나면 이미 읽은 측정만 보존하고 alias 성공을 발급하지 않는다. metadata/전송/시간 오류에는 추정한 config 행을 붙이지 않는다.

성공 출력은 필드별 원 역할/행, 사용자 literal 분류, 두 파일의 비교 지문뿐이다. HostName/User/Port/IdentityFile 값은 반환하지 않는다. 따라서 이 결과만으로 실제 접속 대상·인증·신뢰나 원장 부모를 승인할 수 없다. 추가 원문 확보/광범위 parser/실제 접속으로 자동 이어지지 않는다. 관리형 문자열·OS 캐시 즉시 소거는 보장하지 않는다.

## 6. 검증·롤백

신규 시험은 세 source를 NoProfile PowerShell에서 AST 함수 정의만 확인한 뒤 기존 RAM 포트로 평가한다. 실제 native 포트를 호출하지 않는다. 정상 두 역할/부재/두 PRESENT·첫 값, 원 close, metadata·권한·읽기·기한 불명, 제한 진단·4KiB를 확인한다. 문서 본문은 파싱만 하며 실행하지 않는다.

미검증: 실제 두 config와 부모/owner/ACL·현재 OS·기본 적용 경로·실제 SSH와 trust/env·동기 OS 강제 종료. 롤백은 이번 신규 source/시험/문서 3경로만 제외하는 것으로 기존 고정 검사·기록·자원에 영향이 없다. Git/문서 통합과 신규 직접 승인 요청은 Main 소유다.
