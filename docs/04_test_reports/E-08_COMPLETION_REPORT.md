# E-08 R1 완료보고 — 원자 예약·capability routing

## 판정

**COMPLETED (Developer 구현·로컬 계약 증거; 독립 acceptance 전)**.

- 독립검토 REWORK R3 보완 후 focused **143 PASS**, 관련 **346 PASS / 4 SKIP**, 구문5파일/diff/canonical checker **exit0**. 앞선 구현/R1/R2 수치는 이력이며 최신 증거는 맨 아래 R3 절이다.
- 독립 review rework round **3**; formal FAILURE_REPORT **0** (`formal_failure_count=0`). Subagent 결과는 매회 COMPLETED였으며 유효 FAILURE_REPORT는 없었다. R3는 provider quota/hard-limit publication rollback fail-open 보완이다. 내부 RED/도구 오류도 formal failure로 세지 않는다. Main 재판정 전이다.
- 실제 DB durable send-once, Provider/network, API/UI/운영 통합은 미실행·미통합이다. 로컬 in-memory 증거를 DB 원자 송신/외부 비용/운영 PASS로 승격하지 않는다.

## 판단 이유

### 기준선·권위·권한

- canonical cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch `codex/c09-execution-backends-r1`, base/dispatch HEAD `03878181590d13231fee3a47f7d43963d6a089c8` 일치. 시작 status는 Main control exact9 dirty, 제품 변경0이었다.
- canonical sequence **1142**, E07 ACCEPTED/E08 IN_PROGRESS/E09 NOT_READY. 현재 checker `PASS sequence=1142 reporting=AUTO_CONTINUE`.
- WI `WI-E-08-R1-20260917-001`, SHA256 `83CCB950656482E60E45A164EFDF1CF4A227266CB78B554F7409CFB4D0A2E2C7`.
- invocation SHA256 `85BDA0FCC4A41FFF0716580207827209686A14EBC5B4AB7462B06354CD30C5BD`.
- 설계 §27.2/27.4/47.8~47.9/49.6, 계획 E08, 테스트계획 §10.6. canonical design SHA `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- 검증 ID 전량: AV-STAT-024/025/028/036, AV-OPS-012/019, AV-AGT-038, AV-FLOW-009. 아래 매핑은 **실행한 로컬 계약 레벨만** 의미한다.
- worker `worker-lease-e08-r1-20260917-001`; execution fence `e08-r1-execution-fence-epoch-1-03878181590d1323`.
- write `write-lease-e08-r1-20260917-001`; write fence `e08-r1-write-fence-epoch-1-1fee3a47f7d43963`.
- 발효 `2026-09-17T21:23:20+09:00`, 만료 `2026-09-18T09:23:20+09:00`; mutation 전 현재 시각 `21:29:39+09:00`와 ACTIVE/exact6 확인. lease/통제 회수·수정0.

### 구현 판단과 owner 재사용

- Main 승인 최소 in-memory host seam. B10 `InMemoryInterventionBudgetRepository.reserve/reconcile`가 budget/cost/token/concurrency 원장을 계속 소유한다. DB migration/schema/기존 persistence adapter 파일 변경0.
- `BudgetService` 내부 repository-keyed shared admission ledger/lock으로 여러 service 인스턴스의 request/reservation identity를 공유한다. exact replay는 재송신하지 않으며 진행 중 duplicate는 RESERVED/SEND_STARTED를 정직하게 반환한다. ID 변경 재사용은 거부한다.
- 순서: immutable forecast → B10 atomic reserve → (옵션) lock 밖 pre-send guard → 예약 정본 재검사 → lock 밖 sender → host final usage → B10 consume actual/release proven remainder. 예약 거절은 sender0, PAUSED_QUOTA와 checkpoint/incomplete Step/reset/next action을 receipt에 보존한다. 자동 재개0.
- 기존 `reserve_and_send` 시그니처/예약 반환 형태를 유지하되 같은 shared send-once 경계를 사용한다. provider ref만 있는 기존 응답을 확정 비용으로 간주하지 않으며 exposure를 유지한다.
- 송신 전 abort는 예약·sender0. guard 실패/예약 drift는 BLOCKED_BEFORE_SEND와 sender0, 보수적으로 기존 예약 노출 유지. 송신 진입 후 예외/abort/client disconnect/unknown/부분 usage는 RECONCILIATION_REQUIRED 및 최대 예약 exposure 유지. sender 예외 원문은 반환하지 않는다.
- 확정 final usage만 actual consume/remainder release. request/abort/retry-after/rate bucket/provenance/failure code를 반환값에 보존한다. final replay는 멱등, 다른 final은 거부. Provider quota는 사용량 불확실성을 없애지 않고 PAUSED_QUOTA로 표시한다.
- D11 `ModelRegistry.run_guard/query` **공개 owner API만** 소비한다. PINNED selection/hash, activation/hash, approval hash, model revision/pricing/hash, run/context/role을 결박한다. D11 private state 접근·새 registry authority 발급0.
- D11 공개 activation은 approval hash를 제공하지만 capture expiry는 공개하지 않는다. expiry는 Main 승인대로 인증된 host control-plane이 pin에 제공하는 **HOST_AUTHENTICATED_WINDOW_FIXTURE_ONLY** seam이다. half-open UTC window와 같은 run의 expiry 연장 rebind를 거부한다. durable approval source 연결은 **NOT_INTEGRATED**, API self-approval 기능은 없다.
- input/output 상한 × tool-loop 수와 D11 immutable model 가격으로 최대 token/cost를 산출한다. context/capability/tool/privacy/training/retention/ZDR/가격/currency 조건을 검사한다. 비유한 Decimal/잘못된 forecast를 거부한다.
- fallback은 실제 이전 adapter outcome의 승인 trigger(TIMEOUT/RATE_LIMIT/TEMPORARY_5XX), 같은 pinned run/role/step/input 계약, D11 승인 target 순서와 동등성에 한정한다. 더 비싸거나 privacy/capability/승인 drift·quota·unknown이면 추가 전송0. 무승인 자동 route 확대0.
- returned pin/request/reservation/usage records는 immutable detached snapshot. 실패 원자성: 전송 전 예약/publication 실패는 owner 원장 복원; final publication 실패는 consume/release를 복원하여 예약 exposure를 남기고 retry 정산 가능. 실제 외부 송신 이후 side effect를 rollback했다고 주장하지 않는다.

| Validation | 실행한 로컬 증거 | 외부 미검증 |
|---|---|---|
| AV-STAT-024/025, AV-FLOW-009 | hard limit/provider quota→PAUSED_QUOTA/checkpoint/next action, 실패·무승인 fallback 승격0 | DB checkpoint/운영 Run 전이 |
| AV-STAT-028, AV-OPS-012 | approval expiry, D11 drift, 승인된 동등 fallback/비싼 fallback 거부 | 실제 Provider capability/승인 저장소 |
| AV-STAT-036 | abort-before-send0, after-send exposure, 100-way duplicate send-once | 프로세스 crash/durable restart |
| AV-AGT-038 | 100-way hard-limit 경합, 예약 성공3/송신3/거절97, 실제 B10 in-memory owner | PostgreSQL 원자 송신 integration |
| AV-OPS-019 | abort/disconnect→unknown 유지→authoritative final usage consume/release | upstream abort/실제 invoice |

## 조치

### 최초 구현 변경 exact6 / diff (R1 최신 delta는 하단)

1. `packages/budget/__init__.py`: +11/-2, additive lazy router/value exports. 기존 네 symbol 유지.
2. `packages/budget/models.py`: +31/-1, finite Decimal guard, ProviderOutcome/BudgetDispatch immutable 값.
3. `packages/budget/service.py`: +202/-5, shared admission/send-once, guard/abort/quota/final reconciliation 및 기존 진입점 연결.
4. `packages/budget/routing.py`: 신규239행, D11 public selection/activation 소비와 forecast/admission/fallback.
5. `tests/budget/test_budget_routing_e08.py`: 신규430행, focused51.
6. `docs/04_test_reports/E-08_COMPLETION_REPORT.md`: 본 보고서.

최종 dirty 예상 exact15 = Main control9 + 제품6, staged0. `git diff`에는 untracked 신규 파일이 별도로 표시되므로 status와 함께 확인했다. Main control9/build-progress/events/HANDOFF/WI/prompt/checker/tooling/start manifest/digest는 Developer write0. stage/commit/push0, 추가 agent0.

최초 구현 제품 SHA256(아래 R1 해시로 superseded, 보고서 self-hash 제외):

- init `354DAB2109497DD46081186F039E4CD1A5103F69B04A0B723522657F0E760AFF`
- models `AE38BE4852D17196B790FEC02606F08C2638E547D3228429A84C1FC8BEAB1E68`
- service `85B29261B716222FE8873778D2E6BAB2557C73FA7678D1326EE72A50F22089C2`
- routing `B526DA080F5071CC1B3B741662038A61EE090E5FA1D38CCF69B8588687BD130E`
- tests `01700BDD5CEE540B04FDA84F9E23272B3A7069B82CD2DFEC355FF9B3AB58A1A2`

### TDD RED→GREEN

모든 focused 실행의 정확한 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py --tb=short
```

