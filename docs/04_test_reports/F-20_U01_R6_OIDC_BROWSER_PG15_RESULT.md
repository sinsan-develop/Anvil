# F-20/U-01 R6 OIDC·브라우저·PG15 결과보고 (WSL R9 Provider 401 본문 진단)

## 판정

`LOCAL_GREEN; WSL_R9_PROVIDER_401_BODY_TIMEOUT; E2E_NOT_PASSED`. SHA `5b9a574b10a109c1c0a1abff9fcf512dbbcc2583`의 실제 WSL opt-in은 `PRE_AUTH_RESPONSES`에서 `PROVIDER_API status=401 reason=TIMEOUT`으로 9.20초 만에 fail-close했다. 401 응답 객체는 존재하지만 Playwright `response.text()`가 bounded 시간 안에 끝나지 않았다. Uvicorn TLS/유한 JSONResponse와 App의 비인증 body 미소비 분기를 확인했으나 서버 전송과 Chromium/Playwright 캡처 중 근본 원인은 아직 미확정이다. R9는 실패 시에만 원 응답의 안전한 헤더 형태·`response.finished()` 결과와 같은 페이지의 별도 401 본문 읽기를 bounded 비교한다. 401/200 예외나 감사 생략은 추가하지 않았다. 이 보고는 U-01/F-20 수락, C30 사고 해소, Production 검증이 아니다.

## 판단 이유와 기준선

- 시작 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `4f06ceedf197252e3fc7990e3b8e2b61024f6cb2`, 시작 제품 Git status clean. Main이 별도 관리하는 `docs/WORK_STATUS.md` 갱신은 본 writer의 exact3 변경에 포함하지 않는다.
- R1 재작업 시작 HEAD `3b312b092721a692e126cbcd6c27fbccf6f1fb60`, branch `codex/f18-wsl-ops`, 제품 Git status clean. Main의 `docs/WORK_STATUS.md` 사전 기록은 별도 소유다.
- R2 분류 보완 시작 HEAD `8ef1359a77404d128151b6f95dc4ba8d468597bf`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R3 수집 보완 시작 HEAD `b98eb9c77c6c95d63af0d367e9995728297edac2`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R4 탐색 보완 시작 HEAD `2b7d7b030084074bfa0669270266f48b3c60971e`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R5 진행 marker 시작 HEAD `d7ab58599fb5b6571571a8655485c441c0329021`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R6 응답 캡처 보완 시작 HEAD `495e5bcbfd7a99164de47bff175947d7a55136c5`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R7 화면 phase 응답 경계 보완 시작 HEAD `dafa66c44f5d48cc41daec05c380b406ac8868d7`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R8 화면 phase 실패 진단 보완 시작 HEAD `1a9806a06534bd71807dcd63da43adb15437f924`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- R9 Provider 401 본문 진단 보완 시작 HEAD `5b9a574b10a109c1c0a1abff9fcf512dbbcc2583`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- canonical seq1822, actor `developer-primary-f20-u01-r6`, epoch18 worker `worker-lease-f20-u01-r6-r6oidcstart1`/execution token `f20-u01-r6-execution-fence-epoch-18-r6oidcstart1`, 종속 write `write-lease-f20-u01-r6-r6oidcstart1`/write token `f20-u01-r6-write-fence-epoch-18-r6oidcstart1`, 둘 다 ACTIVE·만료 `2026-09-29T14:19:55+00:00`, 발급 dispatch `6d946bb9792e328ae97233726ac6322fece4f68f`. G-05 seq1822 PASS 후 정확한 세 파일만 작성했다.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R6 WI `7BFE973A0741B5E00493DE2884F15F3741EB260043433BC140F3FF15146C27A0`, Invocation `0A0CA362F4F7294581A340F734AF36D8609A4DF04D46FB79FAD86E00B5F53A45`.

## 조치·diff

