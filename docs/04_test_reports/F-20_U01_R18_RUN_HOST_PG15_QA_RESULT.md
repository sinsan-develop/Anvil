# F-20/U-01 R18 Run host PG15 QA — Developer 결과

## 판정

`INCOMPLETE`. DSN/opt-in 선행 guard의 로컬 RED→GREEN과 R12/R16/R17·OIDC/Queue 인접 회귀는 완료했다. 실제 PostgreSQL 15 host 테스트 본문은 현재 WorkInstruction의 teardown 계약과 정식 Run 생성 저장소의 append-only Event 계약이 충돌하여 작성·실행하지 않았다. 이 결과는 R18 QA 완료나 F-20/U-01 수락이 아니다.

## 기준·권한

- 시작 branch `codex/f18-wsl-ops`, 전달 HEAD `88db1945db13758005c8c214cdf01843441622bb`; 시작 status는 Main 소유 `docs/WORK_STATUS.md` 수정만 있었다. 기존 파일은 보존했다. Canonical lease `baseline_git_commit`/`dispatch_head`의 `21021fbba6f84549767b6887e4682a4d70fac4db`는 lease 발급 기준이며, 전달 HEAD와 구분한다.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R18 계획 `94B93303DB6A2832BE7393AECCE452B2BD54E861B96D1CBE82D4791A072A6D87`.
- Canonical G-05 seq `1900` PASS, worker/write lease 모두 `ACTIVE`, actor `developer-primary-f20-u01-r18`, epoch `31`, 만료 `2026-09-30T19:57:33+00:00`, execution token `f20-u01-r18-execution-fence-epoch-31-r18run3009e`, write token `f20-u01-r18-write-fence-epoch-31-r18run3009e`. 허용 경로는 본 보고서와 `tests/api/test_f20_u01_r18_run_host_pg15.py` exact2다.

## 변경·검증

- 테스트 파일 신규: 정확한 driver/host/port/role/database/query/isolated flag guard, 일부 설정·공유 대상의 DB 접근 전 거부 9건, 정상 URL 검사 1건, opt-in 모두 미설정 시 명시적 SKIP 1건. 실제 PG test body는 없다.
- 첫 RED 명령: `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r18_dev tests/api/test_f20_u01_r18_run_host_pg15.py` → exit `1`, `9 failed` (`_validated_target` 미구현 NameError). Guard 구현 뒤 같은 명령 → exit `0`, `9 passed`.
- 인접 회귀 명령: `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r18_dev tests/api/test_f20_u01_r18_run_host_pg15.py tests/persistence/test_f20_u01_run_read.py tests/observability/test_f20_u01_run_status_summary.py tests/observability/test_f20_u01_r17_run_host_binding.py tests/persistence/test_f20_u01_r8_queue_read.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_oidc_process.py tests/api/test_f20_u01_r9_oidc_queue_host.py` → exit `0`, `97 passed, 1 skipped` (`R18` opt-in 미설정). SKIP은 PASS로 계상하지 않았다.

## 원인·영향·다음 조치

- `SqlAlchemyRunCreationRepository.create()`는 Run과 `run_events`를 함께 기록한다. Migration `0005_event_store.py`는 Event 변경/삭제를 금지한다. Run을 커밋하면 Developer가 자신이 삽입한 합성 row만 지우는 현재 teardown은 불가능하다. 미커밋 트랜잭션에 두면 `load_scoped_run_source()`가 독립 Engine 연결의 `REPEATABLE READ`/`READ ONLY` 트랜잭션으로 조회하므로 host가 해당 Run을 볼 수 없다. 직접 `INSERT`는 정식 생성 경로를 우회하므로 수행하지 않았다.
- 실제 PG15, migration head, 비-superuser, 빈 DB, 두 시점 host 집계, 교차 scope, legacy NULL/101행/DB 장애, Run/Queue/audit 불변은 `NOT_EXECUTED`. 브라우저·PG18 RC·Production도 이 결과의 증거가 아니다. 제품 운영 코드와 기존 동작은 변경하지 않았다.
- Main은 teardown 계약을 WorkInstruction revision과 신규 lease로 재결박한 후 실제 PG test body를 별도 실행해야 한다. `C30 OPEN_BLOCKING`/`DEFER`, F-20/U-01 미수락, main 미병합 상태를 유지한다. Developer는 commit/push/PR/merge, WSL-server/DB/Docker/ysna/Production 접근 및 canonical progress/HANDOFF 갱신을 수행하지 않았다.
- 로컬 일회성 pytest base `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest_tmp_f20_u01_r18_dev`는 삭제 전 절대경로·base 자체 link 없음·내부 symlink 13개의 대상이 전부 base 안임을 확인했다. `Get-Process python,pytest`의 해당 worktree 실행 파일 0건을 확인하고 exact base만 삭제해 잔여 0건이다. `Get-CimInstance Win32_Process`는 권한 거부로 command-line 별도 확인은 미실행이며, 프로세스 검사는 실행 파일 경로 기준이다. 기존 `.venv`와 사용자 Temp는 보존했다.
- Rollback: Main이 신규 테스트 파일과 본 보고서 exact2만 정상적으로 되돌리면 된다. 기존 R12/R16/R17 제품 코드는 수정하지 않았다.

## R1 재개 결과 — epoch32

### 판정과 기준

`COMPLETED` (Developer의 로컬 구현·검증 범위). 원 epoch31의 `INCOMPLETE` 및 9 RED→9 GREEN 증거는 위에 보존한다. Main이 원 lease를 회수하고 R1 teardown만 비의미 정정하여 새 dual lease를 발급했다. 실제 WSL-server 격리 PG15 실행·tmpfs container 전체 정리는 Main 담당이며 여기서는 `NOT_EXECUTED`다. 따라서 본 `COMPLETED`는 PG PASS 또는 F-20/U-01 수락 판정이 아니다.

