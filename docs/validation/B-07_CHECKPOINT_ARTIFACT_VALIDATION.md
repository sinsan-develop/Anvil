# B-07 Checkpoint, Artifact Store, and EvidenceManifest Validation

## Binding and scope

- Work Package: `B-07`
- WorkInstruction: `WI-B-07-20260815-001`
- WorkInstruction SHA-256: `4809891FD6EADFB7CD5A147D879257FC61C3AD7D20B63081814DF46F59E0741F`
- Invocation SHA-256: `E5F71C33D8909AF2D662D08EC5C68EA55C5825DBA40E019000BAD766B98B6A4E`
- Start sequence/status: `271 / B-07 ACTIVE`
- Developer baseline: `HEAD=origin/main=2d100b157aedc36da8a78341bbe67085c1663236`, clean before mutation
- Dispatch base recorded by the WorkInstruction: `1a9c25b7ce2c257d40aaa10fcf3a0478f654db93`
- Worker/write lease: epoch 1, exact B-07 fencing tokens and exact 15-path allowlist verified
- Assigned verification: `AV-STAT-010`

Only the WorkInstruction exact 15 paths were written. B-01 through B-06 sources, progress/HANDOFF, checkers, dependencies/configuration, Git refs/index, applications, API routes, and deployment files were not modified.

## TDD evidence

The three required test modules were created before production implementation. Each was executed independently and produced exit 1 because the new Artifact Store, EvidenceManifest, and Checkpoint modules did not exist:

- `python -m unittest tests.artifacts.test_artifact_store -v`
- `python -m unittest tests.artifacts.test_evidence_manifest -v`
- `python -m unittest tests.checkpoints.test_checkpoint_service -v`

The first focused implementation exposed two contract gaps: traversal input returned a missing-content error instead of a path-violation error, and one invalid-hash fixture failed during construction before the intended assertion. Lexical absolute/`..` rejection and the test fixture boundary were corrected. A second RED increment mutated caller-owned lists after model creation and produced three failures; copying them into tuples and recursively freezing mappings made the immutable boundary fail closed. Final focused execution passed all 14 tests.

## Implemented contracts

- Immutable artifact write/metadata models with canonical lowercase `sha256:<64 hex>`, nonnegative byte size, UTC timestamps, and copied lineage collections.
- Framework-neutral `ArtifactStore` Protocol and filesystem adapter using content-addressed `sha256/xx/digest` paths.
- Pre-write hash/size verification, safe identical-content deduplication, immutable collision rejection, lexical traversal rejection, resolved root/symlink escape rejection, and read-time content re-verification.
- Immutable EvidenceManifest contract covering design/plan/WorkInstruction/Git/delivered target/image/migration/config/policy/routing/environment/toolchain/commands/time/actor/acquisition/raw-checksum/skipped/unverified bindings.
- Manifest target/delivered/environment/raw agreement; malformed hash, duplicate/missing raw checksum, empty actor/environment, and self-reference rejection.
- Immutable Checkpoint request/result models preserving run/thread/schema versions, source Event sequence, next nodes, pending writes, state artifact/hash, binding hashes, actor, and creation time.
- Checkpoint service requiring a previously stored and byte-verified `CHECKPOINT_STATE` artifact for the same Run, an existing source Event, matching artifact hash, and a strictly increasing per-Run checkpoint Event sequence.
- Framework-neutral artifact/checkpoint repository Protocol with type-only imports to avoid circular runtime dependencies.
- Reversible `0006_checkpoint_artifacts` migration storing metadata and bindings only, with hash/ref checks, run/event/artifact/manifest foreign keys, append-only triggers, and a deferred at-least-one-raw-checksum constraint.

## Local verification results

- Artifacts/checkpoints focused: `14/14 PASS`.
- Domain: `14/14 PASS`.
- Design: `14/14 PASS`.
- Planning: `9/9 PASS`.
- Persistence: `7/7 PASS`.
- Execution: `11/11 PASS`.
- Events: `14/14 PASS`.
- Combined core regression: `69/69 PASS`.
- Python compile for all eight Python implementation paths and migration: PASS.
- Standalone persistence Protocol import: PASS.
- `git diff --check`: exit 0.

Tooling full execution ran 329 tests and reported 22 failures. They are not product-test PASS and were not suppressed:

- 16 `test_a13_repository_scan` failures: 15 frozen predecessor manifest validations reported the active-diff codes `EVIDENCE_ACTUAL_DIFF_MISMATCH`, `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, and `EVIDENCE_RAW_HASH_MISMATCH`; one predecessor successor-selection assertion returned no candidate because the live B-07 diff is outside that predecessor scope.
- 6 `test_project_progress` failures: only `GIT_DESCENDANT_WORKTREE_DIRTY`, expected while the authorized B-07 bytes are uncommitted.

## Isolated PostgreSQL 18 evidence

- Engine: PostgreSQL `18.4`, image `postgres:18-alpine`.
- Unique resources: container `anvil-b07-pg18-20260815-01`, network `anvil-b07-net-20260815-01`, loopback-only host port `55437`.
- Upgrade: Alembic `0005_event_store -> 0006_checkpoint_artifacts`; current revision `0006_checkpoint_artifacts`.
- Valid transaction: one metadata artifact, one Event-bound checkpoint, one manifest, and one raw checksum; counts `1:1:1:1`.
- Metadata-only check: forbidden artifact/checkpoint body/content/payload/log columns found `0`.
- Hostile cases all rejected with exit 1: hash/ref mismatch, immutable update, checkpoint hash mismatch, missing source Event, raw environment mismatch, raw self-reference, manifest target mismatch, deferred manifest-without-raw, and absent body column access.
- Post-hostile counts remained `1:1:1:1`.
- Downgrade: `0006_checkpoint_artifacts -> 0005_event_store`; artifact/checkpoint/manifest/raw tables and migration functions/triggers were absent as expected.
- Cleanup: the exact container and network were removed; filtered listings were blank.

A PowerShell parser incident occurred before the hostile SQL command was submitted, so it did not mutate the database. A later WSL transport error `0x8007274c` affected only a final count probe; an independent retry exited 0 and confirmed `1:1:1:1`. A cleanup work-directory typo failed before executing cleanup; the corrected cleanup and independent absence checks succeeded. These are environment/tooling incidents, not product failures.

## Runtime boundary and residual risk

Actual database validation is `PASS_ISOLATED_WSL_POSTGRESQL18_ONLY`. Actual API, UI, browser Network, provider, ysna-server, shared-db, production, and deployment are `NOT_EXECUTED`. Replay/fork/runtime orchestration, Release binding, HTTP mapping, BFF, and durable application integration belong to later Packages. The filesystem adapter is replaceable through its Protocol; object-storage behavior was not executed.

## Rollback

For an approved Anvil-isolated database at `0006_checkpoint_artifacts`, downgrade only to `0005_event_store`. Source rollback is limited to the exact B-07 file set after Main review. Never apply this rollback to shared-db, ysna-server, or production without a separately approved migration plan.
