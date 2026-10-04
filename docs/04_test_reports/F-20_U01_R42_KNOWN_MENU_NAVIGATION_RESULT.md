# F-20/U-01 R42 알려진 메뉴 직접 진입 결과

## 판정

`COMPLETED` — 단일 Developer의 R42 로컬 구현·기본 검증 범위 완료 주장이다. Main의 독립 검토, exact-SHA WSL-server QA, U-01/F-20 인수 판정은 별개로 남는다.

## 판단 이유

- 기준: `codex/f18-wsl-ops`, 시작 clean/private HEAD `869672f78e15934cd8b37c25fe2692a7609943f1`; canonical G-05 seq2058. 설계/계획/매트릭스/테스트계획 SHA-256은 각각 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`로 WorkInstruction과 일치했다. R42 계획/WI/Invocation SHA-256은 각각 `ADF04CC6A6E3EF155971D27D397C25E5D9965D766F5EE5279C2C95FCF17E4568`, `FB511A705D1F9B29342D26311FBFF1E0977CDAB279762B138BEC381003B701B9`, `A166F010CE89896215EDFF4EB2427449F1C3CD004F78C43D5CDC24C381020211`이다.
- `developer-primary-f20-u01-r42`의 worker/write lease `worker-lease-f20-u01-r42-r42menu1004`/`write-lease-f20-u01-r42-r42menu1004`, epoch57, execution/write token `f20-u01-r42-execution-fence-epoch-57-r42menu1004`/`f20-u01-r42-write-fence-epoch-57-r42menu1004`는 작업 시작 시 ACTIVE이고 만료는 `2026-10-05T13:37:47+00:00`이었다. lease 기준 commit `97a917cc` 뒤의 HEAD `869672f7`까지는 Main의 R42 통제·현황 기록 commit이며 제품 exact5 파일 변경은 없었다.
- TDD RED: Python TestClient와 Node 실제 HTTP의 알려진 메뉴 직접 GET 테스트가 각각 `/workbench`의 `404 != 200`으로 예상 실패했다. 최소 구현 뒤 각각 1 PASS. 전체 알려진 메뉴 11개는 `/`와 동일한 HTML shell을 받는다. 미지/하위 경로, `/api/not-a-route`, `/auth/not-a-route`, `/health/not-a-route`, fixture 금지 경로는 404다. Preview/fixture mode의 `/projects`는 404이고 fixture opt-in 경로는 기존 200을 유지한다.
- 독립 Reviewer의 Important 1건은 Web 서버가 정규화된 URL pathname만으로 shell을 판단해 raw `/api/../projects` 등이 200이 되는 문제였다. raw `http.request` 회귀를 먼저 RED(`200 != 404`)로 확인했다. 수정 후 `/api/../projects`, `/auth/../settings`, `/health/../operations`, `/fixture-workbench/../projects`, `/api/..`는 404이고 정상 root·메뉴 query는 HTML 200이다. 이 리뷰 재작업은 1회이며 새 Critical/Important 발견은 없다.
- 이 판정은 HTML shell의 직접 진입만 다룬다. U-02~U-11 기능·read model, 실제 브라우저 클릭/Network, DB/Provider/WSL/Production은 확인하지 않았다.

## 조치와 변경 전후

- `packages/api/fastapi_app.py`: 이전에는 StaticFiles가 `/`와 실파일만 제공해 메뉴 직접 GET이 404였다. 이제 명시한 10개 비루트 메뉴의 GET을 StaticFiles mount 앞에 등록해 `index.html`을 반환한다. `/`와 기존 API·fixture 경로는 유지한다.
- `apps/web/server.mjs`: 이전에는 production에서 `/`만 `index.html`을 제공했다. 이제 production mode에서 `MENU_ITEMS`의 정확한 href만 같은 shell로 제공한다. raw 요청 경로와 정규화 pathname이 일치해야 shell 분기에 들어가므로 dot-segment 우회는 404다. Preview/fixture와 API proxy 순서는 유지한다.
- `tests/api/test_public_asgi_frontend.py`, `apps/web/tests/ui-preview-runtime.test.mjs`: 실제 HTTP로 메뉴 목록과 shell 동일성, 미지/API/fixture 경계, production 보안 헤더 및 preview/fixture 모드 회귀를 검증한다. Web은 raw `http.request`로 dot-segment 우회와 정상 query를 별도 검증한다.
- 이 결과보고서 외 제품·통제 파일 변경 없음. Main Event/progress/HANDOFF/WORK_STATUS 변경, Git add/commit/push, WSL-server·ysna-server·Production 접근 없음.

## 실행 증거 (Windows 로컬, 위 시작 HEAD의 작업 tree)

| 명령 | 종료 | 실제 결과 |
|---|---:|---|
| `node --test --test-name-pattern='production runtime serves only known menu paths' apps/web/tests/ui-preview-runtime.test.mjs` (구현 전) | 1 | RED 1 FAIL: `/workbench` 404 대 200 |
| `node --test --test-name-pattern='production runtime rejects raw paths' apps/web/tests/ui-preview-runtime.test.mjs` (리뷰 수정 전) | 1 | RED 1 FAIL: raw `/api/../projects` 200 대 404 |
| `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/api/test_public_asgi_frontend.py -k 'only_known_menu_paths' -x -vv --tb=short -p no:cacheprovider -o addopts=''` (구현 전) | 1 | RED 1 FAIL, 5 deselected: `/workbench` 404 대 200 |
| `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/api/test_public_asgi_frontend.py -k 'only_known_menu_paths' -x -q --tb=short -p no:cacheprovider -o addopts=''` (구현 후) | 0 | GREEN 1 passed, 5 deselected |
| 같은 Node focused 명령 (구현 후) | 0 | GREEN 1 passed, 0 failed |
| `node --test --test-name-pattern='production runtime rejects raw paths' apps/web/tests/ui-preview-runtime.test.mjs` (리뷰 수정 후) | 0 | GREEN 1 passed, 0 failed |
| `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/api/test_public_asgi_frontend.py tests/api/test_f15_web_security.py tests/api/test_web_security.py -q -p no:cacheprovider -o addopts=''` | 0 | 21 passed |
| `node --test apps/web/tests/ui-preview-runtime.test.mjs apps/web/tests/app-shell.test.mjs` | 0 | 리뷰 수정 뒤 9 passed, 0 failed |
| `npm run web:test` | 0 | 68 passed, 0 failed |
| `npm run web:typecheck` | 0 | TypeScript noEmit 성공 |
| `npm run web:lint` | 0 | 3 files, fixes 0 |
| `npm run web:build` | 0 | Vite 20 modules, build 성공; 생성 `apps/web/dist`는 정확 경로·하위 4항목·reparse 0을 확인하고 제거, 잔여 0 |
| `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' scripts/check_project_progress.py` | 0 | G-05 `PASS sequence=2058 reporting=AUTO_CONTINUE`, 결과보고 작성 후 재실행도 동일 |
| `git diff --check` | 0 | 공백 오류 없음 |

