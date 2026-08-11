# A-05 WorkInstruction — Proposal·Decision·Design Baseline 정적 계약

## Envelope

- artifact_id: `WI-A-05-20260811-001`
- package_id: `A-05`
- version: `1`
- artifact_status: `approved`
- package_status: `READY`
- created_by: `main-agent-eoul`
- executor: `developer-primary-a05`
- baseline_git_commit: `a797c104d802d4e371db3d901feb17ab5cd680db`
- source_spec_sha256: `8955D6B35A0D1A45ED438A597A0013B56F201D412BD830A69AF2D17A2F70EDD1`
- source_plan_sha256: `C2AFD3E0836C88996C762EB7C75C5589701D123EED1C366A3534CCD7C65EB65F`

## Authority and predecessors

- design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- a01_manifest_sha256: `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`
- a02_manifest_sha256: `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168`
- a03_manifest_sha256: `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE`
- a04_manifest_sha256: `C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB`
- a04_test_report_sha256: `3C809FF5F8C31ABB349A19CAFE5151F403437A9757D0C6FC4BA5BC4A1BC4C1B3`
- a04_acceptance_manifest_sha256: `ABA44856604A1989EB9110B44A8A38E56BC6005D85C01FE525DA76A40593317F`

## Verdict boundary

- assigned AV: `AV-FLOW-001`
- package verdict: `STATIC_CONTRACT_PASS`
- canonical L4/L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`
- runtime owners: `B-03`, `A-14`, `A Gate`

## Required contract

1. Proposal Compare
   - proposal set id/version/status/hash/source intent
   - minimum 2 proposals, each with title/summary/pros/cons/fit conditions/cost+uncertainty/risks/evidence refs/assumptions
   - agent recommendation+reason is never selected/approved
   - actions SELECT/REQUEST_REVISION/HOLD/REQUEST_DIFFERENT_APPROACH/view evidence
2. Decision Board
   - DECISION_REQUIRED/CONFIRMED/HOLD/FUTURE_EXTENSION/REVIEW/SUPERSEDED
   - decision id/required/subject+hash/question/input/options/selection/reason/evidence/impact/actor+role/time/supersedes/lineage/next action
   - CONFIRMED requires authenticated human and exact subject hash
   - HOLD/FUTURE_EXTENSION preserved as CarryoverItem
3. Design Baseline
   - specification id/version/status/content hash/source decision refs
   - baseline id/version/hash/approved_by/approved_at/invalidated_at
   - scope/out-of-scope, screen/operational flow, testable completion, unresolved required decisions, source evidence validity
   - approved baseline immutable; spec/hash change invalidates approval and requires new revision
4. A-04 on-demand drawer
   - impact/source/evidence/hash/decision history/reason/next action

## Guards

- alternatives ready only when minimum 2 and all fields/evidence valid
- human SELECT+subject hash opens design refinement, never Execute
- HOLD/revision/different approach keeps Execute closed
- unresolved required decision or invalid evidence disables approval with reason+next action
- authenticated human + exact spec hash only can approve
- superseded lineage is acyclic and carryover target remains valid
- Project view/review/decide/edit/approve permissions are separate
- unauthorized action disabled with reason+next action
- no secret/raw endpoint/localhost/unauthorized path

## Required artifacts

- `docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json`
- `A-05_PROPOSAL_COMPARE.md`, `A-05_DECISION_BOARD.md`, `A-05_DESIGN_BASELINE.md`
- `A-05_PROPOSAL_STATIC_RENDER.svg`, `A-05_DECISION_STATIC_RENDER.svg`
- `scripts/check_a05_design_decisions.py`
- `tests/tooling/test_a05_design_decisions.py`
- `tests/fixtures/a05/canonical-contract.json`, `mutation-catalog.json`
- validation, evidence manifest, completion report

## Allowed/forbidden

Developer may write only `docs/architecture/a05/**`, the A-05 checker/test/fixtures, `docs/validation/A-05_*`, `docs/evidence/manifests/A-05_EVIDENCE_MANIFEST*.json`, and `docs/completion_reports/A-05_COMPLETION_REPORT.md`.

Authority, AGENTS, A-01~04 accepted evidence, progress/WI, `apps/**`, `packages/**`, dependency/lock/config, API/DB/event/browser/runtime/deploy, commit/push are forbidden.

## TDD and hostile verification

Observe RED first. Reject with stable codes: proposal count/field/evidence removal, recommendation promoted to selection, non-human confirmation, subject/spec hash drift, unresolved approval enabled, HOLD/carryover drop, lineage break/cycle, approved baseline mutation, approval not invalidated after spec change, predecessor/token/qualifier/permission drift, secret/runtime promotion, manifest bypass/self/raw/target mutation.

## Completion

Run focused and predecessor regressions, project/G07/Phase-G checkers, JSON/SVG/manifest/raw-target/self-reference/exact diff/diff-check. Record all runtime/API/DB/event/browser/deploy as `NOT_EXECUTED`. Submit `COMPLETED_PENDING_INDEPENDENT_TEST`; Main revokes leases and moves to TEST_REVIEW. Blocking MAJOR or CRITICAL prohibits acceptance. No DIR at A-05.
