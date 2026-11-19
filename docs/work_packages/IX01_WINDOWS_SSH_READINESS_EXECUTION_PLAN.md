# IX01 Windows 준비 상태 한정 읽기 — 실행 결박안

## 1. 상태와 고정 근거

**실행 미승인·미실행.** 이 문서는 기존 후보의 Windows-only 읽기 1회를 실행 의사결정에 올릴 수 있도록 호출을 고정한다. 승인 객체·기록·새 인증/신뢰 권위를 발급하지 않는다. 기존 `IX01_WINDOWS_SSH_READINESS_INSPECTION_CANDIDATE.md`는 수정하지 않는다. SSH·메타/관측 두 단계·원장 쓰기로 자동 이어지지 않는다.

| 구분 | 고정값 |
| --- | --- |
| source commit | `5bf35ac6ad3157e1ee2e5486104bf0b645a1e082` |
| 원 검사 source | `scripts/qa-ix01-subnet-observation-windows-readiness.ps1` |
| 원 Git blob | `4328cc07850553b7edca5028856b05c9ff3a9293` |
| UTF-8/LF 원바이트 | 20,197B / SHA256 `6847D094D436D246983A8EA353C0705541B4FD4C312F596AB78B5FF3EFEA8CC3` |
| 기존 후보 | 12,591B / SHA256 `8BE417E412AAAA8489AAE618B2A69B52D75ED2BDF3A8DCE24A042D95EB2D805A` |
| 직접 합성 근거 | 담당 7P/0F/SKIP0 `10a965`, Main 7P/0F/SKIP0 `509c43`; 실제 native 포트 미호출 |

현재 Git blob과 checkout의 길이/SHA가 일치함을 문서 준비에서 확인했다. 이후 실행 전에도 Main이 지정된 기존 workdir/HEAD를 별도 내부 검산하고 이 exact blob과 고정 checkout 원바이트를 대조한다. 작업 사본의 절대 위치는 이 공유 문서에 기재하지 않는다. checkout 교체·줄바꿈 변환·불일치를 자동 수정하거나 다른 소스를 선택하지 않는다. 아래 원 프로세스는 동일 source를 다시 길이/SHA 검산하여 **소유한 메모리 바이트**만 파싱·적재한다.

검사 closure는 이 PS 파일의 함수 10개와 기존 PowerShell/.NET 기본 런타임뿐이다. 다른 QA 스크립트, FN03 runner, C# host, Node/Rolldown 번들, SSH 실행기 또는 모듈을 import/dot-source하지 않는다. 기존 `exec_command`의 Windows PowerShell 경로를 그대로 사용하며 새 host 지문/설치/인증 gate를 만들지 않는다. 합성시험의 PowerShell 호출은 실제 대상 읽기 승인과 별개다.

## 2. 읽기 범위와 해석 상한

기존 후보 §2의 고정 8역할만 읽는다. `SSH_IMAGE`는 `C:\Windows\System32\OpenSSH\ssh.exe`, user 설정/trust는 `C:\Users\cyhuh\.ssh\config`, `known_hosts`, `known_hosts2`, system 설정/trust는 `C:\ProgramData\ssh\ssh_config`, `ssh_known_hosts`, `ssh_known_hosts2`, 원장 부모 후보는 `D:\Project\Anvil\.av3-data`다. 각각의 정확 부모 체인 metadata/ACL 검사 외 목록·재귀·경로 검색은 없다. exe≤64MiB, config 각≤64KiB, trust 각≤1MiB, 원장 부모의 내용 읽기0을 유지한다.

실제 기본 경로 적용 여부를 읽기 이전에 증명해야 한다는 새 gate는 두지 않는다. 고정 위치의 관측과 현재 사용 준비를 구분해, 수거 성공이어도 `readiness=UNCONFIRMED`다. 부재를 다른 경로의 존재나 적용으로 해석하지 않는다.

설정은 현재 구현의 `Host`, `HostName`, `User`, `Port`, 제한된 `IdentityFile`, `IdentitiesOnly` 정적 subset만 받는다. 해당 IdentityFile **대상은 읽지 않는다**. Include/custom trust/Match 및 지원하지 않는 지시나 표현은 고정 UNKNOWN으로 중단한다. Host 매칭/중복·first-value 우선순위와 실제 alias 인증을 계산하거나 실행하지 않는다. 공개 trust의 알고리즘/유계 base64·wire key-type 형상 검사는 host 인증 성공 판정이 아니다.

