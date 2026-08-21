# B-12 Independent Test Report

- Package: `B-12`
- Tester: implementation-conversation-separated independent Tester
- Tested commit: `main = origin/main = e29ffcfc6e401af43bdb2672fd0817252792d652`
- Tested projection: sequence `353`, `B-12 / TEST_REVIEW / PENDING`
- Result contract: `FAILURE_REPORT / REWORK_REQUIRED`
- Blocking finding count: `2`
- Write scope: this report only

## 1. 판정

### 판정

`FAILURE / REWORK_REQUIRED`

### 판단 이유

정적 recovery 분류, API 보안 경계, migration, fencing, concurrent receipt, Secret/capability 차단과 current/fresh 회귀는 통과했다. 그러나 B-12의 핵심 L6 완료조건인 실제 송신 경계 장애주입과 process 종료 뒤 durable DB·progress/HANDOFF 기반 새 Session 복구는 구현 또는 테스트된 증거가 아니다.

`FI-07` 테스트는 DB나 progress/HANDOFF를 사용하지 않는 `sleep(30)` subprocess를 종료한 뒤, 테스트 프로세스가 새 `InMemoryRecoveryRepository`를 생성하고 종료 후에 fixture를 다시 seed한다. 종료된 subprocess와 복구 입력 사이에 durable state 계보가 없다. 제품 persistence 모듈에도 `RecoveryRepository` Protocol과 `InMemoryRecoveryRepository`만 있고 PostgreSQL recovery load/save/audit adapter가 없다. PostgreSQL 테스트는 resume fencing 함수와 receipt serialization만 검증한다.

`FI-05/06` 테스트는 같은 `REQUEST_PREPARED`와 `REQUEST_SENT` 값을 파라미터 0~2로 세 번 pure function에 전달하며 마지막에 `fault_round in range(3)`만 확인한다. 실제 송신 직전/직후 subprocess 중단, Provider send counter, authoritative receipt lookup, automatic retry counter가 없다. 따라서 완료보고의 “provider sends 0 / automatic retries 0”은 독립 재현되지 않는다.

### 조치

아래 두 blocking lineage를 같은 B-12 범위에서 재작업해야 한다. Main acceptance, Phase B Gate, C-01 시작은 금지한다.

1. 실제 격리 PostgreSQL recovery repository를 통해 subprocess가 durable recovery input/Event/checkpoint를 기록한 뒤 종료되고, 새 프로세스가 같은 DB와 progress/HANDOFF sequence를 읽어 완료 Step skip, `RUNNING → INTERRUPTED`, 중단 Step만 안전 재개하는 FI-07을 최소 3회 수행한다.
2. FI-05/06을 실제 send boundary fault harness로 각각 최소 3회 수행하고 Provider send/automatic retry/authoritative receipt 조회 카운터로 중복 요청 0을 증명한다.

## 2. Authority와 frozen evidence

| 항목 | 독립 결과 |
|---|---|
| HEAD / origin/main / initial status | `e29ffcfc...` / equal / clean |
| progress | sequence `353`, `TEST_REVIEW`, worker/write lease `null` |
| WorkInstruction SHA-256 | `C588069F8F735DF32AC908F3E2F27F9BE5D2E6E18E0C2F67CBAF36202BA4C3EE` |
| Invocation SHA-256 | `3E2A28FECB4E0A64FDF30BDAD8E0D3DD9546E98F84F010C95924B18D8A41D7DF` |
| product manifest SHA-256 | `47543B6D41C57CEBAB7003478F76177B1B1F05B2C46868D156612908AA7E6D7E` |
| product projection | raw `14`, canonical bytes `1491`, content bytes `73787`, checksum mismatch `0` |
| product target | `7EE778EBA5A85C107C90BA94D7186297192BDB6358CFA4571363183FB2AF316C`, match |
| completion manifest SHA-256 | `0D535E483E000CAE239C16C88B6BAEB48ACE2B0ED75E9F5EDDAE095103B490B4` |
| completion projection | raw `12`, canonical bytes `1335`, content bytes `1181636`, checksum mismatch `0` |
| completion target | `03667710A82559FC0D305EE470976A4F895CBB1EC8F4D458216C5AF076213986`, match |

