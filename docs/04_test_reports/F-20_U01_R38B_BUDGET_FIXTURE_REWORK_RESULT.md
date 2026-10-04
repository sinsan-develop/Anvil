# F-20/U-01 R38B Budget Fixture Rework 결과

## 판정 — COMPLETED (로컬 fixture 보완)

2026-10-04. R38에서 남았던 기존 SQLite host fixture 16개 실패를 fresh RED로 재현한 뒤, 승인된 5개 테스트 파일에만 명시적 빈 Budget source를 주입했다. 동일 16개 GREEN, 전체 관련 477P/7S/0F, focused 114P/2S/0F, 인접 388P/6S/0F이다. 이 완료는 R38B 로컬 보완 범위이며 Main의 실제 PG15 QA 및 독립 수락을 대신하지 않는다. C30 OPEN_BLOCKING/DEFER, F-20/U-01 미수락 유지.

## 판단 이유 — 권위·원인·변경 경계

- worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`.
- 착수 HEAD/upstream `1f29117214e76ad1aa31a016e8aef079828c982d`, status clean. private 동일은 Main 전달 근거이며 Developer 원격 조회0.
- G-05 seq2038 PASS, actor `developer-primary-f20-u01-r38b`, epoch54 ACTIVE를 실제 canonical에서 확인했다.
- worker `worker-lease-f20-u01-r38b-r38bfix1004`, execution token `f20-u01-r38b-execution-fence-epoch-54-r38bfix1004`.
- write `write-lease-f20-u01-r38b-r38bfix1004`, write token `f20-u01-r38b-write-fence-epoch-54-r38bfix1004`.
- 발급 `2026-10-04T08:47:10+09:00`, 만료 `2026-10-04T20:47:10+09:00`; 발효 후 exact6 확인하고 수정했다.
- WI SHA256 `7CC62EEEB1215784AF516A050B67F224842AF8396B03F427735467669B44B7DE`.
- Invocation SHA256 `810FA519E1811D7BEA9C66A8E27F589935C6BBBDA1160A1E5D2FDB9B7CAF87DC`.
- 파생 binding SHA256 `4B3327B2FB3FF95A9A8ACBC34B3C78EC9213C6EDABA47E47D14CF35CA12919DA`, ID `MAIN_RECONFIRMED_NON_SEMANTIC:F20-U01-R38B-FIXTURE-20261004-001`.
- 부모 R38 결과 SHA256 `2FF2625D90C8611AA72CE23628BC9E74908AAD6C9A001140E74DC47888F38340`. 원 WI/계획/제품 의미 변경0.

기존 local fixture는 Queue/Run/Agent owner를 대역 처리하면서 새 PostgreSQL Budget read만 SQLite로 통과시키려 했다. 이로 인해 정상적인 제품 fail-closed가 QUEUE_SOURCE_UNAVAILABLE/API503으로 나타났다. 제품 DB 오류를 빈 성공으로 바꾸지 않고, local fixture에서만 `ScopedBudgetSource((), ())`를 반환하도록 했다. 각 대역은 `actual_engine is engine`과 `(project, environment)==('project-1','wsl-qa')`를 검사한다.

변경 exact6:

1. `tests/observability/test_f20_u01_r17_run_host_binding.py`
2. `tests/observability/test_f20_u01_r36_agent_host_binding.py`
3. `tests/api/test_f20_u01_r9_oidc_queue_host.py`
4. `tests/api/test_f20_u01_r37_provider_host_binding.py`
5. `tests/integration/test_f20_u01_r37_provider_host_pg15.py` — **local_host fixture에만** 추가.
6. 본 결과보고서.

기존 테스트 5개 파일 각 8줄 추가, 총 **40 additions/0 deletions**. 기존 assertion 삭제·완화0. R37 `_build_host` 및 `test_opt_in_real_pg15_oidc_host_dashboard_registration_read_only` 함수의 source segment가 HEAD와 exact 동일함을 AST로 대조했다. R38 제품 read adapter/oidc_process/새 R38 테스트/기존 R38 결과, 공개 API·권한·schema·control 변경0.

## 조치 — 정확한 실행 명령과 결과

모든 명령은 위 worktree의 `C:/Users/cyhuh/anaconda3/python.exe`로 실행했다.

### 기존 16개 RED → GREEN

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability/test_f20_u01_r17_run_host_binding.py::test_oidc_host_uses_fixed_scope_and_loads_only_on_run_summary tests/observability/test_f20_u01_r36_agent_host_binding.py::test_oidc_host_pins_scope_engine_and_never_eagerly_reads_agents tests/api/test_f20_u01_r9_oidc_queue_host.py::test_oidc_process_loads_queue_on_each_owner_read_with_fixed_scope tests/api/test_f20_u01_r37_provider_host_binding.py::test_no_configuration_still_projects_nine_registration_rows tests/api/test_f20_u01_r37_provider_host_binding.py::test_each_read_observes_registration_changes_without_secret_alias tests/api/test_f20_u01_r37_provider_host_binding.py::test_each_canonical_credential_maps_only_to_its_registration tests/api/test_f20_u01_r37_provider_host_binding.py::test_dashboard_keeps_exact_contract_permission_and_scope tests/integration/test_f20_u01_r37_provider_host_pg15.py::test_pg_scenario_uses_returned_oidc_host_not_a_separate_api --basetemp=.tmp_subagent_review/r38b/red --tb=short
```