SSH `-G/-V`, SSH 접속, WSL/ip/Docker/IPAM, 키·agent·credential·인증서/패키지 DB, 네트워크, C#/SDK/Agent, 설정/ACL/원장 쓰기, 파일 생성·삭제, 다른 프로세스 검색·종료는 0이다. 원 PowerShell 자체의 메모리와 표준출력 외 저장 효과를 추가하지 않는다.

## 3. 실행 전 Main이 확정할 공개 결박

아래 값은 **현재 모두 미기입**이다. 문서가 임의 UUID/승인 hash/수신시각을 만들지 않는다.

| 필드 | 현재 상태 / 확정 책임 |
| --- | --- |
| 승인 ID | 미기입; 신산님의 해당 한정 읽기 직접 승인과 연결되는 기존 대화/승인 식별자 |
| approvalHash | 미기입; Main이 보존한 정확 승인 근거의 SHA256, 이 문서 자체 hash로 대체하지 않음 |
| planHash | 미기입; Main이 고정한 **이 실행안 원바이트**의 SHA256 |
| attemptId | 미기입; Main이 기존 기록에 결박할 단일 UUID v4, 실행 중 생성0 |
| approvalIssuedAtMs / approvalDeadlineMs | 미기입; 확인한 승인 시각과 30분 이내의 절대 종료, 미표시 시각을 추정값으로 기록하지 않음 |
| 원 도구 호출/수거 소유자 | Main이 한 담당자에게만 배정; 원 호출·session ID를 기존 작업 기록에 보존 |

실행 source는 `approvalHash`, `planHash`, `sourceHash`, `attemptId`, `issuedAt`, `expiresAt`의 **6키 Binding**만 받는다. 승인 ID는 그 hash의 외부 근거이며 Binding에 임의 7번째 키로 넣지 않는다. 이 shape 검사는 실제 승인의 진위 검사를 대신하지 않는다.

원 프로세스 시작의 UTC와 monotonic 기준을 잡고, Binding의 `issuedAt`은 그 시각, `expiresAt`은 `min(시작+60초, 승인 절대 종료)`로 파생한다. 승인 후 30분 상한을 새 호출 때문에 연장하지 않는다. 소스 로드·파싱도 원 60초에 포함한다. 각 역할 읽기는 기존 원 소스의 wall/monotonic 10초 경계이며 종료/예외 뒤 다음 대상0이다.

## 4. 단일 원 호출의 정확 본문

실행이 승인되고 §3 값이 고정된 이후에만 아래 본문의 빈 상수 6개를 값으로 치환한다. 치환본 전체 SHA도 Main이 기존 기록에 보존하며 승인 범위 밖 코드는 추가하지 않는다. 현재 빈 상수 상태로 실행하지 않는다. 아래는 **검토용 본문**이고 문서 작성 중 실행하지 않았다.

`exec_command`를 한 번만 사용한다. `workdir`은 Main이 실행 직전 별도 내부 검산한 기존 지정 작업 사본으로 고정하고, `login:false`, `tty:false`, PowerShell `-NoProfile`/비대화 실행을 명시한다. 기존 도구의 원 PowerShell 한 개 안에서 본문을 평가하며 `pwsh`/`powershell`/SSH 하위 프로세스를 다시 만들지 않는다. 기존 승인 플랫폼 심사를 그대로 적용한다. `yield_time_ms`는 10,000ms, 출력 예산은 최소 4KiB 결과를 수거할 수 있는 4,096 tokens로 둔다. 이는 출력 byte cap이나 실행 종료 강제가 아니다. byte cap은 본문에서 검사한다.

