# E-05 완료보고 — 제한 병렬 read/analyze Delegation

## 1. 판정

`COMPLETED` — R2 REWORK 보완·Developer 로컬 계약 검증 완료. Main acceptance 및 독립 재검토 판정은 아니다.

- Work Package E-05, validation IDs `AV-AGT-032`, `AV-FLOW-005`.
- 현재 canonical seq1104 / E05 IN_PROGRESS / E06 NOT_READY / pending approvals0. 시작 dual lease ACTIVE. 본 보고서가 PACKAGE_COMPLETED·acceptance·lease revoke를 자동 생성하지 않는다.
- R2 최신 focused **79 passed**, 관련 **1024 passed / 6 skipped**, start control **8 passed**. compileall / diff-check / canonical checker exit0. formal failure count2. 아래 초기 및 R1 기록은 각 구현 당시 증거로 보존한다.
- 실제 Provider 병렬 호출, DB batch adapter 통합, HTTP/UI, 외부 전송, 운영 실행은 NOT_EXECUTED/NOT_INTEGRATED. 기존 PG18 SKIP는 PASS가 아니다.

## 2. 판단 이유

### 기준선과 권위

- 작업 root `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- branch `codex/c09-execution-backends-r1`; 시작/current HEAD 및 local upstream `07fb68164de2ecf3b06342013d23e4d34d4dd0cb`.
- 시작 `git status --short` empty. private remote exact·clean은 Main 전달 read-only 확인(`MAIN_LIVE_REMOTE_READ`); Developer가 live remote를 독립 실행했다고 주장하지 않는다.
- WI `docs/work_orders/E-05_WORK_INSTRUCTION.md`, SHA256 `60FF1BED503C54741C16246212092AB269EB9D0B340C28F6B595FB3C664CAD6E`.
- invocation SHA256 `D43F3EC18AEDDF435F7E935A5A45C17929B11ACBA2F6166C8951C31B240C2659`.
- 설계 baseline `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`; 작업계획 hash `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- 계획 E05, 설계 §47.18-5, 매트릭스 두 validation ID, 운영 규칙의 제한 병렬/독립 검증 경계를 따른다. Main이 제품 exact6와 control exact9, 기존 reservation 소비-only 경계를 승인했다.
- worker `worker-lease-e05-r1-20260917-001`, execution fence `e05-r1-execution-fence-epoch-1-07fb68164de2ecf3`.
- write `write-lease-e05-r1-20260917-001`, write fence `e05-r1-write-fence-epoch-1-b06342013d23e4d3`.
- issued `2026-09-17T13:29:00+09:00`, expires `2026-09-18T01:29:00+09:00`. start checker PASS 이후 제품을 수정했다.

### 구현과 owner 재사용

1. E04 `TaskGraph`/`DagQueueService`/B09 `DurableQueue`의 입력 hash·dependency·conflict·queue claim을 재사용한다. 별도 queue/table/schema를 만들지 않았다.
2. 기존 `DelegationPacket`, `PermissionSnapshot`, `DataEgressProfile`, `validate_packet`으로 baseline·parent permission/egress narrowing·context·scope를 전량 검사한 뒤 host capture한다. actor/run/request/reservation/node-input 계보를 결박하고 caller 입력은 detached snapshot으로 보존한다.
3. `AnalysisTask`와 `ConcurrencyScheduler`는 host-owned in-process boundary다. 외부 payload/API self-registration 경로가 없고 batch 미등록/foreign authority는 거부한다. 실제 worker launcher는 없다.
4. operation은 read/analyze만 허용한다. write capability·shared/mutable context·같은 context 내용·scope overlap·독립성 없는 DAG·limit1은 SINGLE_WORKER로 축소한다. 순차 claim에서도 같은 worker를 사용한다. single mode가 write 실행 권한을 부여하지 않는다.
5. fanout 최대16, 동시성 최대16 및 host 설정 한도, packet당16KiB/전체64KiB, result당16KiB/집계 row당3KiB 상한을 적용한다. raw transcript/result body를 synthesis에 실어 보내지 않고 bounded summary와 evidence refs만 제공한다.
6. B10 `LeaseService` 현재 Main worker/fence·half-open expiry를 확인한다. B10 `BudgetService`의 이미 생성된 current RESERVED receipt를 exact run/step/request 및 registration hash와 대조한다. reserve/send/reconcile를 scheduler에서 호출하지 않는다. E08 원자 reservation 정책과 실제 DB 병렬 예산 통합은 구현하지 않았다.
7. `DurableQueue.claim_selected`는 전체 선택의 ready/dependency/conflict·token을 준비하고 final authority fence 뒤 한 번에 publish한다. token 준비 실패·revoke·budget drift·queue drift 시 partial claim0. 기존 single `claim` 구현과 semantics는 변경하지 않았다.
8. 결과는 기존 `ResultEnvelope`/`validate_result`를 재사용한다. canonical queue claim/worker/epoch/target/delegation/step/evidence/시각을 재검사하고 changed_paths·stale token·foreign worker·SKIPPED의 COMPLETED 주장을 거부한다. 동일 result replay는 동일 hash, 다른 내용은 RESULT_REBIND다.
9. queue SUCCEEDED는 **결과 전달 완료**이며 분석 PASS가 아니다. 실패·BLOCKED·미도착 결과를 개별 보존하고 성공하지 않은 분석이 종속 분석을 열지 않는다. synthesis는 COLLECTED_FOR_MAIN 또는 REVIEW_REQUIRED/PENDING/CANCELLED일 뿐 Run success·acceptance·approval·merge를 생성하지 않는다. E07 정책 선택·자동 복구는 하지 않는다.
10. 실제 ThreadPool/Barrier로 로컬 불변 fixture 계산 두 개의 동시 실행·결과 수집을 확인했다. 이는 Provider benchmark나 실제 파일/DB 분석 성공 증거가 아니다.