수정 전 exit1, **16 failed, 1 warning in 2.49s**. 실패는 기존 QUEUE_SOURCE_UNAVAILABLE 또는 expected200/actual503으로 정확히 재현했다. 수정 후 동일 명령의 basetemp만 `.../r38b/green`으로 변경: exit0, **16 passed, 1 warning in 2.06s**.

### 원래 R38 전체 관련 명령

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/budget tests/observability tests/persistence/test_f20_u01_r8_queue_read.py tests/persistence/test_operations_budget_read.py tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r38b/related --tb=short -rs
```

exit0, **477 passed, 7 skipped, 1 warning in 10.62s**. 부모 457P+16F에 후속 R38 SQL predicate 4건을 더한 총484건이다. SKIP=Budget PG18 4건, R3a/R36/R37 PG15 각1건. 저장소 전체 suite라고 주장하지 않는다.

### Focused — 수정 5파일과 R38 source/host/opt-in

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/persistence/test_operations_budget_read.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r38_budget_host_pg15.py tests/observability/test_f20_u01_r17_run_host_binding.py tests/observability/test_f20_u01_r36_agent_host_binding.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py --basetemp=.tmp_subagent_review/r38b/focused --tb=short -rs
```

exit0, **114 passed, 2 skipped, 1 warning in 3.26s**. SKIP=R38/R37 실제 PG15. R38 새 host의 비0 예산/DB failure503/scope·role 음성도 계속 통과하여 fixture 대역이 제품 fail-closed를 없애지 않았음을 확인했다.