초기 `python -m pytest tests/api/test_public_asgi_frontend.py -q -k 'only_known_menu_paths' -o cache_dir=.pytest_cache_r42_red -o addopts=''`는 PATH에 `python`이 없어 실행 전 exit1이었다. 첫 가상환경 RED 시도(`$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/api/test_public_asgi_frontend.py -q -k 'only_known_menu_paths' -o cache_dir='D:/tmp/anvil-r42-pytest-red-cache' -o addopts=''`)는 TestClient context 종료가 지연돼 실패 표시 후 중단했다. 테스트의 context 사용을 제거하고 재실행해 예상 404 실패와 종료코드 1을 확보했다. 이 두 실행환경 문제는 제품 실패로 집계하지 않는다. 의도한 RED는 최초 양 서버 각 1회와 리뷰 raw 경로 1회이며 최종 회귀 실패 0, 리뷰 finding Important 1건 해결, 정식 `FAILURE_REPORT` 0회.

## 잔여와 복구

- Main 독립 diff/테스트 및 private checkpoint/정확 SHA WSL QA는 미실행. 브라우저 실제 클릭·Network, PostgreSQL/Provider, 운영 배포·사용자 인수는 `NOT_EXECUTED`다. F-20/U-01 수락·Release 판정은 변경하지 않았다.
- 복구는 Main이 이 exact5의 변경만 이전 clean HEAD `869672f78e15934cd8b37c25fe2692a7609943f1` 내용으로 되돌린 후 관련 HTTP 회귀를 다시 실행한다. 사용자 dirty/untracked·보존 branch에는 영향이 없다.
- progress/HANDOFF 및 `docs/WORK_STATUS.md` 갱신은 Main 소유로 이 Developer가 수행하지 않았다.