1. RED exit1 **3 failed / 0 passed, 0.32s**, ProviderOutcome/dispatch 없음 → GREEN exit0 **3 passed, 0.25s**.
2. routing RED exit1 **10 failed / 4 passed, 0.75s**, routing module 없음 → GREEN exit0 **14 passed, 0.99s**.
3. 보강 첫 실행 exit1 **8 failed / 27 passed, 1.14s**. 그중1건은 patch anchor로 assertion 꼬리가 다른 테스트에 들어간 `NameError results` 테스트 편집 오류이며 바로 테스트만 수정했다. formal failure0. 유효 RED 재실행 exit1 **7 failed / 28 passed, 1.22s**: nonfinite money3, legacy duplicate1, pre-send guard2, quota projection1.
4. 위 GREEN + B10 기존 회귀 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py tests/budget/test_atomic_reservation.py tests/budget/test_quota_reconcile.py --tb=short
```

exit0 **45 passed / 4 skipped, 1.21s**.

5. 추가 RED exit1 **5 failed / 46 passed, 1.65s**: exports1/custom string callback4 → GREEN exit0 **51 passed, 1.52s**. 값 검증 전에 custom string callback을 실행하지 않도록 차단했다.

### 관련 회귀·검사

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget tests/llm_gateway tests/tool_gateway tests/knowledge/test_model_registry_d11.py tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e08-r1-related-20260917 --tb=short -rs
```

