# F-20/U-01 R36 Scoped Agent Owner Summary 결과

## 판정

`COMPLETED` — Developer의 내부 요약·지연 결선 및 로컬 기본 검증 완료. 독립 acceptance가 아니며 실제 PostgreSQL15는 Main의 동일 SHA opt-in 검증 전 `NOT_EXECUTED`다. C30 `OPEN_BLOCKING`, F-20/U-01 미수락·`DEFER`, Production `NOT_EXECUTED`를 유지한다.

## 기준·권한

- branch `codex/f18-wsl-ops`, 착수 HEAD/upstream `5bbdfc27f86ed3dd67ad7cd25cb252b2923f9181`. Main이 통제 commit 직후 clean을 전달했고 Developer의 최초 조회에는 Main 소유 `docs/WORK_STATUS.md`만 dirty였다. 이를 수정하지 않았다.
- canonical seq2020/G-05 PASS; actor `developer-primary-f20-u01-r36`, epoch51, worker `worker-lease-f20-u01-r36-r36agent1004`, execution token `f20-u01-r36-execution-fence-epoch-51-r36agent1004`; write `write-lease-f20-u01-r36-r36agent1004`, token `f20-u01-r36-write-fence-epoch-51-r36agent1004`. 유효기간 `2026-10-04T04:00:30+09:00`~`2026-10-04T16:00:30+09:00`, exact7를 projection에서 직접 확인했다. lease는 회수하지 않는다.
- 설계 SHA256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R36 Plan `2298C982B702E9E365347AA1FA434B8AD93AEDA26A95FB64E7E717B4164B7DF2`, WI `767CB89CF156B5C477BBE3E64625E6C1D37BBE2424A56D285847A7406BD64BDB`, Invocation `C9267C555F01B9E791DE9DDDD92838A2CF92723FEA73F2E8CE68224DCAC5ABBE`를 실제 파일 hash와 대조했다.

## 판단 이유·변경 exact7

1. `packages/observability/agent_owner_summary.py`: exact R13 source/row 타입, 0~100행, 양의 generation/version, bounded identity, 세 canonical 상태, 동일 관측시각을 검증한다. frozen 결과에는 관측시각/총수/ACTIVE·REVOKED·EXPIRED 수만 있다. 오류는 원문 없는 `AGENT_OWNER_SUMMARY_UNAVAILABLE`이다.
2. `tests/observability/test_f20_u01_r36_agent_owner_summary.py`: 0/100/101행, 혼합 상태, 중복 복합 identity, 잘못된 타입/상태/시각·tz callback, detached 결과/입력 보존 검증.
3. `packages/observability/service.py`: optional `agent_owner_summary_loader`와 명시적 내부 `agent_owner_summary()`만 추가. loader 결과도 정확 타입·카운트 합계·시각 검증 후 detached 반환한다. 생성/공개 snapshot/detect/alerts/audit/Run 조회는 Agent loader를 호출하지 않는다.
4. `apps/api/anvil_api/oidc_process.py`: 기존 같은 Engine/고정 인가 project/environment에서 R13 읽기→R36 요약의 lazy closure만 결선. 외부 scope와 hostile 문자열은 DB 접근 전 `AGENT_SOURCE_SCOPE_INVALID`로 거부한다.
5. `tests/observability/test_f20_u01_r36_agent_host_binding.py`: 부재/예외/오염 결과 격리, 0→3 최신 조회, scope/callback 거부, retry, Queue/Run/Alert 보존, 기존 공개 Dashboard JSON exact13 및 권한403·Agent 조회0 검증.
6. `tests/integration/test_f20_u01_r36_agent_host_pg15.py`: Main 전용 PG15 opt-in과 안전한 target 검증. 실제 repository 저장 5건 중 인가 scope 3건(같은 session, 다른 assignment), 철회·DB 시간 경과 만료, 0→3 요약/조회 부작용0/외부 scope DB 미접근을 검증하도록 작성. 로컬 in-memory SQL은 seed/schema 호환만 검증하며 PG evidence로 승격하지 않는다.
7. 이 결과보고서.

### Main 해석 보정·불변식