| 파일 | 변경 |
|---|---|
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` | 격리 DSN 뒤 Docker inspect의 exact SHA7 container·QA label·PG15·AutoRemove·loopback5545·data tmpfs·volume/bind 0을 DB 접속/seed 전에 검사, 기존 factory와 저장 Operations owner, 임시 HTTPS IdP/API, 시험 전용 role 철회 control, Node 결과·audit 무변경·세션 확인, 정확한 TLS 파일/row/listener 정리. R1 import 환경, R2 Secret-safe 실패 분류, R4 고정 stage, R5 timeout 마지막 stage, R6 whitelist 응답 category/status/reason, R7 phase 응답 stage, R8 phase 진단 whitelist, R9 안전 probe whitelist |
| `tests/browser/f20-u01-oidc-browser-pg15.mjs` | 단일 Chromium context의 401→same-origin authorization/callback→Secure·HttpOnly session→저장 Critical API·DOM→권한 철회 403/재표시 stale-clear, 별도 issuer request context, 모든 page request origin/민감값 URL·header·body·response·DOM 검사, 저장 row code/entity/cause API↔DOM 대조. R2 시작 marker, R3 즉시 settled Network 수집, R4 DOM 준비 대기, R5 진행 stage, R6 응답 capture bounded timeout·200 fail-close·고정 route category/status 진단, R7 화면 phase별 초기 API 본문 수집 완료 경계, R8 waiter/capture 누락 원인 분류, R9 실패 시에만 bounded Provider 401 transport/native 비교 |
| 본 보고서 | 로컬 RED/GREEN·실행 명령·미검증·rollback 기록 |

새 공개 endpoint, role/permission 계약, migration/schema, 제품 UI/서비스, 공유 WSL 자원, 운영 환경은 변경하지 않았다. 브라우저는 현재 로그인 UI가 없으므로 화면 버튼 클릭이 아니라 같은 context의 상대 경로 fetch와 임시 issuer code를 사용한다.

### 독립 리뷰 finding별 보완

| finding | 조치 | 잔여 |
|---|---|---|
| 이름/빈 DB만으로 영속 PG에 audit 잔류 가능 | 현재 checkout HEAD 앞 7자와 동일한 `anvil-u01-r6-pg-<sha7>`, `anvil.qa.scope=F-20/U-01/R6`, `anvil.qa.sha7`, `postgres:15`, running, AutoRemove, 127.0.0.1:5545→5432, data tmpfs `rw,size=256m`, bind/volume 0, DB/role `anvil_f20_r3a_<sha7>`를 seed 전에 fail-closed 검사. guard 거부 시 DB engine 생성0 음성. | 실제 WSL inspect·container 정리 실측 대기. |
| API만 보던 Network/secret 검사 | 모든 page request/response를 수집하고 앱 출처 일치와 실제 DSN/driver형·DB password·control token·합성 client secret·fencing 및 세션 cookie 값의 URL/body/응답/DOM 노출을 검사. 정상 same-origin Cookie/Set-Cookie는 허용하고 off-origin cookie/authorization은 거부. issuer 호출은 별도 request context. | 실제 Chromium E-NET 수집 대기; 이것은 formal full E-NET acceptance가 아님. |
| code만 대조 | 저장 row의 `related_entity_id`와 `cause`를 API와 해당 DOM `<li>`에 함께 대조. | WSL 실측 대기. |
| 실패 진단·timeout | browser failure는 stage·exit·class만 노출하고 stderr 원문·argv·Secret은 출력하지 않는다. timeout은 `MAIN_NAMED_CONTAINER_CLEANUP_REQUIRED`로 분류. | timeout 뒤 exact named Docker container 존재·정리는 Main이 확인해야 함. |
| `R6_ASGI_IMPORT_CONSOLE_BASE_URL_MISSING_R1` | 명시적 app 환경에는 `ANVIL_CONSOLE_BASE_URL`이 있었으나 그보다 앞선 ASGI 모듈 import의 `create_runtime_app()`는 `os.environ`을 읽었다. 기존 API fixture와 동일하게 시험용 console URL/public host를 import 전 context 안에만 주입하고 종료 시 복원했다. 별도 Python 프로세스의 환경 누락 재현 RED→GREEN. | `8ef1359` WSL에서 import 통과; 전체 E2E는 미통과. |
| `R6_BROWSER_RUNNER_UNCLASSIFIED_R2` | `8ef1359` WSL에서 ASGI import는 통과했지만 runner exit1의 Node stage marker가 기존 stderr regex에는 없었다. Python은 stdout/stderr 양쪽의 whitelist stage/class marker만 반환하고 Node 시작 marker·npm 오류·Docker 오류·원인 미확정 pre-Node를 고정 범주로 구분한다. Node 시작 시 값 없는 marker 1행 추가. 원문 stderr/stdout/URL/비밀은 출력하지 않는다. | `b98eb9c` WSL에서 `NODE_UNHANDLED`로 범위 축소; 실제 unhandled 출처 미확정. |
| `R6_NODE_UNHANDLED_R3` | `page.on('request')`의 `allHeaders()`와 `page.on('response')`의 `allHeaders()/text()`가 최종 `Promise.all` 전 reject하면 unhandled가 될 수 있다. 캡처 시점에 성공/실패가 모두 resolve되는 결과를 만들고, 최종 감사에서 실패·빈 수집은 고정 오류로 거부한다. 204/304/redirect의 읽을 수 없는 빈 body만 허용한다. | 새 SHA WSL E2E에서 실제 원인과 전체 Network 감사 확인 필요. |
| `R6_PRE_AUTH_TIMEOUT_R4` | `2b7d7b0` WSL에서 PRE_AUTH 30초대 TimeoutError. 기존 `page.goto(...waitUntil:'networkidle')`가 가장 강한 후보지만 직접 await별 증거는 없었다. `domcontentloaded` 뒤 실제 Critical Alerts section visible을 기다리고, 별도의 같은-origin alerts API 401 확인은 유지한다. 이후 reload도 같은 DOM 준비 기준으로 하고 저장 code/철회 UNAVAILABLE 실제 표시를 계속 기다린다. 단계는 PRE_AUTH_DOCUMENT/CARD/FETCH/CARD_CHECK 및 후속 reload 단계로 세분했다. | 새 SHA WSL에서 정확한 실패 단계와 E2E 결과 확인 필요. |
| `R6_RUNNER_TIMEOUT_R5` | `d7ab585` WSL에서 Docker browser subprocess가 120초 종료되지 않았다. Node는 주요 await 전 `fs.writeSync(1, 'R6_STAGE <whitelist>')`로 즉시 기록하고 Python은 `TimeoutExpired.stdout` bytes에서 마지막 허용 값만 사용한다. stdout/stderr 원문·URL·Secret은 실패 문자열에 포함하지 않는다. | 다음 WSL에서 마지막 단계 관측 후 hang 원인 판정 필요. timeout 뒤 exact named container 정리는 Main 소유. |
| `R6_RESPONSE_CAPTURE_TIMEOUT_R6` | `495e5bc` WSL의 마지막 단계가 `NETWORK_RESPONSE_FACTS`. 모든 response 캡처 전체를 기본 10초로 bound하고 body read도 더 짧게 bound한다. 정상 204/304/redirect의 읽을 수 없는 빈 body만 기존 예외로 유지하며 비스트리밍 200 미완료는 `{ok:false}` 후 감사에서 실패. 실패 대상은 `DOCUMENT/ASSET/ALERT_API/HEALTH_API/PROVIDER_API/OIDC_AUTH/EVENT_REPLAY_API/OTHER_API/OTHER_APP/UNKNOWN` 중 고정 category와 정수 status, `TIMEOUT/UNREADABLE`만 노출한다. Node 종료 대기 중 Python timeout이 나도 부분 stdout의 허용 진단만 유지한다. | 새 SHA WSL에서 실제 미완료 응답 category/status 및 전체 E2E 확인 필요. |
| `R6_PROVIDER_401_CAPTURE_TIMEOUT_R7` | `dafa66c` WSL에서 초기 `PROVIDER_API` 401 본문이 최종 감사 시 이미 TIMEOUT. 각 `goto`/`reload` 전에 same-origin Health·Provider·Alerts의 response waiter를 등록하고 카드 visible 뒤 세 응답의 기존 수집 Promise 완료·성공을 요구한다. 하나라도 누락/미완료면 phase에서 fail-close하고 고정 category/status/reason만 노출한다. | 화면 navigation에 따른 취소 가설과 전체 E2E는 새 SHA WSL 실측 대기. |
| `R6_PRE_AUTH_RESPONSES_UNCLASSIFIED_R8` | `1a9806a` WSL에서 `PRE_AUTH_RESPONSES` exit1/Error, 10.68초. Node의 waiter 실패·WeakMap capture 부재·기존 body capture 실패는 모두 가능하고 Python은 이 phase marker를 숨겼다. waiter별 rejection을 즉시 settled로 만들어 category별 `WAIT_TIMEOUT/WAIT_ERROR`, capture 연결 부재면 `CAPTURE_MISSING`, body 실패면 기존 `TIMEOUT/UNREADABLE`을 고정 category/status와 함께 출력하고 Python은 허용 단계·값만 전달한다. | 실제 실패 category/reason과 E2E는 새 SHA WSL 실측 대기. 이는 harness 진단 보완이며 제품 기능 정식 실패로 세지 않는다. |
| `R6_PROVIDER_401_BODY_TIMEOUT_R9` | `5b9a574` WSL에서 response 객체가 있는 Provider 401의 `response.text()`만 bounded 만료. 유한 JSONResponse이지만 App의 `!response.ok` 분기는 body를 소비하지 않는다. 인과관계는 미확정이므로 실제 401을 무시하지 않고, 그 실패 때만 Content-Length·Transfer-Encoding의 고정 형태, `response.finished()`의 bounded 완료, 별도 same-origin native fetch의 401 본문 읽힘 여부를 고정 열거값으로 수집한다. 원문 header/body/URL은 출력하지 않는다. | 새 SHA WSL probe 결과로 서버 전송/브라우저 fetch/Playwright event 캡처 경계를 좁혀야 함. 전체 E2E 미통과는 유지. |

## 로컬 실행 증거

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py` (RED) | 1 | `_validated_target` 미구현 ImportError, 1 FAIL/1 SKIP. 격리 guard의 예상 RED. |
| 동일 명령 (최종 재검증) | 0 | 3 PASS/1 SKIP, 1.98초. SKIP은 opt-in PG15/브라우저 실측 미실행. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | Node 구문 PASS. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd) | 0 | 기존 Dashboard 17/17 PASS. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py` | 1 | 42 PASS/1 SKIP/1 ERROR. 기존 R3a `tmp_path` fixture가 기본 `%TEMP%\pytest-of-cyhuh` ACL 접근거부. 제품 실패로 집계하지 않음. |
| 동일 인접 명령 `--basetemp=.pytest_tmp_f20_u01_r6_adjacent` 추가 | 0 | 42 PASS/2 SKIP, 7.92초. 두 SKIP은 R6와 기존 R3a의 격리 PG opt-in 미실행. |
| `.\.venv\Scripts\python.exe -B -c "import ast,pathlib; ast.parse(pathlib.Path('tests/integration/test_f20_u01_oidc_browser_pg15.py').read_text(encoding='utf-8'))"` | 0 | Python 구문 PASS. |
| `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py` | 0 | G-05 `PASS sequence=1822 reporting=AUTO_CONTINUE`. |
| `git diff --check` | 0 | tracked diff whitespace 오류 없음. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | 정상 same-origin HttpOnly Cookie 허용, request body 민감값·off-origin Cookie 음성 탐지 `R6_AUDIT_SELF_TEST_PASS`. |
| `-k container_guard` (리뷰 보완 RED) | 1 | `_validate_container_snapshot` 미구현 NameError 1 FAIL. 최초 작성 중 괄호 오류 수집 1 ERROR는 즉시 수정 후 재실행한 것으로 제품/환경 실패가 아님. |
| `-k 'container_guard or container_rejection'` (GREEN) | 0 | 2 PASS. 첫 시도의 monkeypatch 대상 alias 불일치로 Docker 없음 FileNotFoundError 1 FAIL은 테스트 결박을 고쳐 재실행. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_review_adjacent` | 0 | 리뷰 보완 후 44 PASS/2 SKIP, 6.99초. 두 SKIP은 실제 PG opt-in 미실행. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd, 리뷰 보완 후) | 0 | 기존 Dashboard 17/17 PASS. |
| `-k asgi_import` (WSL R1 보완 RED) | 1 | 별도 프로세스에서 `_import_asgi_for_r6` 미구현으로 1 FAIL/4 deselected. |
| 동일 명령 (GREEN) | 0 | 1 PASS/4 deselected, 4.76초. console URL/public host가 외부 환경에 없어도 ASGI 모듈 import 성공. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 | 0 | 4 PASS/1 SKIP, 5.10초. 실제 opt-in은 SKIP. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_asgi_adjacent` | 0 | 45 PASS/2 SKIP, 11.41초. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`, `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`, G-05 | 각 0 | Node syntax, `R6_AUDIT_SELF_TEST_PASS`, G-05 seq1822 PASS. |
| `-k browser_failure_classification` (WSL R2 보완 RED→GREEN) | 1→0 | 분류 함수 미구현 NameError 1 FAIL/5 deselected → 1 PASS/5 deselected, GREEN 1.81초. 고정 Node stage/Node-unhandled/npm/Docker/unknown과 원문 Secret 미반환 검사. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs` (의도적 필수 env 누락) | 1 | `R6_NODE_STARTED`와 `stage=BOOTSTRAP class=TypeError`만 출력. 실제 브라우저 E2E 증거가 아닌 marker 배선 음성. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 (R2) | 0 | 5 PASS/1 SKIP, 5.23초. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_runner_adjacent` | 0 | 46 PASS/2 SKIP, 10.90초. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`, audit self-test, G-05 (R2) | 각 0 | Node syntax, `R6_AUDIT_SELF_TEST_PASS`, G-05 seq1822 PASS. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd, R2) | 0 | 기존 Dashboard 17/17 PASS. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R3 RED→GREEN) | 1→0 | `captureResponseFact` 미구현 ReferenceError → `R6_AUDIT_SELF_TEST_PASS`. 지연된 200 body·request header 실패가 unhandled 종료 없이 settled 실패로 남고 최종 감사에서 throw함을 확인. 204/301/302/303/304/307/308 body 미가용은 빈 body 허용. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` (R3) | 0 | Node 구문 PASS. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 (R3) | 0 | 5 PASS/1 SKIP, 5.40초. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_settled_adjacent` | 0 | 46 PASS/2 SKIP, 10.67초. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd, R3), G-05 | 각 0 | Dashboard 17/17 PASS, G-05 seq1822 PASS. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R4 RED→GREEN) | 1→0 | `readyDashboard` 미구현 ReferenceError → `R6_AUDIT_SELF_TEST_PASS`; goto/reload 모두 `domcontentloaded`와 실제 카드 visible 대기를 호출하는지 검사. |
| `-k browser_failure_classification` (R4 RED→GREEN) | 1→0 | 새 `PRE_AUTH_DOCUMENT/TimeoutError` whitelist 누락으로 1 FAIL/5 deselected → 1 PASS/5 deselected. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` (R4) | 0 | Node 구문 PASS. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 (R4) | 0 | 5 PASS/1 SKIP, 4.82초. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_nav_adjacent` | 0 | 46 PASS/2 SKIP, 11.25초. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd, R4), G-05 | 각 0 | Dashboard 17/17 PASS, G-05 seq1822 PASS. |
| `-k timeout_reports` (R5 RED→GREEN) | 1→0 | 부분 stdout bytes에 `PRE_AUTH_CARD` 뒤 미허용 단계·비밀이 있어도 이전 `RUNNER`만 보고하여 1 FAIL/6 deselected → 마지막 허용 stage만 보고 1 PASS/6 deselected, 1.89초. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R5 RED→GREEN) | 1→0 | `markStage` 미구현 ReferenceError → whitelist stage 즉시 출력과 비허용 stage 거부, `R6_AUDIT_SELF_TEST_PASS`. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 (R5) | 0 | 6 PASS/1 SKIP, 3.84초. 구 stage명 분류 테스트를 현 세분 stage명으로 갱신. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_progress_adjacent` | 0 | 47 PASS/2 SKIP, 7.63초. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R6 RED→GREEN) | 1→0 | 합성 200 alert body 영구 pending의 500ms 음성에서 `R6_SELF_TEST_CAPTURE_TIMEOUT` → 기본 10초(테스트 주입 60ms) bounded 실패와 `R6_RESPONSE_CAPTURE_FAILED category=ALERT_API status=200 reason=TIMEOUT`, `R6_AUDIT_SELF_TEST_PASS`. 204/302/304 빈 body 예외 유지. |
| `-k response_capture_failure_reports` (R6 RED→GREEN) | 1→0 | Python이 category/status를 누락하여 1 FAIL/7 deselected → whitelist 진단만 부착해 1 PASS/7 deselected. 원문 Secret 미출력. |
| `-k timeout_reports` (R6 최종 진단 RED→GREEN) | 1→0 | 안전 응답 marker가 부분 stdout bytes에 있어도 timeout 실패 문자열에서 누락되는 음성 1 FAIL/7 deselected → 허용 category/status/reason만 부착해 1 PASS/7 deselected. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` 단독 (R6) | 0 | 7 PASS/1 SKIP, 5.93초. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_response_adjacent` | 0 | 48 PASS/2 SKIP, 8.69초. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_response_final` | 0 | 마지막 timeout 진단 보완 포함 48 PASS/2 SKIP, 10.45초. |
| `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd, R6), G-05 | 각 0 | Dashboard 17/17 PASS, G-05 seq1822 PASS. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R7 RED→GREEN) | 1→0 | navigation 전에 세 API response waiter가 없어서 `0 !== 3` RED → 카드 visible만으로 완료되지 않고 세 응답 본문 캡처가 모두 끝나야 phase가 끝남. 합성 Provider 401 캡처 TIMEOUT은 phase에서 `R6_RESPONSE_CAPTURE_FAILED category=PROVIDER_API status=401 reason=TIMEOUT`으로 fail-close. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k browser_failure_classification` (R7 RED→GREEN) | 1→0 | `PRE_AUTH_RESPONSES` 단계 미분류 1 FAIL/7 deselected → whitelist 단계 분류 1 PASS/7 deselected. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_phase_adjacent` | 0 | R7 포함 48 PASS/2 SKIP, 10.32초. |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`, `node --import tsx --test tests/f15-console.test.mjs` (`apps/web` cwd), G-05, `git diff --check` (R7) | 각 0 | Node 구문, Dashboard 17/17, G-05 seq1822, whitespace PASS. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k phase_response_failure_reports` (R8 RED→GREEN) | 1→0 | phase의 capture 401/TIMEOUT·wait 0/WAIT_TIMEOUT·capture 연결 200/CAPTURE_MISSING가 모두 안전 진단에서 누락되어 3 FAIL/8 deselected → 3 PASS/8 deselected. Secret 원문 미포함. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R8 RED→GREEN) | 1→0 | 합성 waiter reject가 `R6_DASHBOARD_RESPONSE_MISSING`로 뭉쳐 RED → `R6_PHASE_RESPONSE_FAILED category=PROVIDER_API status=0 reason=WAIT_TIMEOUT`로 fail-close. 연결 누락은 `status=401 reason=CAPTURE_MISSING`, 본문 실패는 기존 `status=401 reason=TIMEOUT`으로 분리, self-test PASS. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_phase_diag_adjacent` | 0 | R8 포함 51 PASS/2 SKIP, 9.22초. |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (R9 RED→GREEN) | 1→0 | `probeResponseTransport` 미구현 ReferenceError → 고정 헤더 형태/finished/native 401 분리, 기존 401 capture TIMEOUT은 그대로 실패, `R6_AUDIT_SELF_TEST_PASS`. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k provider_401_probe` (R9 RED→GREEN) | 1→0 | 안전 probe marker가 Python 실패 진단에 누락되어 1 FAIL/11 deselected → whitelist enum만 전달해 1 PASS/11 deselected. 원문 비밀 미포함. |
| `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py tests/api/test_oidc_asgi_binding.py --basetemp=.pytest_tmp_f20_u01_r6_body_diag_adjacent` | 0 | R9 포함 52 PASS/2 SKIP, 11.85초. |