exit0 **254 passed / 4 skipped, 76.71s**. SKIP4: `tests/budget/test_atomic_reservation.py` lines106/155/218/265, isolated PostgreSQL 18 DSN not configured. 실행 전 ANVIL_B10_PG18_DSN 존재 여부 False만 확인했으며 secret 원문 조회0.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/budget/__init__.py','packages/budget/models.py','packages/budget/service.py','packages/budget/routing.py','tests/budget/test_budget_routing_e08.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE_PASS',len(paths))"
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
git diff --check
git diff --cached --name-only
```

구문 exit0 `COMPILE_PASS 5`(pyc write 없이 builtin compile), checker exit0 `PASS sequence=1142 reporting=AUTO_CONTINUE`, diff exit0, staged 출력0. Git global-ignore 읽기 permission warning은 sandbox 환경 경계로 분리했고 명령은 성공했다.

관련 회귀 basetemp는 생성 전 부재를 확인하고 이름/수명/정리를 고지했다. 종료 후 정확한 `D:\Project\Anvil\.codex-sandbox\e08-r1-related-20260917` absolute target/Directory/non-ReparsePoint를 확인하여 이 테스트 임시 디렉터리만 Remove-Item -LiteralPath -Recurse -Force로 삭제했다(exit0, Test-Path False). 삭제 대상은 생성한 시험자료뿐이며 사용자 파일 삭제0/임시 잔류0; 임시 fixture는 테스트 재실행으로 재생성 가능하다.

### 미검증·잔여 위험·rollback

- DB durable send-once/다중 process/multi-host admission, 실제 PostgreSQL atomic routing transaction은 **NOT_INTEGRATED/NOT_EXECUTED**. 기존 B10 SQL schema/adapter는 수정하지 않았다. 기존 PostgreSQL18 skip4는 PASS가 아니다.
- D11 authority/benchmark/probe/approval·host sender는 실제 owner를 사용한 **HOST_FIXTURE** 증거다. Provider/network/credential/실제 quota/invoice/upstream abort 검증0.
- approval expiry source는 **HOST_AUTHENTICATED_WINDOW_FIXTURE_ONLY**, durable authenticated source adapter는 **NOT_INTEGRATED**. 아무 API가 이 host pin/usage authority를 발급하지 않는다.
- API/UI·E09 Gate·배포·Main acceptance·운영 Run orchestration 전이 구현0. checkpoint는 in-memory receipt의 reference이며 durable checkpoint 저장으로 주장하지 않는다.
- sender 시작 후 상태 publication 장애는 예약을 유지하여 정산을 요구한다. OS crash/restart durable recovery·정확히 한 번의 실제 외부 side effect를 보장했다고 주장하지 않는다. 임의 host callback 무한실행 timeout은 이 contract 밖이다.
- rollback: Main이 product exact6 diff를 검토하여 신규 router/test/report만 회수하고 기존 init/models/service delta만 역패치한다. 기존 B10 원장/SQL·D11 owner·control9를 보존한다. 실제 rollback/Git mutation은 하지 않았다.
- 승인된 WI 실행에 executing-plans/brainstorming/TDD/검증-before-completion 원칙을 사용했다. Main의 명시 범위에 따라 추가 spec 문서·새 agent·Git 작업을 만들지 않았다.
- progress/HANDOFF는 Main 소유로 **미갱신**. 다음: Main 독립 검토/테스트. 본 Developer 완료가 acceptance 또는 E09 시작을 뜻하지 않는다.

## 독립검토 REWORK R1 — 2026-09-17 최신 증거

### 판정

**COMPLETED — Developer 보완 완료, 독립 재판정 대기.** 독립 review rework round **1**; formal FAILURE_REPORT **0**. 아래 3개 근본 원인을 한 검토 라운드로 기록한다. 기준 HEAD/branch/seq1142/epoch1 dual fence/exact6는 위와 동일하다. 현재 시각 21:55~22:05 KST는 lease 만료 전이다. control9는 수정하지 않았다.

### 판단 이유

- `E08-LEDGER-ALIAS-001` (CRITICAL): `reservation()`과 `reserve()`가 canonical frozen DTO를 반환했고 `create_budget(limit)`도 caller alias를 저장했다. `object.__setattr__`가 예약액/상한을 바꿀 수 있었다. limit/request/usage 입력은 exact DTO 및 builtin 값 검증 후 새 값으로 재구성하며, reservation/dispatch/reconciliation/pause/snapshot 출력은 detached 복제한다. getter/reserve/legacy/dispatch/replay5 경로와 limit/usage alias를 검사하여 원장 보존과 추가 send0을 확인했다.
- `E08-ACTUAL-OVERFORECAST-002` (CRITICAL): B10이 실제 비용/토큰 초과를 RECONCILIATION_REQUIRED로 전환하지만 E08은 신규 admission을 막지 않았다. 알려진 실제 비용3(상한2/forecast1) 및 token1100(상한1000/forecast100)을 원문 수치와 PROVIDER_FINAL provenance로 보존한다. B10 예약은 RECONCILIATION_REQUIRED, dispatch는 PAUSED_QUOTA, `new_action_allowed=False`, `ACTUAL_USAGE_EXCEEDS_FORECAST`, next action `RECONCILE_ACTUAL_USAGE_AND_APPROVED_BUDGET`다. 원래 예약 노출은 유지하고 초과 실제 수치는 usage 영수증에 남긴다. 이를 정상 consume/release/0비용으로 주장하지 않으며 후속 sender0, exact replay, 다른 final 거부, publication fault 원장 복원/재시도 PASS를 확인했다.
- `E08-UNTRUSTED-CALLBACK-003` (IMPORTANT): RoutedRequest.pin_hash를 deepcopy 전에 검사하지 않았다. pin_hash 포함 RoutedRequest9필드, BudgetLimit/BudgetRequest/ProviderOutcome24필드, optional metadata와 snapshot mapping을 builtin exact type/shape/bounds로 선검증한다. custom deepcopy/bool/hash/str/strip/eq callback0. 일반 str은256자, token/concurrency 정수는10^18 이하, Decimal은 finite/64digits·exponent 절댓값64 이하로 제한한다. snapshot_ref는 5개 필드의 **plain dict**만 받는다. D11이 반환하는 신뢰된 MappingProxyType은 host가 명시적으로 dict로 분리해 전달하며, 임의 Mapping은 먼저 순회하지 않고 거부한다. 실제 sender만 허용된 host callback이다.

### 조치·RED/GREEN

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k r1 --tb=short
```

