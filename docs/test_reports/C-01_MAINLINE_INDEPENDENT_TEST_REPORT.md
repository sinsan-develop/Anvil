# C-01 독립 Tester 판정 보존

## R4 비의미 정정 — 독립 Tester 판정 불변

WI 항목7 regression 재실행 수의 오기20을 실제18로 정정했다. canonical evidence/아래 원 Tester18 rerun 및 design-derived9 판단·기대값은 변경0이다. Main 전달 Reviewer final SPEC PASS / QUALITY APPROVED C0/I0/M1의 Minor1은 이 문서 정정으로 resolved한다. 새로운 독립 Tester 수행으로 표시하지 않는다.

Main full tooling R3 attempt2 exit0 `697 passed in 1661.64s (0:27:41)`는 R4 정정 이전 exact20/부모 manifest SHA `D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F`의 tooling 검증이다. 현재 epoch4/exact20/cumulative28로 메타데이터를 재결박하며 R4 이후 full suite 재실행을 주장하지 않는다. actual Provider/Telegram/backend swap E2E 등 NOT_EXECUTED는 불변이다. 아래 R3/R2 및 원 실패는 보존 이력이다.

## R3 projection tooling 경계

독립 design-derived9 시나리오·원문 hash·round1 제품실패·fix·round2 PASS는 아래 그대로다. Main full tooling attempt1 `20 failed, 673 passed in 1675.07s`는 별도 projection 도구 검증 실패다. `C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1` count1(19 tests), `C01-GIT-MUTATION-ERA-EXPECTATION-v1` count1(1 test)을 R3 null-aware consumer/current counter32 및 exact-era test 기대 분리로 수정한다. Main status-poll wrapper syntax error1은 non-product다.

현재 projection은 epoch3 exact20/cumulative28이며 history 집계32·OPS-R2 map2를 고정 ledger에서 재계산한다. seq1~700 역사31/map1은 불변이다. 새 독립 Tester run이나 기존9개 test 기대값 변경은 없다. 실제 Provider·Telegram·backend swap E2E/DB/API/browser/WSL/deployment는 NOT_EXECUTED다. 전체 tooling fresh 재실행은 Main의 다음 gate다.

## R2 현재 판정 — 독립 설계 유도 시나리오 PASS

현재 acceptance 근거는 `tests/verification/test_c01_independent_acceptance.py`의 별도 작성 9개 시나리오다. 원문·기대값 SHA-256 `641FB690DDAA138D64522DFC66B0FB178D53FB3EBE22B3301497632A4A15A569`를 round1/2에서 유지했다. 설계·matrix를 먼저 읽고 시나리오를 작성했으며, 작성 전 implementation/Developer tests/completion report/acceptance projection 열람은 각각 0이다. 초안 scenario-only SHA `ACA192C1AF71AFC7462415DBEBDF4E8E7CA832C96B684619002BF0BF2DADD8FA`에서 공개 API 연결만 추가했다.

이전 projection review는 SPEC FAIL / QUALITY CHANGES_REQUIRED / C0/I1/M0였다. fingerprint `C01-ACCEPTANCE-INDEPENDENT-SCENARIO-MISSING-v1`: 아래 보존한 Developer tests 18개 재실행은 회귀 증거이며 독립 설계 기반 acceptance를 입증하지 못한다. 해당 Important finding은 별도 설계 유도 9개 시나리오 작성·실행으로 해소했고 원문은 삭제하지 않는다.

| 단계 | 불변 대상 또는 실행 시점 | 실제 결과 |
|---|---|---|
| 원 Developer tests 재실행 | 최초 product `f56ac2514d0c5bca41768e456ed57f2036ab3137` | 18 passed, regression-only |
| 독립 round1 | 동일 최초 product | exit1, 8 passed / 1 failed / 0 skipped in 0.42s |
| product fix | `66c0e43a092215ea2e9be24606d7a28e10dff359`, sole parent f56ac251 | UNKNOWN 사용량의 cost/tokens를 None으로 보존, 기존 reconciliation 경로 사용; exact2 |
| 독립 round2 | 실행 당시 HEAD=f56ac251 + working fix, 이후 동일 kernel bytes를 불변66c0e43에 결박 | exit0, 9 passed / 0 failed / 0 skipped in 0.28s, 기대값 변경0 |
| fix code review | 동일 fix | SPEC PASS / QUALITY APPROVED / C0/I0/M0 |

round1/2 명령: `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest -p no:cacheprovider tests/verification/test_c01_independent_acceptance.py -q`.

제품 결함 fingerprint는 `C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1`이다. round1 실제값은 CONSUMED, active reservation0, UNKNOWN인데 cost "0"/tokens0으로 처리한 것이었다. round2는 `USAGE_RECONCILIATION_REQUIRED`, active reservation1, provenance unknown, Provider fake call1, Retry-After 전달값23, call 동안 reservation 존재 true다. 예외 반환이므로 StepResult와 그 events는 없으며 raw의 events=[]는 외부 감사 Event 성공을 뜻하지 않는다. fix kernel SHA `6F0918F53543B7F0DBC2479293AAFAA1BF65351693DA3EB153C431E479DF9D32`와 test SHA를 결박한다. 이후 소비자는 기존 예외와 reservation 상태로 불확실성을 처리해야 한다.

