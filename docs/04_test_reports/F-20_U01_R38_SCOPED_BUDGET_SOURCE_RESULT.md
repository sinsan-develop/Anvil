# F-20/U-01 R38 Scoped Budget Source 결과

## 판정: INCOMPLETE

2026-10-04, 단일 Developer `developer-primary-f20-u01-r38`의 로컬 결과이다. 새 exact6 구현·집중 검증은 GREEN이나, 전체 관련 회귀에서 기존 local host fixture 5개 파일의 16건이 실패한다. Main 지시에 따라 exact6 밖은 수정하지 않고, 비의미 fixture revision/새 lease를 위한 인계로 종료한다. 자동 합격·WSL/PG15·브라우저·운영 수락이 아니다. C30 OPEN_BLOCKING/DEFER, F-20/U-01 미수락 유지.

## 판단 이유

### 권위와 시작 상태

- worktree: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`
- branch: `codex/f18-wsl-ops`
- 착수 HEAD/upstream: `8f88e99987b11a35c79ef477390987652e4b8277`; status clean. private 동일은 Main 출처이며 Developer는 원격 재조회하지 않았다.
- G-05 canonical sequence 2032, epoch53 ACTIVE.
- worker `worker-lease-f20-u01-r38-r38bud1004`, execution `f20-u01-r38-execution-fence-epoch-53-r38bud1004`.
- write `write-lease-f20-u01-r38-r38bud1004`, write token `f20-u01-r38-write-fence-epoch-53-r38bud1004`.
- 발급 `2026-10-04T07:32:23+09:00`, 만료 `2026-10-04T19:32:23+09:00`. mutation 전 actor/path_scope/두 token과 발효 시각 확인.
- Plan SHA256 `8D4462112FEE4DB924C85DB06E6FC1D0489032A0D3B1DDF39559C59B57488C7F`.
- WI SHA256 `01DCABA93C05AA49627B22046C16CB615B381307B63C3B3F87941C335779A960`.
- Invocation SHA256 `7A1D6BCDF9754F502F7BCABBD184E6C0FE8546BED9B9B608CEE296E8D3009BAA`.

### 변경 exact6

1. `packages/persistence/operations_budget_read.py`: 두 bounded SELECT/단일 repeatable-read read-only transaction, scope·legacy·참조·상한·형식 검사, detached BudgetSnapshot/Reservation.
2. `apps/api/anvil_api/oidc_process.py`: import+기존 Queue 성공 뒤 Budget source 연결, 총 4줄 추가. fixed scope 선검사·권한·Provider·Run 경계 유지.
3. `tests/persistence/test_operations_budget_read.py`: 집계 literal/잘못된 scope·값/alias/상한/SQL predicate 계약.
4. `tests/api/test_f20_u01_r38_budget_host_binding.py`: 실제 configured OIDC 앱의 stored synthetic session을 통한 GET, 401/200/403/503, 기존 exact 응답/등록 Provider 유지.
5. `tests/integration/test_f20_u01_r38_budget_host_pg15.py`: Main 소유 실제 PG15 opt-in 및 경계 검증. 제품 source·실제 configured host 사용. 로컬 기본 실제 PG 테스트는 SKIP.
6. 본 결과보고서.

`BudgetSnapshot`의 RESERVED/RECONCILIATION_REQUIRED 예약 노출액·active 수 및 모든 상태의 consumed 합계는 기존 B10 정의를 보존했다. CONSUMED 예약은 active 노출액에 넣지 않는다. dispatch receipt는 생성하지 않으며 request_ids는 빈 tuple이다. forecast_cost를 예상 비용 초과 카드나 authoritative actual로 해석하지 않는다. DB 실패를 []로 바꾸지 않고 source는 BUDGET_SOURCE_UNAVAILABLE, 기존 Operations/API 경계는 generic 503으로 닫는다.

## 조치와 검증 evidence

모든 로컬 Python 명령의 실행 파일은 `C:/Users/cyhuh/anaconda3/python.exe`, cwd는 위 worktree이다. 아래 명령은 실제 실행한 argv이며, 환경을 생략한 원격 명령을 주장하지 않는다.

### 순차 TDD

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_operations_budget_read.py --tb=short
```

- 구현 전 exit1, **43 failed/0.90s**, 모두 새 source 모듈 부재.
- 최소 구현 뒤 동일 명령 exit0, **43 passed/0.34s**.

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_f20_u01_r38_budget_host_binding.py --basetemp=.tmp_subagent_review/r38/host-red --tb=short
```

- host 결선 전 exit1, **4 failed, 6 passed/4.96s**. 실제 GET budget=[] 및 budget 오류의 잘못된 200이 RED로 확인됨.
- 첫 결선 검증 52P/1F: 새 테스트가 기존 lifecycle 문자열을 USAGE_RECONCILIATION_REQUIRED로 오기했다. 기존 `projection.py:43–57` 계약의 USAGE_UNKNOWN으로 테스트만 정정; 제품 의미 변경0.
- 새 테스트+기존 R37 두 재현 node: **53P/2F/4.75s**, 두 실패는 아래 기존 fixture 경계.

### 최종 focused

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_operations_budget_read.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r38_budget_host_pg15.py --basetemp=.tmp_subagent_review/r38/focused-final --tb=short -rs
```

