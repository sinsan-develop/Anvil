# B-08 Transactional Progress Outbox Validation

## Binding and scope

- Work Package: `B-08`
- WorkInstruction: `WI-B-08-20260815-001`
- WorkInstruction SHA-256: `655E40B3FE2C5834F3D7E143348DC99B411A2992A3381B3C45D6B36FB2AE2406`
- Invocation SHA-256: `4E7A0CF3AE60C154A8837E271526224310E4CC5B79E0D92450F8563E9BE0F0B3`
- Start sequence/status: `278 / B-08 ACTIVE`
- Developer baseline: `HEAD=origin/main=dfc92411bd7b4127623863c71aa7c30f3ccaf8be`, clean before mutation
- WorkInstruction base: `9913636f030aa248216f58e3251cfa181f491d9c`
- Worker/write fencing: epoch 1, `b08-execution-fence-epoch-1-9913636` / `b08-write-fence-epoch-1-9913636`
- Assigned verification: `AV-STAT-009`, `AV-STAT-011`, `AV-STAT-012`, `AV-STAT-013`

Only the exact 15 WorkInstruction paths were written. B-01 through B-07 sources and evidence, authority, progress/HANDOFF, checkers, dependency/configuration, Git refs/index, applications, API/UI, and deployment files were not modified.

## TDD evidence

The four required test files were written before product implementation. Separate discovery of `tests/outbox` and `tests/progress` failed with two import errors each because `packages.outbox` did not exist. This was the expected feature-absent RED, not a syntax or fixture error.

After minimal implementation, focused outbox tests exposed a contradictory assertion that compared the duplicate marker while also requiring it to change. Receipt identity was corrected to the stable outbox ID and canonical request hash; the duplicate marker remains true on replay.

A second test-first increment injected replace and snapshot/ack failures. It initially produced one failure and one error because the outbox remained `PENDING` and raw `OSError` escaped. The exporter now records `PERSISTENCE_ERROR`, increments retry count, withholds snapshot/ack, and reprocesses the same outbox.

Migration review found a reference to the not-yet-existing `projects` table. A focused static test was added and observed failing before correction. The migration now uses the existing predecessor schema: RUN owners retain the `runs.run_id` FK; PROJECT owners are checked against the project-bearing `tasks.project_id` rows until the canonical projects table arrives in its owning Package.

## Implemented contracts

- Immutable `ProgressExportRequest`, `OutboxReceipt`, `ProgressSnapshot`, owner and status enums, lowercase SHA-256 and UTC validation.
- Framework-neutral persistence Protocol with type-only imports and an in-memory reference repository that copies and rolls back Event/outbox state as one transaction.
- Canonical idempotency by request ID, owner-scoped idempotency key, owner/sequence and request hash. Conflicting owner, payload, repeated sequence, regression, and gap fail closed.
- Follow-up scheduling guard returns `PROGRESS_EXPORT_PENDING` until the exact owner/Event sequence has both a snapshot and acknowledged outbox.
- JSON progress and Markdown HANDOFF carry the same owner, Event sequence, status, last Event ID, next safe action and payload hash.
- Target-sibling temporary files, flush/fsync, checksum verification, same-filesystem `os.replace`, lexical/resolved root checks, traversal/symlink/file-alias rejection, and rollback of a partially replaced pair on handled failure.
- Ordered processing: transaction commit, paired file replace, snapshot record, outbox acknowledgement. A committed Event is never reported rolled back by a later filesystem failure.
- Retry of the same outbox after replace or snapshot/ack failure. Already replaced identical bytes are verified and safely acknowledged on retry.
- Reversible `0007_progress_outbox` migration with owner/sequence/hash/status/retry/export bindings, RUN and snapshot/outbox FKs, project-owner predecessor guard, uniqueness/check constraints, immutable history triggers, monotonic retry guard, and snapshot/outbox binding trigger.

## Local verification results

