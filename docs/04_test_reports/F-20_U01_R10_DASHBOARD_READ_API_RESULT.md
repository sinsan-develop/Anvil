# F-20/U-01 R10 Dashboard 읽기 API Developer 결과

## 판정

`COMPLETED` — 리뷰 Important1·Minor1 보완을 포함한 로컬 R10 구현·TDD·F-13/OIDC 인접 회귀에 한정한다. Main 독립 재검토와 U-01/F-20 전체 수락, WSL 실제 DB/API 검증 판정은 Main 소유다.

## 기준·범위

- 담당: `developer-primary-f20-u01-r10`; branch `codex/f18-wsl-ops`; 시작 HEAD `407d0aa0b779dc830e347ccfee316fec2b52c5db`.
- 시작 Git status: Main 소유 `docs/WORK_STATUS.md` dirty. 이 파일은 수정·복구·stage하지 않았다. 수행 중 Main 소유 `tests/tooling/test_f20_u01_r10_start_projection.py` dirty도 별도 관측했으며 건드리지 않았다.
- 기준 R10 계획 SHA-256 `C7FF3B1915C9834AF3E2E1E2E5F355D4DF074B7A68C35718A382CDE1B97D9A85`; WorkInstruction SHA-256 `1C1F2E197889FCD447EF126926BDB54EE64C955FDBEA9FD6798A636D3BC4EB02`.
- 제품 시작 전 canonical G-05 `PASS sequence=1852 reporting=AUTO_CONTINUE` exit 0; epoch23 worker/write 모두 `ACTIVE`, actor `developer-primary-f20-u01-r10`, exact5 path scope, 만료 `2026-09-30T16:20:21+09:00` 확인.

## 변경·근거

- `packages/api/registry.py`: canonical `GET /api/dashboard/operations`와 별도 `dashboard:read` permission 등록.
- `packages/api/operations.py`: trusted Operations owner의 `snapshot()`만 읽는 포트 추가. principal·resolver의 project/environment 일치 검사 재사용. snapshot의 기존 12개 필드만 허용하고 source/owner 예외 및 잘못된 결과를 안정 코드 `DASHBOARD_SOURCE_UNAVAILABLE`/503으로 차단.
- `tests/api/test_f20_u01_r10_dashboard_api.py`: registry 권한, scope 거부, UNKNOWN/gap, fresh Queue, legacy·limit·DB 오류 503, GET 무변경 검증.
- `tests/api/test_f20_u01_r10_oidc_dashboard.py`: OIDC coordinator 세션 경로에서 무세션 401, 전용 permission 200, 기존 alert permission 미부여 403 검증.
- 이 결과보고서. 기존 alert/audit GET 동작을 변경하지 않았다.

## 독립 리뷰 보완

- Important1 원인: Dashboard 응답은 top-level 필드만 검사했으며 `OperationsService._state()`가 persisted `DETECTED` alert의 추가 key를 복사해 정상 200의 `alerts`에 `credential`/`payload`를 실을 수 있었다. 제품 변경 전 오염 row 테스트에서 실제로 `credential`가 노출돼 RED 1 failed/6 passed, exit 1을 확인했다.
- 조치: Dashboard 포트에서만 승인된 alert 필드로 각 행을 새로 만들고, 중첩 객체·배열 같은 비정상 필드 값은 안정 503으로 차단한다. `next_actions`도 필터링된 alert에서 새로 만든다. F-13 owner 내부와 기존 alert/audit route는 변경하지 않았다. 추가 중첩값 테스트도 RED 1 failed/7 passed, exit 1에서 GREEN으로 전환했다.
- Minor1: 실제 `DurableQueue`에 101개 job을 enqueue하고 scoped loader→Dashboard API 경계가 503 `DASHBOARD_SOURCE_UNAVAILABLE`이며 payload 비노출임을 확인했다. 이는 로컬 Queue owner 테스트이며 실제 PostgreSQL 검증은 아니다.

## scoped re-review 보완