exit0: **67 passed, 1 skipped, 1 warning in 4.44s**. SKIP=R38 Main-owned PG15 opt-in 미설정. SQL selector의 cross-project/env 배제, inbound/outbound run mismatch를 거부 단계에 보존, legacy NULL 행 보존은 SQLite SELECT 실행으로도 확인했다. 이는 PostgreSQL transaction/isolation 실증이 아니다.

### 전체 관련 discovery — NON-GREEN 그대로 보존

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/budget tests/observability tests/persistence/test_f20_u01_r8_queue_read.py tests/persistence/test_operations_budget_read.py tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r38/related-discovery --tb=short -rs
```

exit1: **16 failed, 457 passed, 7 skipped, 1 warning in 17.69s**. 실행 당시 persistence 집중은 SQL predicate 보강 4건 이전 43개였다. SKIP은 PG18 4건/R3a PG15/R36 PG15/R37 PG15 각 1건이다.

정확한 실패 node와 최소 추가 경로:

- `tests/observability/test_f20_u01_r17_run_host_binding.py::test_oidc_host_uses_fixed_scope_and_loads_only_on_run_summary` (1F).
- `tests/observability/test_f20_u01_r36_agent_host_binding.py::test_oidc_host_pins_scope_engine_and_never_eagerly_reads_agents` (1F).
- `tests/api/test_f20_u01_r9_oidc_queue_host.py::test_oidc_process_loads_queue_on_each_owner_read_with_fixed_scope` (1F).
- `tests/api/test_f20_u01_r37_provider_host_binding.py` (12F): `test_no_configuration_still_projects_nine_registration_rows`, `test_each_read_observes_registration_changes_without_secret_alias`, `test_each_canonical_credential_maps_only_to_its_registration[cerebras/groq/mistral/openrouter/upstage/gemini/anthropic/openai/ollama]` 9개, `test_dashboard_keeps_exact_contract_permission_and_scope`.
- `tests/integration/test_f20_u01_r37_provider_host_pg15.py::test_pg_scenario_uses_returned_oidc_host_not_a_separate_api` (1F, local fixture).

동일 원인: 이 fixture들은 Queue/Run 등의 DB owner를 대역 처리하고 SQLite engine만 주입하지만, 새 PostgreSQL budget source의 빈 관측을 명시하지 않는다. 새 source는 SQLite REPEATABLE READ/READ ONLY 및 예산 schema 부재를 정상적으로 거부하여 기존 owner의 QUEUE_SOURCE_UNAVAILABLE/API503이 된다. R37 SingletonThreadPool teardown에서 SQLite thread-affinity 로그도 동반했다. 제품 DB 예외를 삼키는 수정은 금지하며, 각 local fixture에 **명시적인 `ScopedBudgetSource((), ())`만 주입**하는 테스트 구성 revision이 필요하다. 기존 assertion/실제 PG host 경로는 유지해야 한다. 해당 5개 파일은 수정0이다.

### 인접 subset GREEN (전체 관련 PASS 아님)

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/budget tests/persistence/test_operations_budget_read.py tests/persistence/test_f20_u01_r8_queue_read.py tests/persistence/test_f20_u01_run_read.py tests/observability/test_f13_operations.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r38_budget_host_pg15.py --basetemp=.tmp_subagent_review/r38/adjacent --tb=short -rs
```

exit0: **384 passed, 6 skipped, 1 warning in 12.62s**. 실행 시작 당시 persistence 집중 43건이며, 후속 predicate 4건은 위 최종 focused에서 검증했다. SKIP=PG18 4/R3a PG15 1/R38 PG15 1. warning은 기존 python_multipart deprecation이다.

