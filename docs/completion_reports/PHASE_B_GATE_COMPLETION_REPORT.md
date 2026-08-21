# Phase B Gate completion report — developer evidence submission

- status: `COMPLETED / IN_PROGRESS_NOT_ACCEPTED`
- WorkInstruction: `WI-PHASE-B-GATE-REWORK-20260821-003`
- WorkInstruction SHA-256: `7DBA454EBF87A8FAC80EB1D67EED1942A0389E61532A6925416C7A9CDE2862B2`
- Invocation SHA-256: `F396EF594D616FDF68881339ED7FD122CF8446865B0B64C32C4C02D09458B4EA`
- baseline: `165a9bfff5e085bfec322c748e83464477642f8a` on `main`
- current projection: sequence `371`, worker/write epoch `3`

## Delivered scope

The checker recalculates the approved selector as 51 slots / 50 defined / 44 direct / 6 deferred / 1 undefined. `AV-STAT-021/022/023/024/025/028` stay deferred; undefined `AV-STAT-029` is not promoted. It emits the required-evidence, severity, level, owner-package and honest execution boundary for each direct ID. B-12 historical acceptance is retained; C-01 remains `BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE`.

## Verification boundary

Focused tooling validates selector reconstruction, manifest raw checksums/target/content hash, the immutable B-12 sequence-361 acceptance event and its retained historical projection, and the distinct sequence-365, sequence-368 R2, and sequence-371 R3 active fencing projections. No API, DB, UI, browser, WSL, ysna-server, provider, deployment, or C-01 work was executed; all remain `NOT_EXECUTED`.

## TDD and executed commands

- RED: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_project_progress.ProjectProgressContractTests.test_phase_b_gate_active_projection_preserves_b12_history_and_blocks_c01 -v` → exit `1`, expected missing `validate_phase_b_gate_active_projection` assertion.
- RED: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_phase_b_gate.PhaseBGateTests.test_00_checker_exists -v` → exit `1`, expected missing checker assertion.
- GREEN: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_project_progress.ProjectProgressContractTests.test_b12_r2_completion_freezes_exact10_for_independent_retest tests.tooling.test_project_progress.ProjectProgressContractTests.test_b12_acceptance_closes_failure_and_blocks_c01_pending_b_gate tests.tooling.test_project_progress.ProjectProgressContractTests.test_phase_b_gate_active_projection_preserves_b12_history_and_blocks_c01 -v` → exit `0`, `3/3` passed.
- GREEN: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_phase_b_gate -v` → exit `0`, `4/4` passed.
- GREEN: `.venv\\Scripts\\python.exe scripts\\check_phase_b_gate.py` → exit `0`, `PASS (IN_PROGRESS_NOT_ACCEPTED)`.
- R2 GREEN: focused exact44/document/manifest-tamper tests plus active projection and B-12 historical acceptance-manifest test → exit `0`, `7/7` passed.
- R3 RED: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_phase_b_gate.PhaseBGateTests.test_documents_and_manifest_tampering_are_rejected tests.tooling.test_project_progress.ProjectProgressContractTests.test_b12_acceptance_closes_failure_and_blocks_c01_pending_b_gate -v` → exit `1`, `2` expected failures: missing completion deferred-six enforcement and the sequence-361 event tamper was bypassed at a later active sequence.
- R3 GREEN: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_phase_b_gate tests.tooling.test_project_progress.ProjectProgressContractTests.test_b12_acceptance_closes_failure_and_blocks_c01_pending_b_gate tests.tooling.test_project_progress.ProjectProgressContractTests.test_phase_b_gate_active_projection_preserves_b12_history_and_blocks_c01 -v` → exit `0`, `7/7` passed. This includes deferred-six removal rejection, raw-checksum tamper rejection, and an in-memory sequence-361 `event_type` tamper rejection.
- Current independent full progress suite after Main-owned projection/digest reconciliation: `.venv\\Scripts\\python.exe -m unittest tests.tooling.test_project_progress` → exit `1`, `81` run / `3` failed. The exact failures are `test_a03_completion_projection_revokes_leases_before_test_review`, `test_a03_start_projection_binds_clean_dispatch_and_fencing`, and `test_current_progress_handoff_and_registries_are_consistent`; all three report only `GIT_DESCENDANT_WORKTREE_DIRTY`, which reflects the authorized in-progress worktree. No result was masked or changed by this Package.

## Changed files

- Added: `scripts/check_phase_b_gate.py`, `tests/tooling/test_phase_b_gate.py`, validation, evidence manifest, and this report.
- Updated: `scripts/check_project_progress.py` and `tests/tooling/test_project_progress.py` to validate active R2/R3 projections separately while the B-12 acceptance manifest and sequence-361 event/historical projection checks remain active at every later sequence; no sequence-365 or `>=361` bypass remains.
- `git diff --check` exit `0`; no files outside the seven leased paths were modified by this Package.
- Commit, push, deployment, Gate `ACCEPTED` decision, and C-01 start: not performed.

## Artifact integrity and rollback

The manifest's raw provenance target is `sha256:82634F02055822F98393081F97EAF0364A73DA2F58CDFC41D97718AF133CB1D1` (2,077 canonical bytes / 168,204 content bytes); content hash is `sha256:9DB395C0481A2ABE8A1AE4DD727190D4F5076AE0C3F982897037A11AC3FEF1CC`. It excludes itself, and its content hash is derived with only `content_hash` omitted. Rollback removes only the seven Phase B Gate developer artifacts; it does not alter B-01~B-12 evidence, progress/HANDOFF/Event, approval, WorkInstruction, commit, or deployment state.

## Remaining concern

This is a developer evidence submission, not Gate acceptance. Independent review and Main-owned progress transition are still required; C-01 must not start.
