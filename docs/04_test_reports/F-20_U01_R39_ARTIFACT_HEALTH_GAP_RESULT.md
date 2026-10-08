# F-20/U-01 R39 Artifact Store Health gap 개발 결과

## 판정

`COMPLETED` — Developer exact4 범위의 로컬 RED→GREEN, 인접 회귀 150건, G-05와 diff 검사를 완료했다. 이 결과는 F-20/U-01 수락 또는 Release 승격 판정이 아니다. C30은 `RECOVERED_WITH_QUARANTINED_HISTORY`, F-20/U-01은 미수락, ReleaseDecision은 `DEFER`다.

## 판단 이유

- 기준 worktree/branch/시작 HEAD: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, `4f075b7e9014e0d5216bda960c085616208f64b6`; 시작 `git status --short` 출력 0건. upstream `development/codex/f18-wsl-ops`. Lease 발급 당시 `dispatch_head=2ba2bd721ed73e2ba7300756707c9c67551611cf`이고 시작 HEAD는 그 lease 발급 control commit이다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R39 계획 `267DF4AFEFB70930137A86287E0F9B2D28E03C313A8FC4511BB7E75906C783DA`, WorkInstruction `33DBA84D7285110DC7E2C7DEE0FC6EEF71B5B6310C47F6DADAC00EACDA7233F6`, Invocation `F02041AE7540B8BEB97DB80C5B19B61C7DC5BC1B73013DEA218CA825F67D3D6F`가 전달값과 일치했다. Canonical seq2052의 worker/write lease는 actor `developer-primary-f20-u01-r39`, epoch56, `ACTIVE`, 정확 네 경로, execution token `f20-u01-r39-execution-fence-epoch-56-r39gap1004`, write token `f20-u01-r39-write-fence-epoch-56-r39gap1004`, 만료 `2026-10-05T12:32:38+00:00`로 확인했다.
- RED: source가 전혀 없을 때 F-13 및 Dashboard API의 `source_gaps`에서 `artifact_store`가 누락되는 동일 결함을 2건의 assertion 실패로 재현했다. 실제 `HealthSignal("artifact_store", "UNKNOWN", ...)`이 있는 경우의 별도 테스트 1건은 수정 전에도 PASS했다.
- GREEN: `project_operations`의 gap 후보를 이미 구성된 여섯 `health` key로 제한해, 신호 부재 시 `artifact_store` gap을 한 번 추가한다. 신호 존재 시 해당 gap은 없고 `UNKNOWN` state, 관측시각, error count, 상세 경로, evidence와 나머지 gap을 보존한다. 신규 ping, source, API, DB, UI, 권한·Secret 변경은 없다.

## 조치와 실행 증거

변경 전후 diff는 `packages/observability/projection.py`의 gap 후보 5개 고정 tuple→기존 `health` 6개 key 한 줄, `tests/observability/test_f13_operations.py`의 전부 부재 exact 7 gap·6 UNKNOWN 및 실제 신호 존재 회귀, `tests/api/test_f20_u01_r10_dashboard_api.py`의 scoped Dashboard 응답 exact 7 gap·Artifact Store UNKNOWN이다. 다른 scope 403, secret-safe 503 테스트는 기존 suite 그대로 실행했다. 이 문서가 네 번째 변경 파일이다.

| 실행 명령 | 종료 코드와 실제 결과 |
|---|---|
| `.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp=D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest-r39-artifact-gap tests\observability\test_f13_operations.py::test_missing_sources_remain_unknown_with_source_gaps tests\observability\test_f13_operations.py::test_artifact_store_signal_removes_only_its_gap_and_preserves_health_evidence tests\api\test_f20_u01_r10_dashboard_api.py::test_dashboard_read_is_scoped_snapshot_with_unknown_gaps_and_no_mutation` (구현 전) | `1`; 예상 RED 2 failed, 1 passed. 두 실패 모두 `artifact_store` gap 누락. |
| 같은 명령 (projection 한 줄 수정 후) | `0`; 3 passed. |
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest-r39-artifact-gap tests\observability tests\api\test_f13_operations_api.py tests\api\test_f20_u01_r10_dashboard_api.py tests\api\test_f20_u01_r10_oidc_dashboard.py tests\api\test_f20_u01_r9_oidc_queue_host.py tests\api\test_oidc_process.py --tb=short -rs` | `0`; F-13/인접 OIDC/Dashboard `150 passed in 4.84s`, SKIP 0. |
| `.venv\Scripts\python.exe -B -m scripts.check_project_progress` (pytest temp 존재 시) | `1`; `R39_GIT_INVALID`는 테스트가 만든 untracked 전용 temp 때문. 제품 테스트 실패나 정식 `FAILURE_REPORT` 횟수에 넣지 않음. |
| 전용 temp의 root와 하위 14개 symlink target 확인 후 `Remove-Item -LiteralPath D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest-r39-artifact-gap -Recurse -Force` | `0`; 모든 target이 그 temp 내부, 제거 후 `Test-Path=False`. 다른 경로 삭제 0. |
| `.venv\Scripts\python.exe -B -m scripts.check_project_progress` (temp 정리 후) | `0`; `G-05 project progress contract: PASS sequence=2052 reporting=AUTO_CONTINUE`. |
| `git diff --check` | `0`; tracked whitespace 오류 0. |
| `git diff --no-index --check -- NUL docs/04_test_reports/F-20_U01_R39_ARTIFACT_HEALTH_GAP_RESULT.md` | `1`; 신규 파일 차이로 인한 정상 종료 코드이며 출력 0줄, whitespace 오류 0. |
| `git status --short` | `0`; 수정 3개와 신규 결과보고서 1개만 표시. 사용자 전역 ignore 파일 접근 경고가 있지만 네 경로 판정에는 영향 없음. |

정식 동일 실패보고 0회. 환경 산출물로 인한 G-05 재실행 1회, Windows Git의 `core.excludesFile=NUL` 진단 1회는 `fatal: cannot use NUL as an exclude file`로 종료했으나 이후 일반 `git status --short`로 정확 네 경로를 확인했다. 현재 미해결 제품 오류 0건. 실행한 pytest에서 SKIPPED/BLOCKED 0건. 실제 Artifact Store 연결·PG·브라우저 Network·외부 Provider·WSL exact SHA는 이 Developer 절편에서 `NOT_EXECUTED`이며 PASS로 보지 않는다.

## 인계와 rollback

Main이 exact4 diff 및 신규 보고서 검토, checkpoint/private push, WSL-server 동일 SHA QA, canonical Event/lease 종료, WORK_STATUS·progress/HANDOFF 갱신을 맡는다. Developer는 commit·push·WSL·Event·WORK_STATUS·progress/HANDOFF를 변경하지 않았다. Main 검증 전에는 수락 또는 Release 결정을 올리지 않는다.

Rollback은 Main이 향후 R39 checkpoint commit의 위 세 코드·테스트 파일 변경을 역적용하고 로컬 집중·인접 회귀와 G-05를 다시 실행하는 것이다. 누락 `artifact_store` gap이 되돌아가므로 rollback 시 해당 결함을 다시 열린 상태로 기록해야 한다.