## 3. 조치 및 변경 경로

제품 exact6:

- `packages/agent_team/__init__.py`: 신규3 symbol lazy export, 기존 queue↔agent_team import cycle 방지.
- `packages/agent_team/concurrency.py`: host capture, bounded scheduler, receipt 수집, synthesis projection.
- `packages/queue/service.py`: selected batch atomic claim seam41행 추가; 기존 single claim 불변.
- `tests/agent_team/test_concurrency_e05.py`: 정상/적대/병렬/멱등/취소/예산/결과 테스트.
- `tests/queue/test_concurrency_claim_e05.py`: atomic batch claim, conflict/dependency, token failure, 경합 테스트.
- 본 완료보고.

control exact9:

- `docs/work_orders/E-05_WORK_INSTRUCTION.md`
- `docs/work_orders/E-05_INVOCATION_PROMPT.md`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/BUILD_HANDOFF.md`
- `docs/progress/progress-handoff-detached-digest-e05-start.json`
- `docs/evidence/manifests/E-05_START_MANIFEST.json`

합집합 exact15. tracked diff는 report 생성 전7개 파일 676 insertions/280 deletions이며 untracked 신규8개는 `git diff --stat` 집계에 포함되지 않는다. progress/HANDOFF의 현재 projection 교체 외 raw event object prefix seq1~1100 및 기존 역사 evidence는 불변이다. seq1101 WI,1102 worker,1103 write,1104 PACKAGE_STARTED만 append했다.

### checker 안전 편집 증거

- Main 승인 additive one-shot temp→AST/compile→allowed diff validator→os.replace만 사용했다. checker에 apply_patch 사용0.
- clean full anchor 4,410,086 bytes, SHA `D338A928F52D0D4DF317BD69C20B5F78DD86645547AB0A9811ADE220285B3F39`.
- 신규 E05 block13,433 bytes, SHA `B6BD6F04413F2A58860C449961F991E335B83AE30F9391DFACFDA1AD0DAC2387`.
- 추가 routes/event1104/EOF helper 총154 additions, deletions0. reverse insertion 복원 bytes가 clean anchor와 exact 일치, anchor count1, historical replacement0.
- resulting checker SHA `4DF3480F8A38992FE5DF51A2CD937985124D92CDE210E9D7EDE28018D2572464`.
- normalized unified patch SHA `298E70B71942D4B4BD98D56EB86CDA854A7E1F85DB6EB5604FA39CC6CF062635`.
- E04의 과거 편집 incident2는 역사 기록이며 이번 E05 편집 incident0. sibling temp는 atomic replace 후 남지 않는다.

## 4. 실행 명령 / exit / 실제 결과

모든 명령 cwd는 위 canonical root, Python 실행 파일은 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`다. 아래 `PY`는 이 exact 실행 파일의 보고용 약칭이다.

