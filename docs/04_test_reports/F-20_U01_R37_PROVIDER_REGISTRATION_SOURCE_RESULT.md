# F-20/U-01 R37 Provider 등록 상태 source 결과

## 판정

`COMPLETED` — 승인된 host 결선과 로컬 기본 검증 완료. Main의 동일 SHA PG15 QA·독립 판정 전이며 Provider 실연결, 브라우저, 운영 Health, U-01/F-20 수락을 의미하지 않는다. C30 `OPEN_BLOCKING` / `DEFER` 유지.

## 판단 이유

- 착수 branch `codex/f18-wsl-ops`, HEAD/upstream `35887f377d30ea80987525dfe14cade8044b5218`, clean. 해당 HEAD는 lease baseline `6aa7fd80f78ea849cccd0c6378d298c2b317b35d`의 Main control 후속이다.
- Plan SHA256 `719B854C7D23602B1633070C85BF019463BBC813BDC360265795BEE90B97B230`.
- WI SHA256 `574B009FE062DFA1396EE7B6DADDAB6D1C044C03DE49797A94A4CC20E414719E`.
- Invocation SHA256 `435D3D99397E43D4CE4FAA9593893FBF2A502EA16DAD9C98AF5310B70685371B`.
- canonical sequence2026, actor `developer-primary-f20-u01-r37`, epoch52, worker `worker-lease-f20-u01-r37-r37prov1004`, execution `f20-u01-r37-execution-fence-epoch-52-r37prov1004`, write `write-lease-f20-u01-r37-r37prov1004`, write fence `f20-u01-r37-write-fence-epoch-52-r37prov1004`. 만료 `2026-10-04T08:21:43+00:00`. Developer가 lease/control을 수정·회수하지 않았다.
- 무설정 host에서 기존 `providers=[]`를 실제 RED로 확인했다. 최소 결선 후 canonical 9개 등록 행과 설정 추가/삭제/빈 값의 fresh read를 확인했다.
- 설정됨은 `DEGRADED/REGISTERED/NOT_CHECKED`, 없음은 `NOT_CONFIGURED/MISSING/NOT_CHECKED` 그대로다. Provider Health는 `UNKNOWN` 및 source gap 유지. 가용 모델·성공률·quota·실제 건강을 추정하지 않는다.
- Dashboard 공개 exact13, Provider 행 exact4를 유지한다. 권한403, 외부 scope의 Queue DB/Provider 구성 이전 거부, equality callback0, Queue 실패503, Provider 구성 실패503, synthetic secret/내부 URL 비노출, detached 응답, Queue/Run/Agent/Alert 기존 경계를 검증했다.

## 조치와 exact4 diff

1. `apps/api/anvil_api/oidc_process.py`: 기존 service import 1개, Queue scope builtin str 선검증, 승인 scope의 Queue read 뒤 `OperationsSources(provider=ProviderStatusService(environment))`. eager query 없음. 다른 owner/제품 모듈 수정 없음.
2. `tests/api/test_f20_u01_r37_provider_host_binding.py`: 로컬 host/API 19개 검사. R13 DB 읽기만 fixture로 대체하며 실제 ProviderStatusService/OperationsService/API를 사용한다.
3. `tests/integration/test_f20_u01_r37_provider_host_pg15.py`: opt-in target 음성9/양성1 + 실제 PG15 host/API 1개. 실제 DB test는 기본 SKIP. DB·컨테이너·migration 생성/삭제를 수행하지 않는다.
4. 이 결과보고서.

구현 파일 SHA256:

| 경로 | SHA256 |
|---|---|
| apps/api/anvil_api/oidc_process.py | 61782BDC35DB061C24F3A51F05CBB2515B2CD38101D62190418746755261D457 |
| tests/api/test_f20_u01_r37_provider_host_binding.py | CD6A99D36E2DAD317BA2E1B4CD95AA4EC10861D65800B7DFC1D623A8C0FFF44E |
| tests/integration/test_f20_u01_r37_provider_host_pg15.py | 8B87BAC972A112ED7C260D78C8FB77EE46C3F0ECCF4FFC3F2A121B91464D71AA |

보고서 자체 hash는 최종 외부 인계에 제공한다(자기참조 hash를 본문에 넣지 않음).

## 정확한 로컬 검증

cwd `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, Python `C:\Users\cyhuh\anaconda3\python.exe`.

RED:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_f20_u01_r37_provider_host_binding.py --basetemp=.tmp_subagent_review/r37/red --tb=short
```