첫 RED exit1 **9 failed / 11 passed / 51 deselected, 0.88s**. alias3, overforecast2, publication1, pin_hash1, metadata bool2를 실제 재현했다. 최소 수정 후 focused exit0 **71 passed, 1.70s**.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k 'other_public or numeric_inputs or reconcile_returns' --tb=short
```

public boundary 전수 보강 RED exit1 **7 failed / 2 passed / 71 deselected, 0.78s**. pause/warning의 custom hash, legacy receipt str, snapshot Mapping.items, 숫자 상한3. 수정 후 기존 host fixture가 MappingProxy를 직접 전달해 **1 failed/79 passed, 1.77s**였다. callback 없는 plain dict 입력 경계에 맞춰 신뢰된 owner snapshot만 host에서 명시적으로 분리했다. 이 테스트 계약 정합은 추가 formal failure가 아니다. 다음 focused **80 passed, 1.78s**; 기존 값 검증을 전체 필드 행렬로 확장한 최종 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py --tb=short
```

exit0 **104 passed, 1.96s**. 새 회귀53개, 기존51개 보존. receiving-code-review/TDD/verification-before-completion 원칙으로 검토 재현→최소 수정→실행 결과를 확인했다.

### 최신 관련 회귀·정적 검사

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget tests/llm_gateway tests/tool_gateway tests/knowledge/test_model_registry_d11.py tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e08-review-r1-related-20260917 --tb=short -rs
```

exit0 **307 passed / 4 skipped, 72.39s**. 기존 isolated PostgreSQL18 DSN 미설정 skip4(atomic_reservation.py:106/155/218/265)를 PASS로 올리지 않았다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/budget/__init__.py','packages/budget/models.py','packages/budget/service.py','packages/budget/routing.py','tests/budget/test_budget_routing_e08.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE_PASS',len(paths))"
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
git diff --check
git diff --cached --name-only
git status --short
```

