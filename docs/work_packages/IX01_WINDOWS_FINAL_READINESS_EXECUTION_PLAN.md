# IX01 Windows 8역할·alias 최종 비교 수거 실행 후보

## 1. 상태와 정확 목적

**실제 실행 미승인·미실행.** 생산자 소스는 `ef52ba33a7db6ea9db5ffe0defc622091e8232dc`에 고정한다. 기존 `4633b68b` 및 `1b5232a7`의 소진된 읽기·문서·반환 증거는 보존하고 재사용하지 않는다. 새 직접 승인 이후 한 담당자만 이 계획의 신규 시도를 정확 1회 수행한다. 현재 승인/시도/시각은 빈칸이며 이 문서는 승인 객체를 발급하지 않는다.

목적은 이미 준비한 8역할 검사와 새 alias 분류를 같은 원 읽기에 연결하고, 후속 비교 지문을 얻는 **최종 한정 수거 1회**다. config를 먼저 읽고 다시 8역할을 읽는 두 단계가 아니다. USER_CONFIG와 SYSTEM_CONFIG는 각각 최대 open1/read loop1이며, 그 원 바이트로 alias를 판독한다. 실패 뒤 후속 읽기·재시도·새 연결0이다. 원 관측에서 config 원문을 보관하지 않았으므로 이전 출력에 새 분류를 소급 적용할 수 없다.

성공 표시는 `COMPARISON_ONLY / UNCONFIRMED`다. 현재 적용 경로·alias 인증·host trust·Windows env·원격 신원·권한·SSH 사용 준비를 증명하지 않는다. source/합성 통과를 실제 OS 검수나 IX01/TC01 완료로 승격하지 않는다.

## 2. 고정 closure와 대상

Main은 실행 직전 기존 지정 workdir/정확 HEAD를 별도 내부 검산하고, 아래 네 파일의 `ef52ba33` Git blob과 checkout 원 바이트를 대조한다. 작업 사본 주소를 공유 문서에 기록하지 않는다. UTF8 source를 아래 순서로 길이/SHA 및 함수 AST 이름까지 검산한 후 메모리에만 적재한다. 새로운 module/SDK/설치/동적 source 검색0이다.

| source | bytes | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-subnet-observation-windows-readiness.ps1 | 22156 | BB1704D58BD9B92D56A84FCADAD7D26BFE22F89D0D3C5AA8396880D75FE44E42 |
| scripts/qa-ix01-subnet-observation-alias-config.ps1 | 8309 | D972A785A99CC8C883B15AB716B8D939241E5E5663F56D67D73581FF0C15E09B |
| scripts/qa-ix01-subnet-observation-identity-path.ps1 | 3874 | 5846A8D06AA7CAA8453A792DF52A37562D2C37F6BEFE932B3C608C399758E2BC |
| scripts/qa-ix01-subnet-observation-windows-final-readiness.ps1 | 523 | AD2254C843F97FF420EEE2D35CF6968783F199694EE5B6404BDDE69DD74CD3D8 |

새 실행은 `Invoke-Ix01WindowsFinalReadiness` 한 번에서 기존 8역할 순회를 명시 alias 모드로 호출한다. `Invoke-Ix01ConfigReadiness`를 별도로 실행하지 않는다. 기본 모드와 역사 `6847D094` 판독기는 원 계약을 유지한다.

| 역할 | 고정 대상 | 한도/내용 |
| --- | --- | --- |
| SSH_IMAGE | `C:\Windows\System32\OpenSSH\ssh.exe` | ≤64MiB, metadata/owner/ACL·파일 SHA, 실행0 |
| USER_CONFIG | `C:\Users\cyhuh\.ssh\config` | ≤64KiB, 원 바이트 SHA·alias 메모리 분류 |
| SYSTEM_CONFIG | `C:\ProgramData\ssh\ssh_config` | ≤64KiB, 원 바이트 SHA·alias 메모리 분류 |
| USER_TRUST | `C:\Users\cyhuh\.ssh\known_hosts` | ≤1MiB, 공개 trust의 기존 제한 형상·파일 SHA |
| USER_TRUST_2 | `C:\Users\cyhuh\.ssh\known_hosts2` | ≤1MiB, 같은 제한 |
| SYSTEM_TRUST | `C:\ProgramData\ssh\ssh_known_hosts` | ≤1MiB, 같은 제한 |
| SYSTEM_TRUST_2 | `C:\ProgramData\ssh\ssh_known_hosts2` | ≤1MiB, 같은 제한 |
| LEDGER_PARENT | `D:\Project\Anvil\.av3-data` | 해당 디렉터리 metadata/owner/ACL만, 내용/쓰기0 |

