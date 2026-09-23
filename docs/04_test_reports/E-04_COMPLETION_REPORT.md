# E-04 완료보고 — COMPLETED

## 현재 판정 — R2 실제 PostgreSQL15 PASS / 독립 재검토 대기

**COMPLETED — Developer 구현·검증 완료, 독립 재검토 및 Main acceptance 전.** Main이 R2 수정본을 동일 isolated ephemeral pgvector/PostgreSQL15 container + SSH tunnel + `postgresql+psycopg` scratch harness에서 실제 재검증했다. Developer 직접 실행으로 표시하지 않는다.

Main 제공 명령:

```text
python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_dag_queue_e04.py -k real_postgres --tb=short
```

결과: **exit0, 5 passed / 7 deselected, 93.24s**. scratch container residue **0**.

실제 검증된 5개 경우:

1. cursor-prefetch / bounded selector 원인 behavior probe.
2. 전체 DAG queue dependency·동시 claim·visibility·fencing·completion replay·quarantine scenario.
3. downgrade register-first: 등록 transaction이 먼저인 경우 downgrade가 기다렸다가 live DAG를 보고 abort하며 권위를 보존.
4. downgrade-first actual register: downgrade 뒤 실제 register가 명시 실패하고 조용한 권위 손실 없음.
5. downgrade-first direct SQL: adapter를 우회한 insert도 table fence에 의해 차단된 후 명시 실패.

formal failure 누계 **2**를 유지한다. `E04-PG-CURSOR-MULTIROW-LOCK-001`과 `E04-DOWNGRADE-LIVE-DAG-TOCTOU-002`는 Main actual PG15 재검증으로 **둘 다 resolved**, 단 독립 재검토는 대기 중이다. 이 갱신은 과거 실패를 삭제하거나 package acceptance를 자동 생성하지 않는다.

이번에는 본 보고서만 수정했다. 제품/control 다른20개, seq1095·lease·역사 prefix·checker는 freeze 유지한다. 로컬 focused43 PASS/6 SKIP, related964 PASS/35 SKIP, control6 PASS 및 compile/checker/diff PASS는 아래 기록대로 보존하며, 로컬 SKIP을 소급 PASS 처리하지 않는다.

**PostgreSQL18, 공유 WSL 개발 DB apply, 기존 운영 DB/volume, HTTP/UI·Provider·worker 실행·운영 배포는 미검증**이다. 실제 PG15 증거는 위 synthetic isolated harness와 5 tests 범위에 한한다. 다음 안전 행동은 Main의 독립 재검토·수락 판단이며, Developer commit/push/acceptance/E05는 수행하지 않았다. scratch 환경은 정리됐으므로 공유 DB rollback은 필요 없다.

---

## R2 로컬 재작업 당시 판정 — formal failure count2 (actual 재검증 전 기록)

**INCOMPLETE — R2 로컬 검증 완료, 실제 PostgreSQL 경합 재검증 대기.** Main의 독립 spec ACCEPT C0/I0/M0 및 quality REWORK C0/I1/M0를 반영했다. package formal failure count는 **2**이며 서로 다른 fingerprint다.

- 기존 `E04-PG-CURSOR-MULTIROW-LOCK-001`: count1, Main 실제 PG15 R1 재검증 PASS로 **resolved 유지**.
- 신규 `E04-DOWNGRADE-LIVE-DAG-TOCTOU-002`: count1, package 누계2. R2 수정 후 실제 race 증거는 아직 받지 않았으므로 해소 확정을 주장하지 않는다.

### 판단 이유 / 독립 실제 재현

Main이 전달한 실제 PG15 재현은 `downgrade live-graph precheck0 → concurrent transaction이 graph-live row insert/commit → downgrade graph columns DROP`이며, 결과 `row1 / graph columns0`으로 조용한 DAG 권위 손실이 발생했다. 이 독립 실행의 전체 command/실행 시간은 worker에게 미제공이므로 임의로 기입하지 않는다. 기존 downgrade에는 사전 검사와 DROP을 함께 보호하는 fence가 없음을 코드에서 확인했다.

### 최소 조치 / exact3만 변경

