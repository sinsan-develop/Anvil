# B-12 R2 Durable Process Recovery Validation

## Authority and boundary

- WorkInstruction: `WI-B-12-20260821-002`, SHA-256 `476D2A7EAE064F25EDF479F3D66BB6F64DFAFFB38D49430BF26BD38E92A0BAB2`.
- Invocation SHA-256: `1B310073C8871C3F57B8065FF818BEB436DB0C66574DFF97D759133D930C09DC`.
- Source Tester report SHA-256: `224CC87D40496A09765551A317413832039C4BDBA2B67C22AC37C6E05681AF91`.
- Failure fingerprint: `B-12/DURABLE_PROCESS_RECOVERY_AND_ACTUAL_SEND_BOUNDARY_GAP`.
- Start: `main=origin/main=3bc5e3194d848dbaa1b85a8d55ab51e1d410a9e0`, clean, progress sequence `357`, `ACTIVE_REWORK`.
- Lease: epoch-2 execution token `b12-execution-fence-epoch-2-e29ffcf`, write token `b12-write-fence-epoch-2-e29ffcf`.

Developer exact10만 수정했다. progress/HANDOFF, authority, checker, Git index/ref, commit/push, B-12 acceptance, B Gate, C-01, shared DB, WSL staging, ysna, production, deployment은 수정 또는 실행하지 않았다.

## TDD RED and implementation

`PYTHONPATH=.`에서 다음 focused collection은 production 변경 전에 `PostgresRecoveryRepository` import 부재로 2 errors/exit 2 RED였다.

```text
uv run pytest tests/recovery/test_process_resume.py tests/recovery/test_action_reconcile.py -q
```

R2 최소 구현은 다음 durable 경계를 추가했다.

- PostgreSQL adapter가 Run, append-only Event, checkpoint artifact, plan Step, Action, recovery input/decision/audit를 하나의 lineage로 저장하고 새 process/repository instance에서 다시 load한다.
- `recovery_runs`는 실제 process 상태/PID/interruption count를, Action은 `INTERRUPTED` 이전 상태와 boundary/send/receipt lookup/automatic retry/duplicate counters를 저장한다.
- provider send receipt는 idempotency key당 한 행이며 response 처리 전 process가 종료되어도 fresh recovery process가 receipt를 조회해 재송신 없이 성공으로 수렴한다.
- automatic retry intent는 `(run, action, evidence hash)` immutable receipt로 exact replay 시 한 번만 기록된다.
- checkpoint와 Step의 cross-Run 결박은 PostgreSQL trigger가 거부한다.
- resume commit은 최신 worker/write epoch와 두 token을 모두 검증하고 exact current replay를 한 receipt로 직렬화한다.
- revoked/expired Secret과 capability drift는 send/retry 전에 fail-closed이며 Secret 값은 읽거나 저장하지 않는다.

## Actual subprocess fault injection

모든 fault case는 Windows `spawn`으로 별도 Python worker를 실행했다. parent는 worker가 동일 PostgreSQL에 boundary/counter를 commit한 조건을 polling한 후 `terminate()`하고 nonzero exit를 확인했다. 그 뒤 별도 fresh Python recovery process와 새 repository instance만 사용했다. 종료 뒤 in-memory reseed는 없으며 sleep-only process를 recovery 증거로 사용하지 않았다.

- FI-07, 3 rounds: worker가 `RUNNING` boundary를 commit한 뒤 종료됐다. fresh process가 `RUNNING -> INTERRUPTED`와 interruption audit를 저장하고 completed Step은 skip, interrupted Step만 resumable로 결정했다. replay process의 interruption/retry/audit counters는 증가하지 않았다.
- FI-05, 3 rounds: `REQUEST_PREPARED / BEFORE_SEND` commit 뒤 종료됐다. persisted `send=0`, `receipt_lookup=0`, `automatic_retry=1`, `duplicate=0`이고 safe retry로 결정됐다.
- FI-06, 3 rounds: provider receipt와 `send=1 / AFTER_SEND_BEFORE_RESPONSE`를 같은 transaction으로 commit한 뒤 종료됐다. fresh process가 authoritative receipt를 한 번 조회했고 `receipt_lookup=1`, `automatic_retry=0`, `duplicate=0`; Step은 confirmed success로 skip됐다.

Final actual PostgreSQL focused command:

```text
ANVIL_DATABASE_URL=postgresql+psycopg://...@127.0.0.1:32791/anvil_b12_r2
ANVIL_B12_TEST_DATABASE_URL=postgresql://...@127.0.0.1:32791/anvil_b12_r2
uv run alembic upgrade 0010_recovery
uv run pytest tests/recovery/test_process_resume.py tests/recovery/test_action_reconcile.py tests/recovery/test_recovery_api.py -q
```

Result: `28 passed in 17.60s`, exit `0`.

## PostgreSQL 18 migration, hostile, fencing, rollback

- Runtime: `postgres:18-alpine`, PostgreSQL `18.4`, container `anvil-b12-r2-pg18`, tmpfs `/var/lib/postgresql`, loopback-only `127.0.0.1:32791`, database `anvil_b12_r2`.
- Migration path `0009_intervention_budget -> 0010_recovery -> 0009_intervention_budget -> 0010_recovery` passed before final focused execution.
- Cross-Run checkpoint update and Step update raised `recovery lineage binding mismatch`.
- plaintext Secret reference update violated `ck_recovery_secret_reference_only`.
- revoked Secret and capability snapshot drift each produced the assigned blocked status with send/retry/duplicate counters `0`.
- stale worker token and stale same-conflict-scope write token raised `STALE_FENCING_TOKEN`.
- eight concurrent current adapter calls returned the same checkpoint and persisted one immutable resume receipt.
- Final rollback returned Alembic `0009_intervention_budget`; recovery tables `0`, recovery functions `0`.
- Exact container configuration was inspected before removal; removal returned `anvil-b12-r2-pg18` and the exact post-removal filter was blank.

## API/runtime and regressions

Actual loopback uvicorn on `127.0.0.1:8768` returned authenticated read `200`, stale target `409 RECOVERY_TARGET_HASH_MISMATCH`, nominal reconcile `200`, and unauthenticated read `401`. The uv wrapper and child server were stopped; `netstat` then reported `PORT_CLOSED`. This is actual HTTP evidence, not browser evidence.

- No-DSN focused: `15 passed, 13 skipped`, exit `0`; skips are explicitly DSN-gated.
- Canonical core: `156 passed, 19 skipped`, exit `0`.
- Full tooling: `427 passed, 4 failed`, exit `1`.
- Canonical combined: `583 passed, 19 skipped, 4 failed`, exit `1`.
- Compile/import and `git diff --check`: exit `0`.

Tooling/combined four failures are not promoted to PASS: three are the known Main-owned active dirty projection `GIT_DESCENDANT_WORKTREE_DIRTY`; one frozen A-13 copied hostile-manifest helper did not observe its copied tamper. Standalone A-13 checker passed `fixtures=8 zero_delta=8 hostile=15`; G-07 passed `packages=108 av=255 uncovered=0 scenarios=20`; Phase G passed `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`; project-progress returned the expected active dirty reason.

Actual PC power removal, browser/menu Network, real Provider/Secret Broker, shared DB, WSL staging, ysna, production, deployment, independent acceptance, B Gate, commit, and push remain `NOT_EXECUTED`. Rollback before Main integration is restoration of exact10 to start HEAD; DB rollback is authorized only in a dedicated database and was verified here.