| 단계 | 정확한 인수 | exit | 실제 결과 |
|---|---|---:|---|
| start RED | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E05StartControlTests --tb=short` | 1 | 2 failed /2.12s, missing E05 start/git helper |
| start GREEN | 같은 명령 | 0 | 2 passed /10.10s |
| 제품 RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py --tb=short` | 1 | 36 failed /1.05s, scheduler/atomic claim 미구현 |
| 첫 구현 | 같은 focused 명령 | 1→0 | 33P/3F 결과 정렬 결박 →36P/0.90s |
| 적대 보강 | 같은 focused 명령 | 1→0 | 48P/4F→52P/0.97s; context hash/revoke/dependency/SKIPPED |
| 추가 보강 | 같은 focused 명령 | 1→0 | 53P/3F→56P/1.03s; single worker identity/final budget/backdated result |
| projection RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py -k bounded_evidence --tb=short` | 1 | 1 failed/45 deselected /1.86s |
| 최종 focused | 위 focused 명령 | 0 | **57 passed /1.04s** |
| 최종 관련 회귀 | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/queue tests/leases tests/budget --tb=short -rs` | 0 | **1002 passed,6 skipped /12.73s** |
| historical/start controls | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E03StartControlTests tests/tooling/test_project_progress.py::E04StartControlTests tests/tooling/test_project_progress.py::E05StartControlTests --tb=short` | 0 | **8 passed /34.45s** |
| static | `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/concurrency.py packages/queue/service.py tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0 | compile PASS |
| canonical | `PY -B scripts/check_project_progress.py` | 0 | `PASS sequence=1104 reporting=AUTO_CONTINUE` |
| whitespace | `git diff --check` | 0 | output empty |

기존 SKIP6: queue `test_durable_queue.py:99`, leases `test_worker_write_fencing.py:62`, budget `test_atomic_reservation.py:106/155/218/265`; 전부 `isolated PostgreSQL 18 DSN not configured`. 실제 credential/DB/컨테이너에 접근하지 않았다.

E04 final의 historical frozen builder는 당시 product bytes를 live root에서 검사하는 계약이다. E05가 승인된 공용 queue/init 제품을 변경한 뒤 그 final builder를 현 root에 직접 적용하여 재수락하지 않는다. E04 committed acceptance manifest/raw prefix 보존과 현재 E05 canonical 검증을 사용한다. 기존 E03/E04 start control8 범위의 회귀는 실제 실행했다. 전체 tooling 장시간 suite는 실행하지 않았다.

## 5. 오류·미검증·잔여 위험

- 최초 구현 당시 E05 formal FAILURE_REPORT count0; 이후 독립 검토 R1/R2 REWORK를 수락해 현재 **formal failure count2**이다(아래 R1/R2). 위 개발 RED/중간 GREEN 실패 자체는 추가 정식 실패로 세지 않는다. 첫 결과 정렬 수정과 fixture API 이름/필드 보완도 내부 구현 기록이다.
- Git read-only 명령에서 global ignore 경로 permission warning이 있었으나 repository status/diff·exit를 확인했고 Git 설정을 변경하지 않았다.
- 실제 Provider/HTTP/UI/worker launch/외부 program/운영 실행0. Python local ThreadPool fixture는 합성 계약 검증이다.
- 새 queue batch seam은 기존 **in-memory reference owner**에 추가했다. PostgreSQL batch claim adapter/다중 process 원자성은 NOT_INTEGRATED이며 E04 single-claim PG15 증거를 E05 batch PASS로 재사용하지 않는다.
- E08 예약·사용량 정산·Provider hard-limit 원자 통합, E07 실패 정책, E06 write/worktree lease, E11 benchmark는 미구현·범위 밖이다. current reservation의 외부 정산 순서는 해당 owner 통합에서 검증해야 한다.
- capture는 신뢰된 host control-plane 호출 경계다. payload-facing authority mint/API는 제공하지 않는다. 별도 backend wiring 시 이 경계를 보존해야 한다.
- 독립 검토는 Main이 수행한다. 이 Developer의 테스트 결과는 자기 승인·Tester PASS·Main acceptance를 대체하지 않는다.

## 6. rollback 및 인계

- Main이 exact diff/신규 파일을 보존한 뒤 E05 product exact6만 기준 HEAD에 대한 역 patch로 복구할 수 있다. 공유 E04 queue/init의 기존 bytes와 사용자 자료는 보존한다. reset/clean/stash/delete/commit/push를 Developer가 실행하지 않았다.
- start history는 append-only이므로 rollback 필요 시 Main이 lease revoke/취소 successor event로 기록하며 seq1~1104를 소급 수정하지 않는다.
- progress/HANDOFF는 start canonical seq1104로 갱신됨; 이 보고서의 완료 주장은 acceptance 이벤트가 아니다. 두 lease는 현재 만료 전 ACTIVE이며 Main 독립 검토/회수 절차를 기다린다. E06 시작0.