1. `migrations/versions/0014_dag_queue.py`: downgrade의 첫 SQL에 **transaction-scoped advisory key17004001 → durable_queue_jobs ACCESS EXCLUSIVE → live DAG 재검사**를 순서대로 추가했다. 기존 `PostgresDagQueue.register`와 동일한 advisory-before-table 순서다. 같은 Alembic PostgreSQL DDL transaction에서 함수 복구 및 column DROP까지 잠금을 유지하며 중간 COMMIT은 없다. 직접 SQL insert도 table lock으로 차단한다.
2. `tests/persistence/test_dag_queue_e04.py`: lock ordering/precheck/DROP 순서와 transaction 중간 종료 부재를 static RED로 고정했다. 실제 PostgreSQL two-connection race 3종을 추가했다. 대기는 시간 지연만으로 추정하지 않고 `pg_locks`의 `NOT granted`로 확인한다.
   - register가 먼저 advisory/row를 보유: downgrade 대기 → register commit → live row 재검사 abort, row1/graph column1 보존.
   - downgrade가 먼저 fence/precheck 보유: 실제 register 대기 → DROP commit 뒤 명시적 undefined-column(42703) 실패, row0/graph column0.
   - downgrade 선점 중 직접 SQL insert: table lock에서 대기 → DROP 뒤 명시적42703 실패, silent authority loss0.
3. 본 보고서: formal count2, lineage 및 증거 경계 갱신.

제품/control 전체 범위는 기존 exact21 그대로이며, 위3개 외 파일·control/history/checker/WI/lease는 수정하지 않았다. commit/push/acceptance/E05 및 Developer 외부 DB 실행은 0이다.

### R2 정확한 검증

`PY`는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`다.

| 단계 | 명령 | exit / 실제 결과 |
|---|---|---|
| RED | `PY -B -m pytest -q -p no:cacheprovider tests/persistence/test_dag_queue_e04.py -k downgrade_fences --tb=short` | 1 / **1 failed, 11 deselected**, 0.70s; advisory fence substring 부재 |
| focused GREEN | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue/test_dag_e04.py tests/api/test_task_graph_e04.py tests/persistence/test_dag_queue_e04.py tests/queue/test_durable_queue.py --tb=short` | 0 / **43 passed, 6 skipped**, 1.61s |
| related | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue tests/leases tests/agent_team tests/orchestration tests/persistence tests/api/test_task_graph_e04.py --tb=short` | 0 / **964 passed, 35 skipped**, 12.82s |
| frozen control regression | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E04StartControlTests tests/tooling/test_project_progress.py::E03StartControlTests --tb=short` | 0 / **6 passed**, 5.23s |
| checker | `PY -B scripts/check_project_progress.py` | 0 / **PASS sequence=1095 reporting=AUTO_CONTINUE** |
| compile | `PY -B -m compileall -q migrations/versions/0014_dag_queue.py tests/persistence/test_dag_queue_e04.py` | 0 |
| diff | `git diff --check` | 0 |

focused skip6 = Main 실제 PG 재실행용 기존2+신규 race3, 기존 B09 PG18 1이다. 로컬 skip을 실제 PG PASS로 올리지 않는다. 과거 Main의 R1 actual PG15 PASS는 그때의 두 테스트에만 유효하며 새 downgrade race 통과를 대신하지 않는다.

### 다음 조치 / 미검증 / rollback

Main이 동일 synthetic isolated PG15 harness에서 `tests/persistence/test_dag_queue_e04.py -k real_postgres` **5 tests**를 재실행한다. 신규3 race의 실제 잠금/실패/행·schema 보존과 기존2 회귀가 통과한 뒤 독립 재판정을 받아야 한다. 실제 PG18/공유 WSL DB 적용은 여전히 NOT_EXECUTED다.

Developer DB apply는 없으므로 DB rollback을 실행하지 않았다. R2 코드 rollback은 위3개 diff를 보존한 뒤 경로별 복구하되, 원래 취약 downgrade를 실제 DB에서 다시 실행하면 안 된다. 제품 acceptance/실제 downgrade 실행은 Main의 검증·판정 후이며 불필요한 live row 삭제나 공유 데이터 변경을 수행하지 않는다.

---

## R1 당시 판정 — Main 실제 PostgreSQL R1 재검증 결박(역사 기록)

