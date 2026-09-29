# F-20/U-01 R8 Scoped Queue Source — Developer 결과

## 판정

`COMPLETED_LOCAL_SCOPE`. R8의 지정된 세 파일 안에서 PostgreSQL Queue 읽기 source와 로컬 계약 테스트를 작성했다. 실제 PostgreSQL 15·WSL-server 동일 SHA 실측, Main 독립 검토, U-01/F-20 인수는 이 판정에 포함하지 않는다.

## 기준·시작 상태

- branch `codex/f18-wsl-ops`, 시작 HEAD `e28112c60fcc2384e46ab4c2eb8d810ead713c7b`; upstream `development/codex/f18-wsl-ops`.
- 시작 Git status: Main 소유 `docs/WORK_STATUS.md` 수정 1개. Developer의 제품 경로 세 개는 생성 전 모두 부재. Main의 현황 수정은 보존했다.
- canonical Event seq1840, worker/write dual lease `ACTIVE`, epoch21, 제품 path scope는 이 보고서 포함 정확히 세 파일. G-05 시작 PASS는 Main 인계 checkpoint에서 확인했다.
- SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R8 계획 `FFEE22C1C0AB874F115E5CE602565A6FE2EABFC36183766B994380D547D59727`; WorkInstruction `ECCAD751B33057D562BA29327B42524703FD76BA96CFC586DC0A1AD7C5F440C7`.

## 변경과 판단 이유

| 파일 | 변경 | 이유 |
|---|---|---|
| `packages/persistence/operations_queue_read.py` | 신규 `load_scoped_queue_source`, `QueueObservation`, `ScopedQueueSource` | 신뢰된 Engine과 scope를 받아 하나의 read-only repeatable-read transaction에서 job·quarantine·legacy flag를 materialize한다. `tasks.project_id`와 `runs.environment_id`를 함께 조인하고 각 row 집합을 101개까지만 읽어 100개 초과를 거부한다. SELECT에 payload/token을 넣지 않고 DB 오류를 안정적인 `QUEUE_SOURCE_UNAVAILABLE`로 봉인한다. |
| `tests/persistence/test_f20_u01_r8_queue_read.py` | 신규 로컬 계약 테스트 14개 | 빈 scope, cross-project/environment, legacy NULL, quarantine, secret 비노출, 상한, 동일 snapshot, read-only SQL, 입력 검증, DB 오류를 검사한다. Fake connection은 SQL join/scope/limit와 transaction 설정을 확인하며 실제 PG 실행을 대체하지 않는다. |
| 이 보고서 | 신규 | RED/GREEN, 실제 검증 범위와 미검증을 인계한다. |

기존 `OperationsSources(queue=source, queue_job_ids=source.job_ids)`를 직접 `project_operations()`에 공급했을 때 Queue health는 `UNKNOWN`이며, 빈 job 목록을 HEALTHY로 해석하지 않는다. `legacy_unscoped_present=True` 역시 후속 host가 수치를 완전한 것으로 표시하지 않게 전달하는 내부 계약이다. Host 주입·공개 API/UI·DB schema는 변경하지 않았다.

내부 판단: legacy NULL은 job이 아직 없는 Run도 포함한다. 환경 미귀속 Run의 존재를 숨긴 채 빈 Queue를 완전한 0건으로 제시하는 위험이 있어 legacy 조회를 `runs → tasks`로 좁혔다. 이 판단이 틀리면 불필요하게 불완전 표시되는 scope가 생길 수 있으나, 읽기 안전성에는 보수적이다.

## 실행 증거

