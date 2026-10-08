# F-20/U-01 R1b 현재 projection 역사 테스트 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event와 epoch11 exact2 dual lease/G-05 PASS 전 제품 파일 수정 불가.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` U-01 R1b.
- 환경: Windows 로컬 개발, 로컬 push의 정확한 SHA를 `ssh WSL-server`에서 격리 테스트. 새 branch·ysna-server·Production 금지.

## 정확한 제품 쓰기 범위

1. `tests/tooling/test_project_progress.py`
2. `docs/04_test_reports/F-20_U01_R1B_HISTORY_RESULT.md`

현재 R1 epoch10 write→worker 회수와 새 epoch11 worker/write exact2 발급의 G-05 PASS 전에는 위 두 파일을 수정하지 않는다. Main은 위 파일을 동시에 수정하지 않는다.

## 구현·검증

- 현재 `test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`의 RED가 R5e 과거 mode 고정 기대와 R1 현재 mode의 불일치임을 확인한다. 새 epoch11 발급 후 이 테스트가 읽는 현재 projection은 R1이 아닌 정확한 `F20_U01_R1B_HISTORY_START`임을 검증한다.
- 현 bundle이 미수락, C30 CRITICAL `OPEN_BLOCKING`, release `DEFER`임을 함께 확인한다. 진행상태·digest·manifest 위조 음성은 새 route의 `F20_U01_R1B_PROGRESS_INVALID`, `F20_U01_R1B_DIGEST_INVALID`, `F20_U01_R1B_MANIFEST_INVALID`를, handoff 음성은 기존 공통 `HANDOFF_NEXT_ACTION_MISMATCH`를 검증하며 assertion을 제거하지 않는다. 과거 R1/R5e 원문 검증은 당시 Git blob/hash로 분리하고 현재 projection에 섞거나 삭제하지 않는다.
- 수정 파일 하나의 집중·인접 역사군/G-05를 로컬에서 RED→GREEN으로 확인하고 결과보고서에 명령·exit·diff·미검증·rollback을 기록한다. Main은 독립 diff 검토·commit/push 뒤 WSL-server 같은 SHA에서 집중·정식 전체 suite를 실행하고 임시 자원을 제거한다.
- API/DB/auth/화면·기존 Event·manifest·frozen hash·다른 테스트를 수정하거나 skip/xfail하지 않는다. 키/환경 실패는 제품 실패와 분리 기록한다.

## 완료 경계

R1b GREEN은 U-01 전체·F-20 수락이 아니다. C30 사고 `OPEN_BLOCKING`, release `DEFER`, 기존 116 skip과 실제 운영 대상 제외를 유지한다.