**COMPLETED — Developer 구현·검증 결과, 독립 acceptance 전.** Main이 R1 수정 후 실제 격리 PostgreSQL15에서 queue scenario와 cursor-prefetch 원인 probe를 모두 통과시켰다. 이 증거로 직전 INCOMPLETE의 실제 DB 검증 미충족을 해소한다. Main acceptance/독립 Reviewer·Tester 판정은 자동 생성하지 않으며 E04 control 상태 및 E05 상태는 변경하지 않았다.

### 판단 이유: Main 제공 실제 실행 증거

- 증거 출처: **MAIN_ISOLATED_POSTGRES_R1_VERIFICATION**. Developer가 직접 실행한 결과로 표시하지 않는다.
- WSL-server의 고유 `anvil-e04-scratch-<random>` container, local cached image `pgvector/pgvector:0.8.2-pg15`, 임시 random credential, loopback-only random remote port와 SSH tunnel을 사용했다.
- 기존 자격증명/DB/볼륨 접근은 **0**. DSN scheme은 `postgresql+psycopg`이며 credential 값은 보고서에 기록하지 않는다.
- 기존 harness가 고유 `anvil_c01_l3_<uuid>` scratch DB 생성 → Alembic head 적용 → DB 제거를 수행했다. finally의 `docker rm -f`로 해당 임시 container를 제거했고 residue check 출력은 empty, 잔여 **0**이었다(Main 제공 증거).
- 전달된 실행 명령의 의미 표기는 다음과 같다. resolved binary 절대경로는 미제공이므로 임의로 채우지 않는다.

```text
python -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_dag_queue_e04.py -k real_postgres --tb=short
```

- **exit0, 2 passed / 6 deselected, 39.21s**.
- `test_real_postgres_atomic_dependency_visibility_quarantine`: 실제 DAG queue dependency, concurrent claim, visibility/redelivery/fence, completion replay, poison/quarantine, 미커밋 legacy claim의 독립 row claim, advisory conflict 뒤 free candidate 검증 PASS.
- `test_real_postgres_cursor_prefetch_minimal_behavior_probe`: 실제 두 connection에서 old query-FOR가 첫 RETURN 전에 여러 row를 잠그는 behavior와 bounded SELECT INTO가 한 candidate만 잠그는 behavior를 대조하여 PASS. R1 원인 가설을 실제 SQL behavior로 확인했다.
- 최초 psycopg2 driver 선택 시도 실패는 **환경/driver 오류**, formal product failure 제외. 이후 pre-R1 실제 queue test 실패는 `E04-PG-CURSOR-MULTIROW-LOCK-001`, **formal product failure count1**이다. R1 post-fix actual PASS로 해소했지만 실패 이력을 삭제하거나 count를 0으로 되돌리지 않는다.

### 조치·경계

- 이번 갱신은 본 보고서 **1개만** 수정했다. 제품/control 다른20개, 역사 이벤트, checker, lease, WI는 불변이다. 이전 R1 로컬 증거 focused42 PASS/3 SKIP, related963 PASS/32 SKIP, compile/diff PASS도 유지한다. 로컬 SKIP을 소급하여 PASS로 바꾸지 않고 Main의 별도 actual PG15 결과를 추가 결박한다.
- 실제 PG15 증거 범위는 위 isolated container/scratch DB와 두 테스트다. **PostgreSQL18, 공유 WSL 개발 DB apply, 기존 운영 데이터/volume 호환 검증은 NOT_EXECUTED**다. UI/HTTP wiring/worker·Provider 실행/배포 및 독립 acceptance도 미수행이다.
- 다음 안전 행동은 Main의 별도 독립 spec/quality 검토 및 acceptance다. Developer는 commit/push/E05를 수행하지 않았다.
- rollback: 실제 실행 환경의 scratch DB/container는 이미 정리됐다. 공유 DB apply가 없으므로 공유 DB rollback은 필요 없다. 제품 rollback은 기존 exact21 diff를 보존하고 Main이 경로별 승인 복구하며, R1 수정·실패·수정 후 실제 PASS 이력은 유지한다.

---

## R1 로컬 재작업 당시 판정 — formal failure count1 (위 actual 결과 전 기록)