Main의 사전 WORK_STATUS 기록 뒤 전용 `.pytest_tmp_f20_u01_r6_adjacent`를 사용했다. 실경로는 현재 worktree 내부, 내부 `current` reparse link 1개의 대상도 같은 폴더 내부였다. 정확한 폴더 한 곳만 `Remove-Item -LiteralPath ... -Recurse -Force`로 제거했고 `R6_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 기본 `%TEMP%`의 접근권한은 바꾸지 않았다. R6 TLS 전용 `tests/integration/.anvil-f20-u01-r6-oidc-host`는 로컬에서 생성하지 않았다.

리뷰 재검증의 `.pytest_tmp_f20_u01_r6_review_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 실제 경로는 현재 worktree 내부, `current` reparse link 1개의 대상도 같은 base 내부였다. 정확한 base만 제거해 `R6_REVIEW_ADJACENT_TEMP_RESIDUE_ZERO` exit0, TLS 전용 경로는 여전히 미생성이다.

R1 재작업의 `.pytest_tmp_f20_u01_r6_asgi_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_ASGI_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R2 분류 보완의 `.pytest_tmp_f20_u01_r6_runner_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_RUNNER_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R3 수집 보완의 `.pytest_tmp_f20_u01_r6_settled_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_SETTLED_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R4 탐색 보완의 `.pytest_tmp_f20_u01_r6_nav_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_NAV_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R5 진행 marker의 `.pytest_tmp_f20_u01_r6_progress_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_PROGRESS_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R6 응답 캡처의 `.pytest_tmp_f20_u01_r6_response_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_RESPONSE_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R6 마지막 timeout 진단 포함 `.pytest_tmp_f20_u01_r6_response_final`도 Main이 WORK_STATUS에 생성 전 기록하고 사전 부재를 확인했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_RESPONSE_FINAL_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R7의 `.pytest_tmp_f20_u01_r6_phase_adjacent`도 Main이 WORK_STATUS에 생성 전 기록하고 사전 부재를 확인했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_PHASE_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R8의 `.pytest_tmp_f20_u01_r6_phase_diag_adjacent`도 Main이 WORK_STATUS에 생성 전 기록하고 사전 부재를 확인했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_PHASE_DIAG_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R9의 `.pytest_tmp_f20_u01_r6_body_diag_adjacent`도 Main이 WORK_STATUS에 생성 전 기록하고 사전 부재를 확인했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_BODY_DIAG_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

