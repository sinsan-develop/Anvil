# A-07 WorkInstruction — Execution Control·Recovery·DIR 정적 계약

- artifact_id: `WI-A-07-20260812-001`
- package/status: `A-07 / READY`
- executor: `developer-primary-a07`
- baseline_git_commit: `509ca147aaaeea46a262279bfba6047a36338af2`
- source_spec_sha256: `9F1E548A9F45E5DC8A2F6F9E73C4475D8FA6FDA6F0C732EC88C08FBB1A19A279`
- source_plan_sha256: `2231BEAE67E5190AF7EA8CECE4C7A2BE699DAECFF62F5626CDC00E2BF73735AA`
- assigned_av: `AV-AGT-029`
- verdict: `STATIC_CONTRACT_PASS`
- runtime: `L4 / AE / E-SHOT RUNTIME_DEFERRED / NOT_EXECUTED`

## Contract

Create exact static contracts for Execution Control, Task Graph, Agent Drawer, Exception Inbox, Recovery Center, Fencing/Budget, Takeover, and DIR Panel. Preserve distinct Run/Step/Delegation/Lease/DIR states. Display agent role/scope/permissions/model/token+cost/status/action/heartbeat/leases/evidence/authorized stop.

Enforce DAG/dependency and hash guards; worker+write fencing for mutation; heartbeat expiry; reserve-before-provider budget; failure classification; same lineage+fingerprint valid failure count; third-failure or explicit human takeover; checkpoint/hash/side-effect reconciliation and no duplicate execution; DIR hold/owner direction/no auto-clear. A-07 visualizes DIR but does not reach DIR-1.

## Artifacts and paths

Developer may write only `docs/architecture/a07/**`, `scripts/check_a07_execution_control.py`, `tests/tooling/test_a07_execution_control.py`, `tests/fixtures/a07/**`, `docs/validation/A-07_*`, `docs/evidence/manifests/A-07_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-07_COMPLETION_REPORT.md`.

Create one catalog, focused Markdown contracts, three 1920×1080 static SVGs, checker/test/fixtures, validation, evidence manifest, completion report.

Authority, A-01~A-06/G04 accepted evidence, progress/WI, apps/packages/dependencies, API/DB/browser/Agent runtime/deploy, Developer commit/push are forbidden.

## TDD and hostile verification

Observe RED first. Fail closed on missing Agent fields/stop authority, state conflation, DAG cycle/dependency, success pollution, missing/stale leases, conflict alias, heartbeat, budget reserve/reconcile, failure-count pollution, early/late takeover, incomplete packet, stop/resume/duplicate execution, DIR conflation/auto-clear/no direction, permissions/static qualifier/secrets, manifest bypass/integrity.

Run focused/full predecessor regressions and project/G07/Phase-G checkers, JSON/SVG/raw-target/self-reference/immutable predecessor/exact diff/diff-check. Runtime remains NOT_EXECUTED. Submit `COMPLETED_PENDING_INDEPENDENT_TEST`; no DIR at A-07.
