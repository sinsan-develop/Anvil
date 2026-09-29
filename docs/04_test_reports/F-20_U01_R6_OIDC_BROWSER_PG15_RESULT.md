# F-20/U-01 R6 OIDC·브라우저·PG15 결과보고 (WSL R2 분류 보완)

## 판정

`LOCAL_GREEN; WSL_R2_BROWSER_RUNNER_EXIT1; E2E_NOT_PASSED`. R1 ASGI import 오류는 다음 SHA `8ef1359a77404d128151b6f95dc4ba8d468597bf`의 WSL opt-in에서 통과했다. 그러나 browser runner가 exit1이고 기존 분류는 `RUNNER/ProcessError`뿐이라 Docker/npm과 Node 비정상 종료를 구분하지 못했다. exact3 안에 비밀 없는 Node 시작 marker와 출력 원문을 노출하지 않는 실패 분류를 RED→GREEN으로 보완했다. 새 SHA의 실제 E2E 재실행 전까지 PASS가 아니다. 이 보고는 U-01/F-20 수락, C30 사고 해소, Production 검증이 아니다.

## 판단 이유와 기준선

- 시작 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `4f06ceedf197252e3fc7990e3b8e2b61024f6cb2`, 시작 제품 Git status clean. Main이 별도 관리하는 `docs/WORK_STATUS.md` 갱신은 본 writer의 exact3 변경에 포함하지 않는다.
- R1 재작업 시작 HEAD `3b312b092721a692e126cbcd6c27fbccf6f1fb60`, branch `codex/f18-wsl-ops`, 제품 Git status clean. Main의 `docs/WORK_STATUS.md` 사전 기록은 별도 소유다.
- R2 분류 보완 시작 HEAD `8ef1359a77404d128151b6f95dc4ba8d468597bf`, 같은 branch, 제품 Git status clean. Main의 `docs/WORK_STATUS.md`는 별도 소유다.
- canonical seq1822, actor `developer-primary-f20-u01-r6`, epoch18 worker `worker-lease-f20-u01-r6-r6oidcstart1`/execution token `f20-u01-r6-execution-fence-epoch-18-r6oidcstart1`, 종속 write `write-lease-f20-u01-r6-r6oidcstart1`/write token `f20-u01-r6-write-fence-epoch-18-r6oidcstart1`, 둘 다 ACTIVE·만료 `2026-09-29T14:19:55+00:00`, 발급 dispatch `6d946bb9792e328ae97233726ac6322fece4f68f`. G-05 seq1822 PASS 후 정확한 세 파일만 작성했다.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R6 WI `7BFE973A0741B5E00493DE2884F15F3741EB260043433BC140F3FF15146C27A0`, Invocation `0A0CA362F4F7294581A340F734AF36D8609A4DF04D46FB79FAD86E00B5F53A45`.

## 조치·diff

| 파일 | 변경 |
|---|---|
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` | 격리 DSN 뒤 Docker inspect의 exact SHA7 container·QA label·PG15·AutoRemove·loopback5545·data tmpfs·volume/bind 0을 DB 접속/seed 전에 검사, 기존 factory와 저장 Operations owner, 임시 HTTPS IdP/API, 시험 전용 role 철회 control, Node 결과·audit 무변경·세션 확인, 정확한 TLS 파일/row/listener 정리. R1 import 환경 보완, R2 stdout/stderr 고정 marker·npm/Docker/Node 구분 및 Secret-safe 음성 테스트 |
| `tests/browser/f20-u01-oidc-browser-pg15.mjs` | 단일 Chromium context의 401→same-origin authorization/callback→Secure·HttpOnly session→저장 Critical API·DOM→권한 철회 403/재표시 stale-clear, 별도 issuer request context, 모든 page request origin/민감값 URL·header·body·response·DOM 검사, 저장 row code/entity/cause API↔DOM 대조. R2는 시작 시 값 없는 `R6_NODE_STARTED` marker만 추가 |
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
| `R6_BROWSER_RUNNER_UNCLASSIFIED_R2` | `8ef1359` WSL에서 ASGI import는 통과했지만 runner exit1의 Node stage marker가 기존 stderr regex에는 없었다. Python은 stdout/stderr 양쪽의 whitelist stage/class marker만 반환하고 Node 시작 marker·npm 오류·Docker 오류·원인 미확정 pre-Node를 고정 범주로 구분한다. Node 시작 시 값 없는 marker 1행 추가. 원문 stderr/stdout/URL/비밀은 출력하지 않는다. | 다음 WSL 재실행에서 실제 분류를 관측해야 한다. 응답 Promise unhandled 가설은 미확정이다. |

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

Main의 사전 WORK_STATUS 기록 뒤 전용 `.pytest_tmp_f20_u01_r6_adjacent`를 사용했다. 실경로는 현재 worktree 내부, 내부 `current` reparse link 1개의 대상도 같은 폴더 내부였다. 정확한 폴더 한 곳만 `Remove-Item -LiteralPath ... -Recurse -Force`로 제거했고 `R6_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 기본 `%TEMP%`의 접근권한은 바꾸지 않았다. R6 TLS 전용 `tests/integration/.anvil-f20-u01-r6-oidc-host`는 로컬에서 생성하지 않았다.

리뷰 재검증의 `.pytest_tmp_f20_u01_r6_review_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 실제 경로는 현재 worktree 내부, `current` reparse link 1개의 대상도 같은 base 내부였다. 정확한 base만 제거해 `R6_REVIEW_ADJACENT_TEMP_RESIDUE_ZERO` exit0, TLS 전용 경로는 여전히 미생성이다.

R1 재작업의 `.pytest_tmp_f20_u01_r6_asgi_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_ASGI_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

