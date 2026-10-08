# F-20/U-01 R42 알려진 메뉴 직접 진입 WorkInstruction

- 책임: 단일 `developer-primary` 제품 writer. Main은 canonical lease·검토·Git·WSL-server QA·종료 통제를 소유한다.
- 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R42 계획 `ADF04CC6A6E3EF155971D27D397C25E5D9965D766F5EE5279C2C95FCF17E4568`. 실행 전 실제 파일 hash·branch/HEAD/status와 유효 worker/write dual token을 확인한다.
- exact5: `packages/api/fastapi_app.py`, `apps/web/server.mjs`, `tests/api/test_public_asgi_frontend.py`, `apps/web/tests/ui-preview-runtime.test.mjs`, `docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_RESULT.md`.
- 목적: 현재 MENU_ITEMS의 알려진 메뉴 경로를 직접 GET/새로고침해도 같은 production HTML shell이 열리게 한다. ASGI에는 StaticFiles보다 앞선 정확 경로 GET만 등록하고, 로컬 Web 서버는 production mode의 정확 경로만 처리한다. `MENU_ITEMS` 경로와 서버 허용 경로의 회귀 검사를 포함한다. 다른 경로는 기존 404/권한 응답을 유지한다.
- TDD: 두 HTTP 서버의 `/projects`·`/operations` 및 전체 알려진 메뉴 경로를 먼저 RED로 고정한 후 최소 구현 GREEN. `/api/not-a-route`, `/auth/not-a-route`, `/health/not-a-route`, `/unknown`, fixture route, preview mode 및 기존 정적 asset/보안 헤더 회귀를 검증한다. 기존 Python API 집중, Web test/typecheck/lint/build, G-05, diff check를 실행한다.
- 금지: exact5 밖 변경, catch-all HTML fallback, API/인증·인가/DB/스키마 변경, 메뉴의 가짜 기능·수락 표기, Main Event/progress/HANDOFF/WORK_STATUS/control 변경, commit·push, WSL-server·ysna/Production 접근. 다른 메뉴의 placeholder는 그대로 둔다.
- 보고: 변경 전후 diff·정확 명령/exit/결과, 오류 횟수, 미검증 범위, rollback, 이전 기능 영향 및 결과 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`를 판정→판단 이유→조치로 기록한다.
