# E-01 완료보고 — Reviewer·Tester 역할 계약

## 1. 판정

- 결과 계약: `COMPLETED` — Developer 구현·기본 검증 완료. **최종 ACCEPT 아님**.
- 담당: `developer-primary-e01-r1`; 작성일 2026-09-17.
- R2 mutation capability 추가 보완 후 제품 focused **76 passed**, 관련 `tests/agent_team tests/orchestration` **713 passed**. failure/skip 0.
- 시작 control 단독 **3 passed / 605 deselected**, D Gate 관련 4개 class **12 passed / 596 deselected**, broad E01 **5 passed / 603 deselected**. canonical checker **PASS sequence=1066**.
- 독립 검토에 따른 정식 REWORK count **1**. 아래 초기 구현 수치는 역사 기록이며 최신 판정 근거는 R2 재검증 절이다.
- compileall 및 git diff --check exit 0. 제품 exact6 + control exact9만 변경.
- 테스트계획 §10.6에 따라 최종 수락은 사람 또는 구현과 분리된 외부 독립 세션이 수행해야 한다. 이번 테스트는 새 Tester가 자신을 수락한 것이 아니라 Developer의 계약 단위·관련 회귀 증거다.

## 2. 판단 이유

### 기준선과 권위

- 작업 루트: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작 branch: `codex/c09-execution-backends-r1`; 시작 HEAD/upstream: `b820867f95d2941e378e5b78e3f31f67ace081b8`; 시작 status clean.
- 작업 중 HEAD 불변. remote 일치는 Main 전달 증거이며 이번 worker는 원격 조회하지 않았다.
- 시작 seq1062 / D Gate ACCEPTED에서 시작 Event 4개만 append하여 seq1066. seq1~1062 raw prefix와 historical evidence는 committed baseline에서 재구성·비교한다.
- WI: `docs/work_orders/E-01_WORK_INSTRUCTION.md`, SHA256 `04B1E6047D4B10BA459D8886C5EC9CC0EFCE2E595BB923726A3927A9073570C2`.
- prompt SHA256 `321897F0829C2FF2C0606DA94D0E13D8BB3CAE3AD022EC1B1AE0FE0BA2BC4289`.
- 설계 hash `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- 계획 hash `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- 매트릭스 hash `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- 테스트계획 hash `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.
- 직접 요구: 설계 §8.1/8.2/39.2/46.16-6/48.9/49.1, 계획 E-01, AV-AGT-030/AV-SAFE-022.

### dual lease와 통제

- worker `worker-lease-e01-r1-20260917-001`, execution fence `e01-r1-execution-fence-epoch-1-b820867f95d2941e`.
- write `write-lease-e01-r1-20260917-001`, write fence `e01-r1-write-fence-epoch-1-378e5b78e3f31f67`.
- issued `2026-09-17T08:33:00+09:00`, expires `2026-09-17T20:33:00+09:00`; 제품 mutation 전 canonical checker PASS로 확인했다.
- 작성 시 두 lease는 ACTIVE이며 제품 path_scope는 exact6. 완료/회수/독립 합격 Event는 작성하지 않았다.
- seq1063 WORK_INSTRUCTION_ISSUED → 1064 WORKER_LEASE_ISSUED → 1065 WRITE_LEASE_ISSUED → 1066 PACKAGE_STARTED.
- E-01 IN_PROGRESS / E-02 NOT_READY / pending approvals empty. D Gate ACCEPTED 및 전체 tooling INCOMPLETE/NOT_PASS 역사 기록 유지.
- checker는 base HEAD의 control exact9 + 제품 exact6 부분집합, 또는 exact9 시작 커밋이 sole direct child인 경우 제품 부분집합만 허용한다. 이번에는 커밋하지 않았다.

### 변경 파일과 diff 요약

제품 exact6:

1. `packages/agent_team/__init__.py`: 신규 역할 계약의 additive export. 기존 API/exports 보존.
2. `packages/agent_team/role_contracts.py`: immutable AgentDefinition/BudgetLimits/RoleAssignment/TestWriteGrant/TestWriteLease, host-only current authority, parent narrowing 재사용, deterministic action receipt와 역할별 예산·멱등 guard.
3. `packages/agent_team/role_results.py`: Reviewer finding / Tester command·expected·observed evidence, host capture registry와 canonical checksum, 역할별 결과 검증. 수락·Step/Release/Apply 전이 없음.
4. `tests/agent_team/test_role_contracts_e01.py`: scope/권한/독립 context/lease/fence/budget/변조 적대 계약.
5. `tests/agent_team/test_role_results_e01.py`: 독립 evidence/역할 schema/명령·hash 결박/미실행 PASS 승격/재전달 적대 계약.
6. 이 완료보고.