## WSL R1 실제 실패

- Main 실행 기준 SHA `3b312b092721a692e126cbcd6c27fbccf6f1fb60`: opt-in `1 failed/3 deselected in 3.08s`, fingerprint `R6_ASGI_IMPORT_CONSOLE_BASE_URL_MISSING_R1`. Python test 332행의 `importlib.import_module('apps.api.anvil_api.asgi')`가 module-level `create_runtime_app()`에서 `RuntimeConfigurationError: ANVIL_CONSOLE_BASE_URL is required`로 중단됐다. 이는 PG seed 이후이며 브라우저 시작 전이다. Main은 전용 PG 컨테이너 신원 확인 뒤 stop/자동제거를 WORK_STATUS에 기록했으며 공유 자원은 변경하지 않았다.
- R1 수정은 실제 임시 HTTPS `api_url`을 module import 시점 `os.environ`에 주입하고 `pytest.MonkeyPatch.context()` 종료 시 복원한다. 제품 API·schema·UI·권한은 그대로다. `8ef1359` WSL opt-in은 이 import 지점을 통과했으나 browser runner에서 별도 실패했다.

## WSL R2 실제 실패와 분류 경계

- Main 실행 기준 SHA `8ef1359a77404d128151b6f95dc4ba8d468597bf`: ASGI import는 통과했으나 browser runner exit1, pytest `1 failed/4 deselected in 39.88s`, 안전 진단은 `R6_BROWSER_FAILED stage=RUNNER exit=1 class=ProcessError`였다. 별도 동일 Docker image/argv의 합성 URL smoke는 pinned npm 설치·Node 실행까지 도달하여 `stage=PRE_AUTH class=Error`를 출력했다. smoke는 실제 R6 원인을 확정하지 않는다.
- R2에서는 Node가 시작되면 값 없는 `R6_NODE_STARTED`를 내고, Python이 허용된 marker만 해석한다. marker 없고 npm/Docker 고정 오류가 있으면 각각 `NPM_INSTALL`/`CONTAINER_START`, 시작 marker 뒤 실패 marker가 없으면 `NODE_UNHANDLED`, 어느 쪽도 아니면 `PRE_NODE_UNKNOWN`으로 분류한다. 이는 원인 노출이 아닌 단계 분류다. 원문 출력·argv·비밀은 실패 결과에 포함하지 않는다.

