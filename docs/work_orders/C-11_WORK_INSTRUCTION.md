# C-11 WorkInstruction — Main Agent Planner·ExecutionPlan·WorkInstruction orchestration

## 범위

기존 `packages/planning`과 `packages/orchestration` 계약을 확장해 Main Agent가 요청을 분석하고 deterministic `ExecutionPlan` 및 `WorkInstruction`을 생성·검증·스케줄하는 서비스를 구현한다. 사람 승인 전에는 write Step이 schedule되지 않으며, Main Agent가 목표·범위·위험·판단을 유지한다. C-08~C-10의 repository intelligence/action policy와 연결 가능한 입력 projection만 사용한다.

허용 경로: `packages/planning/**`, `packages/orchestration/**`, `tests/planning/**`, `tests/orchestration/**`, `docs/04_test_reports/C-11_COMPLETION_REPORT.md`.

## 금지

실제 subagent 실행, DB/API/browser/deployment/network/secret 호출과 historical progress/event/hash 변경. 승인 우회, 자동 write scheduling, 기존 public contract의 암묵적 변경 금지.

## 완료 조건

1. 요청→분석→계획→WorkInstruction 생성이 canonical hash와 함께 재현된다.
2. read-only 단계는 승인 없이 schedule 가능하지만 write/execute 단계는 명시적 approval binding 없이는 거부된다.
3. 범위·허용/금지 path·완료조건·risk·egress projection이 WorkInstruction에 결박된다.
4. stale/다른 target hash 승인, 빈 범위, path conflict, unsafe action은 fail-closed다.
5. 신규·관련 테스트, compileall, `git diff --check` 통과 및 미검증 운영 경계를 보고서에 기록한다.
