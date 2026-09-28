# F-20/R5d E-09 역사 WorkInstruction 원문 재작업 결과

## 판정

`COMPLETED` — R5d exact2 범위의 E-09 Start 1건·Final 2건을 로컬 RED→GREEN으로 복구했다. 이 판정은 E-09 역사 fixture 집중 검증에만 적용한다. F-20 전체 suite·C30 원장 감사·실제 DB/API/브라우저·main 병합은 완료로 주장하지 않는다.

## 기준·소유권

- 시작 worktree/branch/HEAD: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, `faa239db03c924445da63e8bb1e38d190177cad0`; 지정 upstream `development/codex/f18-wsl-ops`, 시작 Git dirty/untracked 0.
- canonical G-05 seq1761, `developer-primary-f20-r5d` epoch8 ACTIVE worker+write, execution token `f20-r5d-execution-fence-epoch-8-r5d20260928`, write token `f20-r5d-write-fence-epoch-8-r5d20260928`, 만료 2026-09-28 22:11:50 KST. exact2는 이 보고서와 `tests/tooling/test_project_progress.py`이다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합검증매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R5d WI `1EDD48AA20B79AAF195BC5B7E0A112441F053DAB19E498A190EAC65C6867F958`, Invocation `7A5EEC440091452E4D3F32CECB29D2B7B273E3D34870F24543C033C6AB3B4D86`. 현재 progress의 설계·계획 hash와 active WI/Invocation hash 일치, DIR-3 CLEARED, pending approval 없음. 문서 EOF/byte hash 및 관련 F-20/E-09 계약을 대조했다.

## 판단 이유·변경

- 수정 전 E-09 5개 node 중 3개가 `E09_AUTHORITY_INVALID` / `E09_FINAL_FROZEN_DRIFT`로 실패했다. `30ca8a2d5a8f856ee4d82ae4f47b47bc60109342` Git tree의 WI는 5,196 bytes, frozen SHA-256 `2DCA27CDB9DF351F62AA77FE0424711DB7E31AF2CD287C4239A8834B3B77B85D`와 일치한다. 현재 후속 WI는 5,195 bytes/SHA `71DA40BB182A1FE023AE8D22543FCAB7CD7AFF9BE71477D29BF601B27290D3F0`이며 마지막 LF 1 byte만 빠졌다.
- `tests/tooling/test_project_progress.py`의 E-09 두 역사 control class에서만 해당 Git blob을 읽고 길이·독립 frozen SHA를 검증한 후 in-memory WI overlay를 적용한다. Git blob 누락·한 바이트 위조를 거부하는 음성 2개를 추가했다. 기존 E-09 제품 5경로·다른 authority·raw Event prefix·dual lease·review/final 위조 거부를 유지한다.
- 현재 WI, checker와 frozen 상수, Event 원장, 다른 제품·통제 파일은 수정하지 않았다. 변경 경로는 위 테스트 파일과 이 결과보고서뿐이다.

## 실제 검증

| 명령·환경 | 실제 결과 |
|---|---|
| 로컬 `.\.venv\Scripts\python.exe scripts\check_project_progress.py` (전/후) | 각 exit0, `PASS sequence=1761 reporting=AUTO_CONTINUE` |
| 로컬 `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py::E09StartControlTests tests/tooling/test_project_progress.py::E09FinalAcceptanceControlTests --basetemp=D:/tmp/anvil-f20-r5d-e09-red-base` | 수정 전 exit1, **3 failed, 2 passed in 16.52s**. 기존 3건 RED |
| 같은 E-09 두 class, 최종 `--basetemp=D:/tmp/anvil-f20-r5d-e09-report-final-base` | 보고서 작성 후 재실행 exit0, **7 passed in 8.20s**. 기존 5건과 누락·위조 음성 2건 |
| 로컬 변경 파일 전체 `tests/tooling/test_project_progress.py`, `--basetemp=D:/tmp/anvil-f20-r5d-test-progress-base` | 기존 C30 raw Event 실패 마커 1건을 관측했다. 장시간 실행 중 Main 지시에 따라 중단(exit1); 최종 집계 없음, 전체 PASS로 표시하지 않음 |
| `git diff --check` | exit0 |

별도 음성 테스트 RED는 helper 구현 전 `2 failed`(exit1), 구현 후 첫 실행에서는 위조 입력 fixture가 역사 overlay를 읽는 오류로 `1 failed, 6 passed`(exit1)였다. 위조 입력을 역사 blob 한 바이트 절단으로 교정한 최종 실행이 `7 passed`다. 이는 정식 Developer `FAILURE_REPORT`가 아니며 실패 횟수 0이다. 테스트용 Windows `D:\tmp\anvil-f20-r5d-*` basetemp 일곱 경로는 확인 시 모두 ABSENT였다. 공유 DB/Docker·WSL-server·ysna-server/Production·외부 Provider 호출/변경은 수행하지 않았다.

## 미검증·다음 조치·rollback

Main의 exact2 diff 독립 검토 후 기존 branch에 commit/push하고, `ssh WSL-server`가 해당 SHA를 Git pull하여 E-09 집중·통제·전체 suite를 실행해야 한다. C30 raw Event 감사 1, 실제 PG15/PG18RC·API/브라우저 Network·11개 메뉴·backup/restore·rollback은 R5d 집중 검증으로 입증되지 않는다. skip/xfail하지 않았고 F-20 수락·main 병합·신규 branch 생성은 금지 상태다.

회귀 시 Main이 R5d 제품 commit을 정상 Git revert하고 G-05·E-09 대상 테스트를 재검증한다. 이 writer는 commit/push·progress/HANDOFF 갱신 권한이 없으며 결과와 diff를 Main에 인계한다.
