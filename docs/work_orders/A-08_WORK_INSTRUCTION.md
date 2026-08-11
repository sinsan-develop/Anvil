# A-08 WorkInstruction — Completion·Validation·Release 정적 계약

- artifact_id: `WI-A-08-20260812-001`
- package/status: `A-08 / READY`
- executor: `developer-primary-a08`
- baseline_git_commit: `876b277d0997a5d2c60e961004010373513840ee`
- source_spec_sha256: `164547AB2CFEF97254D2FD0F722646919E393258C106F5F967F304B6D67FF66D`
- source_plan_sha256: `ADAA305BB864B9B20B68CDB6EDA884320F81EA9EC1C1A0B90A32ED26761BD4C2`
- assigned: `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025 static slice`
- verdict/runtime: `STATIC_CONTRACT_PASS / RUNTIME_DEFERRED_NOT_EXECUTED`

Create static contracts for Completion Plan-vs-Actual, Technical Test, criterion ProductValidation, Defect lifecycle/retest, authenticated-human ReleaseDecision and Evidence Drawer.

Enforce exact technical results PASS/FAIL/SKIPPED/BLOCKED/ERROR; PV SUITABLE/NEEDS_IMPROVEMENT/UNSUITABLE/BLOCKED; defects OPEN→ACCEPTED→FIXING→READY_FOR_RETEST→CLOSED with independent same-target retest; release RELEASE/REWORK/DEFER/REJECT. Developer cannot close defects or decide release. Required PV incomplete/BLOCKED/UNSUITABLE or blocking defect disables release/apply/deploy. Hash mismatch invalidates evidence and decisions. Package ACCEPTED is not Release.

Developer allowed only `docs/architecture/a08/**`, `scripts/check_a08_completion_validation.py`, `tests/tooling/test_a08_completion_validation.py`, `tests/fixtures/a08/**`, `docs/validation/A-08_*`, `docs/evidence/manifests/A-08_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-08_COMPLETION_REPORT.md`.

Create catalog, focused Markdown, static 1920×1080 SVGs, checker/test/fixtures, validation, manifest, completion. TDD RED first and hostile stable codes for result promotion, PV omission, hash reuse, defect downgrade/transition/retest, human actor/release guards, rework/defer/reject, permissions/static qualifier/secrets/manifest bypass. Run full regressions/checkers/integrity. Authority/A01-A07/progress/apps/packages/runtime/commit/push forbidden. Actual ProductValidation/Release/DIR NOT_EXECUTED.