두 manifest의 `self_reference=false`, raw bytes, target은 current와 fresh clone에서 각각 독립 재계산해 동일했다. `git show --check e29ffc...`는 기존 세 경로의 `new blank line at EOF`를 정확히 보고했다: `packages/persistence/recovery_repository.py:84`, `packages/recovery/read_model.py:37`, `tests/recovery/test_secret_capability_recovery.py:67`. Tester는 이를 수정하지 않았고 `git diff --check`는 clean checkout에서 exit `0`이었다.

## 3. Blocking findings

### BLK-B12-001-FI07-DURABLE-RECOVERY-DISCONNECTED

- Severity / verification: `CRITICAL / AV-STAT-038, AV-STAT-039, AV-OPS-005, AV-FLOW-010, AV-FLOW-011`
- Expected: 종료된 실제 subprocess가 사용하던 durable DB Event, progress/HANDOFF, checkpoint, Action 상태를 새 Session이 읽고 sequence 일치와 안전 재개를 증명한다.
- Actual: `_wait_for_termination()`은 `sleep(30)`만 수행한다. 종료 후 테스트 본문이 새 in-memory repository를 생성하고 `_input()`을 seed한다. PostgreSQL recovery adapter는 존재하지 않고 `tests/recovery`의 PostgreSQL 사용은 resume fencing/receipt 함수 한 건뿐이다.
- Impact: 실제 process/PC 종료 뒤 상태가 새 Session으로 복원된다는 B-12 핵심 완료조건을 제품이 수행한다는 증거가 없다. `RUNNING`을 durable `INTERRUPTED` Event/state로 바꾸는 구현도 없고 pure reconciliation에서 바로 `safe_retry`로 분류한다.
- Action: PostgreSQL recovery load/save/decision/audit 계층과 DB/progress/HANDOFF 동기화 harness를 구현하고, 종료 전후 동일 run/checkpoint/action lineage를 최소 3회 검증한다.

### BLK-B12-002-FI0506-NOT-ACTUAL-FAULT-INJECTION

- Severity / verification: `CRITICAL / AV-STAT-035, AV-STAT-036`
- Expected: 외부 요청 송신 직전과 송신 후 응답 직전을 각각 실제로 중단해 send 전 safe retry, send 후 authoritative receipt 조회 전 자동 retry 금지와 중복 요청 0을 증명한다.
- Actual: `test_before_send_is_safe_retry_but_after_send_without_receipt_requires_review`는 정적 enum 두 개의 분류를 세 번 반복한다. `fault_round`는 장애주입에 사용되지 않고 tautological range assertion에만 사용된다. Provider send, receipt lookup, retry counter와 종료 프로세스가 없다.
- Impact: 분류 규칙 unit test는 통과하지만 장애 경계의 중복 side effect 불변식은 검증되지 않았다.
- Action: 실제 fault harness와 authoritative receipt stub/counter를 추가해 FI-05/06 각각 3회 이상 재현하고 send/retry/duplicate 수를 보고한다.

## 4. 통과한 current/fresh 회귀

Fresh remote clone `C:\tmp\anvil-b12-independent-5d8b73c1`은 exact commit으로 생성했고 검증 후 resolved parent `C:\tmp`와 leaf를 확인해 제거했다.

| 검증 | current | fresh clone |
|---|---:|---:|
| focused recovery, DSN 미제공 | `20 passed, 1 skipped` | `20 passed, 1 skipped` |
| canonical core, `--import-mode=importlib` | `159 passed, 7 skipped` | `159 passed, 7 skipped` |
| full tooling | `427 passed` | `427 passed` |
| combined canonical | `586 passed, 7 skipped` | `586 passed, 7 skipped` |
| standalone A-13/project/G-07/Phase G | `4/4 PASS` | `4/4 PASS` |