### 구문·통제·diff

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -c "from pathlib import Path; paths=['packages/persistence/operations_budget_read.py','apps/api/anvil_api/oidc_process.py','tests/persistence/test_operations_budget_read.py','tests/api/test_f20_u01_r38_budget_host_binding.py','tests/integration/test_f20_u01_r38_budget_host_pg15.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE_PASS',len(paths))"
C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress
git diff --check
```

builtin compile **5 PASS/exit0**, G-05 **PASS sequence=2032 reporting=AUTO_CONTINUE/exit0**, tracked diff-check **exit0**. tracked diff는 oidc_process.py **4 insertions/0 deletions**이다. 신규 untracked source/test/report는 `git diff --check` 단독 적용 대상이 아니므로 별도 `git diff --no-index --check -- NUL <각 새 파일>`로 whitespace를 확인했다. 신규5파일 각각 exit1(새 파일 차이 존재), whitespace 진단 출력0이며 이를 exit0이라고 표기하지 않는다. 해당 파일들의 전체 내용도 인계 diff에 포함한다. 최종 status exact6/staged0, HEAD는 착수 SHA 그대로다.

### 오류 분류·임시물

- 정식 FAILURE_REPORT **0**. 예상 TDD RED와 Main scope revision 대기는 정식 실패로 계수하지 않는다.
- 잘못 추정한 `tests/persistence/test_intervention_budget_repository.py`를 포함한 최초 관련 명령 1회는 수집 전 file-not-found/실행0이었다. 실제 존재 파일 목록 확인 후 위 discovery 명령으로 교정했다. 제품 오류와 분리한다.
- 테스트 lifecycle 기대 문자열 오기 1회는 앞선 설명대로 기존 owner 원문에 맞춰 수정했다.
- 읽기 전용 탐색의 존재하지 않는 경로/glob 오류는 파일 mutation 없이 수정했다.
- 임시 inventory의 FileInfo.Parent base-path 처리 오류 1회: 삭제 전 발생하여 삭제0, 이후 `GetDirectoryName(FullName)`로 재검증했다.
- 전용 root `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r38`: 정리 전 파일410/디렉터리232/링크86. root 비ReparsePoint, 링크 target 전부 root 내부, 외부 target0, Python process0 확인. 완료된 pytest 세션 65848/94151 포함 잔여 실행 없음.
- 위 root 링크만 먼저 unlink하고 링크0 재확인 후 **그 exact root만** Remove-Item -LiteralPath -Recurse로 제거, 사후 Test-Path=False. 임시 residue0. 다른 node 프로세스227개는 귀속을 추측하거나 종료하지 않았다. 기존 공통 tmp 부모·다른 자원 변경0.

## 실제 PG15 실행 준비 및 미검증

Main용 opt-in: `ANVIL_U01_R38_PG_ISOLATED=1`, `ANVIL_U01_R38_PG_DSN`의 driver `postgresql+psycopg`, host `127.0.0.1`, port `5551`, user/database `anvil_u01_r38`만 허용. DSN/비밀 출력 금지. PG15/non-superuser/head0019 및 주요14 테이블과 auth6 테이블 empty를 선확인한다. Main은 disposable tmpfs/container/동일 SHA/최종 자원 제거를 소유한다.

시나리오는 persisted synthetic Task/Run/ledger/reservation을 커밋하고 실제 OIDC configured app에서 401→200→권한 철회403, 자기 범위 비0 literal 합계·타 scope 제외·Run mismatch503·전체 row 전후 불변·DB transaction_read_only=on을 확인하도록 작성했다. 이는 budget read schema fixture이며 실행 승인/Run 실행/Provider 사용 영수증을 꾸민 것이 아니다. 변경된 fixture 행은 정확 ID로 finally cleanup하고 auth6/주요14 baseline 복원을 단언한다. 로컬에서는 실제 PG 테스트 본문을 **실행하지 않았으므로 seed SQL/PG transaction/실제 GET 조합은 미검증**이다.

추가 미검증: 실제 Provider/IdP login/브라우저 Network/PG18/Production/예상 비용 초과 카드/기간 집계/F20·U01 최종 수락. UI/공개 JSON/권한/schema/migration 변경0.

## 다음 조치·rollback

Main이 계약 변경 없는 위 5개 local fixture 보완을 비의미 WI revision으로 기록하고 기존 lease 회수→새 epoch/exact11 권한을 발급하면 동일 writer가 이어서 수정한다. 그 후 전체 관련 GREEN과 동일 SHA Main PG15를 수행한다. 현 시점 INCOMPLETE를 유지하며 새 범위는 선행 write하지 않는다.

rollback은 이 exact6의 R38 delta만 Main이 검토해 되돌리는 것이다(oidc_process.py 추가4줄 제거, 신규5파일 제거). DB migration/지속 자료/원격 변경이 없어 데이터 rollback은 없다. Developer stage/commit/push/WSL 실행0, Main progress/Event/HANDOFF/WORK_STATUS/control 수정0, lease 회수0.

### 제품·테스트 SHA256

| 경로 | SHA256 |
|---|---|
| packages/persistence/operations_budget_read.py | FE4448565B252129F94B094FA54FAA06F54E96C8A1043945C55B7EBDF13328AD |
| apps/api/anvil_api/oidc_process.py | 9C662504A34A65398D271591D504C65BDD1533664C56FAF66E5F673D94F1E304 |
| tests/persistence/test_operations_budget_read.py | E52915F26ED1433F6C1CE7BCE8040282C8542166B9F9DCE3BE4EE1D4073D83C2 |
| tests/api/test_f20_u01_r38_budget_host_binding.py | 264FCBC170BBAFA1E882668917839ADC8606070BB8D6511D5400A18052C66E81 |
| tests/integration/test_f20_u01_r38_budget_host_pg15.py | 63C4012573C5D52E19403E04EC06CD77898636F7F6B79814FF77216F80775E91 |

보고서 자체 SHA는 자기참조 없이 인계 메시지에 별도 기록한다.
