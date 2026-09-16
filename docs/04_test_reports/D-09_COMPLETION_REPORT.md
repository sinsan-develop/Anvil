# D-09 완료보고 — Hook registry 및 비실행 projection

## 1. 판정

`COMPLETED` — developer-primary-d09-r1의 exact6 구현 및 R1 재작업/기본 검증 완료. 최종 증거는 §6이며, §2~5의 초기 증거도 보존한다. Main 독립 검토/ACCEPTED 판정은 별도다. D-10은 시작하지 않았다.

## 2. 판단 이유

- 11개 표준 Event와 Event별 허용 result를 고정했다. command-only Program은 source/dependency/artifact/signature hash와 별도 id/version/content hash를 갖는다.
- Hook 정의에는 Event, 정규화 Matcher, exact Program reference, timeout, read-only filesystem/network deny, fail-open/closed, required idempotency, recursion guard/max-depth 1, scope 및 D-05/D-06 source provenance가 포함된다.
- host-only capture는 exact D-06 HOOK candidate와 최소 2개 독립 observation의 task/run/input/evidence identity를 결박한다. actor/context는 D-03/D-05/D-06 기존 인증 host 경계에서 얻으며 API body의 self-attestation은 받지 않는다.
- create_rule/create_program_and_rule/patch_matcher/upgrade_program/split/merge/quarantine/retire의 before/after shape와 D-06 intent/target을 검증한다. 수정 시 이전 Hook head의 exact version/hash를 다시 검사하며, 기존 version hash 재사용·등록 경쟁을 fail closed한다.
- Matcher는 tool/path/status/agent_id의 exact equality 및 path 전용 bounded glob만 허용한다. regex/eval/unknown operator, path traversal/absolute/UNC/backslash/encoded alias/type drift를 거부한다. exclude가 우선하며 `infra/prod`와 `infra/production`은 구분된다.
- matching 정의를 모두 반환하며 managed는 정렬에만 영향이 있다. `deny > ask > modify > allow`, Stop/SubagentStop block의 deny 의미, 같은/중첩 modify target 충돌 거부를 구현했다.
- timeout/error의 engine fault decision은 program result와 별도다. fail_closed는 deny, fail_open은 allow+warning/log로 투영된다. host-captured fault를 다중 결과와 병합하며 audit와 반환 projection이 일치한다.
- API는 candidate/register/version/query/match/merge/fault-projection의 authenticated in-memory adapter다. capture/trust/execute/activate/shadow/pilot endpoint는 제공하지 않는다. 모든 projection은 canonical JSON에서 분리된 immutable snapshot이며 새 사용 시 source/candidate 생존 상태를 재검사한다.
- 직접 검증 `AV-LRN-019`, `AV-LRN-021`, `AV-LRN-023`, `AV-SAFE-026` 중 D-09의 registry/provenance/matcher/result/fault/recursion/idempotency 계약을 테스트했다. 실제 Hook 실행 및 trust activation을 이 결과로 PASS 승격하지 않는다.

### Main 내부 구현 판단

Main의 명시 지시에 따라 create_rule은 기존 registered program exact id/version/hash를 연결하되 `UNTRUSTED / REVIEW_REQUIRED / executable=False`만 기록한다. 신규·수정 정의 역시 pending registry 계약이다. 실제 trust 검증·shadow/pilot/activation은 D-10 소유이며, API 결과가 실행 허가를 뜻하지 않는다. fault decision은 Event별 program result enum과 분리된 engine projection이다.

## 3. 조치 및 기준선

- 작업 경로: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작/최종 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88` (변경 없음)
- canonical progress: `seq1012`, D-09 `IN_PROGRESS`, Main이 발행한 start control 사용. worker/write ACTIVE 및 토큰을 작업 전 확인하고 2026-09-16 19:48 KST에도 재확인했다.
- worker lease: `worker-lease-d09-r1-20260916-001`
- execution token: `d09-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write lease: `write-lease-d09-r1-20260916-001`
- write token: `d09-r1-write-fence-epoch-1-234458b5283abafa`
- lease interval: `2026-09-16T19:31:00+09:00` 이상, `2026-09-17T07:31:00+09:00` 미만.
- WI SHA256: `FD2BF06528D8C2F8FA6F2FF25A814B26C7B7F2C273D463E89B471078144635E7`
- invocation SHA256: `2C1D6EDB4C30B28C5587DFA2E5618E11DE88F2B2B901BC0305F09141FF5A8EF5`
- Design SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- WorkPlan SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- Matrix SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- TestPlan SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 기존 상태: C-13~C-15/control 등 26개 tracked dirty와 D-01~D-08/control untracked를 보존했다. 시작 시 D-09 신규 파일은 없었고, 기존 untracked knowledge/__init__.py를 이어 수정했다. 최종 exact6는 Git상 모두 untracked다. 기존 타 패키지/통제 파일은 수정하지 않았다.
- 원본 `D:\tmp\anvil-main-integration`의 제품 파일은 변경하지 않았다. 그 위치의 기존 venv Python 실행기만 검증에 사용했다. escalation/Git stage/commit/push/외부 전송 없음.