exit1: `4 failed, 5 passed, 1 warning in 4.23s`. 등록 행 누락 3F, hostile scope equality callback 1F. 최초 RED의 local SQLite teardown 스레드 경고1은 연결되지 않은 Run source fixture 때문에 발생했다. Run/Agent R13 source를 명시적인 immutable 빈 fixture로 공급해 SQL 실행·경고를 제거했다. 제품 실패보고가 아닌 테스트 fixture 보완이다.

최소 GREEN: 같은 명령에서 basetemp=`.tmp_subagent_review/r37/green`, exit0 `9 passed, 1 warning in 2.99s`.

최종 집중:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_f20_u01_r37_provider_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py --basetemp=.tmp_subagent_review/r37/focused-final --tb=short -rs
```

exit0: `29 passed, 1 skipped, 1 warning in 2.33s`. SKIP은 R37 실제 PG15 opt-in 부재이며 PASS 아님.

최종 관련 회귀:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability tests/api/test_oidc_process.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r37/related-final --tb=short -rs
```

exit0: `210 passed, 2 skipped, 1 warning in 8.31s`; session41037의 종료코드0까지 회수했다. R36/R37 실제 PG15 각각 SKIP. 공통 경고는 기존 `python_multipart` deprecation1. 보강 전 관련 검증도 exit0 200P/2S/8.19s였다.

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress
git diff --check
& C:/Users/cyhuh/anaconda3/python.exe -B -c "from pathlib import Path; paths=['apps/api/anvil_api/oidc_process.py','tests/api/test_f20_u01_r37_provider_host_binding.py','tests/integration/test_f20_u01_r37_provider_host_pg15.py']; [compile(Path(p).read_bytes(), p, 'exec') for p in paths]; print('COMPILE 3 PASS')"
```

모두 exit0; G-05 `PASS sequence=2026 reporting=AUTO_CONTINUE`, compile3 PASS. 당시 `git diff --check` 출력0은 tracked unstaged `oidc_process.py`만 검사한 결과다. 신규 untracked 3개는 그 명령에 포함되지 않았으며 리뷰 보완에서 별도 no-index check로 추가 검증한다. bytecode 생성 없는 builtin compile 사용.

## 오류·임시물·미검증 경계

- formal FAILURE_REPORT0. TDD 예상 RED4는 정식 실패 아님. 내부 read-only 조회의 존재하지 않는 `provider_policy.py` 경로 오류1(파일 생성/수정0), 최초 process inventory에서 존재하지 않는 process-name 조회 exit1은 최종 `Get-Process` 필터 방식 exit0으로 확인했다. Git global ignore 접근 경고는 기존 환경 경계로 설정 변경0.
- 임시 root는 정확히 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r37`. 최종 inventory root non-link, files362/directories202/symlinks74, 외부 target0. 실행 세션 종료 및 Python process0 확인 후 74 링크 자체를 먼저 unlink하고 reparse0 재확인, 해당 root만 삭제했다. `Test-Path=False`, residue0. 다른 Node/사용자 프로세스는 정체를 추정하거나 종료하지 않았다. 삭제 대상은 테스트가 생성한 synthetic trust/임시물뿐이며 재실행으로 복구 가능하다.
- 실제 PG15/WSL-server/브라우저/Provider/IdP 로그인/Production/PG18/Oracle/비용 관측은 NOT_EXECUTED. registration-only local PASS를 실제 Provider 건강으로 승격하지 않는다. UI를 수정하지 않았고 browser Network를 새로 실행하지 않았다.
- opt-in은 `ANVIL_U01_R37_PG_ISOLATED=1`, `ANVIL_U01_R37_PG_DSN`의 `postgresql+psycopg`, host `127.0.0.1`, port5550, DB/비관리자 role `anvil_u01_r37`, PG15/head `0019_oidc_sessions`, 지정8개 tables empty를 강제한다. Main이 동일 SHA 전용 disposable DB를 준비해야 한다. fixture credential은 synthetic presence 값이며 Provider에 전송하지 않는다.
- 최초 opt-in은 별도 API fixture를 통해 GET하여 실제 OIDC host route 증거가 아니었다. 이 한계는 아래 리뷰1에서 수정했으며 최초 결과를 실제 host PASS로 사용하지 않는다. IdP code exchange/브라우저 로그인은 여전히 미검증이다.

## 인계·rollback

Main 소유 WORK_STATUS/progress/Event/lease/control 수정0, commit/stage/push0. 다른 파일의 변경을 되돌리지 않았다. Main 독립 diff 검토와 동일 SHA WSL opt-in 결과 후에만 별도 판정한다. rollback은 이 exact4 delta만 Main이 검토하여 역적용하며 DB/schema/UI/공개 계약 rollback은 필요 없다. 현재 lease는 유지한 상태로 인계한다.

## 독립 리뷰1 대응 — 실제 OIDC 호스트 경로

