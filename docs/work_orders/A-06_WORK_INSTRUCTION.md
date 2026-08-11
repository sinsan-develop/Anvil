# A-06 WorkInstruction — Planning·Instruction·Approval 정적 계약

## Envelope
- artifact_id: `WI-A-06-20260812-001`
- package_id: `A-06`
- version: `1`
- status: `approved / READY`
- executor: `developer-primary-a06`
- baseline_git_commit: `a7432e2c034989b30bdd09e3ceb622a8bdfc495d`
- source_spec_sha256: `DD4F4D5035140987329A79AC0C08482A02BB01DE3DB19B7E1F11DE2D599307AF`
- source_plan_sha256: `7F8FEFB488617CEFB46FFA38FDACED5E818426084CD16799721DE025AA968EB0`

## Bindings
- design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- G04 WI template: `6E6663FC339D3FA60DE5DAA8326721A247287096991A020958736670AE789177`
- A05 manifest/report/acceptance: `90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1` / `AA36A92E883DC8DA39ED01B2F5DF8E9855B166183386986B63B93BF0D79165BA` / `56C0ACEE074706F04696C37FF5C44CD4BA0BE724308D462B2B0F0CC7CBD0B5A9`

## Verdict
- `STATIC_CONTRACT_PASS`
- `AV-SAFE-005`: A-06 static approval-record slice; E-API/E-AUD NOT_EXECUTED
- `AV-FLOW-003`: Invocation artifact reference/nonduplication E-ART static slice
- runtime owners: B-04/C-14; browser/runtime deferred

## Required screens
1. WorkPlan Overview: envelope, baseline/hash, objective/roles/scopes/graph/iterations/prerequisites/deliverables/done/verification/risks/budget/approval.
2. Iteration Board: parent/hash/sequence/scope/prerequisites/deliverables/done/verification/risk/carryover/dependencies/status; no parent scope expansion.
3. WorkInstruction Review: G04 exact template fields, allowed/forbidden paths/actions, rollback/completion/result/report/reconstruction/verification.
4. Invocation Preview: WI id/hash, approval subject hash, mode/agent/report refs, short instruction only; duplicated WI goal/scope/verification count=0; hash change => STALE.
5. Approval Center: PLAN/SCOPE_CHANGE/APPLY/DEPLOY/DESTRUCTIVE independent lanes and records; expiry blocks; no cross-substitution or auto-run.
6. Non-semantic Derived Baseline: root/parent/old-new/diff/impact/rationale/actor/time, scope_before/after and `scope_expanded=false`; material change => human approval.

## Guards
- plan/baseline/WI hash mutation invalidates approval and invocation.
- approved artifacts immutable.
- Apply/Deploy/Destructive execution never opens in A-06.
- capabilities PROJECT_VIEW, PLAN_EDIT/APPROVE, ITERATION_MANAGE, WI_EDIT/APPROVE, APPROVAL_DECIDE, NON_SEMANTIC_RECONFIRM, APPLY/DEPLOY/DESTRUCTIVE_DECIDE remain distinct.
- unauthorized disabled+reason+next action; no secret/raw endpoint/localhost/path.

## Artifacts and paths
Developer allowed only: `docs/architecture/a06/**`, `scripts/check_a06_planning_approvals.py`, `tests/tooling/test_a06_planning_approvals.py`, `tests/fixtures/a06/**`, `docs/validation/A-06_*`, `docs/evidence/manifests/A-06_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-06_COMPLETION_REPORT.md`.

Create one catalog, focused Markdown specs, three 1920×1080 static SVGs, checker/test/fixtures, validation, manifest, completion report.

Forbidden: authority/AGENTS/G04 accepted artifacts/A01-A05 accepted evidence/progress/WI, apps/packages/dependencies, API/DB/browser/runtime/deploy, Developer commit/push.

## TDD and completion
Observe RED. Fail closed on approval collapse/reuse/hash/expiry, plan/iteration/WI omissions, allowed-forbidden overlap, Invocation mismatch/duplication/stale, nonsemantic chain/misclassification/scope expansion, permissions/static qualifier/secrets/manifest bypass. Run focused/full regressions and all relevant checkers, JSON/SVG/raw-target/self-reference/predecessor/exact diff/diff-check. Record runtime as NOT_EXECUTED and submit `COMPLETED_PENDING_INDEPENDENT_TEST`. No DIR at A-06.
