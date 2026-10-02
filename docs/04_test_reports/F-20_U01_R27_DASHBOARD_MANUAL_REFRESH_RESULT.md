# F-20/U-01 R27 Dashboard 수동 새로고침 결과

## 판정

`NOT_STARTED`. 시작 checkpoint와 dual lease 발급 전이며 제품 변경·테스트·실제 WSL-server QA 모두 미실행이다. U-01/F-20 미수락, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`.

## 기준·증거

- 계획: `docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_PLAN.md`
- WorkInstruction: `docs/work_orders/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_WORK_INSTRUCTION.md`
- 시작 Git/기준 hash/lease: Main dispatch checkpoint 확정 후 기입한다.
- Developer 변경·정확한 검증·오류 횟수: 미실행.
- Main 독립 same-SHA WSL-server PG15/OIDC/HTTPS/Chromium, PNG/Network 및 전용 자원 정리: 미실행.

Rollback: 제품 변경 발생 시 R27 exact4만 정상 Git revert. 현재 revert 대상 없음.