R2 분류 보완의 `.pytest_tmp_f20_u01_r6_runner_adjacent`도 Main이 WORK_STATUS에 생성 전 기록했다. 현재 worktree 내부 실경로와 내부 reparse link 1개의 같은 base 대상 확인 뒤 정확한 base만 제거해 `R6_RUNNER_ADJACENT_TEMP_RESIDUE_ZERO` exit0이다. 로컬 TLS 전용 경로는 미생성이다.

## WSL R1 실제 실패

- Main 실행 기준 SHA `3b312b092721a692e126cbcd6c27fbccf6f1fb60`: opt-in `1 failed/3 deselected in 3.08s`, fingerprint `R6_ASGI_IMPORT_CONSOLE_BASE_URL_MISSING_R1`. Python test 332행의 `importlib.import_module('apps.api.anvil_api.asgi')`가 module-level `create_runtime_app()`에서 `RuntimeConfigurationError: ANVIL_CONSOLE_BASE_URL is required`로 중단됐다. 이는 PG seed 이후이며 브라우저 시작 전이다. Main은 전용 PG 컨테이너 신원 확인 뒤 stop/자동제거를 WORK_STATUS에 기록했으며 공유 자원은 변경하지 않았다.
- R1 수정은 실제 임시 HTTPS `api_url`을 module import 시점 `os.environ`에 주입하고 `pytest.MonkeyPatch.context()` 종료 시 복원한다. 제품 API·schema·UI·권한은 그대로다. `8ef1359` WSL opt-in은 이 import 지점을 통과했으나 browser runner에서 별도 실패했다.

## WSL R2 실제 실패와 분류 경계

- Main 실행 기준 SHA `8ef1359a77404d128151b6f95dc4ba8d468597bf`: ASGI import는 통과했으나 browser runner exit1, pytest `1 failed/4 deselected in 39.88s`, 안전 진단은 `R6_BROWSER_FAILED stage=RUNNER exit=1 class=ProcessError`였다. 별도 동일 Docker image/argv의 합성 URL smoke는 pinned npm 설치·Node 실행까지 도달하여 `stage=PRE_AUTH class=Error`를 출력했다. smoke는 실제 R6 원인을 확정하지 않는다.
- R2에서는 Node가 시작되면 값 없는 `R6_NODE_STARTED`를 내고, Python이 허용된 marker만 해석한다. marker 없고 npm/Docker 고정 오류가 있으면 각각 `NPM_INSTALL`/`CONTAINER_START`, 시작 marker 뒤 실패 marker가 없으면 `NODE_UNHANDLED`, 어느 쪽도 아니면 `PRE_NODE_UNKNOWN`으로 분류한다. 이는 원인 노출이 아닌 단계 분류다. 원문 출력·argv·비밀은 실패 결과에 포함하지 않는다.

## 미검증과 다음 행동

- WSL R1은 ASGI import에서, R2는 browser runner exit1에서 중단됐다. 실제 cookie/저장 경고 DOM/same-origin Network/secret 비노출은 아직 PASS가 아니다. 새 SHA에서 단계 분류가 붙은 전체 opt-in 재실행이 필요하다. 그 결과가 `NODE_UNHANDLED`이면 수집 중 미처리 response Promise 가설을 재현·검증한 뒤 실패를 숨기지 않는 방식으로 보완한다.
- Main은 R2 diff·경계 독립 검토 후 exact3만 새 commit/private push하고 동일 SHA 격리 checkout에서 새 일회성 자원·path·port와 정리법을 생성 전에 WORK_STATUS에 기록해야 한다. 실행 때 `ANVIL_F20_R6_PG_DSN`, `ANVIL_F20_R6_PG_ISOLATED=1`, `ANVIL_F20_R6_FRONTEND_DIST`(그 checkout의 `apps/web/dist`), `ANVIL_PLAYWRIGHT_MODULE`(pinned Playwright module)을 주입한다. WSL host Node18에는 Playwright module이 없으므로, 사전 기록한 pinned Playwright 1.62.1 container의 전체 JSON argv를 `ANVIL_F20_R6_BROWSER_COMMAND_JSON`에 준다. container는 host loopback HTTPS listener에 닿아야 하고 `ANVIL_F20_R6_API_URL/ISSUER_URL/ALERT_CODE/CONTROL_TOKEN/ALERT_ENTITY/ALERT_CAUSE/SECRET_VALUES_JSON` 일곱 환경변수를 `-e NAME`으로만 전달해야 한다. 값은 임시 시험 프로세스에서만 사용하고 출력하지 않는다. 테스트 stdout의 `R6_E2E_EVIDENCE`와 정확한 exit, DB/Network/DOM 결과, 임시 자원 잔류0을 이 보고서에 후속 기록해야 한다. timeout이면 Python이 Docker CLI 자식을 종료하더라도 container가 남을 수 있어 Main의 사전 명명 대상 확인·정리 절차가 필수다.
- 정식 WSL entity/checkout, 실제 로그인 화면 클릭, E-SHOT와 전체 E-NET formal acceptance, 다른 Dashboard Health/Next Actions/ack, 전체 U-01/F-20 수락, C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, 사용자 인수와 Production은 계속 미검증이다.

## rollback

R2 시작 SHA `8ef1359`까지의 기존 제품 테스트 commit은 Main이 보존한다. 이번 미커밋 분류 보완은 exact3의 Python 테스트·Node 브라우저·본 보고서 diff만 되돌리면 R2 직전 상태로 돌아간다. 통합 전체 rollback 판단은 Main이 정확한 commit·자원 소유를 확인해 수행하며 다른 dirty/untracked 자료, 원장, 진행 문서, 공유 자원은 건드리지 않는다. WSL 실행 뒤에는 Main이 사전 기록한 정확한 일회성 자원만 확인·제거한다.