**INCOMPLETE 유지.** Main의 실제 격리 PostgreSQL 실행에서 `E04-PG-CURSOR-MULTIROW-LOCK-001`이 확인되어 수정했다. 로컬 계약 GREEN은 확보했지만 수정 후 실제 DB 재실행/원인 behavior probe는 Main 담당이며 아직 결과를 받지 않았다. 다음의 R1 기록이 아래 최초 보고(R0)의 현재 상태·failure count·검증 수치를 대체한다. 기존 기록은 역사 증거로 보존한다.

### 판단 이유와 실제 실패 증거

- Main 제공 실제 환경: synthetic ephemeral pgvector/PostgreSQL15 container + SSH tunnel + `postgresql+psycopg`. 기존 DB/credential 사용0, scratch container 제거 완료(Main 보고).
- Main 실행의 전달된 명령 범위는 `pytest ... tests/persistence/test_dag_queue_e04.py -k real_postgres`이다. 전체 launcher/flags는 이 worker에게 미제공이므로 임의로 복원하지 않는다.
- migration head 적용은 성공했다. 이후 기존 테스트 line100의 `assert other['job_id'] ...`에서 `other['job_id'] is None`으로 실패했다. Main이 formal FAILURE_REPORT **count1**로 판정했다. Developer가 직접 외부 실행한 증거가 아니다.
- 코드 비교: B09는 단일 후보 `LIMIT 1` subquery였으나 E04 초안은 `FOR candidate IN SELECT ... FOR UPDATE SKIP LOCKED` query cursor였다. Main의 두 legacy row 모두 skip되는 실제 behavior와 query cursor가 최초 RETURN 전에 여러 행을 선취·잠그는 가설이 일치한다. **정확한 메커니즘 확정은 새 실제 SQL probe 결과 전까지 추론**으로 표시한다.
- `test_real_postgres_cursor_prefetch_minimal_behavior_probe`를 추가했다. 격리 scratch DB의 synthetic 두 행/두 connection에서 old query-FOR의 잔여 unlocked rows `[]`와 bounded SELECT INTO의 `[2]`를 대조한다. 새 probe는 Developer 환경에서 SKIPPED이며 아직 실제 PASS로 주장하지 않는다.

### 최소 수정 / 범위

이번 R1 수정은 다음 **3개 파일만**이다. 기존 exact21 범위와 dual lease/seq1095는 유지하며 control/history/checker 및 다른 제품 파일은 freeze했다.

1. `migrations/versions/0014_dag_queue.py`: implicit query-FOR cursor를 `LOOP` + `SELECT q.* INTO candidate ... FOR UPDATE SKIP LOCKED LIMIT 1`로 변경했다. 한 번의 후보 선택마다 한 행만 잠그며 `attempted_ids`로 advisory conflict 후보를 재선택하지 않고 다음 독립 후보를 탐색한다. 기존 dependency/input/hash/quarantine/fencing 및 group-lock 후 fresh conflict recheck는 유지했다.
2. `tests/persistence/test_dag_queue_e04.py`: bounded-selection SQL 계약 RED, 실제 최소 원인 probe, 기존 실제 PG 시나리오의 advisory-lock race 뒤 독립 free row claim을 추가했다. 단순 LIMIT1 후 조기 종료하여 독립 후보를 굶기는 회귀도 검증 대상으로 고정했다.
3. 본 보고서: R1 formal failure1 및 실제/로컬 증거 구분.

### R1 실행 명령·exit·결과