- owner identity는 `(project_id, environment_id, session_id, assignment_id)`이다. 이미 고정 scope인 요약에서 중복은 `(session_id, assignment_id)` 쌍만 거부한다. 같은 session의 서로 다른 assignment는 정상이다.
- R13의 DB `CURRENT_TIMESTAMP`가 관측시각 권위다. application wall clock과 비교하지 않는다. source보다 미래/과거인 row 관측시각 불일치, naive/사용자 정의 datetime/tzinfo는 거부한다. 표준 `timezone`/`ZoneInfo`는 callback 없이 UTC builtin datetime으로 분리한다. R13의 저장 snapshot 생성·만료·hash 검증은 그대로 재사용한다.
- 내부 owner 수는 Agent/Worker/Provider 건강이나 전체 Project 집계가 아니다. 0은 해당 bounded scope의 관측 0행일 뿐이다. 공개 API/OperationsPort/JSON/권한/auth/CSRF/UI/DB schema 변경0.
- 실행계획/TDD 스킬을 사용하되 exact7 및 commit/subagent 금지 지시가 우선하므로 별도 skill ledger·agent·commit은 생성하지 않았다. 이 보고서가 단계별 결과 기록이며 독립 검토는 Main 소유다.

## 실행 명령·결과

cwd는 모두 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, Python은 `C:\Users\cyhuh\anaconda3\python.exe`다.

공통 pytest prefix: `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib`.

| 단계 | prefix 뒤 정확 인자 | exit / 실제 결과 |
|---|---|---|
| Task1 RED | `tests/observability/test_f20_u01_r36_agent_owner_summary.py --basetemp=.tmp_subagent_review/r36/task1-red --tb=short` | 1 / 36 failed, 1.26s; 신규 모듈 부재 |
| Task1 GREEN | `tests/observability/test_f20_u01_r36_agent_owner_summary.py --basetemp=.tmp_subagent_review/r36/task1-green --tb=short` | 0 / 36 passed, 0.51s |
| Task2 및 DB 시각 보정 RED | `tests/observability/test_f20_u01_r36_agent_owner_summary.py tests/observability/test_f20_u01_r36_agent_host_binding.py --basetemp=.tmp_subagent_review/r36/task2-red --tb=short` | 1 / 11 failed, 35 passed, 1 warning, 2.76s; loader 부재 및 application clock 비교 |
| 첫 Task2 GREEN 시도 | 같은 두 파일 `--basetemp=.tmp_subagent_review/r36/task2-green --tb=short` | 1 / 45 passed, 1 failed, 1 warning, 2.23s; 테스트의 기존 snapshot key 오기(provider→providers, budget 누락) |
| Task2 GREEN | 같은 두 파일 `--basetemp=.tmp_subagent_review/r36/task2-final --tb=short` | 0 / 47 passed, 1 warning, 2.59s |
| PG target 포함 집중 | 같은 두 파일 + `tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r36/focused --tb=short -rs` | 0 / 57 passed, 1 skipped, 1 warning, 3.30s |
| QA seed/schema RED | `tests/integration/test_f20_u01_r36_agent_host_pg15.py::test_qa_seed_and_inventory_use_the_existing_owner_repository_schema --basetemp=.tmp_subagent_review/r36/qa-seed-red --tb=short` | 1 / 1 failed, 1 warning, 2.32s; fixture inventory에 존재하지 않는 agent_projection_receipts table 명칭. 실제 정본 agent_owner_requests로 수렴 |

관련 회귀 최종 명령:

```text
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability tests/persistence/test_f20_u01_agent_owner_read.py tests/persistence/test_f20_u01_run_read.py tests/persistence/test_agent_team_owner_repository.py tests/api/test_oidc_process.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_f20_u01_r18_run_host_pg15.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r36/final --tb=short -rs
```

- exit0: **251 passed, 4 skipped, 1 warning, 10.34s**. 이전 `related` basetemp 동일 명령은 249 passed/4 skipped/1 warning/8.09s였다. 후속 callback/seed 호환 2건을 추가했다.
- 4 SKIP는 C30R2 실제 PG 1, R18 PG opt-in 2, R36 PG opt-in 1이다. 경고는 기존 `python_multipart` pending deprecation 1건이다.
- Python builtin `compile(Path(p).read_bytes(),p,'exec')`로 exact Python6 경로 실행: exit0, `builtin compile: 6 PASS`; pyc 생성0.
- `C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress`: 시작 exit0, `PASS sequence=2020 reporting=AUTO_CONTINUE`.
- `git diff --check`: exit0. 최종 fresh 집중/G-05/경로·정리 결과는 아래 마감 기록에 누적한다.

## 오류·미검증·조치

