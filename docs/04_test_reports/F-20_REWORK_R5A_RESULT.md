# F-20/R5a 현재 진행상태 계약 재작업 결과

## 판정

`COMPLETED` — WorkInstruction의 현재 진행상태 테스트 3건은 Windows 로컬에서 RED를 재현하고 GREEN으로 보완했다. 이 판정은 F-20 수락, 전체 suite 합격, C30 감사 원장 복구, WSL-server 동일 SHA 검증 또는 실제 DB·API·브라우저 검증을 뜻하지 않는다. Main Agent의 독립 검토·commit/push·WSL 검증이 남아 있다.

## 기준과 쓰기 경계

- 담당: `developer-primary-f20-r5a`; Work Package `F-20/R5a`; branch `codex/f18-wsl-ops`.
- 시작 HEAD: `b0a22312dbf7dd95046a5d5337f555f086d26fe3`, 시작 Git status clean. lease dispatch 기준 SHA `3b7f8391f3392f9a862c1be9c01da47cb277b550`는 그 선행 commit이다.
- 정본 G-05: Event seq1743, epoch5 worker `f20-r5a-execution-fence-epoch-5-f3a32d5d`, write `f20-r5a-write-fence-epoch-5-f3a32d5d`; actor `developer-primary-f20-r5a`; 두 lease 모두 ACTIVE, 만료 `2026-09-28T08:41:32+00:00`, exact2 path scope 확인 후 수정했다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R5a WorkInstruction `B911C191427722739C099A71AE03C5FF937720043EB3E82BF434B2DCB596C9B3`; Invocation `F81069EE0DA0AD95E8032AA7D0F8CCA88D52FF2E0A158E0D1BE89450FC6BBD36`.
- 제품 writer 변경은 `tests/tooling/test_project_progress.py`와 이 보고서 exact2뿐이다. Main이 동시에 변경한 R5a control/status 파일은 이 writer의 결과물로 계상하지 않는다.

## 판단 이유·변경 전후

1. 현재 F-20 detached digest는 raw-byte 기반 R5a overlay가 검증한다. 기존 테스트가 과거 canonical-JSON `validate_detached_progress_binding`을 현재 파일에 직접 적용해 정상 정본에도 `DETACHED_DIGEST_MISMATCH`를 냈다. 현재 `validate_bundle`의 정상 PASS와 progress·handoff·detached digest·manifest 위조 거부를 검사하도록 바꿨다. in-memory detached digest 위조의 최초 `validate_bundle=[]`은 Main control 결함으로 전달했고, Main이 별도 control scope에서 수정한 후 이 테스트가 GREEN이었다.
2. 현재 F-20 handoff summary에는 `valid_failure_count`가 없다. 테스트가 없는 필드를 증가시켜 `KeyError`를 냈다. progress의 실제 failure projection 값만 위조하고 snapshot을 재계산해 `FAILURE_PROJECTION_MISMATCH`를 확인한다.
3. 기존 G-05 all-category fixture는 현재 Event contract에 등록된 `WORK_INSTRUCTION_ISSUED`, `PHASE_GATE_COMPLETED`, `PACKAGE_REVIEWED`를 빠뜨렸다. 이 세 타입의 정확한 required payload를 fixture의 in-memory successor에 추가했다. 필수값 제거 변조 거부 반복도 추가 타입을 포함하도록 확장했다. contract의 wildcard나 검사를 약화하지 않았다.

## 명령·실제 결과

- RED: `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r5a_red <지정 3 node>` → exit 1, `3 failed in 4.30s`. 실패는 위 세 원인과 일치했다.
- 중간 RED/GREEN: 테스트 수정 직후 같은 3 node, `--basetemp=.pytest_tmp_f20_r5a_red2` → exit 1, `1 failed, 2 passed in 32.95s`; 당시 Main 전용 임시 pytest 경로가 untracked여서 baseline `F20_R5A_GIT_INVALID`였다. Main이 해당 경로를 확인·정리했다.
- GREEN: 같은 3 node, `--basetemp=.pytest_tmp_f20_r5a_green` → exit 0, `3 passed in 34.07s`. 정상 정본과 progress/handoff/digest/manifest 위조, failure evidence/projection 및 Event payload 거부를 포함한다.
- 파일 전체 첫 실패 판별: `.\.venv\Scripts\python.exe -m pytest -q -x -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r5a_first_failure tests/tooling/test_project_progress.py` → exit 1, `1 failed, 8 passed in 71.21s`. 첫 실패 `C30CanonicalReconciliationTests.test_no_early_acceptance_or_lease_revoke`는 seq1334 raw Event prefix가 현재 원장과 생성기 사이에서 다르다는 기존 감사 이력 사고다. R5a의 세 테스트와 독립된 범위다.
- 변경 파일 전체 실행은 `--basetemp=.pytest_tmp_f20_r5a_file`로 시작했으나 약 10%에서 의도적으로 중단했다. 부분 출력의 1 FAIL은 위 `-x`로 재현한 C30 실패이며, 이 중단 실행을 전체 파일 검증으로 주장하지 않는다.
- `.\.venv\Scripts\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=1743 reporting=AUTO_CONTINUE` (writer 변경 및 Main control 변경이 dirty인 상태의 현재 계약). `git diff --check -- tests/tooling/test_project_progress.py` → exit 0.

## 미검증·잔여 위험·다음 조치

- 직전 Main의 WSL full suite exact SHA `bd6a5439c5f744e364a3daed13533ec21e13cc22`는 `8131 passed, 41 failed, 116 skipped`; 그중 현재 3 node가 로컬 GREEN이지만, 새 제품 exact SHA의 full suite를 아직 실행하지 않았으므로 `38 failed`를 새 결과로 확정하지 않는다. C30 raw-prefix 1, C21 3, C09~C13 31, E09 3이 범위 밖으로 남는다.
- 로컬 파일 전체/프로젝트 전체, WSL-server 동일 SHA, 실제 DB·API·브라우저·11개 메뉴·Provider, PG15/PG18RC, Monitoring·backup/restore·rollback은 이 writer가 실행하지 않았다. 실패·SKIP·미실행을 PASS로 전용하지 않는다.
- Main은 exact2 diff와 control 수정의 독립 검토 후 commit/push하고, WSL-server에서 같은 SHA의 집중/전체 suite와 G-05를 재실행해야 한다. C30 원장 역사 변경은 이 테스트에서 숨기거나 수정하지 않는다.
- rollback: Main이 아직 commit하지 않은 경우 이 exact2 변경만 별도 patch로 되돌릴 수 있다. commit 후에는 해당 exact2 변경 commit을 안전한 역방향 commit으로 되돌리며, historical Event·approval·사용자 dirty 파일은 건드리지 않는다.
- progress/HANDOFF의 최종 결과·lease 회수는 Main 담당이다. 이 writer는 그 파일을 수정하지 않았다. 정식 Developer 실패보고 0회; 위 RED는 의도된 재현/검증 결과다.
