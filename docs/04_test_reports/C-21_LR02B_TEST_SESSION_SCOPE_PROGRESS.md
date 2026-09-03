# C-21 / LR-02B Test-session Scope 작업현황

- 상태: `COMPLETED_PENDING_MAIN_REVIEW`
- 담당 Agent: `developer-primary`
- WorkInstruction: `WI-C-21-LR-02B-20260903-001`
- WorkInstruction SHA-256: `1B8F561E90B76DCC30CA200AE327D48ED71785FADCE1D18B94CA3D06C90696E2`
- 기준 branch/HEAD: `codex/c21-lifecycle-runtime` / `4178eee2ffeb0d5701e1fac058d89891331c74c2`
- Worker lease: `worker-lease-c21-lr02b-20260903-001`
- Execution token: `c21-lr02b-execution-fence-epoch-1-4178eee`
- Write lease: `write-lease-c21-lr02b-20260903-001`
- Write token: `c21-lr02b-write-fence-epoch-1-4178eee`
- 동일 근본 원인 failure fingerprint: `C21_LR02B_YSNA_DUPLICATE_SCOPE_ASSIGNMENT_PREFLIGHT_BYPASS`
- 유효 실패 횟수: `1`

## 시작 기준선

- 시작 시 `git status --short --branch`: Main Agent 소유 LR-02B start projection 9개 경로가 modified/untracked였고 Developer exact12 제품·테스트 경로는 clean이었다.
- Developer는 Main/governance 경로와 seq1~428을 수정하지 않았다.
- 부모 승인 SHA-256: `1CB18CA1492D624EE950769AD8AEB4165E52F4C1DB30A4D04965E244BDDB407A`

## 구현 결과

- `ANVIL_TEST_SESSION_PERMISSION_SCOPES`는 `tasks:write`, `tasks:read`, `run:events:read`만 허용한다.
- wildcard, unknown, duplicate, 빈 항목 및 앞뒤/항목 공백은 startup에서 fail-close 한다.
- 환경변수가 없으면 기존 `run:events:read` read-only 세션을 유지한다.
- test-session authorization scope는 Task create/read, Run create, Run events SSE 네 endpoint에만 해석된다.
- Task create는 path project와 body target environment를 설정값에 정확히 결박한다.
- Task read와 Run create는 DB Task authority의 project/environment가 설정값과 정확히 일치해야 한다.
- SSE는 기존 `ANVIL_TEST_SESSION_RUN_IDS` explicit allowlist를 유지한다.
- ysna deploy와 verify는 정확한 세 permission 문자열을 필수로 재검증한다.
- ReleaseManifest 초안에 동일한 permission scope 목록을 구조적으로 기록했다.
- 독립검토 R1에서 deploy/verify의 중복 scope assignment preflight 우회가 확인됐다. 두 스크립트 모두 assignment 전체 개수를 먼저 세어 정확히 1개인지 검증한 후 그 단일 값을 canonical 값과 비교하도록 수정했다.
- 격리 shell harness에서 `유효→축소`, `축소→유효` 두 중복 순서를 deploy exit 4, verify exit 7로 모두 거부한다.

## TDD 및 검증 기록

