# A-06 Planning·Approval 정적 계약

## 목적과 경계

WorkPlan, IterationPlan, WorkInstruction, InvocationPrompt, 5종 독립 승인, 비의미 파생 baseline을 정적 화면·artifact 계약으로 확정한다.

- package: `STATIC_CONTRACT_PASS`
- AV: `AV-SAFE-005`, `AV-FLOW-003`
- E-API/E-AUD/runtime: `NOT_EXECUTED`
- E-ART: static artifact contract only

## surfaces

1. WorkPlan Overview: envelope, baseline/hash, objective, roles, scopes, graph/iterations, prerequisites, deliverables, done/verification, risks/budget, approval.
2. Iteration Board: parent plan/hash, sequence, scope, prerequisites, deliverables, done/verification, risks/carryover/dependencies/status. Parent scope 확장 금지.
3. WorkInstruction Review: G-04 template exact fields, allowed/forbidden actions/paths, rollback, completion, result/report/reconstruction/verification.
4. Invocation Preview: WI id/hash, approval subject hash, execution mode/agent/report refs, short instruction only. WI 본문 중복 0.
5. Approval Center: PLAN/SCOPE_CHANGE/APPLY/DEPLOY/DESTRUCTIVE 독립 lanes and records.
6. Non-semantic Derived Baseline: root/parent/old-new/diff/impact/rationale/actor/time, scope_expanded=false.

## guards

- plan/baseline/WI hash change invalidates approval and Invocation.
- approval expiry blocks; no auto-run.
- five approval types cannot substitute/reuse each other.
- material scope/requirement/important-risk change requires human approval.
- Main nonsemantic reconfirm requires semantic NONE, unchanged scope, root and parent chain.
- A-06 opens no Execute/Apply/Deploy/Destructive edge.

## permissions

PROJECT_VIEW, PLAN_EDIT/APPROVE, ITERATION_MANAGE, WI_EDIT/APPROVE, APPROVAL_DECIDE, NON_SEMANTIC_RECONFIRM, APPLY/DEPLOY/DESTRUCTIVE_DECIDE are distinct. Unauthorized controls remain disabled with reason and next action.

## artifacts and verification

Catalog, focused Markdown contracts, three static SVGs, checker/tests/fixtures, validation, manifest, completion report. Hostile verification covers approval independence, hash/expiry/invalidation, plan/iteration/WI fields, Invocation nonduplication/staleness, nonsemantic chain/nonexpansion, permissions, predecessor/token/static qualifier, secrets, manifest integrity.

No apps/packages/dependencies/API/DB/browser/runtime/deploy mutation. DIR is not reached at A-06.