- 정식 `FAILURE_REPORT` 0. 예상 TDD RED와 Main의 시각 해석 보정은 정식 실패가 아니다. 개발 중 assertion snapshot key 오기1, QA inventory table 오기1를 검증 후 수정했다. Invocation 최초 조회에서 실제 `_INVOCATION.md` 대신 `_INVOCATION_PROMPT.md`를 읽으려 한 경로 오류1은 즉시 실제 파일을 읽고 hash 확인하여 해소했다.
- 실제 PostgreSQL/DB 관측시각·repeatable-read·철회/만료 실측은 Main 실행 전 미검증. Main opt-in: `ANVIL_U01_R36_PG_DSN=postgresql+psycopg://<isolated credential>@127.0.0.1:5549/anvil_u01_r36`, `ANVIL_U01_R36_PG_ISOLATED=1`, role/database `anvil_u01_r36`, non-superuser, PG15, migration `0019_oidc_sessions`, 빈 전용 QA DB. 테스트는 migration/DB/container 생성·삭제하지 않는다. Main이 격리 자원을 생성·제거한다.
- 이번 Developer는 WSL/외부 DB/브라우저/Provider/Production/PG18 실행0. repository 전체 suite, 실제 UI 표시·Agent 공개 API는 검증하지 않았으며 이번 내부 절편 완료로 주장하지 않는다.
- 변경 전후 의미: owner 요약 없음→명시 호출 때만 scope-bound owner 관측을 집계. 기존 public JSON·permission·Queue/Run/Alert 의미 불변. production 검증이 아니라 로컬 자기검증이므로 Main의 독립 검토가 필요하다.
- 임시물은 workspace `.tmp_subagent_review/r36` 전용 basetemp만 사용한다. 테스트 종료 후 정확 root/링크 경계를 확인하고 이 root만 정리한다. 다른 작업 임시물·Main WORK_STATUS/progress/HANDOFF 변경0.
- rollback: Main이 exact7 diff만 검토하여 신규5 파일을 제거하고 기존 service/oidc_process 두 파일의 R36 additive delta만 역패치하면 된다. user/Main dirty 파일은 보존하며 DB migration/영속변경 rollback은 없다. Developer stage/commit/push/branch 생성0.

## 마감 기록

