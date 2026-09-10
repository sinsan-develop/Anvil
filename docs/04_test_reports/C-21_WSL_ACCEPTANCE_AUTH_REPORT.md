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
| `GIT_INDEX_LOCK_PERMISSION_R1` | 1 | sandbox에서 shared worktree metadata `D:/Project/Anvil/.git/worktrees/.../index.lock` 생성 권한 거부 | 제품 파일 변경 없이 시스템 Git 쓰기 권한으로 동일 explicit path stage/commit 재실행 | 해소 |

## 검증 결과

- `D:\tmp\anvil-c21-operational-execution\.venv\Scripts\python.exe -m pytest -p no:cacheprovider -q tests/api/test_runtime_app.py tests/api/test_public_asgi_frontend.py tests/api/test_local_session.py tests/api/test_provider_status.py tests/api/test_sse_resume.py tests/api/test_web_security.py` → 최종 `71 passed in 3.44s`
- `node --test apps/web/tests/*.test.mjs` → `21 passed`, 실패 0
- 변경 제품 파일에서 test bootstrap token, test credential marker, secret/API key literal 검사 → 0건
- `git diff --check` → PASS
- WSL acceptance 계약: 정확한 `WSL_SERVER_TEST_STAGING`과 private/loopback IP authority 일치 시에만 활성, Provider read 허용, allowlisted Run SSE read 허용, 공개·불일치·DNS authority startup 거부, Provider mutation은 미인증 401, 비허용 Run 거부, 기본 COOKIE mode 보존

## 독립 검토

- 판정: `COMPLETED`
- blocking finding: 0건
- 초기 IMPORTANT 2건(public/DNS authority, trusted principal mutation fallback)은 수정·재검토 완료
- 상세: `docs/04_test_reports/C-21_WSL_ACCEPTANCE_AUTH_REVIEW.md`

## 다음 조치

정식 Dashboard Shell을 `/`에 구현하고 현재 Provider Workbench를 Settings 보조 경로로 분리하는 다음 UI package를 시작한다.

## WSL 배포 진행 갱신

- local/product commit: `70ddf09257131b82490bab5ec86192b7631674b3`
- development ref: `refs/heads/candidates/c21-wsl-acceptance-auth-r1`
- WSL checkout: clean detached exact `70ddf09257131b82490bab5ec86192b7631674b3`
- WSL image: `anvil-web:70ddf09257131b82490bab5ec86192b7631674b3`
- image ID: `sha256:b3f6653b665553b85ab3ac9d558c52e964b2e5adf70e63f1c52062fbf28a5b53`
- OCI revision: exact `70ddf09257131b82490bab5ec86192b7631674b3`
- current runtime: `anvil-web` 동일 이름·포트 `3770`으로 정상 실행
- runtime auth: `WSL_ACCEPTANCE · wsl_acceptance_reader`
- UI: 실제 브라우저에서 `READY`, canonical 9개 Provider, UPSTAGE PRIMARY 렌더링 확인
- health: `/`, `/health/live`, `/health/ready` 모두 HTTP 200
- Provider API: `/api/providers` HTTP 200, 9개 행, 실제 Provider 호출 없음
- SSE: `c21-wsl-run` initial event 200, `Last-Event-ID: c21-wsl-event-1` 재개 200/0 bytes, invalid cursor 409, 비허용 Run 403
- formal test entities: `c21-wsl-task`, `c21-wsl-run`, `c21-wsl-event-1` 멱등 생성

### WSL 배포 오류 기록

| fingerprint | 횟수 | 원인 | 조치 | 상태 |
|---|---:|---|---|---|
| `WSL_GIT_FETCH_OWNERSHIP_R1` | 1 | `/srv/anvil-wsl/repo/.git`가 root 소유라 daon fetch의 `FETCH_HEAD` 쓰기 거부 | root Git에 기존 daon SSH config/key/known_hosts를 명시해 fetch | 해소 |
| `WSL_ROOT_GIT_HOSTKEY_R1` | 1 | root Git이 daon known_hosts를 사용하지 않아 host key 검증 실패 | 기존 daon key와 known_hosts를 명시 | 해소 |
| `WSL_BUILD_CONTEXT_GIT_PERMISSION_R1` | 1 | daon Docker client가 root 소유 `.git/logs/...`를 읽지 못함 | source 변경 없이 sudo Docker build | 해소 |
| `WSL_IMAGE_LABEL_INSPECT_QUOTE_R1` | 1 | Docker Go-template 따옴표 escape 오류 | ID와 JSON label을 별도 read-only inspect | 해소 |
| `WSL_HEALTH_POWERSHELL_EXPANSION_R1` | 1 | 원격 shell의 `$()`가 local PowerShell에서 먼저 평가됨 | 해당 polling 명령 중단, 단순 원격 명령으로 분리 | 해소 |
| `WSL_REQUIRED_RUNTIME_ENV_MISSING_R1` | 1 | 기존 컨테이너의 DB/Telegram 필수키가 `/srv/anvil-wsl/.env`가 아니라 삭제된 컨테이너의 explicit env에만 존재 | 신산님 명시 승인 후 기존 DB password reference와 WSL 검증용 signing 값으로 동일 container 재기동 | 해소 |
| `WSL_HEALTH_INSPECT_NO_METADATA_R1` | 1 | 새 container에는 Docker healthcheck metadata가 없어 `.State.Health.Status` template 실패 | HTTP `/health/live`·`/health/ready` 직접 검증; Docker health metadata는 후속 formal deploy control에 남김 | 비차단 |
| `WSL_HOST_HEADER_PROBE_R1` | 1 | loopback curl의 기본 Host `127.0.0.1`이 exact public host guard로 403 | `Host: 172.27.253.53`로 실제 브라우저 authority와 동일하게 재검증 | 해소 |
| `WSL_SSE_RUN_ID_MISMATCH_R1` | 1 | 최초 probe가 allowlist의 실제 `c21-wsl-run` 대신 `run-c21` 사용 | 비밀이 아닌 allowlist ID 확인 후 정식 Run ID 사용 | 해소 |
| `PLATFORM_GUARD_MUTATION_PROBE_R1` | 1 | Provider mutation POST가 read-only 검증 범위를 벗어나 시스템 안전 게이트 거부 | 우회하지 않고 POST 제외, 승인된 UI·health·Provider GET·SSE만 검증 | 해소 |

### 현재 판정

`WSL_ACCEPTANCE_AUTH_VALIDATED`. 실제 Provider·Telegram 외부 호출은 승인 범위대로 수행하지 않았다. Docker healthcheck metadata는 없지만 UI와 live/ready/API/SSE 경로는 실제 HTTP로 통과했다.