구문 exit0 COMPILE_PASS5, canonical exit0 PASS sequence1142/AUTO_CONTINUE, diff exit0, staged0. `rg.exe` 시작 불가 1회는 PowerShell Select-String으로 대체한 도구 환경 문제이며 제품 실패에 포함하지 않는다. Git global-ignore permission warning도 기존 환경 경계다.

basetemp는 생성 전 False, 종료 후 exact absolute path/Directory/non-ReparsePoint를 확인하여 생성한 시험자료만 삭제했다. Remove-Item exit0/Test-Path False; 임시 잔류0, 사용자 데이터 삭제0. 테스트 재실행으로 재생성 가능한 자료다.

### 최신 변경·해시·미검증·rollback

R1 실제 수정5경로: models/service/routing/test/report. 기존 init은 유지. 전체 제품 exact6와 Main control9 = dirty exact15이며 stage/commit/push0. baseline 대비 tracked diff: init+11/-2, models+40/-6, service+228/-11; untracked routing255행/test616행/report는 status에 별도로 포함된다.

- models SHA256 `DFAC1F269B094A833D1AA7344B90BA7A961A30F2311650DCCE25316C4EECACD8`
- service SHA256 `2151BB534D650E564292BAD4B3B8A793EFED312F38F63453C97C5B0C1454EB5D`
- routing SHA256 `E5A562C3993C4E1F955F1C68654F5663F7981A641BFB221160790B36732DF219`
- tests SHA256 `23FB1F83FB6AD65E3B0A2877B4223DB5D3F486DFE715B0E3AAA0A0156FB02524`
- init 해시는 최초 구현과 동일하며 report self-hash는 기록하지 않는다.