- 최종 집중 명령: `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability/test_f20_u01_r36_agent_owner_summary.py tests/observability/test_f20_u01_r36_agent_host_binding.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r36/focused-final --tb=short -rs` → **exit0, 59 passed / 1 skipped / 1 warning, 3.34s**. skip는 R36 Main-owned 실제 PG opt-in뿐이다.
- 최종 `python -B -m scripts.check_project_progress` → exit0 `PASS sequence=2020 reporting=AUTO_CONTINUE`. builtin compile6 PASS·diff check0·staged0. HEAD/upstream 기준선 불변, Developer 변경 exact7 외에는 Main 소유 `docs/WORK_STATUS.md`만 보존된다.
- 실행 세션70837(관련 초기), 96597(최종 관련), 1061(최종 집중/G-05/status)은 모두 exit0 종료 확인. 테스트 subprocess도 정상 종료 결과를 읽었으며 무관 프로세스 종료0이다.
- 정리 전 정확 경로 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r36`은 일반 Directory(비 ReparsePoint), 파일155/디렉터리99/링크39였다. 모든 SymbolicLink의 절대 target이 이 root 내부인 것을 검사했다. link 자체39개를 비재귀 unlink한 뒤 링크0을 재검사하고, 검증된 전용 root만 제거했다. cleanup exit0 `R36_TEMP_RESIDUE=0; REMOVED_LINKS=39`; 다른 임시 root·target·프로세스 변경0. 이 임시 생성물은 테스트로 재생성 가능하며 제품/Git 파일은 삭제하지 않았다.
- Main의 WSL read-only preflight(5549 listener0, QA label container0, `/tmp/anvil-u01-r36-qa` 부재)는 Main 메시지 출처의 준비 확인일 뿐 Developer 실행 또는 PG PASS로 계상하지 않았다. 다음 조치는 Main 독립 diff→제품 checkpoint/private push→동일 SHA 격리 PG15 opt-in이다.

### PG seed 시각 호환 최종 보강 — 위 수치를 대체하는 최신 실행

- 자체 검토에서 psycopg의 `ZoneInfo('UTC')` DB 시각을 기존 OwnerRepository가 요구하는 exact `timezone.utc`로 seed 시점에 정규화해야 함을 확인했다. 제품 시각 정책은 변경하지 않고 opt-in fixture만 DB instant를 보존하는 UTC 변환을 추가했다.
- `... pytest ... tests/integration/test_f20_u01_r36_agent_host_pg15.py::test_qa_seed_and_inventory_use_the_existing_owner_repository_schema --basetemp=.tmp_subagent_review/r36/zone-red --tb=short`(위 공통 prefix 동일): exit1, 1 passed/1 failed/1 warning/2.13s, `OWNER_INPUT_INVALID`. builtin UTC·ZoneInfo UTC 두 seed를 각각 실제 로컬 owner repository에 저장/철회하는 영속 회귀로 고정했다.
- 보완 후 첫 focused 실행은 앞서 정리된 basetemp 부모가 없어서 exit1, 59 passed/2 setup errors/1 warning/2.82s였다. `New-Item -ItemType Directory -Force .tmp_subagent_review/r36`로 정확 부모만 재생성하여 재실행했다. **환경 호출 오류1이며 제품 실패/정식 FAILURE_REPORT가 아니다.**
- 최신 focused: 위 `focused-final`과 같은 prefix·신규 세 파일·`--tb=short -rs`, basetemp만 `.tmp_subagent_review/r36/zone-focused` → **exit0, 60 passed / 1 skipped / 1 warning, 3.42s**.
- 최신 관련: 위 관련 회귀 전체 명령에서 basetemp만 `.tmp_subagent_review/r36/zone-related` → **exit0, 252 passed / 4 skipped / 1 warning, 9.25s**. Skip4 의미는 동일하다.
- 세션23597 종료 exit0 확인 후 새 전용 root의 파일73/디렉터리45/링크18을 검사했다. root 비링크, 링크 target18 모두 동일 root 내부였다. 링크 자체 unlink→링크0→전용 root만 제거하여 `R36_TEMP_RESIDUE=0`, cleanup exit0. 원 외부 target/프로세스 변경0.
- 최종 산출물은 위 exact7이며 제품 공개 계약/control/WORK_STATUS 변경0, formal FAILURE_REPORT0. fresh compile6/G-05/diff 및 SHA는 완료 인계에 첨부한다.

## Main 리뷰 보완: expiring seed의 단일 DB 관측값

- 2026-10-04 04:25 KST 재착수 전 canonical seq2020·actor·epoch51 양 lease/token·exact7·만료16:00:30 KST를 재확인했다. 이번 보완은 PG opt-in 테스트 파일과 이 보고서만 수정했다. 다른 제품·Main WORK_STATUS·통제 파일은 보존했다.
- 기존 expiry 계산과 snapshot 생성 사이에 `_db_at`을 두 번 읽었다. 두 번째 관측이 지연되면 snapshot의 생성·만료시각 결박이 깨질 수 있다. 해당 fixture의 실제 seed 경로를 `_expiring_snapshot`으로 묶고 `expiring_at = _db_at(engine)` 한 번에서 `expires = expiring_at + timedelta(seconds=2)` 및 `_snapshot(expiring_at, ...)`를 생성한다. 제품 코드와 저장 owner 계약은 변경0이다.
- 영속 회귀 `test_expiring_snapshot_binds_one_db_observation_even_if_next_read_is_delayed`는 다음 DB 읽기가 70초 늦어지는 통제 입력으로 실제 helper를 실행한다. RED 조회2회→GREEN 조회1회와 생성/만료시각·UTC·순서를 직접 검증했다. 단순 source 문자열 검사나 실제 PG PASS 주장이 아니다.
- RED 정확 명령: `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_f20_u01_r36_agent_host_pg15.py::test_expiring_snapshot_binds_one_db_observation_even_if_next_read_is_delayed --basetemp=.tmp_subagent_review/r36-review/red --tb=short` → exit1, **1 failed/1 warning/2.75s**, `assert 2 == 1`.
- 집중 정확 명령: `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability/test_f20_u01_r36_agent_owner_summary.py tests/observability/test_f20_u01_r36_agent_host_binding.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r36-review/focused --tb=short -rs` → exit0, **61 passed/1 skipped/1 warning/3.17s**.
- 관련 명령은 위 전체 관련 pytest 명령에서 basetemp만 `.tmp_subagent_review/r36-review/related` → exit0, **253 passed/4 skipped/1 warning/10.91s**. skip4는 기존 실제 PG opt-in 미실행, warning1은 기존 python_multipart deprecation이다.
- 세션90128 exit0 종료 후 정확 전용 `.tmp_subagent_review/r36-review` root 비링크, 파일73/디렉터리45/링크18 및 target18 모두 같은 root 안임을 확인했다. 링크 자체 unlink→링크0 재검사→전용 root 제거; cleanup exit0, `R36_REVIEW_TEMP_RESIDUE=0`. 다른 경로/프로세스 변경0.
- 리뷰 보완1회, formal FAILURE_REPORT0. `COMPLETED` Developer 결과를 유지하되 실제 PG15 및 독립 acceptance 미검증 경계는 그대로다. commit/push/WSL/DB 실행0. rollback은 이번 helper/회귀·보고서 delta만 역패치하는 것으로 별도 영속자료 영향이 없다.
