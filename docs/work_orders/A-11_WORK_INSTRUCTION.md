# A-11 WorkInstruction — Operations·Monitoring 정적 계약

- artifact_id: `WI-A-11-20260812-001`
- package/status: `A-11 / READY`
- executor: `developer-primary-a11`
- baseline_git_commit: `4ba47c337e3e819c4f14ddff5a00ccfec56c00be`
- source_spec_sha256: `47BA91EE3BEA376A5868E756BF57FA0053E3DF96C220AE565365706B6A795FAB`
- source_plan_sha256: `188240B95EB550A20846EC7FF581015AC9B9A63B15273130FB9016515DCE583B`
- assigned: `AV-OPS-002`
- verdict/runtime: `STATIC_CONTRACT_PASS / F-13_RUNTIME_DEFERRED_NOT_EXECUTED`

Create static contracts for Operations Overview, Queue, Worker/Lease, Provider/Backend Health, Alert Center, Budget/Quota, Deployment Monitoring, and Audit/Details Drawer.

Enforce system-detected anomaly evidence, cause/impact/next action/deep link, health staleness, alert dedupe and acknowledge/resolve separation, queue/worker/write fencing, quarantine/max attempts, budget reserve-before-call and usage reconciliation, provider drift visibility, deployment monitoring window/critical-alert/Owner-confirmation guards, distinct enums, separated permissions, masked sensitive references, and predecessor/evidence integrity.

Developer allowed only `docs/architecture/a11/**`, `scripts/check_a11_operations_monitoring.py`, `tests/tooling/test_a11_operations_monitoring.py`, `tests/fixtures/a11/**`, `docs/validation/A-11_OPERATIONS_MONITORING_VALIDATION.md`, `docs/evidence/manifests/A-11_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-11_COMPLETION_REPORT.md`.

Create catalog, focused Markdown, 1920×1080 static SVGs, checker/test/fixtures, validation, manifest, and completion report. Observe TDD RED first. Hostile stable codes must reject stale healthy signals, manual-only anomaly promotion, missing cause/impact/action/deep link, invalid alert resolve, stale fencing, infinite retry, reservation/order/reconcile violations, unsafe provider state, premature deployment release, automatic data-loss rollback, force-success, enum or capability collapse, sensitive disclosure, static-runtime promotion, predecessor drift, and manifest bypass.

Authority, A-01~A-10 accepted artifacts, progress/HANDOFF, apps/packages/dependencies/config/runtime, actual queue/worker/provider/budget/alert/deployment/API/DB/Event/SSE/browser/network, commit, and push are forbidden. Actual L4/FI/E-SHOT and operations runtime and DIR remain `NOT_EXECUTED`.
