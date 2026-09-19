# C-25 WorkInstruction — Transport-Neutral SNS Gateway and Daon User Contracts

## Scope

Implement the approved v2.8/v1.7 C-25 host-only contract for a transport-neutral SNS Gateway and Daon User API boundary. Preserve C-22 role/result contracts, C-23 trace/orchestration, and C-24 MoA/routing provenance. Telegram and Kakao adapters remain deferred to C-26/C-27.

## Required contract

- Define common inbound/outbound envelope, actor/session/role/command/result contracts with immutable parent trace, identity/auth observation, replay and idempotency keys.
- Enforce rate/retry/DLQ/receipt/audit/privacy projections as detached, bounded, deterministic state; no transport or external send is performed.
- Model Daon User question/answer and SNS command flows as fail-closed host seams. High-risk command, missing authentication, replay, duplicate idempotency, privacy violation or expired receipt must be rejected with stable reason codes.
- Preserve raw payload exclusion, redaction and hash provenance. Delivery result is explicit `NOT_EXECUTED` unless an approved external adapter later supplies a receipt.
- Keep C-26 Telegram and C-27 Kakao contracts separate; no provider, network, DB, UI, WSL, Oracle or secret behavior.

## TDD and verification

1. RED: add focused tests for envelope/identity/session/role/command/result, replay/idempotency, rate/retry/DLQ, receipt/audit/privacy redaction, high-risk rejection and Daon User question path.
2. GREEN: implement the smallest additive host-only extension in allowed modules; reuse C-22/C-23/C-24 provenance and permission authority.
3. Run focused C-25 tests, related agent_team regression, compile, `git diff --check`, and canonical checker when available. Record exact exit codes and explicitly retain checker or external integration as unverified if unavailable.

## Allowed paths

- `packages/agent_team/sns_gateway.py`
- `packages/agent_team/daon_user_api.py`
- `packages/agent_team/__init__.py` only for public exports
- `tests/agent_team/test_sns_gateway_c25.py`
- `tests/agent_team/test_daon_user_api_c25.py`
- `tests/agent_team/test_gateway_contracts_c25.py`
- `tests/agent_team/test_privacy_receipts_c25.py`
- `docs/04_test_reports/C-25_COMPLETION_REPORT.md`

Do not modify adapters, migrations, UI, deployment files, secrets, historical reports, progress history or unrelated dirty/untracked files. Do not commit, push, merge, deploy, or contact external services.

## Completion and rollback

Completion requires focused and related regression PASS, stable hashes, independent read-only review, explicit `NOT_EXECUTED/NOT_INTEGRATED` external scope and rollback note. Rollback is limited to the C-25 exact scope; preserve all pre-existing dirty/untracked state.
