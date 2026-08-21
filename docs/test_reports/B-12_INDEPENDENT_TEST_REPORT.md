# B-12 R2 Independent Retest Report

- Package: `B-12`
- Retest revision: `R2`
- Tester: implementation-conversation-separated independent Tester
- Tested commit: `main = origin/main = bb43f22f4cdb53d2b972265bd1e5cd81e0fcd5fb`
- Tested projection: sequence `360`, `B-12 / TEST_REVIEW / PENDING_RETEST`
- Failure fingerprint: `B-12/DURABLE_PROCESS_RECOVERY_AND_ACTUAL_SEND_BOUNDARY_GAP`
- Result contract: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: this report only

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

R2는 `BLK-B12-001`과 `BLK-B12-002`를 실제 PostgreSQL-backed process recovery evidence로 닫았다. 독립 PostgreSQL 18 환경에서 FI-05·FI-06·FI-07을 각각 고유 Run 3개로 실행했다. 각 worker subprocess가 실제 boundary 상태를 commit한 뒤 강제 종료됐고, 새 Python process와 새 `PostgresRecoveryRepository`가 in-memory reseed 없이 동일 Run을 load·reconcile했다.

FI-07은 완료 Step 3개를 skip하고 `RUNNING → INTERRUPTED` 3개를 중단 Step으로만 재개했다. DB/progress/HANDOFF/Event/checkpoint sequence는 `3/3` 일치했고 process interruption/reconciliation audit도 각각 3개였다. FI-05는 send `0`, lookup `0`, retry intent `3`, duplicate `0`; FI-06은 send `3`, authoritative receipt lookup `3`, retry `0`, duplicate `0`이었다. 따라서 이전 두 CRITICAL finding은 `CLOSED`다.

current와 fresh clone의 회귀, 두 manifest raw target, 실제 loopback API, hostile lineage·Secret·capability 차단, stale worker/write fencing, 8-way concurrent immutable receipt와 migration rollback도 통과했다. 실행 범위 안에 남은 acceptance blocker는 없다.

### 조치

Main Agent는 이 보고서를 근거로 별도의 B-12 acceptance를 판단할 수 있다. 이 Tester는 B-12를 accept하거나 Phase B Gate/C-01을 시작하지 않았고 commit/push/deploy도 수행하지 않았다.

## 2. Authority, projection, manifests

| 항목 | 독립 결과 |
|---|---|
| HEAD / origin/main / initial status | `bb43f22f...` / equal / clean |
| progress | sequence `360`, `TEST_REVIEW / PENDING_RETEST`, leases `null` |
| R2 WorkInstruction SHA-256 | `476D2A7EAE064F25EDF479F3D66BB6F64DFAFFB38D49430BF26BD38E92A0BAB2` |
| R2 Invocation SHA-256 | `1B310073C8871C3F57B8065FF818BEB436DB0C66574DFF97D759133D930C09DC` |
| source R1 Tester report SHA-256 | `224CC87D40496A09765551A317413832039C4BDBA2B67C22AC37C6E05681AF91` |
| R2 product manifest SHA-256 | `2A4A944B08A3837D8774D4917A0C4E91F9DA3F5F7C16F55A2B893AC3FFEADDAA` |
| product projection | raw `9`, canonical bytes `978`, content bytes `86808`, checksum mismatch `0` |
| product target | `D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D`, match |
| R2 completion manifest SHA-256 | `2259C7D54868EE007E063A50FDFA79BE7C7DA89001298FD672F3AD541073041C` |
| completion projection | raw `14`, canonical bytes `1625`, content bytes `1211368`, checksum mismatch `0` |
| completion target | `55E3DDAA15A5B8D41BB6A20AF13902363E12C9E3B5BE3C2555DEC0964EC40397`, match |

두 manifest는 `self_reference=false`이며 current와 fresh clone에서 raw byte로 독립 재계산해 동일했다. `git diff --check`는 exit `0`이었다. 저장소의 기존 `.pytest_cache` ACL residue는 읽거나 수정·삭제하지 않았다.

## 3. Failure-lineage closure

### BLK-B12-001-FI07-DURABLE-RECOVERY-DISCONNECTED / CLOSED

- `PostgresRecoveryRepository`가 recovery Run, canonical Run Event, checkpoint artifact, plan Step, Action, decision, audit와 resume receipt를 실제 PostgreSQL lineage로 저장하고 새 process에서 load한다.
- FI-07 worker는 각 고유 Run에서 `RUNNING` boundary와 PID를 DB에 commit한 뒤 종료됐다. parent는 DB boundary count 도달을 확인한 뒤 process를 terminate했고 nonzero exit를 assertion했다.
- fresh recovery process는 종료 후 fixture seed 없이 같은 DSN과 Run ID로 load했다. persisted 결과는 완료 Action `SUCCESS 3`, 중단 Action `INTERRUPTED / interrupted_from_status=RUNNING 3`이었다.
- DB, progress, HANDOFF, canonical Run Event, checkpoint의 sequence는 세 Run 모두 exact 일치했다.
- persisted aggregate는 FI-07 Run `3`, interruption count 각 `1`, decision `3`, automatic retry intent `3`, duplicate `0`, `PROCESS_INTERRUPTED` audit `3`, `RECOVERY_RECONCILED` audit `3`이었다.
- 별도 replay process는 기존 decision/retry/audit를 중복 증가시키지 않았다.