## WSL R3 실제 실패와 미확정 원인

- Main 실행 기준 SHA `b98eb9c77c6c95d63af0d367e9995728297edac2`: opt-in `1 failed/5 deselected in 38.27s`, `R6_BROWSER_FAILED stage=NODE_UNHANDLED exit=1 class=UnhandledError`. Node 시작은 확인됐지만 top-level catch marker가 없어 정확한 reject 위치는 미확정이다.
- 코드 경계 검토에서 detached 비동기 작업은 `page.on('request'/'response')`의 수집 Promise 두 곳이었다. 그 밖의 issuer 호출, page load/fetch, browser close는 `await` 또는 main catch에 연결되어 있다. R3는 수집 실패를 버리지 않고 `NETWORK_AUDIT`의 `AssertionError`로 실패시킨다. WSL 재실측 전 성공 또는 원인 확정으로 표시하지 않는다.

## WSL R4 실제 실패와 탐색 기준

- Main 실행 기준 SHA `2b7d7b030084074bfa0669270266f48b3c60971e`: opt-in `1 failed/5 deselected in 38.04s`, `R6_BROWSER_FAILED stage=PRE_AUTH exit=1 class=TimeoutError`. R3의 Node unhandled는 이 실행에서 재현되지 않았으나 브라우저 검증은 초반 대기에서 중단됐다.
- PRE_AUTH의 `page.goto(networkidle)`가 기본 30초 만료와 가장 잘 맞는 추론이다. R4는 이 과도한 전체 Network 유휴 조건을 `domcontentloaded`+Critical Alerts 카드 visible로 대체했다. 명시적인 alerts API 401, 저장 row와 철회 후 화면 검증은 제거하거나 PASS로 우회하지 않았다. 새 stage marker가 다음 WSL의 실제 await 경계를 식별한다.