각 고정 대상의 정확 부모 체인 metadata/ACL만 함께 검사하며 열거·재귀·다른 위치 검색0이다. reparse/교체/접근 불명은 UNKNOWN. 기본 경로라는 사실을 자동 인증하지 않는다. 부재는 ABSENT이고 다른 파일의 존재·적용으로 해석하지 않는다.

개인키/IdentityFile 대상·agent/credential·환경 변수/레지스트리 조회0, 공개 trust 원문/개별 키 출력0. SSH `-G/-V`·접속·WSL/ip/Docker/IPAM·DB·서비스·SDK/Agent0. 권한·ACL·설정·trust 변경, 원장 생성/쓰기, 파일 생성·삭제0. 공개 trust의 한정 형상은 실제 host 인증이 아니다. 정상 Windows path 분류도 파일 존재나 설치판의 실제 lexer/인증을 입증하지 않는다.

## 3. 신규 승인 및 원 handle 결박

승인 ID, approvalHash, planHash, 새 attemptId, approvalIssuedAtMs, approvalDeadlineMs는 **현재 모두 미기입**이다. Main이 이 계획의 정확 원 바이트 hash 및 신규 직접 승인 근거를 기존 기록에 보존한다. 이전 소진 승인·시도 값을 복사하지 않는다. 실행 소유권은 신규 실제 승인 후 한 담당자에게만 배정한다.

승인 후 최대30분의 절대 종료 안에서 프로세스 시작부터 source 로드/파싱/읽기/직렬화까지60초, 각 역할은10초 이내를 wall/monotonic으로 전후 검산한다. `expiresAt=min(원 시작+60초, 승인 절대 종료)`이며 지연 때문에 연장하지 않는다. sourceHash는 AD2254 전체값이다. 나머지 세 source는 source commit·planHash·고정 적재 검산에 결박된다.