### 인접 회귀

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/budget tests/persistence/test_operations_budget_read.py tests/persistence/test_f20_u01_r8_queue_read.py tests/persistence/test_f20_u01_run_read.py tests/observability/test_f13_operations.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r38_budget_host_binding.py tests/integration/test_f20_u01_r38_budget_host_pg15.py --basetemp=.tmp_subagent_review/r38b/adjacent --tb=short -rs
```

exit0, **388 passed, 6 skipped, 1 warning in 11.75s**. SKIP=PG18 4/R3a PG15 1/R38 PG15 1. 각 실행의 warning은 기존 python_multipart deprecation이다.

### 구문·실제 PG 경로 보존·G-05·diff

```powershell
C:/Users/cyhuh/anaconda3/python.exe -B -c "import ast,subprocess; from pathlib import Path; files=['tests/observability/test_f20_u01_r17_run_host_binding.py','tests/observability/test_f20_u01_r36_agent_host_binding.py','tests/api/test_f20_u01_r9_oidc_queue_host.py','tests/api/test_f20_u01_r37_provider_host_binding.py','tests/integration/test_f20_u01_r37_provider_host_pg15.py']; [compile(Path(p).read_bytes(),p,'exec') for p in files]; p=files[-1]; old=subprocess.check_output(['git','show','HEAD:'+p]).decode(); new=Path(p).read_text(); extract=lambda s,n: next(ast.get_source_segment(s,x) for x in ast.parse(s).body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef)) and x.name==n); names=['_build_host','test_opt_in_real_pg15_oidc_host_dashboard_registration_read_only']; assert all(extract(old,n)==extract(new,n) for n in names); print('COMPILE5_PASS; PG_HOST_AND_OPT_IN_UNCHANGED')"
C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress
git diff --check
```

각 exit0: compile5 PASS, 실제 PG host/opt-in 본문 보존, G-05 **PASS sequence=2038 reporting=AUTO_CONTINUE**, tracked whitespace 오류0. 신규 보고서는 별도 `git diff --no-index --check -- NUL docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md` 검사로 구분한다(새 파일 차이 exit1, whitespace 출력0).

## 임시물·오류 횟수·미검증·rollback

- 전용 root: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r38b`. pytest 전용 red/green/related/focused/adjacent만 생성했다.
- 정리 전 root 실경로 exact/비ReparsePoint, 파일452/디렉터리247/링크89, 링크 target 모두 root 내부·외부0, Python process0, 실행 세션 모두 종료 확인. 링크 자체89개를 먼저 unlink하고 링크0 확인 후 그 exact root만 삭제했다. 사후 Test-Path=False/residue0. 다른 process·공통 tmp 부모·사용자 자료 변경0.
- R38B 예상 RED 1회(16F) 외 unexpected 실행 오류0, 정식 FAILURE_REPORT0. 기존 Git global ignore 접근 경고는 읽기 조회 경고이며 설정을 바꾸지 않았다.
- 실제 WSL/PG15/PG18/Provider/IdP login/브라우저/운영은 **미실행**. Main의 동일 SHA PG15를 기다린다. localhost SQLite/in-process API PASS를 실제 DB나 운영 PASS로 승격하지 않는다.
- Main status/Event/progress/HANDOFF/control 수정0; Git stage/commit/push0; lease 회수0. 원래 R38 INCOMPLETE 보고서는 역사 증거로 보존했다.
- rollback: Main이 이번 테스트5파일의 추가40줄과 신규 R38B 결과보고서만 검토해 되돌릴 수 있다. 제품/DB/schema/원격 변경이 없으므로 데이터 rollback 없음.

## SHA256

| 파일 | SHA256 |
|---|---|
| tests/observability/test_f20_u01_r17_run_host_binding.py | E30DDC19622880BC9112E29B0308FB04DF85B4BAA031C4D375B1818FE3885250 |
| tests/observability/test_f20_u01_r36_agent_host_binding.py | C6B5C2D2B1EFEA9842280E9D5BF4C8B5E316A9DB9B7EA11961838D4DA849EE37 |
| tests/api/test_f20_u01_r9_oidc_queue_host.py | 843582317C48288CF103B2D572EBC7F3D4A92D064382E4EA544853F97DA2C368 |
| tests/api/test_f20_u01_r37_provider_host_binding.py | E5B2252B2B855072C36012BE965CB8C2E267D1E4F677C857ADEAD37800623CAC |
| tests/integration/test_f20_u01_r37_provider_host_pg15.py | E67A540392B378FB53981E7CBDE00778E32E4C7759B5C89C0DCDE1D0321C56A8 |

보고서 자체 SHA는 인계 메시지에 별도로 기록한다.
