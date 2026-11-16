# FN07 로컬 CLI 설치정보 한정 관측 02

## 결과

단발 식별자 `FN07-LOCAL-CLI-DIAGNOSTIC-20261116-02`, 도구 기록 `770175`. 2026-11-16 UTC 14:08:37 발행 직전, 14:08:52 수거 직후이다. 이 시각은 도구 호출의 외곽 시각이며 자식의 시작·종료 시각은 별도로 측정하지 않았다. 도구가 기록한 부모 명령 경과는 1.8517172초, 종료 코드는 0이다. 터미널 제어 시퀀스를 제외한 감독의 두 출력 행은 아래와 같다.

```text
UNKNOWN|IMAGE|IMAGE_SIZE
SUPERVISOR=NONE|CLEANUP=NONE|CHILD=EXIT_CONFIRMED|EXIT=0|TOTAL=WITHIN
```

고정 코드에서 IMAGE_SIZE는 첫 적격 후보의 이름이 claude.exe일 때 Read-Image가 사전 크기 검사에서 반환하는 분류다. 관측된 크기는 68바이트 미만 또는 268435456바이트 초과다. 실제 크기와 어느 쪽인지는 출력으로 구분할 수 없다. PE 원문 해시, 경로 해시, 전후 재검산, 서명, 최종 물리 신원, SDK child 일치 여부와 실행 권위는 미확인이다. 이미지 본문 읽기 전에 종료했다. 부모와 자식의 정상 종료는 한정 관측의 UNKNOWN 결과를 유지한다.

## 실행 근거

프로젝트 저장소 루트에서 고정 소스 지문을 검산한 뒤 실행했다. 기준 HEAD 및 development/main은 `ab8b2a2ea94dbac2ecaaaf710a64df4ddd2c6332`였다. 발행 전 아래 세 지문 및 이미 소진 기록된 dispatchCount=1을 검산했다.

- 승인 범위 명확화 기록 SHA256 `2C4EE2ED6EB4D866EF7BD400093AD91C3872E2CAD65FCF88EECF7184DDE9D80C`
- 고정 감독 후보 SHA256 `DB9265A3EECADBAE4DC76E8A55EDB7881D6CE195401DFEF89C3509AAFA0102E9`
- 관측 소스 SHA256 `0FD03A3F62C508F1E7343FBD80DC03DED0AFE30251C1D2356450E271F5B28120`

실행 도구는 exec_command, login=false, tty=true, require_escalated, yield_time_ms=10000이었다. 고정 문서에서 추출한 감독 본문을 원 PowerShell 범위에서 호출했다. 원 객체가 미확정인 경우에만 같은 호스트에서 입력을 기다리는 외곽 명령을 사용했다. 정확 명령은 다음과 같다.

```powershell
$ErrorActionPreference='Stop'
$doc='docs/work_packages/FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_CANDIDATE_20261116.md'
$b=[IO.File]::ReadAllBytes((Join-Path $PWD $doc))
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)) -cne 'DB9265A3EECADBAE4DC76E8A55EDB7881D6CE195401DFEF89C3509AAFA0102E9'){throw 'PIN_MISMATCH'}
$m=[regex]::Matches([Text.Encoding]::UTF8.GetString($b),'(?ms)^\x60{3}powershell\r?\n(.*?)^\x60{3}\r?$')
if($m.Count -ne 1){throw 'BLOCK_COUNT'}
function prompt { 'FN07_PRESERVED> ' }
. ([scriptblock]::Create($m[0].Groups[1].Value))
if(Get-Variable Fn07UnconfirmedProcess -Scope Script -ErrorAction SilentlyContinue){$host.EnterNestedPrompt()}
```

## 한도와 종단

고정 관측 자식 1회, 현재 dispatch 1회 소진. PATH 최대 32767자·64항목, literal 최대 192회, 첫 적격 후보 1개, wrapper 본문 0, PE 최대 256MiB·64KiB 버퍼, 수거 4KiB, 27+3초의 원 한도를 적용했다. CLI/SDK/Agent 실행·추가 탐색·DB/권한/키/서비스 변경은 0회다. 감독 자체 실패와 회수 실패가 없으며 미확정 객체 보존 분기에 진입하지 않았다. 추가 수거 세션·잔여 소유 핸들·재발행은 0이다. 원 단발 20670a의 UNKNOWN과 소진 기록을 그대로 보존한다.