## 7. R1 독립 검토 REWORK — formal failure count1

### 판정·lineage

R1 `COMPLETED`(Developer 보완 완료, 독립 재검토 전). Main 전달 독립 검토 C0/I4(budget race 중복 포함)를 동일 회차 **count1**로 수락했다. 본 보고서는 아래 식별자를 로컬 failure fingerprint로 고정한다. 취소·예약·예산·queue 우회의 중요도 판단을 축소하지 않는다.

| fingerprint | 확인한 원인 | R1 조치 |
|---|---|---|
| E05-DISPATCH-CANCEL-TOCTOU-001 | 최초 취소 검사 뒤 token/snapshot callback에서 cancel되어도 queue publish 가능 | 모든 callback 후, publication 직전 취소·lease/fence를 다시 검사. claim0/dispatch receipt0 |
| E05-RESERVATION-REUSE-002 | RESERVED 상태만 검사해 다른 graph/batch/queue에서도 같은 reservation/request 사용 가능 | 기존 budget repository identity별 E05 consumption sidecar 공유; reservation ID와 request ID를 batch/graph/packet/operation/dispatch identity에 한 번 결박. 다른 사용 거부, 원래 exact replay만 원 receipt 반환 |
| E05-BUDGET-OWNER-ATOMICITY-003 | receipt와 snapshot 개별 read 사이 및 마지막 검사 이후 reconcile race | 기존 exact InMemoryInterventionBudgetRepository의 RLock을 전체 검사→queue publication까지 유지. 반환 receipt/snapshot을 owner canonical record 및 owner snapshot 계산과 대조; 전체 원장 content fingerprint를 callback 이후 재검사 |
| E05-QUEUE-CLAIM-POLICY-BYPASS-004 | E05 job을 공용 queue single claim으로 직접 claim하여 cancel/budget/authority 검사를 우회 | queue owner에 job별 opaque host claim policy 결박. 일반 single claim은 E05 managed job을 제외; selected claim도 exact owner capability+final guard가 없으면 CLAIM_OWNER_REQUIRED |

신규 reservation 생성·정산·가격/한도 정책·DB schema·API·E08 설계 변경 없음. 이 sidecar는 E05의 **사용 계보**이며 BudgetService의 예약 권위나 별도 budget owner가 아니다. 동일 repository를 공유하는 다른 scheduler 또는 다른 queue도 같은 사용 ledger를 공유한다. 최초 batch 실패 시 ledger를 publish하지 않으며 정상 retry가 가능하다.

### 동기화·실제 지원 경계

- lock order: scheduler → LeaseService owner → BudgetService의 in-memory repository owner → queue owner. 기존 reserve/reconcile/snapshot과 같은 repository lock이 사용된다.
- 외부 thread reconcile이 lock을 먼저 획득하면 이후 dispatch가 CONSUMED를 보고 claim0; dispatch가 먼저 획득하면 queue publication 뒤에만 reconcile이 진행되어 순서가 명확하다.
- RLock의 same-thread callback mutation도 안전하다고 가정하지 않는다. token/snapshot callback의 reconcile/cancel 이후 no-I/O owner record fingerprint/current cancellation을 다시 검사해 publication을 거부한다.
- BudgetService public read가 cached/forged RESERVED receipt 또는 stale allowed snapshot을 반환해도 owner 원장과 불일치하면 BUDGET_RECEIPT_INVALID다.
- 전량 원자 경계를 제공하지 않는 다른 budget adapter는 `ATOMIC_BUDGET_ADAPTER_NOT_INTEGRATED`로 fail-closed한다. 실제 PostgreSQL budget+queue distributed transaction은 NOT_INTEGRATED다. in-memory evidence를 DB atomic PASS로 승격하지 않는다.
- queue claim policy는 host-only opaque object capability다. payload가 job policy를 mint/rebind하는 API는 없으며 다른 capability로 existing policy rebind를 거부한다. policy 없는 일반 E04 job의 single claim은 그대로 수행된다.

### R1 변경 파일

기존 exact6 중 다음5개만 이번 R1에서 수정했다: `packages/agent_team/concurrency.py`, `packages/queue/service.py`, `tests/agent_team/test_concurrency_e05.py`, `tests/queue/test_concurrency_claim_e05.py`, 본 보고서. `packages/agent_team/__init__.py` 및 control exact9는 추가 변경하지 않았다. 누적 dirty exact15/staged0을 유지한다.