AV-AGT-002 PASS는 Claude/Codex/Local fake lifecycle의 L2 opaque contract다. AV-AGT-003는 in-memory 예약·성공·거부·중복·abort·UNKNOWN의 round1 FAIL→round2 PASS다. AV-OPS-011은 fake contract PASS이며 실제 L3 backend swap E2E는 NOT_EXECUTED다. 실제 Provider/network/Telegram/DB/API/browser/WSL/deployment/persistent external Event는 NOT_EXECUTED다.

| 별도 source receipt | SHA-256 |
|---|---|
| `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-acceptance-review-report.md` | 591BAD6EF52CE48C1D285379E4AB08001FEAD4CD40AC38505878FB6FC089D8AE |
| `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-independent-scenario-report.md` | B27E326FD627A9BD35771B9A4219917FD53A0FD0E894FAD0D644C15C2FCDCCD8 |
| `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-unknown-usage-fix-report.md` | 31E90A32F335548BE0471744F2903D37E7E1BCC0B391C75C4A561D15249CDA28 |
| `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-unknown-usage-fix-review-report.md` | 6FA6400006CD21FBC0FAF5EFEEFD8C02AC9A036F2929F976A851556953F84688 |

raw receipt replay는 projection writer가 동일 public API subject를 재현한 별도 기록이며 새 독립 Tester run이 아니다. UUID entropy만 고정해 결정론적 receipt를 만들고 테스트 파일·기대값은 수정하지 않는다.

## R1 역사 기록 — 현재 독립 acceptance 근거로 사용하지 않음

아래 원문 전사·당시 판정은 보존하되, 그 18개 실행은 Developer-test regression rerun으로 재분류한다. 당시 AV PASS와 finding0 표현은 독립 시나리오 round1 failure 및 현재 R2 판정을 대체하지 않는다.

## 판정

`PASS (LOCAL_FIXTURE_CONTRACT_SCOPE)`

이는 별도 독립 Tester가 수행한 결과의 canonical 전사본이다. acceptance projection writer가 독립 Tester 역할을 수행한 것이 아니다.

## 대상과 원문 결박

- BASE: `e215c0612363050dbe20315646f1612f31b8cdc0`
- branch: `codex/c01-mainline-reconciliation`
- 검증된 staged exact9가 고정된 product commit: `f56ac2514d0c5bca41768e456ed57f2036ab3137`
- product WI: `C-01_WORK_INSTRUCTION`, `docs/work_orders/C-01_WORK_INSTRUCTION.md`
- WI SHA-256: `F99FE2D6C009E7B897130DD3802460258F5CF406BE973DA0939D49DAA5E367A5`
- 원문: `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-independent-test-report.md`
- 원문 SHA-256: `EA461AD96A247A477FD096DB22B96E0713B8D7C2782DFFD2B4A6779539310973`

## 독립 실행 증거

| 명령/검사 | 실제 결과 |
|---|---|
| `.venv\Scripts\python.exe -m pytest tests\llm_gateway tests\orchestration\test_c01_native_agent_adapter.py tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider` | exit 0, 18 passed in 0.80s, failed 0, skipped 0 |
| `.venv\Scripts\python.exe -m compileall -q packages\llm_gateway packages\orchestration` | exit 0, 출력 없음 |
| `git diff --cached --check` | exit 0 |
| staged/cached paths, unstaged, untracked | exact9 / 0 / 0 |

Git global ignore 경로 접근 경고는 제품 failure가 아니며 별도 Git 경로 열거를 확인했다.

## AV별 판단 이유

| ID | 판정과 범위 | 증거 |
|---|---|---|
| AV-AGT-002 | PASS — deterministic Claude/Codex/Local fake contract | 별도 lifecycle Protocol의 7개 method, opaque packet/result, task_graph/permission/evidence/resume reference 동일성 |
| AV-AGT-003 | PASS — in-memory budget | reserve 이전 Provider 송신 0, 예약 거부 시 adapter call 0, 같은 Step 재호출 시 추가 call 0, 성공·abort의 BUDGET_RESERVED → USAGE_RECONCILED |
| AV-OPS-011 | PASS — deterministic fake contract only | 3 fake backend의 계약 동일성 및 기존 NativeAgentAdapter.probe/generate C-21 호환 |

Critical 0 / Important 0 / Minor 0. Decimal 비용은 문자열이며 예산 evidence에 prompt/Secret이 없다.

## 미검증과 조치

actual Claude/Codex/Local backend runtime, Provider, network, Telegram, DB, API, browser, WSL, deployment, 외부 영속 Event, C Gate, Release, 사용자 인수는 `NOT_EXECUTED`다. 다음 조치는 Main이 동일 product target과 evidence를 결박하여 C-01 local fixture scope의 acceptance를 판정하는 것이다.

코드 리뷰는 별도 세션이며 test를 재실행하지 않았다. 그 SPEC PASS / QUALITY APPROVED 판정은 `C-01_MAINLINE_ACCEPTANCE_RESULT.md`에 구분해 기록한다.