Standalone 결과는 A-13 `fixtures=8 zero_delta=8 hostile=15`, project progress `sequence=353`, G-07 `packages=108 av=255 uncovered=0 scenarios=20`, Phase G `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`이다.

## 5. 실제 loopback HTTP

Uvicorn을 `127.0.0.1:8767`에서 실행해 다음 유효 요청을 확인했다.

- authenticated progress read: `200`, request ID 결박, target/evidence hash, checkpoint, next action 포함
- stale target reconcile: `409 RECOVERY_TARGET_HASH_MISMATCH`
- nominal reconcile: `200`, Event sequence `4`
- missing session: `401 AUTHENTICATION_REQUIRED`
- wrong permission scope: `403 PERMISSION_SCOPE_MISMATCH`

첫 POST 묶음은 Tester의 PowerShell `If-Match` quoting 오류로 curl URL parsing 경고와 HTTP 400을 만들었고 제품 판정에서 제외했다. 유효한 `If-Match: 4`로 재실행해 위 `409/200/403`을 얻었다. 종료 후 port `8767` listener는 없었다.

## 6. 격리 PostgreSQL 18

- image/runtime: `postgres:18-alpine`, PostgreSQL `18.4`
- container/network: `anvil-b12-independent-pg18-9231` / `anvil-b12-independent-net-9231`
- bind/tmpfs: `127.0.0.1:32789` / `/var/lib/postgresql=rw,noexec,nosuid,size=512m`
- database: `anvil_b12_test_9231`

실행 결과:

1. 최초 WSL resource inspect는 `E_ACCESSDENIED`였고 승인된 WSL/Docker 실행으로 재시도했다.
2. migration `0009_intervention_budget → 0010_recovery`가 통과했다.
3. DSN-focused recovery는 `21/21 PASS`였다.
4. stale worker token과 같은 conflict scope의 이전 write token은 `STALE_FENCING_TOKEN`으로 거부됐다.
5. 8 concurrent current resume는 모두 동일 checkpoint를 반환했고 immutable receipt row는 정확히 `1`개였다.
6. negative sequence, invalid Secret status, raw Secret value, invalid Action status, raw Secret audit의 hostile 5종은 named check constraint로 모두 거부됐다. hostile row는 `0`, canonical Secret reference는 유지됐다.
7. rollback `0010_recovery → 0009_intervention_budget`가 통과했고 recovery table/function은 `0/0`이었다.
8. 삭제 전 exact name/ID를 확인했고 container/network 제거 후 exact-name filter는 blank였다.

이 PASS는 migration, schema constraints와 resume fencing/receipt serialization만 증명한다. 위 blocking finding의 durable recovery repository와 process-linked FI-07을 대신하지 않는다.

## 7. 실행 경계, cleanup, rollback

- 실제 PC 전원 차단, 실제 브라우저/menu Network, actual Secret Broker/Provider, shared DB, WSL staging, ysna, production, deployment는 `NOT_EXECUTED`다.
- FI-07은 실제 subprocess terminate 3회였지만 종료 대상과 durable recovery state가 연결되지 않아 B-12 L6 PASS로 승격하지 않았다.
- Tester가 수정한 파일은 `docs/test_reports/B-12_INDEPENDENT_TEST_REPORT.md` 하나다.
- 제품, authority, WorkInstruction, progress/HANDOFF, manifests, Git index/refs, 기존 ACL residue는 수정하지 않았다.
- fresh clone, uvicorn process/port, PostgreSQL container/network는 모두 정리했다.
- acceptance, Phase B Gate, C-01, commit, push, deployment는 수행하지 않았다.

최종 결과: `FAILURE / REWORK_REQUIRED`, blocking finding `2`건.
