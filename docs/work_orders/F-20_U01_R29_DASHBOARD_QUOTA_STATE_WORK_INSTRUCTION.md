# WorkInstruction — F-20/U-01 R29 Dashboard quota 상태

- 담당: `developer-primary-f20-u01-r29` 단일 writer. Main이 기존 seq1968 no-lease 기준을 확인하고 epoch43 worker/write dual lease를 유효하게 발급·검증한 뒤 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R29_DASHBOARD_QUOTA_STATE_PLAN.md`, 설계서 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, R28 결과보고서. dispatch 때 계획/WI/Invocation SHA-256, branch/HEAD, execution/write fencing token을 함께 전달한다.
- 분류: 승인된 U-01 공통 quota 상태의 내부 client/UI·검증 보완. 공개 API/schema, DB, 인증·권한, Secret, 운영 배포, 비용, 기능 범위·요구사항·중요 위험 변경 없음.

## allowed_paths 정확히 5개

1. `apps/web/src/console/App.tsx`: 기존 same-origin Dashboard GET에서 429만 `QUOTA`로 분류하고 관측 시각·연동 카드에 제한 상태를 정직하게 표시한다. 보호 행/이전 성공 관측 시각은 남기지 않는다.
2. `apps/web/tests/f15-console.test.mjs`: 먼저 focused RED를 실행하고 429/401/403/500/503, Secret body 미노출, 회복200, 기존 상태·접근성 회귀를 GREEN으로 검증한다.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 실제 OIDC 브라우저 흐름에 단일 Dashboard GET 429 결정론적 장애 주입과 후속 200 수동 회복·GET 수·행 제거·관측 시각·same-origin·Secret 검사를 추가한다. 기존 R6/R23~R28 검증을 삭제·완화하지 않는다.
4. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: Node 신규 evidence를 기존 key 소유권과 충돌 없이 strict exact key/type/value로 검증한다. negative RED→GREEN을 포함하고 기존 R6/R23~R28/Network/Secret/artifact 검증을 유지한다.
5. `docs/04_test_reports/F-20_U01_R29_DASHBOARD_QUOTA_STATE_RESULT.md`: 시작 기준, RED/GREEN 명령·exit·diff, 임시자원, 미검증·rollback, Main 인계를 누적한다.

## 검증·금지·인계

- Developer는 로컬 console 전체·Python 비 opt-in 관련 전체·Node browser 문법/audit·web typecheck/lint/build·G-05·diff check를 수행한다. 생성 전 경로를 기록한 전용 임시 출력만 신원 확인 후 제거하고 잔여0을 확인한다.
- Main은 exact5 독립 검토, 기존 branch commit/private push, WSL-server 동일 clean SHA의 격리 PG15/OIDC/HTTPS/Chromium opt-in·1920×1080 화면·Network/Secret 확인과 전용 자원 정리를 담당한다. WSL 결정론적 429는 실제 quota enforcement가 아니며 결과에 구분한다.
- Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
