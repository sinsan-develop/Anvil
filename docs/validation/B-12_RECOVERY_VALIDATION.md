# B-12 Process/PC Recovery Validation

## Authority and execution boundary

- WorkInstruction: `WI-B-12-20260821-001`, SHA-256 `C588069F8F735DF32AC908F3E2F27F9BE5D2E6E18E0C2F67CBAF36202BA4C3EE`.
- Invocation SHA-256: `3E2A28FECB4E0A64FDF30BDAD8E0D3DD9546E98F84F010C95924B18D8A41D7DF`.
- Start: `main=origin/main=26e2fcf1977d11c22ce81b400b3bf0696337d4ac`, clean. WorkInstruction product baseline is `370a39436c4b15a84483017583a9fe3878652504`.
- Lease: epoch 1 execution token `b12-execution-fence-epoch-1-370a394`, write token `b12-write-fence-epoch-1-370a394`, Developer exact15.
- Assigned verification: `AV-STAT-014/034/035/036/038/039`, `AV-OPS-005`, `AV-SAFE-031`, `AV-FLOW-010/011`.

Only exact15 was written. Authority, progress/HANDOFF, checkers, B-01~B-11 frozen artifacts, Git index/refs, B Gate, C-01, real Provider/Secret Broker, UI, shared DB, WSL staging, ysna, production, and deployment remained read-only or unexecuted.

## Implementation and security contract

The recovery module reads immutable DB/progress/HANDOFF sequences, checkpoint and target hashes, Action receipts, Git head, reference-only Secret version status, and capability snapshot bindings. Sequence disagreement returns `RECONCILIATION_REQUIRED` without overwriting either source. Completed Actions are `confirmed_success` and skipped; request-prepared Actions are `safe_retry`; sent-but-unconfirmed Actions are `manual_review` and cannot retry automatically.

Revoked/expired Secret versions block before secret read or provider call and append actor/time/reference-only audit data. Capability hash or required-capability drift blocks automatic fallback and returns `CREATE_NEW_RUN_OR_REPLAN`. Recovery API output omits the Secret reference and preserves B-11 Host, authentication, authoritative scope, CSRF, idempotency, optimistic version, target hash, permission-scope, error envelope, and request-ID contracts. A hostile target hash is rejected before recovery audit mutation.

Resume commits require current worker and same-conflict-scope write epochs and tokens. The in-memory repository and PostgreSQL function make exact current replay idempotent, reject previous worker/write tokens as `STALE_FENCING_TOKEN`, and serialize concurrent resume to one immutable receipt.

## TDD evidence

Production bytes were unchanged for the first four independent RED commands:

```text
C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/recovery/test_action_reconcile.py
C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/recovery/test_process_resume.py
C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/recovery/test_secret_capability_recovery.py
C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/recovery/test_recovery_api.py
```

Each failed during collection for the expected missing `packages.recovery` or `recovery_repository` implementation. Additional regression REDs reproduced:

- fresh uvicorn/import order: persistence-first import failed through a circular package export;
- invalid zero epoch/short fencing tokens were accepted;
- hostile recovery target hash recorded a revoked-Secret audit before returning 409;
- a previous same-scope write token tied to the current worker was accepted by PostgreSQL.

Minimal GREEN changes respectively added recovery models/service/read model/API/repository, lazy package export, fencing validation, pre-side-effect target/version guard, and same-scope maximum write-epoch enforcement.

## Fault injection and local results

- FI-05, request prepared before send: three independent rounds classified `safe_retry`, provider sends `0` before recovery.
- FI-06, request sent before response: three independent rounds classified `manual_review`, automatic retries `0`; authoritative success receipt changes classification to `confirmed_success` without retry.
- FI-07: three spawned subprocesses were terminated and joined with nonzero exit; each new recovery instance skipped the completed Step, selected only the interrupted Step, restored checkpoint/hash and Event sequence `12`.
- Sequence mismatch retained the original immutable input and returned `EVENT_SEQUENCE_MISMATCH`.
- Eight concurrent in-memory resume calls returned one immutable receipt.
- Focused without DSN: `20 passed, 1 PostgreSQL gate skipped`.
- Focused with isolated PostgreSQL 18 DSN: `21 passed`.
- Canonical B core including API/recovery: `159 passed, 7 DSN-gated skipped`.

Actual PC power removal was not performed. FI-07 evidence is explicitly subprocess termination simulation, not a real power-off claim.

## Isolated PostgreSQL 18 and rollback

Final verification used `postgres:18-alpine`, PostgreSQL `18.4`, tmpfs `/var/lib/postgresql`, unique network/container `anvil-b12-dev-net-822` / `anvil-b12-dev-pg18-822`, loopback-only `127.0.0.1:32775`, and database `anvil_b12_dev_822`.

- Migration: `0009_intervention_budget -> 0010_recovery`.
- Hostile worker epoch/token and same-conflict-scope write epoch/token calls raised `STALE_FENCING_TOKEN`.
- Eight concurrent current-token calls all returned `checkpoint-1`; `recovery_resume_receipts` count remained `1`.
- A non-reference Secret persistence attempt violated `ck_recovery_secret_reference_only`; the stored canonical row remained reference-only.
- Rollback: `0010_recovery -> 0009_intervention_budget`.
- Post-rollback: Alembic `0009_intervention_budget`, recovery tables `0`, `anvil_recovery_commit_resume` functions `0`.
- Exact container and network names were verified before deletion; post-removal exact filters were blank.

The earlier unique `821` instance established the initial migration/hostile/rollback path and was also removed. The final `822` pass includes the later same-scope stale-write regression.

## Actual loopback HTTP

Uvicorn served the same recovery app on `127.0.0.1:8767`; no TestClient response was used for this evidence.

- authenticated recovery read: HTTP 200, `req-runtime-read`, target/evidence hash, checkpoint and next action present;
- stale target reconcile: HTTP 409 `RECOVERY_TARGET_HASH_MISMATCH`;
- nominal reconcile: HTTP 200, `req-runtime-write`, Event sequence `4`;
- missing session: HTTP 401 `AUTHENTICATION_REQUIRED`;
- wrong permission scope: HTTP 403 `PERMISSION_SCOPE_MISMATCH`.

The process was stopped and port 8767 had no listener afterward. Actual browser/menu Network was not executed and is not promoted to PASS.

## Regression and limitations

- Full tooling: `419 passed, 4 failed`. Three failures are the expected active exact15 `GIT_DESCENDANT_WORKTREE_DIRTY` projection. One frozen A-13 hostile-manifest helper failed to observe its copied tamper, while the standalone A-13 checker on the actual tree passed `fixtures=8 zero_delta=8 hostile=15`; no checker or A-13 artifact was modified.
- Standalone G-07: `PASS packages=108 av=255 uncovered=0 scenarios=20`.
- Standalone Phase G Gate: `PASS accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`.
- Standalone project-progress: expected `GIT_DESCENDANT_WORKTREE_DIRTY` during authorized exact15 development.
- Compileall, public imports, `git diff --check`, exact-path comparison, and raw14 manifest recomputation are final freeze gates.

Executed results prove only framework-neutral local logic, subprocess fault simulation, actual loopback HTTP, and unique isolated PostgreSQL 18. Real PC power-off, browser/UI, actual Secret value read, Provider request, shared DB, WSL staging, ysna, production, deployment, B-12 independent acceptance, B Gate, commit, and push are `NOT_EXECUTED` by Developer.

Rollback before Main integration is restoration of exact15 to start HEAD and, only in a dedicated database, `0010_recovery -> 0009_intervention_budget`. No shared or production rollback is authorized.