- Important1 원인: 앞선 allowlist는 key와 scalar 타입만 확인해 canonical `cause` 대신 `postgresql://secret:credential@host/db`를 저장한 alert가 정상 200과 `next_actions.reason`으로 노출될 수 있었다. 새 테스트는 수정 전 `1 failed, 8 passed` exit 1로 실제 200을 재현했다.
- 조치: Dashboard의 저장 alert 값은 `packages/persistence/operations_repository.py`의 canonical F-13 `_safe_event` 규칙으로 재검증한 뒤에만 반환한다. 검증 대상은 기존 필드의 초기 DETECTED projection이며 `sequence`는 별도로 양의 정수 검사한다. 현재 `status`/`owner_id`는 open 또는 안전한 acknowledged/resolved 상태만 허용한다. 알 수 없는 extra key는 앞선 보완처럼 출력에서 제거하고, 규칙 위반은 안정 503으로 닫는다. marker blacklist만 추가하지 않았으며 기존 alert/audit route나 F-13 owner 저장·읽기 동작은 변경하지 않았다.
- 정상 canonical alert 및 ACKNOWLEDGED→RESOLVED 상태가 Dashboard 200으로 유지되고 resolved의 `next_actions`가 비는 테스트를 추가했다. `-B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r10_dev` 동일 인접 범위 최종 `167 passed, 1 skipped in 10.35s`, exit 0. 전체 suite·실제 PostgreSQL은 Main 검증 전 미실행이다.
- 이번 전용 pytest base는 재사용 전 부재 확인. 종료 시 다른 순간적 Python 프로세스 감지로 삭제 0/보류 2회 후, 정확한 worktree 내부 경로·root non-reparse·내부 link13 대상 모두 base 내부·Python/pytest 프로세스0을 다시 확인했다. 정확한 `.pytest_tmp_f20_u01_r10_dev`만 제거해 잔여0이다. Main 전용 pytest base는 건드리지 않았다.

## 명령·실제 결과

1. 기본 `python -B scripts/check_project_progress.py`: 로컬 `python` 명령 부재로 exit 1. bundled Python으로 같은 checker 재호출: `G-05 project progress contract: PASS sequence=1852 reporting=AUTO_CONTINUE`, exit 0. 호출 환경 오류이며 제품 테스트 실패로 세지 않는다.
2. `C:\\Users\\cyhuh\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r10_dev tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py`: `No module named pytest`, exit 1. worktree Python으로 전환. 이 호출은 테스트 수집 전 환경 실패다.
3. `.venv\\Scripts\\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r10_dev tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py`: 구현 전 RED `5 failed`(route 404/registry KeyError), exit 1. 최소 registry/port 구현 후 동일 명령 GREEN `5 passed`, exit 0.
4. `.venv\\Scripts\\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r10_dev tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f13_operations_api.py tests/api/test_oidc_asgi_binding.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_oidc_process.py tests/api/test_oidc_principal.py tests/api/test_oidc_runtime_factory.py tests/api/test_oidc_session_coordinator.py`: fresh Queue/legacy API 테스트 추가 후 `162 passed, 1 skipped in 8.77s`, exit 0. skip은 기존 opt-in 실제 PG15 검증이며 PASS로 환산하지 않는다. 전체 repository suite는 실행하지 않았다.
5. `git diff --check`: exit 0. 제품 patch는 위 exact5에 한정. Commit/push/merge/새 branch/WSL-server/ysna/Production 접근은 수행하지 않았다.
6. 리뷰 보완 후 같은 pytest 인접 명령: `165 passed, 1 skipped in 9.78s`, exit 0. 전체 repository suite는 미실행. 작업 중 G-05 재호출은 `F20_U01_R10_GIT_INVALID` exit 1이었고, 이는 dirty 작업 상태 판정이다. 시작 시 clean control seq1852 PASS를 현재 dirty 상태의 PASS로 대체하지 않는다.

## 임시 자원·미검증·rollback

- pytest base 정확한 경로 `.pytest_tmp_f20_u01_r10_dev`는 생성 전 부재. 종료 시 worktree 내부 실경로, root non-reparse, 내부 link 13개 모두 base 내부, Python/pytest 프로세스 0을 확인했다. 첫 정리 시 CIM 열람 권한 거부로 삭제 0; 재확인 후 정확한 base만 제거해 잔여 0. 공유 DB·서비스·다른 pytest base 변경 없음.
- 미검증: WSL-server 동일 SHA 실제 PostgreSQL15/API, 실제 OIDC 로그인·브라우저 E-SHOT/E-NET, 전체 suite, UI, U-01/F-20 수락. OIDC 신규 테스트는 실제 OIDC 발급 대신 coordinator의 세션 인증 경계를 사용한다.
- rollback: Main이 제품 exact4의 R10 diff를 되돌리고 R10 결과보고서와 해당 증거를 별도 기록으로 보존한다. 기존 Main dirty 파일은 rollback 대상이 아니다.
