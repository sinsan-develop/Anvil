# F-20/U-01 R27 Dashboard 수동 새로고침 결과

## 판정

`COMPLETED` (Developer 로컬 구현·기본 검증만). Dashboard operations의 기존 same-origin GET을 native 버튼으로 수동 재조회하고, 조회 중 이전 보호값을 숨긴다. 브라우저 하네스에는 저장 성공 상태에서의 503/잘못된 응답→`UNAVAILABLE`→성공 복구, Enter 재조회, 권한 철회 후 화면의 저장 보호값을 둔 채 수동 403→`BLOCKED`/보호 행 0을 단언했다. 이 실제 브라우저 흐름은 아직 WSL-server에서 실행하지 않았으므로 **실측 PASS가 아니다**. Main의 독립 검토·same-SHA WSL-server 실제 PG15/OIDC/HTTPS/Chromium 검증은 `NOT_EXECUTED`이다. 이 결과는 R27 절편의 Developer 인계이며 U-01/F-20 수락이 아니다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다.

## 기준·증거

- 계획: `docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_PLAN.md`
- WorkInstruction: `docs/work_orders/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_WORK_INSTRUCTION.md`
- 시작 Git: `codex/f18-wsl-ops`의 clean `e8d47f75150269ca6b72ceed74f7cf5c26da6428`; local/private `development`/WSL-server Git 동일 SHA는 Main이 dispatch 전 확인했다. 착수 뒤 Main 소유 `docs/WORK_STATUS.md` dirty는 보존하고 Developer는 exact4 안에서만 수정했다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`. R27 계획 `6F528B5195BB3BB5865B2A3BE2D68FF854B92F54127F35EF88C2EF4E41FFFF05`, WI `DDAB4C881BF2DC32976ED53C2D5AC2C61DD61E86FB5B428C64928240EE129F5F`, Invocation `E83158CE05CBC247D0A52DF925FDD505244478EB9C09C4CA4F4C8DF68A2C4B44`.
- 실행 권한: canonical seq1960, epoch41, actor `developer-primary-f20-u01-r27`, worker/write `ACTIVE`, execution token `f20-u01-r27-execution-fence-epoch-41-r27refresh1002`, write token `f20-u01-r27-write-fence-epoch-41-r27refresh1002`, 만료 `2026-10-02T13:05:01+00:00`. 마지막 검증 시 두 lease가 유효했다.
- 변경 diff: `App.tsx`는 Dashboard 전용 AbortController와 in-flight guard, 기존 `loadDashboardQueue` 재사용, `LOADING` 전이 및 native 수동 버튼을 추가했다. Provider·Alert·readiness controller/상태는 분리했다. console test는 초기 로딩과 버튼 접근성을 추가했다. browser harness는 저장 상태 실제 클릭→Dashboard GET 1회→로딩/보호값 제거→실제 응답 `observed_at`, 타 카드 독립, 503/잘못된 200 응답의 fail-closed와 200 복구, Enter 키로 GET 1회, 로딩 중 비활성 버튼의 중복 GET 차단, 저장된 보호행·시각을 둔 채 권한 철회→수동 클릭 403/보호 행 0 및 기존 reload/revoke 회귀를 단언한다. 공개 API·DB/schema·auth/Secret·새 fetch 경로 변경은 없다.
- TDD RED: 최초 console `npm run test:console -w @anvil/web`는 버튼 부재로 `48 PASS/1 FAIL`(예상 RED). 구현 후 전체 GREEN 50 PASS.
- Main read-only review Important 2건은 Developer 정식 실패가 아닌 테스트 증거 부족으로 받아 보강했다. 첫째, 기존 브라우저 저장 flow에 503/형식 불량 200 수동 클릭 시 로딩·보호행 제거·`UNAVAILABLE`·중복 GET 방지와 각각의 후속 정상 200 복구, 마지막 Enter 키 활성화/GET 1회를 넣었다. 둘째, 권한 철회 직후에도 저장 보호행 1개와 시각을 UI에 남긴 상태를 먼저 단언하고 수동 재조회 403/GET 1회/행 0/관측 시각 차단을 검증하도록 기존 reload 검증보다 앞에 배치했다. 기존 reload/revoke와 R23~R26 Network·Secret 사실 단언은 보존했다. 이 보강은 아직 WSL 실제 브라우저 미실행이며 audit 자기검증만으로 PASS라 주장하지 않는다.
- 후속 review 정정: 서버 snapshot은 성공 GET마다 새 `observed_at`을 발행하므로, revoke 직전의 UI 시각 단언은 최초 저장 reload 값이 아니라 마지막 성공한 Enter 재조회 응답의 관측 시각을 사용한다. 브라우저 하네스 단일 줄과 이 설명만 수정했고 제품 동작은 변경하지 않았다. 정정 후 Node 문법·audit 자기검증, console 50 PASS, typecheck/lint, G-05 seq1960와 diff check 모두 exit0; 실제 WSL 실행은 계속 미검증이다.
- Main의 첫 동일 SHA WSL-server 격리 PG15/OIDC/HTTPS/Chromium opt-in은 `1 failed, 25 deselected, 2 warnings in 38.03s`; Python 분류는 `R6_BROWSER_FAILED stage=NODE_UNHANDLED exit=1 class=UnhandledError`, evidence 0이다. 이것은 **FAIL**이며 브라우저 실제 PASS가 아니다. Main read-only 조사에서 새 manual `R6_STAGE` 이름은 Python classifier의 `[A-Z_]+` 문법과 `_BROWSER_STAGES` 허용 목록에 맞지 않아 실제 실패 단계를 가렸다. 제품 원인은 현재 미확인이다. Developer는 exact browser 파일에서 manual 단계만 이미 허용된 `STORED_NEXT_ACTION`/`REVOKE_FETCH`로 매핑하고 grammar/로컬 stage 집합 자기검증을 추가했다. Python 계약·제품/API·기존 클릭/Network/Secret 단언은 바꾸지 않았다. 변경 후 `node --check` exit0, 브라우저 `--audit-self-test` exit0/`R6_AUDIT_SELF_TEST_PASS`, console 50 PASS, typecheck/lint, G-05 seq1960와 diff check가 모두 exit0이며 새 임시자원 0이다. Main의 동일 SHA 재실행으로 실제 실패를 다시 분류해야 한다.
- 로컬 검증: `npm run test:console -w @anvil/web` exit0/50 PASS; `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit0; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit0/`R6_AUDIT_SELF_TEST_PASS`; `npm run web:typecheck` exit0; `npm run web:lint` exit0/3 files·수정0; `npm run web:build` exit0/20 modules; `.\\.venv\\Scripts\\python.exe -m scripts.check_project_progress` exit0/G-05 seq1960 PASS; `git diff --check` exit0. Important 보강 후 위 Node/정적/G-05/diff check를 다시 모두 실행했다. 브라우저 `--audit-self-test`는 브라우저/DB 실제 흐름이 아닌 하네스 단위 자기검증이다.
- Python 비 opt-in: 최초 기본 pytest temp 경로는 Windows ACL로 `22 PASS/1 SKIP/3 setup ERROR`; 제품 실패로 계상하지 않았다. 전용 `--basetemp` 재실행 `25 PASS/1 SKIP`, 전용 경로 잔여0을 이전 Developer가 확인했다. 기존 `.pytest_cache`는 보존했다. 이번 이어받기에서는 이 Python suite를 중복 재실행하지 않았다.
- 임시자원: 마지막 build 전 `apps/web/dist` 부재 확인. build 후 root 절대경로가 현재 worktree 하위·root 비-link·하위 reparse/link 0·정확 파일3개임을 확인한 뒤 이 전용 출력만 제거해 잔여0. 다른 경로·기존 `.pytest_cache`/의존성은 보존했다.
- 오류 집계: 정식 `FAILURE_REPORT` 0회. 예상 RED 1, 기본 Windows pytest ACL setup error 3과 초기 G-05 일시 실패는 환경/중간 상태로 분리했고 현재 G-05 PASS다. 중단된 이전 Developer 세션은 `INCOMPLETE`에서 같은 lease로 이어받았으며 제품 변경을 되돌리거나 재구현하지 않았다.
- Main 독립 same-SHA WSL-server PG15/OIDC/HTTPS/Chromium, PNG/Network 및 전용 자원 정리: `NOT_EXECUTED`. fixture/audit/빌드를 실제 브라우저 PASS로 승격하지 않는다. Product/Environment/기간 필터·운영 read model·전체 7상태·독립 Tester/C30도 미충족이다.

## Main 인계

Main은 exact4 diff·로컬 결과를 독립 검토하고 기존 branch에만 안전한 checkpoint commit/private push를 수행한다. WSL-server는 그 clean 동일 SHA를 Git으로 가져와 격리 PG15/OIDC/HTTPS/Chromium 실제 클릭, 200→403 재조회, PNG/Network same-origin·Secret 비노출을 확인하고 전용 자원을 정확히 정리한다. 그 결과를 출처 구분해 반영한 뒤에만 lease 종료·절편 판정을 한다. Developer는 Git/WSL/DB/Docker/control 파일을 변경하지 않았다.

Rollback: R27 exact4만 정상 Git revert한다. 새 migration/지속 데이터는 없다.
