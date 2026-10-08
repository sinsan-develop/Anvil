# F-20 R5c C09 Main takeover·final 역사 원문 WorkInstruction

- 발행자: Main Agent 어울; Work Package `F-20/R5c`.
- 기준: 승인된 Anvil 설계·작업계획 F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` R5c, 현재 G-05 seq1749.
- 분류: 과거 review 원문과 현재 후속 파일의 검증 분리. 기능 범위·요구사항·공개 API·DB·권한·중요 위험 변경 없음.
- 개발 Windows 로컬 기존 `codex/f18-wsl-ops`; Main이 push한 정확한 SHA를 `ssh WSL-server`에서 pull해 검증한다. 새 branch, ysna-server/Production 금지.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R5C_RESULT.md`
2. `tests/tooling/test_project_progress.py`

R5b epoch6 write→worker lease를 append-only 회수하고 R5c epoch7 worker/write token·exact2 scope·만료·dispatch SHA의 G-05가 유효한 뒤 단일 writer가 위 두 경로만 수정한다. Main은 control checker/overlay/G-05와 상태 기록을 맡고 같은 제품 파일을 동시에 수정하지 않는다.

## 변경·검증 계약

- C09 Main takeover 4, final acceptance 2 node의 기존 RED를 재현한다. 당시 `10bbb87` Git tree의 `C-09_R4_PRODUCT_QUALITY_REVIEW_ORIGINAL.md`는 18,269 bytes이고 현재 파일은 trailing LF 1 byte가 빠진 18,268 bytes다. 역사 fixture는 당시 Git blob과 frozen SHA를 함께 결박한다. 현재 문서·frozen 상수·원장 Event를 덮어쓰거나 정정하지 않는다.
- Main takeover builder와 final builder의 선행 WI/manifest·spec/quality review·제품 raw map·raw Event prefix·review severity·failure counting·lease 및 successor 검사를 약화하지 않는다. 역사 quality blob 누락·위조는 거부하고 원문 이외 파일의 위조도 기존 테스트대로 거부한다.
- C30 canonical audit 1, E09 3 및 실제 DB/API/브라우저는 R5c 범위 밖이다. 이들을 skip/xfail 또는 PASS로 표시하지 않는다. 변경 파일 전체와 G-05를 로컬에서 실행하고 정확한 결과/잔여 위험/rollback을 보고한다. Main이 commit/push와 WSL 동일 SHA·전체 suite를 맡는다.

## 완료 경계

R5c 6건 GREEN만으로 F-20 전체 suite, C30 감사 사고 복구, E09 역사 검증, 실제 DB/API/브라우저 또는 main 병합을 주장하지 않는다.
