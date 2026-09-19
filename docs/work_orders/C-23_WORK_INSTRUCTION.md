# C-23 WorkInstruction — Agent Team Orchestration Contracts

## Scope

Implement the approved v2.8/v1.7 C-23 orchestration contract as an additive extension of the existing `packages/agent_team` host-only contracts. C-22 role, lease, result-envelope and historical E-01 behavior must remain compatible.

## Required contract

- Define deterministic TeamSession, Task, Message and Mailbox contracts with session/parent-child trace binding and immutable provenance.
- Support peer communication and dependency DAG validation with cycle, duplicate, unknown-parent and cross-session fail-closed reason codes.
- Bind orchestration work to the C-22 role and CODE lease/fencing authority without minting runtime approval or a second writer.
- Represent timeout, cost budget, cancellation, partial failure and deterministic replay as explicit state/result contracts; no hidden retries or provider calls.
- Preserve callback-free/detached input-output boundaries, stable hashes and bounded metadata. Host-only orchestration must not execute tools, files, providers, DB, WSL, UI or deployment.

## TDD and verification

1. RED: add focused tests for session/task/message/mailbox lifecycle, parent-child and peer trace, dependency DAG/cycle rejection, lease/fence binding, timeout/cost/partial-failure state, replay and tamper rejection.
2. GREEN: implement the smallest additive extension in the allowed orchestration modules and exports; reuse C-22 contracts and existing agent_team behavior.
3. Run focused C-23 tests, related `tests/agent_team` regression, compile, `git diff --check`, and the canonical progress checker. Report exact exit codes and keep DB/WSL/Provider/network/UI/Oracle/deploy as `NOT_EXECUTED`.

## Allowed paths

- `packages/agent_team/orchestration.py`
- `packages/agent_team/collaboration.py`
- `packages/agent_team/concurrency.py`
- `packages/agent_team/handoff.py`
- `packages/agent_team/__init__.py` only for public exports
- `tests/agent_team/test_orchestration_c23.py`
- `tests/agent_team/test_collaboration_c23.py`
- `tests/agent_team/test_concurrency_c23.py`
- `tests/agent_team/test_handoff_c23.py`
- `docs/04_test_reports/C-23_COMPLETION_REPORT.md`

Do not modify other product paths, progress history, historical reports, migrations, UI, provider adapters, deployment files, or secrets. Do not commit, push, merge, deploy, or contact external services.

## Completion and rollback

Completion requires focused and related regression PASS, stable contract hashes, independent read-only review, explicit unverified scope, and rollback note. Rollback is limited to the C-23 exact scope; preserve all pre-existing dirty/untracked state.
