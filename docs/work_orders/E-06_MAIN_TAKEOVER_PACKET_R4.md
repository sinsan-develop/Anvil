# E-06 Main TakeoverPacket R4

- package: `E-06`
- trigger: `SAME_ROOT_CAUSE_BRANCH_IDENTITY_TOCTOU_3`
- predecessor: `039c53acd6d79895d3c94e1bc21b72d1b54283f9`
- predecessor sequence: `1113`
- developer status: `STOPPED`
- developer worker/write lease: `REVOKE_AND_REISSUE_TO_MAIN`
- executor: `main-agent-eoul`
- user direction: `Main takeover 승인` and `작업계획서 완료될때까지 다시는 요청하지마`
- interpretation: `ALLOW_E06_MAIN_DIRECT_TAKEOVER_WITHIN_APPROVED_PLAN`
- functional scope, requirements, material risk: `UNCHANGED`

## Preserved product snapshot

1. `packages/agent_team/__init__.py`
2. `packages/agent_team/worktree_writes.py`
3. `packages/leases/service.py`
4. `packages/tool_gateway/gateway.py`
5. `tests/agent_team/test_worktree_writes_e06.py`
6. `tests/leases/test_repository_write_e06.py`
7. `tests/tool_gateway/test_worktree_mutation_e06.py`
8. `docs/04_test_reports/E-06_COMPLETION_REPORT.md`

## Accepted failure lineage

1. R2: a direct HEAD kind or target change could redirect publication.
2. R3: an unchanged HEAD could traverse a later indirect symbolic-ref change and update a foreign ref.
3. R4: after Git acknowledged the prepared transaction commit and released its locks, an intermediate symbolic ref could be retargeted before the facade's post-check. The bound final ref was already advanced, but the facade returned failure without a receipt.

The third item is the third valid failure in the same branch-identity publication lineage. It therefore stops the Developer and activates Main direct takeover under the project three-failure rule.

## Main ruling and bounded correction

- Git `update-ref --stdin` response `commit: ok` is the publication linearization point.
- Before that point, all originally traversed symbolic hops and the final direct ref must remain locked, identical, and protected by the current dual fence.
- After that point, validation reads the originally bound final direct ref without following a newly redirected symbolic chain. If it contains the new commit, the operation publishes its immutable receipt and returns success.
- A later new request fails closed because the current HEAD chain no longer matches the binding. An exact retry may only return the already published immutable receipt.
- A bound final ref that does not contain the acknowledged new commit is `COMMIT_RECOVERY_REQUIRED`.

Main changes only the preserved product scope plus this control packet and canonical progress evidence. E-07/E-08/E-10 behavior, merge, source application, Provider, deployment, and durable process-crash recovery remain outside this correction.

## Main review corrections after takeover

The first Main correction exposed two additional in-scope review findings. They do not return ownership to the stopped Developer.

- `E06-BOUND-FINAL-COMPENSATION`: a receipt-publication exception after an acknowledged commit could inspect the newly redirected HEAD chain and miss the already advanced bound final ref. A direct non-transactional rollback could also replace a same-object symbolic identity. Main now restores only through a prepared no-deref transaction, verifies the exact final lock plus direct kind/OID while locked, and otherwise reports `COMMIT_RECOVERY_REQUIRED` without replacing the foreign identity.
- `E06-GIT-STORE-PHYSICAL-CONFINEMENT`: cwd-based Git discovery and later object-directory/fanout replacement could send object writes to another repository. All post-acquire Git commands now bind the registered per-worktree git-dir and managed common-dir. The object root and all 256 loose-object fanout directories are physically verified; on Windows their handles allow child writes but prevent replacement, and every identity is rechecked after handle acquisition before an object writer runs.

These corrections keep the functional scope unchanged. Windows local Git/filesystem behavior is independently reviewed; DB UTC/multiprocess, WSL, process-crash durability, Provider, HTTP/UI, deployment, and production remain unverified or not integrated as stated in the E-06 report.
