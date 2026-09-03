# C-21/LR-02A Independent Test Report R1

- Reviewer: `/root/lr02a_independent_review`
- Reviewed baseline: `codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379` with LR-02A working-tree implementation
- Result: `FAILURE_REPORT`
- Fingerprint: `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`
- Blocking findings: 7
- External side effects: `NOT_EXECUTED`

## Blocking findings

1. `BOOTSTRAP_DEPLOY_ROOT_MISMATCH`: versioned bootstrap runs the target deploy script from a runtime temp path, while `deploy.sh` derives ROOT from `BASH_SOURCE`; the resulting root is `$HOME`, not `$HOME/deploy/anvil`.
2. `CANONICAL_SCRIPT_ROOT_AND_GUARD_ARGUMENT_MISMATCH`: `verify.sh` and `rollback.sh` derive `repo/repo`, and `verify.sh` calls `validate_release_manifest(repo, ref, expected)` with reversed arguments.
3. `FRESH_IMAGE_PRECHECK_AND_0013_RERUN_REJECTED`: migration precheck runs before the exact-SHA image exists and rejects an already-current 0013 database instead of treating it as a no-op.
4. `ROLLBACK_BASELINE_NOT_DURABLE`: same-SHA redeploy can overwrite `previous.sha`; rollback depends on deployment files from a prior commit that may not contain the canonical assets.
5. `CANONICAL_VERIFY_FALSE_POSITIVE`: verify omits UI/API/integrations/auth/SSE probes, readiness-body migration parsing, OCI revision verification, and bounded curl timeouts; current canonical tests are string checks rather than an executable fake-command harness.
6. `LR01_FROZEN_REPORT_OVERWRITTEN`: the LR-01 accepted report path was overwritten from frozen SHA-256 `F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB` to LR-02A content SHA-256 `79BAA7A78523065DFE0D8EFE79209A79CF5C31D1A67B3FB5ECFBE477C4984165`.
7. `DRAFT_APPROVAL_STATE_CONTRADICTION`: the draft is marked not approved at the top but still contains an approved deployment status and no required approval.

## Independent checks

- Canonical/API static contract: `21 passed`.
- Task/Run/SSE/local-session/API regression: `54 passed`.
- Alembic head: `0013_task_bootstrap_authority`.
- Shell syntax and `git diff --check`: PASS.
- Project progress checker: `PRG_REFERENCED_HASH_MISMATCH`.
- A wider fixture run had 18 setup interruptions caused by sandbox temp-path permissions; these were not classified as product failures.

## Required R2 correction

- Restore the LR-01 report byte-for-byte from the accepted checkpoint and use a unique LR-02A progress report path.
- Pass an explicit canonical deploy root through the versioned bootstrap; correct verify/rollback root and manifest-guard arguments.
- Build the exact-SHA image once before database inspection; accept 0012→0013 upgrade and same-0013 no-op, reject every other head.
- Preserve a durable previous release and versioned rollback assets across same-SHA retries.
- Execute canonical scripts through a fake-command harness and verify public UI/API/integrations/auth/SSE, readiness migration head, OCI revision, and timeouts.
- Make every draft approval field consistently `NOT_APPROVED`/required.

No file mutation, commit, push, deployment, DB/NPM/DNS/secret/Telegram/Provider call, or container removal was performed by the reviewer.