판정: 로컬 재작업 `COMPLETED`, 실제 PG15는 Main opt-in 대기. Important1(빈 FastAPI host/별도 API GET)와 Minor1(untracked diff-check 적용범위)을 보완했다. formal FAILURE_REPORT0 유지.

- 재확인 시각 `2026-10-04T05:45:21+09:00`: 동일 actor/epoch52/두 token/exact4·만료08:21:43 UTC가 유효했다. 제품 코드 추가 변경0; 이 회차는 integration test와 결과보고서만 수정했다.
- `_build_host`가 `create_oidc_process_app(environment, host)`에서 실제 `create_configured_oidc_asgi_app(**kwargs)`를 호출한다. 반환 앱의 `auth_mode=OIDC`, `operations_bound=True`, `local_test_session_enabled=False`, 정확 database engine identity를 검증한다. GET은 이 반환 앱의 TestClient로만 수행하며 별도 `client()`/`create_app` 우회는 없다.
- 실제 OIDC coordinator/session store/principal directory로 인증한다. fixture는 전용 DB에 합성 user/role/binding/session만 넣는다. 무cookie401 → 정확 session cookie200 → DB role의 dashboard:read 제거 후 동일 cookie403. `authenticate`/권한 resolver를 대체하지 않는다.
- GET마다 기존 등록9행/공개 exact13/Health UNKNOWN/NOT_CHECKED/Queue·Run 자료를 검증한다. 사업 테이블8개는 전후 count 동일; auth row 전체도 읽기 전후 동일하다. 오직 fixture 준비/권한 음성 준비만 DB row를 쓰며 해당 row를 finally에서 정확 predicate로 삭제하고 auth6개 테이블의 원래 빈 baseline 복원을 단언한다. 중간 assertion 예외에도 정리되는 별도 로컬 회귀를 추가했다.
- IdP transport는 호출 즉시 실패하는 `httpx.MockTransport`로 묶는다. 이 테스트는 실제 외부 IdP 로그인 성공이나 Provider network 성공을 주장하지 않는다. 로컬은 SQLite auth persistence/실제 ASGI 앱 경로이며 Queue/Run DB read는 fixture다. PG opt-in에서는 실제 PostgreSQL owner/repository를 사용한다.

리뷰 RED 정확 명령:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_f20_u01_r37_provider_host_pg15.py::test_pg_scenario_uses_returned_oidc_host_not_a_separate_api --basetemp=.tmp_subagent_review/r37-review/red --tb=short
```

exit1 `1 failed, 1 warning in 2.24s`, `auth_mode=None`인 빈 앱임을 재현. helper와 실제 auth/cleanup 경로를 보완한 파일 단독 GREEN은 exit0 12P/1S/2.35s.

fresh 집중:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_f20_u01_r37_provider_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py --basetemp=.tmp_subagent_review/r37-review/focused --tb=short -rs
```

exit0 `31 passed, 1 skipped, 1 warning in 2.49s`.

fresh 관련:

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/agent_team/test_provider_status_c24.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/integration/test_f20_u01_r37_provider_host_pg15.py tests/integration/test_f20_u01_r36_agent_host_pg15.py --basetemp=.tmp_subagent_review/r37-review/related --tb=short -rs
```

exit0 `253 passed, 3 skipped, 1 warning in 11.33s`; session99955 종료0. R3a/R36/R37 PG opt-in 각1 SKIP. G-05 module 명령 재실행 exit0 seq2026 PASS, 위 compile3 재실행 exit0. 기존 deprecation1 외 추가 경고 없음.

정확 임시 root `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r37-review`는 root non-link, files205/directories117/links42, 외부 target0, Python0 확인 후 링크 자체→root 순으로 정리했다. residue0, 다른 프로세스/경로 삭제0.

tracked와 신규 untracked를 구분한 최종 whitespace 검증:

```powershell
git diff --check
git diff --no-index --check -- NUL tests/api/test_f20_u01_r37_provider_host_binding.py
git diff --no-index --check -- NUL tests/integration/test_f20_u01_r37_provider_host_pg15.py
git diff --no-index --check -- NUL docs/04_test_reports/F-20_U01_R37_PROVIDER_REGISTRATION_SOURCE_RESULT.md
```

실행 결과: tracked check exit0/출력0; 신규 세 파일의 no-index check는 각각 exit1/출력0이다. no-index가 NUL 대비 새 파일 차이 존재를 exit1로 표시한 것이며 whitespace 오류 출력은 없다(이를 exit0으로 기록하지 않음). Git stage/commit/push0, Main WORK_STATUS/control 변경0. 실제 PG/브라우저/운영 미검증 및 C30 OPEN_BLOCKING/DEFER 유지.
