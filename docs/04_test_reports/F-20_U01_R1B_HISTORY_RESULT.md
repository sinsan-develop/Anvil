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

## 미검증·다음 조치·rollback

- 전체 pytest, WSL-server 동일 SHA, DB/API/브라우저/11개 메뉴, 사용자 인수·Production은 이 writer 범위에서 실행하지 않았다. 과거 전체 suite의 116 skip을 이 집중 PASS로 해소하지 않는다.
- C30 원장 사고는 `OPEN_BLOCKING`, release `DEFER`, F-20 `REWORK_IN_PROGRESS`로 유지한다. Main의 독립 diff 검토, commit/push 및 WSL-server 동일 SHA 검증과 임시 자원 정리가 다음 조치다.
- rollback은 Main이 이 두 경로의 변경만 Git diff로 되돌려 시작 HEAD `5297ccd`의 제품 상태로 복원한다. 과거 Event/manifest와 통제 상태는 되돌리지 않는다. 임시 DB·container·checkout은 생성하지 않았다.