### R1 RED→GREEN / 정확한 실행 증거

모든 명령의 `PY`와 cwd는 §4의 동일 absolute Python/canonical root다.

| 단계 | 정확한 인수 | exit | 실제 결과 |
|---|---|---:|---|
| 독립 finding 재현 RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py -k r1 --tb=short` | 1 | **8 failed,1 passed,46 deselected /1.03s** |
| 기본 보완 GREEN | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py --tb=short` | 0 | 66 passed /1.05s |
| owner 위조 변형 RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py -k r1 --tb=short` | 1 | **2 failed,13 passed,57 deselected /1.11s** |
| 최종 focused | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py --tb=short` | 0 | **72 passed /1.16s** |
| 최종 관련 회귀 | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/queue tests/leases tests/budget --tb=short -rs` | 0 | **1017 passed,6 skipped /10.52s** |
| 통제 회귀 | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E03StartControlTests tests/tooling/test_project_progress.py::E04StartControlTests tests/tooling/test_project_progress.py::E05StartControlTests --tb=short` | 0 | **8 passed /5.65s** |
| 정적 | §4의 exact compileall 명령 재실행 | 0 | output empty |
| canonical | `PY -B scripts/check_project_progress.py` | 0 | PASS sequence=1104 reporting=AUTO_CONTINUE |
| whitespace | `git diff --check` | 0 | output empty |

SKIP6은 §4와 같은 기존 isolated PG18 DSN 미설정이다. 실제 Provider/DB/HTTP/UI/운영 실행0. 외부자원 생성·Git mutation0. 단위 race 증거는 로컬 Thread/Event 및 실제 owner RLock이며 PostgreSQL 증거가 아니다.

### 인계·rollback

- 네 fingerprint는 Developer 재현 테스트에서 해소됐고 Main 독립 재검토를 요청한다. 재검토 전 ACCEPTED로 표기하지 않는다.
- R1 변경은 위5개 파일의 보존된 diff 역 patch로 복구할 수 있다. 기존 E04 일반 queue·승인된 제품·control/event prefix를 보존하고 실제 rollback은 Main이 판단한다.
- seq1104/dual lease ACTIVE/E06 NOT_READY/pending approvals0 유지. failure count1은 이 보고서에 기록했으며 canonical acceptance/rework 이벤트 materialization은 Main 지시 없이 수행하지 않았다. acceptance/lease revoke/commit/push/E06 시작0.

## 8. R2 재진입·lock inversion 보완 — formal failure count2

### 판정 → 판단 이유 → 조치

R2 `COMPLETED`(Developer 보완 완료, Main 독립 재검토 전). Main의 두 번째 정식 REWORK를 **count2**로 기록한다. fingerprint `E05-REENTRANT-DISPATCH-LOCK-INVERSION-005`: token factory의 동일 request 재진입이 내부 claim을 먼저 게시하고 바깥 dispatch를 실패시켰으며, queue lock 안의 arbitrary token/final guard callback이 foreign budget lock과 역순 대기를 만들 수 있었다. 연관 Minor `E05-REGISTER-BUDGET-DRIFT-006`: register의 후속 reservation callback이 이전 receipt를 reconcile해도 graph/job/batch를 게시할 수 있었다. R1 네 fingerprint와 이력을 보존한다.

1. batch 작업별 in-flight/Condition 경계를 두었다. 같은 thread 재진입은 거부하며 다른 thread의 동일 batch는 선행 작업 종료 뒤 exact replay를 검사한다. callback thread-local taint는 다른 scheduler/다른 budget/같은 queue의 재진입도 거부한다. callback이 안쪽 예외를 삼켜도 바깥 준비가 실패하며 claim/receipt publication0이다. 이후 정상 retry와 exact replay가 가능하고 in-flight marker는 finally에서 제거한다.
2. public budget read, token factory, 일반 selected-claim final guard는 모든 scheduler/lease/budget/queue lock 밖에서 실행한다. immutable queue state stamp와 전체 budget owner fingerprint를 준비 전후 비교한다. 마지막 publication은 scheduler→lease→budget→queue의 기존 owner lock 순서 아래 callback 없이 수행하고, current cancellation/fence/reservation/consumption/queue state를 재검사한다. E05는 prepared token/stamp 및 opaque claim owner를 전달하며 final callback을 전달하지 않는다.
3. E04 일반 single claim도 token factory를 queue lock 밖에서 실행하고 stamp CAS 뒤 claim을 게시한다. concurrent winner로 stamp가 달라지면 기존 polling API는 None을 반환한다. E05 job은 여전히 ordinary single claim 제외이며 일반 E04 job 회귀를 통과했다.
4. register는 public reservation callback 이전 budget fingerprint를 캡처하고, 이후 기존 owner lock 아래 canonical receipt/fingerprint를 재검사한 뒤에만 graph/pending rows/batch를 게시한다. earlier receipt reconcile 재현에서 세 저장소 publication0을 확인했다. 신규 예약 생성/정산 정책/E08 구현은 추가하지 않았다.

