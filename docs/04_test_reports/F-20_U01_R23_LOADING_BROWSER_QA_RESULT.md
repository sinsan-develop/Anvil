# F-20/U-01 R23 초기 LOADING 브라우저 QA Developer 결과

## 판정

`COMPLETED` — 지정된 브라우저 하네스·Python opt-in 계약·이 보고서 exact3의 로컬 구현과 검증을 완료했다. 실제 WSL-server PG15/OIDC/Chromium DOM·Network·DB 실행은 Main의 동일 SHA push 이후 수행하므로 `UNVERIFIED`다. C30은 `OPEN_BLOCKING`, U-01/F-20은 미수락, Production은 `NOT_EXECUTED`다. 정식 동일 실패 횟수 0.

## 기준·권한·변경

- Windows worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, 시작 branch `codex/f18-wsl-ops`, HEAD `adb03e5c71dd800c37dd69e002ae46d33355d389`. 시작 `git status --short --branch`에는 Main 소유 `docs/WORK_STATUS.md` 변경만 있었고 보존했다. 발급 기준 checkpoint `98165db3dcc3c9f43aa56722f7eae43d0a6b5778`.
- 설계/작업계획/매트릭스/테스트계획/운영규칙 SHA-256은 각각 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R23 계획 hash `8898A9C9420814656C3E12B74D131AA64D0C318260A59651F385E73B90E5184F`. 모두 WorkInstruction 기준과 일치한다.
- canonical worker/write lease 모두 `ACTIVE`, epoch37, 유효기간 `2026-10-02 00:46:29 KST`까지다. execution token `f20-u01-r23-execution-fence-epoch-37-r23br1001`, write token `f20-u01-r23-write-fence-epoch-37-r23br1001`; path_scope exact3와 일치한다.
- `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 첫 Dashboard 네 same-origin 요청만 보류, 여섯 Health 카드·Next Actions·Critical Alerts의 실제 DOM `LOADING`/`aria-live=polite`/`aria-atomic=true`, 조기 READY/HEALTHY·0건·실패 표시 거부, 실제 Tab/Enter 및 `aria-expanded` 왕복, 네 요청 개별 해제와 각 응답을 검사한다. 기존 R20 저장 alert→Next Actions→revoke/403와 요청·응답·DOM secret/same-origin 감사 흐름을 유지한다.
- `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 신규 단계와 DASHBOARD 응답 분류를 고정 whitelist에 추가하고, R23 결과 7개 상태·건수·boolean을 엄격 비교한다. 기존 R20 결과 필드와 DB fixture 의미는 유지한다. 비 opt-in SKIP는 실제 브라우저 PASS가 아니다.

## RED → GREEN 및 로컬 명령

