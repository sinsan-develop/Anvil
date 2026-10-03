# WorkInstruction — F-20/U-01 R31 Dashboard read 재연결 상태

- 담당: `developer-primary-f20-u01-r31` 단일 writer. Main이 R30 seq1980 no-lease 기준을 확인하고 epoch45 worker/write dual lease를 유효하게 발급·검증한 뒤 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R31_DASHBOARD_RECONNECT_STATE_PLAN.md`, 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, R30 결과보고서. dispatch 때 계획/WI/Invocation SHA-256, branch/HEAD, execution/write fencing token을 전달한다.
- 분류: 승인된 U-01 공통 reconnect 상태의 내부 Dashboard client/UI·검증 보완. 공개 API/schema, DB/auth/Secret, backend Run/Task/SSE 계약, 비용·중요 위험 변경 없음.

## allowed_paths 정확히 5개

1. `apps/web/src/console/App.tsx`: `UNAVAILABLE`에서 수동 재연결 버튼, 현재 Dashboard GET의 `RECONNECTING` 상태·보호 데이터 제거·R30 취소 및 identity guard 재사용.
2. `apps/web/tests/f15-console.test.mjs`: focused RED→GREEN, 재연결 접근성·종속 카드/관측 시각·독립 카드·중복 GET/취소·200/401/403/429/500/503 회귀.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 저장 화면의 결정론적 전송/503 실패→명시적 재시도→진행 중 재연결 표시→수동200/거부, same-origin/Secret/기존 R6/R23~R30 유지.
4. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 신규 browser evidence 소유 key·exact type/value/negative 계약을 기존 검증과 충돌 없이 추가.
5. `docs/04_test_reports/F-20_U01_R31_DASHBOARD_RECONNECT_STATE_RESULT.md`: 시작 기준, RED/GREEN 명령·exit·diff, 임시자원, 미검증·rollback, Main 인계 누적.

Developer는 local console 전체·Python 비 opt-in 관련 전체·Node browser 문법/audit·web typecheck/lint/build·G-05·diff check를 실행한다. 생성 전 경로를 기록한 전용 임시 출력만 신원 확인 후 제거·잔여0. Main은 exact5 독립 검토, 기존 branch checkpoint/private push, WSL-server 동일 clean SHA 격리 PG15/OIDC/HTTPS/Chromium opt-in·화면/Network/Secret 및 전용 자원 정리 소유. Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나.
