# F-20/U-01 R1b 현재 projection 역사 테스트 결과

## 판정

- `COMPLETED` — 지정 테스트 RED→GREEN과 인접 역사 검사, G-05 seq1780 로컬 PASS. U-01 전체 및 F-20 수락 아님.
- 담당: `developer-primary-f20-u01-r1b`; Work Package `F-20/U01-R1B`. 정식 실패보고 0회, 원인 조사 중 도구 실행 방식 오류 1회.
- 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 본 WorkInstruction `444DBE10CC3E0002D5B6CDC85EB55F546AD6DFF399FD86E47D47AE3E8A098C74`, Invocation `505F76BF929DE39C09CF447B1891468DA385862AC0C9443A633D09B7549C8FDA`.

## 시작 상태와 원인

- 작업공간 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, 시작 HEAD `5297ccdfce333ea8605c1f82afa003a1c31382bc`; `git status --short --branch`는 `## codex/f18-wsl-ops...development/codex/f18-wsl-ops`만 표시하여 clean. dispatch HEAD `6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd` 뒤 `1126444733f2dabe0525d5e6be250b079ace1042` lease 발급과 `5297ccd` 상태 기록만 추가됐다.
- canonical seq1780, epoch11 `ACTIVE` worker/write lease의 actor와 정확한 두 경로를 확인했다. 실행 token `f20-u01-r1b-execution-fence-epoch-11-r1bbbf49d14ed1f`, 쓰기 token `f20-u01-r1b-write-fence-epoch-11-r1bbbf49d14ed1f`. 수정 전 `python -B -m scripts.check_project_progress .`는 G-05 PASS.
- 지정 테스트의 최초 RED는 현재 `F20_U01_R1B_HISTORY_START` projection을 과거 R5e `F20_R5E_AUDIT_INCIDENT_START`로 비교한 assertion이다. 이 때문에 현재 진행상태·handoff·digest·manifest 위조 거부 assertion까지 실행되지 않았다.

## 변경 diff와 검증

- `tests/tooling/test_project_progress.py`: 지정 테스트를 현재 R1b mode와 `F20_U01_R1B_PROGRESS_INVALID`, `F20_U01_R1B_DIGEST_INVALID`, `F20_U01_R1B_MANIFEST_INVALID`에 결박했다. handoff `HANDOFF_NEXT_ACTION_MISMATCH`를 유지했다. 현재 manifest 미수락, C30 사고 `OPEN_BLOCKING`, release `DEFER`를 추가 확인한다. R5e/R1 당시 progress·digest·manifest 각 3개는 해당 commit의 Git blob SHA-1과 mode·참조 경로·미수락 상태를 별도 테스트한다. 기존 assertion 삭제·skip·xfail 없음. `git diff --numstat`: 42줄 추가, 4줄 삭제.
- `docs/04_test_reports/F-20_U01_R1B_HISTORY_RESULT.md`: 이 결과 기록만 신규 작성. 제품 runtime/API/DB/화면/Event/manifest/frozen hash는 변경하지 않았다.