실제 Provider/network/DB/HTTP/UI/다중 process durable send-once는 NOT_EXECUTED/NOT_INTEGRATED. 승인 만료 seam은 **HOST_AUTHENTICATED_WINDOW_FIXTURE_ONLY**, durable source 미통합이다. B10 persistence adapter/schema 및 D11 owner 수정0. 알려진 초과 비용의 운영 invoice 수동 정산·budget 변경 승인·자동 재개는 수행하지 않았다. rollback은 Main이 이번 exact5 R1 delta만 역패치하되 원래 E08 exact6/control9를 보존한다. OS crash·외부 송신 복구를 PASS로 주장하지 않는다. progress/HANDOFF와 acceptance는 Main 소유이며 미갱신이다.

## 독립검토 REWORK R2 — 부분 확정 차원과 sticky safety stop

### 판정

**COMPLETED — Developer 로컬 보완 증거, 독립 acceptance 전.** 독립 review rework round **2**; formal FAILURE_REPORT **0**. `E08-ACTUAL-OVERFORECAST-002` lineage 보완2차이며 scope/기능/중요위험/epoch1/control9 변경0. 2026-09-17 22:07~22:15 KST, 기존 lease 유효 기간 내 수행했다.

### 판단 이유와 수정

1. 기존 `known`은 cost/token이 모두 있을 때만 참이어서 authoritative 부분 usage의 알려진 값까지 None으로 폐기했다. 이제 provenance authority와 차원 completeness를 분리한다. 알려진 cost 또는 token은 UsageReceipt에 그대로 보존하고 미확정 차원만 None이다. B10은 두 차원이 모두 있어야 consume/release할 수 있으므로 부분 usage는 RECONCILIATION_REQUIRED와 예약 노출 유지다.
2. 어느 확정 차원이 예약 최대를 초과하든 PAUSED_QUOTA/new_action_allowed=False, ACTUAL_USAGE_EXCEEDS_FORECAST/정산·승인 next action을 적용한다. hard2/forecast1/actual3+tokensNone, costNone/actualTokens1100의 대칭 경계를 검사했다. 부분 usage라도 확정 초과 사실은 무시하지 않는다.
3. 이전 R1 테스트의 publication 실패 후 allowed=True 기대가 fail-open을 고정한 점을 철회했다. 확정 초과 사실은 일반 응답 transaction rollback과 분리된 **sticky safety evidence**다. 공유 admission ledger에 원 usage를 보존하고 owner admission을 먼저 차단한다. B10 reconcile가 기존 reservation 상태 전이를 소유하며, response deepcopy 또는 owner adapter 예외가 나도 원 예약 exposure·실제 receipt·quota stop을 유지한다. retry 전 다른 service/request send0, 같은 retry는 PAUSED_QUOTA로 수렴한다. 예상 밖 adapter 예외 자체를 PASS로 숨기지 않고 caller에 전파한다.
4. public `BudgetService.reconcile()`도 같은 shared admission/owner lock 아래 확정 초과를 처리한다. 기존 UsageReconciliationRequired 예외 API는 유지하면서 기존 dispatch evidence에 exact caller receipt id/provenance/값을 결박한다. 일반 정상 정산의 adapter/publication fault는 owner reservation/usage/finalization을 정확히 복원한다. 초과 safety fact만 rollback 예외이며 일반 실패 전체를 sticky block으로 바꾸지 않았다.
5. caller receipt와 반환 DTO는 계속 detached. 기존 callback0 전수검사/R1 alias/send-once/100-way·D11 routing 회귀를 유지했다. 초과 실제 값은 usage evidence에 있으며 B10 원장에 허위 consume/0비용/승인된 추가 budget을 만들지 않았다.

