# F-20/U-01 R3a 기존 Operations Alerts OIDC owner 결과 — Developer 제출

## 판정

`COMPLETED`(exact5 제품 구현 및 로컬 집중 검증 제출)이며, Main의 독립 검토·동일 SHA WSL-server 실제 PG15/OIDC 검증 전에는 `ACCEPTED`가 아니다. C30 원장 사고는 `OPEN_BLOCKING`, ReleaseDecision은 `DEFER`, U-01/F-20은 미수락, Production·`ysna-server`는 `NOT_EXECUTED`다. 기록된 경고 `alerts: []`는 해당 scope 저장 기록 부재만 의미한다.

## 기준선·소유권

- 시작 Git: `codex/f18-wsl-ops`, HEAD `85eee50b4ac0cf79b173bdcd0f94ab4f8e0ccaa6`, 지정 upstream `development/codex/f18-wsl-ops`; 시작 dirty는 Main 소유 `docs/WORK_STATUS.md` 한 경로였다. 새 branch/worktree 생성, commit/push/merge는 Developer가 수행하지 않았다.
- canonical G-05: seq1798 `evt_f20_1798_package_resumed` PASS. epoch14 `developer-primary-f20-u01-r3a` worker/write ACTIVE, issue `2026-09-28T14:56:09+00:00`, expiry `2026-09-29T02:56:09+00:00`; execution/write fencing token은 각각 `f20-u01-r3a-execution-fence-epoch-14-20260928r3a01`, `f20-u01-r3a-write-fence-epoch-14-20260928r3a01`. 제품 write는 발급된 exact5에 한정했다.
- 시작 문서 SHA-256: 설계서 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획서 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 통합검증매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획서 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R3a WI `AF6C2DA7A2F9429743B13800E30FCE4F64BA9C1C0DE4947EE4D216F72D43AB56`.
- Developer 변경 경로: `apps/api/anvil_api/oidc_process.py`, `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_process.py`, `tests/api/test_oidc_asgi_binding.py`, 이 결과 파일. Main 소유 `WORK_STATUS`와 Event/progress/HANDOFF/lease 파일은 수정하지 않았다.

## 변경 전후와 이유

- 변경 전: OIDC process의 고정 project/environment trust와 검증된 `ANVIL_DATABASE_URL`은 있었으나 Operations owner 전달이 없었고, 인증된 `GET /api/operations/alerts`는 501이었다.
- 변경 후: process가 같은 고정 scope로 `OperationsService(OperationsSources(), PostgresOperationsRepository)`를 구성해 구성형 ASGI→직접 ASGI→기존 runtime `operations_owner` 인자로 전달한다. `postgresql://`은 그대로, SQLAlchemy `postgresql+psycopg://`와 `postgresql+psycopg2://`는 `DatabaseSettings` 검증/정규화 뒤 psycopg용 `postgresql://`로 driver 접미사만 제거한다. URL의 사용자정보·host·database를 응답/로그에 넣지 않는다.
- 일반 `create_oidc_asgi_app()`과 구성형 팩토리는 owner를 명시 주입하지 않으면 기존 501을 유지한다. 기존 route·permission·응답 schema·DB schema/migration·Secret 변수는 변경하지 않았다. `OperationsSources()`의 Queue/Worker/Budget/Health 미연결 상태를 건강 PASS로 표시하지 않는다.
- 로컬 실제 서명 OIDC session의 read 경로에서 저장 경고 200, 미인증 401, `operations:alerts:read` 부재·타 project/environment 403, audit 분리 403, 저장소 오류 500 `INTERNAL_ERROR`, GET audit append 0을 검증했다. 이는 SQLite OIDC directory 및 in-memory audit repository의 로컬 계약 증거이며 실제 PostgreSQL PASS가 아니다.

## 실행 명령·결과