아래 `PY`는 정확히 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`다.

| 단계 | 명령 | exit / 실제 결과 |
|---|---|---|
| RED | `PY -B -m pytest -q -p no:cacheprovider tests/persistence/test_dag_queue_e04.py -k locks_one_candidate --tb=short` | 1 / **1 failed, 7 deselected**, 0.86s; query-FOR cursor 발견 |
| focused GREEN | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue/test_dag_e04.py tests/api/test_task_graph_e04.py tests/persistence/test_dag_queue_e04.py tests/queue/test_durable_queue.py --tb=short` | 0 / **42 passed, 3 skipped**, 2.07s |
| related | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue tests/leases tests/agent_team tests/orchestration tests/persistence tests/api/test_task_graph_e04.py --tb=short` | 0 / **963 passed, 32 skipped**, 14.76s |
| compile | `PY -B -m compileall -q migrations/versions/0014_dag_queue.py tests/persistence/test_dag_queue_e04.py` | 0 |
| diff | `git diff --check` | 0 |

focused skip3: Main 재실행용 실제 PG scenario/probe 2개 + 기존 B09 PG18 1개. related skip32도 DB 환경 의존 미실행이며 PASS로 승격하지 않는다. R1에서 Developer 외부 실행/공유 DB apply/Git mutation은 **0**이다. 테스트·원인 확인·증거 우선 스킬에 따라 SQL-contract GREEN과 실제 DB 수정 검증을 분리했다.

freeze 재확인: checker SHA256 `3AE72F0C9F35D4A0F367DDE724A534F85E8573D27F00D242D1D0A51B9F927E21`, events SHA256 `40C5C7C8E66F48381B30AC5EBBFB0A083C535BCB25B58822E6D1833FA58B2AA2` 불변. control checker의 직전 PASS 기록은 아래 보존하며 R1에서 새 control mutation/재물질화는 없었다.

### 정확한 다음 조치 / rollback

Main이 동일 isolated harness에서 `tests/persistence/test_dag_queue_e04.py -k real_postgres`의 **2 tests**를 실행한다. 최소 cursor probe로 원인을 확인하고 실제 claim scenario의 legacy 미커밋 독립 claim, advisory conflict 뒤 free row, dependency/visibility/idempotency/quarantine을 재검증한다. 이 결과 전에는 실제 수정 완료·acceptance·E05 진행을 주장하지 않는다.

rollback은 R1 세 파일 diff를 먼저 보존한 뒤 해당 수정만 되돌리는 경로별 복구다. Developer는 migration을 어느 DB에도 적용하지 않았다. Main의 이전 ephemeral 환경은 제거됐으므로 기존 DB 복구 작업은 없다. control/history 또는 다른 제품 파일을 rollback 대상으로 넓히지 않는다.

---

## 최초 보고 R0 — 당시 기록(현재 R1 내용은 위 참조)

## 1. 판정

**INCOMPLETE** — 구현과 로컬 계약 검증은 완료했으나, 계획상 실제 PostgreSQL DB-time atomic claim/visibility/quarantine 수락 증거가 미충족이다. Developer 결과는 Main acceptance가 아니다. E-04 IN_PROGRESS / E-05 NOT_READY를 유지한다.

- 기준 HEAD/local/upstream: `ac9e6f9686c8dfe01c694c1242b251eaa51c4c0f`.
- branch: `codex/c09-execution-backends-r1`; 작업 위치 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작 clean: Main 확인 및 worker read-only 재확인. private remote exact는 Main 확인(`MAIN_LIVE_REMOTE_READ`), worker 직접 원격 검증으로 표시하지 않는다.
- WI `WI-E-04-R1-20260917-001`: SHA256 `CADD68422BDD0CF7CB8214E3BAA4DB6F72B1DB6BC395BD047C2A7BAD8C36978D`.
- invocation SHA256 `1E2AD4CA5D42920E2D28B26CCC89A2E33304B014AF110F72E894686C78ABAFD2`.
- 권위: 계획 E-04, 설계 §47.5/§49.5, AV-AGT-033/AV-AGT-037. 기존 E-02/E-03 ACCEPTED.
- canonical seq1095 checker PASS. seq1092 WI 발행 → 1093 worker lease → 1094 write lease → 1095 PACKAGE_STARTED. 역사 seq1~1091 raw event prefix 불변.
- worker `worker-lease-e04-r1-20260917-001`, execution token `e04-r1-execution-fence-epoch-1-ac9e6f9686c8dfe0`.
- write `write-lease-e04-r1-20260917-001`, write token `e04-r1-write-fence-epoch-1-1c694c1242b251ea`.
- lease 2026-09-17 11:55~23:55 KST ACTIVE, pending approvals 없음. commit/push/수락/lease 회수는 수행하지 않았다.

## 2. 판단 이유

### 실제 구현 및 계약 증거

- 기존 `DependencyGraph`, B09 `QueueJob`/`QueueClaim`/`DurableQueue`, 기존 PostgreSQL queue table/function 소유권을 재사용했다. 새로운 queue owner/table은 만들지 않았다.
- immutable DAG identity/hash, cycle/self-cycle/unknown dependency/duplicate node 거부, exact input hash 검사, registration rebind 및 retry-budget rebind 거부를 구현했다.
- dependency 성공 전 claim 차단, 비독립 작업 SINGLE_WORKER 축소, case-insensitive conflict identity와 cross-run conflict 직렬화, 동시 claim 원자성, visibility redelivery와 새 epoch/token, stale completion 차단, completion 멱등성, poison quarantine 및 descendant 차단을 검증했다.
- 인메모리 큐 RLock은 **단위 계약 증거**다. 실제 DB-time 원자성의 대체 증거로 사용하지 않는다.
- `0014_dag_queue.py`는 기존 queue table에 nullable graph identity/hash, 기본 empty dependency/conflict arrays, default-true input flag, completion token checksum을 추가한다. 기존 row/default 및 함수 signature를 보존한다.
- claim은 PostgreSQL `CURRENT_TIMESTAMP`, `FOR UPDATE SKIP LOCKED`, conflict-group별 `pg_try_advisory_xact_lock` 및 잠금 후 fresh conflict 검사로 구성했다. global blocking claim lock은 RED 보강 후 제거했다. legacy B09의 미커밋 claim과 다른 row claim 간 nonblocking 계약을 보존하도록 실제 DB 테스트를 작성했다.
- DB adapter는 host 제공 engine의 transaction을 사용하며 worker clock 인자를 받지 않는다. registration fault-injection은 adapter transaction 계약만 검증했다.
- graph projection API는 host-bound run의 read-only projection이며 payload/실행 token을 노출하지 않는다. 실제 HTTP wiring 또는 worker launch는 없다.
- E03 Minor1: ExternalVerifierAdapter/ExternalVerificationError/ManualImportAuthorization을 `__all__`에 추가했다. Minor2: frozen seq1084 함수와 역사 bytes를 수정하지 않고 additive `e04_predecessor_status` 및 E04 successor status를 분리했다.

### RED → GREEN 및 정확한 실행 명령

아래 `PY` 표기는 모든 worker 실행에서 정확히 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`다. shell cwd는 위 canonical worktree다.