- 시작 branch `codex/f18-wsl-ops`, clean HEAD `be8f9aa58321822cfe29ff37b0334ad682f99347`, private `development/codex/f18-wsl-ops`와 동일한 전달 checkpoint. Canonical G-05 seq1906 PASS. Lease `baseline_git_commit`/`dispatch_head` `d4a6a957c44a4e1f493563c7928b70079f31cdcc`는 lease 발급 기준으로 구분한다.
- R1 WI SHA-256 `6B3B6AA6AB325F509390DCE18DAEA4E96FFC32CC67338977EEE7F344A0C7D252`; Invocation R1 `979E6991D8078977B1FB30A40BFEDEE4014D75139D150301F210A909E4301CCA`. 설계·계획·매트릭스·테스트계획·운영규칙·R18 계획 hash는 위 기존 기준과 재대조해 일치했다.
- worker/write lease 모두 `ACTIVE`, actor `developer-primary-f20-u01-r18`, epoch `32`, 만료 `2026-09-30T20:48:42+00:00`. Execution token `f20-u01-r18-execution-fence-epoch-32-r18r1run3009f`, write token `f20-u01-r18-write-fence-epoch-32-r18r1run3009f`; exact2는 본 보고서와 `tests/api/test_f20_u01_r18_run_host_pg15.py`다.

### 변경·실행 증거

- 테스트 파일에 opt-in 실제 PG15 단일 테스트를 추가했다. 연결 전에 exact DSN/격리 flag를 검사하고, 연결 뒤 major 15·비-superuser·`0019_oidc_sessions`·기본 테이블 빈 상태를 사전 확인한다. 전용 DB에 project repository mapping과 승인 artifact lineage를 seed하고 `SqlAlchemyTaskBootstrapRepository` 및 `SqlAlchemyRunCreationRepository`로 Task·Run·append-only Event를 커밋한다. `create_oidc_process_app`의 trusted Operations owner를 사용해 빈 상태와 범위 내 상태 3건을 두 시점 관측한다. 교차 project/environment 식별자 배제, scope 선행 거부, legacy NULL·101행·DB 오류의 안정 비가용, 읽기 전후 Run/Event/Queue/audit 저장 수 불변과 결과의 비밀 비노출을 검사한다.
- 상태 및 legacy NULL 주입은 전용 DB 사전 확인 후 이 테스트가 생성한 정확한 Run ID에만 SQL `UPDATE`한다. 직접 Run `INSERT`, `run_events` 변경·삭제, trigger 변경, row-only teardown은 없다. 합성 DB 전체는 Main이 QA 후 tmpfs container 제거로 정리한다.
- 로컬 focused 명령: `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r18_r1_dev tests/api/test_f20_u01_r18_run_host_pg15.py` → exit `0`, `10 passed, 2 skipped` (두 SKIP은 opt-in 부재 확인과 실제 PG 테스트).
- 로컬 인접 명령: `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r18_r1_dev tests/api/test_f20_u01_r18_run_host_pg15.py tests/persistence/test_f20_u01_run_read.py tests/observability/test_f20_u01_run_status_summary.py tests/observability/test_f20_u01_r17_run_host_binding.py tests/persistence/test_f20_u01_r8_queue_read.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_oidc_process.py tests/api/test_f20_u01_r9_oidc_queue_host.py` → exit `0`, `97 passed, 2 skipped`. R12/R16/R17·OIDC/Queue 회귀는 실행 범위에서 통과했다. SKIP을 PASS로 계상하지 않았다.
- R1 test body는 실제 PG 연결이 없어 로컬 RED→GREEN을 실측할 수 없다. 원 R18 guard의 RED→GREEN 증거는 위에 있고, R1 body의 결과는 Main의 동일 SHA WSL 실측 전까지 미검증이다. `git diff --check`는 exit `0`; 최종 diff는 exact2만 수정, 280행 추가다.
- 전용 로컬 pytest base `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest_tmp_f20_u01_r18_r1_dev`는 생성 전 부재를 확인했다. 최종 focused 재실행은 exit `0`, `10 passed, 2 skipped`다. 삭제 전 base의 절대경로·자체 link 없음·내부 symlink 1개가 base 내부를 향함·해당 worktree Python/pytest 프로세스 0을 확인하고 정확한 base만 삭제했다. 삭제 후 잔여 0이며 `.venv`와 사용자 Temp는 보존했다.

### 영향·후속

- 운영 제품 코드·API/UI·migration·schema·Secret·기존 Run 생성/읽기 구현은 수정하지 않았다. 기존 기능 영향은 테스트 파일과 결과 기록에 한정된다.
- 미검증: 실제 PG15 두 시점 집계·legacy/overflow/DB 장애·container 전체 폐기, 브라우저/PG18 RC/Production. Main이 diff·guard·계약을 독립 검토하고 exact SHA로 WSL-server 격리 QA를 실행·정리한 뒤 WORK_STATUS와 canonical progress/HANDOFF에 실제 결과를 기록해야 한다. `C30 OPEN_BLOCKING`/`DEFER`, F-20/U-01 미수락, main 미병합은 유지한다.
- Rollback: R1의 테스트 파일 변경과 본 보고서 R1 절만 정상 revert한다. 원 R18 guard와 INCOMPLETE 기록, R12/R16/R17 제품 코드는 보존한다. Developer는 commit/push/PR/merge, WSL-server/DB/Docker/ysna/Production 접근과 Main 소유 현황 파일 갱신을 수행하지 않았다.
