# A-06 WorkPlan Overview · Iteration Board

## 판정 경계

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `AV-SAFE-005`, `AV-FLOW-003`의 정적 artifact slice만 다룬다. Canonical runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 `E-API NOT_EXECUTED`, `E-AUD NOT_EXECUTED`다.

## WorkPlan Overview

WorkPlan은 envelope, baseline/hash, objective, roles, included/excluded/protected scope, dependency graph, iterations, prerequisites, deliverables, completion conditions, verification, risks, budget, approval을 한 화면에서 검토한다. 승인된 plan은 immutable이며 content 또는 baseline hash 변경 시 기존 승인은 무효화된다.

## Iteration Board

Iteration은 parent plan id/hash, sequence, scope, prerequisites, deliverables, done/verification, risk, carryover, dependencies, status를 가진다. included scope는 parent scope의 부분집합이어야 하고 parent scope 확장은 차단한다.

권한이 없으면 control은 disabled이고 `reason=권한 부족`, `next_action=PLAN_APPROVE 권한 보유자에게 요청`을 보여준다. 설명은 i tooltip/popover로 제공한다.

