# F-20/R5c C09 Main takeover·final 역사 원문 재작업 결과

## 판정

`COMPLETED` — 승인된 exact2 제품 범위의 C09 Main takeover 4건·final acceptance 2건을 RED→GREEN으로 복구했다. 이 판정은 R5c 로컬 집중 검증에만 적용한다. F-20 전체 수락, 전체 suite PASS, C30 감사 복구, E09 역사 검증 또는 실제 DB/API/브라우저 검증은 주장하지 않는다.

## 기준·소유권

- 시작 worktree/branch/HEAD: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, `3b2c1de7b14411fc626862c4ab3697a039ded8e1`; 지정 `development/codex/f18-wsl-ops`와 SHA 일치. 시작 제품 경로는 clean, Main 소유 `docs/WORK_STATUS.md`만 별도 수정 중이었다.
- canonical seq1755, `developer-primary-f20-r5c` worker+write epoch7, exact2 scope는 이 보고서와 `tests/tooling/test_project_progress.py`; 두 fencing token·만료(2026-09-28 20:29:27 KST) 확인. 변경 전 G-05 `PASS sequence=1755 reporting=AUTO_CONTINUE`.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`. 문서 EOF/byte hash 및 F-20/C09 관련 계약과 현재 progress·handoff·WorkInstruction을 확인했으며 상충 지시 없음. 대형 문서의 모든 문장에 대한 개별 의미 해석을 주장하지 않는다.

## 원인·diff

- `10bbb879fb15ce4fa7b1a750f872c33af3cddf46` Git tree의 `C-09_R4_PRODUCT_QUALITY_REVIEW_ORIGINAL.md`는 18,269 bytes, frozen SHA-256 `E109EB0D58613E3ABF67D42801AA0C9573E6BBD8EAD70AF6899DCF5ADCEFB021`이다. 현재 파일은 trailing LF 한 바이트가 빠진 18,268 bytes다. 역사 builder·cached check·final immutable check가 현재 후속 파일을 당시 원문으로 읽어 실패했다.
- `tests/tooling/test_project_progress.py`의 두 역사 control class가 fixture 안에서만 당시 Git blob을 읽고 frozen byte 길이·SHA를 독립 검증하도록 했다. 신선한 임시 clone fixture에도 동일 역사 원문만 복사한다. 당시 Git blob 누락·위조는 takeover에서 거부하고 위조 원문은 final immutable 검사에서도 거부하는 음성 2건을 추가했다.
- 현재 review 파일, frozen 상수, Event 원장, 검증기, 다른 제품 파일은 수정하지 않았다. 원문 이외 review/선행 문서·제품 raw map·lease/severity/failure counting/후속 검사는 기존 검증을 유지한다.

## 실제 실행

| 명령 | 결과 |
|---|---|
| `.\.venv\Scripts\python.exe scripts/check_project_progress.py` (수정 전/후) | 각 exit0, G-05 seq1755 PASS |
| `.\.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -k 'C09MainTakeoverControlTests or C09FinalAcceptanceControlTests' --basetemp=.pytest_tmp_f20_r5c_red` | 수정 전 exit1, **6 failed, 5 passed, 671 deselected in 30.25s**. 실패 6건은 WorkInstruction 대상과 정확히 일치 |
| 동일 `-k` 명령, `--basetemp=.pytest_tmp_f20_r5c_green` | 첫 수정 후 exit0, **11 passed, 671 deselected in 43.24s** |
| 동일 `-k` 명령, `--basetemp=.pytest_tmp_f20_r5c_negative` | 음성 2건 추가 후 exit0, **13 passed, 671 deselected in 39.34s** |
| `.\.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q --basetemp=.pytest_tmp_f20_r5c_full` | 초기 약 10% 실행에서 실패 마커 1건 관측 후 장시간 Windows 실행을 중단(exit1). 최종 node/집계 없음. 변경 파일 전체 PASS로 표시하지 않는다 |
| `git diff --check` | exit0 |

전용 pytest basetemp 네 이름은 종료 후 모두 존재하지 않음을 확인했다. 공유 DB/Docker·WSL-server·ysna-server/Production·외부 Provider 변경 또는 호출 없음. 이 writer의 정식 `FAILURE_REPORT` 0건; 의도한 RED 6건과 전체 파일 미완주를 분리한다.

## 미검증·다음 조치·rollback

Main이 exact2 diff·독립 리뷰 후 같은 branch에 안전한 commit/push를 수행하고, `ssh WSL-server`에서 그 정확한 SHA를 Git으로 받아 C09 대상과 전체 suite를 검증해야 한다. 기존 잔여 C30 1·E09 3은 이 범위 밖이며 skip/xfail하지 않았다. 실제 PG15/PG18RC, API, 브라우저 Network, 11개 메뉴·backup/restore·rollback도 미검증이다. F-20 수락·main 병합은 불가하다.

회귀 시 Main이 R5c 제품 commit을 대상으로 정상 Git revert하고 G-05·대상 테스트를 재검증한다. 이 writer는 commit/push·progress/HANDOFF 갱신 권한이 없으며 결과와 diff를 Main에 인계한다.