### 실행 증거

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k r2 --tb=short
```

부분차원 RED exit1 **6 failed / 104 deselected, 0.47s** → 첫 GREEN focused **110 passed, 1.75s**.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k 'publication_failure_restores or publication_fault_restores' --tb=short
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k 'public_reconcile' --tb=short
```

추가 safety rollback RED exit1 **3 failed / 107 deselected, 0.51s**. public reconcile RED exit1 **5 failed / 110 deselected, 0.43s**. 수정 후 **115 passed, 1.81s**. 정상 direct reconcile rollback2회귀까지 추가한 최종 focused:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py --tb=short
```

exit0 **117 passed, 2.03s**. 기존 부분 usage 테스트는 known 차원을 폐기하던 잘못된 기대만 명시적 cost/token 기대값으로 교정했다. test patch anchor mismatch1회는 적용 전 검증 거부로 파일 변경0이었으며 정확한 anchor를 읽어 다시 적용했다; formal failure에 추가하지 않는다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget tests/llm_gateway tests/tool_gateway tests/knowledge/test_model_registry_d11.py tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e08-review-r2-related-20260917 --tb=short -rs
```

exit0 **320 passed / 4 skipped, 72.47s**. SKIP4는 동일한 isolated PG18 DSN 미설정(atomic_reservation.py:106/155/218/265)이다. 실제 Provider/DB 검증으로 승격하지 않았다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/budget/__init__.py','packages/budget/models.py','packages/budget/service.py','packages/budget/routing.py','tests/budget/test_budget_routing_e08.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE_PASS',len(paths))"
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
git diff --check
git status --short
git diff --cached --name-only
```

구문 COMPILE_PASS5/exit0, checker PASS seq1142/AUTO_CONTINUE/exit0, diff exit0, exact15(제품6+Main control9), staged0. 임시 디렉터리는 생성 전 부재 확인, 실행 후 exact absolute 경로/non-reparse 확인 후 생성 시험자료만 정리하여 잔류0을 확인했다.

### 변경·미검증·rollback

R2 실제 수정3: `packages/budget/service.py`, `tests/budget/test_budget_routing_e08.py`, 본 보고서. 제품 exact6 밖 write0. baseline 대비 service +284/-11, 신규 test744행. service SHA256 `F070FC65096AFC8AD4C9A33E593C3D8E6E2A6DC69E3CAC3BB1AF016C3C7F1EEE`, test SHA256 `F3EF4B82A19DBF60742945CDDF39AA41252838BA27EFE3BADE8D1DE9A9FEF821`; 기타 제품 해시는 R1과 동일.

DB durable safety ledger/send-once, process restart, 실제 Provider invoice·quota·network/API/UI는 **NOT_INTEGRATED/NOT_EXECUTED**. expiry authority는 계속 **HOST_AUTHENTICATED_WINDOW_FIXTURE_ONLY**이며 durable source 미통합이다. Main은 이번 exact3 delta만 검토/역패치해 rollback할 수 있다. 실제 rollback/commit/stage/push/lease revoke/acceptance/E09 시작0. control9와 progress/HANDOFF는 Main 소유로 미갱신이다.

## 독립검토 REWORK R3 — Provider stop의 publication 독립성

### 판정

**COMPLETED — Developer 보완 완료, 독립 재판정 대기.** 독립 review rework round **3**; formal FAILURE_REPORT **0**. Main의 R3 실행 지시에 따라 exact6/epoch1 안에서 보완했다. 기준 HEAD/seq1142/WI/lease 불변, 2026-09-17 22:18~22:23 KST 유효 기간 내 수행. product 실제 변경은 service/test/report3개뿐이며 control9 write0이다.

### 판단 이유

`E08-PROVIDER-STOP-PUBLICATION-004`: R2 overforecast safety stop은 유지되었지만 QUOTA_EXHAUSTED/HARD_LIMIT은 응답 transaction 안에서만 기록되어 deepcopy 실패 rollback이 allowed=True/SEND_STARTED를 복원했다. provider가 보고한 stop 사실도 accounting/response 성공 여부와 무관하므로, 현재 검증된 outcome의 quota pause/실제 usage/체크포인트/원 failure code와 `new_action_allowed=False`를 **정산 transaction 전에** 기록한다. B10 소비/반환 정산 자체는 기존 transaction을 유지한다.

응답 또는 adapter 실패 시 정산 원장/reservation은 이전 상태로 복원하되, 이미 관측한 stop과 dispatch receipt/pause evidence는 남는다. 후속 다른 BudgetService/request sender0, 동일 retry는 PAUSED_QUOTA로 수렴한다. 나중에 완전한 usage가 failure_code=None으로 도착해도 소비/반환만 정산하고 원 provider stop은 지우지 않는다. 자동 재개0. 기존 non-safety failure의 정상 rollback/overforecast sticky stop/callback0/alias 회귀는 유지했다.

### 조치·정확한 실행 결과

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py -k r3 --tb=short
```

