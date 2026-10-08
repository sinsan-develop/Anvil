# F-20 R5b C09 시작·R3·R4 역사 권위 경계 WorkInstruction

- 발행자: Main Agent 어울; Work Package `F-20/R5b`.
- 기준: 승인된 Anvil 설계·작업계획 F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` R5b, 현재 G-05 seq1743.
- 분류: 당시 C09 권위 bytes와 현재 후속 정본의 검증 분리. 기능 범위·요구사항·공개 API·DB·권한·중요 위험 변경 없음.
- 개발 Windows 로컬 기존 `codex/f18-wsl-ops`; Main이 push한 정확한 SHA는 `ssh WSL-server`에서 pull해 검증한다. 새 branch, ysna-server/Production 금지.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R5B_RESULT.md`
2. `tests/tooling/test_project_progress.py`

R5a write→worker lease를 append-only 회수하고 R5b epoch6 worker/write token·exact2 scope·만료·dispatch SHA의 G-05가 유효한 뒤 단일 writer가 위 두 경로만 수정한다. Main은 control checker/overlay/G-05와 상태 기록을 맡고 같은 제품 파일을 동시에 수정하지 않는다.

## 변경·검증 계약

- C09 시작 5, R3 3, R4 2 node의 기존 RED를 정확히 재현한다. Main control은 당시 Git tree에서 설계·계획·매트릭스·테스트계획·운영규칙 원문을 읽어 고정 SHA와 비교한다. 현재 승인 문서의 SHA를 과거 상수로 바꾸거나 현 정본을 옛 문서로 덮지 않는다.
- 제품 테스트는 각 역사 builder가 당시 권위 blob을 쓰는지, blob 누락·위조·predecessor manifest/WI 변조를 거부하는지 양성·음성으로 검증한다. 기존 contract의 token·scope·raw Event prefix·review 규칙을 약화하지 않는다.
- C09 takeover/final 6, C10~C13 15, E09 3, C21 WSL 객체 3, C30 raw Event 사고는 R5b 범위 밖이다. 이들을 skip/xfail 또는 PASS로 표시하지 않는다. 변경 파일 전체와 G-05를 로컬에서 실행하고 결과/잔여 위험/rollback을 보고한다. Main이 commit/push와 WSL 동일 SHA·전체 suite를 맡는다.

## 완료 경계

R5b 10건의 GREEN만으로 C09 전체 역사 수락, F-20 전체 suite, 실제 DB/API/브라우저/11개 메뉴 또는 main 병합을 주장하지 않는다.