## WSL R5 실제 timeout과 분리된 연결성 진단

- Main 실행 기준 SHA `d7ab58599fb5b6571571a8655485c441c0329021`: opt-in `1 failed/5 deselected in 122.87s`, `R6_BROWSER_FAILED stage=RUNNER exit=TIMEOUT class=TimeoutExpired`. Docker CLI 자식 종료 뒤에도 정확한 `--rm` browser container가 running이어서 Main이 image/mount/host network와 PG label을 확인한 후 해당 browser·PG 두 컨테이너만 stop/자동제거해 잔여0을 확인했다. 이는 브라우저 E2E PASS가 아니다.
- Main의 일회성 연결성 실측은 WSL-server Python `127.0.0.1:18545` listener에 같은 Playwright image `--network host` Node TCP가 접속해 `R6_LOOPBACK_CONNECTED`/Docker exit0이었고, listener·port·container 잔여0이었다. 따라서 Docker host network와 WSL loopback 분리 가설은 이 환경에서 반증됐다. R5 보완은 주소를 바꾸지 않는다.

## WSL R6 실제 timeout과 응답 계약

- Main 실행 기준 SHA `495e5bcbfd7a99164de47bff175947d7a55136c5`: opt-in `1 failed/6 deselected in 122.28s`, `R6_BROWSER_FAILED stage=NETWORK_RESPONSE_FACTS exit=TIMEOUT class=TimeoutExpired`. Docker logs의 허용 stage marker도 동일했다. OIDC/저장 경고/철회 403/화면 제거 단계까지 도달했지만 최종 전체 Network 감사는 완료되지 않았다. Main은 정확한 browser image/read-only mount/host network와 PG label 확인 뒤 두 전용 컨테이너만 stop/자동제거하고 잔여0을 확인했다.
- 코드상 `/api/runs/{id}/events`는 `StreamingResponse`가 아니라 유한 `Response(encode_sse(events), media_type='text/event-stream')`이고 Dashboard는 SSE/EventSource를 시작하지 않는다. 그러므로 R6의 200 응답을 스트리밍 예외로 head-only PASS 처리할 근거가 없다. 204/304/redirect만 기존 빈 body 예외를 유지하며 200 body 미가용은 정확한 category/status/reason으로 fail-close한다.

