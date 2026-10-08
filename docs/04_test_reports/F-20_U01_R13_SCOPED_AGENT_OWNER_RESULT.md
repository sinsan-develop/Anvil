# F-20/U-01 R13 범위 지정 Agent owner 읽기 결과

## 판정

`COMPLETED` — R13 exact3 로컬 구현과 집중·인접 회귀 확인 완료. 내부 읽기 포트의 로컬 계약 증거이며 실제 PostgreSQL/WSL, 공개 Dashboard, U-01/F-20 수락 증거는 아니다.

## 기준·시작 상태

- 담당: `developer-primary-f20-u01-r13`; 작업: `F-20/U01-R13`.
- 작업공간: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`; branch `codex/f18-wsl-ops`; 시작 HEAD `d46f01ec03a6ff22a129fdb2dd781c021cb195d8`.
- 시작 Git 상태: `M docs/WORK_STATUS.md` 한 건은 Main 소유 dirty 파일이다. 수정·stage하지 않았다.
- canonical seq1870, epoch26 worker/write dual lease ACTIVE, 경로 exact3 및 G-05 `PASS sequence=1870 reporting=AUTO_CONTINUE` 확인. 두 fencing token은 원문 기록하지 않는다.
- SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R13 계획 `2341B482A9E144E90AD6C685EA323C93F185F81C28E44F3E262B78745AE2B0FC`; WI `370050D738B120127D130E1A5291CEC60690B72895DA4C38A55CB09BE09EE672`.

## 변경·diff 요약

1. `packages/persistence/operations_agent_owner_read.py` 신규. 비정규 scope ID를 DB 전에 거부하고 PostgreSQL `REPEATABLE READ`·`READ ONLY` 한 거래에서 DB 관측시각과 범위 내 head를 `scope_key` 순·최대101행으로 읽는다. 기존 `SqlAlchemyAgentTeamOwnerRepository._stored`가 snapshot·row 무결성을 검증한다. 독립 검토에서 발견한 유효하지만 생성시각이 DB 관측시각보다 미래인 snapshot도 전체 비가용으로 닫는다. 결과에는 session/assignment ID, generation, owner version, 철회 우선의 ACTIVE/REVOKED/EXPIRED 상태와 관측시각만 남긴다. 초과·중복·변조·DB 오류는 `AGENT_SOURCE_UNAVAILABLE`로 닫는다.
2. `tests/persistence/test_f20_u01_agent_owner_read.py` 신규. 0/100/101행, 교차 scope, 상태 우선순위, 미래 생성시각, 기존 validator 호출, snapshot/컬럼 변조, 중복·잘못된 시각, 비정규 ID, DB 오류 redaction, 읽기 무변경을 로컬 SQL 계약 double로 검증한다.
3. 본 결과보고서 신규. 공개 API/BFF·인증·권한·UI·DB schema·지속 데이터 변경은 없다.

## 실행 증거

작업공간에서 pytest마다 `PYTHONDONTWRITEBYTECODE=1`, `-B`, `-p no:cacheprovider`, 사전 기록한 `--basetemp=.pytest_tmp_f20_u01_r13_dev`를 사용했다. 전용 base는 생성되지 않아 제거 대상도 없었다.

| 단계 | 정확한 명령 | 종료·결과 |
|---|---|---|
| G-05 | `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` | exit0, seq1870 PASS. 최초 script 직접 경로 실행은 import context 오류 exit1이었고 모듈 실행으로 해소했다. |
| RED | `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/persistence/test_f20_u01_agent_owner_read.py --basetemp=.pytest_tmp_f20_u01_r13_dev` | exit1, 신규 모듈 부재 `ModuleNotFoundError` 수집 오류1. |
| GREEN 중간 | 같은 집중 명령 | exit1, 21 PASS/테스트 가정 오류1. SQL scope 필터로 제외될 project 변조 행을 오류로 기대한 테스트만 수정했다. |
| GREEN 최종 | 같은 집중 명령 | exit0, 22 passed. |
| 인접 회귀 | `.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/persistence/test_f20_u01_agent_owner_read.py tests/persistence/test_agent_team_owner_repository.py tests/persistence/test_f20_u01_run_read.py --basetemp=.pytest_tmp_f20_u01_r13_dev` | exit0, 80 passed, 1 skipped. |
| 정식 전체 수집 | `.\.venv\Scripts\python.exe -B -m pytest --collect-only -q -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=.pytest_tmp_f20_u01_r13_dev` | exit0, 8,517 tests collected. 전체 실행은 하지 않았다. |
| 독립 검토 finding RED | 위 집중 명령. 구조적으로 유효한 `created_at > observed_at` snapshot 추가 | exit1, 1 failed/22 passed. 기존 구현이 ACTIVE를 반환함을 확인. |
| finding GREEN 집중 | 위 집중 명령 | exit0, 23 passed. 미래 생성시각은 `AGENT_SOURCE_UNAVAILABLE`. |
| finding GREEN 인접 | 위 인접 회귀 명령 | exit0, 81 passed, 1 skipped. |
| finding 후 G-05·diff | `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .`; `git diff --check` | 각 exit0, G-05 seq1870 PASS·diff 오류0. |

## 경계·미검증·rollback

- 로컬 double은 SQL 형태, 범위, 격리·read-only 설정 및 반환 계약을 검증한다. 실제 PostgreSQL15 거래·권한·저장/철회/만료, WSL 동일 SHA, 공개 API/UI/브라우저, 전체 suite 실행은 Main 후속 검증 대상이다. 인접 회귀의 1 SKIP을 PASS로 집계하지 않는다.
- 빈 결과는 인가된 범위와 해당 거래의 0행 관측일 뿐 Agent/Worker/Provider 건강 판정이 아니다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, U-01/F-20 미수락을 유지한다.
- Main 소유 `docs/WORK_STATUS.md`를 보존했다. Developer는 exact3 외 수정, commit/push/merge, WSL-server/Docker/DB/ysna/Production 접근을 하지 않았고 progress/HANDOFF도 수정하지 않았다.
- 회귀 시 신규 exact3만 제거하면 R12 Run/R11 Queue/R10 Dashboard 경로를 보존할 수 있다. Main이 diff와 로컬 증거를 독립 검토한 뒤 같은 branch의 SHA를 게시하고 WSL-server 격리 PostgreSQL15에서 확인한다.