- RED: `.\.venv\Scripts\python.exe -B -m pytest -q tests/api/test_oidc_process.py -k 'scoped_operations_owner' --basetemp=runtime/pytest-r3a-developer-red -p no:cacheprovider --tb=short` → exit1, 3 FAIL, 기존 host kwargs에 `operations_owner` 없음(`KeyError`). 최소 process 구현 뒤 같은 선택 시험은 3 PASS.
- ASGI RED: `.\.venv\Scripts\python.exe -B -m pytest -q tests/api/test_oidc_asgi_binding.py -k 'scoped_stored_alerts or generic_oidc_factory_still' --basetemp=runtime/pytest-r3a-developer-red -p no:cacheprovider --tb=short` → exit1, 1 FAIL/1 PASS, 직접 팩토리의 `operations_owner` 인자 없음. 최소 구현 뒤 2 PASS.
- 구성형 전달 변이 음성: 전달 행만 임시 제거 후 `-k configured_oidc_factory_forwards_explicit_operations_owner` → exit1, `operations_bound=False`; 행 복원 뒤 집중 회귀 69 PASS. 임시 변이는 남기지 않았다.
- 최종 로컬 집중/인접: `.\.venv\Scripts\python.exe -B -m pytest -q tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py --basetemp=runtime/pytest-r3a-developer-green -p no:cacheprovider --tb=short` → exit0, **69 passed / 1 skipped**. skip 한 건은 opt-in 실제 PG15 미설정이며 PASS로 계상하지 않는다. `git diff --check`는 exit0.
- opt-in 공유 대상 차단 음성: `ANVIL_F20_R3A_PG_DSN=postgresql+psycopg://example:synthetic-secret@localhost:5432/shared`, `ANVIL_F20_R3A_PG_ISOLATED=1`로 해당 테스트만 실행 → 예상 exit1 `R3A_PG_TARGET_REJECTED`, 실제 DB 접속 전 거부, DSN/합성 비밀번호 출력 0.
- bare `pytest -q` 전체: 중복 모듈명과 `tests/fixtures/repositories` 내부 fixture 소스 수집으로 collection 13 ERROR/exit1; 제품 회귀 판정이 아니다. `tests --ignore=tests/fixtures --import-mode=importlib` 재실행은 약 28~29%에서 `F` 표시 19건, 이름·원인은 summary 전이므로 미확인이다. Main 지시로 중단해 exit1; **전체 suite 비녹색/미완료**이며 PASS나 해결로 표시하지 않는다. 정확한 명령: `.\.venv\Scripts\python.exe -B -m pytest -q tests --ignore=tests/fixtures --import-mode=importlib --basetemp=runtime/pytest-r3a-developer-regression -p no:cacheprovider --tb=short`. Main이 WSL exact SHA 정식 suite를 별도 수행한다.
- 로컬 Python launcher `py -3`는 설치 Python을 찾지 못해 exit1; worktree `.venv\Scripts\python.exe`를 사용했다. 이 도구 오류, TDD 예상 RED, collection 옵션 오류, 중단된 suite의 F는 유효 `FAILURE_REPORT` 횟수에 넣지 않는다. 정식 동일 결함 실패 횟수 0.

## WSL-server 실제 PG15/OIDC opt-in 실행 계약

Main이 지정 원격에서 제품 exact SHA를 Git으로 수신하고 **공유 `local-postgres`와 분리된** 일회성 PostgreSQL 15 DB/container를 만든 후, 기존 migration `0019_oidc_sessions`까지 적용한다. DSN은 실행 환경에만 `ANVIL_F20_R3A_PG_DSN`으로 전달하고 보고서·명령 로그에 Secret 원문을 남기지 않는다. `ANVIL_F20_R3A_PG_ISOLATED=1`도 필수다. DSN은 `127.0.0.1`의 1024 초과·5432 아닌 격리 포트, database `anvil_f20_r3a_` 접두사, 비-superuser role `anvil_f20_r3a_` 접두사, query 없는 PostgreSQL URI여야 한다. 테스트는 서버 major 15, 실제 DB/role, head0019 및 OIDC 6개·Operations audit 2개 테이블의 빈 상태를 읽기 전용으로 확인한 뒤에만 합성 OIDC directory와 audit 경고 1건을 삽입한다.

실행 예시(DSN 값은 Main의 비출력 환경 주입): `./.venv/bin/python -B -m pytest -q tests/api/test_oidc_asgi_binding.py -k opt_in_isolated_pg15_oidc_process_reads_stored_alerts --basetemp=<사전 기록한 전용 pytest 경로> -p no:cacheprovider --tb=short`. 이 테스트는 실제 psycopg/PostgreSQL의 저장 경고를 process→configured ASGI→runtime에서 200으로 읽고, 미인증 401, permission·cross-scope 403, 별도 loopback port 1 연결 거부의 repository에서 500 fail-closed, GET append 0을 확인한다. synthetic DB 행은 `finally`에서 제거하고 connection을 dispose한다. Main은 테스트 종료 후 전용 DB/container/pytest 경로·프로세스 잔류0을 독립 확인한다. 브라우저 Network·detector 완전성·Dashboard UI는 이 테스트로 검증되지 않는다.

