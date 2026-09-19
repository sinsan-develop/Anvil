# C-22 WorkInstruction — Five Role Contracts and Agent Team Domain

## Scope

Implement the approved v2.8/v1.7 C-22 contract only. Extend the existing E-01 role-policy/result-envelope foundation to cover Planning, Code, Review, Test, and Deploy as first-class roles. Preserve existing E-01/C-01~C-15 behavior and historical evidence.

## Required contract

- `AgentDefinition` identifies exactly one of `PLANNING|CODE|REVIEW|TEST|DEPLOY`.
- Each role declares input/output contract, allowed tools/actions/paths, prohibited actions, handoff target, error/failure contract, completion evidence, and human-approval boundary.
- Main Agent owns management/judgment/coordination/final synthesis. CODE is the only product-file writer; one active write lease is required. REVIEW and TEST are read-only except the already-approved test-evidence path. DEPLOY is preparation/verification/monitoring only; no Oracle/production mutation.
- `RoleEnvelope` and `ResultEnvelope` preserve actor/role/task/parent trace, baseline/target hash, artifact/evidence references, status, unverified scope, rollback, cost/latency and provenance.
- Invalid role/action/tool/path, missing fencing/write lease, cross-role authority escalation, missing evidence, and approval-boundary violations fail closed with stable reason codes.

## TDD and verification

1. RED: add focused tests for all five role definitions, prohibited actions, CODE single-writer fencing, Deploy no-Oracle rule, required result fields, parent/child trace and deterministic contract hash.
2. GREEN: implement the smallest extension in existing `packages/agent_team` contracts; no new provider, transport, DB, migration, UI, deploy, or secret behavior.
3. Run focused C-22 tests, related `tests/agent_team` regression, `git diff --check`, and compile. Report actual exit codes and unverified scope. No WSL/DB/Provider/Oracle execution in this package.

## Allowed paths

- `packages/agent_team/role_contracts.py`
- `packages/agent_team/role_results.py`
- `packages/agent_team/__init__.py` only for public exports
- `tests/agent_team/test_role_contracts_c22.py`
- `tests/agent_team/test_role_results_c22.py`
- `docs/04_test_reports/C-22_COMPLETION_REPORT.md`

Do not modify other product paths, progress history, historical reports, migrations, UI, provider adapters, or deployment files. Do not commit, push, merge, deploy, or contact external services.

## Completion and rollback

Completion requires focused and related regression PASS, stable contract hash, diff review evidence, explicit `NOT_EXECUTED` for DB/WSL/Provider/UI/Oracle, and a rollback note. Rollback is the C-22 commit/diff only; preserve all pre-existing dirty/untracked state.
