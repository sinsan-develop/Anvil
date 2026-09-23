# C-11 WorkInstruction — current-baseline planner orchestration

## Authority binding

- artifact id: `WI-C-11-20260914-002`
- package: `C-11`
- baseline commit: `002ebea5409eb9fa32cde045f92f4b1b69b587ed`
- design SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- work plan SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- verification matrix SHA-256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- test plan SHA-256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- worker lease: `worker-lease-c11-20260914-001`
- execution fencing token: `c11-execution-fence-epoch-1-002ebea5409eb9fa`
- write lease: `write-lease-c11-20260914-001`
- write fencing token: `c11-write-fence-epoch-1-32cde045f92f4b1b`
- issued at: `2026-09-14T22:15:00+09:00`
- expires at: `2026-09-15T10:15:00+09:00`

과거 C-11 코드, commit, WorkInstruction과 완료보고는 조사 입력일 뿐 현재 실행·완료 권위가 아니다. 현재 baseline의 실제 imports, behavior와 tests를 다시 대조해 미충족 요구만 TDD로 보완한다.

## Objective

Main Agent request analysis에서 deterministic `ExecutionPlan`과 `WorkInstruction`을 생성·검증하고, Main Agent가 전체 판단을 유지하는 동안에만 안전한 Step을 schedule한다. 사람 승인 전 write/execute Step은 schedule하지 않는다.

## Allowed product paths

- `packages/planning/**`
- `packages/orchestration/**`
- `tests/planning/**`
- `tests/orchestration/**`
- `docs/04_test_reports/C-11_COMPLETION_REPORT.md`

## Required behavior

1. 동일 요청·baseline·scope·risk·egress 입력은 canonical SHA-256이 같은 request analysis, ExecutionPlan과 WorkInstruction을 재현한다.
2. read-only Step은 dependency가 충족되면 승인 없이 schedule할 수 있다.
3. write/execute Step은 현재 plan target hash에 대한 명시적이고 미만료된 approval binding 전에는 fail closed한다.
4. objective, allowed/prohibited scope, completion conditions, risk, permission 및 egress projection을 plan과 WorkInstruction에 immutable하게 결박한다.
5. stale 또는 다른 target hash 승인, 빈 scope, dependency cycle/missing dependency, path conflict, unsafe action을 거부한다.
6. Main Agent 책임 주체가 없거나 종료된 상태에서는 Subagent만 계속 schedule하지 않는다.
7. Subagent 메시지·Agent 간 합의를 사람 승인이나 설계 변경으로 처리하지 않는다.
8. 범위와 실제 diff가 다르면 `SCOPE_EXPANSION_REQUIRED`로 거부하고 새 scope approval 전 write를 schedule하지 않는다.

## Required validation

- `AV-SAFE-001`, `AV-SAFE-019`, `AV-AGT-024`, `AV-AGT-028`, `AV-FLOW-016`
- focused planning/orchestration tests and affected C-08~C-10 regressions
- `python -B -m compileall -q packages/planning packages/orchestration tests/planning tests/orchestration`
- `git diff --check`
- canonical progress checker after Main Agent control projection

## Prohibited

실제 Subagent runtime 실행, DB/API/browser/Provider/network/Secret/WSL/Docker/deployment, public contract·설계·계획 변경, 승인 우회, 자동 write scheduling, 허용 경로 밖 product mutation, 다른 Agent 생성, merge/push/deploy를 금지한다.

## Result contract

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. 변경 파일과 diff, RED/GREEN 명령·종료 코드·실제 결과, 관련 회귀, 미검증 범위, rollback, baseline/lease token을 포함한다. Implementer는 commit·push하지 않는다.
