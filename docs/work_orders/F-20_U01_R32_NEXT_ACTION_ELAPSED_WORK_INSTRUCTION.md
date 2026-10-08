# WorkInstruction — F-20/U-01 R32 Next Actions 경과시간

- 담당: `developer-primary-f20-u01-r32` 단일 writer. Main이 R31 seq1986 no-lease 기준에서 새 epoch46 worker/write dual lease를 유효하게 발급·검증한 뒤 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R32_NEXT_ACTION_ELAPSED_PLAN.md`, 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, R31 결과보고서. dispatch 때 계획/WI/Invocation SHA-256, branch/HEAD와 두 fencing token을 전달한다.
- 분류: 승인된 U-01 Next Actions 경과시간의 기존 Dashboard 응답 기반 내부 UI/검증. 공개 API/schema, DB/auth/Secret, Run/SSE, 비용·중요 위험 변경 없음.

## allowed_paths 정확히 5개

1. `apps/web/src/console/App.tsx`: 기존 응답의 `alerts`와 `next_actions` 고유 대응·관측 기준 시각을 검증하고 경과시간 또는 확인 불가를 표시. 응답·권한·취소·재연결 오류 상태에서 보호값을 노출하지 않는다.
2. `apps/web/tests/f15-console.test.mjs`: RED→GREEN, 단일 대응/중복·불일치/미래·불량 시각/권한·오류·취소·재연결 및 R31 회귀.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 저장 Next Action 경과시간 DOM과 same-origin/Secret/기존 브라우저 증거 유지.
4. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 새 browser evidence exact key/type/value/negative 계약을 추가하고 기존 검증을 유지.
5. `docs/04_test_reports/F-20_U01_R32_NEXT_ACTION_ELAPSED_RESULT.md`: 시작 기준, RED/GREEN 명령·exit·diff, 자원, 미검증·rollback, Main 인계 누적.

표시는 서버 snapshot `observed_at`에서 해당 alert `observed_at`을 빼는 정수 분 단위로 시작한다. 대응이 정확히 하나가 아니거나 양쪽 시각이 유효하지 않거나 음수면 `경과시간 확인 불가`다. 매칭에 `alert_id`가 없으므로 서버 projection과 동등한 다섯 필드의 완전 일치와 미해결 alert 조건으로만 결합한다. 불확실한 레코드를 0분으로 표시하거나 임의의 첫 alert를 선택하지 않는다. 상세 의미가 바뀌는 경우 제품 write 전에 Main에게 재검토를 요청한다.

Developer는 local console 전체·Python 비 opt-in 관련 전체·Node browser 문법/audit·web typecheck/lint/build·G-05·diff check를 실행한다. 생성 전 경로를 기록한 전용 임시 출력만 신원 확인 후 제거·잔여0. Main은 exact5 독립 검토, 기존 branch checkpoint/private push, WSL-server 동일 clean SHA 격리 PG15/OIDC/HTTPS/Chromium opt-in·화면/Network/Secret 및 전용 자원 정리를 소유한다. Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
