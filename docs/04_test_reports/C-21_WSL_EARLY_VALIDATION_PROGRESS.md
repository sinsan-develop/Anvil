# C-21 WSL 선행검증 작업현황

- 시작 시각: 2026-09-04T15:20:00+09:00
- 담당: `developer-primary-wsl`
- 시작 HEAD: `ca92b7845eda803cff3c432799642e4f9243d4d6`
- branch/upstream: `codex/c21-operational-execution` / `origin/codex/c21-operational-execution`
- 시작 상태: clean, HEAD/upstream 동기화
- 현재 판정: `INCOMPLETE / IMPLEMENTATION_CHECKPOINT_PENDING_MAIN_BINDING`

## 누적 작업

1. 권위 문서, progress/HANDOFF, seq483 readiness report/manifest, Git 상태를 확인했다.
2. 기존 `deploy/ysna`의 origin/main ancestry, 공개 도메인, Telegram/Provider, shared-db 결합을 WSL에서 재사용하지 않기로 확정했다.
3. 실패하는 WSL harness 계약 테스트를 먼저 추가했다.
   - 최초 실행: 4 tests, failures 6, errors 1, exit 1
   - 원인: candidate guard와 entrypoint 및 draft manifest 미구현
4. `deploy/wsl` 독립 candidate guard, Compose, bootstrap, deploy, verify, rollback을 구현했다.
5. candidate feature remote mismatch와 fail-closed invalid SHA를 실제 임시 Git 저장소/프로세스로 검증했다.
   - REWORK2 GREEN: backup receipt 선행 gate와 exact-name/multi-label cleanup 계약을 포함해 6 tests PASS, exit 0
6. Bash syntax와 diff whitespace를 확인했다.
   - `bash -n ...`: exit 0
   - `git diff --check`: exit 0
7. 시스템 Python이 아닌 저장소 `.venv`로 신규 계약 테스트를 재검증했다.
   - `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q`: 4 PASS, exit 0
8. 전체 `pytest` 수집도 실행했다.
   - `.venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider`: exit 1
   - 신규 WSL 테스트가 아닌 기존 suite 구성 문제로 collection 중단: `PyYAML` 미설치 1건, 동일 basename test module import mismatch 3건, fixture 내부 샘플 test를 root suite가 수집한 `src` import 실패 3건
   - 제품/WSL harness 실패로 승격하지 않았고 전체 suite는 `BLOCKED_BY_EXISTING_TEST_COLLECTION`으로 기록한다.
9. 권한 확장 후 `wsl.exe -l -v`를 재실행해 `Ubuntu` WSL2가 `Running`임을 확인했다.
10. Ubuntu에서 실행 도구 준비 상태를 읽기 전용으로 확인했다.
   - 계정 `daon`, Docker Server `29.1.3`, Docker Compose `v5.1.1`, psql `16.15`, Git `2.43.0`
   - 실제 배포는 Git exact SHA 결박 전이므로 실행하지 않았다.
11. backup receipt의 migration 선행 검증과 격리 PG18 RC 자동 cleanup 계약을 추가하려 했으나 시스템 안전 게이트가 `down --volumes` 및 재귀 삭제를 기존 자료 삭제 위험으로 거부했다.
   - 거부 후 우회하지 않았고 실패하는 임시 테스트 변경은 제거했다.
   - 현재 deploy는 pre-migration dump 생성, `pg_restore --list`, checksum receipt 기록까지 구현되어 있으나 별도 receipt 재검증 함수와 PG18 volume 자동 cleanup은 미구현이다.
12. REWORK2에서 신산님의 exact34 및 WSL 전용 두 volume 삭제 추가 승인을 인수했다.
   - backup receipt checksum/commit/target/status를 migration 직전에 별도 재검증하도록 보완했다.
   - cleanup은 별도 자동 실행하지 않고 `cleanup_wsl_test_volumes` 명시 호출 함수로 구현했다. 두 exact volume, 고정 Compose project label, WSL staging environment label, cleanup-scope label을 모두 선검증한 뒤에만 삭제한다.
   - 실제 container/volume 삭제는 이번 로컬 단계에서 실행하지 않았다.
13. REWORK2 최종 비파괴 로컬 검증을 완료했다.
   - `python -B scripts/check_project_progress.py`: PASS, sequence 485
   - `pytest tests/tooling/test_project_progress.py`: 96 PASS
   - `pytest tests/deploy/test_wsl_staging_harness.py`: 6 PASS
   - 모든 `deploy/wsl/*.sh` `bash -n`: PASS
   - `git diff --check`: PASS
   - validated base `eef3496` 대비 실제 누적 변경과 repository allowlist: exact34 일치