R1 lock 관측 테스트는 이제 임의 token callback이 아니라 실제 `_publish_selected` 시점에서 BudgetService owner lock이 유지되는지 검사한다. revoke-during-token의 구조화 reason은 최종 authority fence의 `STALE_FENCING_TOKEN`으로 고정했다. 이는 callback 준비와 atomic publication을 분리한 계약에 따른 테스트 교정이며 no-partial-publication assertion은 유지했다.

### 변경·실행 증거

R2 수정은 기존 제품 exact6 중 `packages/agent_team/concurrency.py`, `packages/queue/service.py`, `tests/agent_team/test_concurrency_e05.py`, `tests/queue/test_concurrency_claim_e05.py`, 본 보고서의 5개뿐이다. init 및 control exact9 freeze, 누적 exact15/staged0. 기준선/문서 hash/lease는 §2와 동일하다. `PY`는 §4에 기록한 absolute Python이며 cwd도 동일하다.

| 단계 | 정확한 명령 | exit | 실제 결과 |
|---|---|---:|---|
| R2 최초 RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py -k r2 --tb=short` | 1 | 5 failed,2 passed,72 deselected /1.50s |
| 재진입 unique-token RED | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py -k r2_reentrant --tb=short` | 1 | 2 failed,62 deselected /0.90s; inner publication 재현 |
| 최종 focused | `PY -B -m pytest -q -p no:cacheprovider tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py --tb=short` | 0 | **79 passed /1.28s** |
| 최종 관련 | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/queue tests/leases tests/budget --tb=short -rs` | 0 | **1024 passed,6 skipped /12.26s** |
| control | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E03StartControlTests tests/tooling/test_project_progress.py::E04StartControlTests tests/tooling/test_project_progress.py::E05StartControlTests --tb=short` | 0 | **8 passed /6.19s** |
| compile | `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/concurrency.py packages/queue/service.py tests/agent_team/test_concurrency_e05.py tests/queue/test_concurrency_claim_e05.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0 | output empty |
| checker | `PY -B scripts/check_project_progress.py` | 0 | PASS sequence=1104 reporting=AUTO_CONTINUE |
| diff | `git diff --check` | 0 | output empty |

최초 재진입 fixture가 duplicate token 때문에 안쪽 실패를 유발해 실제 우회를 가렸으므로 unique token으로 교정하고 별도 2 RED를 확인했다. 중간 focused 77 PASS/2 FAIL은 위 기존 테스트 관측/이유 코드 교정 전 결과이며 정식 실패 count를 추가하지 않는다. cross-budget contention은 실제 local Thread/lock timeout probe로 single/token/guard 세 경계를 검증했다.

### 미검증·rollback·인계

- SKIP6은 기존 isolated PG18 DSN 미설정이다. 실제 PostgreSQL batch/distributed owner transaction, Provider 병렬 호출, HTTP/UI/worker/운영은 NOT_EXECUTED/NOT_INTEGRATED. E04 PG15 증거를 E05 batch 증거로 재사용하지 않는다.
- 지원 동기화 경계는 exact in-memory BudgetService repository 및 queue reference owner다. cross-thread 호출과 hostile callback 검사는 이 경계의 증거이며 외부 adapter/임의 외부 lock 보유자에 대한 보편적 deadlock 보증이 아니다.
- 복구는 Main이 위 5개 R2 diff를 먼저 보존한 뒤 역 patch로 수행할 수 있다. 기존 E04 ordinary queue/control/history를 보존한다. Developer는 rollback/Git mutation을 실행하지 않았다.
- seq1104, E05 IN_PROGRESS/E06 NOT_READY, dual lease ACTIVE/pending0 유지. canonical failure/acceptance successor 작성은 Main 소유. 본 보고서는 formal count2를 기록하되 acceptance·lease revoke·commit·push·E06 시작을 수행하지 않는다.