| 실행 명령 | 실제 결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .` | exit 1, 직접 스크립트 실행의 `scripts.f20_u01_r1_overlay` import 경로 오류. 모듈 방식으로 재실행하여 해소; 정본 계약 실패로 계상하지 않음. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` (수정 전) | exit 0, `G-05 ... PASS sequence=1780 reporting=AUTO_CONTINUE`. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_detached_digest_binds_current_progress_and_handoff_into_manifest_target` (수정 전) | exit 1, 1 FAIL: R5e 예상 mode와 현재 R1b mode 불일치. |
| 같은 `pytest` 실행 방식으로 위 지정 테스트와 `test_f20_r5e_and_u01_r1_history_remains_bound_to_git_blobs` 실행 | exit 0, 2 PASS. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k 'no_early_acceptance_or_lease_revoke or raw_binding_and_manifest_drift_fail_closed or detached_digest_binds_current_progress_and_handoff_into_manifest_target or f20_r5e_and_u01_r1_history_remains_bound_to_git_blobs or g05_historical_acceptance_chain_remains_immutable'` | exit 0, 5 PASS, 683 deselected. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` (수정 후) | exit 0, `G-05 ... PASS sequence=1780 reporting=AUTO_CONTINUE`. |

## Main 동일 SHA WSL-server 검증 후속 기록

- Main이 제품 commit `b8a477d3d864817ae752cd6dbb04f56386f6b59e`의 local/remote 일치를 확인했다. WSL-server의 clean 임시 checkout도 동일 SHA였다. 이 절은 Main이 전달한 실측 결과를 기록한 것이며 writer가 WSL 명령을 재실행한 증거가 아니다.
- WSL G-05 seq1780 PASS(exit 0), R1b 집중 2 PASS/6.36초(exit 0).
- 첫 정식 전체 suite: exit 1, `8211 passed, 3 failed, 116 skipped, 14 warnings in 1693.40s`. 로그 12,516 bytes, SHA-256 `bba00f55c17c9341e4e7f4029def282d0bdb43387e8d04ed4fa57efca3d253fe`. 실패 3건은 모두 C21 `C21_RUNTIME_CONTROL_V2_PARENT_INVALID`: 역사 commit `fb311d456fe3cbb2e8439f39017356ddec6cf266` 객체 누락이고 부모 `f0d4...` 객체는 있었다. 이 첫 실행은 전체 PASS가 아니다.
- Main이 disposable clone에 누락된 역사 commit만 fetch했다. 제품 checkout HEAD `b8a477d3d864817ae752cd6dbb04f56386f6b59e`와 clean 상태는 유지됐다. C21 해당 class 4 PASS/8.38초(exit 0).
- 두 번째 정식 전체 suite: exit 0, `8214 passed, 116 skipped, 14 warnings in 1900.83s`. 로그 11,417 bytes, SHA-256 `3d99a358e365683c897826b4e813c0e1ef8f97a8a3dece715c96b3b5b7b6e8d3`. 116 skip/14 warnings를 F-20 수락으로 승격하지 않는다.
- Main의 실제 WSL 내측 명령은 clean checkout `/tmp/anvil-f20-u01-r1b-product-b8a477d`에서 다음 순서로 실행됐다. 환경: `PATH=/home/daon/.local/opt/node-v22.23.2-linux-x64/bin:$PATH`, `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`.

```sh
.venv/bin/python -B scripts/check_project_progress.py
.venv/bin/python -B -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k "detached_digest_binds_current_progress_and_handoff_into_manifest_target or f20_r5e_and_u01_r1_history_remains_bound_to_git_blobs" --basetemp=/tmp/anvil-f20-u01-r1b-focused-b8a477d
.venv/bin/python -B -m pytest -q --tb=line -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-u01-r1b-formal-b8a477d
git fetch -q development fb311d456fe3cbb2e8439f39017356ddec6cf266
.venv/bin/python -B -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k C21WorkbenchUiWslImmutableRuntimeControlV2PublicationTests --basetemp=/tmp/anvil-f20-u01-r1b-c21-b8a477d
.venv/bin/python -B -m pytest -q --tb=line -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-u01-r1b-formal-r2-b8a477d
```
- Main이 임시 checkout·pytest base 두 곳·로그 두 곳의 정확한 5개 경로를 realpath/HEAD/clean/link count `4/258/258`로 확인한 뒤 삭제했다. 집중/C21 base temp는 생성되지 않아 부재 확인했다. 판정 `R1B_PRODUCT_WSL_RESIDUE_ZERO`. 공유 DB·Docker·Production은 건드리지 않았다.

## 미검증·다음 조치·rollback

- Main의 동일 SHA WSL-server G-05·집중·전체 suite 검증과 임시 자원 정리는 위와 같이 완료됐다. DB/API/브라우저/11개 메뉴 실제 기능, 사용자 인수·Production은 미검증이다. 전체 suite의 116 skip/14 warnings는 그대로 남는다.
- C30 원장 사고는 `OPEN_BLOCKING`, release `DEFER`, F-20 `REWORK_IN_PROGRESS`로 유지한다. U-01/F-20 수락, main 병합 및 Production 전환의 근거가 아니다. 다음은 Main의 결과보고서 독립 검토·commit 및 계획상 실제 기능 증거 확보다.
- rollback은 Main이 이 결과보고서 후속 기록만 되돌릴 수 있다. 제품 변경을 되돌릴 필요가 생기면 지정 두 경로의 해당 commit diff와 시작 HEAD `5297ccd`를 대조해 복원한다. 과거 Event/manifest와 통제 상태는 되돌리지 않는다. WSL 임시 5개 경로는 Main이 정리했으며 공유 DB·Docker에는 rollback 대상 변경이 없다.