control exact9:

- `docs/work_orders/E-01_WORK_INSTRUCTION.md`
- `docs/work_orders/E-01_INVOCATION_PROMPT.md`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/BUILD_HANDOFF.md`
- `docs/progress/progress-handoff-detached-digest-e01-start.json`
- `docs/evidence/manifests/E-01_START_MANIFEST.json`

### 계약별 증거

- AV-AGT-030: 역할별 scope/ceiling/budget/schema와 독립 actor/context/workspace를 등록 시 결박한다. 구현 context의 ID만 바꾸고 content hash를 재사용하는 경우도 거부한다.
- AV-SAFE-022: 기존 `validate_packet`으로 child path/action/tool/backend/egress 확대와 parent denial/protection 완화를 거부한다. 기존 snapshot/packet/result schema와 TeamOrchestrator는 수정하지 않았다.
- Reviewer는 read tool의 exact action shape만 허용한다. Tester의 test-write는 별도 host current lease와 grant, actor/workspace/scope, execution/write fence 및 half-open validity가 모두 필요하다. revoked lease는 기존 grant나 idempotent request로 되살릴 수 없다.
- 테스트 실행 허용은 `test_run`/`execute`와 테스트 범위에 대한 정책 결정뿐이다. shell command 실행기를 제공하지 않는다.
- 결과 evidence는 host registry가 보유한 assignment/actor/context/target/raw checksum/시각에 결박한다. developer report 재인용, 미등록 evidence, forced mutation, command 대체, future capture, replay conflict를 거부한다.
- Reviewer findings는 requirement/severity/path/evidence/observation 구조를 가지며 Tester schema와 교차 사용하지 못한다.
- 모든 반환 snapshot은 내부 저장 state와 분리한다. 허용/거부 receipt는 immutable hash와 IO0을 가진다. 허용 receipt도 실제 Tool 실행이 아니다.
- SKIPPED/BLOCKED/mock/fixture/static/build는 실제 검증 PASS로 승격되지 않는다. 결과는 `VALIDATED_PROPOSAL`일 뿐 `accepted=False`, `state_transitions=()`다.

## 3. 조치·검증 기록

모든 명령 cwd는 위 작업 루트다. 아래 `PY`는 실제 실행 파일 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`를 뜻한다. PowerShell에서 `&`로 호출했다.

### TDD와 오류 fingerprint

| 단계 | 실제 결과 | exit | 원인/조치 |
|---|---|---:|---|
| control RED | 2 failed, 605 deselected | 1 | E01 start generator/git guard 없음 → 구현 |
| control 초기 GREEN | 2 passed, 605 deselected | 0 | exact9/dual lease/raw prefix 검증 |
| canonical 초기 검사 | EVENT_PAYLOAD_MISSING 1건 | 1 | 새 WORK_INSTRUCTION_ISSUED의 product_write_scope 누락 → 기존 Event 계약에 맞게 보완 |
| 제품 진입점 RED | 2 failed | 1 | 두 신규 module 없음 → stub 뒤 행동 테스트 작성 |
| 권한 RED | 28 failed, 1 passed | 1 | BudgetLimits/role service 미구현 → 최소 구현 |
| 권한 초기 GREEN 진행 | 28 passed, 1 failed | 1 | workspace 독립성 거부 코드 검사 순서 → 독립성 우선 검사 |
| 결과 RED | 16 failed, 1 passed | 1 | RoleResultService 미구현 → 구현 |
| 테스트 수집 내부 보정 | import 오류 2종, 각 1회 | 1 | helper import 경로, ResultStatus 실제 owner import 수정; 제품 실패로 계상하지 않음 |
| 결과 초기 보정 | 45 passed, 1 failed | 1 | forged unknown evidence에 기존 ref를 붙인 fixture → unknown ref도 함께 결박해 실제 미등록 경로 검증 |
| 독립 context/current lease RED | 46 passed, 2 failed | 1 | 별도 host authority seam 추가 후 GREEN |
| malformed 경계 RED | 58 passed, 3 failed | 1 | opaque usage/forced envelope 예외 2종과 test helper dict 접근 1종 → fail-closed/fixture 보정 |
| Reviewer finding RED | 2 failed, 21 deselected | 1 | role-specific structured finding 미구현 → 구현 |
| 최종 focused | 63 passed, 0 failed/skip | 0 | 0.96s |