## WSL R7 실제 Provider 401 캡처 실패와 phase 경계

- Main 실행 기준 SHA `dafa66c44f5d48cc41daec05c380b406ac8868d7`: opt-in `1 failed/7 deselected in 11.69s`, `R6_BROWSER_FAILED stage=NETWORK_RESPONSE_FACTS exit=1 class=Error category=PROVIDER_API status=401 reason=TIMEOUT`. OIDC·저장 row·철회 403·화면 stale-clear 단계는 지나갔으나 전체 Network 감사는 실패했다. 401을 허용해 PASS 처리하지 않는다.
- Dashboard는 초기 render 뒤 Health·Provider·Alerts를 비동기로 요청하고 navigation cleanup에서 요청을 abort한다. 카드가 visible인 시점은 세 요청의 본문 수집 완료를 보장하지 않는다. 초기 Provider 401이 그 취소에 걸렸을 가능성은 추론이며, R7은 각 화면 phase의 세 응답 event와 기존 수집 Promise의 성공을 다음 navigation 전에 요구한다. missing response 또는 unreadable/timeout 본문은 그 phase에서 실패한다.

## WSL R8 실제 phase 실패와 분류 경계

- Main 실행 기준 SHA `1a9806a06534bd71807dcd63da43adb15437f924`: opt-in `1 failed/7 deselected in 10.68s`, `R6_BROWSER_FAILED stage=PRE_AUTH_RESPONSES exit=1 class=Error`. 세 response waiter의 10초 만료와 총 시간이 부합하지만, 당시 Python은 phase의 안전 marker를 전달하지 않아 누락 category나 다른 오류 여부는 확정 불가다. Main은 정확한 격리 PG 자원을 정리해 WORK_STATUS에 기록했다.
- `apps/web/src/console/main.tsx`는 `<App/>`만 렌더하며 StrictMode는 없다. Health·Provider·Alerts를 시작하는 초기 Effect는 존재한다. R8은 이 제품 흐름을 바꾸지 않고 waiter별 settled 결과와 캡처 연결 여부를 고정 category/status/reason으로 구분한다. 본문 캡처 실패는 기존 fail-close이고 401·200 모두 예외로 승격하지 않는다. 이 실패는 테스트 harness 진단 경계로 분류하며 정식 제품 실패 횟수에 넣지 않는다.