```powershell
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$approvalId = ''
$approvalHash = ''
$planHash = ''
$attemptId = ''
$approvalIssuedAtMs = ''
$approvalDeadlineMs = ''
$fallback = '{"schemaVersion":1,"code":"UNKNOWN","readiness":"UNCONFIRMED","reason":"EXECUTION_UNCONFIRMED","files":[]}'
$line = $fallback
$exitCode = 1
$bytes = $null
$sourceStream = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
$startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
try {
    if ($approvalId -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}\z' -or
        $approvalHash -cnotmatch '\A[0-9a-f]{64}\z' -or $planHash -cnotmatch '\A[0-9a-f]{64}\z' -or
        $attemptId -cnotmatch '\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z' -or
        $approvalIssuedAtMs -cnotmatch '\A[0-9]{13}\z' -or $approvalDeadlineMs -cnotmatch '\A[0-9]{13}\z') { throw 'UNBOUND' }
    $approvedAt = [long]$approvalIssuedAtMs
    $approvedUntil = [long]$approvalDeadlineMs
    if ($approvedUntil -le $approvedAt -or $approvedUntil - $approvedAt -gt 1800000 -or
        $startedAt -lt $approvedAt -or $startedAt -ge $approvedUntil) { throw 'EXPIRED' }
    $expiresAt = [Math]::Min($startedAt + 60000L, $approvedUntil)
    $expectedHash = '6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3'
    $sourcePath = Join-Path (Get-Location) 'scripts/qa-ix01-subnet-observation-windows-readiness.ps1'
    $sourceStream = [IO.File]::Open($sourcePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    if ($sourceStream.Length -ne 20197) { throw 'SOURCE' }
    $bytes = [byte[]]::new(20197)
    $offset = 0
    while ($offset -lt $bytes.Length) {
        if ($timer.ElapsedMilliseconds -ge 60000 -or [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $expiresAt) { throw 'EXPIRED' }
        $n = $sourceStream.Read($bytes,$offset,[Math]::Min(8192,$bytes.Length-$offset))
        if ($n -le 0) { throw 'SOURCE' }
        $offset += $n
    }
    if ($sourceStream.ReadByte() -ne -1 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant() -cne $expectedHash) { throw 'SOURCE' }
    $sourceStream.Dispose()
    $sourceStream = $null
    $source = [Text.UTF8Encoding]::new($false,$true).GetString($bytes)
    $tokens = $null
    $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
    $names = @('Get-Ix01WindowsReadinessTargets','Test-Ix01ReadinessKeys','Test-Ix01ReadinessHash','Test-Ix01ReadinessInteger','Test-Ix01ReadinessBudget','Test-Ix01ReadinessObservation','Get-Ix01ReadinessMetadataHash','Get-Ix01ReadinessTextVerdict','Invoke-Ix01WindowsReadiness','New-Ix01WindowsReadinessNativePorts')
    if ($errors.Count -ne 0 -or $ast.EndBlock.Statements.Count -ne $names.Count) { throw 'SOURCE' }
    for ($i=0; $i -lt $names.Count; $i++) {
        $statement = $ast.EndBlock.Statements[$i]
        if ($statement -isnot [Management.Automation.Language.FunctionDefinitionAst] -or $statement.Name -cne $names[$i]) { throw 'SOURCE' }
    }
    . ([scriptblock]::Create($source))
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000) { throw 'EXPIRED' }
    $binding = @{attemptId=$attemptId;approvalHash=$approvalHash;planHash=$planHash;sourceHash=$expectedHash;issuedAt=$startedAt;expiresAt=$expiresAt}
    $ports = New-Ix01WindowsReadinessNativePorts
    $candidate = Invoke-Ix01WindowsReadiness -Binding $binding -Ports $ports
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000 -or
        $candidate -isnot [string] -or $candidate.Contains([char]10) -or $candidate.Contains([char]13) -or
        [Text.Encoding]::UTF8.GetByteCount($candidate)+1 -gt 4096) { throw 'RESULT' }
    $result = $candidate | ConvertFrom-Json -AsHashtable -Depth 12
    if ($result.schemaVersion -ne 1 -or $result.readiness -cne 'UNCONFIRMED' -or $result.code -cnotin @('INSPECTION_COLLECTED','UNKNOWN')) { throw 'RESULT' }
    $line = $candidate
    if ($result.code -ceq 'INSPECTION_COLLECTED') { $exitCode = 0 }
} catch {
    $line = $fallback
    $exitCode = 1
} finally {
    if ($null -ne $sourceStream) { try { $sourceStream.Dispose() } catch { $line=$fallback; $exitCode=1 } }
    if ($null -ne $bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
}
[Console]::Out.Write($line + [char]10)
exit $exitCode
```

이 본문은 원 inspector를 **정확 1회** 호출한다. 실패를 만회하는 재호출·외부 도구·파일 쓰기는 없다. 원 source에서 처리한 UNKNOWN은 제한된 기존 reason과 수거된 role만 반환하며 본문 자체 예외는 원문 대신 `EXECUTION_UNCONFIRMED`다. 디코딩한 관리형 문자열/OS 캐시의 즉시 소거는 보장하지 않는다.

## 5. 원 handle과 결과 수거

원 도구가 session ID를 반환하면 같은 ID만 `write_stdin`의 빈 입력으로 수거한다. 두 번째 `exec_command`, 대상 재조회, SSH, 재시도, 프로세스 검색·kill·자동 정리는 하지 않는다. 도구 출력이 늦거나 기한이 지난 경우에도 **원 handle의 종결 증거 수거만** 허용하며 결과를 늦은 성공으로 승격하지 않는다. 원 도구가 끝나기 전에는 원문 결과 한 줄만으로 완료라고 기록하지 않는다.

