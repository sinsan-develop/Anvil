# F-20/U-01 R2b 현재 projection 역사 테스트 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event와 epoch13 exact2 dual lease/G-05 PASS 전 제품 파일 수정 불가.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` U-01 R2b.
- 환경: Windows 로컬 개발, 지정 원격 push의 정확한 SHA를 `ssh WSL-server`에서 격리 검증. 새 branch·ysna-server·Production 금지.

## 정확한 제품 쓰기 범위

1. `tests/tooling/test_project_progress.py`
2. `docs/04_test_reports/F-20_U01_R2B_CURRENT_HISTORY_RESULT.md`

Main은 R2 epoch12 write→worker lease를 순서대로 회수하고 새 epoch13 worker/write exact2를 발급한다. G-05 PASS 전에는 위 경로를 수정하지 않는다. Main은 단일 Developer의 제품 경로를 동시에 쓰지 않는다.

## 구현·검증

- `test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`의 RED를 기존 R1b mode 고정값과 현 R2 mode의 불일치로 재현한다. 새 epoch13 발급 후 현재 bundle의 mode와 위조 거부 오류는 정확한 R2b route를 기대한다. 미수락, C30 `OPEN_BLOCKING`, release `DEFER`, handoff 불변식은 유지한다.
- 과거 R1b와 R2의 progress/digest/manifest·WI/결과는 각 안전 checkpoint의 Git blob으로 별도 검사한다. 현재 bundle의 mode를 과거로 위장하거나 역사 assertion을 삭제·skip·xfail하지 않는다.
- 로컬 집중·인접 역사군/G-05의 RED→GREEN, 변경 diff·명령·exit·잔여 위험·rollback을 결과보고서에 기록한다. Main 독립 검토·commit/push 뒤 WSL-server 동일 SHA에서 집중 및 정식 전체 suite를 실행한다.
- API/DB/auth/UI, Event 원문·manifest·frozen hash·다른 테스트는 수정하지 않는다. 환경/키 실패는 제품 실패와 분리한다.

## 완료 경계

R2b GREEN도 U-01/F-20 전체 수락이 아니다. C30 사고 `OPEN_BLOCKING`, release `DEFER`, 기존 skip/warning 및 Production 미실행을 유지한다.
