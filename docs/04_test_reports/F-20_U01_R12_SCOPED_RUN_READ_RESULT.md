# F-20/U-01 R12 scoped Run 읽기 결과

## 판정

`COMPLETED` — R12 exact3 로컬 구현 및 집중·인접 검증 완료. 이 결과는 내부 읽기 포트의 로컬 계약에 한정된다. F-20/U-01 acceptance, 실제 PostgreSQL, WSL, 브라우저, Production 판정은 아니다.

## 기준·시작 상태

- 담당: `developer-primary-f20-u01-r12`; 작업: `F-20/U01-R12`.
- 작업공간: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`; branch `codex/f18-wsl-ops`; 시작 HEAD `e18a894515a428233cfa155ba27a9d7511149efe`.
- 시작 `git status --short`: Main 소유 `M docs/WORK_STATUS.md` 1개. 해당 변경을 보존했고 수정·stage하지 않았다.
- canonical `event_sequence=1864`, `worker_lease`/`write_lease` ACTIVE epoch25, 제품 경로 exact3. 시작 `scripts/check_project_progress.py`: `G-05 project progress contract: PASS sequence=1864 reporting=AUTO_CONTINUE`, exit0.
- SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R12 plan SHA-256 `8A7F5876F1D3DC1E4085B3383B80D79E57F444F48E10282DB52BD80A3409C401`; WI `6EFB3281E7595B0513676DC272D191E2CC5F5E45545A2FCB4CAB58087654A2FB`; invocation `C400DC3493F8F55A85281545341A9A7A9F97276A86FBAC1ED1F4757AB6509236`.

## 변경과 판단 이유

- `packages/persistence/operations_run_read.py` 신규: 신뢰된 Engine과 사전 인가된 Project/Environment ID를 받아 입력을 DB 접근 전에 검증한다. PostgreSQL `REPEATABLE READ`·`READ ONLY` 한 거래에서 DB 시각, 범위 내 Run의 `run_id`, `task_id`, `phase`, `status`, `version`만 `run_id` 순으로 최대 101행 조회한다. 100행 초과, 같은 Project의 legacy NULL environment, malformed 값, DB 장애는 `RUN_SOURCE_UNAVAILABLE`만 노출한다. 결과는 최대 100행이며 0행은 그 거래의 범위 내 0행 관측일 뿐 전체 건강 판정이 아니다.
- `tests/persistence/test_f20_u01_run_read.py` 신규: 정상·교차 범위·0/100/101행·legacy NULL·잘못된 ID/enum/version·DB 오류·비밀값 비노출·repeatable snapshot·읽기 무변경을 로컬 SQL 계약 double로 검증한다.
- 본 결과보고서 신규. 공개 API/BFF, 권한, UI, DB schema, 지속 데이터 변경은 없다.

## 실행 증거

모든 명령은 위 작업공간에서 실행하고 `PYTHONDONTWRITEBYTECODE=1`, pytest `-p no:cacheprovider`를 적용했다. pytest base는 사전 기록된 `.pytest_tmp_f20_u01_r12_dev`만 사용했다.

| 단계 | 정확한 명령 요지 | 종료·실제 결과 |
|---|---|---|
| G-05 | `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py` | exit0, seq1864 PASS |
| RED | `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/persistence/test_f20_u01_run_read.py --basetemp=.pytest_tmp_f20_u01_r12_dev` | exit2, 신규 모듈 미존재 `ModuleNotFoundError` 1 collection error |
| GREEN | 동일 집중 명령 | exit0, 19 passed |
| 인접 | `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/persistence/test_f20_u01_run_read.py tests/persistence/test_f20_u01_r8_queue_read.py tests/persistence/test_run_authority_migration.py tests/persistence/test_run_creation_postgres.py --basetemp=.pytest_tmp_f20_u01_r12_dev` | exit0, 34 passed, PostgreSQL opt-in 15 skipped |
| 전체 정식 수집 | `.\.venv\Scripts\python.exe -B -m pytest --collect-only -q -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=.pytest_tmp_f20_u01_r12_dev` | exit0, 8,485 tests collected |
| 전체 정식 실행 시도 | `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=.pytest_tmp_f20_u01_r12_dev` | 약 11% 지점에서 매우 느리게 진행되어 Ctrl-C 중단, shell exit1. 전체 PASS/FAIL 판정 없음 |

로컬 double 테스트는 SQL 형태와 transaction 설정을 검증한다. 실제 PostgreSQL transaction 권한·격리 동작을 증명하지 않는다. 정식 전체 suite의 미완료 실행도 PASS로 집계하지 않는다.

## 종료 상태·미검증·rollback

- 전용 pytest base는 실행 뒤 실제 root가 위 작업공간의 정확한 경로이며 reparse root가 아님을 확인했다. 하위 symbolic link 9개 모두 동일 base 안을 가리킴을 확인하고 정확히 이 base만 제거했다. `BASE_RESIDUE=0`; 작업 pytest 명령 종료. 별도로 보인 Anaconda Python 프로세스는 소유권이 달라 건드리지 않았다.
- `docs/WORK_STATUS.md`의 Main 소유 dirty 변경은 보존했다. Developer의 변경은 위 exact3뿐이며 commit/push/merge/WSL-server/Docker/DB/ysna/Production 접근은 수행하지 않았다. progress/HANDOFF 갱신은 Main 소유로 미수행.
- 실제 PostgreSQL15, WSL 동일 SHA, 운영 유사 환경, 공개 API/권한/UI/브라우저 Network, 전체 suite 실행 완료는 미검증. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다.
- 회귀 시 이번 exact3 신규 파일만 제거하여 R11 Queue UI 및 R10 Dashboard API를 보존한다. Main은 diff와 로컬 결과를 독립 확인한 뒤 승인된 동일 branch SHA의 사설 push와 WSL 격리 PostgreSQL15 검증을 맡는다.