| 명령 | 종료 코드 | 실제 결과 |
|---|---:|---|
| `.\\.venv\\Scripts\\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py -q --basetemp=.pytest_tmp_f20_u01_r8_queue_read` (구현 전 RED) | 1 | `packages.persistence.operations_queue_read` 부재에 따른 collection `ModuleNotFoundError` 1건. 예상 RED. |
| 위 동일 명령 (구현 후 GREEN) | 0 | `11 passed in 0.25s`. |
| `.\\.venv\\Scripts\\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py tests/observability/test_f13_operations.py tests/persistence/test_dag_queue_e04.py -q --basetemp=.pytest_tmp_f20_u01_r8_queue_read` | 0 | 최초 `29 passed, 5 skipped in 2.18s`. |
| `.\\.venv\\Scripts\\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py tests/observability/test_f13_operations.py tests/persistence/test_dag_queue_e04.py -q -rs --basetemp=.pytest_tmp_f20_u01_r8_queue_read` | 0 | 추가 DB 오류/secret quarantine 테스트 뒤 `31 passed, 5 skipped in 0.69s`. skip 5건은 `E04_REAL_POSTGRES_NOT_EXECUTED: isolated PostgreSQL DSN unavailable`. |
| `.\\.venv\\Scripts\\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py::test_legacy_run_without_queue_job_is_not_silently_reported_as_complete -q --basetemp=.pytest_tmp_f20_u01_r8_queue_read` (추가 RED) | 1 | `legacy_unscoped_present=False` 대 예상 `True`, `1 failed in 0.37s`. |
| `.\\.venv\\Scripts\\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py tests/observability/test_f13_operations.py tests/persistence/test_dag_queue_e04.py -q -rs --basetemp=.pytest_tmp_f20_u01_r8_queue_read` (최종 GREEN) | 0 | `32 passed, 5 skipped in 0.69s`. skip 사유 동일. |
| `.\\.venv\\Scripts\\python.exe -B scripts/check_project_progress.py .` | 0 | `G-05 project progress contract: PASS sequence=1840 reporting=AUTO_CONTINUE`. |
| `git diff --check` | 0 | 출력 없음. |

## 임시 자원·오류

- Main이 정확한 pytest base `.pytest_tmp_f20_u01_r8_queue_read`의 소유·수명·정리를 사전 기록했고, 실행 전 부재를 확인했다. pytest 실행 후에도 경로가 생성되지 않아 실제 삭제 대상·잔여물은 0이다.
- 첫 정리 진단 명령은 부재 경로에 `Get-Item`/`Resolve-Path`/`Remove-Item`을 호출해 PowerShell 비종결 오류를 출력했다. 삭제된 파일은 없고 후속 `Test-Path`에서 base 부재를 재확인했다. 이는 제품 테스트 실패나 정식 `FAILURE_REPORT`가 아니다.
- Developer의 정식 동일 오류 실패 횟수 0. 로컬 DB/container/WSL/Production 자원 생성·변경 0.

## 미검증·잔여 위험·다음 조치

- 로컬 fake connection PASS는 실제 PostgreSQL SQL 실행, migration0019 schema, 동시 transaction, WSL-server exact SHA를 증명하지 않는다. 5개 PostgreSQL 의존 E04 테스트는 skip이다.
- 전체 제품 suite, 실제 브라우저/API, 정식 E-SHOT/E-NET, U-01/F-20 acceptance, C30 사건 복구, Production은 미검증 또는 범위 밖이다.
- Main이 세 파일의 diff와 G-05를 독립 검토한 다음 기존 branch에 안전한 checkpoint를 만들고, 동일 SHA WSL-server 격리 PG15에서 실제 scope·legacy·quarantine·DB 불변을 검증한다. `legacy_unscoped_present` 해석과 Queue health 표시를 host 연결 단계에서 보존한다.
- Rollback: Main이 이 R8 단위의 세 신규 파일만 이전 checkpoint 기준으로 제거할 수 있다. Main 소유 `docs/WORK_STATUS.md`와 다른 dirty/untracked 자료는 대상이 아니다.
- `docs/progress/build-progress.json`과 `BUILD_HANDOFF.md`는 Developer가 수정하지 않았다. Main이 검증·인수 후 갱신한다.
