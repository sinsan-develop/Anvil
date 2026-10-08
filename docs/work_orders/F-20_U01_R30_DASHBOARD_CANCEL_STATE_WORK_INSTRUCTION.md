# WorkInstruction — F-20/U-01 R30 Dashboard 조회 취소 상태

- 담당: `developer-primary-f20-u01-r30` 단일 writer. Main이 R29 seq1974 no-lease 기준을 확인하고 epoch44 worker/write dual lease를 유효하게 발급·검증한 뒤 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R30_DASHBOARD_CANCEL_STATE_PLAN.md`, 설계서 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, R29 결과보고서. dispatch 때 계획/WI/Invocation SHA-256, branch/HEAD, execution/write fencing token을 전달한다.
- 분류: 승인된 U-01 공통 cancel 상태의 내부 Dashboard client/UI·검증 보완. 공개 API/schema, DB, 인증·권한, Secret, backend Run/Task 취소, 운영 배포, 비용, 기능 범위·요구사항·중요 위험 변경 없음.

## allowed_paths 정확히 5개

1. `apps/web/src/console/App.tsx`: 현재 Dashboard GET의 브라우저 요청 취소 버튼과 `CANCELLED` 종속 카드/관측 시각 상태. AbortController identity guard·route 이탈·다른 상태와 독립 카드 보존.
2. `apps/web/tests/f15-console.test.mjs`: focused RED→GREEN, 보호 데이터 제거·취소 의미·키보드/중복 GET·늦은 응답·수동200 회복 및 401/403/429/500/503 회귀.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 저장 화면의 held Dashboard GET1→사용자 취소→늦은 응답 무시→후속 수동200·403 철회, same-origin/Secret/Network/기존 R6/R23~R29 유지.
4. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 신규 browser evidence의 소유 key·exact type/value/negative 계약을 기존 검증과 충돌 없이 추가한다.
5. `docs/04_test_reports/F-20_U01_R30_DASHBOARD_CANCEL_STATE_RESULT.md`: 시작 기준, RED/GREEN 명령·exit·diff, 임시자원, 미검증·rollback, Main 인계를 누적한다.

## 검증·금지·인계

- Developer는 로컬 console 전체·Python 비 opt-in 관련 전체·Node browser 문법/audit·web typecheck/lint/build·G-05·diff check를 실행한다. 생성 전 경로를 기록한 전용 임시 출력만 신원 확인 후 제거하고 잔여0을 확인한다.
- Main은 exact5 독립 검토, 기존 branch commit/private push, WSL-server 동일 clean SHA의 격리 PG15/OIDC/HTTPS/Chromium opt-in·화면·Network/Secret 확인과 전용 자원 정리를 담당한다. 브라우저 조회 취소를 서버 Run/Task 취소로 승격하지 않는다.
- Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
