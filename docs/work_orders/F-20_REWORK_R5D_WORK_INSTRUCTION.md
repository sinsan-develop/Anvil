# F-20 R5d E09 역사 WorkInstruction 원문 WorkInstruction

- 발행자: Main Agent 어울; Work Package `F-20/R5d`.
- 기준: 승인된 Anvil 설계·작업계획 F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` R5d, 현재 G-05 seq1755.
- 분류: E09 당시 WI 원문과 현재 후속 파일의 검증 분리. 기능 범위·요구사항·공개 API·DB·권한·중요 위험 변경 없음.
- 개발 Windows 로컬 기존 `codex/f18-wsl-ops`; Main이 push한 정확한 SHA를 `ssh WSL-server`에서 pull해 검증한다. 새 branch, ysna-server/Production 금지.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R5D_RESULT.md`
2. `tests/tooling/test_project_progress.py`

R5c epoch7 write→worker lease를 append-only 회수하고 R5d epoch8 worker/write token·exact2 scope·만료·dispatch SHA의 G-05가 유효한 뒤 단일 writer가 위 두 경로만 수정한다. Main은 control checker/overlay/G-05와 상태 기록을 맡고 같은 제품 파일을 동시에 수정하지 않는다.

## 변경·검증 계약

- E09 start 1, final acceptance 2 node의 기존 RED를 재현한다. 당시 `30ca8a2d5a8f856ee4d82ae4f47b47bc60109342` Git tree의 `docs/work_orders/E-09_WORK_INSTRUCTION.md`는 5,196 bytes이고 frozen SHA-256은 `2DCA27CDB9DF351F62AA77FE0424711DB7E31AF2CD287C4239A8834B3B77B85D`다. 현재 후속 WI는 마지막 LF 1 byte가 빠진 5,195 bytes다. 역사 fixture는 당시 Git blob과 frozen SHA를 함께 결박한다. 현재 WI·frozen 상수·원장 Event를 덮어쓰거나 정정하지 않는다.
- E09의 다른 선행 authority, 제품 5경로, start digest/manifest·invocation, raw Event prefix, dual lease·review·final acceptance 위조 거부를 약화하지 않는다. 역사 WI blob 누락·위조는 거부하고 기존 다른 경로 변조 음성을 유지한다.
- C30 canonical raw Event 감사 1 및 실제 DB/API/브라우저는 R5d 범위 밖이다. 이를 skip/xfail 또는 PASS로 표시하지 않는다. 변경 파일 전체와 G-05를 로컬에서 실행하고 정확한 결과/잔여 위험/rollback을 보고한다. Main이 commit/push와 WSL 동일 SHA·전체 suite를 맡는다.

## 완료 경계

R5d E09 3건 GREEN만으로 F-20 전체 suite, C30 감사 사고 복구, 실제 DB/API/브라우저 또는 main 병합을 주장하지 않는다.
