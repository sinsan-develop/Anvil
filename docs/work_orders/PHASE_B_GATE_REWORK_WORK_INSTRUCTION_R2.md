# Phase B Gate Rework WorkInstruction R2

- artifact_id: `WI-PHASE-B-GATE-20260821-002`
- package_id: `PHASE_B_GATE`
- revision: `R2`
- predecessor: `WI-PHASE-B-GATE-20260821-001`
- executor: `developer-primary-phase-b-gate`
- scope_classification: `same_approved_exact44_scope`
- reason: `independent review found P2 checker/test gaps and report count correction; Main-owned projection remains separate`

## Required fixes

1. Correct `PHASE_B_GATE_COMPLETION_REPORT.md` to report the independently observed full progress suite as `80 tests / 4 failures`, naming the four failing tests and distinguishing two A-03 out-of-scope failures from two current projection failures.
2. Extend `scripts/check_phase_b_gate.py` to validate that validation and completion reports contain the exact direct44/deferred6/undefined1 boundaries and `NOT_EXECUTED` wording, and use the generated verification map in manifest validation.
3. Add negative tests for report boundary mismatch, manifest raw checksum/target/content tamper, and `AV-STAT-029` promotion.
4. Remove the sequence-365 shortcut that bypasses historical B-12 acceptance manifest validation. Preserve B-12 historical validation while separately validating the active Phase B Gate projection.
5. Reject manifest raw paths that escape the repository root (`..`, absolute paths, or resolved paths outside root).

## Allowed paths

Only the original Phase B Gate exact 7 developer paths may be modified:

- `docs/validation/PHASE_B_GATE_VALIDATION.md`
- `docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md`
- `scripts/check_phase_b_gate.py`
- `tests/tooling/test_phase_b_gate.py`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`

Do not modify Main-owned progress/HANDOFF/Event, approvals, WorkInstructions, projection digest/manifest, authority documents, B-01~B-12 accepted evidence, product code, C-01, API/UI/DB/provider/WSL/ysna/deployment, stage, commit, or push.

## Required verification

- focused Phase B Gate tests
- focused active projection and B-12 historical tests
- checker execution and `py_compile`
- full `tests.tooling.test_project_progress` result recorded honestly, including any pre-existing failures
- `git diff --check`

Report status must remain `INCOMPLETE` or `COMPLETED` without claiming Gate acceptance or C-01 readiness.