Commands used the bundled Python runtime at `C:\Users\cyhuh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

- Focused outbox: `6/6 PASS`.
- Focused progress/export/crash: `4/4 PASS`.
- Domain: `14/14 PASS`.
- Design: `14/14 PASS`.
- Planning: `9/9 PASS`.
- Persistence: `7/7 PASS`.
- Execution: `11/11 PASS`.
- Events: `14/14 PASS`.
- Artifacts: `10/10 PASS`.
- Checkpoints: `4/4 PASS`.
- Combined focused and core: `93/93 PASS`.
- Python compile for all implementation, migration and B-08 test paths: PASS.
- Standalone persistence Protocol import and runtime Protocol conformance: PASS.
- `git diff --check`: exit 0.
- Coverage: `NOT_EXECUTED`; the bundled runtime has no `coverage` module. Test success is not presented as a coverage percentage.
- Offline Alembic SQL generation: `NOT_EXECUTED`; the bundled runtime has no `alembic` module. Migration syntax was compiled, but this does not replace Alembic or PostgreSQL execution.

Tooling discovery ran 338 tests and reported 24 failures. It is not a PASS and was not suppressed:

- 18 `test_a13_repository_scan` failures are the authorized active-diff/frozen-predecessor family: `EVIDENCE_ACTUAL_DIFF_MISMATCH`, `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`, plus successor selection returning none while B-08 is uncommitted.
- 6 `test_project_progress` failures report only `GIT_DESCENDANT_WORKTREE_DIRTY`, expected while the authorized exact B-08 files are uncommitted.

## FI-01, FI-02, FI-03 raw result

Each crash point was executed three times with a unique temporary filesystem owner. All nine recovery subcases finished with one Event, one JSON file, one HANDOFF file, one snapshot, one acknowledged outbox, and follow-up scheduling allowed only after acknowledgement.

| Fault | Repetitions | State immediately after crash | Recovery result | Early scheduling |
|---|---:|---|---|---:|
| FI-01 DB commit after / replace before | 3 | committed Event + pending outbox; no snapshot/ack | same outbox reprocessed; sequence `1/1/1/1` | 0 |
| FI-02 paired replace during | 3 | pending outbox; handled partial replace restored | same outbox reprocessed; sequence `1/1/1/1` | 0 |
| FI-03 replace after / ack before | 3 | both valid files; no snapshot/ack | identical files verified; same outbox acknowledged | 0 |

An additional replace-error and snapshot/ack-error test verified `PERSISTENCE_ERROR`, retry increment, snapshot count 0, false ack 0, and final same-outbox acknowledgement after the injected error cleared.

## Isolated PostgreSQL 18 boundary

Actual PostgreSQL validation is `BLOCKED_NOT_EXECUTED`.

- The initial direct WSL availability probe failed before Docker or database access with WSL service `E_ACCESSDENIED`.
- The required escalation was rejected by the platform because the approval-review usage limit was exhausted. The rejection explicitly prohibited trying the same outcome through an indirect or workaround route.
- Therefore no B-08 container, network, port, database, role, schema, or data was created. `0006 -> 0007 -> 0006`, real constraint/hostile checks, real transaction crash points, and database cleanup verification were not executed.
- `shared-db`, `ysna-server`, production, and deployment were never contacted or modified.

The local migration compile and contract tests do not replace an actual PostgreSQL migration PASS. Independent acceptance must keep the database scope blocked until an approved isolated PostgreSQL 18 environment runs the migration, valid/hostile cases, downgrade and cleanup.

## Runtime boundary and residual risk

Actual local framework-neutral code and filesystem fault injection were executed. Actual PostgreSQL, API, UI/browser Network, provider, ysna/shared-db, production and deployment are `BLOCKED_NOT_EXECUTED` or `NOT_EXECUTED` as stated above. Durable SQL repository adapter integration, queue/Worker/write fencing, process/PC recovery orchestration, API/BFF/SSE and menu UI belong to later Packages.

The current project schema has no canonical `projects` table. The migration therefore validates PROJECT ownership against the existing `tasks.project_id` predecessor data and documents this temporary schema boundary; it does not invent the later Project aggregate.

## Rollback

Source rollback is limited to the exact B-08 file set after Main review. On an approved Anvil-isolated database at `0007_progress_outbox`, downgrade only to `0006_checkpoint_artifacts`. No database rollback was performed in this run because no database change occurred. Never run this migration or rollback against shared-db, ysna-server or production without a separately approved plan.
