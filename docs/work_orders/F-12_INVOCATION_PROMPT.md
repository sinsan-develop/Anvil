`docs/work_orders/F-12_WORK_INSTRUCTION.md`와 활성 worker/write lease를 먼저 확인하라. 지정된 exact8 제품 경로만 단일 writer로 TDD 구현·기본 검증하고 결과 상태, 정확한 명령/exit, 미검증 범위를 `docs/04_test_reports/F-12_COMPLETION_REPORT.md`에 기록하라. Git commit/push와 control/progress 수정은 Main이 담당한다.

R2(2026-09-24): Main의 revision event와 새 write lease가 G-05를 통과한 뒤에는 같은 WorkInstruction의 R2 exact10 경로를 적용한다. F-01 owner current-profile/CAS 계약을 TDD로 보완하고 F-12는 owner API만 소비하라. 이전 exact8 명령·결과와 R2 재작업 결과를 보고서에서 구분하라.