위는 초기 구현의 의도된 RED와 내부 보완 이력이다. 초기 제출 시 정식 FAILURE_REPORT count 0이었으며, 이후 독립 검토 REWORK count 1과 해소 증거는 아래 R2 절에 기록한다. 동일 유효 실패 3회에 해당하지 않는다.

### 초기 제출의 정확한 명령과 결과

```text
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py --tb=short
exit 0: 63 passed in 0.96s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team tests/orchestration --tb=short
exit 0: 700 passed in 3.24s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k 'E01StartControlTests or DGatePostcommitControlTests' --tb=short
exit 0: 6 passed, 601 deselected in 33.95s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py .
exit 0: G-05 project progress contract: PASS sequence=1066 reporting=AUTO_CONTINUE

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/role_contracts.py packages/agent_team/role_results.py tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py scripts/check_project_progress.py tests/tooling/test_project_progress.py
exit 0

git diff --check
exit 0
```

회귀는 기존 C-02/C-05 및 Agent Team/Orchestration의 현재 테스트를 포함한다. 전체 제품/전체 tooling 회귀를 새로 실행했다고 주장하지 않는다. Git의 사용자 ignore 파일 Permission denied warning은 read-only 환경 경계이며 repo 상태·검증 exit와 분리한다.

### R2 독립 검토 재작업 — 2026-09-17 09:10 KST

판정: `COMPLETED` — 요청된 수정과 Developer 재검증 완료. 독립 최종 수락은 Main 소유다.

판단 이유 / failure lineage:

- `E01-CONTROL-HISTORICAL-PROJECTION-001`: seq1066에서 과거 seq1060/1061 테스트가 현재 next_work_package를 읽어 2건 실패. successor-state 강제 재현 RED 1건을 추가하고, historical manifest와 해당 sequence Event의 고정 next-work-package 증거를 읽도록 변경했다. seq1~1062 raw prefix와 기존 evidence는 수정하지 않았다.
- `E01-RESULT-EFFECTIVE-SCOPE-001`: definition/grant보다 좁은 canonical packet 범위를 결과 changed_paths에서 누락했다. 현재 assignment의 effective allowed/prohibited/protected scope를 다시 검사해 `PATH_SCOPE_DENIED` 또는 `PROTECTED_SCOPE`로 거부한다.
- `E01-WINDOWS-PATH-IDENTITY-001`: Windows case alias가 scope overlap과 lease conflict를 우회했다. `_covers`의 비교 identity만 casefold해 within/overlap/lease conflict 모두 적용한다. 원본 path 표현과 hash 입력은 유지한다.
- malformed assignment_id=[]는 dict lookup 전에 strict text를 검사하여 `ASSIGNMENT_INVALID` structured denial/IO0을 반환한다.
- 위 추가 Important 2건과 Minor 1건은 Main 지시에 따라 같은 R1 독립검증 REWORK의 R2 보완으로 묶으며 **정식 count는 1**이다. 새 정식 실패 회차를 만들지 않았다.

RED 증거:

```text
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E01 --tb=short
exit 1: 2 failed, 2 passed, 603 deselected in 4.51s (수정 전)

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k historical_gate_assertions --tb=short
exit 1: 1 failed, 607 deselected in 1.68s (추가 successor-state 재현)

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py -k 'effective_packet or unhashable_assignment or windows_case' --tb=short
exit 1: 6 failed, 63 deselected in 1.15s
```

조치: product exact6 안의 두 module·두 test·보고서 및 승인된 control test만 보완했다. control test checksum 변경은 canonical start generator로 E-01_START_MANIFEST에 재결박했다. 기존 progress/Event/HANDOFF 시작 projection과 seq1066, dual lease/fence를 유지하며 완료 Event를 추가하지 않았다.

최신 실제 재검증:

```text
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py
exit 0: 69 passed in 0.94s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration --tb=short
exit 0: 706 passed in 4.73s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E01StartControlTests --tb=short
exit 0: 3 passed, 605 deselected in 2.99s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k 'DGateControlTests or DGateRegressionReconciliationControlTests or DGatePostcommitControlTests or E01StartControlTests' --tb=short
exit 0: 12 passed, 596 deselected in 14.97s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E01 --tb=short
exit 0: 5 passed, 603 deselected in 3.08s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py .
exit 0: G-05 project progress contract: PASS sequence=1066 reporting=AUTO_CONTINUE

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/role_contracts.py packages/agent_team/role_results.py tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py scripts/check_project_progress.py tests/tooling/test_project_progress.py
exit 0

git diff --check
exit 0
```

