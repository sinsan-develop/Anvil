# A-12 WorkInstruction — Cross-Screen State Catalog 정적 계약

- artifact_id: `WI-A-12-20260812-001`
- package/status: `A-12 / READY`
- executor: `developer-primary-a12`
- baseline_git_commit: `54e90804d049bdbccc3c273538609a62de488bf6`
- source_spec_sha256: `0F322F615FA81DFCCFED3049CC73AFF2054B2D0F4F9331A2A2E118C572F0304D`
- source_plan_sha256: `5432551689C0BC67B9501351747E41ACAD18F5CF7CAE0A14E957B37A5B28BC1F`
- assigned: `AV-UI-006`, `AV-UI-007`, `AV-GATE-005`
- verdict/runtime: `STATIC_CONTRACT_PASS / A-14_A-GATE_RUNTIME_DEFERRED_NOT_EXECUTED`

Create a complete A-03~A-11 surface×state matrix for LOADING, EMPTY, ERROR, BLOCKED, QUOTA, CANCEL, RECONNECT and cross-cutting PERMISSION_DENIED, with common envelope, transitions, actions, permissions, evidence and semantic badge contract.

Only actual executed qualifying evidence may show PASS. Enforce separate FAIL/SKIPPED/BLOCKED/ERROR/NOT_EXECUTED/mock/fixture/static semantics, icon+text+color, pass composition, stale loading, neutral empty, safe error, blocked reason, quota checkpoint/reconcile, cancel request/effective/terminal separation, Last-Event-ID reconnect/gap/replay/order/dedupe, terminal immutability, optimistic version/idempotency, permission detail masking, and predecessor/manifest integrity.

Developer allowed only `docs/architecture/a12/**`, `scripts/check_a12_screen_states.py`, `tests/tooling/test_a12_screen_states.py`, `tests/fixtures/a12/**`, `docs/validation/A-12_SCREEN_STATES_VALIDATION.md`, `docs/evidence/manifests/A-12_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-12_COMPLETION_REPORT.md`.

Observe TDD RED, create catalog/focused Markdown/1920×1080 SVGs/checker/tests/fixtures/validation/manifest/completion, and verify complete matrix plus hostile omissions/promotions/transitions/leaks/bypass. Authority, A-03~A-11 accepted artifacts, progress/HANDOFF, apps/packages/deps/runtime/API/DB/SSE/browser/network, commit/push are forbidden. Runtime and DIR remain NOT_EXECUTED.