## 변경 경로

- `deploy/wsl/CandidateReleaseManifest.json`
- `deploy/wsl/Dockerfile.web`
- `deploy/wsl/requirements-runtime.txt`
- `deploy/wsl/candidate-manifest-guard.sh`
- `deploy/wsl/common.sh`
- `deploy/wsl/compose.wsl.yml`
- `deploy/wsl/bootstrap.sh`
- `deploy/wsl/deploy.sh`
- `deploy/wsl/verify.sh`
- `deploy/wsl/rollback.sh`
- `tests/deploy/test_wsl_staging_harness.py`
- `docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md`
- `docs/work_orders/C-21_WSL_EARLY_VALIDATION_INVOCATION_PROMPT.md`
- 이 보고서와 successor progress/HANDOFF/event/checker 경로

## 오류 기록

| fingerprint | 횟수 | 상태 | 조치 |
|---|---:|---|---|
| `WSL_HARNESS_MISSING` | 1 | CLOSED | RED 확인 후 독립 harness 구현 |
| `GIT_BASH_PYTHON3_UNAVAILABLE` | 1 | CLOSED | guard에 explicit `ANVIL_PYTHON` 실행경계 추가 |
| `TEST_EXPECTED_WRONG_FAILURE_BRANCH` | 1 | CLOSED | source mismatch가 아닌 remote tip mismatch fixture로 정정 |
| `FULL_PYTEST_EXISTING_COLLECTION` | 1 | OPEN_NON_PRODUCT | 기존 dependency/import-name/fixture collection 문제 7건; 신규 집중 계약 테스트와 분리 |
| `WSL_LIST_SANDBOX_ACCESS_DENIED` | 1 | CLOSED | 승인된 read-only 권한 확장 재실행으로 Ubuntu WSL2 Running 확인 |
| `PG18_CLEANUP_SYSTEM_SAFETY_REJECTED` | 1 | OPEN | `down --volumes`/재귀 삭제가 기존 자료 삭제 위험으로 거부됨; Main 판단 필요 |
| `PG18_CLEANUP_SYSTEM_SAFETY_REJECTED_REWORK1` | 1 | CLOSED_BY_EXPLICIT_APPROVAL | exact name/label 방식 패치도 최초 승인 경계에서 거부; REWORK2 추가 승인 후 제한 구현 |
| `PROJECTION_BINDING_SYSTEM_SAFETY_REJECTED_REWORK1` | 1 | CLOSED_BY_EXPLICIT_APPROVAL | exact34/lease 결박 패치 거부; REWORK2 exact34 추가 승인으로 재개 |
| `PG18_EXACT_VOLUME_CLEANUP_SAFETY_REJECTED` | 2 | WAITING_APPROVAL | 고정 WSL Compose project와 label 검증을 포함한 exact named-volume 삭제 구현도 추가 파괴적 승인 없이는 거부됨 |
| `C21_WSL_EXACT34_PROJECTION_EXPANSION_REJECTED` | 2 | WAITING_APPROVAL | validated base 대비 기존 exact18과 신규 16경로의 누적 exact34 결박이 허용경로 확대에 해당하여 명시 승인 필요 |

세 오류는 서로 다른 근본 원인이며 동일 실패 3회 조건에 해당하지 않는다.

## 미검증 범위와 다음 조치

- 실제 WSL deployment/DB/API/SSE/backup-restore/rollback: `NOT_EXECUTED`
- 사유: 새 harness는 아직 Git commit/push되지 않아 서버의 exact SHA clean detached checkout으로 실행할 수 없다.
- Telegram/Provider: 승인대로 `NOT_EXECUTED`
- cleanup 실제 실행: `NOT_EXECUTED`; 최종 WSL 검증 뒤 명시 호출 대상으로 유지
- 다음 조치: Main Agent가 구현 commit을 생성한 뒤 draft candidate manifest를 그 exact SHA와 approval binding으로 갱신하여 별도 control commit으로 push한다. 그 후 이 Developer에게 WSL 실제 검증을 재지시한다.

## Main Agent 예외 판정

- exact34는 기존 historical 파일을 새로 수정할 권한이 아니라 `eef3496` 이후 이미 존재하는 exact18과 이번 신규 16경로를 합친 누적 Git projection이다.
- 시스템 안전 게이트가 exact17/18에서 exact34로의 선언 확대와 격리 테스트 volume 삭제 구현을 별도 명시 승인 대상으로 판정했다.
- 승인 전에는 candidate 구현 commit/push, WSL 배포, DB/volume 삭제를 수행하지 않는다.
