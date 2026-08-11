# A-10 WorkInstruction — Provider·Egress·Secret·Routing 정적 계약

- artifact_id: `WI-A-10-20260812-001`
- package/status: `A-10 / READY`
- executor: `developer-primary-a10`
- baseline_git_commit: `cdb02cb282910b8072c83594aa2e8f2b7fa08bd3`
- source_spec_sha256: `D942B978757CD6EDF8D7332581E8227E81391071CA1E7870CB0194965BE50A06`
- source_plan_sha256: `D8A97D34BD02F5A38BA625A9D3A6330D514A50D14AD9C507BF9D79139FBF15F0`
- assigned: `AV-OPS-010`, `AV-LRN-028`
- verdict/runtime: `STATIC_CONTRACT_PASS / D-11_F-02_RUNTIME_DEFERRED_NOT_EXECUTED`

Create static contracts for the canonical 9-provider Settings catalog, Provider/Model Detail, Credential Status Drawer, DataEgressProfile, Role Routing/Execution Mode, Capability Drift comparison, and Evidence/Audit Drawer.

Enforce exact provider order and status, visible unavailable reasons, credential references without values, verified capability snapshots with probe/benchmark revisions, role capability and privacy/egress matching, next-snapshot-only activation, fail-closed `BLOCKED_CAPABILITY_DRIFT`, restricted fallback, revoked/expired Secret blocking, independent permissions, and predecessor/evidence integrity.

Developer allowed only `docs/architecture/a10/**`, `scripts/check_a10_provider_routing.py`, `tests/tooling/test_a10_provider_routing.py`, `tests/fixtures/a10/**`, `docs/validation/A-10_PROVIDER_ROUTING_VALIDATION.md`, `docs/evidence/manifests/A-10_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-10_COMPLETION_REPORT.md`.

Create the catalog, focused Markdown, 1920×1080 static SVGs, checker/test/fixtures, validation, manifest, and completion report. Observe TDD RED first. Hostile stable codes must reject provider reorder/removal, hidden unavailable states, guessed or stale capability, route activation without probe/benchmark, credential/internal endpoint disclosure, egress expansion without approval, silent unsafe fallback, revoked Secret use, capability drift bypass, permission collapse, static-runtime promotion, predecessor drift, and manifest bypass.

Authority, A-01~A-09 accepted artifacts, progress/HANDOFF, apps/packages/dependencies/config/runtime, actual Provider/Secret/Egress/Network, commit, and push are forbidden. Actual L3/L5, AI/AN, E-AUD/E-TEST, Provider/Secret/Egress/API/DB/Event/browser/network/runtime and DIR remain `NOT_EXECUTED`.