## WSL R9 실제 Provider 401 본문 실패와 미확정 원인

- Main 실행 기준 SHA `5b9a574b10a109c1c0a1abff9fcf512dbbcc2583`: opt-in `1 failed/10 deselected in 9.20s`, `R6_BROWSER_FAILED stage=PRE_AUTH_RESPONSES exit=1 class=Error category=PROVIDER_API status=401 reason=TIMEOUT`. 401 response 객체가 있었고 waiter·WeakMap 연결은 통과했지만 Playwright `response.text()` body 캡처가 만료됐다. Main은 전용 PG를 확인·정리해 WORK_STATUS에 기록했다.
- 테스트 listener는 Uvicorn HTTPS, 인증 실패 응답은 `_error_response`의 유한 `JSONResponse`. Dashboard `loadProviderRegistration`은 비인증 `!response.ok`에서 본문을 읽지 않고 UNAVAILABLE을 반환한다. 이 분기가 Chromium 원 응답의 body 완료를 방해하는지는 아직 증거가 없다. R9 probe에서 `finished=DONE`이고 `native=READABLE_401`이면 원 요청의 Playwright event body 캡처 경계가 의심되고, 둘 다 실패하면 서버/transport/브라우저 측 추가 분리가 필요하다. 어느 결과도 기존 capture 실패를 PASS로 바꾸지 않는다.

## 미검증과 다음 행동

- WSL R1은 ASGI import, R2는 runner exit1, R3는 Node unhandled, R4는 PRE_AUTH TimeoutError, R5는 runner 120초 timeout, R6는 responseFacts 미완료, R7은 Provider 401 본문 TIMEOUT, R8은 PRE_AUTH_RESPONSES 미분류, R9는 Provider 401 본문 TIMEOUT에서 중단됐다. 실제 cookie/저장 경고 DOM 일부는 도달했지만 전체 same-origin Network/secret 비노출·DB 최종 확인을 포함한 E2E PASS가 아니다. 새 SHA에서 안전 probe와 전체 opt-in 재실행이 필요하다. 401/200을 허용하거나 검증을 생략하지 않는다.
- Main은 R6 diff·경계 독립 검토 후 exact3만 새 commit/private push하고 동일 SHA 격리 checkout에서 새 일회성 자원·path·port와 정리법을 생성 전에 WORK_STATUS에 기록해야 한다. 실행 때 `ANVIL_F20_R6_PG_DSN`, `ANVIL_F20_R6_PG_ISOLATED=1`, `ANVIL_F20_R6_FRONTEND_DIST`(그 checkout의 `apps/web/dist`), `ANVIL_PLAYWRIGHT_MODULE`(pinned Playwright module)을 주입한다. WSL host Node18에는 Playwright module이 없으므로, 사전 기록한 pinned Playwright 1.62.1 container의 전체 JSON argv를 `ANVIL_F20_R6_BROWSER_COMMAND_JSON`에 준다. container는 host loopback HTTPS listener에 닿아야 하고 `ANVIL_F20_R6_API_URL/ISSUER_URL/ALERT_CODE/CONTROL_TOKEN/ALERT_ENTITY/ALERT_CAUSE/SECRET_VALUES_JSON` 일곱 환경변수를 `-e NAME`으로만 전달해야 한다. 값은 임시 시험 프로세스에서만 사용하고 출력하지 않는다. 테스트 stdout의 `R6_E2E_EVIDENCE`와 정확한 exit, DB/Network/DOM 결과, 임시 자원 잔류0을 이 보고서에 후속 기록해야 한다. timeout이면 Python이 Docker CLI 자식을 종료하더라도 container가 남을 수 있어 Main의 사전 명명 대상 확인·정리 절차가 필수다.
- 정식 WSL entity/checkout, 실제 로그인 화면 클릭, E-SHOT와 전체 E-NET formal acceptance, 다른 Dashboard Health/Next Actions/ack, 전체 U-01/F-20 수락, C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, 사용자 인수와 Production은 계속 미검증이다.

## rollback

R9 시작 SHA `5b9a574`까지의 기존 제품 테스트 commit은 Main이 보존한다. 이번 미커밋 Provider 401 probe는 exact3의 Python 테스트·Node 브라우저·본 보고서 diff만 되돌리면 R9 직전 상태로 돌아간다. 통합 전체 rollback 판단은 Main이 정확한 commit·자원 소유를 확인해 수행하며 다른 dirty/untracked 자료, 원장, 진행 문서, 공유 자원은 건드리지 않는다. WSL 실행 뒤에는 Main이 사전 기록한 정확한 일회성 자원만 확인·제거한다.
