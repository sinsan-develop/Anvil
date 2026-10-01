# WorkInstruction — F-20/U-01 R26 Dashboard 관측 시각 표시

- 담당: `developer-primary-f20-u01-r26`. Main이 기존 branch/private Git/WSL-server 동일 checkpoint와 canonical epoch40 worker/write dual lease ACTIVE·두 fencing token을 확인한 뒤에만 단일 writer로 착수한다.
- 분류: 승인된 U-01 내부 UI 구현. 설계·기능 요구·중요 위험·공개 API·DB/schema·인증/권한·Secret 계약 변경 없음.
- 기준 문서와 설계 경계: `docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_PLAN.md` 및 그 안의 canonical SHA-256, 설계 §29.2·작업계획 U-01·테스트계획 §10.8. 계획/WI/Invocation hash는 Main dispatch checkpoint에 결박한다.

## allowed_paths 정확히 4개

1. `apps/web/src/console/App.tsx`: 이미 받는 Dashboard `observed_at`을 성공 상태에 보존하고 머리말에 별도의 접근 가능한 관측 시각/로딩·차단·오류 상태를 표시한다. 기존 readiness `마지막 확인`과 독립이며 새 네트워크 요청·상태 복제는 금지한다.
2. `apps/web/tests/f15-console.test.mjs`: valid/future/invalid·loading·401/403/503·회수 상태의 UI와 기존 독립 카드·민감정보 비노출을 테스트 우선으로 검증한다.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: R23~R25 실제 브라우저 flow의 pre-auth/보류 로딩/저장 성공/권한 철회 상태에 관측 시각 DOM 단언을 추가한다. 기존 fact 이름·의미와 Network/API/DB/Secret 단언은 보존한다.
4. `docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_RESULT.md`: 시작 branch/HEAD/status·hash·lease, TDD RED/GREEN 명령/exit, exact diff·잔여 위험·미검증·rollback 및 Main 인계를 기록한다.

## 검증·금지·인계

- `node --check`/browser `--audit-self-test`, console 전체/typecheck/lint/build, Python 비 opt-in, G-05·`git diff --check`를 실행한다. 임시 경로는 생성 전 정확한 대상·정리 방법을 기록하고 실경로/링크·프로세스 확인 뒤 그 대상만 제거한다.
- Main은 exact4를 독립 검토→같은 branch commit/private push→WSL-server clean 동일 SHA 격리 PG15/OIDC/Chromium 실제 opt-in→PNG/Network·임시자원 잔여0→lease 회수한다.
- Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
- R26 PASS는 관측 시각 좁은 절편만 증명한다. 필터·수동 refresh·운영 상태 실데이터·전체 7상태·독립 Tester 증거·C30은 미충족이며 U-01/F-20 acceptance가 아니다.