수거 성공 조건은 원 호출의 결과 전체가 잘리지 않은 UTF-8 JSON 한 줄(끝 LF 포함≤4,096B), exact Binding/8역할/기존 schema 대조, `INSPECTION_COLLECTED`, 원 프로세스 종료0 및 원 전체 60초·승인 창 안 종료를 함께 확인하는 것이다. 추가 출력·stderr·예외·절단·다른 handle·불명 종료·timeout 또는 종료1은 UNKNOWN이다. 도구 응답은 별도 stdout-end 이벤트를 제공하지 않으므로 정상 종료와 완전한 출력의 도구 증거까지만 주장한다.

동기 파일/ACL OS 호출이 막히면 기존 소스의 전후 시간 검사는 강제 취소를 보증하지 않는다. `yield_time_ms`도 강제 timeout이 아니다. 따라서 60초를 초과한 미종결은 UNKNOWN·원 handle 보존이며 자동 kill이나 다음 읽기를 승인하지 않는다. 엄격한 OS 차원의 60초 내 강제 종료가 별도로 요구되면 이 실행안으로 충족했다고 표시하지 않는다. 새 실행기를 만들어 우회하지 않는다.

## 6. 4KiB 결과의 후속 소비와 남은 조건

원 source `Invoke-Ix01WindowsReadiness`는 성공 때 다음 공개 근거를 제공한다. 출력에 실제 경로·계정/SID·config 값·HostName/Port/User·key 원문/개별 key fingerprint가 없다.

- 원 Binding 6키: 같은 시도/승인 근거 hash/실행안 hash/source hash/절대 60초 창 대조에 사용한다. 승인 자체의 존재/진위를 발급하지 않는다.
- 각 고정 role의 `PRESENT/ABSENT`와 `metadata=MATCHED`: 그 읽기 구간의 타입·부모 링크·해당 소유/ACL 조건 및 전후 metadata 일치를 뜻한다. native FileId 고정이나 다음 접속 때 현재성 증거가 아니다.
- 존재 파일의 `bytes`, `sha256`, `aclHash`: 원 exe와 해당 config/trust 파일의 후속 exact 바이트 비교 자료다. directory는 내용 SHA가 없고 ACL hash만 있다. ABSENT에 가짜 hash를 넣지 않는다.
- 존재 config/trust의 `text=SUBSET_ONLY`: 위 §2의 정적 허용 형상을 통과했다는 뜻이다. `INSPECTION_COLLECTED`는 실제 모든 요청된 검사를 끝낸 경우만 발행하며 기본 경로/환경/host trust 준비는 여전히 미확인이다.

따라서 결과는 후속 verifier의 **공개 측정 입력**으로 소비할 수 있으나 `SubnetWindowsReview`의 `{status:'CURRENT',reviewHash}`를 그대로 대신하지 않는다. `qa-ix01-subnet-observation-windows.ts:42–47,93–98`은 실제 config 적용·alias/trust·launch options·원장 부모의 현재 사실까지 요구한다. carrier의 단일 `configurationSha256`/`knownHostsSha256`에 여러 role hash를 결합하는 규칙도 아직 고정되지 않았다. 무조건 성공 또는 임의 JSON hash로 채우지 않는다.

후속 실제 연결 전 남는 것은 관측된 파일이 실제 기본 적용 집합인지, WSL-server의 실제 설정·신뢰가 어떤 기존 근거로 검산되는지, Windows 최소 env, 이후 변경 확인과 단일 aggregate hash의 정확 의미다. 이 결과만으로 그런 신원 근거가 생겼다고 주장하거나 실제 SSH/원장 쓰기를 시작하지 않는다. 미지원 설정이면 해당 고정 코드로 끝내며 광범위 parser나 추가 파일 판독은 별도 검토 없이 추가하지 않는다.

## 7. 현재 작성 검증 및 확정 순서

문서 작성 단계에서는 저장소 Git source/checkout 지문과 원 소스의 결과 shape만 읽어 대조한다. 위 코드 블록은 PowerShell `Parser.ParseInput`으로 **구문만** 검산한다. scriptblock 생성/평가, native 포트 생성·호출, 실제 target/ACL, 프로세스 실행 절차는 검증하지 않는다. 파서용 기존 로컬 PowerShell은 `login:false/-NoProfile`이며 본문을 실행하지 않는다.

순서는 Main 문서 검수·원바이트 고정 → 이 Windows-only 읽기 1회에 대한 직접 결정 → 실제 승인 ID/근거 hash/시도/절대 시각과 치환본 고정 → 원 도구 호출1 → 원 handle 종결/결과 대조다. 미승인·기한 미기입에는 진입0이다. 원 후보와 검사 소스, 기존 번들·SSH carrier·두 단계 실행 권한은 변동 없다.
