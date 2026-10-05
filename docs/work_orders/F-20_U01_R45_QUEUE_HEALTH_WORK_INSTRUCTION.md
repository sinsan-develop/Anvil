# F-20/U-01 R45 Queue 격리 경고 WorkInstruction

- 책임: canonical worker/write dual lease를 받은 단일 `developer-primary` 제품 writer. Main은 통제 Event·진도/HANDOFF·Git·독립 검토·WSL-server QA를 소유한다. 이 문서는 lease 발행 전 제품 수정을 허가하지 않는다.
- 기준: `docs/04_test_reports/F-20_U01_R45_QUEUE_HEALTH_PLAN.md`의 checkpoint된 SHA-256 및 설계·작업계획·매트릭스·테스트계획의 현재 bytes/hash. 시작 전 branch/HEAD/status, G-05, worker/write token·scope·유효기간을 재확인한다.
- 제품 예정 exact5: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R45_QUEUE_HEALTH_RESULT.md`.
- 목적: 같은 Dashboard 응답의 유효한 격리 행이 있을 때만 Queue의 확인된 이상 `LATE`와 현재 범위 격리 건수를 표시한다. 기존 저장 `QUEUE_JOB_QUARANTINED` alert와 단일·정확 일치할 때만 R44 방식의 same-page 상세를 보여 준다. 격리 0건을 `HEALTHY`로 바꾸지 않는다.
- TDD: 격리 행 양성·다건·0건·위조/중복/미래시각/source gap, 저장 alert 유일/중복/해결, 인증 전·철회 후 차단을 console RED→GREEN과 실제 PG15 브라우저 단언으로 검증한다. 기존 R35/R43/R44·Network/Secret 회귀 및 Web typecheck/lint/build·G-05·diff check를 보존한다.
- 금지: exact5 밖 제품 write, 새 공개 API/route/DB/schema/auth/권한/Secret, 서버 경고 Event·중복 조치, Queue 전체 정상 판정, Event/progress/HANDOFF/WORK_STATUS/control 수정, commit·push, WSL-server·ysna/Production 접근. Main의 범위 재지시 없이 경계를 넓히지 않는다.
- 보고: 시작 HEAD/branch/status, 변경 전후 diff, 정확한 명령·exit·실제 결과, 오류·SKIP·미검증, 기존 동작 영향·잔여 위험·rollback을 결과보고서에 판정→판단 이유→조치 순으로 기록한다. 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