## 정리·미검증·rollback

- 로컬 RED/GREEN/전체 pytest 전용 경로 세 곳은 모두 worktree `runtime` 하위 resolved path였다. reparse link 1/12/93개가 각각 해당 전용 경로 내부만 가리킴을 확인하고 정확한 세 폴더만 제거해 잔류0; 시험 Python 프로세스 0. Main 소유의 다른 runtime/dirty 자료는 보존했다.
- 미검증: WSL-server 실제 PG15/OIDC opt-in 실행, WSL exact SHA 전체 suite와 19개 표시 실패의 이름·원인, 실제 배포/브라우저, Queue/Worker/Backend detector·Dashboard Next Actions/UI, U-01/F-20 acceptance 및 C30 복구. 기존 skip/warning은 별도 최종 결과가 있어야 집계한다.
- rollback: Main의 R3a 제품 commit만 후속 정상 Git revert commit으로 되돌려 OIDC host의 Alerts 501로 복귀한다. DB schema·지속 데이터·기존 Event 원장/incident는 되돌리지 않는다. progress/HANDOFF 갱신과 commit/push/WSL 검증·lease 회수는 Main 소유다.

## R3a 실제 PG15 테스트 import 순서 보정 / Developer 재작업

- Main의 WSL-server exact SHA `36307cf33cf524840ffeeb9c65dd2fa6e1788e82`에서 격리 PG15 container와 migration `0019_oidc_sessions`는 준비됐으나 opt-in 테스트가 API 실행 전에 실패했다. `tests/api/test_oidc_asgi_binding.py`의 `asgi` import가 합성 프로세스 환경 구성보다 앞서 기본 앱을 즉시 생성했고, 외부 shell의 `TELEGRAM_WEBHOOK_SECRET` 또는 `ANVIL_DATABASE_URL` 유무에 종속됐다. WSL 본 테스트 200/401/403/500은 **미실행**이다. Main이 해당 전용 WSL 자원을 정리했다는 인수 정보를 받았으며 Developer는 WSL에 접속하거나 자원을 변경하지 않았다.
- 이 파일의 opt-in 테스트만 보정해 `asgi`를 합성 bootstrap 환경에서 import하며, 실제 테스트 대상 DSN은 이후 검증된 입력으로 OIDC process에 명시 전달한다. 외부 shell의 Telegram/OIDC Secret 존재에 의존하지 않는다. DB 사전 점검 connection timeout은 2초로 한정하고, 예외의 DSN·비밀번호가 pytest traceback에 나타나지 않도록 `R3A_PG_TARGET_REJECTED` / `R3A_PG_FLOW_FAILED`를 예외 블록 밖에서 출력한다. 공개 route·permission·schema·제품 구현은 바꾸지 않았다.
- RED 재현: `ANVIL_F20_R3A_PG_DSN=postgresql+psycopg://anvil_f20_r3a_test@127.0.0.1:35499/anvil_f20_r3a_test` 및 isolated=1, 선택 pytest → exit1, `asgi.py` module import의 `RuntimeConfigurationError: ANVIL_DATABASE_URL is required`(기존 WSL의 Telegram 변수 부족과 같은 bootstrap 경계).
- 보정 후 같은 닫힌 포트 음성 → exit1 `R3A_PG_TARGET_REJECTED` 약 3.7초, import 실패 0. 합성 비밀번호를 포함한 동일 음성도 출력에는 비밀번호/DSN 0. 포트가 없으므로 성공 기대 시험이 아니라 DB preflight까지 도달하는 확인이다.
- 집중 회귀: `.\.venv\Scripts\python.exe -B -m pytest -q tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py --basetemp=runtime/pytest-r3a-import-green -p no:cacheprovider --tb=short` → exit0, **69 passed / 1 skipped**. skip=실제 PG15 opt-in 미설정; WSL 실측 PASS가 아니다. `git diff --check` exit0. 새 제품 commit/WSL 재실행은 Main 소유다.