| 명령 또는 조치 | exit | 실제 결과 |
|---|---:|---|
| 신규 `validateLoadingFacts` 실패 탐지 단언 추가 후 `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 1 | 의도한 RED: `ReferenceError: validateLoadingFacts is not defined` |
| 구현 뒤 `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 구문 PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`; LOADING 오류 변형·기존 R20/Network 실패 탐지 단언 GREEN |
| `.\.venv\Scripts\python.exe -B -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r23_dev` | 0 | 18 passed, 1 skipped(실제 PG15/브라우저 opt-in 미설정) |
| `npm run web:test` | 0 | console 전체 47 PASS, 0 fail |
| `npm run web:typecheck` | 0 | TypeScript 오류 0 |
| `npm run web:lint` | 0 | 3 files, 수정 0 |
| `npm run web:build` | 0 | Vite 20 modules 변환, bundle 생성 |
| `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py` | 0 | G-05 `PASS sequence=1936 reporting=AUTO_CONTINUE` |
| `git diff --check` | 0 | whitespace 오류 0 |

## 자원·미검증·인계

- Main이 사전 기록한 `.pytest_tmp_f20_u01_r23_dev`와 `apps/web/dist`는 생성 전 부재였다. 완료된 pytest/build 실행 뒤 두 디렉터리의 worktree 내부 절대경로·root 비-link를 확인했다. pytest base 안의 symlink 3개 대상은 모두 해당 base 내부였다. symlink 3개를 정확히 제거한 뒤 두 지정 출력 경로만 제거해 잔여 0을 확인했다. 기존 `.venv`와 `node_modules`는 보존했다. 개별 명령은 종료 코드 0으로 종료했으며 별도 실행 세션은 없다. Windows 프로세스 명령행 조회는 권한 거부되어 시스템 내 다른 Node 프로세스의 소유 관계까지 확인하지 못했다.
- 로컬 자기검증·SSR·정적 검사만 PASS다. 실제 WSL-server 동일 SHA PG15/OIDC/Chromium DOM·Tab/Enter·same-origin Network·secret 비노출·저장 alert/revoke/403·DB는 `UNVERIFIED`. R23은 U-01의 전체 7상태/접근성·정식 E-SHOT/E-NET·F-20 최종 완료 증거가 아니다.
- Main은 exact3 diff·로컬 결과 독립 검토 후 안전한 Git commit/private push와 WSL-server 동일 SHA opt-in·임시자원 정리, canonical progress/HANDOFF/WORK_STATUS/control 및 lease 회수를 소유한다. Developer는 commit/push·WSL/DB/운영·제품 UI/API/schema를 변경하지 않았다. 되돌릴 때에는 R23의 두 테스트 파일과 이 보고서만 이전 Git 상태로 복구하며 제품·DB 지속 데이터 rollback 대상은 없다.

## R23 WSL 실패 후 로컬 보완 / 2026-10-01

- Main 전달 실측: clean `e75f949bacd279f33796fe3290593efedc1c0545`의 WSL 격리 PG15/OIDC/Chromium opt-in은 약 11.83초 뒤 `R6_BROWSER_FAILED stage=NODE_UNHANDLED exit=1 class=UnhandledError`로 실패했다. Main의 민감정보 제거 재진단에서는 마지막 안전 단계 `PRE_AUTH_LOADING_RELEASE`, 실패 marker 없음, JS 고정 파일 line411 `await route.continue()`가 확인됐다. 첫 WSL opt-in은 **FAIL**이며 R23 실제 브라우저·DB PASS로 계상하지 않는다. WSL 자원·정리는 Main 소유다.
- 원인: 브라우저 하네스가 네 라우트를 gate로 보류한 뒤 `route.continue()` 비동기 콜백의 완료·실패를 회수하지 않고 `page.unroute()`를 실행했다. Playwright의 기본 unroute는 진행 중 handler를 기다리지 않아 콜백 거부가 상위 `main().catch` 밖의 미처리 rejection이 될 수 있다. `route.continue()`가 최초 거부된 외부 원인은 비밀 없는 오류 종류만으로 확정할 수 없으며, 본 보완은 원인 원문을 출력하지 않고 실패를 안전하게 회수한다.
- 재시작 시 HEAD는 `e75f949bacd279f33796fe3290593efedc1c0545`, branch `codex/f18-wsl-ops`, `git status --short --branch`에는 Main 소유 `docs/WORK_STATUS.md` 변경만 있었다. epoch37 worker/write `ACTIVE`, 위 두 fencing token·exact3 범위를 재확인했다. 이 보완의 변경은 브라우저 하네스, Python 통합 테스트, 본 보고서 exact3만이다.
- TDD RED: 새 라우트 지연 거부/미처리 0 자기검증 추가 후 `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit1, 의도한 `ReferenceError: createTrackedRouteHandler is not defined`. 구현 뒤 같은 명령 exit0 `R6_AUDIT_SELF_TEST_PASS`; 지연된 continue 거부를 고정 `R23_ROUTE_CONTINUE_FAILED`로 회수하고 미처리 rejection 0을 확인했다. Python 안전 분류 테스트 `test_r23_route_failure_reports_only_fixed_marker`는 집중 실행 exit1, `R23_ROUTE_CONTINUE_FAILED` 누락으로 예상 RED → 고정 marker만 전달하고 원문은 버리는 구현 뒤 exit0, 1 PASS.
- 보완은 모든 라우트 작업 Promise를 추적·catch하고 실패를 고정 marker로 표시하며 요청 해제 결과를 실패로 만든다. `finally`는 보류 gate를 해제하고 `page.unrouteAll({behavior:'wait'})`로 진행 중 콜백을 기다린 뒤 추적 작업을 drain한다. LOADING/키보드/응답 판정은 완화하지 않았다. Python은 marker 정확 일치만 실패 메시지에 포함하고 임의 stderr·요청/응답 원문은 내보내지 않는다.

| 보완 후 로컬 명령 | exit | 실제 결과 |
|---|---:|---|
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 구문 PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | 자기검증 PASS, 지연 route 거부 회수·미처리 0 |
| `.\.venv\Scripts\python.exe -B -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r23_dev` | 0 | 19 passed, 1 skipped(실제 WSL opt-in 아님) |
| `npm run web:test` | 0 | console 전체 47 PASS |
| `npm run web:typecheck` | 0 | TypeScript 오류 0 |
| `npm run web:lint` | 0 | 3 files, 수정 0 |
| `npm run web:build` | 0 | Vite 20 modules 변환 |

- 사전 기록된 정확한 `.pytest_tmp_f20_u01_r23_dev`와 `apps/web/dist`만 사용했다. root는 두 곳 모두 worktree 내부 비-link였고 pytest base의 symlink 3개 대상도 해당 base 내부였다. 종료된 명령을 확인한 뒤 내부 symlink와 두 출력 경로를 정확히 제거해 잔여 0; 기존 `.venv`·`node_modules` 보존. Main의 WSL 동일 새 SHA 재실행, 실제 DOM/Network/DB·저장 alert→Next Actions→revoke/403는 여전히 `UNVERIFIED`; WSL FAIL 해결 여부는 Main이 검증한다. 정식 Developer 동일 실패 횟수 0, 새 임시 경로·Git/WSL/제품 write 0.