| 단계 | 명령 | 종료 코드 | 실제 결과 |
|---|---|---:|---|
| RED-1 | bundled Python `-m pytest tests/api/test_local_session.py -q` | 1 | `7 failed, 14 passed`; 환경변수 무시 및 config 필드 부재 확인 |
| GREEN-1 | bundled Python `-m pytest tests/api/test_local_session.py -q` | 0 | `21 passed` |
| RED-2 보정 전 | bundled Python `-m pytest tests/api/test_local_session.py -q` | 1 | 핵심 403와 테스트 GET 호출 오류 2건 분리 |
| RED-2 | bundled Python `-m pytest tests/api/test_local_session.py -q` | 1 | `1 failed, 27 passed`; 네 endpoint resolver 미구현 확인 |
| GREEN-2 | bundled Python `-m pytest tests/api/test_local_session.py -q` | 0 | `28 passed` |
| RED-3 | bundled Python `-m pytest tests/deploy/test_ysna_deployment_contract.py tests/deploy/test_ysna_scripts_contract.py -q` | 1 | `2 failed, 16 passed`; deploy가 scope 누락/축소를 수용함 |
| GREEN-3 | 같은 deploy 명령 | 0 | `18 passed` |
| RED-4 | `.venv/Scripts/python.exe -m pytest tests/deploy/test_ysna_deployment_contract.py -q` | 1 | `1 failed, 11 passed`; manifest 필드 부재 |
| GREEN-4 | 같은 manifest focused 명령 | 0 | `12 passed` |
| Focused API | bundled Python `-m pytest tests/api/test_local_session.py tests/api/test_runtime_app.py -q` | 0 | `32 passed` |
| 전체 API 1차 | bundled Python `-m pytest tests/api -q` | 1 | `98 passed, 1 failed`; bundled Python의 `alembic` 모듈 부재 |
| 전체 API 재검증 | `.venv/Scripts/python.exe -m pytest tests/api -q` | 0 | `99 passed` |
| Deploy 재검증 | `.venv/Scripts/python.exe -m pytest tests/deploy/test_ysna_deployment_contract.py tests/deploy/test_ysna_scripts_contract.py -q` | 0 | `18 passed` |
| Progress checker | `.venv/Scripts/python.exe scripts/check_project_progress.py` | 0 | `PASS sequence=428 reporting=AUTO_CONTINUE` |
| Diff check | `git diff --check` | 0 | 출력 없음 |
| R1 duplicate RED | `.venv/Scripts/python.exe -m pytest tests/deploy/test_ysna_scripts_contract.py -q` | 1 | `1 failed, 5 passed`; 중복 assignment 자체를 탐지하지 않는 오류 재현 |
| R1 duplicate GREEN | 같은 shell harness 명령 | 0 | `6 passed`; 두 중복 순서의 deploy/verify 거부 확인 |
| R1 전체 API 재검증 | `.venv/Scripts/python.exe -m pytest tests/api -q` | 0 | `99 passed` |
| R1 Deploy 재검증 | `.venv/Scripts/python.exe -m pytest tests/deploy/test_ysna_deployment_contract.py tests/deploy/test_ysna_scripts_contract.py -q` | 0 | `18 passed` |
| R1 Progress checker | `.venv/Scripts/python.exe scripts/check_project_progress.py` | 0 | `PASS sequence=428 reporting=AUTO_CONTINUE` |
| R1 Diff check | `git diff --check` | 0 | 출력 없음 |

실행환경 오류는 제품 failure fingerprint로 집계하지 않았다. 첫 오류는 존재하지 않는 Python 경로였고, 두 번째는 bundled Python의 Alembic 미설치였다. canonical `.venv` 재실행으로 전체 API 결과를 확인했다. 독립검토의 중복 assignment preflight bypass만 유효 실패 1회로 집계했다.

## 변경 경로

1. `packages/api/local_session.py`
2. `packages/api/runtime.py`
3. `tests/api/test_local_session.py`
4. `deploy/ysna/deploy.sh`
5. `deploy/ysna/verify.sh`
6. `deploy/ysna/ReleaseManifest.C21.DRAFT.json`
7. `tests/deploy/test_ysna_deployment_contract.py`
8. `tests/deploy/test_ysna_scripts_contract.py`
9. `docs/04_test_reports/C-21_LR02B_TEST_SESSION_SCOPE_PROGRESS.md`
10. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_EVIDENCE_MANIFEST.json`
11. `.superpowers/sdd/Anvil_작업계획서_v1/task-3-report.md`

`tests/api/test_runtime_app.py`는 허용 경로지만 변경하지 않았다.

## 미검증·제외 범위

- 실제 PostgreSQL/Production Task·Run 생성: `NOT_EXECUTED`
- 외부 SSH/Docker/DB/NPM/Telegram/Provider 호출: `NOT_EXECUTED`
- ysna 배포와 실제 public HTTPS/SSE: `NOT_EXECUTED`
- migration, project_repositories 변경, NPM/DNS 변경: `NOT_EXECUTED`
- UI/OIDC/RBAC 관리: `NOT_EXECUTED`
- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`

## Rollback

Main Agent가 이 Work Package의 위 11개 Developer 경로 변경만 폐기한다. 기존 seq1~428, LR-02A 및 Main start projection은 변경하지 않는다.

## 다음 조치

Main Agent가 diff와 EvidenceManifest를 독립 검토하고, lease 회수 및 completion projection 여부를 판정한다.