| 단계 | 정확한 명령(PY만 위 절대경로로 치환) | exit / 실제 결과 |
|---|---|---|
| control RED | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E04StartControlTests --tb=short` | 1 / 3 failed, start/git guard/additive correction 미구현 |
| control 첫 GREEN | 동일 명령 | 0 / 3 passed, 19.11s |
| 제품 RED | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue/test_dag_e04.py tests/api/test_task_graph_e04.py tests/persistence/test_dag_queue_e04.py --tb=short` | 1 / collection error 2, 신규 DAG/API 모듈 부재 |
| 첫 focused GREEN | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue/test_dag_e04.py tests/api/test_task_graph_e04.py tests/persistence/test_dag_queue_e04.py tests/queue/test_durable_queue.py --tb=short` | 0 / 34 passed, 2 skipped, 2.39s |
| nonblocking 보강 RED | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_dag_queue_e04.py --tb=short` | 1 / 1 failed, 4 passed, 1 skipped; group-scoped nonblocking lock 부재 |
| retry budget RED | `PY -B -m pytest -q -p no:cacheprovider tests/queue/test_dag_e04.py -k retry_budget --tb=short` | 1 / 1 failed, 23 deselected; retry-budget rebind 미거부 |
| 최신 focused | 첫 focused GREEN과 같은 명령 | 0 / **41 passed, 2 skipped**, 2.56s |
| 관련 회귀 | `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/queue tests/leases tests/agent_team tests/orchestration tests/persistence tests/api/test_task_graph_e04.py --tb=short` | 0 / **962 passed, 31 skipped**, 15.57s |
| 역사 복원 단독 | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E04StartControlTests::test_e04_preserves_historical_embedded_checker_evidence --tb=short` | 0 / 1 passed, 1.27s |
| 복원 후 control 회귀 | `PY -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E04StartControlTests tests/tooling/test_project_progress.py::E03StartControlTests --tb=short` | 0 / **6 passed**, 20.23s |
| canonical | `PY -B scripts/check_project_progress.py` | 0 / `PASS sequence=1095 reporting=AUTO_CONTINUE` |
| control compile | `PY -B -m compileall -q scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0 |
| diff | `git diff --check` | 0 |
| checker diff | `git diff --numstat -- scripts/check_project_progress.py` | 0 / **160 insertions, 0 deletions** |
| stage 확인 | `git diff --cached --name-only` | 0 / empty |

