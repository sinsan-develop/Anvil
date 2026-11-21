# IX01 조건부 재개 계획

기준 `5012a0d68814c91f542b71861cdb6373cc216280`. 목표는 기존 WSL-server 접속 경로를 검산하고 충돌하지 않는 전용 망에서 TC01 방법론 저장·재조회 여정을 확인하는 것이다. 이 문서는 후보이며 실행 권위를 발급하지 않는다. 수행자는 기존 Primary, 검수·소진 결박은 Main이 맡는다.

정본은 [WORK_PLAN의 IX01](../WORK_PLAN.md)과 [기존 격리 시험안](IX01_CURRENT_TC01_EXECUTION_CANDIDATE_20261108.md)이다. [실제 Windows 읽기 이력](../WORK_STATUS.md#ix01-두-설정-파일-일괄-진단과-결과-판독-연결)에 남은 USER_CONFIG 54행은 미지원으로 분류됐다. 그 지시가 대상 alias에서 실제 적용되거나 위험하다고 확인한 근거는 없다. N2에서 확인된 충돌은 `172.30.250.0/28`에 한한다.

## 1. Windows 로컬 진단을 한 번 수거

- [이전 통합 읽기 외피](IX01_WINDOWS_FINAL_READINESS_EXECUTION_PLAN.md)의 SHA256 `44ED1B9A16471E91C334530815DB23BA27643ADCB6D5360A77559B28772978D7`를 부모로 사용한다. 승인 시각·기한·승인/계획 SHA·시도 ID 결박, 동일 프로세스 종결, 고정 함수 AST·원 바이트 검사, UTF-8 한 줄+LF 최대 4096B, 전체 60초·파일당 10초 상한을 유지한다.
- 실행 본문의 적재 표만 아래 네 경로로 고정한다. 1·3번 함수 목록은 부모 외피와 같다. 2번은 `Read-Ix01SubnetAliasConfig`, 4번은 `Invoke-Ix01ConfigReadiness`다. 네 번째 지문을 binding의 sourceHash로 사용하고, 원 포트에서 `Invoke-Ix01ConfigReadiness -Binding $binding -Ports $ports -DiagnosticOnly`를 한 번 호출한다. 과거 외피나 소비 기록을 덮어쓰지 않는다.

| 소스 | 바이트 | SHA256 |
| --- | ---: | --- |
| `scripts/qa-ix01-subnet-observation-windows-readiness.ps1` | 22156 | `BB1704D58BD9B92D56A84FCADAD7D26BFE22F89D0D3C5AA8396880D75FE44E42` |
| `scripts/qa-ix01-subnet-observation-alias-config.ps1` | 10415 | `D65F57C7D3B46AC813151BCFE8792492F35DDE8A4A5AFAD59A5B396ED06BCDBB` |
| `scripts/qa-ix01-subnet-observation-identity-path.ps1` | 3874 | `5846A8D06AA7CAA8453A792DF52A37562D2C37F6BEFE932B3C608C399758E2BC` |
| `scripts/qa-ix01-subnet-observation-config-readiness.ps1` | 10009 | `30ECE222C2F5F194E8BD3DE5F952B012C5FDCFDDACA4FE3A42E9A5D6E448DBEF` |

- Windows 사용자·시스템 SSH 설정의 고정 두 경로와 그 부모의 기존 metadata 확인만 한다. 각 파일 최대 64KiB이며 각각 한 번만 연다. 원문·지시값·키·추가 파일을 수거하지 않는다. 일반 미지원은 최대 16개, 초과 여부, 고정 사유·역할·행·지정 alias의 제한된 적용 분류만 남긴다. Include·Match·프로그램 효과·별도 trust 경로·파일/기한 불명에서 멈춘다. SSH 실행, 설정 변경, 개인키 읽기, 원장 생성은 이 단계에 포함되지 않는다.
- 원 외피의 종료 판정은 새 출력 코드에 맞춘다. `CONFIG_DIAGNOSTIC_COLLECTED`는 종료0, `UNKNOWN`은 종료1이다. 같은 원 handle의 기한 내 정상 종결과 expected binding을 확인한 뒤 `readSubnetWindowsConfigDiagnosticResult`로 이 바이트를 판독한다. 일부 진단만 남거나 종료가 불명이면 후속 단계 0회다. `BOTH_CONFIGS`도 실제 적용·신뢰를 입증하지 않는다. 별도 효과를 보인 지시 또는 대상 적용이 불명인 일반 미지원이 있으면 운영자가 기존 설정을 직접 확인해 지시의 범주·대상 적용 여부·효과 분류만 전달할 수 있다.

## 2. 기존 접속 경로와 전용 대역 확인

- 진단에 이어 실제 선택 alias·호스트 신뢰가 기존 승인 경로와 일치하고, 추가 효과 없이 고정 carrier로 접속할 수 있음을 현재 근거로 확인한 경우에만 진행한다. carrier가 덮는 세 개 설정의 진단 코드는 고정 argv와 의미를 대조해 사용한다. 다른 alias, 임시 config, 신뢰 자동 등록, `ssh -G`를 이용한 우회는 사용하지 않는다.
- [두 단계 단회 관측안](IX01_SUBNET_OBSERVATION_SINGLE_ATTEMPT_EXECUTION_CANDIDATE.md)의 기존 metadata SSH 최대 1회와 관측 SSH 최대 1회를 같은 시도에 결박한다. 첫 SSH부터 합계 최대 60초, metadata 10초, 관측 명령당 최대 10초를 유지한다. 단계별 기존 소진 기록, 같은 원 handle의 수거와 현재 검사에서 멈춤 기준을 유지한다. 실제 `verifyCarrier`의 설정·신뢰 근거 공급, 배타 소비 기록, 원 프로세스 감독의 현재 검수가 선행된다.
- [IPv4 관측안](IX01_SUBNET_CANDIDATE_READ_ONLY_PLAN.md)의 모든 IPv4 인터페이스·경로와 해당 Docker 네트워크의 IPAM만 투영한다. 보존 네트워크는 이 IPAM 필드만 읽도록 직접 승인이 필요한 별도 범위다. 주소 원문·망 이름·ID·연결 컨테이너 정보·로그·DB는 수거하지 않는다. 후보 `/28` 하나 또는 `NO_CANDIDATE/UNKNOWN`으로 끝낸다. 관측이 성공해도 주소가 예약됐다고 주장하지 않는다.

## 3. 기존 승인 범위의 격리 TC01

- 기존 J3 검증 승인은 횟수만으로 다시 받지 않는다. 기존 0095 역할 생성·회수 범위를 유지하고 새 격리 자원의 정확 소스·스키마·도구·동작을 대조한다. 새 시도 ID·유한 실행창 및 정확 소비 기록을 사용한다.
- 새 통합 프로필은 FN03 격리 runner의 132개 설치·0095/0101 역할 검산 및 회수와 기존 `--subnet` 연결을 재사용한다. 승인 입력, 실제 망 생성, IPAM 및 양쪽 endpoint 검산에 같은 `/28`을 사용한다. 생성 직전 비충돌이 불명이면 생성하지 않는다. 원 A14 runner의 130개 SQL·자원·소진·보존 이력은 보존한다.
- `runMethodologyCopyApplicationScenario`만 같은 격리 앱에 연결한다. FN03 관리 원문 여정 종료 뒤 기존 앱·Pool을 닫기 전에 정상 합성 로그인과 원 현재성 검사를 사용해 별도 합성 프로젝트에서 TC01을 수행한다. 이 순서를 택하면 TC01의 의도된 거절과 롤백이 FN03 준비 단계의 COMMIT 전용 검사에 섞이지 않는다. 방법론 복사·개정·옛 검토에 의한 확정 거절·정확 버전 적용·원본 추가 개정 뒤 고정본 재조회와 원 권한을 확인한다.
- FN03 실패 시 TC01을 시작하지 않는다. TC01 실패·기한 불명에서는 FN03의 확인 근거를 남기고 전체 성공 및 정리를 막는다. 새 프로필의 두 여정이 모두 확인됐을 때만 기존 원 handle과 정확 소유 자원 정리 규칙을 적용한다. 실패·불명 뒤 후속 조회, 재실행, 자동 삭제는 하지 않는다. 실제 132개 설치·0101 역할 효과는 기존 FN03 source-only 승인에 포함되지 않는다.

## 검수와 채택 경계

- 먼저 §1의 고정 외피 치환 결과를 LF 원바이트로 확정하고 PS AST 파싱 및 기존 RAM 포트 결과의 종단→판독 연결을 확인한다. 실제 포트는 그 단계에서 호출하지 않는다.
- §2 감독과 §3 통합 프로필이 실제 입력·동작으로 연결됐을 때 정확한 추가 효과만 한 번에 검토한다. §1의 신규 제한 읽기, §2의 SSH·소진 기록·보존망 IPAM, §3의 0101을 포함한 새 실제 설치·저장 효과를 기존 J3와 대조한다. 이 문서는 실행 승인 없이 보존한다.

## 부록 A. §1 고정 실행본문 — 미승인·미실행

부모의 PowerShell 코드 블록을 기준으로 2·4번 source pin, 진단 진입과 종료 코드만 치환했다. Main은 실행 직전 지정 workdir/HEAD와 네 Git blob·checkout 원바이트를 별도 대조한다. 기존 `exec_command`의 `login:false`, NoProfile·비대화·`tty:false`, 원 handle 하나를 유지한다. 아래 여섯 승인 상수는 공백이며 원 승인 guard가 source 읽기와 native 포트 생성보다 먼저 거절한다. 실제 승인 전 이 본문은 AST 파싱만 한다.

코드 블록은 첫 `$ErrorActionPreference`부터 마지막 `exit $exitCode` 뒤 LF까지 UTF-8 5460바이트, SHA256 `357F720A88251869B322CF2015EC9BFF03B0142C51DDA4472D18CF2ED1C1619E`이다. 신규 승인 후 상수를 채운 치환본은 별도 지문을 기록한다. 이 지문이 승인이나 실행 소유권을 발급하지 않는다.

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
      @{path='scripts/qa-ix01-subnet-observation-windows-readiness.ps1';bytes=22156;hash='bb1704d58bd9b92d56a84fcadad7d26bfe22f89d0d3c5aa8396880d75fe44e42';names=@('Get-Ix01WindowsReadinessTargets','Test-Ix01ReadinessKeys','Test-Ix01ReadinessHash','Test-Ix01ReadinessInteger','Test-Ix01ReadinessBudget','Test-Ix01ReadinessObservation','Get-Ix01ReadinessMetadataHash','Get-Ix01ReadinessTextVerdict','Invoke-Ix01WindowsReadiness','New-Ix01WindowsReadinessNativePorts')}
      @{path='scripts/qa-ix01-subnet-observation-alias-config.ps1';bytes=10415;hash='d65f57c7d3b46ac813151bcfe8792492f35dde8a4a5afad59a5b396ed06bcdbb';names=@('Read-Ix01SubnetAliasConfig')}
      @{path='scripts/qa-ix01-subnet-observation-identity-path.ps1';bytes=3874;hash='5846a8d06aa7caa8453a792df52a37562d2c37f6befe932b3c608c399758e2bc';names=@('Read-Ix01IdentityPathSyntax')}
      @{path='scripts/qa-ix01-subnet-observation-config-readiness.ps1';bytes=10009;hash='30ece222c2f5f194e8bd3de5f952b012c5fdcfddaca4fe3a42e9a5d6e448dbef';names=@('Invoke-Ix01ConfigReadiness')}
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
    $binding=@{attemptId=$attemptId;approvalHash=$approvalHash;planHash=$planHash;sourceHash=$sources[3].hash;issuedAt=$startedAt;expiresAt=$expiresAt}
    $ports=New-Ix01WindowsReadinessNativePorts
    $candidate=Invoke-Ix01ConfigReadiness -Binding $binding -Ports $ports -DiagnosticOnly
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000 -or $candidate -isnot [string] -or $candidate.Contains([char]10) -or $candidate.Contains([char]13) -or [Text.Encoding]::UTF8.GetByteCount($candidate)+1 -gt 4096){throw 'RESULT'}
    $result=$candidate|ConvertFrom-Json -AsHashtable -Depth 12
    if($result.schemaVersion -ne 1 -or $result.readiness -cne 'UNCONFIRMED' -or $result.code -cnotin @('CONFIG_DIAGNOSTIC_COLLECTED','UNKNOWN')){throw 'RESULT'}
    $line=$candidate;if($result.code -ceq 'CONFIG_DIAGNOSTIC_COLLECTED'){$exitCode=0}
} catch {$line=$fallback;$exitCode=1} finally {
    if($null -ne $stream){try{$stream.Dispose()}catch{$line=$fallback;$exitCode=1}}
    if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}
}
[Console]::Out.Write($line+[char]10)
exit $exitCode
```

원 출력 바이트를 재직렬화하지 않고 `5012a0d6`의 `readSubnetWindowsConfigDiagnosticResult(raw, expectedBinding)`에 전달한다. decoder source SHA256는 `8214AC2A43116108B231DE15B7A8116397D2DEC72385123634460767533632C0`이다. `UNKNOWN`의 제한 진단은 비교 기록으로만 보존하며 종료1·부분 결과·기한 불명에서 후속 실행0이다. decoder의 `BOTH_CONFIGS`는 출력 범위이며 원 handle 종료0·기한·승인 증거를 대신하지 않는다.