### 초기 R0 변경 파일과 diff (R1 최종 hash는 §6)

| 경로 | 이번 변경 | 최종 SHA256 (보고서 제외) |
|---|---|---|
| packages/knowledge/__init__.py | 기존 D-01~D-08 export 유지, HookError/HookRegistry import 및 export 2줄 추가 | `8A37C0A641C2AEB8B72F74244ED9D996DE8BBEAAA7796EABFBF34CB1520CD287` |
| packages/knowledge/hooks.py | 신규 540줄, versioned registry/host capture/matcher/result/fault projection | `B364383D2152501EBE2D38D18C0F3DD7C99B5760C0DE21D721CC6F8759559DE0` |
| packages/api/hooks.py | 신규 40줄, host-context API adapter | `BB557E30C3B81E32984CEE08D06D49384C5027CCE7868CEA9F0696AC7FCC99F4` |
| tests/knowledge/test_hooks_d09.py | 신규 376줄, 정상·적대·회귀 및 real in-memory D-03~D-06 연결 | `EC3CAE9DD304B32E9B3987BF1894244025515150993C6A1E9883ECB263DD62CB` |
| tests/api/test_hooks_d09.py | 신규 53줄, API operation/권위 차단/alias/merge/version 검증 | `ACA2035BF84857EEB4BD67057496D427BE6536CDAC361AEE43391B1CB89F1583` |
| docs/04_test_reports/D-09_COMPLETION_REPORT.md | 본 보고서 신규 | self hash 제외 |

## 4. RED → GREEN 및 실행 증거

모든 명령은 위 작업 경로에서 실행했다. Python 3.13.9. 두 디렉터리의 test_hooks_d09.py 동일 basename을 격리하기 위해 `--import-mode=importlib`을 사용했다. repository 설정은 변경하지 않았다.

