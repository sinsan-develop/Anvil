# Invocation — F-20/U-01 R33T

`docs/work_orders/F-20_U01_R33T_HISTORY_SUITE_REPAIR_WORK_INSTRUCTION.md`와 Main이 전달한 기준 SHA·유효한 worker/write fencing token을 확인한 뒤, 허용된 정확한 13경로에서만 TDD로 작업한다. 기존 브랜치/격리 worktree를 유지한다. 각 실패군의 RED→GREEN·음성 회귀·실행 명령/종료 코드/실제 결과·미검증·rollback을 결과 보고서에 적고 Main에게 판정 가능한 상태로 인계한다. 새로운 범위가 필요하면 수정하지 말고 Main에게 정확한 근거와 경로를 보고한다.