RED exit1 **8 failed / 117 deselected, 0.51s**: 2 stop codes × 완전/unknown/cost-only/token-only usage. 최소 수정 후 focused **125 passed, 2.09s**. 이어서 response DTO/reservation DTO/owner reconcile fault3지점으로 행렬을 확대하고, 뒤늦은 final usage가 stop을 지우지 않는2회귀를 추가했다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget/test_budget_routing_e08.py --tb=short
```

exit0 **143 passed, 2.00s**. R3 failure matrix24 + final-usage stop 보존2, 기존117 유지.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/budget tests/llm_gateway tests/tool_gateway tests/knowledge/test_model_registry_d11.py tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e08-review-r3-related-20260917 --tb=short -rs
```

exit0 **346 passed / 4 skipped, 80.85s**. 기존 PG18 DSN 미설정 skip4(atomic_reservation.py:106/155/218/265)는 그대로 미검증이다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/budget/__init__.py','packages/budget/models.py','packages/budget/service.py','packages/budget/routing.py','tests/budget/test_budget_routing_e08.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE_PASS',len(paths))"
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
git diff --check
git status --short
git diff --cached --name-only
```

구문 exit0 COMPILE_PASS5, checker exit0 PASS sequence1142/AUTO_CONTINUE, diff exit0, staged0, dirty exact15(제품6+Main control9). 시험 basetemp는 실행 전 부재, 종료 후 exact absolute 경로/non-ReparsePoint 확인 후 생성 fixture만 삭제해 잔류0이다. 사용자 데이터 삭제0; 테스트로 재생성 가능한 임시 자료만 정리했다.

### 최신 hash·미검증·rollback

- service baseline diff +291/-11, SHA256 `DA1FE2B4636370C93A09B8A79EBB9137480C44AEEAB15577DC97FFF44FD7F5C9`.
- test 신규808행, SHA256 `B4427CE5212E1702FA9E1BDF9B5924AB99364F83CB1FF6B1284EF499151E11C4`.
- init/models/routing은 R1 hash와 동일; report는 self-hash 기록하지 않는다.
- 실제 Provider/network/DB durable safety ledger·send-once/HTTP/UI/production은 NOT_EXECUTED/NOT_INTEGRATED. expiry source는 HOST_AUTHENTICATED_WINDOW_FIXTURE_ONLY, durable source 미통합이다. OS crash/restart recovery를 PASS로 주장하지 않는다.
- rollback은 Main이 이번 service/test/report3경로 R3 delta만 역패치하고 기존 제품/control9를 보존한다. 실제 rollback/commit/stage/push/acceptance/lease revoke/E09 시작0. progress/HANDOFF는 Main 소유로 미갱신이다.
