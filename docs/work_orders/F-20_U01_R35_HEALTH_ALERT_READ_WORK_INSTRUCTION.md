# WorkInstruction — F-20/U-01 R35 Health·Critical 읽기 화면

- 담당: `developer-primary-f20-u01-r35` 단일 제품 writer. Main의 seq2010 no-lease에서 정식 worker/write dual lease 발급 및 G-05 PASS 뒤에만 착수한다.
- 기준: 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, `docs/04_test_reports/F-20_U01_R35_HEALTH_ALERT_READ_PLAN.md`. Dispatch에 문서 hash, branch/HEAD/status, 두 fencing token·만료를 전달한다.
- 분류: 승인된 U-01의 기존 read-only UI 절편. 새 API route/응답 필드·permission·auth/CSRF·DB/schema·Secret·비용·운영 배포 변경0.

## write allowed_paths 정확히 5개

1. `apps/web/src/console/App.tsx`: Dashboard `health`의 6개 component를 각 Health 카드에 일관되게 표시하고, readiness/Provider 등록 수는 health와 구분한다. Critical 저장 GET의 `impact`·`next_action`을 단순 텍스트로 표시한다. 미관측·source gap·거부·재연결·오염은 fail-closed한다.
2. `apps/web/tests/f15-console.test.mjs`: 정상·비가용·위조·미래/부분 자료와 기존 R34 카드·Next Actions·same-origin 회귀를 RED→GREEN으로 검증한다.
3. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 기존 formal PG15/OIDC fixture가 R35의 화면/API 증거를 정확히 수집·분류하도록 필요한 assertion만 보완한다. opt-in guard·증거 권한 경계 유지.
4. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 동일 SHA 실제 Chromium의 Health 상태·Critical 영향/다음 행동 API↔DOM, 권한 철회·same-origin·내부주소/secret 비노출 assertion을 필요한 범위에서만 추가한다.
5. `docs/04_test_reports/F-20_U01_R35_HEALTH_ALERT_READ_RESULT.md`: 시작 기준·RED/GREEN·실행 명령/종료 코드·미검증·rollback을 기록한다. Main의 WSL 실제 실측은 별도 후속 현황으로 구분한다.

## 완료조건과 금지

- Health `HEALTHY`는 기존 trusted source가 실제 건강 상태와 유효 관측 시각을 제공한 경우에만 사용한다. Queue job 건수나 Provider 등록 수로 건강을 유추하지 않는다. `UNKNOWN`/`UNAVAILABLE`을 0 오류 또는 PASS로 표시하지 않는다. 검증된 활성 route가 없으면 상세 링크를 생략한다.
- Critical `impact`·`next_action`은 기존 응답의 저장 값만 읽고 실행 가능한 링크·mutation으로 승격하지 않는다. 이전/부분 페이지와 권한 철회 시 보호 값이 남지 않게 한다.
- Developer는 착수 전 canonical G-05, branch/HEAD/status, actor·두 token·만료·exact5 scope를 확인한다. Main 소유 Event/progress/HANDOFF/WORK_STATUS/control과 사용자 dirty/untracked를 수정·stage·삭제하지 않는다.
- TDD RED→GREEN, Console 전체·browser 문법/audit·web typecheck/lint/build·관련 Python 비 opt-in·G-05·diff check를 실행한다. 미실행·SKIP은 PASS가 아니다. 임시 출력은 실경로·링크·프로세스 확인 후 정확히 정리한다.
- Developer는 commit/push/PR/merge, 새 branch/main, WSL-server/Docker/DB, ysna/Production을 건드리지 않는다. Main은 독립 검토·checkpoint/private push·WSL-server 동일 SHA 실제 QA·정리를 맡는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. R35 PASS도 U-01/F-20 인수가 아니고 C30 `OPEN_BLOCKING`/DEFER를 유지한다.