기존 `exec_command` 한 번을 지정 workdir에서 `login:false`인 NoProfile 비대화 PowerShell, `tty:false`, `yield_time_ms:10000`, 출력 예산4096 tokens로 사용한다. 새 pwsh/SSH 자식 실행기를 만들지 않는다. token 예산과 yield는 byte 상한·강제 timeout이 아니다. 다음 본문은 검토용이며 **빈 상수 상태로 실행하지 않는다**. 신규 승인 뒤 여섯 공개 상수만 채우고 치환본 SHA도 기존 기록에 남긴다.

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
      @{path='scripts/qa-ix01-subnet-observation-alias-config.ps1';bytes=8309;hash='d972a785a99cc8c883b15ab716b8d939241e5e5663f56d67d73581ff0c15e09b';names=@('Read-Ix01SubnetAliasConfig')}
      @{path='scripts/qa-ix01-subnet-observation-identity-path.ps1';bytes=3874;hash='5846a8d06aa7caa8453a792df52a37562d2c37f6befe932b3c608c399758e2bc';names=@('Read-Ix01IdentityPathSyntax')}
      @{path='scripts/qa-ix01-subnet-observation-windows-final-readiness.ps1';bytes=523;hash='ad2254c843f97ff420eee2d35cf6968783f199694ee5b6404bdde69dd74cd3d8';names=@('Invoke-Ix01WindowsFinalReadiness')}
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
    $candidate=Invoke-Ix01WindowsFinalReadiness -Binding $binding -Ports $ports
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($now -lt $startedAt -or $now -ge $expiresAt -or $timer.ElapsedMilliseconds -ge 60000 -or $candidate -isnot [string] -or $candidate.Contains([char]10) -or $candidate.Contains([char]13) -or [Text.Encoding]::UTF8.GetByteCount($candidate)+1 -gt 4096){throw 'RESULT'}
    $result=$candidate|ConvertFrom-Json -AsHashtable -Depth 12
    if($result.schemaVersion -ne 1 -or $result.readiness -cne 'UNCONFIRMED' -or $result.code -cnotin @('COMPARISON_ONLY','UNKNOWN')){throw 'RESULT'}
    $line=$candidate;if($result.code -ceq 'COMPARISON_ONLY'){$exitCode=0}
} catch {$line=$fallback;$exitCode=1} finally {
    if($null -ne $stream){try{$stream.Dispose()}catch{$line=$fallback;$exitCode=1}}
    if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}
}
[Console]::Out.Write($line+[char]10)
exit $exitCode
```

## 4. 수거·정상/불명 판정과 소비

원 session ID가 반환되면 같은 handle만 빈 `write_stdin`으로 종결 수거한다. 별도 실행·대상 재조회·재시도·프로세스 검색/kill·자동 정리0. 한 줄 선출력·종료 요청은 완료 증거가 아니다. 같은 원 프로세스의 종료0, 완전한 strict UTF8 JSON 한 줄+LF≤4096B, 시간 내 종결과 exact 신규 binding을 모두 확인한다. 추가 출력·절단·다른 handle·불명 종료·초과는 UNKNOWN이다. 동기 OS 호출을 강제로60초 안에 멈춘다는 보증은 없으며, 초과한 원 handle은 보존·종결 수거만 하고 늦은 성공을 채택하지 않는다.

후속 순수 소비 함수는 `scripts/qa-ix01-subnet-observation-windows-readiness-result.ts`의 **`readSubnetWindowsFinalReadinessResult(raw, expectedBinding)`**다. 검수 source SHA256는 `F4907E314FEC4370F0532A4548861F23374FAC8144E94478F56627B624FC1AB3`이며 생산자 PS에 포함되거나 원 OS를 호출하지 않는다. Main이 이 소비자와 실행안의 최종 commit/hash를 별도 기록한다. 기존 6847용 export·기대값은 그대로이며 새 결과를 구형 API로 강제 수용시키지 않는다.

소비자는 owned bytes→4KiB/fatal UTF8/BOM·단일 JSON/LF·중복키 거절→exact AD2254 binding→원 8역할 순서/부재/길이/SHA/ACL→config `ALIAS_SUBSET`, trust `SUBSET_ONLY`→닫힌 alias를 검산한다. alias는 정확 `WSL-server`, `UNCONFIRMED`, 허용 key순서/중복0, USER/SYSTEM의 PRESENT 행1..4096, userKind와 user항목 유무 일치를 요구한다. 실제 해당 행 원문을 다시 읽거나 값·경로를 반환하지 않는다. 닫힌 형상이 원문에서 계산됐다는 근거는 검산된 원 생산자·실제 수거에 달려 있다.

반환은 비교용 image/config/trust 지문, 원 wire 지문, 공개 metadata 지문과 제한 alias다. config 지문은 새 `IX01_WINDOWS_FINAL_CONFIG_COMPARISON_V1` 도메인과 AD2254 sourceHash, 고정 USER/SYSTEM 순서·명시 ABSENT·길이/원 SHA/ACL/text 및 alias를 포함한다. trust/공개 metadata 지문도 새 sourceHash에 결박한다. image 지문은 원 exe 바이트 SHA다. metadata 지문은 공개 투영만의 비교값이며 내부 부모/FileId/소유의 독립 증명이 아니다.

이 함수는 원 EXIT0·시간·승인·현재성을 받거나 발급하지 않는다. 호출자가 그 실제 수거를 별도로 확인해야 한다. `UNKNOWN`은 비교 결과를 발급하지 않으며 원 실패의 제한 reason/role/line은 기존 수거 기록으로 보존한다. `COMPARISON_ONLY`도 승인·PROVENANCE·CURRENT·SSH_READY가 아니다. 새 관측 원장/SSH·후속 IPAM으로 자동 승계하지 않는다.

## 5. 검증과 남는 범위

기존 final-readiness 합성 호출이 수거한 원 PS JSON+LF를 재직렬화 없이 신규 소비자에 전달한다. PS 호출 추가 없이 성공·alias/role/source 오염·가짜 권위·상한/UTF8/LF를 확인하고, 구형 판독기의 기존 직접 시험은 그대로 실행한다. 문서 본문은 PowerShell AST로 파싱만 하며 실제 native 포트는 호출하지 않는다.

원 config byte[]는 SYSTEM 결합 직후 및 실패 finally에서 소거된다. 관리형 문자열·OS 내부 캐시의 즉시 소거는 보장하지 않는다. 실제 Windows 8대상/owner/ACL·기본 파일 적용·alias/trust/env·접속·원장 쓰기/원격 관측은 미검증이다. 다음 결정은 이 고정 계획의 신규 실제 한정 읽기 1회뿐이며 이전 소진을 재사용하지 않는다. 롤백은 이번 신규 소비 export/시험 연결/문서로 한정하고 기존 자원은 건드리지 않는다.