09:10 KST 현재 HEAD는 b820867f95d2941e378e5b78e3f31f67ace081b8이며 lease expiry 20:33 KST 이전이다. 상태는 기존 제품 exact6 + control exact9 dirty로 한정된다. 수정된 사례는 계약 단위 검증이며 실제 Windows filesystem alias/worker 실행을 수행한 증거가 아니다. E-02, Git mutation, 외부 I/O는 수행하지 않았다. rollback과 미검증 경계는 아래 초기 계약 그대로다.

### R2 동일 finding 추가 보완 — mutation capability

판정: `COMPLETED` — `E01-RESULT-EFFECTIVE-SCOPE-001`의 미완 해소를 보완했다. 정식 REWORK count **1 유지**. 앞 절 69/706은 중간 검증이고 아래 76/713이 최신 결과다.

판단 이유: 유효 grant/lease와 경로만으로 mutation capability를 대신할 수 없다. effective packet이 read-only이거나 action/tool 중 하나만 허용하거나 write/test_patch 등 교차 조합이면 changed_paths 결과를 `ROLE_ACTION_DENIED`로 거부해야 한다.

조치: canonical effective permission에 `write + test_write` 또는 `patch + test_patch` 쌍 중 하나를 요구하는 순수 검사를 추가했다. authorize_action 호출이나 action dispatch를 하지 않으며 budget/spent, action audit receipt, request idempotency registry를 변경하지 않는다. 5개 거부 변형과 write-only/patch-only 정상 2개, 동일 재전달 및 해당 정책 state 불변을 검증했다. 수정 파일은 `role_results.py`, `test_role_results_e01.py`, 이 보고서 3개이며 기존 exact15를 유지했다. control projection/lease/HEAD는 변경하지 않았다.

```text
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_role_results_e01.py -k exact_effective_mutation --tb=short
RED exit 1: 5 failed, 2 passed, 25 deselected in 0.80s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py --tb=short
GREEN exit 0: 76 passed in 1.39s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration --tb=short
exit 0: 713 passed in 5.37s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k 'DGateControlTests or DGateRegressionReconciliationControlTests or DGatePostcommitControlTests or E01StartControlTests' --tb=short
exit 0: 12 passed, 596 deselected in 16.20s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E01 --tb=short
exit 0: 5 passed, 603 deselected in 3.44s

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py .
exit 0: G-05 project progress contract: PASS sequence=1066 reporting=AUTO_CONTINUE

& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/role_contracts.py packages/agent_team/role_results.py tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py scripts/check_project_progress.py tests/tooling/test_project_progress.py
exit 0

git diff --check
exit 0
```

미검증/rollback 경계는 아래와 같고, 이번 보완을 실제 외부 실행이나 Main 최종 수락으로 승격하지 않는다.

### 미검증·잔여 위험

- host-only in-memory adapter의 신뢰 경계다. 실제 인증/worker sandbox/OS 권한, filesystem alias 실해석, Provider/network/DB/HTTP/UI, handoff/DAG/parallel은 `NOT_EXECUTED / NOT_INTEGRATED`다.
- `capture_evidence`는 host가 이미 관찰한 evidence를 기록하는 seam이다. 실제 명령을 실행하지 않으며 fixture로 생성한 real-mode 레코드는 binding guard 시험 입력이지 실제 runtime 검증 증거가 아니다.
- budget cost는 정수 accounting unit이다. Provider 실제 비용·예약·정산은 구현하지 않았다.
- lease registry·assignment·evidence·idempotency는 프로세스 메모리다. 영속 restart 복구나 다중 프로세스 경쟁을 PASS로 주장하지 않는다.
- 별도 독립 Reviewer/Tester 검증과 Main 결과 수락이 남았다. E-02 이후는 시작하지 않았다.

### rollback / 인계

이번 Git mutation은 0이다. Main은 기준 b820867에서 제품 exact6/control exact9 diff를 검토해 이 작업에서 생성한 신규 파일과 수정 delta만 선택적으로 복구할 수 있다. 광역 reset/clean/stash, 과거 event/hash 재작성은 하지 않는다. 이미 append된 시작 Event의 공식 중단이 필요하면 Main이 취소·lease 회수를 append한다.

progress/HANDOFF는 Main 위임으로 시작 seq1066까지만 갱신했다. 완료 acceptance/lease revoke/commit/push는 Main 소유이며 수행하지 않았다.
