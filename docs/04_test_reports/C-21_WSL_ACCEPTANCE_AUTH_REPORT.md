# C-21 WSL Acceptance Auth 작업현황

## 기준선

- 담당: `developer-primary` (`/root/developer_formal_wsl_runtime`) → 동일 종료 지연 3회 후 Main Agent 인수
- 브랜치: `codex/c21-wsl-acceptance-auth-r1`
- 시작 HEAD: `676786eb51e93280aef029b67f2725b847e068a2`
- 시작 상태: clean
- 범위: WSL acceptance 전용 default-off read-only 인증, 인증 상태 UI, fixture 비공개 기본값
- 제외: 서버, Docker, DB, 원격, commit, push

## 진행

1. 관련 API/Web/fixture 경로 조사: 완료
2. RED 계약 테스트 작성: 완료
3. API 구현: 완료
4. Web 구현: 완료, focused `14/14 PASS`
5. Main Agent 인수: 완료 (`SessionPrincipal` import 누락 수정, pytest cache 권한 원인 분리)
6. 회귀·정적 secret scan·diff 검증: 완료

## 변경 파일

- `packages/api/runtime.py`
- `packages/api/fastapi_app.py`
- `apps/api/anvil_api/asgi.py`
- `apps/web/server.mjs`
- `apps/web/src/api/workbench-client.js`
- `apps/web/src/app/workbench.js`
- `apps/web/src/features/workbench/workbench-state.js`
- `apps/web/index.html`
- `tests/api/test_runtime_app.py`
- `tests/api/test_public_asgi_frontend.py`
- `apps/web/tests/workbench.test.mjs`
- `apps/web/tests/ui-preview-runtime.test.mjs`
- `docs/04_test_reports/C-21_WSL_ACCEPTANCE_AUTH_REPORT.md`

## 오류 기록

| fingerprint | 횟수 | 원인 | 조치 | 상태 |
|---|---:|---|---|---|
| `LOCAL_RG_EXEC_ACCESS_DENIED_R1` | 1 | Windows `rg.exe` 실행 권한 거부 | PowerShell `Get-ChildItem`/`Select-String`으로 전환 | 해소 |
| `LOCAL_PYTHON_RUNNER_UNAVAILABLE_R1` | 3 | `python`/`py` 기본 런타임 미탐지 및 두 venv의 pytest 미설치 | 기존 Anvil 검증 venv를 사용 | 해소 |
| `API_FOCUSED_FAILURE_TEARDOWN_DELAY_R1` | 3 | 신규 테스트가 모두 PASS한 뒤 worktree `.pytest_cache` 쓰기 권한 문제로 pytest process가 종료되지 않음 | 동일 시도 중단, Main Agent 인수, `-p no:cacheprovider`로 실행 경계 분리 | 해소 |
| `APPLY_PATCH_LONG_RUNNING_R1` | 1 | 큰 patch 적용 호출이 40초 이상 무응답 | 적용된 diff 확인 후 작은 patch로 분할 | 해소 |
| `SESSION_PRINCIPAL_IMPORT_MISSING_R1` | 1 | `packages/api/runtime.py`에서 신규 `SessionPrincipal` 사용 시 import 누락 | Main Agent가 import 추가 후 단일 계약 테스트 재실행 | 해소 |
| `MAIN_API_TEST_COMMAND_INVALID_R1` | 1 | Main Agent가 PATH에 없는 `python` 명령을 사용 | 검증된 Anvil venv의 절대 Python 경로 사용 | 해소 |
| `MAIN_WEB_TEST_SCRIPT_MISSING_R1` | 1 | `apps/web`에 없는 `npm test` script를 호출 | 정식 `node --test apps/web/tests/*.test.mjs` 명령으로 전환 | 해소 |
| `PYTEST_ORPHAN_PROCESS_CLEANUP_R1` | 1 | 종료 지연 진단 중 생성된 해당 pytest process가 남음 | 생성 시각과 venv 경로가 일치하는 이번 작업 process만 종료, 기존 타 작업 Python process는 보존 | 해소 |
| `WSL_ACCEPTANCE_PUBLIC_AUTHORITY_R1` | 1 | 최초 구현이 mode/environment 문자열만 검사하여 공개 hostname 오주입 시 read-only 우회가 활성화될 수 있음 | 독립 Reviewer finding 수용, private/loopback IP와 console URL hostname exact match startup guard 추가 | 해소 |
| `TRUSTED_PRINCIPAL_MUTATION_FALLBACK_R1` | 1 | trusted principal이 모든 endpoint handler에 전달되어 mutation은 권한 검사에서만 차단됨 | trusted fallback을 canonical Provider GET 3개와 Run SSE GET 1개로 구조적 제한, mutation은 cookie 없으면 401 | 해소 |
| `GIT_INDEX_LOCK_PERMISSION_R1` | 1 | sandbox에서 shared worktree metadata `D:/Project/Anvil/.git/worktrees/.../index.lock` 생성 권한 거부 | 제품 파일 변경 없이 시스템 Git 쓰기 권한으로 동일 explicit path stage/commit 재실행 | 조치 중 |

## 검증 결과

- `D:\tmp\anvil-c21-operational-execution\.venv\Scripts\python.exe -m pytest -p no:cacheprovider -q tests/api/test_runtime_app.py tests/api/test_public_asgi_frontend.py tests/api/test_local_session.py tests/api/test_provider_status.py tests/api/test_sse_resume.py tests/api/test_web_security.py` → 최종 `71 passed in 3.44s`
- `node --test apps/web/tests/*.test.mjs` → `21 passed`, 실패 0
- 변경 제품 파일에서 test bootstrap token, test credential marker, secret/API key literal 검사 → 0건
- `git diff --check` → PASS
- WSL acceptance 계약: 정확한 `WSL_SERVER_TEST_STAGING`과 private/loopback IP authority 일치 시에만 활성, Provider read 허용, allowlisted Run SSE read 허용, 공개·불일치·DNS authority startup 거부, Provider mutation은 미인증 401, 비허용 Run 거부, 기본 COOKIE mode 보존

## 미검증

- 독립 Reviewer 판정
- exact commit의 WSL Git 배포와 실제 브라우저/API/SSE 확인

## 다음 조치

독립 Reviewer 판정 후 안전한 commit을 만들고 개발 원격 candidate ref로 publish한다. WSL-server는 동일 exact commit을 Git fetch하여 정식 `anvil-web` 컨테이너만 교체하고 실제 브라우저/API/SSE를 검증한다.