### BLK-B12-002-FI0506-NOT-ACTUAL-FAULT-INJECTION / CLOSED

- FI-05와 FI-06 모두 Windows `spawn` worker가 PostgreSQL boundary를 commit한 조건을 parent가 polling한 뒤 실제 terminate했다. 그 뒤 별도 recovery process와 새 repository instance만 사용했다.
- FI-05 `BEFORE_SEND` 세 Run: interruption 각 `1`, send `0`, receipt lookup `0`, automatic retry intent 합계 `3`, duplicate request `0`, decision `3`.
- FI-06 `AFTER_SEND_BEFORE_RESPONSE` 세 Run: interruption 각 `1`, provider receipt row `3`, send 합계 `3`, authoritative receipt lookup 합계 `3`, automatic retry `0`, duplicate request `0`, decision `3`.
- FI-06 recovery는 receipt 기반 `confirmed_success`로 수렴하고 재송신하지 않았다. FI-05만 persisted safe-retry intent를 정확히 한 번 남겼다.

## 4. Current와 fresh-clone regression

Fresh remote clone `C:\tmp\anvil-b12-r2-independent-6a21f9d4`는 exact commit으로 생성했고 검증 뒤 resolved parent `C:\tmp`와 exact leaf를 확인해 제거했다.

| 검증 | current | fresh clone |
|---|---:|---:|
| recovery, DSN 미제공 | `17 passed, 13 skipped` | `17 passed, 13 skipped` |
| canonical core, `--import-mode=importlib` | `156 passed, 19 skipped` | `156 passed, 19 skipped` |
| full tooling | `435 passed` | `435 passed` |
| combined canonical | `591 passed, 19 skipped` | `591 passed, 19 skipped` |
| standalone A-13/project/G-07/Phase G | `4/4 PASS` | `4/4 PASS` |

Developer/Main handoff의 no-DSN `15` 및 PostgreSQL `28`보다 최종 committed tree에서는 각각 두 테스트가 더 수집돼 실제 값은 `17`과 `30`이었다. 결과를 축소하지 않고 최종 fresh 실행값을 기록한다.

Standalone 결과는 A-13 `fixtures=8 zero_delta=8 hostile=15`, project progress `sequence=360`, G-07 `packages=108 av=255 uncovered=0 scenarios=20`, Phase G `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`이다.

## 5. 격리 PostgreSQL 18

- Runtime: `postgres:18-alpine`, PostgreSQL `18.4`
- Container/network: `anvil-b12-r2-independent-pg18-9422` / `anvil-b12-r2-independent-net-9422`
- Bind/tmpfs: `127.0.0.1:32791` / `/var/lib/postgresql=rw,noexec,nosuid,size=512m`
- Database: `anvil_b12_r2_test_9422`
- shared DB / WSL staging / ysna / production: 미접근

검증 결과:

1. migration `0009_intervention_budget → 0010_recovery` 통과.
2. DSN recovery suite 최종 committed tree 기준 `30/30 PASS`.
3. FI-05/06/07 persisted process/counter/decision/audit 결과는 3절과 일치.
4. cross-Run checkpoint·Step lineage와 plaintext Secret은 fail-closed.
5. revoked Secret과 capability drift는 Provider send/retry 없이 지정된 blocked status로 수렴.
6. stale worker token과 동일 conflict scope의 stale write token은 `STALE_FENCING_TOKEN`.
7. 8 concurrent current resume는 동일 checkpoint를 반환하고 immutable receipt row `1`개.
8. rollback `0010_recovery → 0009_intervention_budget` 통과; recovery table/function `0/0`.
9. 삭제 전 exact container/network name과 ID를 확인했고 제거 후 exact-name filter는 blank.

## 6. 실제 loopback API

Uvicorn을 `127.0.0.1:8768`에서 실행해 다음을 확인했다.

- authenticated progress read: `200`, target/evidence hash, checkpoint, next action과 request ID
- stale target reconcile: `409 RECOVERY_TARGET_HASH_MISMATCH`
- nominal reconcile: `200`, Event sequence `4`
- missing session: `401 AUTHENTICATION_REQUIRED`
- wrong permission scope: `403 PERMISSION_SCOPE_MISMATCH`

종료 후 port `8768` listener는 없었다. 이는 actual HTTP evidence이며 실제 browser/menu Network evidence로 승격하지 않는다.

## 7. 실행 경계, cleanup, rollback

- 실제 PC power-off, 실제 browser/menu Network, actual Provider/Secret Broker, shared DB, WSL staging, ysna, production, deployment는 `NOT_EXECUTED`다.
- 실행한 FI-05/06/07은 실제 subprocess termination이지만 실제 PC 전원 차단으로 주장하지 않는다.
- Tester가 교체한 파일은 `docs/test_reports/B-12_INDEPENDENT_TEST_REPORT.md` 하나다.
- 제품, authority, WorkInstruction, progress/HANDOFF, manifests, Git index/refs와 기존 ACL residue는 수정하지 않았다.
- fresh clone, uvicorn process/port, PostgreSQL container/network는 모두 exact 경계 확인 후 정리했다.
- acceptance, Phase B Gate, C-01, commit, push, deployment는 수행하지 않았다.

최종 결과: `READY_FOR_MAIN_ACCEPTANCE`, blocking finding `0`건.