제품 정적 검사의 정확한 명령(exit0):

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/queue/models.py packages/queue/service.py packages/queue/dag.py packages/persistence/dag_queue_repository.py packages/api/task_graph.py migrations/versions/0014_dag_queue.py tests/queue/test_dag_e04.py tests/persistence/test_dag_queue_e04.py tests/api/test_task_graph_e04.py tests/queue/test_durable_queue.py
```

focused skip2는 E04 `ANVIL_TEST_DATABASE_URL` 부재와 기존 B09 `ANVIL_B09_PG18_DSN` 부재다. 관련 회귀 skip31은 실제 DB 환경 의존 항목이며 PASS가 아니다. 실제 공유 WSL DB migration apply는 **0**이다.

### 편집 incident와 복구 증거

정식 제품 failure **0**. 계획된 RED/내부 재시도/환경 skip은 formal failure로 세지 않는다.

1. `E04-CONTROL-EDIT-C03-001`, incident1: 최종 diff 감사에서 checker C03 embedded base64의 의도하지 않은 삭제 195줄을 발견했다. exact HEAD 구간을 apply_patch로 복원했고 역사 삭제 diff0을 확인했다.
2. incident2: 작은 후속 checker note patch 과정에서 fs sandbox helper encode/decode 오류가 있었고 재시도 뒤 C21/C01/C02/C03 역사 구간이 축약되어 SyntaxError가 발생했다. 파일 쓰기를 중단하고 Main에 즉시 보고했다. 구체적인 도구 내부 원인은 미확정이다. 큰 파일 편집이 위험 경계임을 확인했으며 제품 파일이나 event stream 손상은 발견되지 않았다.

Main 승인으로 **checker 한 파일만** bulk mechanical restoration을 수행했다. HEAD 원문 bytes에 검증된 routing 10줄과 EOF 150줄만 삽입하고, 임시 sibling 파일에서 hash/ast/compile/보호파일 비교를 마친 후 `os.replace`했다. 임의 Git reset/checkout/stash는 사용하지 않았다.

- HEAD checker SHA256: `D81A81B03EE5BD4230426FE2174DF17BF9B941C0F6159B50C006CF2D9C759A85`.
- preserved EOF block: **14,204 bytes / 150 lines**, SHA256 `74AF6F60E782E03AF3D73FA64D6923EEE3FE99198B3579FC6DA139ABF1B035B6`.
- intended unified patch: **16,471 bytes**, SHA256 `3EDB7E870EBC013949C87E9C8AEA2AA24069511753B2F21EB0C34CA01C9E74FA`.
- restored checker SHA256: `3AE72F0C9F35D4A0F367DDE724A534F85E8573D27F00D242D1D0A51B9F927E21`; numstat160/0, ast/compile PASS.
- 보호된 packages/tests/progress 파일 **687개**가 one-shot 전후 byte-identical. 역사 embedded evidence equality 단독 및 control 회귀 PASS.
- canonical builder의 재물질화 전 current/expected checksum을 기록했다. progress 및 events는 같아서 쓰지 않았고 HANDOFF/digest/manifest 3개만 checksum/note 동기화했다.
- event bytes SHA256 전후 `40C5C7C8E66F48381B30AC5EBBFB0A083C535BCB25B58822E6D1833FA58B2AA2`.
- progress SHA256 전후 `0A345AA6C87B6560B38784DEFC7A3B1196B129510C203311DF9192E295DDA770`.
- 동기화 후 HANDOFF `A73CFA38D867378EB8814FDF9267ADA0EBADC51E8451CB143F5AEBEDC517ECE8`, detached digest `5127E396AA1E25919423E2C2D457CE021EBBEC2DC751B6014683C8BDDD5471E5`, manifest `C5C5DC9D9D6364A26A2F2A45ED47E51DB565337D667E986FACB385BFE0DB00C0`.

별도 사소한 도구 오류: patch 생성 stdout의 cp949 UnicodeEncodeError 1회는 파일 write 전 발생했고 PYTHONIOENCODING=utf-8로 해결했다. formal failure 제외.

## 3. 조치·변경 경로 exact21

제품 exact12:

1. `packages/agent_team/__init__.py` — E03 export follow-up 3 symbols.
2. `packages/queue/models.py` — backward-compatible optional DAG queue fields.
3. `packages/queue/service.py` — atomic reference claim, dependency/conflict gates, completion replay.
4. `packages/queue/dag.py` — DAG validation/publication/projection facade.
5. `packages/persistence/dag_queue_repository.py` — 기존 PostgreSQL queue owner transaction adapter.
6. `packages/api/task_graph.py` — read-only host/run-bound graph adapter.
7. `migrations/versions/0014_dag_queue.py` — additive schema/function upgrade 및 guarded downgrade.
8. `tests/queue/test_dag_e04.py` — DAG/adversarial/concurrency/alias tests.
9. `tests/persistence/test_dag_queue_e04.py` — SQL/transaction contract와 opt-in 격리 PostgreSQL 테스트.
10. `tests/api/test_task_graph_e04.py` — projection scope/read-only tests.
11. `tests/queue/test_durable_queue.py` — 기존 row 및 멱등 completion 호환 회귀.
12. `docs/04_test_reports/E-04_COMPLETION_REPORT.md` — 본 보고서.

control exact9:

1. `docs/work_orders/E-04_WORK_INSTRUCTION.md`
2. `docs/work_orders/E-04_INVOCATION_PROMPT.md`
3. `scripts/check_project_progress.py`
4. `tests/tooling/test_project_progress.py`
5. `docs/progress/build-progress.json`
6. `docs/progress/progress-events.json`
7. `docs/progress/BUILD_HANDOFF.md`
8. `docs/progress/progress-handoff-detached-digest-e04-start.json`
9. `docs/evidence/manifests/E-04_START_MANIFEST.json`

기존 migration0008 등 owner 파일은 불변이다. checker에는 허용 successor routing/helper **추가만** 남겼다. progress/HANDOFF는 승인된 start control만 반영하고 완료/수락 투영으로 변경하지 않았다. Main의 freeze 후 다른20개는 수정하지 않고 본 보고서1개만 추가한다.

### 미검증·잔여 위험

- 실제 PostgreSQL transaction/clock/row locking/advisory locking/upgrade/downgrade 실행: **NOT_EXECUTED**. SQL text/가짜 transaction 테스트로 대체하지 않는다. 실제 PG15/18 호환도 새 migration에 대해 미검증이다.
- 기존 `_scratch_database` harness를 재사용하는 통합 테스트는 작성했지만 DSN이 없다. 공유 개발 DB에 apply하거나 임의 DB endpoint/credential을 추정하지 않았다.
- 실제 Runs/Agents UI(U04/U08), HTTP wiring, worker/Provider launch, filesystem write lease 소비, 배포/외부 전송은 NOT_EXECUTED/NOT_INTEGRATED. queue reservation은 실행 권한이나 Step/Main acceptance가 아니다.
- 별도 독립 Reviewer/Tester 수락 판정은 미수행. 전체 tooling suite를 PASS로 주장하지 않으며 명시한 focused control만 검증했다.
- B09의 기존 retry availability/failure 정책은 보존한다. E05 실제 병렬 worker 실행을 이 구현으로 주장하지 않는다.

### 정확한 다음 안전 행동

Main이 승인된 **격리 PostgreSQL** 접속 환경을 제공한 뒤 `tests/persistence/test_dag_queue_e04.py::test_real_postgres_atomic_dependency_visibility_quarantine`을 실제 실행하고, 새 migration upgrade/guarded downgrade와 B09/B10 DB 회귀를 검증해야 한다. 그 후 독립 spec/quality 검토 및 Main acceptance를 수행한다. 이 전에는 E05 시작/수락/commit/push를 수행하지 않는다.

### rollback

현재 DB migration apply가 없으므로 DB rollback 실행은 필요 없다. Main이 exact21 dirty diff를 먼저 보존한 뒤 승인된 기준 HEAD와 본 package의 경로별 변경을 대조해 선택 복구한다. unrelated 파일/reset/clean/stash는 사용하지 않는다. 향후 migration이 실제 적용되면 DAG row가 남아 있는 downgrade는 `E04_DAG_ROWS_REQUIRE_EXPLICIT_ROLLBACK`으로 중단된다. 운영자가 먼저 별도 승인된 보존·drain 절차를 수행한 뒤 downgrade해야 하며 자동 데이터 삭제는 하지 않는다.