### 정확한 명령

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hooks_d09.py tests/api/test_hooks_d09.py
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hooks_d09.py tests/api/test_hooks_d09.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
git diff --stat
git branch --show-current
git rev-parse HEAD
```

| 실행 | exit | 실제 결과 |
|---|---:|---|
| 최초 focused RED (첫 명령) | 1 | 86 failed, 1.21s; 의도된 `D09_HOOK_REGISTRY_MISSING` |
| 최초 구현 후 focused (`--tb=short`) | 1 | 72 passed / 14 failed, 1.55s; immutable reference 입력 호환 13건, test host scope fixture 1건 |
| reference/fixture 정리 후 focused | 0 | 86 passed, 1.13s |
| action/version/CAS/fault 확장 RED | 1 | 105 passed / 8 failed, 1.56s; host-captured engine fault 병합 미구현 |
| fault 병합 구현 후 focused | 0 | 113 passed, 1.40s |
| program provenance projection 확장 RED | 1 | 122 passed / 1 failed, 1.57s; version projection의 program origin 누락 |
| 최종 focused | 0 | **123 passed, 1.53s** |
| tests/knowledge tests/api 전체 관련 회귀 | 0 | **1622 passed, 11.07s**, skipped/failed 없음 |
| compileall | 0 | 진단 없음 (`COMPILEALL_EXIT=0`) |
| git diff --check | 0 | 진단 없음 (`DIFF_CHECK_EXIT=0`) |
| branch / HEAD / diff stat | 0 | HEAD/branch 불변, 기존 tracked dirty 26개 보존 |

Untracked 파일은 일반 git diff에 나타나지 않으므로 다음 명령도 실행했다.

```powershell
$d09Paths=@('packages/knowledge/__init__.py','packages/knowledge/hooks.py','packages/api/hooks.py','tests/knowledge/test_hooks_d09.py','tests/api/test_hooks_d09.py')
foreach ($d09Path in $d09Paths) {
  $d09Output=git diff --no-index --check -- NUL $d09Path 2>&1
  $d09Exit=$LASTEXITCODE
  [pscustomobject]@{Path=$d09Path;Exit=$d09Exit;Output=($d09Output -join [Environment]::NewLine)} | ConvertTo-Json -Compress
}
```

5개 모두 exit 1(추가 내용 존재), Output 빈 문자열: whitespace diagnostic 0. 보고서 생성 후 `git diff --no-index --check -- NUL docs/04_test_reports/D-09_COMPLETION_REPORT.md`도 exit 1/진단 없음, 최종 `git diff --check` exit 0을 2026-09-16 19:56 KST에 확인했다.

### 오류 fingerprint/count

- 의도적 test-first 미구현 RED: registry missing 86 → 해결; fault merge 8 → 해결; program provenance projection 1 → 해결.
- 내부 수렴: `INVALID_HOOK_INPUT` immutable reference 호환 13, `SourceHostContext.scope` fixture 1 → 각각 수정하여 해결.
- 현재 제품 테스트 오류 0. 위 RED/내부 수렴을 Main의 정식 실패보고 횟수로 자의 승격하지 않는다.
- Git status는 사용자 전역 ignore 파일 접근에 관한 `Permission denied` warning 2회가 있었으나 repository status 출력/명령은 exit 0. ACL/escalation/설정 우회는 수행하지 않았다.

## 5. 미검증·잔여 위험·rollback

- 실제 command/script/LLM/Agent/Hook 실행, process, filesystem program 읽기, DB/HTTP/browser/network/deployment: **NOT_EXECUTED**.
- program signature/source/build artifact의 실제 파일·암호학적 서명 검증: **NOT_EXECUTED**. registry는 host가 제공한 hash identity만 저장하며 signature_verification 필드로 미검증을 명시한다.
- shadow/pilot/trusted_auto/trust/activation/실제 quarantine 실행: **NOT_EXECUTED**, D-10 소유. 등록/매칭/병합 결과를 실행 권한으로 소비하면 안 된다.
- capture_observations/capture_results는 기존 host-only in-memory 신뢰 경계다. 실제 관찰 수집자/runner 통합: **NOT_INTEGRATED**. API body에서는 발급할 수 없다.
- API 테스트는 in-memory adapter 호출이며 실제 HTTP 인증 middleware·UI·DB 증거가 아니다. knowledge+api 밖 전체 repository 검증은 실행하지 않았다.
- 초기 matcher는 고정 exact field/operator 및 제한 glob만 지원한다. 일반 regex·함수·외부 의존 matcher는 거부한다. unknown payload field 또한 거부하는 보수적 계약이다.
- source revoke는 신규 match/capture/merge/program 연결을 차단하며 과거 registry/version/audit는 읽기 전용으로 유지한다. 실제 진행 Run 제어는 수행하지 않는다.
- rollback은 Main이 exact6 diff를 검토한 뒤 신규 D-09 5개 파일을 복구 가능한 보존 대상으로 옮기고, __init__.py의 D-09 import/export 2줄만 되돌리는 방식이다. 다른 D-01~D-08/C/control dirty는 건드리지 않는다. 본 작업에서는 rollback/delete/Git mutation을 실행하지 않았다.
- progress/HANDOFF/WI/control 갱신: **미수행, Main 소유**. 본 보고서의 COMPLETED는 Main ACCEPTED가 아니다.
- 사용한 TDD 및 verification-before-completion 스킬은 RED 선행·실측 GREEN/회귀 확인 순서에 적용했다. 별도 skill 파일/계획 파일은 생성하지 않았다.

## 6. 독립 리뷰 R1 재작업

### 판정

`COMPLETED` — 3개 finding을 각각 RED로 재현하고 수정했다. 최종 focused **152 PASS**, knowledge+api **1651 PASS**, compileall/diff-check exit 0. 기존 123개 테스트를 제거하지 않고 유지했으며 reviewer 재현/우회 회귀 29개를 추가했다.

### 판단 이유 및 Main의 Event 해석

1. 기존 patch_matcher는 Event 변경을 전부 거부하는 반면 version-only no-op은 허용했다. 이제 정규화 후 Event 또는 matcher include/exclude 중 최소 하나가 실제로 달라야 한다. 프로그램/permission/timeout/failure-policy/기타 정의 delta와 추가 program 계약은 거부한다. 조건 순서만 바꾼 canonical no-op도 `HOOK_ACTION_NO_CHANGE`로 거부한다.
2. Main은 설계에 없는 Event hierarchy를 만들지 말고, **pending/non-executable 후보에서 표준 Event 변경을 허용하되 현재 result contract 수용만 확인**하라고 명시했다. 이에 따라 SessionStart/SubagentStart 등의 임의 상하위 관계는 도입하지 않았다. 현재 schema의 hook-result-v1에는 개별 program result subset이 없으므로 기존 Event가 허용하던 전체 집합을 보수적인 현재 result contract로 취급하여 새 Event matrix에 포함되는지 검사한다. 호환되지 않으면 `HOOK_EVENT_RESULT_CONTRACT_MISMATCH`. Event 빈도/의미 위험 비확장을 증명했다고 주장하지 않으며 사람 검토/trust/activation은 D-10 경계다.
3. recursion depth>=1의 차단도 일반 결과와 같은 event idempotency ledger/immutable receipt에 저장한다. 동일 event_id의 depth/payload 변경은 `HOOK_IDEMPOTENCY_CONFLICT`; 동일 재전달은 동일 차단 hash/result다. 저장된 차단 receipt를 빈 결과 capture→merge로 allow 승격하는 경로도 `HOOK_RECURSION_BLOCKED`로 거부한다.
4. root `**`는 canonical nonempty relative path의 모든 중첩 depth를 매칭한다. path normalization은 그대로 선행하므로 traversal/absolute/encoded/backslash/empty-component 우회를 허용하지 않는다. prefix glob/exclusion 동작은 보존했다.

### 조치 및 수정 범위

- R1 재개 때 WI/prompt SHA256 및 seq1012/dual token을 다시 확인했다. 2026-09-16 20:05~20:10 KST는 기존 lease interval 안이다. branch/HEAD는 §3과 동일하고 Git/control mutation은 없다.
- R1에서는 exact6 중 hooks.py, domain/API tests, 본 보고서 4개만 변경했다. __init__.py와 API 구현은 R0 그대로 보존했다.
- 기존 recursion 정상 테스트는 별도 recursive event_id를 사용하도록 교정했다. 기존 CAS 테스트는 version-only no-op 대신 실제 exclude delta를 사용하도록 교정했다. 테스트 삭제/회피가 아니라 R1의 강화된 계약에 맞춘 positive fixture 정정이다.
- receiving-code-review/TDD 스킬에 따라 재현을 확인한 뒤 구현했고, verification-before-completion으로 최종 회귀/정적검사를 새로 실행했다.

| R1 수정 파일 | 최종 줄 수 | SHA256 |
|---|---:|---|
| packages/knowledge/hooks.py | 558 | `B9CC99BC96DC32E3F6CBBBFD4A734F44D0B2B27B1219BFE985A49ABB04AD954B` |
| tests/knowledge/test_hooks_d09.py | 458 | `AF1B5F7E4D79B1A575DCA4AF0EDF71F620AF37035A5DBC2C87558C228B2AEFD6` |
| tests/api/test_hooks_d09.py | 64 | `20B60A831C760726CF0D0B0458EDD3A48F384337A01813756F71670E2219883C` |
| docs/04_test_reports/D-09_COMPLETION_REPORT.md | 본 R1 증거 추가 | self hash 제외 |

### 정확한 R1 검증 명령·exit·결과

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hooks_d09.py tests/api/test_hooks_d09.py -k r1 --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hooks_d09.py tests/api/test_hooks_d09.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 검증 | exit | 결과 |
|---|---:|---|
| R1 RED | 1 | 17 failed / 12 passed / 123 deselected, 1.37s |
| 최종 focused | 0 | 152 passed, 1.59s |
| knowledge+api 관련 전체 | 0 | 1651 passed, 11.08s, skip/fail 없음 |
| compileall | 0 | 진단 없음 |
| diff-check | 0 | 진단 없음 |

R1 수정 제품/test 3개 각각 `git diff --no-index --check -- NUL <정확한 상대경로>`도 exit 1(추가 내용 존재)/진단 없음이다. 오류 fingerprint는 no-op 및 Event compatibility 8, recursion idempotency/receipt/API 6, nested root glob 3이며 모두 해결했다. 현재 미해결 테스트 오류 0; RED는 의도적 재현으로 별도 보존한다.

### 미검증·rollback·후속

§5의 실제 실행/서명/HTTP/DB/신뢰·활성화 **NOT_EXECUTED**, host collector/runner **NOT_INTEGRATED** 경계는 그대로다. Event 빈도나 의미상 위험 변화는 이번 deterministic registry 검증으로 PASS 승격하지 않는다. rollback은 Main이 R1 수정 4개 diff만 검토하여 R0 hash 기준으로 복구할 수 있으며 여기서는 실행하지 않았다. progress/HANDOFF/control은 미갱신이며 Main 소유다. D-10 시작/실제 Hook 실행은 수행하지 않았다.
