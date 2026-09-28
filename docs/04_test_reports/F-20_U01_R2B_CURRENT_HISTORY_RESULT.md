# F-20/U-01 R2b 현재 projection·역사 분리 결과

## 판정

`COMPLETED` — 지정된 exact2 범위의 로컬 RED→GREEN 및 인접 통제 검증을 마쳤다. 이는 R2b 제품 writer의 완료 주장이지 U-01/F-20 수락 또는 전체 suite PASS 판정이 아니다. C30 CRITICAL `OPEN_BLOCKING`, release `DEFER`를 유지한다.

## 판단 이유

- 담당: `developer-primary-f20-u01-r2b`; epoch13 execution token `f20-u01-r2b-execution-fence-epoch-13-r2bstart20260928`, write token `f20-u01-r2b-write-fence-epoch-13-r2bstart20260928`; 만료 `2026-09-29T00:17:16+00:00`. 착수 시 branch `codex/f18-wsl-ops`, HEAD `fdb84603f655f5d0424b0959cb558d66c6fe6bd9`, Git status clean, G-05 `PASS sequence=1792`.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R2b WI `5893B59824CD55BC13C91023489A5314A75B376FB44D8DA8AF8BA70DCB19F9BC`; Invocation `205B7AC221C43BFF606B113673EDA9E97EE8A590117ACF089A0E2F7B46CC1C78`.
- 이전 WSL-server 전체 suite의 유일한 실패는 현재 projection mode가 `F20_U01_R2B_CURRENT_HISTORY_START`인데 테스트가 과거 R1b mode를 기대한 것이다. 이 로컬 실행에서도 같은 단일 node가 수정 전 `1 failed in 9.54s`(exit 1)로 RED였고, 현재 mode 및 progress/digest/manifest 위조 거부 코드만 R2b route로 바꾼 후 `1 passed in 21.26s`(exit 0)로 GREEN이었다. handoff의 `HANDOFF_NEXT_ACTION_MISMATCH`, manifest 미수락, C30 `OPEN_BLOCKING`, `DEFER` assertion은 그대로다.
- R1b 발급 commit `1126444733f2dabe0525d5e6be250b079ace1042`, R2 발급 commit `214cd61740c84971a71b6e1178047eec40322d52`에서 progress/digest/manifest와 WI/Invocation Git blob을 직접 조회·해시 대조했다. R1b 결과는 `edf0fcc5505e8a74bc48c93fa1b67641e4146492`, R2 결과는 `da86090f72645c4c6ec7812618cbae5249bd8a69`의 Git blob에 결박했다. 기존 R5e/R1 역사 검증은 삭제하지 않았다. 역사 검증을 포함한 두 node는 `2 passed, 686 deselected in 22.08s`(exit 0)였다.
- 인접 R2/R2b 통제의 첫 실행은 기존 Windows 전역 pytest 임시 경로 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` ACL 접근 거부로 setup `11 errors`(exit 1)였다. 이는 제품 assertion 실패가 아니다. 전용 `runtime/pytest-f20-u01-r2b-writer` basetemp로 다시 실행한 결과 `11 passed in 115.64s`(exit 0). 전용 경로와 내부 reparse target 11개가 모두 해당 경로 안임을 확인한 뒤 정확한 폴더만 제거했고 잔류 `False`를 확인했다. 기존 전역 pytest 폴더는 변경·삭제하지 않았다.
- `python -B scripts/check_project_progress.py .`는 수정 전후 `G-05 ... PASS sequence=1792`(exit 0). `git diff --check` exit 0. Git의 전역 ignore 설정 읽기 경고는 별도 환경 경고이며 위 시험의 판정에 사용하지 않았다.

## 조치·영향·미검증

- 변경 경로는 `tests/tooling/test_project_progress.py`와 이 보고서 exact2뿐이다. 현 테스트 기대 mode/오류 네 곳과 테스트 이름·역사 Git blob anchor를 변경했다. 검증기, canonical Event/progress/digest/manifest, API/DB/auth/UI 및 실제 제품 동작은 변경하지 않았다.
- 정식 Developer `FAILURE_REPORT` 0회. 환경 setup 오류 1회는 전용 basetemp로 해결했고 원래 전역 ACL은 그대로다.
- 미검증: Main 독립 diff·focused review, 제품 commit/push, WSL-server 동일 SHA 집중·전체 suite, 실제 API/DB/브라우저·PG15/PG18RC, C30 사고 복구, U-01/F-20 최종 수락. 이전 suite의 116 skip/14 warning은 PASS로 승격하지 않는다. ysna-server/Production 및 main 병합은 실행하지 않았다.
- 다음: Main이 exact2 diff와 이 증거를 독립 검토한 뒤 동일 branch에 commit/push하고, `ssh WSL-server`에서 pull한 정확한 SHA로 집중 및 정식 전체 suite를 재검증한다. rollback은 본 exact2 변경만 이전 commit으로 되돌리는 후속 정상 Git commit이며 원장이나 다른 사용자의 변경을 덮어쓰지 않는다. `docs/WORK_STATUS.md`와 canonical progress/HANDOFF 갱신은 Main 소유이며 이 writer가 수정하지 않았다.
